from datetime import datetime

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from database import get_db
from dependencies import get_current_user
from models.schemas import ResumeUpload
from services.event_service import log_event
from services.resume_parser import extract_text_from_upload
from services.lemma_client import prefer_lemma_default
from services.workflow_service import run_chained_workflow

router = APIRouter()


def fix_id(doc: dict):
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


async def _get_memory(db, user_id: str) -> dict:
    memory = await db.memory.find_one({"user_id": user_id})
    return memory or {}


@router.post("/upload")
async def upload_resume(
    resume: ResumeUpload,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["user_id"]
    new_resume = {"text": resume.text, "user_id": user_id, "created_at": datetime.utcnow()}
    result = await db.resumes.insert_one(new_resume)
    await db.memory.update_one(
        {"user_id": user_id},
        {"$set": {"resume_text": resume.text, "user_id": user_id}},
        upsert=True,
    )
    await db.user_recommendations.delete_many({"user_id": user_id})
    new_resume["_id"] = result.inserted_id
    await log_event(user_id, "resume.saved", "Resume text saved to CareerOS.", agent="system")
    return fix_id(new_resume)


@router.post("/upload-file")
async def upload_resume_file(
    file: UploadFile = File(...),
    auto_workflow: bool = False,
    job_id: str | None = None,
    auto_fill_profile: bool = True,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["user_id"]
    text = await extract_text_from_upload(file)

    new_resume = {
        "text": text,
        "filename": file.filename,
        "user_id": user_id,
        "created_at": datetime.utcnow(),
    }
    result = await db.resumes.insert_one(new_resume)
    await db.memory.update_one(
        {"user_id": user_id},
        {"$set": {"resume_text": text, "user_id": user_id}},
        upsert=True,
    )
    await db.user_recommendations.delete_many({"user_id": user_id})
    await log_event(
        user_id,
        "resume.uploaded",
        f"Resume extracted from {file.filename}.",
        agent="system",
        metadata={"chars": len(text)},
    )

    # Auto-fill master profile if requested
    profile_parsed = None
    if auto_fill_profile:
        try:
            from services.lemma_client import load_lemma_config, run_agent
            from services.workflow_service import extract_json
            
            prompt = f"""
            You are a resume parser. Extract structured information from the following resume text.
            
            Resume Text:
            {text[:8000]}
            
            Return ONLY a JSON object with this exact structure:
            {{
              "personal_info": {{
                "name": "Full Name",
                "email": "email@example.com",
                "phone": "phone number",
                "location": "City, Country",
                "linkedin": "linkedin URL or empty string",
                "github": "github URL or empty string",
                "portfolio": "portfolio URL or empty string",
                "website": "website URL or empty string"
              }},
              "professional_summary": "2-3 sentence professional summary",
              "education": [
                {{
                  "institution": "University name",
                  "degree": "Degree type",
                  "field_of_study": "Field of study",
                  "start_date": "Start date",
                  "end_date": "End date",
                  "grade": "Grade/CGPA or empty string"
                }}
              ],
              "experience": [
                {{
                  "company": "Company name",
                  "role": "Job title",
                  "location": "Location",
                  "start_date": "Start date",
                  "end_date": "End date or 'Present'",
                  "description": ["bullet point 1", "bullet point 2"],
                  "is_current": false
                }}
              ],
              "projects": [
                {{
                  "name": "Project name",
                  "technologies": ["tech1", "tech2"],
                  "description": ["bullet point 1", "bullet point 2"],
                  "link": "project URL or empty string"
                }}
              ],
              "skills": ["skill1", "skill2", "skill3"],
              "certifications": [
                {{
                  "name": "Certification name",
                  "issuer": "Issuer name",
                  "date": "Date earned",
                  "link": "Certification URL or empty string"
                }}
              ]
            }}
            
            Your entire response must be valid JSON parseable by JSON.parse().
            Do NOT wrap in ```json fences. Do NOT add explanations.
            """
            
            config = load_lemma_config()
            raw = await run_agent(config, "resume-tailor", prompt, poll_seconds=180)
            parsed = extract_json(raw)
            
            if parsed and isinstance(parsed, dict):
                # Ensure all required fields exist
                if "personal_info" not in parsed:
                    parsed["personal_info"] = {}
                if "education" not in parsed:
                    parsed["education"] = []
                if "experience" not in parsed:
                    parsed["experience"] = []
                if "projects" not in parsed:
                    parsed["projects"] = []
                if "skills" not in parsed:
                    parsed["skills"] = []
                if "certifications" not in parsed:
                    parsed["certifications"] = []
                if "professional_summary" not in parsed:
                    parsed["professional_summary"] = ""
                
                # Add IDs to array items
                import time
                timestamp = time.time()
                for i, exp in enumerate(parsed.get("experience", [])):
                    if isinstance(exp, dict):
                        exp["id"] = f"exp-{timestamp}-{i}"
                        if "description" not in exp or not isinstance(exp["description"], list):
                            exp["description"] = []
                        if "is_current" not in exp:
                            exp["is_current"] = False
                
                for i, proj in enumerate(parsed.get("projects", [])):
                    if isinstance(proj, dict):
                        proj["id"] = f"proj-{timestamp}-{i}"
                        if "description" not in proj or not isinstance(proj["description"], list):
                            proj["description"] = []
                        if "technologies" not in proj or not isinstance(proj["technologies"], list):
                            proj["technologies"] = []
                
                for i, edu in enumerate(parsed.get("education", [])):
                    if isinstance(edu, dict):
                        edu["id"] = f"edu-{timestamp}-{i}"
                
                for i, cert in enumerate(parsed.get("certifications", [])):
                    if isinstance(cert, dict):
                        cert["id"] = f"cert-{timestamp}-{i}"
                
                # Update or create master profile
                existing_profile = await db.master_profiles.find_one({"user_id": user_id})
                if existing_profile:
                    # Merge with existing profile
                    await db.master_profiles.update_one(
                        {"user_id": user_id},
                        {"$set": {
                            "personal_info": {**(existing_profile.get("personal_info", {})), **parsed.get("personal_info", {})},
                            "professional_summary": parsed.get("professional_summary", existing_profile.get("professional_summary", "")),
                            "education": parsed.get("education", existing_profile.get("education", [])),
                            "experience": parsed.get("experience", existing_profile.get("experience", [])),
                            "projects": parsed.get("projects", existing_profile.get("projects", [])),
                            "skills": parsed.get("skills", existing_profile.get("skills", [])),
                            "certifications": parsed.get("certifications", existing_profile.get("certifications", [])),
                            "updated_at": datetime.utcnow()
                        }}
                    )
                else:
                    # Create new master profile
                    await db.master_profiles.insert_one({
                        "user_id": user_id,
                        **parsed,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    })
                
                profile_parsed = parsed
                await log_event(user_id, "master_profile.auto_filled", f"Master profile auto-filled from {file.filename}", agent="system")
                
        except Exception as e:
            print(f"Auto-fill profile failed: {e}")
            # Don't fail the upload if auto-fill fails

    workflow_result = None
    if auto_workflow and job_id:
        try:
            job = await db.jobs.find_one({"_id": ObjectId(job_id)})
        except Exception as exc:
            raise HTTPException(status_code=400, detail="Invalid job ID.") from exc
        if job:
            memory = await _get_memory(db, user_id)
            await log_event(user_id, "workflow.started", "Autonomous pipeline triggered.", agent="orchestrator")
            workflow_result = await run_chained_workflow(
                text,
                job.get("description", ""),
                job.get("company", ""),
                memory,
                prefer_lemma=prefer_lemma_default(),
                user_id=user_id,
            )
            if workflow_result.get("status") == "completed":
                await log_event(
                    user_id,
                    "workflow.completed",
                    workflow_result.get("message", "Workflow done."),
                    agent="orchestrator",
                    metadata={"source": workflow_result.get("source"), "job_id": job_id},
                )

    new_resume["_id"] = result.inserted_id
    response = fix_id(new_resume)
    response["extracted_chars"] = len(text)
    if profile_parsed:
        response["profile_parsed"] = True
        response["profile_data"] = profile_parsed
    if workflow_result:
        response["workflow"] = workflow_result
    return response


@router.get("/")
async def get_resumes(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.resumes.find({"user_id": current_user["user_id"]}).sort("created_at", -1)
    resumes = await cursor.to_list(length=10)
    return [fix_id(r) for r in resumes]
