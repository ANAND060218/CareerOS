from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class PersonalInfo(BaseModel):
    name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    location: Optional[str] = ""
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    portfolio: Optional[str] = ""
    website: Optional[str] = ""

class ExperienceItem(BaseModel):
    id: Optional[str] = None
    company: str
    role: str
    location: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    description: Optional[List[str]] = []
    is_current: Optional[bool] = False

class ProjectItem(BaseModel):
    id: Optional[str] = None
    name: str
    technologies: Optional[List[str]] = []
    description: Optional[List[str]] = []
    link: Optional[str] = ""

class EducationItem(BaseModel):
    id: Optional[str] = None
    institution: str
    degree: str
    field_of_study: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    grade: Optional[str] = ""

class CertificationItem(BaseModel):
    id: Optional[str] = None
    name: str
    issuer: str
    date: Optional[str] = ""
    link: Optional[str] = ""

class AwardItem(BaseModel):
    id: Optional[str] = None
    title: str
    issuer: str
    date: Optional[str] = ""
    description: Optional[str] = ""

class VolunteerItem(BaseModel):
    id: Optional[str] = None
    organization: str
    role: str
    description: Optional[str] = ""

class MasterProfile(BaseModel):
    personal_info: Optional[PersonalInfo] = Field(default_factory=PersonalInfo)
    professional_summary: Optional[str] = ""
    education: Optional[List[EducationItem]] = []
    experience: Optional[List[ExperienceItem]] = []
    projects: Optional[List[ProjectItem]] = []
    skills: Optional[List[str]] = []
    certifications: Optional[List[CertificationItem]] = []
    achievements: Optional[List[str]] = []
    languages: Optional[List[str]] = []
    links: Optional[Dict[str, str]] = {}
    publications: Optional[List[str]] = []
    patents: Optional[List[str]] = []
    hackathons: Optional[List[str]] = []
    awards: Optional[List[AwardItem]] = []
    volunteer: Optional[List[VolunteerItem]] = []
    interests: Optional[List[str]] = []

class ResumeVersion(BaseModel):
    id: Optional[str] = None
    name: str
    target_role: str
    template: str = "Modern ATS"
    personal_info: Optional[PersonalInfo] = Field(default_factory=PersonalInfo)
    summary: Optional[str] = ""
    education: Optional[List[EducationItem]] = []
    experience: Optional[List[ExperienceItem]] = []
    projects: Optional[List[ProjectItem]] = []
    skills: Optional[List[str]] = []
    certifications: Optional[List[CertificationItem]] = []
    achievements: Optional[List[str]] = []
    languages: Optional[List[str]] = []
    links: Optional[Dict[str, str]] = {}
    ats_score: Optional[int] = 0
    ats_suggestions: Optional[List[str]] = []
    keyword_suggestions: Optional[List[str]] = []
    is_favorite: Optional[bool] = False
    is_archived: Optional[bool] = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
