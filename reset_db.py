"""
Script to reset the database - WARNING: This will DELETE ALL DATA including users, messages, etc.
Only run this when you need to completely reset the database schema.
For normal operation, the database will preserve all data across server restarts.
"""
import os
from app.database import Base, engine

# Drop all tables
print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)

# Create all tables
print("Creating all tables...")
Base.metadata.create_all(bind=engine)

print("Database reset complete!")

