"""
Group room routes for multi-user chats
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, and_, or_
from app.database import get_db
from app.models import User, Room, Message, MessageStatus, RoomMember
from app.schemas import RoomCreate, RoomResponse, MessageResponse, MessageCreate, RoomMemberResponse, AddMemberRequest
from app.auth import get_current_active_user

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


@router.get("/", response_model=List[RoomResponse])
def get_rooms(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all rooms the current user is a member of"""
    # Get room IDs where user is a member
    member_room_ids = (
        db.query(RoomMember.room_id)
        .filter(RoomMember.user_id == current_user.id)
        .subquery()
    )
    
    rooms = (
        db.query(Room)
        .filter(Room.id.in_(db.query(member_room_ids.c.room_id)))
        .order_by(desc(Room.last_message_at))
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    result = []
    for room in rooms:
        # Get last message
        last_message = (
            db.query(Message)
            .filter(Message.room_id == room.id)
            .order_by(desc(Message.created_at))
            .first()
        )
        
        # Decrypt last message if encrypted (for preview display)
        last_message_content = None
        if last_message and not last_message.is_deleted:
            last_message_content = last_message.content
            if last_message.is_encrypted:
                try:
                    from app.encryption import decrypt_message
                    last_message_content = decrypt_message(last_message.content)
                except:
                    # If decryption fails, show placeholder
                    last_message_content = "🔒 Encrypted message"
        
        # Count actual members
        member_count = (
            db.query(func.count(RoomMember.id))
            .filter(RoomMember.room_id == room.id)
            .scalar() or 0
        )
        
        result.append(RoomResponse(
            id=room.id,
            name=room.name,
            description=room.description,
            creator_id=room.creator_id,
            creator_username=room.creator.username,
            member_count=member_count,
            is_member=True,  # User is a member (they're in the list)
            last_message=last_message_content,
            last_message_at=last_message.created_at if last_message else room.created_at,
            created_at=room.created_at
        ))
    
    return result


@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    room_data: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new group room - creator is automatically added as a member"""
    db_room = Room(
        name=room_data.name,
        description=room_data.description,
        creator_id=current_user.id
    )
    db.add(db_room)
    db.flush()  # Flush to get the room ID
    
    # Add creator as first member
    creator_member = RoomMember(
        room_id=db_room.id,
        user_id=current_user.id
    )
    db.add(creator_member)
    db.commit()
    db.refresh(db_room)
    
    return RoomResponse(
        id=db_room.id,
        name=db_room.name,
        description=db_room.description,
        creator_id=db_room.creator_id,
        creator_username=db_room.creator.username,
        member_count=1,
        is_member=True,
        last_message=None,
        last_message_at=db_room.created_at,
        created_at=db_room.created_at
    )


@router.get("/{room_id}/messages", response_model=List[MessageResponse])
def get_room_messages(
    room_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get messages for a room - only members can access"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if user is a member
    is_member = db.query(RoomMember).filter(
        and_(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id)
    ).first()
    
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this room")
    
    # Mark messages as delivered/read
    db.query(Message).filter(
        Message.room_id == room_id,
        Message.sender_id != current_user.id,
        Message.status == MessageStatus.SENT
    ).update({Message.status: MessageStatus.DELIVERED})
    
    db.query(Message).filter(
        Message.room_id == room_id,
        Message.sender_id != current_user.id,
        Message.status == MessageStatus.DELIVERED
    ).update({Message.status: MessageStatus.READ})
    
    db.commit()
    
    messages = (
        db.query(Message)
        .filter(Message.room_id == room_id)
        .order_by(Message.created_at)
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    result = []
    for msg in messages:
        # Decrypt content if encrypted
        display_content = msg.content
        if msg.is_encrypted:
            from app.encryption import decrypt_message
            display_content = decrypt_message(msg.content)
        
        # Build file URL if file exists
        file_url = None
        if msg.file_path:
            import os
            file_name = os.path.basename(msg.file_path)
            file_id = os.path.splitext(file_name)[0]
            file_url = f"/api/files/{file_id}"
        
        # Get reply info if exists
        reply_to_content = None
        reply_to_sender = None
        if msg.reply_to_id:
            reply_msg = db.query(Message).filter(Message.id == msg.reply_to_id).first()
            if reply_msg:
                reply_to_sender = reply_msg.sender.username
                if reply_msg.is_deleted:
                    reply_to_content = "This message was deleted"
                elif reply_msg.is_encrypted:
                    try:
                        from app.encryption import decrypt_message
                        reply_to_content = decrypt_message(reply_msg.content)
                    except:
                        reply_to_content = reply_msg.content
                else:
                    reply_to_content = reply_msg.content[:50]  # Preview
        
        result.append(MessageResponse(
            id=msg.id,
            content=display_content if not msg.is_deleted else "This message was deleted",
            conversation_id=None,
            room_id=msg.room_id,
            sender_id=msg.sender_id,
            sender_username=msg.sender.username,
            status=msg.status.value,
            message_type=msg.message_type.value,
            file_path=file_url,
            file_name=msg.file_name,
            file_size=msg.file_size,
            is_encrypted=msg.is_encrypted,
            is_edited=msg.is_edited,
            is_deleted=msg.is_deleted,
            reply_to_id=msg.reply_to_id,
            reply_to_content=reply_to_content,
            reply_to_sender=reply_to_sender,
            updated_at=msg.updated_at,
            created_at=msg.created_at
        ))
    
    return result


@router.post("/{room_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_room_message(
    room_id: int,
    message_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Send a message to a room"""
    from pydantic import BaseModel
    from typing import Optional
    
    # Parse message data
    content = message_data.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content cannot be empty")
    
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if user is a member
    is_member = db.query(RoomMember).filter(
        and_(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id)
    ).first()
    
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this room")
    
    # Handle encryption if requested
    is_encrypted = message_data.get("encrypt", False)
    message_type = message_data.get("message_type", "text")
    
    if is_encrypted:
        from app.encryption import encrypt_message
        content = encrypt_message(content)
    
    # Get reply_to_id if provided
    reply_to_id = message_data.get("reply_to_id")
    
    # Create message
    db_message = Message(
        content=content,
        message_type=message_type,
        sender_id=current_user.id,
        room_id=room_id,
        status=MessageStatus.SENT,
        is_encrypted=is_encrypted,
        reply_to_id=reply_to_id
    )
    db.add(db_message)
    
    # Update room's last_message_at
    from sqlalchemy.sql import func
    room.last_message_at = func.now()
    
    db.commit()
    db.refresh(db_message)
    
    # Decrypt for response
    display_content = db_message.content
    if is_encrypted:
        from app.encryption import decrypt_message
        display_content = decrypt_message(db_message.content)
    
    # Build file URL if file exists
    file_url = None
    if db_message.file_path:
        import os
        file_name = os.path.basename(db_message.file_path)
        file_id = os.path.splitext(file_name)[0]
        file_url = f"/api/files/{file_id}"
    
    # Get reply info if exists
    reply_to_content = None
    reply_to_sender = None
    if db_message.reply_to_id:
        reply_msg = db.query(Message).filter(Message.id == db_message.reply_to_id).first()
        if reply_msg:
            reply_to_sender = reply_msg.sender.username
            if reply_msg.is_deleted:
                reply_to_content = "This message was deleted"
            elif reply_msg.is_encrypted:
                try:
                    from app.encryption import decrypt_message
                    reply_to_content = decrypt_message(reply_msg.content)
                except:
                    reply_to_content = reply_msg.content
            else:
                reply_to_content = reply_msg.content[:50]  # Preview
    
    return MessageResponse(
        id=db_message.id,
        content=display_content,
        conversation_id=None,
        room_id=db_message.room_id,
        sender_id=db_message.sender_id,
        sender_username=db_message.sender.username,
        status=db_message.status.value,
        message_type=db_message.message_type.value,
        file_path=file_url,
        file_name=db_message.file_name,
        file_size=db_message.file_size,
        is_encrypted=db_message.is_encrypted,
        is_edited=db_message.is_edited,
        is_deleted=db_message.is_deleted,
        reply_to_id=db_message.reply_to_id,
        reply_to_content=reply_to_content,
        reply_to_sender=reply_to_sender,
        updated_at=db_message.updated_at,
        created_at=db_message.created_at
    )


@router.get("/{room_id}/members", response_model=List[RoomMemberResponse])
def get_room_members(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all members of a room"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if user is a member
    is_member = db.query(RoomMember).filter(
        and_(RoomMember.room_id == room_id, RoomMember.user_id == current_user.id)
    ).first()
    
    if not is_member:
        raise HTTPException(status_code=403, detail="You are not a member of this room")
    
    members = (
        db.query(RoomMember)
        .filter(RoomMember.room_id == room_id)
        .all()
    )
    
    result = []
    for member in members:
        result.append(RoomMemberResponse(
            id=member.id,
            user_id=member.user_id,
            username=member.user.username,
            email=member.user.email,
            joined_at=member.joined_at
        ))
    
    return result


@router.post("/{room_id}/members", response_model=RoomMemberResponse, status_code=status.HTTP_201_CREATED)
def add_member_to_room(
    room_id: int,
    member_data: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add a user to a room - only room creator can add members"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if current user is the creator
    if room.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the room creator can add members")
    
    # Check if user to add exists
    user_to_add = db.query(User).filter(User.id == member_data.user_id).first()
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is already a member
    existing_member = db.query(RoomMember).filter(
        and_(RoomMember.room_id == room_id, RoomMember.user_id == member_data.user_id)
    ).first()
    
    if existing_member:
        raise HTTPException(status_code=400, detail="User is already a member of this room")
    
    # Add member
    new_member = RoomMember(
        room_id=room_id,
        user_id=member_data.user_id
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)
    
    return RoomMemberResponse(
        id=new_member.id,
        user_id=new_member.user_id,
        username=new_member.user.username,
        email=new_member.user.email,
        joined_at=new_member.joined_at
    )


@router.delete("/{room_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member_from_room(
    room_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Remove a user from a room - only room creator can remove members"""
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Check if current user is the creator
    if room.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the room creator can remove members")
    
    # Find and remove member
    member = db.query(RoomMember).filter(
        and_(RoomMember.room_id == room_id, RoomMember.user_id == user_id)
    ).first()
    
    if not member:
        raise HTTPException(status_code=404, detail="User is not a member of this room")
    
    # Don't allow removing the creator
    if user_id == room.creator_id:
        raise HTTPException(status_code=400, detail="Cannot remove the room creator")
    
    db.delete(member)
    db.commit()
    
    return None


@router.get("/search/messages", response_model=List[dict])
def search_room_messages(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Search for messages containing the query text in rooms"""
    if len(q) < 1:
        return []
    
    # Get all rooms the user is a member of
    user_room_ids = [
        member.room_id for member in db.query(RoomMember.room_id)
        .filter(RoomMember.user_id == current_user.id)
        .all()
    ]
    
    if not user_room_ids:
        return []
    
    # Search messages in those rooms
    # Get all messages first, then decrypt and search in plain text
    all_messages = (
        db.query(Message)
        .filter(
            and_(
                Message.room_id.in_(user_room_ids),
                Message.is_deleted == False
            )
        )
        .order_by(desc(Message.created_at))
        .limit(500)  # Get more messages to search through
        .all()
    )
    
    from app.encryption import decrypt_message
    matching_messages = []
    
    for msg in all_messages:
        # Always decrypt if encrypted, then search in plain text
        search_content = msg.content
        if msg.is_encrypted:
            try:
                # Decrypt the message to get plain text
                search_content = decrypt_message(msg.content)
            except Exception as e:
                # If decryption fails, skip this message (can't search encrypted content)
                continue
        
        # Search in plain text content (case-insensitive)
        if q.lower() in search_content.lower():
            matching_messages.append(msg)
    
    # Group by room_id and return unique room IDs
    room_ids = set()
    for msg in matching_messages:
        room_ids.add(msg.room_id)
    
    # Get room details
    result = []
    for room_id in room_ids:
        room = db.query(Room).filter(Room.id == room_id).first()
        if room:
            result.append({
                "type": "room",
                "id": room.id,
                "name": room.name,
                "match_count": len([m for m in matching_messages if m.room_id == room_id])
            })
    
    return result

