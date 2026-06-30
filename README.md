# Abalone Multiplayer

**Abalone Multiplayer** is a real-time two-player web implementation of the classic board game Abalone.

The project combines a React/TypeScript frontend with a Node.js/Express backend and Socket.io-based real-time synchronization. It includes a simple lobby, role assignment, interactive marble selection, move validation, and core Abalone pushing mechanics.

## Status

Playable prototype / multiplayer side project.

The game implements the core multiplayer flow and main Abalone rules, but it is not a polished production service. It is intended as a portfolio project for real-time game logic, board interaction, and Socket.io communication.

## Features

- Real-time two-player multiplayer via Socket.io
- Lobby with nickname input and ready state
- Automatic role assignment for black, white, and spectators
- Interactive hex-board UI
- Marble selection for 1–3 adjacent marbles
- Inline movement
- Broadside movement
- Sumito pushing validation
- Out-of-bounds marble loss tracking
- Win condition after pushing 6 opponent marbles off the board
- Reset flow back to lobby
- Modern dark UI

## Screenshots

<img width="542" height="745" alt="Screenshot 2026-06-30 152949" src="https://github.com/user-attachments/assets/e9921e52-dcb1-4c7d-a559-2a50a91f30e0" />

<img width="996" height="777" alt="Screenshot 2026-06-30 152606" src="https://github.com/user-attachments/assets/083adc25-9924-4dc6-885d-858311c4d14f" />

<img width="914" height="851" alt="Screenshot 2026-06-30 152659" src="https://cloud.githubusercontent.com/assets/223662369//17fbe779-2143-4ac1-addb-3772a2a6ff44.png" />


## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion
- Canvas Confetti

### Backend

- Node.js
- Express
- Socket.io
- TSX

## How to Play

The goal is to push 6 opponent marbles off the board.

- Black moves first.
- Select 1, 2, or 3 adjacent marbles in a straight line.
- Click an adjacent board cell to choose the movement direction.
- Inline moves slide marbles along their line.
- Broadside moves shift selected marbles sideways.
- Sumito pushes are allowed only with numerical superiority:
  - 2 vs 1
  - 3 vs 1
  - 3 vs 2

You cannot push with equal or fewer marbles, and broadside pushes are not allowed.

## Run Locally

```bash
npm install
npm run dev
