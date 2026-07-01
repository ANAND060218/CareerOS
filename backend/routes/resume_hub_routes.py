from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from bson.objectid import ObjectId
from datetime import datetime
import json
import os

from database import get_db
from dependencies import get_current_user
from models.resume_hub import MasterProfile, ResumeVersion
from services.event_service import log_event
from services.resume_parser import extract_text_from_upload

router = APIRouter()

def fix_id(doc: dict):
    if not doc:
        return doc
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

# ================= Master Profile API =================

@router.post("/master-profile/upload-resume")
async def upload_and_parse_resume(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload a resume file and parse it to auto-fill master profile using AI."""
    db = get_db()
    user_id = current_user["user_id"]
    
    try:
        # Extract text from uploaded file
        print(f"[RESUME UPLOAD] Starting upload for file: {file.filename}")
        resume_text = await extract_text_from_upload(file)
        print(f"[RESUME UPLOAD] Extracted {len(resume_text)} characters from file")
        
        # Use resume-tailor Lemma agent for parsing
        prompt = f"""
        You are a resume parser. Extract structured information from the following resume text.
        
        Resume Text:
        {resume_text[:8000]}
        
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
        
        from services.lemma_client import load_lemma_config, run_agent
        from services.workflow_service import extract_json
        config = load_lemma_config()
        print(f"[RESUME UPLOAD] Using resume-tailor Lemma agent...")
        raw = await run_agent(config, "resume-tailor", prompt, poll_seconds=180)
        print(f"[RESUME UPLOAD] Lemma raw response length: {len(str(raw))}")
        parsed = extract_json(raw)
        print(f"[RESUME UPLOAD] Parsed result type: {type(parsed)}, keys: {parsed.keys() if isinstance(parsed, dict) else 'N/A'}")
        
        if not parsed or not isinstance(parsed, dict):
            print(f"[RESUME UPLOAD] Lemma parsing failed, returning empty structure")
            parsed = {
                "personal_info": {},
                "professional_summary": "",
                "education": [],
                "experience": [],
                "projects": [],
                "skills": [],
                "certifications": []
            }
        
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
        
        await log_event(user_id, "master_profile.resume_uploaded", f"Resume uploaded and parsed: {file.filename}", agent="system")
        
        return parsed
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Resume upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process resume: {str(e)}")

@router.get("/master-profile")
async def get_master_profile(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    profile = await db.master_profiles.find_one({"user_id": user_id})
    if not profile:
        # Return default empty profile
        return {
            "personal_info": {"name": current_user.get("name", ""), "email": current_user.get("email", "")},
            "professional_summary": "",
            "education": [],
            "experience": [],
            "projects": [],
            "skills": [],
            "certifications": [],
            "achievements": [],
            "languages": [],
            "links": {},
            "publications": [],
            "patents": [],
            "hackathons": [],
            "awards": [],
            "volunteer": [],
            "interests": []
        }
    return fix_id(profile)

@router.put("/master-profile")
async def update_master_profile(profile_data: MasterProfile, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    doc = profile_data.dict()
    doc["user_id"] = user_id
    doc["updated_at"] = datetime.utcnow()
    
    await db.master_profiles.update_one(
        {"user_id": user_id},
        {"$set": doc},
        upsert=True
    )
    
    # Sync with memory for other agents to see
    skills = profile_data.skills or []
    personal = profile_data.personal_info
    resume_lines = []
    if personal:
        resume_lines.append(f"{personal.name or ''} | {personal.email or ''} | {personal.phone or ''}")
    if profile_data.professional_summary:
        resume_lines.append(f"SUMMARY\n{profile_data.professional_summary}")
    if profile_data.experience:
        resume_lines.append("EXPERIENCE")
        for exp in profile_data.experience:
            desc_str = "\n".join([f"- {d}" for d in (exp.description or [])])
            resume_lines.append(f"{exp.role} at {exp.company} ({exp.start_date or ''} - {exp.end_date or ''})\n{desc_str}")
    if profile_data.projects:
        resume_lines.append("PROJECTS")
        for proj in profile_data.projects:
            desc_str = "\n".join([f"- {d}" for d in (proj.description or [])])
            resume_lines.append(f"{proj.name} ({', '.join(proj.technologies or [])})\n{desc_str}")
            
    resume_text = "\n\n".join(resume_lines)
    await db.memory.update_one(
        {"user_id": user_id},
        {"$set": {
            "resume_text": resume_text,
            "skills": skills
        }},
        upsert=True
    )
    
    await log_event(user_id, "master_profile.updated", "Master Profile updated and synced to memory.", agent="system")
    return {"message": "Master Profile updated successfully"}

# ================= Resume Versions API =================

@router.get("/versions")
async def get_versions(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    cursor = db.resume_versions.find({"user_id": user_id, "is_archived": {"$ne": True}}).sort("updated_at", -1)
    versions = await cursor.to_list(length=100)
    return [fix_id(v) for v in versions]

@router.post("/versions")
async def create_version(payload: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    name = payload.get("name", "Untitled Resume")
    target_role = payload.get("target_role", "Software Engineer")
    template = payload.get("template", "Modern ATS")
    
    # Load Master Profile to inherit from if possible
    master = await db.master_profiles.find_one({"user_id": user_id}) or {}
    
    new_version = {
        "user_id": user_id,
        "name": name,
        "target_role": target_role,
        "template": template,
        "personal_info": master.get("personal_info", {"name": current_user.get("name", ""), "email": current_user.get("email", "")}),
        "summary": master.get("professional_summary", ""),
        "education": master.get("education", []),
        "experience": master.get("experience", []),
        "projects": master.get("projects", []),
        "skills": master.get("skills", []),
        "certifications": master.get("certifications", []),
        "achievements": master.get("achievements", []),
        "languages": master.get("languages", []),
        "links": master.get("links", {}),
        "ats_score": 0,
        "ats_suggestions": [],
        "keyword_suggestions": [],
        "is_favorite": False,
        "is_archived": False,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await db.resume_versions.insert_one(new_version)
    new_version["_id"] = result.inserted_id
    
    await log_event(user_id, "resume_version.created", f"Created resume version: {name}.", agent="system")
    return fix_id(new_version)

@router.get("/versions/{id}")
async def get_version_by_id(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    try:
        version = await db.resume_versions.find_one({"_id": ObjectId(id), "user_id": user_id})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid version ID")
        
    if not version:
        raise HTTPException(status_code=404, detail="Resume version not found")
        
    return fix_id(version)

@router.put("/versions/{id}")
async def update_version(id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    # Strip ID if present in payload
    payload.pop("id", None)
    payload.pop("_id", None)
    payload.pop("user_id", None)
    
    payload["updated_at"] = datetime.utcnow()
    
    try:
        result = await db.resume_versions.update_one(
            {"_id": ObjectId(id), "user_id": user_id},
            {"$set": payload}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid version ID")
        
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resume version not found")
        
    return {"message": "Version updated successfully"}

@router.delete("/versions/{id}")
async def delete_version(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    try:
        result = await db.resume_versions.delete_one({"_id": ObjectId(id), "user_id": user_id})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid version ID")
        
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Resume version not found")
        
    await log_event(user_id, "resume_version.deleted", "Deleted resume version.", agent="system")
    return {"message": "Version deleted successfully"}

@router.post("/versions/{id}/duplicate")
async def duplicate_version(id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    try:
        original = await db.resume_versions.find_one({"_id": ObjectId(id), "user_id": user_id})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid version ID")
        
    if not original:
        raise HTTPException(status_code=404, detail="Resume version not found")
        
    new_doc = dict(original)
    del new_doc["_id"]
    new_doc["name"] = f"Copy of {original.get('name', 'Untitled')}"
    new_doc["is_favorite"] = False
    new_doc["created_at"] = datetime.utcnow()
    new_doc["updated_at"] = datetime.utcnow()
    
    result = await db.resume_versions.insert_one(new_doc)
    new_doc["_id"] = result.inserted_id
    
    await log_event(user_id, "resume_version.duplicated", f"Cloned resume: {new_doc['name']}", agent="system")
    return fix_id(new_doc)

# ================= AI Generation & Assistant APIs =================

@router.post("/ai/generate")
async def ai_generate_version(payload: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    target_role = payload.get("target_role", "Software Engineer")
    job_description = payload.get("job_description", "")
    
    # Load Master Profile
    master = await db.master_profiles.find_one({"user_id": user_id})
    if not master:
        raise HTTPException(status_code=400, detail="Please create your Master Profile first.")
        
    prompt = f"""
    You are a professional resume tailor agent named resume-tailor.
    Your job is to read the candidate's Master Profile and customize it to target the role of: {target_role}.
    
    Target Job Description:
    {job_description or 'Align with industry standard responsibilities and core skills for ' + target_role}
    
    Candidate Master Profile Data:
    {json.dumps(master, default=str)}
    
    You MUST select the most relevant education, experience, projects, skills, certifications, and achievements.
    For selected experiences and projects:
      - Rewrite the bullet point descriptions to highlight technologies, tools, and methodologies relevant to this target role.
      - Add quantitative outcomes where possible.
      - Keep them factual based on the profile, do not invent new jobs.
    For skills:
      - Curate a highly focused list of technologies from the Master Profile matching this role.
    For summary:
      - Write a tailored professional summary for the target role (2-3 sentences max).
      
    CRITICAL INSTRUCTIONS:
    - Return ONLY a single valid JSON object. No other text.
    - Do NOT use markdown code blocks (```json).
    - Do NOT add any explanations before or after the JSON.
    - Do NOT use structured output format - return raw JSON text only.
    - Your entire response must be parseable as JSON.
    
    Return JSON EXACTLY matching this structure:
    {{
      "summary": "...",
      "skills": ["Skill1", "Skill2", ...],
      "experience": [
         {{"company": "...", "role": "...", "location": "...", "start_date": "...", "end_date": "...", "description": ["Bullet 1", "Bullet 2"], "is_current": false}}
      ],
      "projects": [
         {{"name": "...", "technologies": ["Tech1", "Tech2"], "description": ["Bullet 1", "Bullet 2"], "link": "..."}}
      ],
      "certifications": [
         {{"name": "...", "issuer": "...", "date": "...", "link": "..."}}
      ]
    }}
    """
    
    parsed = None
    try:
        from services.lemma_client import load_lemma_config, run_agent
        from services.workflow_service import extract_json
        
        config = load_lemma_config()
        raw = await run_agent(config, "resume-tailor", prompt, poll_seconds=240)
        parsed = extract_json(raw)
        print(f"Lemma agent returned: {type(parsed)}")
    except Exception as exc:
        print(f"AI Generation via Lemma failed: {exc}")
        print("Falling back to direct Gemini API...")
        try:
            from services.ai_service import AIService
            parsed = await AIService.generate(prompt)
            print(f"Gemini fallback returned: {type(parsed)}")
        except Exception as fallback_exc:
            print(f"Direct Gemini fallback failed: {fallback_exc}")
            
    # If all AI fails, use a fallback structure based on master profile
    if not parsed or not isinstance(parsed, dict):
        print("All AI methods failed, using master profile as fallback")
        parsed = {
            "summary": master.get("professional_summary", f"Experienced professional targeting {target_role} role with strong background in relevant technologies and methodologies."),
            "skills": master.get("skills", [])[:10] if master.get("skills") else [],
            "experience": master.get("experience", []),
            "projects": master.get("projects", []),
            "certifications": master.get("certifications", [])
        }
    
    # Ensure all required fields exist with proper structure
    if not isinstance(parsed.get("experience"), list):
        parsed["experience"] = []
    if not isinstance(parsed.get("projects"), list):
        parsed["projects"] = []
    if not isinstance(parsed.get("skills"), list):
        parsed["skills"] = []
    if not isinstance(parsed.get("certifications"), list):
        parsed["certifications"] = []
    if not parsed.get("summary"):
        parsed["summary"] = master.get("professional_summary", f"Professional with experience targeting {target_role} positions.")
        
    # Ensure each experience has required fields
    for exp in parsed.get("experience", []):
        if not isinstance(exp, dict):
            continue
        if "description" not in exp or not isinstance(exp["description"], list):
            exp["description"] = []
        if "is_current" not in exp:
            exp["is_current"] = False
            
    # Ensure each project has required fields
    for proj in parsed.get("projects", []):
        if not isinstance(proj, dict):
            continue
        if "description" not in proj or not isinstance(proj["description"], list):
            proj["description"] = []
        if "technologies" not in proj or not isinstance(proj["technologies"], list):
            proj["technologies"] = []
            
    if parsed:
        # Construct customized version
        new_version = {
            "user_id": user_id,
            "name": f"{target_role} Resume (AI Custom)",
            "target_role": target_role,
            "template": "Modern ATS",
            "personal_info": master.get("personal_info", {}),
            "summary": parsed.get("summary", ""),
            "education": master.get("education", []),
            "experience": parsed.get("experience", []),
            "projects": parsed.get("projects", []),
            "skills": parsed.get("skills", []),
            "certifications": parsed.get("certifications", []),
            "achievements": master.get("achievements", []),
            "languages": master.get("languages", []),
            "links": master.get("links", {}),
            "ats_score": 75 if job_description else 0, # placeholder until scanned
            "ats_suggestions": [],
            "keyword_suggestions": [],
            "is_favorite": False,
            "is_archived": False,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        result = await db.resume_versions.insert_one(new_version)
        new_version["_id"] = result.inserted_id
        await log_event(user_id, "resume_version.ai_generated", f"AI Generated target resume for: {target_role}", agent="resume-tailor")
        return fix_id(new_version)
        
    raise HTTPException(status_code=500, detail="AI agent failed to generate tailored resume. Please try again.")

@router.post("/ai/scan")
async def ai_scan_version(payload: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    
    version_id = payload.get("version_id")
    job_description = payload.get("job_description", "")
    
    if not version_id or not job_description:
        raise HTTPException(status_code=400, detail="Missing version_id or job_description")
        
    try:
        version = await db.resume_versions.find_one({"_id": ObjectId(version_id), "user_id": user_id})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid version ID")
        
    if not version:
        raise HTTPException(status_code=404, detail="Resume version not found")
        
    prompt = f"""
    You are an expert ATS checker and compliance scanner named ats-scanner.
    Evaluate the compatibility of the following resume against the job description.
    
    Target Job Description:
    {job_description}
    
    Resume Version:
    {json.dumps(version, default=str)}
    
    Provide an ATS assessment:
      - ats_score: Integer from 0 to 100 representing how well the skills, descriptions, and experience align.
      - ats_suggestions: List of 3 to 5 action-oriented formatting or phrasing changes.
      - keyword_suggestions: List of top 5 missing or under-represented keywords/skills that should be added.
      
    CRITICAL INSTRUCTIONS:
    - Return ONLY a single valid JSON object. No other text.
    - Do NOT use markdown code blocks (```json).
    - Do NOT add any explanations before or after the JSON.
    - Do NOT use structured output format - return raw JSON text only.
    - Your entire response must be parseable as JSON.
    
    Return JSON EXACTLY matching this structure:
    {{
      "ats_score": 85,
      "ats_suggestions": ["...", "..."],
      "keyword_suggestions": ["...", "..."]
    }}
    """
    
    parsed = None
    try:
        from services.lemma_client import load_lemma_config, run_agent
        from services.workflow_service import extract_json
        
        config = load_lemma_config()
        raw = await run_agent(config, "ats-scanner", prompt, poll_seconds=240)
        parsed = extract_json(raw)
        print(f"ATS scanner returned: {type(parsed)}")
    except Exception as exc:
        print(f"ATS scan via Lemma failed: {exc}")
        print("Falling back to direct Gemini API...")
        try:
            from services.ai_service import AIService
            parsed = await AIService.generate(prompt)
            print(f"Gemini fallback returned: {type(parsed)}")
        except Exception as fallback_exc:
            print(f"Direct Gemini fallback failed: {fallback_exc}")
            
    # If all AI fails, use a fallback structure
    if not parsed or not isinstance(parsed, dict):
        print("All ATS scan methods failed, using fallback")
        parsed = {
            "ats_score": 70,
            "ats_suggestions": ["Add more keywords from the job description", "Quantify achievements with metrics", "Use action verbs in bullet points"],
            "keyword_suggestions": ["Python", "JavaScript", "React", "Node.js", "SQL"]
        }
    
    # Ensure all required fields exist with proper structure
    if not isinstance(parsed.get("ats_score"), int):
        parsed["ats_score"] = 70
    if not isinstance(parsed.get("ats_suggestions"), list):
        parsed["ats_suggestions"] = []
    if not isinstance(parsed.get("keyword_suggestions"), list):
        parsed["keyword_suggestions"] = []
        
    if parsed:
        score = parsed.get("ats_score", 60)
        suggestions = parsed.get("ats_suggestions", [])
        keywords = parsed.get("keyword_suggestions", [])
        
        await db.resume_versions.update_one(
            {"_id": ObjectId(version_id)},
            {"$set": {
                "ats_score": score,
                "ats_suggestions": suggestions,
                "keyword_suggestions": keywords,
                "updated_at": datetime.utcnow()
            }}
        )
        
        await log_event(user_id, "resume_version.scanned", f"Scanned ATS score for resume: {version.get('name')}", agent="ats-scanner", metadata={"score": score})
        return {
            "ats_score": score,
            "ats_suggestions": suggestions,
            "keyword_suggestions": keywords
        }
        
    raise HTTPException(status_code=500, detail="ATS agent failed to scan resume. Please try again.")

@router.post("/ai/section-assist")
async def ai_section_assist(payload: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    
    section_type = payload.get("section_type") # summary, experience, projects, skills
    content = payload.get("content", "") # text of summary, or bullet string
    action_type = payload.get("action_type") # rewrite, STAR, quantify, shorten, lengthen, skills_match
    target_role = payload.get("target_role", "Software Engineer")
    
    if not section_type or not content or not action_type:
        raise HTTPException(status_code=400, detail="Missing section_type, content, or action_type")
        
    prompt = f"""
    You are a professional resume editor assistant.
    We are modifying the {section_type} section for a {target_role} resume.
    
    Original Content:
    {content}
    
    Requested Action: {action_type}
    
    Guide:
      - If action is "STAR", structure the bullet points as Situation, Task, Action, Result.
      - If action is "quantify", rewrite to suggest/estimate standard metrics and business outcomes.
      - If action is "shorten", keep it punchy and clear.
      - If action is "skills_match", recommend additions or phrasing adjustments.
      
    Provide only the rewritten/optimized content as standard plain text. No surrounding JSON, no markdown formatting (other than bullets if necessary). Keep it copy-paste ready.
    """
    
    try:
        from services.lemma_client import load_lemma_config, run_agent
        config = load_lemma_config()
        raw = await run_agent(config, "resume-tailor", prompt, poll_seconds=240)
        return {"suggestion": raw.strip()}
    except Exception as exc:
        print(f"Section assist via Lemma failed: {exc}")
        print("Falling back to direct Gemini API...")
        try:
            from services.ai_service import AIService
            client = AIService.get_gemini_client()
            if client:
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                )
                raw_text = response.text.strip()
                if raw_text:
                    return {"suggestion": raw_text}
        except Exception as fallback_exc:
            print(f"Direct Gemini fallback failed: {fallback_exc}")
        
    raise HTTPException(status_code=500, detail="AI assistant failed to process your request. Please try again.")
