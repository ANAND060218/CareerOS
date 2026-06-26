from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from database import get_db
from models.schemas import Job

router = APIRouter()

def fix_id(job: dict):
    if "_id" in job:
        job["id"] = str(job["_id"])
        del job["_id"]
    return job

@router.get("/", response_model=List[Job])
async def get_jobs(skip: int = 0, limit: int = 50, company: Optional[str] = None):
    db = get_db()
    query = {}
    if company:
        query["company"] = {"$regex": company, "$options": "i"}
    
    cursor = db.jobs.find(query).skip(skip).limit(limit)
    jobs = await cursor.to_list(length=limit)
    return [fix_id(job) for job in jobs]

@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str):
    from bson.objectid import ObjectId
    db = get_db()
    try:
        job = await db.jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job ID")
        
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return fix_id(job)
