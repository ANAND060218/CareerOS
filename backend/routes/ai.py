from fastapi import APIRouter
from models.schemas import AIMatchRequest, AIMatchResponse, AIResumeOptimizeRequest, AIInterviewQuestionsRequest
from services import ai_service

router = APIRouter()

@router.post("/match", response_model=AIMatchResponse)
async def match_resume_to_job(request: AIMatchRequest):
    result = await ai_service.calculate_match(request.job_description, request.resume_text)
    return result

@router.post("/resume/optimize")
async def optimize_resume(request: AIResumeOptimizeRequest):
    result = await ai_service.optimize_resume(request.resume_text, request.target_job_description)
    return result

@router.post("/interview/questions")
async def generate_interview_questions(request: AIInterviewQuestionsRequest):
    result = await ai_service.generate_interview_questions(request.job_description, request.company)
    return result
