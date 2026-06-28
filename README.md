# Collabit — Real-time Collaborative Document Editor

A full-featured collaborative document editor with real-time sync, presence indicators, and offline support.

## Architecture

```
collab-editor/
├── backend/          # Node.js + Express + WebSocket server
│   └── src/
│       ├── index.js              # Entry point
│       ├── middleware/auth.js    # JWT verification
│       ├── routes/documents.js  # REST API
│       └── websocket/wsServer.js # Yjs WebSocket sync
├── frontend/         # Next.js 14 App Router
│   ├── app/
│   │   ├── auth/        # Login/signup
│   │   ├── dashboard/   # Document list
│   │   └── editor/[id]/ # Editor page
│   ├── components/
│   │   ├── CollabEditor.js   # Tiptap + Yjs
│   │   ├── PresenceBar.js    # Who's editing
│   │   └── Toolbar.js        # Formatting toolbar
│   ├── hooks/
│   │   ├── useAuth.js           # Auth context
│   │   ├── useCollaboration.js  # Yjs + WebSocket
│   │   └── useOfflineSync.js    # Online/offline
│   └── lib/
│       ├── api.js               # API client
│       └── supabase/            # Supabase clients
└── supabase-schema.sql  # Database setup
```

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Backend | Node.js + Express |
| Real-time | Custom WebSocket server (ws) |
| CRDT | Yjs + y-websocket |
| Rich text | Tiptap |
| Auth + DB | Supabase |

## Features

### Core ✅
- Email/password auth via Supabase
- Create, open, delete documents
- Rich text editing (bold, italic, headings, lists, etc.)
- Changes persist across refreshes

### Real-time Sync ✅
- Multiple users editing simultaneously
- Changes broadcast instantly via WebSocket
- **Conflict resolution via Yjs CRDT** — no last-write-wins, all edits merge correctly
- Presence: see avatars of active users
- Named cursors with color indicators

### Polish ✅
- Cursor positions tracked per user
- **Offline support** — Yjs buffers changes locally, syncs on reconnect
- **Undo/redo** (Ctrl+Z / Ctrl+Y) — Yjs-aware, collaborative-safe
- Document history snapshots
- Document sharing via email
- Copy-to-clipboard link sharing
- Title auto-save

## Conflict Resolution Strategy

This editor uses **Yjs CRDTs (Conflict-free Replicated Data Types)** — the same approach used by tools like Notion, Linear, and Figma:

- Every edit is represented as an immutable **operation** (insert/delete at position)
- Operations have a **logical timestamp** (Lamport clock) tied to the client
- When two users edit concurrently, **both operations are preserved** and merged deterministically
- The final document is the same on all clients regardless of operation order
- This means **no merge conflicts, no data loss, no overwriting** — even during network partitions

The server stores a **binary Yjs state vector** in Supabase, not just plain text, enabling efficient delta sync when clients reconnect.

## Setup

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` secret key
   - JWT secret (Settings → API → JWT Settings)

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in your Supabase credentials in .env
npm install
npm run dev    # runs on http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local
npm install
npm run dev    # runs on http://localhost:3000
```

### Environment Variables

**Backend `.env`:**
```
PORT=4000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FRONTEND_URL=http://localhost:3000
```

**Frontend `.env.local`:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Deployment

### Backend (Railway / Render / Fly.io)
```bash
cd backend
npm start
```
Set the env vars on your platform. Update `FRONTEND_URL` to your production frontend URL.

### Frontend (Vercel)
```bash
cd frontend
npm run build
```
Add env vars in Vercel dashboard. Update `NEXT_PUBLIC_WS_URL` and `NEXT_PUBLIC_API_URL` to your deployed backend URLs.

> **Important:** WebSocket URLs use `ws://` for local and `wss://` for production (HTTPS).

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server health check |
| GET | `/api/documents` | List user's documents |
| POST | `/api/documents` | Create document |
| GET | `/api/documents/:id` | Get document |
| PATCH | `/api/documents/:id` | Update title |
| DELETE | `/api/documents/:id` | Delete document |
| POST | `/api/documents/:id/share` | Share with email |
| GET | `/api/documents/:id/history` | Get snapshots |

WebSocket: `ws://host?docId=<id>&token=<jwt>`
