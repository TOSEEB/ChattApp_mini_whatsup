"""
SQLAlchemy database models
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.database import Base


class MessageStatus(str, enum.Enum):
    """Message status enum"""
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class User(Base):
    """User model for authentication and user management"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    messages_sent = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender", cascade="all, delete-orphan")
    conversations_user1 = relationship("Conversation", foreign_keys="Conversation.user1_id", back_populates="user1")
    conversations_user2 = relationship("Conversation", foreign_keys="Conversation.user2_id", back_populates="user2")
    rooms_created = relationship("Room", foreign_keys="Room.creator_id", back_populates="creator")
    room_memberships = relationship("RoomMember", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    """1-on-1 conversation model (WhatsApp-like)"""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user1_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user2_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    last_message_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user1 = relationship("User", foreign_keys=[user1_id], back_populates="conversations_user1")
    user2 = relationship("User", foreign_keys=[user2_id], back_populates="conversations_user2")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Room(Base):
    """Group room model for multiple users"""
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_message_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
    messages = relationship("Message", back_populates="room", cascade="all, delete-orphan")
    members = relationship("RoomMember", back_populates="room", cascade="all, delete-orphan")


class RoomMember(Base):
    """Room membership model - tracks which users are in which rooms"""
    __tablename__ = "room_members"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    room = relationship("Room", back_populates="members")
    user = relationship("User")
    
    # Unique constraint: a user can only be in a room once
    __table_args__ = (
        {'sqlite_autoincrement': True},
    )


class MessageType(str, enum.Enum):
    """Message type enum"""
    TEXT = "text"
    FILE = "file"
    IMAGE = "image"


class Message(Base):
    """Message model for chat messages"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    message_type = Column(SQLEnum(MessageType), default=MessageType.TEXT, nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=True, index=True)
    status = Column(SQLEnum(MessageStatus), default=MessageStatus.SENT, nullable=False)
    file_path = Column(String(500), nullable=True)  # For file attachments
    file_name = Column(String(255), nullable=True)  # Original filename
    file_size = Column(Integer, nullable=True)  # File size in bytes
    is_encrypted = Column(Boolean, default=False, nullable=False)
    is_edited = Column(Boolean, default=False, nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)  # For message replies
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="messages_sent")
    conversation = relationship("Conversation", back_populates="messages")
    room = relationship("Room", back_populates="messages")
    reply_to = relationship("Message", remote_side=[id], foreign_keys=[reply_to_id])

