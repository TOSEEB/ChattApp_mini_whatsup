"""
Pydantic schemas for request/response validation
"""
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional, List


# User Schemas
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


# Room Schemas (Group Rooms)
class RoomBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class RoomCreate(RoomBase):
    pass


class RoomResponse(RoomBase):
    id: int
    creator_id: int
    creator_username: str
    member_count: int = 0
    is_member: bool = False
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RoomMemberResponse(BaseModel):
    id: int
    user_id: int
    username: str
    email: str
    joined_at: datetime

    class Config:
        from_attributes = True


class AddMemberRequest(BaseModel):
    user_id: int


# Conversation Schemas
class ConversationResponse(BaseModel):
    id: int
    user1_id: int
    user2_id: int
    other_user_id: int
    other_username: str
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    other_user_online: Optional[bool] = False
    other_user_last_seen: Optional[datetime] = None

    class Config:
        from_attributes = True


# Message Schemas
class MessageBase(BaseModel):
    content: str = Field(..., min_length=1)
    message_type: Optional[str] = "text"
    is_encrypted: Optional[bool] = False


class MessageCreate(MessageBase):
    conversation_id: Optional[int] = None
    room_id: Optional[int] = None


class MessageResponse(MessageBase):
    id: int
    conversation_id: Optional[int] = None
    room_id: Optional[int] = None
    sender_id: int
    sender_username: str
    status: str
    message_type: str
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    is_encrypted: bool
    is_edited: bool = False
    is_deleted: bool = False
    reply_to_id: Optional[int] = None
    reply_to_content: Optional[str] = None  # Preview of replied message
    reply_to_sender: Optional[str] = None
    updated_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# WebSocket Message Schema
class WebSocketMessage(BaseModel):
    type: str  # "message", "typing", "status_update"
    content: Optional[str] = None
    conversation_id: Optional[int] = None
    message_id: Optional[int] = None
    username: Optional[str] = None
    status: Optional[str] = None
    timestamp: Optional[datetime] = None


# Token Schema
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None

