"""
Main FastAPI application entry point
"""
from fastapi import FastAPI, WebSocket, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from app.database import init_db
from app.routers import auth, conversations, rooms, files
from app.websocket import websocket_endpoint

# Initialize FastAPI app
app = FastAPI(
    title="WhatsApp-like Chat Application",
    description="A WhatsApp-like chat application with real-time messaging",
    version="2.0.0"
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
@app.on_event("startup")
async def startup_event():
    init_db()
    print("Database initialized")

# Include routers
app.include_router(auth.router)
app.include_router(conversations.router)
app.include_router(rooms.router)
app.include_router(files.router)

# WebSocket endpoint for conversations
@app.websocket("/ws/conversation/{conversation_id}")
async def websocket_route(websocket: WebSocket, conversation_id: int, token: str = Query(...)):
    """WebSocket route for real-time chat in conversations"""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        await websocket_endpoint(websocket, conversation_id, token, db)
    finally:
        db.close()

# Serve static files (frontend)
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Root endpoint - serve frontend
@app.get("/")
async def read_root():
    """Serve the main chat interface"""
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Chat API is running. Frontend not found. Visit /docs for API documentation."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

