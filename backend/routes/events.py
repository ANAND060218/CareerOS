from fastapi import APIRouter, Depends

from database import get_db
from dependencies import get_current_user
from models.schemas import AIMemory
from services.event_service import get_events

router = APIRouter()


@router.get("/")
async def list_events(current_user: dict = Depends(get_current_user)):
    return await get_events(current_user["user_id"], limit=50)
