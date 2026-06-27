import os
from typing import Any
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = AsyncIOMotorClient(MONGO_URI) if MONGO_URI else None

# The URI has the db name in it, but motor doesn't automatically select it from URI easily if we want to be explicit.
# We fall back to a lightweight in-memory placeholder so the app can still boot in cloud/demo environments.
db: Any = None

if client:
    db = client.get_default_database("jobagg")


def get_db():
    if db is None:
        raise RuntimeError("MONGO_URI is not configured. Set it to use database-backed endpoints.")
    return db
