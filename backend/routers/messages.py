import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Message, Room, RoomMember, User
from schemas import MessageOut
from auth import get_current_user

router = APIRouter(prefix="/api/rooms", tags=["Messages"])


@router.get("/{room_id}/messages", response_model=List[MessageOut])
async def get_room_messages(
    room_id: uuid.UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves paginated message history for a room."""
    # Check if room exists
    room_result = await db.execute(select(Room).where(Room.id == room_id))
    if not room_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    # Check user is a member of the room
    membership = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == current_user.id
        )
    )
    if not membership.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a member of this room"
        )

    # Fetch messages joined with user username, ordered latest first for offset pagination
    query = (
        select(Message, User.username)
        .join(User, Message.user_id == User.id)
        .where(Message.room_id == room_id)
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    # Convert to MessageOut objects and reverse so history is chronological (oldest -> newest)
    messages = [
        MessageOut(
            id=msg.id,
            room_id=msg.room_id,
            user_id=msg.user_id,
            username=uname,
            content=msg.content,
            created_at=msg.created_at
        )
        for msg, uname in rows
    ]
    messages.reverse()
    return messages
