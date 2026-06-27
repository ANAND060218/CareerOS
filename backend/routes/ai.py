import os
import json
import httpx
from fastapi import APIRouter
from models.schemas import AIMatchRequest, AIMatchResponse, AIResumeOptimizeRequest, AIInterviewQuestionsRequest
from services import ai_service

router = APIRouter()

async def call_lemma_workflow(resume_text: str, job_description: str, company: str):
    lemma_api = os.getenv("LEMMA_API_URL", "http://127.0.0.1:8711")
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{lemma_api}/api/v1/workflows/run",
                json={
                    "resume_text": resume_text,
                    "job_description": job_description,
                    "company": company,
                },
            )
            if response.status_code < 400:
                return response.json()
    except Exception as exc:
        print(f"Lemma workflow call failed: {exc}")
    return None

@router.post("/workflow")
async def run_workflow(payload: dict):
    resume_text = payload.get("resume_text", "")
    job_description = payload.get("job_description", "")
    company = payload.get("company", "")

    if not resume_text or not job_description:
        return {
            "status": "error",
            "message": "Resume and job description are required.",
            "agents": []
        }

    lemma_result = await call_lemma_workflow(resume_text, job_description, company)
    if lemma_result:
        return {
            "status": "completed",
            "message": "Workflow executed through the local Lemma runtime.",
            **lemma_result,
        }

    match_result = await ai_service.calculate_match(job_description, resume_text)
    optimize_result = await ai_service.optimize_resume(resume_text, job_description)
    interview_result = await ai_service.generate_interview_questions(job_description, company)

    return {
        "status": "completed",
        "message": "Workflow completed with local backend analysis because Lemma runtime was not available.",
        "agents": [
            {
                "name": "Resume Matcher",
                "status": "completed",
                "summary": f"Matched resume against the target role with a score of {match_result.get('match_score', 0)}%."
            },
            {
                "name": "Resume Optimizer",
                "status": "completed",
                "summary": "Generated an ATS-focused resume rewrite and keyword suggestions."
            },
            {
                "name": "Interview Coach",
                "status": "completed",
                "summary": f"Prepared {len(interview_result.get('technical_questions', []))} technical and {len(interview_result.get('behavioral_questions', []))} behavioral questions."
            }
        ],
        "match_result": match_result,
        "optimize_result": optimize_result,
        "interview_result": interview_result
    }

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
