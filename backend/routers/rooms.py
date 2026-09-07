import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from database import get_db
from models import Room, RoomMember, User
from schemas import RoomCreate, RoomOut, RoomMemberOut, RoleUpdate
from auth import get_current_user

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


@router.get("", response_model=List[RoomOut])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all chat rooms with member count and membership role for current user."""
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

    # Get current user's joined room IDs and roles
    user_memberships = await db.execute(
        select(RoomMember.room_id, RoomMember.role).where(RoomMember.user_id == current_user.id)
    )
    user_roles_map = {r.room_id: r.role for r in user_memberships.all()}

    rooms_out = []
    for room, count in rows:
        is_member = room.id in user_roles_map
        r_out = RoomOut(
            id=room.id,
            name=room.name,
            description=room.description,
            created_by=room.created_by,
            created_at=room.created_at,
            member_count=count,
            is_member=is_member,
            user_role=user_roles_map.get(room.id) if is_member else None
        )
        rooms_out.append(r_out)

    return rooms_out


@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
async def create_room(
    room_in: RoomCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new chat room and sets creator as Group Owner & Admin."""
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
    await db.flush()

    # Auto-join creator as owner & admin
    membership = RoomMember(
        room_id=new_room.id,
        user_id=current_user.id,
        role="owner"
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
        is_member=True,
        user_role="owner"
    )


@router.post("/{room_id}/join", response_model=RoomOut)
async def join_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Joins an existing room for current user as a standard member."""
    room_result = await db.execute(select(Room).where(Room.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

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
        user_id=current_user.id,
        role="member"
    )
    db.add(membership)
    await db.commit()

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
        is_member=True,
        user_role="member"
    )


@router.get("/{room_id}/members", response_model=List[RoomMemberOut])
async def get_room_members(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns list of all members in a specific room with roles."""
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
            role=rm.role or "member",
            joined_at=rm.joined_at
        )
        for rm, uname, uemail in rows
    ]


@router.post("/{room_id}/members/{user_id}/role", response_model=RoomMemberOut)
async def update_member_role(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    role_in: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Promotes or demotes a member's role (admin / member). Requires caller to be owner or admin."""
    # Verify caller membership and role
    caller_member_res = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == current_user.id
        )
    )
    caller_member = caller_member_res.scalar_one_or_none()
    if not caller_member or caller_member.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group owners and admins can update member roles"
        )

    # Verify target member
    target_member_res = await db.execute(
        select(RoomMember, User.username, User.email)
        .join(User, RoomMember.user_id == User.id)
        .where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == user_id
        )
    )
    target_tuple = target_member_res.first()
    if not target_tuple:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user is not a member of this room"
        )
    target_member, target_username, target_email = target_tuple

    # Protection rule: cannot modify room owner's role
    if target_member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot modify the role of the Group Owner"
        )

    target_member.role = role_in.role
    await db.commit()
    await db.refresh(target_member)

    return RoomMemberOut(
        id=target_member.id,
        room_id=target_member.room_id,
        user_id=target_member.user_id,
        username=target_username,
        email=target_email,
        role=target_member.role,
        joined_at=target_member.joined_at
    )


@router.delete("/{room_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Removes (kicks) a member from the room. Admins CANNOT remove the group owner."""
    # Check caller role
    caller_member_res = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == current_user.id
        )
    )
    caller_member = caller_member_res.scalar_one_or_none()

    # User can kick themselves, or an owner/admin can kick others
    is_self = (current_user.id == user_id)
    if not is_self and (not caller_member or caller_member.role not in ["owner", "admin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group owners and admins can remove members from the room"
        )

    # Check target member
    target_member_res = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == user_id
        )
    )
    target_member = target_member_res.scalar_one_or_none()
    if not target_member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this room"
        )

    # Protection rule: CANNOT remove group owner
    if target_member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot remove the Group Owner"
        )

    await db.delete(target_member)
    await db.commit()
    return None
