# 💬 WhatsApp-like Chat Application

A full-stack, real-time chat application built with Python FastAPI and vanilla JavaScript, featuring end-to-end encryption, group chats, file sharing, and a modern WhatsApp-inspired UI.

![Python](https://img.shields.io/badge/Python-3.13-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)
![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-orange.svg)

## ✨ Features

### 🔐 Security & Privacy
- **End-to-End Encryption**: All messages are encrypted by default using AES-256 (Fernet)
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt for secure password storage
- **Session Management**: Persistent sessions with localStorage

### 💬 Messaging Features
- **Real-time Messaging**: WebSocket-based instant messaging
- **1-on-1 Conversations**: Direct messaging between users
- **Group Chats (Rooms)**: Create and manage group conversations
- **Message Actions**: Edit, delete, and reply to messages
- **Message Status**: Sent, delivered, and read indicators
- **Online/Offline Status**: See when users are online or last seen
- **Message Search**: Search through all conversations and messages
- **Infinite Scroll**: Load older messages seamlessly

### 📎 File Sharing
- **File Upload**: Share documents and files
- **Image Support**: Send and view images inline
- **Secure Downloads**: Token-based file access
- **File Size Validation**: 10MB limit with proper error handling

### 🎨 User Experience
- **Modern UI**: WhatsApp-inspired dark theme design
- **Mobile Responsive**: Fully responsive design for all devices
- **Emoji Support**: Built-in emoji picker
- **Toast Notifications**: Beautiful, non-intrusive notifications
- **Onboarding Tutorial**: Interactive guide for new users
- **Real-time Typing Indicators**: See when someone is typing

### 👥 Group Management
- **Room Creation**: Create custom group chats
- **Member Management**: Add/remove members (admin controls)
- **Room Info**: View room details and members
- **Read Receipts**: Track who read group messages

### 🔍 Advanced Features
- **Message Pagination**: Infinite scroll for message history
- **Search Functionality**: Search messages and contacts
- **Contact Management**: Easy user discovery and chat initiation
- **Session Persistence**: Stay logged in across page reloads

## 🛠️ Tech Stack

### Backend
- **FastAPI**: Modern, fast web framework for building APIs
- **SQLAlchemy**: SQL toolkit and ORM
- **SQLite**: Lightweight database (easily switchable to PostgreSQL)
- **WebSockets**: Real-time bidirectional communication
- **JWT**: JSON Web Tokens for authentication
- **Bcrypt**: Password hashing
- **Fernet (Cryptography)**: Symmetric encryption for messages

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **WebSocket API**: Real-time communication
- **HTML5/CSS3**: Modern web standards
- **Service Workers**: Push notifications support
- **LocalStorage**: Client-side session management

## 📋 Prerequisites

- Python 3.13+ (or Python 3.10+)
- pip (Python package manager)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd Chat_Application
```

### 2. Create Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Initialize Database
```bash
python -c "from app.database import init_db; init_db()"
```

### 5. Run the Application
```bash
python run.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Access the Application
Open your browser and navigate to:
```
http://localhost:8000
```

## 📖 Usage

### Getting Started
1. **Register**: Create a new account with email and password
2. **Login**: Sign in with your credentials
3. **Start Chatting**: 
   - Click the 💬 icon to start a new conversation
   - Search for users by name or email
   - Click on a conversation to start chatting

### Creating Group Chats
1. Click the 👥 icon in the sidebar
2. Enter room name and description
3. Add members using the ➕ button
4. Start group messaging!

### Features Guide
- **Encryption**: All messages are encrypted by default (no action needed)
- **File Sharing**: Click 📎 to attach files or images
- **Emojis**: Click 😊 to open emoji picker
- **Message Actions**: Hover over messages to edit, delete, or reply
- **Search**: Use the search bar to find messages or contacts

## 🏗️ Project Structure

```
Chat_Application/
├── app/
│   ├── __init__.py
│   ├── auth.py              # Authentication & JWT
│   ├── database.py          # Database connection & initialization
│   ├── encryption.py        # Message encryption/decryption
│   ├── models.py            # SQLAlchemy models
│   ├── schemas.py           # Pydantic schemas
│   ├── websocket.py         # WebSocket handlers
│   └── routers/
│       ├── __init__.py
│       ├── auth.py          # Auth endpoints
│       ├── conversations.py # Conversation endpoints
│       ├── rooms.py         # Room/group endpoints
│       └── files.py         # File upload/download
├── static/
│   ├── index.html           # Frontend HTML
│   ├── style.css            # Styling
│   ├── app.js               # Frontend JavaScript
│   └── sw.js                # Service worker
├── uploads/                 # Uploaded files (created automatically)
├── main.py                  # FastAPI application entry point
├── run.py                   # Run script
├── requirements.txt         # Python dependencies
└── README.md                # This file
```

## 🔧 Configuration

### Environment Variables (Optional)
Create a `.env` file for custom configuration:
```env
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///./chat.db
ACCESS_TOKEN_EXPIRE_MINUTES=43200
```

### Database
The application uses SQLite by default. To use PostgreSQL:
1. Update `DATABASE_URL` in `.env`
2. Install PostgreSQL adapter: `pip install psycopg2-binary`
3. Update `app/database.py` connection string

## 🧪 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Conversations
- `GET /api/conversations/` - Get all conversations
- `POST /api/conversations/with/{user_id}` - Start conversation
- `GET /api/conversations/{id}/messages` - Get messages
- `GET /api/conversations/search/messages` - Search messages

### Rooms
- `GET /api/rooms/` - Get all rooms
- `POST /api/rooms/` - Create room
- `GET /api/rooms/{id}/messages` - Get room messages
- `POST /api/rooms/{id}/members` - Add member
- `DELETE /api/rooms/{id}/members/{user_id}` - Remove member

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/{file_id}` - Download file

### WebSocket
- `WS /ws/conversation/{conversation_id}` - Real-time messaging

## 🔒 Security Features

- **Password Security**: Bcrypt hashing with salt
- **Token Security**: JWT with expiration
- **Message Encryption**: AES-256 encryption for all messages
- **File Security**: Token-based file access
- **SQL Injection Protection**: SQLAlchemy ORM
- **XSS Protection**: Input sanitization

## 📱 Mobile Support

The application is fully responsive and works on:
- 📱 Mobile phones (iOS, Android)
- 📱 Tablets
- 💻 Desktop browsers
- 🖥️ Large screens

## 🚀 Deployment

### Database Configuration

The application supports both SQLite (for local development) and PostgreSQL (for production).

#### Local Development (SQLite)
By default, the app uses SQLite which stores data in `chat.db` file:
```bash
# No configuration needed - works out of the box
python run.py
```

#### Production Deployment (PostgreSQL)

For production deployments (Render, Heroku, Railway, etc.), you need to use PostgreSQL for data persistence:

1. **Create a PostgreSQL database** on your hosting platform
2. **Set the DATABASE_URL environment variable**:
   ```bash
   DATABASE_URL=postgresql://username:password@host:port/database_name
   ```

3. **On Render.com**:
   - The `render.yaml` file is already configured with a PostgreSQL database service
   - Render automatically provides the `DATABASE_URL` when you deploy
   - The database will persist data across deployments and restarts

4. **Database Migration**:
   - Tables are automatically created on first startup via `init_db()`
   - No manual migration needed - the app handles schema creation

**Important**: SQLite files are ephemeral in cloud deployments and will be lost on restarts. Always use PostgreSQL for production!

## 🚀 Performance

- **Optimistic UI Updates**: Instant message display
- **Message Pagination**: Efficient loading of message history
- **WebSocket Connection**: Low-latency real-time communication
- **Lazy Loading**: Images load on demand
- **Debounced Search**: Efficient search with 300ms debounce

## 🐛 Troubleshooting

### Database Issues
```bash
# Reset database (WARNING: Deletes all data)
python reset_db.py
```

### Port Already in Use
```bash
# Use a different port
uvicorn main:app --reload --port 8001
```

### WebSocket Connection Issues
- Check browser console for errors
- Ensure token is valid
- Verify WebSocket URL is correct

## 📝 License

This project is open source and available for educational purposes.

## 👨‍💻 Author

Built with ❤️ for portfolio demonstration

## 🙏 Acknowledgments

- Inspired by WhatsApp's user interface
- Built with FastAPI and modern web technologies
- Thanks to the open-source community

## 📈 Future Enhancements

- [ ] Video/voice calling (WebRTC)
- [ ] Push notifications (full implementation)
- [ ] Message reactions
- [ ] Voice messages
- [ ] Message forwarding
- [ ] Dark/light theme toggle
- [ ] Multi-language support

---

**Note**: This is a portfolio project demonstrating full-stack development skills. For production use, additional security measures and optimizations would be recommended.
