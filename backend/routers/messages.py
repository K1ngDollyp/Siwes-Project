import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, aliased

from database import get_db
from models import Message, Room, RoomMember, User
from schemas import MessageOut, ReplyToPreview
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
    """Retrieves paginated message history for a room including reply quotes."""
    room_result = await db.execute(select(Room).where(Room.id == room_id))
    if not room_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

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

    # Aliases for joining parent message and parent author
    ParentMsg = aliased(Message)
    ParentUser = aliased(User)

    query = (
        select(
            Message,
            User.username,
            ParentMsg.id.label("parent_id"),
            ParentMsg.content.label("parent_content"),
            ParentUser.username.label("parent_username")
        )
        .join(User, Message.user_id == User.id)
        .outerjoin(ParentMsg, Message.reply_to_id == ParentMsg.id)
        .outerjoin(ParentUser, ParentMsg.user_id == ParentUser.id)
        .where(Message.room_id == room_id)
        .order_by(Message.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()

    messages = []
    for msg, uname, parent_id, parent_content, parent_username in rows:
        reply_to_obj = None
        if parent_id and parent_username and parent_content:
            reply_to_obj = ReplyToPreview(
                id=parent_id,
                username=parent_username,
                content=parent_content
            )

        # Ensure ISO UTC string format
        created_at_utc = msg.created_at

        m_out = MessageOut(
            id=msg.id,
            room_id=msg.room_id,
            user_id=msg.user_id,
            username=uname,
            content=msg.content,
            reply_to_id=msg.reply_to_id,
            reply_to=reply_to_obj,
            created_at=created_at_utc
        )
        messages.append(m_out)

    messages.reverse()
    return messages
