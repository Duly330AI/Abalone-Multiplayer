# Abalone Online 🔴⚪

A real-time, 2-player online multiplayer implementation of the classic board game **Abalone**. Built using a full-stack architecture with React, Tailwind CSS, Node.js, Express, and Socket.io.

---

## 🎮 Features

- **Real-Time Multiplayer:** Instant moves synchronized over WebSockets (Socket.io).
- **Interactive Game Lobby:**
  - Set custom nicknames.
  - Ready-up system (the game begins only when both players click "Ready").
  - Automated assignment of player roles (Black, White, or Spectator).
- **Rule Enforcement Engine:**
  - **Marble Selection:** Selection of 1, 2, or 3 adjacent marbles in a straight line.
  - **Inline Moves:** Forward or backward movement along the line axis.
  - **Broadside Moves:** Sideways parallel shifting of selected marbles.
  - **Sumito (Pushing Mechanics):** Full validation of numerical superiority pushing (3 vs 1, 3 vs 2, or 2 vs 1 opponent marbles). Prevent pushes if paths are blocked or if numbers are equal.
  - **Out-of-Bounds Detection:** Marbles pushed off the hexagonal board are counted as lost.
- **Modern Responsive UI:**
  - Clean hexagonal board rendered using fluid SVG/HTML coordinate positioning.
  - Micro-animations for marble selections and movements using Framer Motion.
  - Victory celebratory confetti.
  - Reset functionality to head back to the lobby anytime.

---

## 🕹️ How to Play

### Objective
The first player to push **6 of the opponent's marbles** off the hexagonal board wins the game. **Black** always makes the first move.

### 1. Marble Selection
- Click on any of your own marbles to select it.
- To select a line of 2 or 3 marbles, click on adjacent marbles that form a straight line.

### 2. Making a Move
Once selected, click on any immediately adjacent cell to define your movement direction:
- **Inline Move:** If you move along the same straight line, your marbles slide forward or backward.
- **Broadside Move:** If you move sideways, all selected marbles shift parallel into empty adjacent slots.

### 3. Pushing Opponent Marbles (Sumito)
You can push opponent marbles inline if you have a numerical advantage and there is an empty space (or the edge of the board) behind them:
- **3 of your marbles** can push **1 or 2 opponent marbles**.
- **2 of your marbles** can push **1 opponent marble**.
- You *cannot* push marbles if the numbers are equal (e.g., 3 vs 3, 2 vs 2, or 1 vs 1) or if you are outnumbered.
- You *cannot* push opponent marbles during broadside (sideways) moves.

---

## 🛠️ Tech Stack

- **Frontend:**
  - React (TypeScript)
  - Vite (Build Tool & Dev Server)
  - Tailwind CSS (Styling)
  - Framer Motion (Animations)
  - Canvas Confetti (Win Celebrations)
- **Backend:**
  - Node.js (Express)
  - Socket.io (Real-time WebSocket communication)
  - TSX (TypeScript execution engine for Node)

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repository-url>
   cd <your-repository-folder>
Install the dependencies:
code
Bash
npm install
Running the Application
Start Development Server (Full-Stack):
Runs the Node.js Express server integrated with Vite middleware.
code
Bash
npm run dev
Open http://localhost:3000 in your browser.
Build for Production:
Builds the React client assets into the static dist/ directory.
code
Bash
npm run build
Start Production Server:
Runs the compiled backend in production mode serving the static files.
code
Bash
npm run start
🧪 Testing Multiplayer Locally
To test the real-time two-player flow on your machine:
Open http://localhost:3000 in a standard browser tab (Player 1).
Open http://localhost:3000 in an Incognito Window or a different browser (Player 2).
Set your nicknames in both tabs, click Ready on both, and play!
code
Code
