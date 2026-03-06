import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- Game Logic Constants & Types ---

type PlayerColor = 'black' | 'white';
type CellContent = PlayerColor | null;
// Axial coordinates q, r. s is implied (-q-r)
type Coord = { q: number; r: number };
type BoardState = Record<string, PlayerColor>; // key is "q,r"

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

const BOARD_RADIUS = 4; // 5 hexes per side means radius 4 (center is 0)

// Initial Setup (Standard Abalone)
function getInitialBoard(): BoardState {
  const board: BoardState = {};
  
  // Helper to add marble
  const add = (q: number, r: number, color: PlayerColor) => {
    board[`${q},${r}`] = color;
  };

  // Standard Setup
  // White (bottom)
  // Row 0 (bottom-most, 5 marbles): r=4, q=0..4 ? No, let's define coordinate system carefully.
  // Using flat-topped hexes or pointy-topped? Abalone is usually pointy-topped visually, 
  // but let's stick to standard axial.
  
  // Let's use the standard layout where:
  // Black is at the "top" (negative r usually)
  // White is at the "bottom" (positive r usually)
  
  // Rows for White:
  // 5 marbles at r=4, q=-4..0
  // 6 marbles at r=3, q=-4..1
  // 3 marbles at r=2, q=-2..0
  
  // Rows for Black:
  // 5 marbles at r=-4, q=0..4
  // 6 marbles at r=-3, q=-1..4
  // 3 marbles at r=-2, q=0..2
  
  // Wait, let's verify the grid.
  // Radius 4. 
  // r goes from -4 to 4.
  // for a given r, q goes from max(-4, -4-r) to min(4, 4-r)
  
  // White Positions:
  // Row r=4 (5 cells): q=-4,-3,-2,-1,0. All White.
  for (let q = -4; q <= 0; q++) add(q, 4, 'white');
  
  // Row r=3 (6 cells): q=-4,-3,-2,-1,0,1. All White.
  for (let q = -4; q <= 1; q++) add(q, 3, 'white');
  
  // Row r=2 (7 cells): q=-4..2. Center 3 are White (q=-2,-1,0).
  add(-2, 2, 'white');
  add(-1, 2, 'white');
  add(0, 2, 'white');

  // Black Positions:
  // Row r=-4 (5 cells): q=0,1,2,3,4. All Black.
  for (let q = 0; q <= 4; q++) add(q, -4, 'black');
  
  // Row r=-3 (6 cells): q=-1,0,1,2,3,4. All Black.
  for (let q = -1; q <= 4; q++) add(q, -3, 'black');
  
  // Row r=-2 (7 cells): q=-2..4. Center 3 are Black (q=0,1,2).
  add(0, -2, 'black');
  add(1, -2, 'black');
  add(2, -2, 'black');

  return board;
}

// --- Server Setup ---

