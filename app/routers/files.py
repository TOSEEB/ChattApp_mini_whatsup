"""
File upload and download routes
"""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query, Request
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from sqlalchemy import or_, and_
from typing import Optional
from jose import JWTError, jwt
from app.database import get_db
from app.models import Message, Conversation, Room, MessageType, User
from app.auth import SECRET_KEY, ALGORITHM, get_current_active_user

router = APIRouter(prefix="/api/files", tags=["files"])

# Create uploads directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Allowed file types
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_FILE_TYPES = {
    "application/pdf", "application/msword", 
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "application/zip"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: Optional[int] = Form(None),
    room_id: Optional[int] = Form(None),
    encrypt: Optional[str] = Form("false"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload a file and create a message with it"""
    # Convert string IDs to integers if they're strings (form data sends as strings)
    try:
        if conversation_id is not None:
            conversation_id = int(conversation_id) if not isinstance(conversation_id, int) else conversation_id
        if room_id is not None:
            room_id = int(room_id) if not isinstance(room_id, int) else room_id
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid conversation_id or room_id format"
        )
    
    # Validate conversation or room
    if not conversation_id and not room_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either conversation_id or room_id must be provided"
        )
    
    if conversation_id:
        conv = db.query(Conversation).filter(
            and_(
                Conversation.id == conversation_id,
                or_(
                    Conversation.user1_id == current_user.id,
                    Conversation.user2_id == current_user.id
                )
            )
        ).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    
    if room_id:
        room = db.query(Room).filter(Room.id == room_id).first()
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
    
    # Validate file
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    # Check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    # Determine message type
    message_type = MessageType.FILE
    if file.content_type in ALLOWED_IMAGE_TYPES:
        message_type = MessageType.IMAGE
    
    # Save file
    file_ext = Path(file.filename).suffix
    file_id = str(uuid.uuid4())
    file_path = UPLOAD_DIR / f"{file_id}{file_ext}"
    
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Create message
    message_content = f"📎 {file.filename}"
    # Convert encrypt string to boolean
    is_encrypted = encrypt and encrypt.lower() == "true"
    if is_encrypted:
        from app.encryption import encrypt_message
        message_content = encrypt_message(message_content)
    
    db_message = Message(
        content=message_content,
        message_type=message_type,
        sender_id=current_user.id,
        conversation_id=conversation_id,
        room_id=room_id,
        file_path=str(file_path),
        file_name=file.filename,
        file_size=len(contents),
        is_encrypted=is_encrypted
    )
    db.add(db_message)
    
    if conversation_id:
        conv.last_message_at = func.now()
    if room_id:
        room.last_message_at = func.now()
    
    db.commit()
    db.refresh(db_message)
    
    # Extract file ID from saved path
    file_url = f"/api/files/{file_id}"
    
    return {
        "message_id": db_message.id,
        "file_path": file_url,
        "file_name": file.filename,
        "file_size": len(contents),
        "message_type": message_type.value
    }


async def get_user_from_token(token: str, db: Session) -> Optional[User]:
    """Helper function to get user from JWT token"""
    if not token:
        return None
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            return None
        user = db.query(User).filter(User.username == username).first()
        if user and user.is_active:
            return user
    except JWTError as e:
        print(f"JWT Error: {e}")
        return None
    except Exception as e:
        print(f"Error decoding token: {e}")
        return None
    return None

async def get_current_user_optional(
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from token in query parameter or Authorization header"""
    # Try query parameter first (for file downloads via URL)
    if token:
        user = await get_user_from_token(token, db)
        if user:
            return user
    
    # Try Authorization header (for API calls)
    authorization = request.headers.get("Authorization")
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        user = await get_user_from_token(token, db)
        if user:
            return user
    
    # If no token provided at all, return 401
    raise HTTPException(
        status_code=401, 
        detail="Authentication required. Please provide a valid token."
    )

@router.get("/{file_id}")
async def download_file(
    file_id: str,
    request: Request,
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Download a file - accepts token in query parameter or Authorization header"""
    # Authenticate user
    current_user = await get_current_user_optional(request, token, db)
    
    # Find file by ID in filename
    file_path = None
    for f in UPLOAD_DIR.glob(f"{file_id}*"):
        file_path = f
        break
    
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Verify user has access (check if they're part of conversation/room with this file)
    message = db.query(Message).filter(Message.file_path.like(f"%{file_id}%")).first()
    if not message:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check access
    has_access = False
    if message.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == message.conversation_id).first()
        if conv and (conv.user1_id == current_user.id or conv.user2_id == current_user.id):
            has_access = True
    elif message.room_id:
        # Check if user is a member of the room
        from app.models import RoomMember
        is_member = db.query(RoomMember).filter(
            and_(RoomMember.room_id == message.room_id, RoomMember.user_id == current_user.id)
        ).first()
        if is_member:
            has_access = True
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FileResponse(
        path=file_path,
        filename=message.file_name or file_path.name,
        media_type='application/octet-stream'
    )

