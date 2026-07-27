# Corkboard — Real-Time Collaborative Task Board

A full-stack Kanban-style task manager where boards update live across every
connected user via WebSockets. Built as a portfolio project to demonstrate
authentication, relational data modeling, real-time sync, and a from-scratch
drag-and-drop interface.

**Stack:** React (Vite) + Tailwind · Node/Express · Socket.io · SQLite (better-sqlite3) · JWT auth

---

## Features

- Email/password auth with hashed passwords (bcrypt) and JWT sessions
- Create boards, seeded with default To Do / In Progress / Done lists
- Add, rename, delete lists and cards
- **Live sync** — every list/card change (create, edit, delete, drag) broadcasts
  instantly to every other tab/user viewing the same board over WebSockets
- Drag-and-drop reordering and moving cards between lists, built with the
  native HTML5 drag API (no extra dependency) with optimistic UI updates
- Invite teammates to a board by email
- SQLite database — zero setup, just works out of the box

## Architecture

```
taskboard/
├── server/            Express API + Socket.io server
│   ├── db.js           SQLite schema (users, boards, members, lists, cards)
│   ├── server.js        App entry: REST routes + authenticated socket server
│   ├── middleware/auth.js
│   └── routes/          auth.js, boards.js (boards/lists/cards CRUD)
└── client/            React app (Vite)
    └── src/
        ├── AuthContext.jsx   Auth state, persisted to localStorage
        ├── api.js            Axios client with JWT interceptor
        ├── socket.js         Authenticated Socket.io client
        └── pages/, components/
```

**Real-time flow:** every REST mutation (create list, move card, etc.) writes
to SQLite, then emits a Socket.io event to a room scoped to that board
(`board:<id>`). All connected clients viewing that board receive the event and
patch their local state — no polling, no manual refresh.

**Drag-and-drop position model:** cards store a `position` (float). Dropping a
card between two others sets its position to the midpoint of its new
neighbors, so reordering never requires rewriting every row — just the one
card that moved.

## Getting started

Requires Node.js 18+.

### 1. Start the API server

```bash
cd server
cp .env.example .env      # edit JWT_SECRET if you like
npm install
npm run dev
```

The API + WebSocket server runs on `http://localhost:4000`. The SQLite
database file (`taskboard.db`) is created automatically on first run.

### 2. Start the client

In a second terminal:

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`. Register an account, create a board, and start
adding cards.

### Try the real-time sync

Open the same board in two browser tabs (or a normal + incognito window,
logged in as two different users). Drag a card or add one in one tab — it
appears instantly in the other, no refresh needed.

## What this project demonstrates

- Designing a relational schema (users ↔ boards ↔ members, lists → cards)
  with proper foreign keys and cascading deletes
- Authenticating both REST endpoints (JWT middleware) and a WebSocket
  connection (auth handshake) with the same token
- Keeping client state in sync with server-pushed events without a state
  library, using targeted reducer-style updates
- Building drag-and-drop from first principles instead of a black-box library
- Basic authorization checks (only board members can read/write a board)

## Possible extensions

- Card comments and an activity log
- Due dates with reminder notifications
- Optimistic conflict resolution for simultaneous edits
- Deploy to Render/Railway (server) + Vercel (client) for a live demo link
