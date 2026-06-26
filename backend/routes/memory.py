from fastapi import APIRouter
from models.schemas import AIMemory
from database import get_db

router = APIRouter()

# For hackathon MVP, we assume a single user with ID 'demo_user'
USER_ID = "demo_user"

@router.get("/", response_model=AIMemory)
async def get_memory():
    db = get_db()
    memory = await db.memory.find_one({"user_id": USER_ID})
    if memory:
        del memory["_id"]
        return AIMemory(**memory)
    return AIMemory()

@router.post("/")
async def update_memory(memory: AIMemory):
    db = get_db()
    memory_dict = memory.dict()
    memory_dict["user_id"] = USER_ID
    await db.memory.update_one(
        {"user_id": USER_ID},
        {"$set": memory_dict},
        upsert=True
    )
    return {"message": "Memory updated successfully"}
