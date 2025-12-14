"""
Migration script to add new columns to existing database
This adds: is_edited, is_deleted, reply_to_id, updated_at to messages table
"""
import sqlite3
import os
from app.database import DATABASE_URL

def migrate_database():
    """Add new columns to messages table if they don't exist"""
    # Extract database path from SQLite URL
    db_path = DATABASE_URL.replace("sqlite:///", "")
    
    if not os.path.exists(db_path):
        print(f"Database {db_path} does not exist. Creating new database...")
        from app.database import init_db
        init_db()
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if columns exist
        cursor.execute("PRAGMA table_info(messages)")
        columns = [row[1] for row in cursor.fetchall()]
        
        migrations = []
        
        if 'is_edited' not in columns:
            migrations.append("ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT 0 NOT NULL")
        
        if 'is_deleted' not in columns:
            migrations.append("ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT 0 NOT NULL")
        
        if 'reply_to_id' not in columns:
            migrations.append("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER")
        
        if 'updated_at' not in columns:
            migrations.append("ALTER TABLE messages ADD COLUMN updated_at DATETIME")
        
        if migrations:
            print(f"Applying {len(migrations)} migration(s)...")
            for migration in migrations:
                print(f"  - {migration}")
                cursor.execute(migration)
            conn.commit()
            print("Migration completed successfully!")
        else:
            print("Database is already up to date. No migrations needed.")
    
    except Exception as e:
        print(f"Error during migration: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()

