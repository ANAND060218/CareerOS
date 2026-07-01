from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from dependencies import get_current_user
from services import recommendation_service, analytics_service
from models.schemas import RecommendationResponse

router = APIRouter()

class RecommendRequest(BaseModel):
    limit: int = 15

@router.post("/recommendations", response_model=List[RecommendationResponse])
async def get_recommendations(
    request: RecommendRequest,
    current_user: dict = Depends(get_current_user),
):
    return await recommendation_service.generate_daily_recommendations(
        request.limit,
        user_id=current_user["user_id"],
    )

@router.get("/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    return await analytics_service.get_dashboard_analytics(user_id=current_user["user_id"])


@router.get("/ai-insights")
async def get_ai_insights(current_user: dict = Depends(get_current_user)):
    from database import get_db
    from services.lemma_client import load_lemma_config, run_agent
    from services.workflow_service import extract_json
    from bson.objectid import ObjectId
    import json
    
    db = get_db()
    user_id = current_user["user_id"]
    
    applications_data = []
    profile_skills = []
    profile_summary = ""
    
    try:
        # 1. Fetch user applications (limit to 10 most recent)
        cursor = db.applications.find({"user_id": user_id}).sort("created_at", -1).limit(10)
        async for app in cursor:
            job_desc = ""
            try:
                job = await db.jobs.find_one({"_id": ObjectId(app["job_id"])})
                if job:
                    job_desc = job.get("description", "")
            except Exception:
                pass
            applications_data.append({
                "job_id": str(app["job_id"]),
                "title": app.get("title", "Untitled Role"),
                "company": app.get("company", "Unknown Company"),
                "status": app.get("status", "Saved"),
                "description": job_desc[:1500]  # Truncated to avoid large prompt sizes
            })
            
        # 2. Fetch master profile
        profile = await db.master_profiles.find_one({"user_id": user_id})
        if profile:
            profile_skills = profile.get("skills", [])
            profile_summary = profile.get("professional_summary", "")
    except Exception as e:
        print(f"Error querying db for insights: {e}")
    
    # 3. Handle default case with no applications and empty profile
    if not applications_data and not profile_skills and not profile_summary:
        return {
            "insights": [
                {
                    "id": "insight-default-1",
                    "job_id": "general",
                    "company": "CareerOS",
                    "title": "Build Master Profile",
                    "status": "General",
                    "insight": "Customize your resume in the Resume Hub to begin tailoring matching suggestions against saved roles.",
                    "action_type": "general",
                    "action_label": "Go to Resume Hub",
                    "action_url": "/resume"
                }
            ]
        }
        
    # 4. Construct Prompt for the Lemma Agent
    prompt = f"""
You are the Career-OS Insights Agent. Analyze the candidate's profile details and their job applications status to generate custom, actionable career suggestions.

Candidate's Profile Skills: {profile_skills}
Candidate's Professional Summary: {profile_summary}

Candidate's Job Applications:
{json.dumps(applications_data, indent=2)}

Generate a JSON object with an "insights" key containing a list of exactly 3-4 distinct, specific insights based on application status.
Each insight object in the list MUST have these fields:
- "id": A unique string ID (e.g., "insight-1").
- "job_id": The string job_id associated (or "general").
- "company": The company name (or "CareerOS").
- "title": The job title (or "General").
- "status": The status of the application (e.g., "Saved", "Applied", "Interviewing", or "General").
- "insight": A highly personalized 1-2 sentence recommendation. 
  * For "Saved" status: encourage them to apply and state how their skills match.
  * For "Applied" status: suggest 2 specific skills or topics they should study/brush up on (based on comparison between job description requirements and their profile skills).
  * For "Interviewing" (or "Interview") status: suggest interview preparation tips.
- "action_type": One of: "apply" (for saved/workflow jobs), "learn" (for applied jobs where they should learn skills), "prepare" (for interviewing), "general" (for starting out).
- "action_label": A short button text (e.g., "Launch Workflow", "Review Skills", "Prepare for Interview", "Go to Resume Hub").
- "action_url": The client-side route to redirect to. For jobs, use `/jobs/{{job_id}}`. For general/resume, use `/resume`.

Return ONLY a valid JSON object matching this structure. Do not output any markdown formatting like ```json.
"""

    # Call Lemma insights-agent directly
    print(f"[INSIGHTS] Starting insights generation for user {user_id}")
    print(f"[INSIGHTS] Applications count: {len(applications_data)}, Skills count: {len(profile_skills)}")
    try:
        lemma_config = load_lemma_config()
        print(f"[INSIGHTS] Lemma config loaded: base_url={lemma_config.base_url}, pod_id={lemma_config.pod_id}")
        print(f"[INSIGHTS] Calling insights-agent via run_agent()...")
        raw = await run_agent(lemma_config, "insights-agent", prompt, poll_seconds=360)
        print(f"[INSIGHTS] Raw response type: {type(raw)}, length: {len(str(raw)) if raw else 0}")
        print(f"[INSIGHTS] Raw response preview: {str(raw)[:300]}")
        response = extract_json(raw)
        print(f"[INSIGHTS] Parsed response type: {type(response)}, keys: {list(response.keys()) if isinstance(response, dict) else 'not-dict'}")
        if response and isinstance(response, dict) and "insights" in response:
            print(f"[INSIGHTS] SUCCESS - returning {len(response['insights'])} insights from Lemma agent")
            return response
        else:
            print(f"[INSIGHTS] Parsed response missing 'insights' key, falling through to fallback")
    except Exception as exc:
        import traceback
        print(f"[INSIGHTS] EXCEPTION: {exc}")
        traceback.print_exc()
        
    # Fallback default insights in case of Lemma limits/errors
    fallback_insights = [
        {
            "id": "insight-fallback-1",
            "job_id": "general",
            "company": "CareerOS",
            "title": "Resume Customization",
            "status": "General",
            "insight": "Customize your resume in the Resume Hub to begin tailoring matching suggestions against saved roles.",
            "action_type": "general",
            "action_label": "Go to Resume Hub",
            "action_url": "/resume"
        }
    ]
    
    # Generate mock insights from actual data if available
    for app in applications_data[:3]:
        if app["status"] == "Saved":
            fallback_insights.append({
                "id": f"insight-mock-{app['job_id']}",
                "job_id": app["job_id"],
                "company": app["company"],
                "title": app["title"],
                "status": "Saved",
                "insight": f"You saved a matching role for {app['title']} at {app['company']}. Go launch the workflow to optimize your profile and apply!",
                "action_type": "apply",
                "action_label": "Launch Workflow",
                "action_url": f"/jobs/{app['job_id']}"
            })
        elif app["status"] == "Applied":
            fallback_insights.append({
                "id": f"insight-mock-{app['job_id']}",
                "job_id": app["job_id"],
                "company": app["company"],
                "title": app["title"],
                "status": "Applied",
                "insight": f"Since you applied for {app['title']} at {app['company']}, make sure to review relevant skills to prepare for potential call-backs.",
                "action_type": "learn",
                "action_label": "Review Skills",
                "action_url": f"/jobs/{app['job_id']}"
            })
            
    return {"insights": fallback_insights}
