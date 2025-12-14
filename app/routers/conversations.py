"""
Conversation routes: direct messaging (WhatsApp-like)
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_
from sqlalchemy.sql import func
from app.database import get_db
from app.models import User, Conversation, Message, MessageStatus
from app.schemas import ConversationResponse, MessageCreate, MessageResponse
from app.auth import get_current_active_user
from app.websocket import online_users
from datetime import datetime, timezone, timedelta

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/", response_model=List[ConversationResponse])
def get_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all conversations for the current user"""
    # Get conversations where user is either user1 or user2
    conversations = (
        db.query(Conversation)
        .filter(
            or_(
                Conversation.user1_id == current_user.id,
                Conversation.user2_id == current_user.id
            )
        )
        .order_by(desc(Conversation.last_message_at))
        .all()
    )
    
    result = []
    for conv in conversations:
        # Determine the other user
        if conv.user1_id == current_user.id:
            other_user = conv.user2
            other_user_id = conv.user2_id
        else:
            other_user = conv.user1
            other_user_id = conv.user1_id
        
        # Get last message
        last_message = (
            db.query(Message)
            .filter(Message.conversation_id == conv.id)
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
        
        # Count unread messages (messages not sent by current user and not read)
        unread_count = (
            db.query(func.count(Message.id))
            .filter(
                and_(
                    Message.conversation_id == conv.id,
                    Message.sender_id != current_user.id,
                    Message.status != MessageStatus.READ,
                    Message.is_deleted == False
                )
            )
            .scalar() or 0
        )
        
        # Check if other user is online (active in last 30 seconds)
        is_online = False
        if other_user_id in online_users:
            last_active = online_users[other_user_id]
            if isinstance(last_active, datetime):
                time_diff = datetime.now(timezone.utc) - last_active
                is_online = time_diff < timedelta(seconds=30)
        
        result.append(ConversationResponse(
            id=conv.id,
            user1_id=conv.user1_id,
            user2_id=conv.user2_id,
            other_user_id=other_user_id,
            other_username=other_user.username,
            last_message=last_message_content,
            last_message_at=last_message.created_at if last_message else conv.created_at,
            unread_count=unread_count,
            other_user_online=is_online,
            other_user_last_seen=other_user.last_seen
        ))
    
    return result


@router.post("/with/{user_id}", response_model=ConversationResponse)
def get_or_create_conversation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get or create a conversation with another user"""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create conversation with yourself"
        )
    
    # Check if other user exists
    other_user = db.query(User).filter(User.id == user_id).first()
    if not other_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check if conversation already exists
    conversation = (
        db.query(Conversation)
        .filter(
            or_(
                and_(Conversation.user1_id == current_user.id, Conversation.user2_id == user_id),
                and_(Conversation.user1_id == user_id, Conversation.user2_id == current_user.id)
            )
        )
        .first()
    )
    
    if not conversation:
        # Create new conversation
        conversation = Conversation(
            user1_id=current_user.id,
            user2_id=user_id
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    
    # Get last message
    last_message = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
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
    
    return ConversationResponse(
        id=conversation.id,
        user1_id=conversation.user1_id,
        user2_id=conversation.user2_id,
        other_user_id=user_id,
        other_username=other_user.username,
        last_message=last_message_content,
        last_message_at=last_message.created_at if last_message else conversation.created_at,
        unread_count=0,
        other_user_online=False,
        other_user_last_seen=other_user.last_seen
    )


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
def get_messages(
    conversation_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get messages for a conversation"""
    # Verify conversation exists and user is part of it
    conversation = (
        db.query(Conversation)
        .filter(
            and_(
                Conversation.id == conversation_id,
                or_(
                    Conversation.user1_id == current_user.id,
                    Conversation.user2_id == current_user.id
                )
            )
        )
        .first()
    )
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Mark messages as delivered if they're from the other user
    other_user_id = conversation.user2_id if conversation.user1_id == current_user.id else conversation.user1_id
    db.query(Message).filter(
        and_(
            Message.conversation_id == conversation_id,
            Message.sender_id == other_user_id,
            Message.status == MessageStatus.SENT
        )
    ).update({Message.status: MessageStatus.DELIVERED})
    
    # Mark messages as read
    db.query(Message).filter(
        and_(
            Message.conversation_id == conversation_id,
            Message.sender_id == other_user_id,
            Message.status == MessageStatus.DELIVERED
        )
    ).update({Message.status: MessageStatus.READ})
    
    db.commit()
    
    # Get messages (exclude deleted messages or show as deleted)
    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    result = []
    for msg in messages:
        # Decrypt content if encrypted
        display_content = msg.content
        if msg.is_encrypted and not msg.is_deleted:
            from app.encryption import decrypt_message
            try:
                display_content = decrypt_message(msg.content)
            except:
                display_content = msg.content
        
        # Build file URL if file exists
        file_url = None
        if msg.file_path:
            # Extract file ID from path
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
            conversation_id=msg.conversation_id,
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


@router.get("/users/all", response_model=List[dict])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all users in the system (for adding to rooms)"""
    users = db.query(User).filter(User.is_active == True).all()
    
    result = []
    for user in users:
        result.append({
            "id": user.id,
            "username": user.username,
            "email": user.email
        })
    
    return result


@router.get("/users/search", response_model=List[dict])
def search_users(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Search for users to start a conversation"""
    if len(q) < 2:
        return []
    
    users = (
        db.query(User)
        .filter(
            and_(
                User.id != current_user.id,
                User.is_active == True,
                User.username.ilike(f"%{q}%")
            )
        )
        .limit(20)
        .all()
    )
    
    return [{"id": user.id, "username": user.username, "email": user.email} for user in users]


@router.get("/search/messages", response_model=List[dict])
def search_messages(
    q: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Search for messages containing the query text in conversations"""
    if len(q) < 1:
        return []
    
    # Get all conversations the user is part of
    user_conversation_ids = [
        conv.id for conv in db.query(Conversation.id)
        .filter(
            or_(
                Conversation.user1_id == current_user.id,
                Conversation.user2_id == current_user.id
            )
        )
        .all()
    ]
    
    if not user_conversation_ids:
        return []
    
    # Search messages in those conversations
    # IMPORTANT: Decrypt encrypted messages first, then search in plain text
    matching_messages = []
    all_messages = (
        db.query(Message)
        .filter(
            and_(
                Message.conversation_id.in_(user_conversation_ids),
                Message.is_deleted == False
            )
        )
        .order_by(desc(Message.created_at))
        .limit(500)  # Get more messages to search through
        .all()
    )
    
    from app.encryption import decrypt_message
    
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
    
    # Group by conversation_id and return unique conversation IDs
    conversation_ids = set()
    for msg in matching_messages:
        conversation_ids.add(msg.conversation_id)
    
    # Get conversation details
    result = []
    for conv_id in conversation_ids:
        conv = (
            db.query(Conversation)
            .filter(Conversation.id == conv_id)
            .first()
        )
        if conv:
            # Determine the other user
            if conv.user1_id == current_user.id:
                other_user = conv.user2
                other_user_id = conv.user2_id
            else:
                other_user = conv.user1
                other_user_id = conv.user1_id
            
            result.append({
                "type": "conversation",
                "id": conv.id,
                "other_user_id": other_user_id,
                "other_username": other_user.username,
                "match_count": len([m for m in matching_messages if m.conversation_id == conv_id])
            })
    
    return result


@router.put("/messages/{message_id}", response_model=MessageResponse)
def edit_message(
    message_id: int,
    content: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Edit a message (only sender can edit, within 15 minutes)"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    
    if message.is_deleted:
        raise HTTPException(status_code=400, detail="Cannot edit deleted message")
    
    # Check if message is within 15 minutes
    time_diff = datetime.now(timezone.utc) - message.created_at
    if time_diff > timedelta(minutes=15):
        raise HTTPException(status_code=400, detail="Message can only be edited within 15 minutes")
    
    # Encrypt if needed
    if message.is_encrypted:
        from app.encryption import encrypt_message
        message.content = encrypt_message(content)
    else:
        message.content = content
    
    message.is_edited = True
    message.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(message)
    
    # Return updated message
    display_content = content
    file_url = None
    if message.file_path:
        import os
        file_name = os.path.basename(message.file_path)
        file_id = os.path.splitext(file_name)[0]
        file_url = f"/api/files/{file_id}"
    
    return MessageResponse(
        id=message.id,
        content=display_content,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_username=message.sender.username,
        status=message.status.value,
        message_type=message.message_type.value,
        file_path=file_url,
        file_name=message.file_name,
        file_size=message.file_size,
        is_encrypted=message.is_encrypted,
        is_edited=message.is_edited,
        is_deleted=message.is_deleted,
        reply_to_id=message.reply_to_id,
        reply_to_content=None,
        reply_to_sender=None,
        updated_at=message.updated_at,
        created_at=message.created_at
    )


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a message (soft delete - marks as deleted)"""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    
    message.is_deleted = True
    message.content = "This message was deleted"
    message.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    return None

