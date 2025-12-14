"""
Database configuration and session management
Supports both SQLite (for local development) and PostgreSQL (for production)
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from urllib.parse import urlparse

# Database URL - Supports both SQLite and PostgreSQL
# For production (Render, Heroku, etc.), set DATABASE_URL environment variable
# Example PostgreSQL: postgresql://user:password@host:port/dbname
# Example SQLite: sqlite:///./chat.db
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chat.db")

# Parse database URL to determine type
parsed_url = urlparse(DATABASE_URL)
is_sqlite = parsed_url.scheme == "sqlite" or "sqlite" in DATABASE_URL.lower()

# Create engine with appropriate configuration
if is_sqlite:
    # SQLite configuration (for local development)
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        echo=False
    )
else:
    # PostgreSQL configuration (for production)
    # Use connection pooling for better performance
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Verify connections before using them
        echo=False
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

