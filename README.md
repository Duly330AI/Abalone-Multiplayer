# Abalone Multiplayer

**Abalone Multiplayer** is a real-time two-player web prototype based on the classic Abalone board game concept.

The project focuses on multiplayer game flow, board-state synchronization, move validation, and a playable browser-based hex-board UI.

## Status

**Playable prototype / multiplayer side project**

The game is intended as a portfolio side project and technical prototype. It is not a production game service and does not include full account systems, matchmaking, ranking, anti-cheat, or persistent online infrastructure.

## Features

* Real-time two-player gameplay via Socket.io
* Lobby with nickname input and ready state
* Automatic player role assignment for black and white
* Spectator role for additional connections
* Interactive hex-board UI
* Marble selection for 1-3 adjacent marbles
* Inline movement
* Broadside movement
* Sumito-style pushing validation
* Out-of-bounds marble loss tracking
* Win condition after pushing 6 opponent marbles off the board
* Reset flow back to the lobby
* Frontend/backend split

## Screenshots

<img width="542" height="745" alt="Screenshot 2026-06-30 152949" src="https://github.com/user-attachments/assets/e9921e52-dcb1-4c7d-a559-2a50a91f30e0" />

<img width="996" height="777" alt="Screenshot 2026-06-30 152606" src="https://github.com/user-attachments/assets/083adc25-9924-4dc6-885d-858311c4d14f" />

<img width="914" height="851" alt="Screenshot 2026-06-30 152659" src="https://github.com/user-attachments/assets/ffc3d103-6a15-4240-820f-c8bdbc1647e3" />

## Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Framer Motion
* Canvas Confetti

### Backend

* Node.js
* Express
* Socket.io
* TSX

## How to Play

The goal is to push 6 opponent marbles off the board.

* Black moves first.
* Select 1, 2, or 3 adjacent marbles in a straight line.
* Click an adjacent board cell to choose the movement direction.
* Inline moves slide marbles along their line.
* Broadside moves shift selected marbles sideways.
* Sumito pushes are allowed only with numerical superiority:
  * 2 vs 1
  * 3 vs 1
  * 3 vs 2

You cannot push with equal or fewer marbles, and broadside pushes are not allowed.

## Getting Started

### Prerequisites

* Node.js
* npm

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

The dev script starts the Node/Express server with Socket.io and serves the Vite-powered frontend.

### Build

```bash
npm run build
```

## Notes

This is a portfolio prototype for exploring real-time board-game logic, move validation, and multiplayer synchronization.

This project is an unofficial portfolio/learning implementation and is not affiliated with the official Abalone brand or rights holders.

## License

MIT License. See [LICENSE](LICENSE).