async function startServer() {
  const app = express();
  
  // Log all requests to check if they reach Express
  app.use((req, res, next) => {
    if (req.url.startsWith('/socket.io/')) {
      console.log(`[Express] Socket request reached Express (should be handled by io): ${req.method} ${req.url}`);
    }
    next();
  });

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    path: '/socket.io/',
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['polling', 'websocket']
  });
  const PORT = 3000;

  // Game State
  let gameState: GameState = {
    board: getInitialBoard(),
    currentPlayer: 'black', // Black starts
    blackLost: 0,
    whiteLost: 0,
    winner: null,
    status: 'lobby',
    players: { black: null, white: null }
  };

  io.use((socket, next) => {
    console.log(`Socket handshake attempt: ${socket.id} (transport: ${socket.conn.transport.name})`);
    next();
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Assign player role
    let myRole: PlayerColor | 'spectator' = 'spectator';
    if (!gameState.players.black) {
      gameState.players.black = { id: socket.id, nickname: 'Black', ready: false };
      myRole = 'black';
    } else if (!gameState.players.white) {
      gameState.players.white = { id: socket.id, nickname: 'White', ready: false };
      myRole = 'white';
    }

    socket.emit("init", { gameState, role: myRole });
    io.emit("playerUpdate", gameState.players);

    socket.on("setNickname", (nickname: string) => {
      if (gameState.players.black?.id === socket.id) gameState.players.black.nickname = nickname;
      else if (gameState.players.white?.id === socket.id) gameState.players.white.nickname = nickname;
      io.emit("gameStateUpdate", gameState);
    });

    socket.on("setReady", (ready: boolean) => {
      if (gameState.players.black?.id === socket.id) gameState.players.black.ready = ready;
      else if (gameState.players.white?.id === socket.id) gameState.players.white.ready = ready;
      
      // Check if both are ready to start
      if (gameState.players.black?.ready && gameState.players.white?.ready) {
        gameState.status = 'playing';
      }
      io.emit("gameStateUpdate", gameState);
    });

    socket.on("move", (moveData: { selected: string[], direction: Coord }) => {
      // Validate turn
      if (gameState.winner) return;
      if (myRole === 'spectator') return;
      if (myRole !== gameState.currentPlayer) return;

      const { selected, direction } = moveData;
      
      // Validate and Apply Move
      const result = processMove(gameState, selected, direction, myRole);
      
      if (result.valid) {
        gameState = result.newState;
        io.emit("gameStateUpdate", gameState);
      } else {
        socket.emit("moveError", result.reason);
      }
    });

    socket.on("reset", () => {
      gameState = {
        board: getInitialBoard(),
        currentPlayer: 'black',
        blackLost: 0,
        whiteLost: 0,
        winner: null,
        players: gameState.players
      };
      io.emit("gameStateUpdate", gameState);
    });

    socket.on("disconnect", () => {
      if (gameState.players.black?.id === socket.id) gameState.players.black = null;
      if (gameState.players.white?.id === socket.id) gameState.players.white = null;
      io.emit("playerUpdate", gameState.players);
    });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// --- Game Logic Helpers ---

function coord(key: string): Coord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

function key(q: number, r: number): string {
  return `${q},${r}`;
}

function addCoords(a: Coord, b: Coord): Coord {
  return { q: a.q + b.q, r: a.r + b.r };
}

function getCell(board: BoardState, q: number, r: number): PlayerColor | null {
  return board[key(q, r)] || null;
}

function isValidHex(q: number, r: number): boolean {
  const s = -q - r;
  return Math.abs(q) <= BOARD_RADIUS && Math.abs(r) <= BOARD_RADIUS && Math.abs(s) <= BOARD_RADIUS;
}

// Logic to process move
function processMove(currentState: GameState, selectedKeys: string[], dir: Coord, player: PlayerColor): { valid: boolean; newState: GameState; reason?: string } {
  const board = { ...currentState.board };
  const selectedCoords = selectedKeys.map(coord);
  
  // 1. Basic Validation
  if (selectedCoords.length === 0 || selectedCoords.length > 3) {
    return { valid: false, newState: currentState, reason: "Invalid selection size (1-3 marbles allowed)." };
  }

  // Check ownership
  for (const k of selectedKeys) {
    if (board[k] !== player) return { valid: false, newState: currentState, reason: "Not your marbles." };
  }

  // Check linearity and adjacency
  if (selectedCoords.length > 1) {
    // Sort to ensure line check works
    // A line is defined by constant q, constant r, or constant s
    const qs = new Set(selectedCoords.map(c => c.q));
    const rs = new Set(selectedCoords.map(c => c.r));
    const ss = new Set(selectedCoords.map(c => -c.q - c.r));
    
    const isLine = qs.size === 1 || rs.size === 1 || ss.size === 1;
    if (!isLine) return { valid: false, newState: currentState, reason: "Selection is not a straight line." };

    // Check adjacency (no gaps)
    // We can check this by sorting along the changing axis and checking distance is 1
    // ... Simplified check for 2 or 3 items:
    if (selectedCoords.length === 2) {
      const dist = Math.max(
        Math.abs(selectedCoords[0].q - selectedCoords[1].q),
        Math.abs(selectedCoords[0].r - selectedCoords[1].r),
        Math.abs((-selectedCoords[0].q - selectedCoords[0].r) - (-selectedCoords[1].q - selectedCoords[1].r))
      );
      if (dist !== 1) return { valid: false, newState: currentState, reason: "Marbles not adjacent." };
    } else if (selectedCoords.length === 3) {
      // Sort and check dist between 0-1 and 1-2
      // This is slightly complex to sort generically, but we can just check if the set forms a connected component of size 3
      // Actually, for 3 items in a line on a hex grid, the max distance between any two is 2.
      // Let's use a robust sort.
      let sorted = [...selectedCoords];
      if (qs.size === 1) sorted.sort((a, b) => a.r - b.r);
      else if (rs.size === 1) sorted.sort((a, b) => a.q - b.q);
      else sorted.sort((a, b) => a.q - b.q); // s is constant, so q varies

      const d1 = Math.max(Math.abs(sorted[0].q - sorted[1].q), Math.abs(sorted[0].r - sorted[1].r));
      const d2 = Math.max(Math.abs(sorted[1].q - sorted[2].q), Math.abs(sorted[1].r - sorted[2].r));
      if (d1 !== 1 || d2 !== 1) return { valid: false, newState: currentState, reason: "Gaps in selection." };
    }
  }

  // 2. Determine Move Type: Broadside or Inline
  // Inline if the direction is parallel to the line of marbles.
  // Broadside if direction is not parallel.
  // Single marble is always "Inline" effectively (pushes front).
  
  let isInline = true;
  if (selectedCoords.length > 1) {
    const dLine = {
      q: selectedCoords[1].q - selectedCoords[0].q,
      r: selectedCoords[1].r - selectedCoords[0].r
    };
    // Normalize dLine to unit step (-1, 0, 1)
    // Since they are adjacent, dLine is already a valid direction vector or multiple (if not sorted)
    // Actually, we just need to check if 'dir' is parallel to the line.
    // Two vectors (dq1, dr1) and (dq2, dr2) are parallel if cross product is 0? 
    // Or just check if dir equals +/- unit vector of line.
    
    // Let's find the line axis unit vector
    let axis: Coord;
    if (selectedCoords[0].q === selectedCoords[1].q) axis = { q: 0, r: 1 }; // Vertical
    else if (selectedCoords[0].r === selectedCoords[1].r) axis = { q: 1, r: 0 }; // Horizontal
    else axis = { q: 1, r: -1 }; // Diagonal
    
    // Check if dir is parallel to axis
    // dir is one of the 6 unit vectors.
    // Parallel if dir.q == axis.q && dir.r == axis.r OR dir.q == -axis.q ...
    // Note: {q:0, r:1} is parallel to {q:0, r:-1}
    
    const isParallel = (dir.q * axis.r === dir.r * axis.q); // Cross product 0 in 2D axial?
    // q1*r2 - q2*r1. 
    // Example: axis(0,1), dir(0,1) -> 0*1 - 0*1 = 0. Parallel.
    // Example: axis(0,1), dir(1,0) -> 0*0 - 1*1 = -1. Not parallel.
    // Example: axis(1,-1), dir(-1,1) -> 1*1 - (-1)*(-1) = 1 - 1 = 0. Parallel.
    
    isInline = isParallel;
  }

  // 3. Validate Broadside
  if (!isInline) {
    // For broadside, all target cells must be empty.
    for (const c of selectedCoords) {
      const target = addCoords(c, dir);
      if (!isValidHex(target.q, target.r)) return { valid: false, newState: currentState, reason: "Cannot move off board broadside." };
      if (board[key(target.q, target.r)]) return { valid: false, newState: currentState, reason: "Blocked broadside move." };
    }
    
    // Execute Broadside
    const newBoard = { ...board };
    selectedKeys.forEach(k => delete newBoard[k]);
    selectedCoords.forEach(c => {
      const target = addCoords(c, dir);
      newBoard[key(target.q, target.r)] = player;
    });
    
    return {
      valid: true,
      newState: {
        ...currentState,
        board: newBoard,
        currentPlayer: player === 'black' ? 'white' : 'black'
      }
    };
  }

  // 4. Validate Inline (and Sumito)
  // Sort marbles in direction of movement to find the "head"
  // We need to project coordinates onto the direction vector to sort them.
  // Dot product? 
  // For axial, a simple way is to just find the one that is "furthest" in the direction `dir`.
  // The "head" is the marble that is moving into a non-selected space.
  // The "tail" is the marble leaving an empty space behind.
  
  // Let's identify the "Leading" marble.
  // It's the one where coord + dir is NOT in the selection.
  const head = selectedCoords.find(c => !selectedKeys.includes(key(c.q + dir.q, c.r + dir.r)));
  if (!head) return { valid: false, newState: currentState, reason: "Logic Error: Could not find head of line." }; // Should not happen for valid line
  
  // Now trace from head + dir
  let current = addCoords(head, dir);
  let pushedPieces: Coord[] = [];
  
  // Check what's in front
  while (true) {
    // If off board
    if (!isValidHex(current.q, current.r)) {
      // If we are pushing opponent pieces, they fall off.
      // If we are just moving our own into void, that's suicide? 
      // Abalone rules: You cannot move your own marble off the board. You can only push opponent off.
      if (pushedPieces.length === 0) {
         return { valid: false, newState: currentState, reason: "Cannot move yourself off board." };
      } else {
         // Pushing opponent off board!
         break; // Valid push off board
      }
    }
    
    const content = board[key(current.q, current.r)];
    
    if (!content) {
      // Empty space found. Move is valid.
      break;
    } else if (content === player) {
      // Blocked by own piece
      return { valid: false, newState: currentState, reason: "Blocked by own piece." };
    } else {
      // Opponent piece
      pushedPieces.push(current);
      current = addCoords(current, dir);
    }
  }
  
  // Sumito Logic
  if (pushedPieces.length > 0) {
    // Rule: You must have strictly more pieces than the opponent.
    if (selectedCoords.length <= pushedPieces.length) {
      return { valid: false, newState: currentState, reason: "Insufficient force for Sumito (need superior numbers)." };
    }
    // Rule: Cannot push more than 3 opponent pieces?
    // Actually, standard rules say you can push up to 2 if you have 3? 
    // PDF says: "Eine Bewegung kann 1, 2 oder 3 Kugeln umfassen." (Your own)
    // "Sie können die Kugeln Ihres Gegners wegschieben, wenn Sie zuerst eine Sumito-Position aufbauen... Anzahl Ihrer Kugeln höher ist als die Ihres Gegners."
    // Examples: 3 vs 1, 3 vs 2, 2 vs 1.
    // It implies you cannot push 3. Because max you have is 3. So 3 vs 3 is Patt.
    // So max opponent pieces you can push is 2.
    // Wait, if I have 3, and opponent has 3, it's Patt.
    // So I can only push 1 or 2 opponent marbles.
    // If opponent has 3, I cannot push them (need 4, but max move is 3).
    
    if (pushedPieces.length >= 3) {
       return { valid: false, newState: currentState, reason: "Cannot push 3 or more opponent marbles." };
    }
  }
  
  // Execute Inline Move
  const newBoard = { ...board };
  let blackLost = currentState.blackLost;
  let whiteLost = currentState.whiteLost;
  let winner = currentState.winner;

  // 1. Remove the "tail" of the moving group from its old position
  // The tail is the one that moves into a space that was occupied by another selected piece.
  // Actually, easiest way: Remove all selected from old, add all selected to new.
  // AND handle pushed pieces.
  
  // Remove selected pieces
  selectedKeys.forEach(k => delete newBoard[k]);
  
  // Place selected pieces at new positions
  selectedCoords.forEach(c => {
    const target = addCoords(c, dir);
    newBoard[key(target.q, target.r)] = player;
  });
  
  // Handle pushed pieces
  // We need to shift them one step in 'dir'.
  // We must process them from furthest to closest to avoid overwriting?
  // Actually, we just need to move them.
  // The furthest one might fall off board.
  
  // Pushed pieces are in order [closest, ..., furthest]
  // We should move furthest first.
  for (let i = pushedPieces.length - 1; i >= 0; i--) {
    const p = pushedPieces[i];
    const target = addCoords(p, dir);
    
    // Remove from old (it might have been overwritten by the piece behind it in the loop, but here we are using the 'original' positions in pushedPieces list)
    // Wait, we need to be careful.
    // In the `newBoard`, the space `p` is now occupied by the piece that pushed it (either our head, or the previous opponent piece).
    // So we don't need to "delete" p from newBoard, we just need to set `target`.
    // BUT, if we iterate backwards:
    // Furthest piece P_last moves to P_last + dir.
    // P_last-1 moves to P_last.
    
    // Let's just re-construct the pushed chain.
    // The space occupied by the first pushed piece (closest to us) is now occupied by our 'head'.
    // So we just need to put the opponent pieces in the subsequent slots.
    
    if (!isValidHex(target.q, target.r)) {
      // Piece dies
      if (player === 'black') whiteLost++; // Black pushed White
      else blackLost++;
    } else {
      newBoard[key(target.q, target.r)] = (player === 'black' ? 'white' : 'black');
    }
  }
  
  // Check Win Condition
  if (blackLost >= 6) winner = 'white';
  if (whiteLost >= 6) winner = 'black';

  return {
    valid: true,
    newState: {
      ...currentState,
      board: newBoard,
      blackLost,
      whiteLost,
      winner,
      currentPlayer: player === 'black' ? 'white' : 'black'
    }
  };
}

startServer();
