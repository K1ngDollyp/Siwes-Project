import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db
from models import Room, RoomMember, User
from schemas import RoomCreate, RoomOut, RoomMemberOut
from auth import get_current_user

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


@router.get("", response_model=List[RoomOut])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all chat rooms with member count and membership state for current user."""
    # Query rooms with member count using scalar subquery or grouping
    member_count_subquery = (
        select(RoomMember.room_id, func.count(RoomMember.id).label("count"))
        .group_by(RoomMember.room_id)
        .subquery()
    )

    query = (
        select(
            Room,
            func.coalesce(member_count_subquery.c.count, 0).label("member_count")
        )
        .outerjoin(member_count_subquery, Room.id == member_count_subquery.c.room_id)
        .order_by(Room.created_at.desc())
    )

    result = await db.execute(query)
    rows = result.all()

    # Get current user's joined room IDs
    user_memberships = await db.execute(
        select(RoomMember.room_id).where(RoomMember.user_id == current_user.id)
    )
    user_room_ids = set(user_memberships.scalars().all())

    rooms_out = []
    for room, count in rows:
        r_out = RoomOut(
            id=room.id,
            name=room.name,
            description=room.description,
            created_by=room.created_by,
            created_at=room.created_at,
            member_count=count,
            is_member=(room.id in user_room_ids)
        )
        rooms_out.append(r_out)

    return rooms_out


@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
async def create_room(
    room_in: RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new chat room and automatically adds creator as first member."""
    # Check for name uniqueness
    existing = await db.execute(select(Room).where(Room.name == room_in.name))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A room with this name already exists"
        )

    new_room = Room(
        name=room_in.name,
        description=room_in.description,
        created_by=current_user.id
    )
    db.add(new_room)
    await db.flush()  # Ensure ID is generated

    # Auto-join creator as member
    membership = RoomMember(
        room_id=new_room.id,
        user_id=current_user.id
    )
    db.add(membership)
    await db.commit()
    await db.refresh(new_room)

    return RoomOut(
        id=new_room.id,
        name=new_room.name,
        description=new_room.description,
        created_by=new_room.created_by,
        created_at=new_room.created_at,
        member_count=1,
        is_member=True
    )


@router.post("/{room_id}/join", response_model=RoomOut)
async def join_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Joins an existing room for current user. Returns 400 if already a member."""
    room_result = await db.execute(select(Room).where(Room.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    # Check existing membership
    existing = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this room"
        )

    membership = RoomMember(
        room_id=room_id,
        user_id=current_user.id
    )
    db.add(membership)
    await db.commit()

    # Get updated member count
    count_res = await db.execute(
        select(func.count(RoomMember.id)).where(RoomMember.room_id == room_id)
    )
    count = count_res.scalar_one()

    return RoomOut(
        id=room.id,
        name=room.name,
        description=room.description,
        created_by=room.created_by,
        created_at=room.created_at,
        member_count=count,
        is_member=True
    )


@router.get("/{room_id}/members", response_model=List[RoomMemberOut])
async def get_room_members(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns list of all members in a specific room."""
    # Check if room exists
    room_result = await db.execute(select(Room).where(Room.id == room_id))
    if not room_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    query = (
        select(RoomMember, User.username, User.email)
        .join(User, RoomMember.user_id == User.id)
        .where(RoomMember.room_id == room_id)
        .order_by(RoomMember.joined_at.asc())
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        RoomMemberOut(
            id=rm.id,
            room_id=rm.room_id,
            user_id=rm.user_id,
            username=uname,
            email=uemail,
            joined_at=rm.joined_at
        )
        for rm, uname, uemail in rows
    ]
