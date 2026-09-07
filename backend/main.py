import os
import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import init_db, AsyncSessionLocal
from models import RoomMember, Message, User, Room
from auth import get_user_from_token
from websocket_manager import manager
from routers import auth as auth_router, rooms as rooms_router, messages as messages_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager initializing database tables."""
    await init_db()
    yield


app = FastAPI(
    title="Real-Time Chat API",
    description="FastAPI + WebSockets + SQLAlchemy 2.0 Chat Backend",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
cors_origins_str = os.getenv("CORS_ORIGINS", "*")
origins = [origin.strip() for origin in cors_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth_router.router)
app.include_router(rooms_router.router)
app.include_router(messages_router.router)


@app.get("/")
async def root():
    return {"message": "Real-Time Chat Application API is running"}


@app.websocket("/api/ws/{room_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    token: str = Query(...)
):
    """WebSocket endpoint handling real-time chat, typing events, and member notifications."""
    room_uuid = None
    try:
        room_uuid = uuid.UUID(room_id)
    except ValueError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid room ID format")
        return

    # Authenticate token and load user
    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired authentication token")
            return

        # Check user is a member of the room
        membership = await db.execute(
            select(RoomMember).where(
                RoomMember.room_id == room_uuid,
                RoomMember.user_id == user.id
            )
        )
        if not membership.scalar_one_or_none():
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User is not a member of this room")
            return

        user_id_str = str(user.id)
        username = user.username

        # Connect client to WebSocket manager
        await manager.connect(websocket, room_id, user_id_str)

        try:
            # Broadcast join notification to room
            online_users = manager.get_online_users(room_id)
            await manager.broadcast_to_room({
                "type": "user_joined",
                "username": username,
                "user_id": user_id_str,
                "online_users": online_users
            }, room_id)

            # Fetch last 20 messages for history on connect
            history_query = (
                select(Message, User.username)
                .join(User, Message.user_id == User.id)
                .where(Message.room_id == room_uuid)
                .order_by(Message.created_at.desc())
                .limit(20)
            )
            history_result = await db.execute(history_query)
            history_rows = history_result.all()

            history_payload = [
                {
                    "id": str(msg.id),
                    "room_id": str(msg.room_id),
                    "user_id": str(msg.user_id),
                    "username": msg_uname,
                    "content": msg.content,
                    "created_at": msg.created_at.isoformat() if msg.created_at else datetime.now(timezone.utc).isoformat()
                }
                for msg, msg_uname in reversed(history_rows)
            ]

            # Send history payload directly to connected client
            await manager.send_personal_message({
                "type": "history",
                "messages": history_payload,
                "online_users": online_users
            }, websocket)

            # Listen for incoming WebSocket messages
            while True:
                data_str = await websocket.receive_text()
                try:
                    data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type", "message")

                if msg_type == "message":
                    content = data.get("content", "").strip()
                    if not content:
                        continue

                    # Save message to database
                    now_utc = datetime.now(timezone.utc)
                    new_msg = Message(
                        room_id=room_uuid,
                        user_id=user.id,
                        content=content,
                        created_at=now_utc
                    )
                    db.add(new_msg)
                    await db.commit()
                    await db.refresh(new_msg)

                    # Broadcast message payload
                    payload = {
                        "type": "message",
                        "id": str(new_msg.id),
                        "username": username,
                        "content": content,
                        "timestamp": now_utc.isoformat(),
                        "user_id": user_id_str
                    }
                    await manager.broadcast_to_room(payload, room_id)

                elif msg_type == "typing":
                    # Broadcast typing indicator
                    await manager.broadcast_to_room({
                        "type": "typing",
                        "username": username,
                        "user_id": user_id_str
                    }, room_id)

        except WebSocketDisconnect:
            pass
        except Exception as e:
            # Prevent unhandled exception from crashing the server
            pass
        finally:
            # Disconnect and broadcast leave notification
            manager.disconnect(websocket, room_id)
            online_users = manager.get_online_users(room_id)
            await manager.broadcast_to_room({
                "type": "user_left",
                "username": username,
                "user_id": user_id_str,
                "online_users": online_users
            }, room_id)
