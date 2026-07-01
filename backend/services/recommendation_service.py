import json
import time

from database import get_db
from services.ai_service import AIService
from services.lemma_client import load_lemma_config, prefer_lemma_default, run_agent
from services.workflow_service import extract_json


async def _run_opportunity_scout(prompt: str, user_id: str) -> list | None:
    if not prefer_lemma_default():
        return None
    try:
        config = load_lemma_config()
        raw = await run_agent(config, "opportunity-intelligence", prompt, poll_seconds=240)
        parsed = extract_json(raw)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and isinstance(parsed.get("recommendations"), list):
            return parsed["recommendations"]
    except Exception as exc:
        print(f"opportunity-intelligence Lemma failed: {exc}")
    return None


async def generate_daily_recommendations(limit: int = 15, user_id: str | None = None):
    db = get_db()
    if not user_id:
        return []

    # Check cache (1 hour duration)
    cache_doc = await db.user_recommendations.find_one({"user_id": user_id})
    if cache_doc and time.time() - cache_doc.get("timestamp", 0) < 3600:
        print(f"[CACHE] Returning cached recommendations for user {user_id}")
        return cache_doc.get("recommendations", [])

    memory_doc = await db.memory.find_one({"user_id": user_id}) or {}
    resume_text = memory_doc.get("resume_text", "").strip()
    if not resume_text:
        return []

    preferred_roles = memory_doc.get("preferred_roles", [])
    skills = memory_doc.get("skills", [])

    cursor = db.jobs.find().sort("date_posted", -1).limit(50)
    jobs = await cursor.to_list(length=50)
    if not jobs:
        return []

    jobs_summary = []
    for job in jobs:
        jobs_summary.append({
            "id": str(job["_id"]),
            "title": job.get("title", ""),
            "company": job.get("company", ""),
            "snippet": (job.get("description", "") or "")[:200],
            "technologies": job.get("technologies", []),
        })

    prompt = f"""
You are opportunity-intelligence. Rank jobs for this candidate using their AI memory.

Resume:
{resume_text[:4000]}

Preferred Roles: {preferred_roles}
User Skills: {skills}
Career Goals: {memory_doc.get("career_goals", "")}

Rank the top {limit} jobs from the list below.
Return ONLY a JSON array:
[
  {{
    "job_id": "...",
    "match_score": 95,
    "reason": "Strong alignment because...",
    "missing_skills": ["Docker"],
    "matched_skills": ["Python", "FastAPI"]
  }}
]

Jobs:
{json.dumps(jobs_summary)}
"""

    result = await _run_opportunity_scout(prompt, user_id)
    source = "lemma"
    if result is None:
        return []


    recommendations = []
    if not isinstance(result, list):
        return []

    for rec in result[:limit]:
        job_id = rec.get("job_id")
        if not job_id:
            continue
        job_details = next((j for j in jobs if str(j["_id"]) == job_id), None)
        if not job_details:
            continue
        job_details = job_details.copy()
        job_details["id"] = str(job_details["_id"])
        del job_details["_id"]
        if "date_posted" in job_details and hasattr(job_details["date_posted"], "isoformat"):
            job_details["date_posted"] = job_details["date_posted"].isoformat()
        recommendations.append({
            "job_id": job_id,
            "match_score": int(rec.get("match_score", 0)),
            "reason": rec.get("reason", "Good match."),
            "missing_skills": rec.get("missing_skills", []),
            "matched_skills": rec.get("matched_skills", []),
            "job_details": job_details,
            "source": source,
        })

    if recommendations:
        await db.user_recommendations.update_one(
            {"user_id": user_id},
            {"$set": {"recommendations": recommendations, "timestamp": time.time()}},
            upsert=True
        )

    return recommendations
