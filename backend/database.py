import os
from typing import Any
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

# We make the client initialization resilient for Codespaces where the ENV might not be set immediately.
client = None
db = None

if MONGO_URI:
    try:
        client = AsyncIOMotorClient(MONGO_URI)
        db = client.get_default_database("jobagg")
    except Exception as e:
        print(f"Warning: Failed to connect to MongoDB: {e}")
else:
    print("Warning: MONGO_URI not found in environment variables. Database features will fail until configured.")

def get_db():
    if not db:
        raise RuntimeError("Database connection not initialized. Please set MONGO_URI in .env")
    return db
