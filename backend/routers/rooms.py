import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete

from database import get_db
from models import Room, RoomMember, User, RoomJoinRequest
from schemas import RoomCreate, RoomOut, RoomMemberOut, RoleUpdate, JoinRequestOut
from auth import get_current_user

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


@router.get("", response_model=List[RoomOut])
async def list_rooms(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves all chat rooms with member count, user role, and join request status."""
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

    # Get current user's memberships and roles
    user_memberships = await db.execute(
        select(RoomMember.room_id, RoomMember.role).where(RoomMember.user_id == current_user.id)
    )
    user_roles_map = {r.room_id: r.role for r in user_memberships.all()}

    # Get current user's pending/recent join requests
    user_requests = await db.execute(
        select(RoomJoinRequest.room_id, RoomJoinRequest.status).where(RoomJoinRequest.user_id == current_user.id)
    )
    user_requests_map = {r.room_id: r.status for r in user_requests.all()}

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
            user_role=user_roles_map.get(room.id) if is_member else None,
            join_request_status=user_requests_map.get(room.id) if not is_member else None
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
        user_role="owner",
        join_request_status=None
    )


@router.post("/{room_id}/join-request", response_model=RoomOut)
async def request_to_join_room(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submits a join request to enter a room. Requires Admin approval."""
    room_result = await db.execute(select(Room).where(Room.id == room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )

    # Check if already a member
    existing_mem = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == current_user.id
        )
    )
    if existing_mem.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this room"
        )

    # Check if existing request is pending
    existing_req = await db.execute(
        select(RoomJoinRequest).where(
            RoomJoinRequest.room_id == room_id,
            RoomJoinRequest.user_id == current_user.id
        )
    )
    req = existing_req.scalar_one_or_none()
    if req:
        if req.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Join request is already pending admin approval"
            )
        else:
            req.status = "pending"
    else:
        req = RoomJoinRequest(
            room_id=room_id,
            user_id=current_user.id,
            status="pending"
        )
        db.add(req)

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
        is_member=False,
        user_role=None,
        join_request_status="pending"
    )


@router.get("/{room_id}/join-requests", response_model=List[JoinRequestOut])
async def get_join_requests(
    room_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves pending join requests for a room. Restricted to Group Admins and Owner."""
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
            detail="Only group owners and admins can view pending join requests"
        )

    query = (
        select(RoomJoinRequest, User.username, User.email)
        .join(User, RoomJoinRequest.user_id == User.id)
        .where(
            RoomJoinRequest.room_id == room_id,
            RoomJoinRequest.status == "pending"
        )
        .order_by(RoomJoinRequest.created_at.asc())
    )
    result = await db.execute(query)
    rows = result.all()

    return [
        JoinRequestOut(
            id=req.id,
            room_id=req.room_id,
            user_id=req.user_id,
            username=uname,
            email=uemail,
            status=req.status,
            created_at=req.created_at
        )
        for req, uname, uemail in rows
    ]


@router.post("/{room_id}/join-requests/{request_id}/approve", response_model=RoomMemberOut)
async def approve_join_request(
    room_id: uuid.UUID,
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Approves a join request. Restricted to Group Admins and Owner."""
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
            detail="Only group owners and admins can approve join requests"
        )

    req_res = await db.execute(
        select(RoomJoinRequest, User.username, User.email)
        .join(User, RoomJoinRequest.user_id == User.id)
        .where(
            RoomJoinRequest.id == request_id,
            RoomJoinRequest.room_id == room_id
        )
    )
    req_tuple = req_res.first()
    if not req_tuple:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found"
        )
    req, target_username, target_email = req_tuple

    # Check if user is already a member
    existing_mem = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == req.user_id
        )
    )
    member = existing_mem.scalar_one_or_none()
    if not member:
        member = RoomMember(
            room_id=room_id,
            user_id=req.user_id,
            role="member"
        )
        db.add(member)

    req.status = "approved"
    await db.commit()
    await db.refresh(member)

    return RoomMemberOut(
        id=member.id,
        room_id=member.room_id,
        user_id=member.user_id,
        username=target_username,
        email=target_email,
        role=member.role,
        joined_at=member.joined_at
    )


@router.post("/{room_id}/join-requests/{request_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
async def reject_join_request(
    room_id: uuid.UUID,
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Rejects a join request. Restricted to Group Admins and Owner."""
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
            detail="Only group owners and admins can reject join requests"
        )

    req_res = await db.execute(
        select(RoomJoinRequest).where(
            RoomJoinRequest.id == request_id,
            RoomJoinRequest.room_id == room_id
        )
    )
    req = req_res.scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Join request not found"
        )

    req.status = "rejected"
    await db.commit()
    return None


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
    caller_member_res = await db.execute(
        select(RoomMember).where(
            RoomMember.room_id == room_id,
            RoomMember.user_id == current_user.id
        )
    )
    caller_member = caller_member_res.scalar_one_or_none()

    is_self = (current_user.id == user_id)
    if not is_self and (not caller_member or caller_member.role not in ["owner", "admin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only group owners and admins can remove members from the room"
        )

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

    if target_member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins cannot remove the Group Owner"
        )

    await db.delete(target_member)
    await db.commit()
    return None
