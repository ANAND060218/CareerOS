from fastapi import APIRouter, HTTPException
from models.schemas import ResumeUpload
from database import get_db
from datetime import datetime
from bson.objectid import ObjectId

router = APIRouter()

def fix_id(doc: dict):
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

@router.post("/upload")
async def upload_resume(resume: ResumeUpload):
    db = get_db()
    new_resume = {
        "text": resume.text,
        "created_at": datetime.utcnow()
    }
    result = await db.resumes.insert_one(new_resume)
    new_resume["_id"] = result.inserted_id
    return fix_id(new_resume)

@router.get("/")
async def get_resumes():
    db = get_db()
    cursor = db.resumes.find({}).sort("created_at", -1)
    resumes = await cursor.to_list(length=10)
    return [fix_id(r) for r in resumes]
