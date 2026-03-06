import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { cn, axialToPixel, pixelToAxial, DIRECTIONS, Coord, HEX_SIZE } from './utils';

// Types (Mirroring server)
type PlayerColor = 'black' | 'white';
type BoardState = Record<string, PlayerColor>;

interface Player {
  id: string;
  nickname: string;
  ready: boolean;
}

interface GameState {
  board: BoardState;
  currentPlayer: PlayerColor;
  blackLost: number;
  whiteLost: number;
  winner: PlayerColor | null;
  status: 'lobby' | 'playing' | 'finished';
  players: {
    black: Player | null;
    white: Player | null;
  };
}

const socket: Socket = io(window.location.origin, {
  path: '/socket.io/',
  transports: ['polling', 'websocket'],
  reconnectionAttempts: 20,
  timeout: 45000,
  autoConnect: true,
});

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [role, setRole] = useState<PlayerColor | 'spectator'>('spectator');
  const [selected, setSelected] = useState<string[]>([]);
  const [hoverDir, setHoverDir] = useState<Coord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.log("App mounted, setting up socket listeners");
    
    socket.on('connect', () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error("Socket connection error:", err);
      setErrorMsg(`Connection error: ${err.message}`);
    });

    socket.on('init', (data: { gameState: GameState; role: PlayerColor | 'spectator' }) => {
      console.log("Received init:", data);
      setGameState(data.gameState);
      setRole(data.role);
    });

    socket.on('gameStateUpdate', (newState: GameState) => {
      console.log("Received gameStateUpdate");
      setGameState(newState);
      setSelected([]); // Clear selection on move
      setHoverDir(null);
      setErrorMsg(null);
      
      if (newState.winner) {
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    });

    socket.on('playerUpdate', (players: { black: Player | null; white: Player | null }) => {
      console.log("Received playerUpdate:", players);
      setGameState(prev => prev ? { ...prev, players } : null);
    });

    socket.on('moveError', (msg: string) => {
      console.log("Received moveError:", msg);
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 3000);
    });

    return () => {
      console.log("Cleaning up socket listeners");
      socket.off('connect');
      socket.off('connect_error');
      socket.off('init');
      socket.off('gameStateUpdate');
      socket.off('playerUpdate');
      socket.off('moveError');
    };
  }, []);

  // ... (rest of the component)

  // Render Helpers
  // ...

  const handleHexClick = (q: number, r: number) => {
    if (!gameState || gameState.winner) return;
    if (role === 'spectator' || role !== gameState.currentPlayer) return;

    const key = `${q},${r}`;
    const cellContent = gameState.board[key];

    // If clicking a neighbor of selection, try to move
    if (selected.length > 0) {
      // Check if clicked cell is a neighbor of ANY selected cell
      // Actually, for a move, we usually click a direction.
      // Let's simplify: 
      // 1. If clicking own marble: Toggle selection (up to 3).
      // 2. If clicking empty or opponent: Check if it defines a valid direction from the selection.
      
      // Is it a selection toggle?
      if (cellContent === role) {
        if (selected.includes(key)) {
          setSelected(selected.filter(k => k !== key));
        } else {
          if (selected.length < 3) {
            // Check adjacency to existing selection
            // We allow selecting non-adjacent temporarily? No, strict UI is better.
            // But user might select 1, then 3 (skipping 2).
            // Let's just allow adding, validation happens on move.
            // Better: Only allow adding if adjacent to current group.
            const isAdjacent = selected.some(sKey => {
               const [sq, sr] = sKey.split(',').map(Number);
               return Math.abs(sq - q) <= 1 && Math.abs(sr - r) <= 1 && Math.abs((-sq-sr) - (-q-r)) <= 1;
            });
            
            if (isAdjacent) {
               // Check linearity
               const newSel = [...selected, key];
               // Simple linearity check: all must share q, r, or s axis?
               // Or just let them select and validate later.
               // Let's just push and let user correct if needed.
               setSelected(newSel);
            } else {
               // If not adjacent, maybe they want to start new selection?
               setSelected([key]);
            }
          } else {
             // Max 3, start new selection
             setSelected([key]);
          }
        }
        return;
      }
      
      // It's a move attempt?
      // Determine direction.
      // If we clicked a neighbor of a selected piece, that defines a direction.
      // We need to find WHICH selected piece is neighbor to the clicked cell.
      let dir: Coord | null = null;
      
      for (const sKey of selected) {
        const [sq, sr] = sKey.split(',').map(Number);
        const dq = q - sq;
        const dr = r - sr;
        // Check if (dq, dr) is a valid unit direction
        if (Math.abs(dq) <= 1 && Math.abs(dr) <= 1 && Math.abs((-dq-dr) - (-sq-sr)) <= 1 && (dq !== 0 || dr !== 0)) {
           // It is a neighbor.
           // But is it a valid unit vector?
           // Valid vectors: (1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)
           const isDir = DIRECTIONS.some(d => d.q === dq && d.r === dr);
           if (isDir) {
             dir = { q: dq, r: dr };
             break;
           }
        }
      }

      if (dir) {
        socket.emit('move', { selected, direction: dir });
      } else {
        // Clicked somewhere unrelated, clear selection
        setSelected([]);
      }
    } else {
      // No selection, select if own
      if (cellContent === role) {
        setSelected([key]);
      }
    }
  };

  // Render Helpers
  const renderHexes = () => {
    const hexes = [];
    const radius = 4;
    
    for (let q = -radius; q <= radius; q++) {
      const r1 = Math.max(-radius, -q - radius);
      const r2 = Math.min(radius, -q + radius);
      for (let r = r1; r <= r2; r++) {
        const { x, y } = axialToPixel(q, r);
        const key = `${q},${r}`;
        const content = gameState?.board[key];
        const isSelected = selected.includes(key);
        
        // Check if this hex is a valid move target (visual feedback)
        // This is complex to calculate for every hex every frame. Skip for now.
        
        hexes.push(
          <div
            key={key}
            className={cn(
              "absolute w-[68px] h-[68px] flex items-center justify-center cursor-pointer transition-all duration-200",
              "hover:brightness-110"
            )}
            style={{ 
              left: `calc(50% + ${x}px)`, 
              top: `calc(50% + ${y}px)`,
              marginLeft: '-34px',
              marginTop: '-34px',
              // Clip path for hex shape
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              backgroundColor: '#334155' // Slate-700 for board cells
            }}
            onClick={() => handleHexClick(q, r)}
          >
            {/* Inner circle for marble */}
            {content && (
              <motion.div
                layoutId={`marble-${key}`}
                className={cn(
                  "w-12 h-12 rounded-full shadow-inner",
                  content === 'black' 
                    ? "bg-stone-900 shadow-[inset_-4px_-4px_10px_rgba(255,255,255,0.1),inset_4px_4px_10px_rgba(0,0,0,0.8)]" 
                    : "bg-stone-100 shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.2),inset_4px_4px_10px_rgba(255,255,255,0.8)]",
                  isSelected && "ring-4 ring-blue-500 scale-110 z-10"
                )}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            {!content && isSelected && (
               <div className="w-4 h-4 rounded-full bg-blue-500/50" />
            )}
          </div>
        );
      }
    }
    return hexes;
  };

  const Lobby = ({ gameState, role, socket }: { gameState: GameState, role: PlayerColor | 'spectator', socket: Socket }) => {
    const [nickname, setNickname] = useState('');
    
    const player = role === 'black' ? gameState.players.black : gameState.players.white;
    
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-stone-900 text-white">
        <h1 className="text-4xl font-bold mb-8">Abalone Lobby</h1>
        <div className="mb-4">
          <input 
            type="text" 
            placeholder="Dein Nickname"
            className="p-2 text-black rounded"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <button 
            className="ml-2 px-4 py-2 bg-blue-600 rounded"
            onClick={() => socket.emit('setNickname', nickname)}
          >
            Speichern
          </button>
        </div>
        <button 
          className={cn("px-8 py-3 rounded-full font-bold", player?.ready ? "bg-green-600" : "bg-blue-600")}
          onClick={() => socket.emit('setReady', !player?.ready)}
        >
          {player?.ready ? 'Bereit!' : 'Bereit drücken'}
        </button>
        <div className="mt-8 text-stone-400">
          <p>Black: {gameState.players.black?.nickname || 'Warten...'} {gameState.players.black?.ready ? '✅' : '❌'}</p>
          <p>White: {gameState.players.white?.nickname || 'Warten...'} {gameState.players.white?.ready ? '✅' : '❌'}</p>
        </div>
      </div>
    );
  };

  if (!gameState) return (
    <div className="flex items-center justify-center h-screen bg-stone-900 text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p>Connecting to server...</p>
        {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
      </div>
    </div>
  );

  if (gameState.status === 'lobby') {
    return <Lobby gameState={gameState} role={role} socket={socket} />;
  }

  return (
    <div className="min-h-screen bg-stone-800 text-stone-100 font-sans flex flex-col items-center p-4">
      <header className="w-full max-w-4xl flex justify-between items-center mb-8 p-4 bg-stone-900/50 rounded-2xl backdrop-blur-sm border border-white/5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Abalone Online</h1>
          <p className="text-stone-400 text-sm">Push 6 opponent marbles off the board</p>
        </div>
        
        <div className="flex gap-8 text-center">
          <div className={cn("p-3 rounded-xl transition-colors", gameState.currentPlayer === 'black' ? "bg-stone-700 ring-2 ring-blue-500" : "")}>
            <div className="text-xs uppercase tracking-wider text-stone-400">Black (You?)</div>
            <div className="text-xl font-bold">{role === 'black' ? 'YOU' : (gameState.players.black ? 'Connected' : 'Waiting...')}</div>
            <div className="text-red-400 text-sm">Lost: {gameState.blackLost}/6</div>
          </div>
          <div className={cn("p-3 rounded-xl transition-colors", gameState.currentPlayer === 'white' ? "bg-stone-100 text-stone-900 ring-2 ring-blue-500" : "bg-stone-700")}>
            <div className={cn("text-xs uppercase tracking-wider", gameState.currentPlayer === 'white' ? "text-stone-500" : "text-stone-400")}>White (Opponent)</div>
            <div className="text-xl font-bold">{role === 'white' ? 'YOU' : (gameState.players.white ? 'Connected' : 'Waiting...')}</div>
            <div className="text-red-500 text-sm">Lost: {gameState.whiteLost}/6</div>
          </div>
        </div>
      </header>

      <main className="relative flex-1 flex items-center justify-center w-full max-w-4xl">
        {/* Game Board Container */}
        <div 
          className="relative w-[600px] h-[600px] bg-stone-900 rounded-full shadow-2xl border-8 border-stone-800"
          ref={boardRef}
        >
          {/* Board Background/Decoration */}
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-stone-800 to-stone-950 opacity-50" />
          
          {/* Hex Grid */}
          <div className="absolute inset-0">
             {renderHexes()}
          </div>
        </div>

        {/* Status Messages */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-lg font-medium backdrop-blur-md z-50"
            >
              {errorMsg}
            </motion.div>
          )}
          
          {gameState.winner && (
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm rounded-3xl"
            >
              <div className="bg-stone-800 p-8 rounded-2xl shadow-2xl text-center border border-white/10">
                <h2 className="text-5xl font-bold mb-4 text-white">
                  {gameState.winner === 'black' ? 'Black' : 'White'} Wins!
                </h2>
                <button 
                  onClick={() => socket?.emit('reset')}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold transition-colors shadow-lg"
                >
                  Play Again
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-8 text-stone-500 text-sm">
        {role === 'spectator' ? "Spectating Mode" : `Playing as ${role === 'black' ? 'Black' : 'White'}`}
        <div className="mt-2 text-xs opacity-50">
          Tip: Click marbles to select (1-3). Click adjacent empty space to move, or push opponent if Sumito rules apply.
        </div>
      </footer>
    </div>
  );
}

