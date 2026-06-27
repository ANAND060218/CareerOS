from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class Job(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[Any] = None
    experience: Optional[str] = None
    description: Optional[str] = None
    logo: Optional[str] = None
    date_posted: Optional[str] = None
    apply_link: Optional[str] = None
    technologies: Optional[List[str]] = None

    class Config:
        extra = "allow"

class ResumeUpload(BaseModel):
    text: str

class ApplicationCreate(BaseModel):
    job_id: str
    status: str = "pending"

class ApplicationResponse(BaseModel):
    id: Optional[str] = None
    job_id: str
    status: str
    created_at: Optional[datetime] = None
    job_details: Optional[Job] = None

class AIMatchRequest(BaseModel):
    job_description: str
    resume_text: str

class AIMatchResponse(BaseModel):
    match_score: int
    missing_skills: List[str] = []
    strengths: List[str] = []
    weaknesses: List[str] = []
    reasoning: str = ""

class AIResumeOptimizeRequest(BaseModel):
    resume_text: str
    target_job_description: Optional[str] = None

class AIInterviewQuestionsRequest(BaseModel):
    job_description: str
    company: Optional[str] = None

class RecommendationResponse(BaseModel):
    job_id: str
    match_score: int
    reason: str
    missing_skills: List[str] = []
    matched_skills: List[str] = []
    job_details: Job

class AIMemory(BaseModel):
    preferred_roles: List[str] = []
    preferred_locations: List[str] = []
    ignored_companies: List[str] = []
    applied_companies: List[str] = []
    skills: List[str] = []
    career_goals: str = ""
    resume_text: str = ""
