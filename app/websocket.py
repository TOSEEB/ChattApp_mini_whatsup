"""
WebSocket handlers for real-time messaging (WhatsApp-like)
"""
from fastapi import WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Dict, Set
import json
from jose import jwt
import os

from app.database import get_db
from app.models import User, Conversation, Message, MessageStatus
from app.auth import SECRET_KEY, ALGORITHM

# Store active connections: {conversation_id: {websocket: user_id}}
active_connections: Dict[int, Dict[WebSocket, int]] = {}

# Store online users: {user_id: timestamp}
online_users: Dict[int, datetime] = {}


class ConnectionManager:
    """Manages WebSocket connections for conversations"""
    
    def __init__(self):
        self.active_connections: Dict[int, Dict[WebSocket, int]] = {}
    
    async def connect(self, websocket: WebSocket, conversation_id: int, user_id: int):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = {}
        self.active_connections[conversation_id][websocket] = user_id
    
    def disconnect(self, websocket: WebSocket, conversation_id: int):
        """Remove a WebSocket connection"""
        if conversation_id in self.active_connections:
            if websocket in self.active_connections[conversation_id]:
                del self.active_connections[conversation_id][websocket]
                if not self.active_connections[conversation_id]:
                    del self.active_connections[conversation_id]
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific WebSocket connection"""
        await websocket.send_json(message)
    
    async def send_to_conversation(self, conversation_id: int, message: dict, exclude_websocket: WebSocket = None):
        """Send a message to all connections in a conversation"""
        if conversation_id not in self.active_connections:
            return
        
        disconnected = []
        for websocket, user_id in self.active_connections[conversation_id].items():
            if websocket != exclude_websocket:
                try:
                    await websocket.send_json(message)
                except:
                    disconnected.append(websocket)
        
        # Clean up disconnected websockets
        for ws in disconnected:
            if ws in self.active_connections[conversation_id]:
                del self.active_connections[conversation_id][ws]


manager = ConnectionManager()


def verify_websocket_token(token: str) -> str:
    """Verify JWT token from WebSocket connection and return username"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        return username
    except jwt.JWTError:
        return None


async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: int,
    token: str,
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for real-time chat in conversations"""
    # Verify token and get user
    username = verify_websocket_token(token)
    if not username:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="Invalid or expired token")
        return
    
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="User not found or inactive")
        return
    
    # Verify conversation exists and user is part of it
    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            (Conversation.user1_id == user.id) | (Conversation.user2_id == user.id)
        )
        .first()
    )
    
    if not conversation:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # Update user's last_seen and mark as online
    user.last_seen = datetime.now(timezone.utc)
    online_users[user.id] = datetime.now(timezone.utc)
    db.commit()
    
    # Connect to conversation
    await manager.connect(websocket, conversation_id, user.id)
    
    # Notify other user that this user is online
    other_user_id = conversation.user2_id if conversation.user1_id == user.id else conversation.user1_id
    await manager.send_to_conversation(conversation_id, {
        "type": "user_status",
        "user_id": user.id,
        "is_online": True,
        "last_seen": user.last_seen.isoformat()
    }, exclude_websocket=websocket)
    
    # Mark messages as delivered and read when user connects
    
    # Mark as delivered
    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id == other_user_id,
        Message.status == MessageStatus.SENT
    ).update({Message.status: MessageStatus.DELIVERED})
    
    # Mark as read
    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.sender_id == other_user_id,
        Message.status == MessageStatus.DELIVERED
    ).update({Message.status: MessageStatus.READ})
    
    db.commit()
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "message":
                content = message_data.get("content", "").strip()
                if not content:
                    continue
                
                # Handle encryption if requested
                is_encrypted = message_data.get("encrypt", False)
                if is_encrypted:
                    from app.encryption import encrypt_message
                    content = encrypt_message(content)
                
                # Save message to database
                db_message = Message(
                    content=content,
                    conversation_id=conversation_id,
                    sender_id=user.id,
                    status=MessageStatus.SENT,
                    is_encrypted=is_encrypted,
                    message_type=message_data.get("message_type", "text")
                )
                db.add(db_message)
                
                # Update conversation's last_message_at
                conversation.last_message_at = datetime.now(timezone.utc)
                db.commit()
                db.refresh(db_message)
                
                # Decrypt for sending (if encrypted)
                display_content = content
                if is_encrypted:
                    from app.encryption import decrypt_message
                    display_content = decrypt_message(content)
                
                # Build file URL if file exists
                file_url = None
                if db_message.file_path:
                    import os
                    file_name = os.path.basename(db_message.file_path)
                    file_id = os.path.splitext(file_name)[0]
                    file_url = f"/api/files/{file_id}"
                
                # Create message payload
                message_payload = {
                    "type": "message",
                    "id": db_message.id,
                    "content": display_content,  # Decrypted content for display
                    "sender_username": username,
                    "sender_id": user.id,
                    "conversation_id": conversation_id,
                    "status": db_message.status.value,
                    "message_type": db_message.message_type.value,
                    "file_path": file_url,
                    "file_name": db_message.file_name,
                    "file_size": db_message.file_size,
                    "is_encrypted": is_encrypted,
                    "timestamp": db_message.created_at.isoformat()
                }
                
                # Send message to other user in conversation
                await manager.send_to_conversation(conversation_id, message_payload, exclude_websocket=websocket)
                
                # Also send the full message back to sender so they can see it
                await manager.send_personal_message(message_payload, websocket)
            
            elif message_data.get("type") == "typing":
                # Send typing indicator to other user
                await manager.send_to_conversation(conversation_id, {
                    "type": "typing",
                    "username": username,
                    "is_typing": message_data.get("is_typing", False),
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }, exclude_websocket=websocket)
            
            elif message_data.get("type") == "status_update":
                # Update message status (delivered/read)
                message_id = message_data.get("message_id")
                new_status = message_data.get("status")
                
                if message_id and new_status:
                    db_message = db.query(Message).filter(Message.id == message_id).first()
                    if db_message and db_message.conversation_id == conversation_id:
                        if new_status == "delivered":
                            db_message.status = MessageStatus.DELIVERED
                        elif new_status == "read":
                            db_message.status = MessageStatus.READ
                        db.commit()
                        
                        # Notify sender
                        await manager.send_to_conversation(conversation_id, {
                            "type": "status_update",
                            "message_id": message_id,
                            "status": new_status,
                            "timestamp": datetime.now(timezone.utc).isoformat()
                        }, exclude_websocket=websocket)
    
    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id)
        # Mark user as offline
        if user.id in online_users:
            del online_users[user.id]
        # Notify other user
        try:
            await manager.send_to_conversation(conversation_id, {
                "type": "user_status",
                "user_id": user.id,
                "is_online": False,
                "last_seen": user.last_seen.isoformat() if user.last_seen else None
            })
        except:
            pass  # Connection already closed
