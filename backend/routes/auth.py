from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from dependencies import get_current_user
from models.schemas import UserLogin, UserRegister, UserResponse, UserProfileUpdate, AIMemory
from services.auth_service import create_access_token, hash_password, verify_password

router = APIRouter()


@router.post("/register")
async def register(payload: UserRegister):
    db = get_db()
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = {
        "email": payload.email.lower(),
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": payload.role or "Software Engineer",
    }
    result = await db.users.insert_one(user)
    user_id = str(result.inserted_id)

    await db.memory.update_one(
        {"user_id": user_id},
        {
            "$setOnInsert": {
                "user_id": user_id,
                "preferred_roles": [payload.role] if payload.role else [],
                "preferred_locations": [],
                "skills": [],
                "resume_text": "",
                "career_goals": "",
            }
        },
        upsert=True,
    )

    token = create_access_token(user_id, user["email"], user["name"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(id=user_id, email=user["email"], name=user["name"], role=user["role"]),
    }


@router.post("/login")
async def login(payload: UserLogin):
    db = get_db()
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_id = str(user["_id"])
    token = create_access_token(user_id, user["email"], user.get("name", "User"))
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse(
            id=user_id,
            email=user["email"],
            name=user.get("name", "User"),
            role=user.get("role", "Software Engineer"),
        ),
    }


@router.get("/me", response_model=UserResponse)
async def me(current_user: dict = Depends(get_current_user)):
    db = get_db()
    from bson.objectid import ObjectId

    user = await db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user.get("name", "User"),
        role=user.get("role", "Software Engineer"),
    )


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    db = get_db()
    from bson.objectid import ObjectId

    user_id = current_user["user_id"]
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    memory = await db.memory.find_one({"user_id": user_id}) or {}
    memory.pop("_id", None)
    memory.pop("user_id", None)

    resume_count = await db.resumes.count_documents({"user_id": user_id})
    application_count = await db.applications.count_documents({"user_id": user_id})

    return {
        "user": UserResponse(
            id=user_id,
            email=user["email"],
            name=user.get("name", "User"),
            role=user.get("role", "Software Engineer"),
        ),
        "memory": AIMemory(**memory) if memory else AIMemory(),
        "stats": {
            "resume_uploads": resume_count,
            "applications": application_count,
            "resume_chars": len(memory.get("resume_text", "")),
            "skills_count": len(memory.get("skills", [])),
        },
    }


@router.patch("/profile")
async def update_profile(
    payload: UserProfileUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    from bson.objectid import ObjectId

    user_id = current_user["user_id"]
    user_updates = {}
    if payload.name is not None:
        user_updates["name"] = payload.name.strip()
    if payload.role is not None:
        user_updates["role"] = payload.role.strip()

    if user_updates:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": user_updates})

    memory_fields = payload.model_dump(
        exclude={"name", "role"},
        exclude_unset=True,
    )
    if memory_fields:
        memory_fields["user_id"] = user_id
        await db.memory.update_one(
            {"user_id": user_id},
            {"$set": memory_fields},
            upsert=True,
        )

    return await get_profile(current_user)


@router.delete("/account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    db = get_db()
    from bson.objectid import ObjectId

    user_id = current_user["user_id"]
    await db.users.delete_one({"_id": ObjectId(user_id)})
    await db.memory.delete_many({"user_id": user_id})
    await db.resumes.delete_many({"user_id": user_id})
    await db.applications.delete_many({"user_id": user_id})
    await db.workflow_events.delete_many({"user_id": user_id})
    return {"message": "Account and all associated data deleted."}
