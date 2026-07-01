from fastapi import APIRouter, HTTPException
from typing import List, Optional
from database import get_db
from models.schemas import Job

router = APIRouter()


def fix_id(job: dict):
    if "_id" in job:
        job["id"] = str(job["_id"])
        del job["_id"]

    if "date_posted" in job and hasattr(job["date_posted"], "isoformat"):
        job["date_posted"] = job["date_posted"].isoformat()

    return job


def _location_text(location) -> str:
    if not location:
        return ""
    if isinstance(location, str):
        return location
    if isinstance(location, dict):
        return " ".join(
            filter(
                None,
                [
                    location.get("city"),
                    location.get("region"),
                    location.get("countryName"),
                    location.get("country"),
                ],
            )
        )
    return str(location)


def build_jobs_query(
    *,
    title: Optional[str] = None,
    company: Optional[str] = None,
    location: Optional[str] = None,
    experience: Optional[str] = None,
) -> dict:
    query: dict = {}
    if title:
        query["title"] = {"$regex": title, "$options": "i"}
    if company:
        query["company"] = {"$regex": company, "$options": "i"}
    if experience:
        query["experience"] = {"$regex": experience, "$options": "i"}
    if location:
        loc = location.strip()
        query["$or"] = [
            {"location": {"$regex": loc, "$options": "i"}},
            {"location.city": {"$regex": loc, "$options": "i"}},
            {"location.region": {"$regex": loc, "$options": "i"}},
            {"location.countryName": {"$regex": loc, "$options": "i"}},
        ]
    return query


@router.get("/")
async def get_jobs(
    skip: int = 0,
    limit: int = 50,
    page: Optional[int] = None,
    title: Optional[str] = None,
    company: Optional[str] = None,
    location: Optional[str] = None,
    experience: Optional[str] = None,
    paginated: bool = False,
):
    db = get_db()
    query = build_jobs_query(
        title=title,
        company=company,
        location=location,
        experience=experience,
    )

    if page is not None and page > 0:
        skip = (page - 1) * limit
        paginated = True

    total = await db.jobs.count_documents(query)
    cursor = db.jobs.find(query).skip(skip).limit(limit)
    jobs = await cursor.to_list(length=limit)
    fixed = [fix_id(job) for job in jobs]

    if paginated or page is not None:
        return {
            "jobs": fixed,
            "hasMore": skip + len(fixed) < total,
            "total": total,
            "page": page or (skip // limit + 1),
            "limit": limit,
        }

    return fixed


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
