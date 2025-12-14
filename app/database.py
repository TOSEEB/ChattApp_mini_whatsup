"""
Database configuration and session management
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL - SQLite for simplicity, can be easily changed to PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chat.db")

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """
    Dependency function to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database tables - creates tables if they don't exist
    Users and data will persist across server restarts
    """
    # Create all tables if they don't exist (doesn't drop existing data)
    Base.metadata.create_all(bind=engine)
    
    # Run migrations to add new columns if needed
    try:
        from migrate_db import migrate_database
        migrate_database()
    except Exception as e:
        print(f"Migration check failed (this is OK if tables don't exist yet): {e}")
    
    print("Database tables initialized (existing data preserved)")

