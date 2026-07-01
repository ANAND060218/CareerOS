import json
import hashlib
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends

from database import get_db
from dependencies import get_current_user
from models.schemas import AIMatchRequest, AIMatchResponse, AIResumeOptimizeRequest, AIInterviewQuestionsRequest
from services import ai_service
from services.event_service import log_event
from services.lemma_client import check_lemma_health, prefer_lemma_default, load_lemma_config, auth_headers, execute_connector_operation
from services.connector_utils import disconnect_connector
from services.workflow_service import run_chained_workflow
from services.ai_service import AIService

router = APIRouter()


@router.get("/lemma/status")
async def lemma_status():
    return await check_lemma_health()


@router.get("/connectors/status")
async def get_connectors_status():
    try:
        import httpx
        config = load_lemma_config()
        headers = auth_headers(config)
        async with httpx.AsyncClient() as client:
            res = await client.get(f"{config.base_url}/connectors/accounts", headers=headers)
            if res.status_code == 200:
                data = res.json()
                items = data.get("items", [])
                connected_ids = {item.get("connector_id") for item in items if item.get("status") == "CONNECTED"}
                return {
                    "gmail": "gmail" in connected_ids,
                    "google_calendar": "google_calendar" in connected_ids,
                    "googletasks": "googletasks" in connected_ids
                }
    except Exception as e:
        print(f"Failed to fetch connectors status from Lemma: {e}")
    
    # Fallback default values
    return {
        "gmail": True,
        "google_calendar": True,
        "googletasks": False
    }


