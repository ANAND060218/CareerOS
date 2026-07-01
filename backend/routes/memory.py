from fastapi import APIRouter, Depends

from database import get_db
from dependencies import get_current_user, get_optional_user
from models.schemas import AIMemory

router = APIRouter()


@router.get("/", response_model=AIMemory)
async def get_memory(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    memory = await db.memory.find_one({"user_id": user_id})
    if memory:
        memory.pop("_id", None)
        memory.pop("user_id", None)
        return AIMemory(**memory)
    return AIMemory()


@router.post("/")
async def update_memory(
    memory: AIMemory,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["user_id"]
    memory_dict = memory.model_dump(exclude_unset=True)
    memory_dict["user_id"] = user_id
    await db.memory.update_one(
        {"user_id": user_id},
        {"$set": memory_dict},
        upsert=True,
    )
    return {"message": "Memory updated successfully"}


@router.patch("/")
async def patch_memory(
    updates: dict,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["user_id"]
    updates.pop("user_id", None)
    updates.pop("_id", None)
    await db.memory.update_one(
        {"user_id": user_id},
        {"$set": updates},
        upsert=True,
    )
    return {"message": "Memory patched successfully"}
