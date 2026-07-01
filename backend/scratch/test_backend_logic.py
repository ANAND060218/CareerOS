import sys
import os
import asyncio

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from routes.dashboard import get_ai_insights

async def test():
    # Mock current_user
    current_user = {
        "user_id": "6a410345382256b8d318cf19",
        "email": "anandv.csbs2023@citchennai.net"
    }
    
    print("Running insights-agent directly...")
    try:
        from services.lemma_client import load_lemma_config, run_agent
        import json
        
        # Prepare inputs
        from database import get_db
        db = get_db()
        applications_data = []
        cursor = db.applications.find({"user_id": current_user["user_id"]}).sort("created_at", -1).limit(10)
        async for app in cursor:
            from bson.objectid import ObjectId
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
                "description": job_desc[:1500]
            })
            
        profile = await db.master_profiles.find_one({"user_id": current_user["user_id"]})
        profile_skills = profile.get("skills", []) if profile else []
        profile_summary = profile.get("professional_summary", "") if profile else ""
        
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
        lemma_config = load_lemma_config()
        raw = await run_agent(lemma_config, "insights-agent", prompt, poll_seconds=360)
        print("RAW RESPONSE FROM AGENT:")
        print(repr(raw))
        
        from services.workflow_service import extract_json
        parsed = extract_json(raw)
        print("PARSED JSON:")
        print(json.dumps(parsed, indent=2))
        
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test())
