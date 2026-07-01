from datetime import datetime
from typing import Any

from database import get_db


async def log_event(
    user_id: str,
    event_type: str,
    message: str,
    *,
    agent: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict:
    db = get_db()
    doc = {
        "user_id": user_id,
        "event_type": event_type,
        "message": message,
        "agent": agent,
        "metadata": metadata or {},
        "created_at": datetime.utcnow(),
    }
    result = await db.workflow_events.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


async def get_events(user_id: str, limit: int = 50) -> list[dict]:
    db = get_db()
    cursor = db.workflow_events.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    events = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        if hasattr(doc.get("created_at"), "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        events.append(doc)
    return events
