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


class RoomOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    member_count: int = 0
    is_member: bool = False

    model_config = ConfigDict(from_attributes=True)


class RoomMemberOut(BaseModel):
    id: UUID
    room_id: UUID
    user_id: UUID
    username: str
    email: EmailStr
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Message Schemas ---
class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)


class MessageOut(BaseModel):
    id: UUID
    room_id: UUID
    user_id: UUID
    username: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- WebSocket Message Schemas ---
class WSMessagePayload(BaseModel):
    type: str  # "message", "typing", "user_joined", "user_left", "history"
    username: Optional[str] = None
    user_id: Optional[str] = None
    content: Optional[str] = None
    timestamp: Optional[str] = None
    messages: Optional[List[MessageOut]] = None
