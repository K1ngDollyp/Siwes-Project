from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, ConfigDict, Field


# --- Auth & User Schemas ---
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Room Schemas ---
class RoomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    is_private: bool = False


class RoomOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_private: bool = False
    created_by: Optional[UUID] = None
    created_at: datetime
    member_count: int = 0
    is_member: bool = False
    user_role: Optional[str] = None
    join_request_status: Optional[str] = None  # None | "pending" | "approved" | "rejected"

    model_config = ConfigDict(from_attributes=True)


class RoomMemberOut(BaseModel):
    id: UUID
    room_id: UUID
    user_id: UUID
    username: str
    email: EmailStr
    role: str = "member"  # "owner", "admin", "member"
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(admin|member)$")


# --- Join Requests Schemas ---
class JoinRequestOut(BaseModel):
    id: UUID
    room_id: UUID
    user_id: UUID
    username: str
    email: EmailStr
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Message & Reply Schemas ---
class ReplyToPreview(BaseModel):
    id: UUID
    username: str
    content: str


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)
    reply_to_id: Optional[UUID] = None


class MessageOut(BaseModel):
    id: UUID
    room_id: UUID
    user_id: UUID
    username: str
    content: str
    reply_to_id: Optional[UUID] = None
    reply_to: Optional[ReplyToPreview] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- WebSocket Message Schemas ---
class WSMessagePayload(BaseModel):
    type: str  # "message", "typing", "user_joined", "user_left", "history", "member_updated", "member_removed"
    username: Optional[str] = None
    user_id: Optional[str] = None
    content: Optional[str] = None
    timestamp: Optional[str] = None
    reply_to_id: Optional[str] = None
    reply_to: Optional[ReplyToPreview] = None
    messages: Optional[List[MessageOut]] = None
