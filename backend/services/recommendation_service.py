from database import get_db
from bson.objectid import ObjectId
import json
from services.ai_service import AIService

USER_ID = "demo_user"

async def generate_daily_recommendations(limit: int = 15):
    """
    Simulates a recommendation engine that reads jobs, matches with the user's AI Memory,
    and returns top ranked jobs with reasoning.
    """
    db = get_db()
    
    # Fetch AI Memory
    memory_doc = await db.memory.find_one({"user_id": USER_ID})
    if not memory_doc:
        memory_doc = {}
        
    resume_text = memory_doc.get("resume_text", "No resume provided.")
    preferred_roles = memory_doc.get("preferred_roles", [])
    skills = memory_doc.get("skills", [])
    
    # Fetch recent jobs
    cursor = db.jobs.find().sort("date_posted", -1).limit(50)
    jobs = await cursor.to_list(length=50)
    
    if not jobs:
        return []

    jobs_summary = []
    for j in jobs:
        title = j.get("title", "")
        company = j.get("company", "")
        desc = j.get("description", "")[:200]
        tech = j.get("technologies", [])
        jobs_summary.append({
            "id": str(j["_id"]),
            "title": title,
            "company": company,
            "snippet": desc,
            "technologies": tech
        })
        
    prompt = f"""
    You are an AI Opportunity Scout.
    Rank the following jobs for a candidate with this profile:
    
    Resume:
    {resume_text}
    
    Preferred Roles: {preferred_roles}
    User Skills: {skills}
    
    Rank the top {limit} jobs and explain why each is a fit.
    Return ONLY a JSON array with this exact structure:
    [
      {{
        "job_id": "...", 
        "match_score": 95, 
        "reason": "Strong Python backend alignment, high hiring rate.",
        "missing_skills": ["Docker", "Redis"],
        "matched_skills": ["Python", "FastAPI"]
      }},
      ...
    ]
    
    Jobs (JSON):
    {json.dumps(jobs_summary)}
    """
    
    result = await AIService.generate(prompt)
    
    recommendations = []
    if isinstance(result, list):
        for rec in result[:limit]:
            job_id = rec.get("job_id")
            job_details = next((j for j in jobs if str(j["_id"]) == job_id), None)
            if job_details:
                job_details["id"] = str(job_details["_id"])
                del job_details["_id"]
                recommendations.append({
                    "job_id": job_id,
                    "match_score": rec.get("match_score", 0),
                    "reason": rec.get("reason", "Good match."),
                    "missing_skills": rec.get("missing_skills", []),
                    "matched_skills": rec.get("matched_skills", []),
                    "job_details": job_details
                })
                
    return recommendations
