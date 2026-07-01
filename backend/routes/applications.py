from fastapi import APIRouter, HTTPException, Depends
from database import get_db
from dependencies import get_current_user
from models.schemas import ApplicationCreate, ApplicationResponse
from datetime import datetime
from bson.objectid import ObjectId
from services.event_service import log_event

router = APIRouter()

def fix_id(doc: dict):
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

def fix_job(job: dict):
    if not job:
        return job
    if "_id" in job:
        job["id"] = str(job["_id"])
        del job["_id"]
    if "date_posted" in job and hasattr(job["date_posted"], "isoformat"):
        job["date_posted"] = job["date_posted"].isoformat()
    return job

@router.post("/", response_model=ApplicationResponse)
async def create_application(
    app: ApplicationCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["user_id"]

    job = None
    # Try to find job in MongoDB (for scraped jobs)
    try:
        job = await db.jobs.find_one({"_id": ObjectId(app.job_id)})
    except Exception:
        # If it's a manual job ID (e.g., "manual-123"), it won't be a valid ObjectId
        pass

    # Resolve title and company: prefer what the frontend sent,
    # fall back to the looked-up job document, then to sensible defaults.
    resolved_title = app.title or (job.get("title") if job else None) or "Untitled Role"
    resolved_company = app.company or (job.get("company") if job else None) or "Unknown Company"

    existing = await db.applications.find_one({"user_id": user_id, "job_id": app.job_id})
    if existing:
        update_fields = {"status": app.status}
        # Back-fill title/company if they were missing from an older record
        if not existing.get("title"):
            update_fields["title"] = resolved_title
        if not existing.get("company"):
            update_fields["company"] = resolved_company
        await db.applications.update_one(
            {"_id": existing["_id"]},
            {"$set": update_fields},
        )
        existing["status"] = app.status
        existing.setdefault("title", resolved_title)
        existing.setdefault("company", resolved_company)
        response = fix_id(existing)
        if job:
            response["job_details"] = fix_job(job)
        return response

    new_app = {
        "job_id": app.job_id,
        "title": resolved_title,
        "company": resolved_company,
        "status": app.status,
        "user_id": user_id,
        "created_at": datetime.utcnow(),
    }

    result = await db.applications.insert_one(new_app)
    new_app["_id"] = result.inserted_id

    job_title = resolved_title
    await log_event(
        user_id,
        "application.saved",
        f"Application saved for {job_title}.",
        agent="application-strategist",
        metadata={"job_id": app.job_id, "status": app.status},
    )

    response = fix_id(new_app)
    if job:
        response["job_details"] = fix_job(job)
    return response

@router.get("/", response_model=list[ApplicationResponse])
async def get_applications(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = current_user["user_id"]
    cursor = db.applications.find({"user_id": user_id}).sort("created_at", -1)

    result = []
    async for app_doc in cursor:
        app_doc = fix_id(app_doc)

        # Try to find job in MongoDB (for scraped jobs)
        job = None
        try:
            job = await db.jobs.find_one({"_id": ObjectId(app_doc["job_id"])})
            if job:
                app_doc["job_details"] = fix_job(job)
        except Exception:
            # Manual job IDs won't be valid ObjectIds - skip job lookup
            pass

        # Back-fill title/company from job_details if missing from the stored document
        if not app_doc.get("title") and job:
            app_doc["title"] = job.get("title") or "Untitled Role"
            # Persist the back-fill so future loads are instant
            try:
                await db.applications.update_one(
                    {"_id": ObjectId(app_doc["id"])},
                    {"$set": {"title": app_doc["title"]}},
                )
            except Exception:
                pass
        if not app_doc.get("company") and job:
            app_doc["company"] = job.get("company") or "Unknown Company"
            try:
                await db.applications.update_one(
                    {"_id": ObjectId(app_doc["id"])},
                    {"$set": {"company": app_doc["company"]}},
                )
            except Exception:
                pass

        result.append(app_doc)

    return result

@router.put("/{app_id}/status")
async def update_application_status(
    app_id: str,
    status: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    user_id = current_user["user_id"]
    try:
        result = await db.applications.update_one(
            {"_id": ObjectId(app_id), "user_id": user_id},
            {"$set": {"status": status}},
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid app ID")

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Application not found")

    await log_event(user_id, "application.status", f"Application marked as {status}.", metadata={"status": status})
    return {"message": "Status updated successfully"}