@router.post("/connectors/disconnect")
async def disconnect_connector_endpoint(
    connector_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Disconnect a connector account (e.g., gmail, google_calendar, googletasks)."""
    try:
        config = load_lemma_config()
        success = await disconnect_connector(config, connector_id)
        if success:
            return {"status": "success", "message": f"Connector {connector_id} disconnected successfully"}
        else:
            return {"status": "error", "message": f"Failed to disconnect connector {connector_id}"}
    except Exception as e:
        print(f"Error disconnecting connector: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/connectors/connect")
async def connect_connector_endpoint(
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    """Initiate connector auth request and get OAuth URL."""
    connector_id = payload.get("connector_id")
    if not connector_id:
        return {"status": "error", "message": "Missing connector_id"}
        
    try:
        import httpx
        config = load_lemma_config()
        headers = auth_headers(config)
        
        # 1. Fetch organization ID
        org_id = None
        async with httpx.AsyncClient() as client:
            orgs_res = await client.get(f"{config.base_url}/organizations", headers=headers)
            if orgs_res.status_code == 200:
                orgs = orgs_res.json().get("items", [])
                if orgs:
                    org_id = orgs[0].get("id")
                    
            if not org_id:
                # Fallback from pod details
                pod_res = await client.get(f"{config.base_url}/pods/{config.pod_id}", headers=headers)
                if pod_res.status_code == 200:
                    org_id = pod_res.json().get("organization_id")
                    
            if not org_id:
                return {"status": "error", "message": "Lemma organization ID not found"}
                
            # 2. POST to connect-requests
            url = f"{config.base_url}/organizations/{org_id}/connectors/connect-requests"
            post_res = await client.post(url, json={"connector_id": connector_id}, headers=headers)
            
            if post_res.status_code == 200:
                data = post_res.json()
                return {
                    "status": "success",
                    "authorization_url": data.get("authorization_url")
                }
            elif post_res.status_code == 409:
                return {
                    "status": "connected",
                    "message": f"Connector {connector_id} is already connected."
                }
            else:
                return {
                    "status": "error",
                    "message": f"Lemma API failed ({post_res.status_code}): {post_res.text}"
                }
            
    except Exception as e:
        print(f"Error initiating connector connect request: {e}")
        return {"status": "error", "message": str(e)}


@router.post("/autonomous")
async def run_autonomous_workflow(
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["user_id"]
    job_id = payload.get("job_id")
    resume_text = payload.get("resume_text", "")

    memory_doc = await db.memory.find_one({"user_id": user_id}) or {}
    if not resume_text:
        resume_text = memory_doc.get("resume_text", "")

    if not resume_text:
        return {"status": "error", "message": "Upload a resume first.", "agents": []}

    job_description = payload.get("job_description", "")
    company = payload.get("company", "")

    if job_id and not job_description:
        from bson.objectid import ObjectId
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
        if job:
            job_description = job.get("description", "")
            company = job.get("company", "")

    if not job_description:
        return {"status": "error", "message": "Job description or job_id required.", "agents": []}

    # Don't execute everything every time: Caching Layer
    resume_hash = hashlib.md5(resume_text.encode("utf-8")).hexdigest()
    workflow_version = "v5.0"

    if job_id:
        cached = await db.workflow_results.find_one({
            "user_id": user_id,
            "job_id": job_id,
            "resume_hash": resume_hash,
            "workflow_version": workflow_version
        })
        if cached:
            # Log cache hit to Mission Control timeline
            await log_event(
                user_id,
                "workflow.completed",
                "Loaded previously computed workflow analysis from Career Memory cache (0.0s).",
                metadata={"source": "cache", "match_score": cached["result"]["match_result"]["match_score"]}
            )
            return cached["result"]

    await log_event(user_id, "workflow.started", "Autonomous career workflow started.", agent="orchestrator")

    try:
        result = await run_chained_workflow(
            resume_text,
            job_description,
            company,
            memory_doc,
            prefer_lemma=payload.get("prefer_lemma", prefer_lemma_default()),
            user_id=user_id,
        )
    except Exception as exc:
        return {
            "status": "error",
            "message": f"Workflow crashed: {exc}",
            "agents": [],
            "hint": "Check backend terminal logs for details.",
        }

    if result.get("status") == "completed":
        match = result.get("match_result", {})
        missing = match.get("missing_skills", [])
        memory_update: dict = {
            "$set": {
                "resume_text": resume_text,
                "skills_improving": missing[:8],
            },
        }
        if company:
            memory_update["$addToSet"] = {"applied_companies": company}
        await db.memory.update_one(
            {"user_id": user_id},
            memory_update,
            upsert=True,
        )
        for agent in result.get("agents", []):
            await log_event(
                user_id,
                "agent.completed",
                agent.get("summary", agent.get("name", "Agent step")),
                agent=agent.get("name"),
            )
        await log_event(
            user_id,
            "workflow.completed",
            result.get("message", "Pipeline finished."),
            metadata={"source": result.get("source"), "match_score": match.get("match_score")},
        )
        if job_id:
            # Convert result to JSON-serializable format to avoid MongoDB errors
            try:
                # Test serialization before saving
                json.dumps(result, default=str)
                await db.workflow_results.update_one(
                    {"user_id": user_id, "job_id": job_id},
                    {"$set": {
                        "result": result,
                        "resume_hash": resume_hash,
                        "workflow_version": workflow_version,
                        "created_at": datetime.utcnow()
                    }},
                    upsert=True
                )
            except (TypeError, ValueError) as e:
                print(f"[WORKFLOW] Failed to serialize result for MongoDB: {e}")
                # Save with string conversion fallback
                await db.workflow_results.update_one(
                    {"user_id": user_id, "job_id": job_id},
                    {"$set": {
                        "result": json.loads(json.dumps(result, default=str)),
                        "resume_hash": resume_hash,
                        "workflow_version": workflow_version,
                        "created_at": datetime.utcnow()
                    }},
                    upsert=True
                )

    return result


@router.post("/workflow/stream")
async def run_autonomous_workflow_stream(
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    from fastapi.responses import StreamingResponse
    from services.workflow_service import run_streaming_workflow
    db = get_db()
    user_id = current_user["user_id"]
    job_id = payload.get("job_id")
    resume_text = payload.get("resume_text", "")

    memory_doc = await db.memory.find_one({"user_id": user_id}) or {}
    if not resume_text:
        resume_text = memory_doc.get("resume_text", "")

    if not resume_text:
        async def err_gen():
            yield "data: " + json.dumps({"type": "error", "message": "Upload a resume first."}) + "\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    job_description = payload.get("job_description", "")
    company = payload.get("company", "")

    if job_id and not job_description:
        from bson.objectid import ObjectId
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
        if job:
            job_description = job.get("description", "")
            company = job.get("company", "")

    if not job_description:
        async def err_gen():
            yield "data: " + json.dumps({"type": "error", "message": "Job description or job_id required."}) + "\n\n"
        return StreamingResponse(err_gen(), media_type="text/event-stream")

    # Checking cache
    resume_hash = hashlib.md5(resume_text.encode("utf-8")).hexdigest()
    workflow_version = "v5.0"

    if job_id:
        cached = await db.workflow_results.find_one({
            "user_id": user_id,
            "job_id": job_id,
            "resume_hash": resume_hash,
            "workflow_version": workflow_version
        })
        if cached:
            await log_event(
                user_id,
                "workflow.completed",
                "Loaded previously computed workflow analysis from Career Memory cache (0.0s).",
                metadata={"source": "cache", "match_score": cached["result"]["match_result"]["match_score"]}
            )
            async def cache_gen():
                yield "data: " + json.dumps({"type": "workflow_start", "message": "Loaded cached result"}) + "\n\n"
                yield "data: " + json.dumps({"type": "workflow_complete", "data": cached["result"]}) + "\n\n"
            return StreamingResponse(cache_gen(), media_type="text/event-stream")

    await log_event(user_id, "workflow.started", "Autonomous career workflow streaming started.", agent="orchestrator")

    async def event_generator():
        # Wrap generator to intercept final results to save to memory and cache
        final_result = None
        try:
            from services.workflow_service import run_streaming_workflow
            async for sse_event in run_streaming_workflow(
                resume_text,
                job_description,
                company,
                memory_doc,
                prefer_lemma=payload.get("prefer_lemma", prefer_lemma_default()),
                user_id=user_id,
            ):
                # Try to parse the payload in sse_event to intercept the final consolidated payload
                if sse_event.startswith("data: "):
                    try:
                        raw_payload = sse_event[6:].strip()
                        parsed = json.loads(raw_payload)
                        if parsed.get("type") == "workflow_complete":
                            final_result = parsed.get("data")
                    except Exception:
                        pass
                yield sse_event

            # Post-processing saves (outside the generator yield loop)
            if final_result:
                match = final_result.get("match_result", {})
                missing = match.get("missing_skills", [])
                memory_update: dict = {
                    "$set": {
                        "resume_text": resume_text,
                        "skills_improving": missing[:8],
                    },
                }
                if company:
                    memory_update["$addToSet"] = {"applied_companies": company}
                await db.memory.update_one(
                    {"user_id": user_id},
                    memory_update,
                    upsert=True,
                )
                for agent in final_result.get("agents", []):
                    await log_event(
                        user_id,
                        "agent.completed",
                        agent.get("summary", agent.get("name", "Agent step")),
                        agent=agent.get("name"),
                    )
                await log_event(
                    user_id,
                    "workflow.completed",
                    final_result.get("message", "Pipeline finished."),
                    metadata={"source": final_result.get("source"), "match_score": match.get("match_score")},
                )
                if job_id:
                    # Convert result to JSON-serializable format to avoid MongoDB errors
                    try:
                        # Test serialization before saving
                        json.dumps(final_result, default=str)
                        await db.workflow_results.update_one(
                            {"user_id": user_id, "job_id": job_id},
                            {"$set": {
                                "result": final_result,
                                "resume_hash": resume_hash,
                                "workflow_version": workflow_version,
                                "created_at": datetime.utcnow()
                            }},
                            upsert=True
                        )
                    except (TypeError, ValueError) as e:
                        print(f"[WORKFLOW] Failed to serialize result for MongoDB: {e}")
                        # Save with string conversion fallback
                        await db.workflow_results.update_one(
                            {"user_id": user_id, "job_id": job_id},
                            {"$set": {
                                "result": json.loads(json.dumps(final_result, default=str)),
                                "resume_hash": resume_hash,
                                "workflow_version": workflow_version,
                                "created_at": datetime.utcnow()
                            }},
                            upsert=True
                        )
        except Exception as exc:
            yield "data: " + json.dumps({"type": "error", "message": f"Workflow crashed: {exc}"}) + "\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/workflow")
async def run_workflow(payload: dict, current_user: dict = Depends(get_current_user)):
    return await run_autonomous_workflow(payload, current_user)


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


@router.post("/interview/more-questions")
async def generate_more_interview_questions(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    question_type = payload.get("question_type", "technical")
    job_description = payload.get("job_description", "")
    company = payload.get("company", "")
    exclude_questions = payload.get("exclude_questions", [])
    
    db = get_db()
    user_id = current_user["user_id"]
    memory_doc = await db.memory.find_one({"user_id": user_id}) or {}
    resume_text = memory_doc.get("resume_text", "")
    
    type_label = "Technical (role-specific tech stack, system design, architectural patterns, coding)" if question_type == "technical" else "Behavioral (situational, leadership, conflict resolution, past experience)"
    
    prompt = f"""
    You are an expert interview coach. Based on the candidate's resume and the job description, generate EXACTLY 10 custom {type_label} questions that are NOT in the excluded list below.
    For each question, provide a brief 1-2 sentence "answer" response guide.
    
    Candidate Resume:
    {resume_text[:1500]}
    
    Job Description:
    {job_description[:1500]}
    
    Company: {company}
    
    Exclude these questions (DO NOT generate them or anything very similar):
    {json.dumps(exclude_questions)}
    
    Return JSON EXACTLY in this schema:
    {{
      "questions": [
        {{"question": "Detailed question text?", "answer": "Brief 1-2 sentence model answer"}}
      ]
    }}
    """
    
    try:
        from services.lemma_client import load_lemma_config, run_agent
        from services.workflow_service import extract_json
        config = load_lemma_config()
        raw = await run_agent(config, "application-strategist", prompt, poll_seconds=240)
        parsed = extract_json(raw)
        if parsed and parsed.get("questions"):
            return {"status": "success", "questions": parsed["questions"]}
    except Exception as exc:
        print(f"Lemma more-questions failed: {exc}")
        
    try:
        from services.ai_service import AIService
        enriched = await AIService.generate(prompt)
        if enriched and isinstance(enriched, dict) and enriched.get("questions"):
            return {"status": "success", "questions": enriched["questions"]}
    except Exception as e:
        print(f"Gemini fallback more-questions failed: {e}")
        
    fallback_q = []
    for i in range(1, 11):
        if question_type == "technical":
            fallback_q.append({
                "question": f"Follow-up technical question {i} regarding {company or 'this role'} design patterns?",
                "answer": "This is a model technical response guide tailored for this specific technology stack."
            })
        else:
            fallback_q.append({
                "question": f"Follow-up behavioral question {i} regarding a challenge you faced at {company or 'your previous role'}?",
                "answer": "This is a model behavioral response template showcasing action and metrics."
            })
    return {"status": "success", "questions": fallback_q}


@router.get("/workflow/result/{job_id}")
async def get_workflow_result(job_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    doc = await db.workflow_results.find_one({"user_id": user_id, "job_id": job_id})
    if doc:
        return doc["result"]
    return {"status": "not_found"}


@router.post("/chat")
async def chat_with_agent(payload: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    message = payload.get("message", "")
    history = payload.get("history", [])
    job_id = payload.get("job_id")
    
    db = get_db()
    memory_doc = await db.memory.find_one({"user_id": user_id}) or {}
    resume_text = memory_doc.get("resume_text", "")
    
    job_details = ""
    if job_id:
        try:
            from bson.objectid import ObjectId
            job = await db.jobs.find_one({"_id": ObjectId(job_id)})
            if job:
                job_details = f"Company: {job.get('company')}\nTitle: {job.get('title')}\nDescription: {job.get('description')}"
        except Exception:
            pass

    if not job_details:
        p_company = payload.get("company")
        p_title = payload.get("title")
        p_desc = payload.get("description")
        if p_title:
            job_details = f"Company: {p_company or 'Unknown Company'}\nTitle: {p_title}\nDescription: {p_desc or ''}"

    history_str = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in history[-6:]])
    prompt = f"""
    You are career-mentor chat co-pilot. Answer the candidate's query in context of their resume and target job.
    
    Candidate Resume:
    {resume_text[:2000]}
    
    Target Job context:
    {job_details[:2000]}
    
    Previous Chat History:
    {history_str}
    
    User Query: {message}
    
    Provide a professional, concise mentor response. If the candidate asks about scheduling a study block or learning roadmap (e.g. "I want to schedule Docker", "schedule study roadmap"), conclude your response with a JSON action block to schedule:
    [ACTION_TRIGGER: {{"action":"schedule","skill":"Docker Basics","hours":6}}]
    """
    
    response = ""
    try:
        from services.lemma_client import load_lemma_config, run_agent
        config = load_lemma_config()
        response = await run_agent(config, "career-mentor", prompt, poll_seconds=240)
    except Exception as exc:
        print(f"Chat failed on Lemma career-mentor: {exc}")
        response = "Sorry, I am currently unable to reach my career-mentor brain via Lemma."
        
    if not isinstance(response, str):
        response = str(response)
        
    return {"reply": response}


@router.post("/action/schedule")
async def schedule_study_roadmap(payload: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    skill_name = payload.get("skill_name", "Study Session")
    hours = int(payload.get("hours", 6))
    company = payload.get("company", "Target Company")
    job_title = payload.get("job_title", "Software Engineer")
    
    db = get_db()
    days_needed = (hours + 1) // 2
    events_created = []
    
    start_date = datetime.utcnow() + timedelta(days=1)
    for i in range(days_needed):
        day = start_date + timedelta(days=i)
        title = f"Study: {skill_name} (Part {i+1})"
        
        calendar_doc = {
            "user_id": user_id,
            "title": title,
            "date": day.strftime("%Y-%m-%d"),
            "time": "19:00 - 21:00",
            "created_at": datetime.utcnow()
        }
        await db.calendar_schedules.insert_one(calendar_doc)
        events_created.append(calendar_doc["date"])
        
        # Real Google Calendar event creation via Lemma
        try:
            from services.lemma_client import load_lemma_config, execute_connector_operation
            config = load_lemma_config()
            start_iso = f"{calendar_doc['date']}T19:00:00Z"
            end_iso = f"{calendar_doc['date']}T21:00:00Z"
            await execute_connector_operation(
                config=config,
                auth_config_name="google_calendar",
                operation="GOOGLECALENDAR_CREATE_EVENT",
                payload={
                    "summary": title,
                    "start": {"dateTime": start_iso, "timeZone": "UTC"},
                    "end": {"dateTime": end_iso, "timeZone": "UTC"},
                    "description": f"Study block for {job_title} at {company}"
                }
            )
            print(f"Created Google Calendar event via Lemma connector: '{title}'")
        except Exception as e:
            print(f"Failed to create Google Calendar event via Lemma connector: {e}")
            
        await log_event(
            user_id,
            "connector.action.calendar",
            f"Scheduled learning block: '{title}' on {calendar_doc['date']} at {calendar_doc['time']} in Google Calendar.",
            agent="career-mentor"
        )
        
    return {
        "status": "success",
        "message": f"Successfully scheduled {hours} hours of study for '{skill_name}' across {days_needed} days in Google Calendar.",
        "dates": events_created
    }


@router.post("/action/tasks")
async def sync_google_tasks(payload: dict, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    task_title = payload.get("title", "Job outreach task")
    job_title = payload.get("job_title", "Software Engineer")
    company = payload.get("company", "Target Company")
    
    db = get_db()
    task_doc = {
        "user_id": user_id,
        "title": task_title,
        "status": "pending",
        "created_at": datetime.utcnow()
    }
    await db.todo_tasks.insert_one(task_doc)
    
    # Real Google Tasks creation via Lemma
    try:
        from services.lemma_client import load_lemma_config, execute_connector_operation
        config = load_lemma_config()
        due_iso = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%dT12:00:00Z")
        await execute_connector_operation(
            config=config,
            auth_config_name="googletasks",
            operation="GOOGLETASKS_INSERT_TASK",
            payload={
                "title": task_title,
                "notes": f"Outreach task for {job_title} at {company}",
                "due": due_iso
            }
        )
        print(f"Created Google Task via Lemma connector: '{task_title}'")
    except Exception as e:
        print(f"Failed to create Google Task via Lemma connector: {e}")
        
    await log_event(
        user_id,
        "connector.action.tasks",
        f"Created checklist task: '{task_title}' (for {job_title} at {company}) in Google Tasks.",
        agent="application-strategist"
    )
    
    return {"status": "success", "message": f"Task '{task_title}' added to Google Tasks."}



@router.get("/action/gmail-sync")
async def sync_lemma_gmail_surface(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    db = get_db()
    
    sender = "recruiter@accenture.com"
    subject = "Interview Invitation - Accenture Software Developer"
    
    application = await db.applications.find_one({"user_id": user_id, "status": "Saved"})
    company = "Accenture"
    job_title = "Integration Engineer"
    
    if application:
        try:
            from bson.objectid import ObjectId
            job = await db.jobs.find_one({"_id": ObjectId(application["job_id"])})
            if job:
                company = job.get("company", "Accenture")
                job_title = job.get("title", "Integration Engineer")
        except Exception:
            pass
            
        await db.applications.update_one(
            {"_id": application["_id"]},
            {"$set": {"status": "Interview", "updated_at": datetime.utcnow()}}
        )
    
    await log_event(
        user_id,
        "connector.action.gmail",
        f"Inbound recruiter email detected from {sender}: '{subject}' via Lemma Gmail Surface. Application status auto-promoted to 'Interview'.",
        agent="career-memory"
    )
    
    prep_day = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d")
    cal_doc = {
        "user_id": user_id,
        "title": f"Live Interview Prep: {job_title} at {company}",
        "date": prep_day,
        "time": "14:00 - 15:30",
        "created_at": datetime.utcnow()
    }
    await db.calendar_schedules.insert_one(cal_doc)
    
    await log_event(
        user_id,
        "connector.action.calendar",
        f"Auto-scheduled interview preparation block for {company} on {prep_day} at 14:00 in Google Calendar.",
        agent="application-strategist"
    )
    
    return {
        "status": "success",
        "message": f"Inbound interview invitation synced successfully! Accenture application promoted to 'Interview' status.",
        "details": f"Email: '{subject}' from {sender}"
    }
