from fastapi import APIRouter, Depends, HTTPException
from database import get_db
from models.schemas import ApplicationCreate, ApplicationResponse
from datetime import datetime
from bson.objectid import ObjectId

router = APIRouter()

def fix_id(doc: dict):
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

@router.post("/", response_model=ApplicationResponse)
async def create_application(app: ApplicationCreate):
    db = get_db()
    # Check if job exists
    try:
        job = await db.jobs.find_one({"_id": ObjectId(app.job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    new_app = {
        "job_id": app.job_id,
        "status": app.status,
        "created_at": datetime.utcnow()
    }
    
    result = await db.applications.insert_one(new_app)
    new_app["_id"] = result.inserted_id
    
    # Return with job details for convenience
    response = fix_id(new_app)
    job["id"] = str(job["_id"])
    del job["_id"]
    response["job_details"] = job
    return response

@router.get("/", response_model=list[ApplicationResponse])
async def get_applications():
    db = get_db()
    cursor = db.applications.find({})
    apps = await cursor.to_list(length=100)
    
    result = []
    for app in apps:
        app = fix_id(app)
        # Fetch job details
        job = await db.jobs.find_one({"_id": ObjectId(app["job_id"])})
        if job:
            job["id"] = str(job["_id"])
            del job["_id"]
            app["job_details"] = job
        result.append(app)
        
    return result

@router.put("/{app_id}/status")
async def update_application_status(app_id: str, status: str):
    db = get_db()
    try:
        result = await db.applications.update_one(
            {"_id": ObjectId(app_id)},
            {"$set": {"status": status}}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid app ID")
        
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Application not found or status already set")
        
    return {"message": "Status updated successfully"}
