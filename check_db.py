"""Quick script to check database contents"""
from app.database import SessionLocal
from app.models import User, Message, Conversation, Room

db = SessionLocal()

print("=" * 50)
print("DATABASE STATUS CHECK")
print("=" * 50)

# Check Users
users = db.query(User).all()
print(f"\n[OK] Users in database: {len(users)}")
for user in users:
    print(f"   - {user.username} ({user.email}) - ID: {user.id}")

# Check Conversations
conversations = db.query(Conversation).all()
print(f"\n[OK] Conversations in database: {len(conversations)}")
for conv in conversations:
    print(f"   - Conversation ID: {conv.id} (User1: {conv.user1_id}, User2: {conv.user2_id})")

# Check Messages
messages = db.query(Message).all()
print(f"\n[OK] Messages in database: {len(messages)}")
for msg in messages[:5]:  # Show first 5
    content_preview = msg.content[:30] if msg.content else "No content"
    print(f"   - Message ID: {msg.id}, Sender: {msg.sender_id}, Content: {content_preview}...")

# Check Rooms
rooms = db.query(Room).all()
print(f"\n[OK] Rooms in database: {len(rooms)}")
for room in rooms:
    print(f"   - {room.name} (ID: {room.id})")

print("\n" + "=" * 50)
print("[OK] Database is working correctly!")
print("=" * 50)

db.close()

