from pydantic import BaseModel, Field, EmailStr
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

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)
    role: Optional[str] = "Software Engineer"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: str = "Software Engineer"

class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    career_goals: Optional[str] = None
    preferred_roles: Optional[List[str]] = None
    preferred_locations: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    dream_companies: Optional[List[str]] = None
    salary_expectation: Optional[str] = None

class ResumeUpload(BaseModel):
    text: str

class ApplicationCreate(BaseModel):
    job_id: str
    status: str = "Saved"
    title: Optional[str] = None
    company: Optional[str] = None

class ApplicationResponse(BaseModel):
    id: Optional[str] = None
    job_id: str
    status: str
    title: Optional[str] = None
    company: Optional[str] = None
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
    source: Optional[str] = None

class AIMemory(BaseModel):
    preferred_roles: List[str] = []
    preferred_locations: List[str] = []
    ignored_companies: List[str] = []
    applied_companies: List[str] = []
    rejected_companies: List[str] = []
    skills: List[str] = []
    skills_improving: List[str] = []
    preferred_tech_stack: List[str] = []
    dream_companies: List[str] = []
    past_interviews: List[str] = []
    weak_interview_topics: List[str] = []
    salary_expectation: str = ""
    career_goals: str = ""
    resume_text: str = ""

class WorkflowEvent(BaseModel):
    event_type: str
    message: str
    agent: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
