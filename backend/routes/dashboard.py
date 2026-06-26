from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from services import recommendation_service, analytics_service
from models.schemas import RecommendationResponse

router = APIRouter()

class RecommendRequest(BaseModel):
    limit: int = 15

@router.post("/recommendations", response_model=List[RecommendationResponse])
async def get_recommendations(request: RecommendRequest):
    return await recommendation_service.generate_daily_recommendations(request.limit)

@router.get("/analytics")
async def get_analytics():
    return await analytics_service.get_dashboard_analytics()
