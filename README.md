# Real-Time Chat Application

A full-stack, production-grade Real-Time Chat Application built with **FastAPI**, **WebSockets**, **SQLAlchemy 2.0 ORM** (async), **Supabase PostgreSQL**, **React**, and **Tailwind CSS**.

---

## Features

- **User Authentication**: Secure Registration & Login with bcrypt password hashing and 24-hour JWT tokens.
- **Chat Rooms**: Create custom rooms, list rooms with member counts, search/filter rooms, and auto-join room creators.
- **Real-Time WebSockets**: Send and receive instant messages across room members with low latency.
- **Persistent Message History**: Messages are safely stored in PostgreSQL and loaded upon joining a room (with pagination support).
- **Live User Presence**: Track online members in active rooms with real-time status indicators.
- **Typing Indicators**: Live visual notifications when other room members are typing.
- **Modern Dark Mode UI**: Vibrant Tailwind CSS styling, avatar initials, relative timestamps ("X minutes ago"), and responsive sidebar navigation.

---

## Tech Stack

- **Backend**: Python 3, FastAPI, WebSockets, Pydantic V2, python-jose, bcrypt.
- **Database**: PostgreSQL (Supabase / Railway) with SQLAlchemy 2.0 Async ORM & `asyncpg` (falls back to `aiosqlite` for local dev).
- **Frontend**: React (Vite), Tailwind CSS v4, Lucide Icons.
- **Deployment**: Railway (Backend) & Vercel (Frontend).

---

## Database Schema (4 Tables)

1. **`users`**:
   - `id`: UUID Primary Key
   - `username`: VARCHAR(50) Unique, Not Null
   - `email`: VARCHAR(255) Unique, Not Null
   - `password_hash`: VARCHAR(255) Not Null
   - `created_at`: TIMESTAMP Default NOW()

2. **`rooms`**:
   - `id`: UUID Primary Key
   - `name`: VARCHAR(100) Unique, Not Null
   - `description`: VARCHAR(500) Nullable
   - `created_by`: UUID Foreign Key → `users.id`
   - `created_at`: TIMESTAMP Default NOW()

3. **`room_members`**:
   - `id`: UUID Primary Key
   - `room_id`: UUID Foreign Key → `rooms.id` (ON DELETE CASCADE)
   - `user_id`: UUID Foreign Key → `users.id` (ON DELETE CASCADE)
   - `joined_at`: TIMESTAMP Default NOW()
   - *Constraint*: UNIQUE (`room_id`, `user_id`)

4. **`messages`**:
   - `id`: UUID Primary Key
   - `room_id`: UUID Foreign Key → `rooms.id` (ON DELETE CASCADE)
   - `user_id`: UUID Foreign Key → `users.id` (ON DELETE CASCADE)
   - `content`: TEXT Not Null
   - `created_at`: TIMESTAMP Default NOW()

---

## Project Structure

```
.
├── backend/
│   ├── main.py                  # FastAPI application & WebSocket endpoint
│   ├── database.py              # Async SQLAlchemy engine & session factory
│   ├── models.py                # Database ORM models (users, rooms, room_members, messages)
│   ├── schemas.py               # Pydantic V2 schemas for REST & WS
│   ├── auth.py                  # JWT encoding/decoding & bcrypt security
│   ├── websocket_manager.py     # ConnectionManager for multi-room broadcasting
│   ├── routers/
│   │   ├── auth.py              # Auth endpoints (/register, /login)
│   │   ├── rooms.py             # Room management endpoints
│   │   └── messages.py          # Message history endpoints
│   ├── requirements.txt
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Main routing & auth state wrapper
│   │   ├── api.js               # Fetch REST API client
│   │   ├── pages/
│   │   │   ├── Login.jsx        # Login page
│   │   │   ├── Register.jsx     # Registration page
│   │   │   └── Chat.jsx         # Chat layout page
│   │   ├── components/
│   │   │   ├── RoomList.jsx     # Rooms sidebar & creation modal
│   │   │   ├── ChatWindow.jsx   # Message stream & room header
│   │   │   ├── MessageInput.jsx # Input field with typing triggers
│   │   │   └── OnlineUsers.jsx  # Active room members sidebar
│   │   └── hooks/
│   │       └── useWebSocket.js  # Custom WebSocket hook with auto-reconnect
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── railway.json                 # Railway backend deployment configuration
├── Procfile                     # Heroku/Railway deployment process file
├── .env.example
└── README.md
```

---

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file from .env.example
cp .env.example .env

# Run backend development server
uvicorn main:app --reload --port 8000
```

Backend will start at: `http://localhost:8000` (API Docs at `http://localhost:8000/docs`).

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install packages
npm install

# Start Vite development server
npm run dev
```

Frontend will start at: `http://localhost:3000`.

---

## Deployment Guide

### Deploying Backend to Railway

1. Connect your GitHub repository to **Railway**.
2. Set Environment Variables in Railway:
   - `DATABASE_URL`: `postgresql+asyncpg://...` (Your Supabase / Railway PostgreSQL connection string)
   - `SECRET_KEY`: Long random secret string
   - `ALGORITHM`: `HS256`
   - `CORS_ORIGINS`: `https://your-frontend-domain.vercel.app`
3. Railway automatically uses `railway.json` or `Procfile` to run:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

### Deploying Frontend to Vercel

1. Import your repository into **Vercel**.
2. Set Build Settings:
   - Framework Preset: **Vite**
   - Root Directory: `frontend`
3. Add Environment Variable:
   - `VITE_API_URL`: `https://your-railway-backend.up.railway.app`
4. Deploy!
