import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import jobs, applications, resumes, ai, dashboard, memory, auth, events, resume_hub_routes

app = FastAPI(title="CareerOS API", description="AI Career Operating System", version="2.0.0")

PORT = int(os.getenv("PORT", "5002"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Auth"])
app.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
app.include_router(applications.router, prefix="/applications", tags=["Applications"])
app.include_router(resumes.router, prefix="/resumes", tags=["Resumes"])
app.include_router(ai.router, prefix="/ai", tags=["AI Services"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(memory.router, prefix="/memory", tags=["AI Memory"])
app.include_router(events.router, prefix="/events", tags=["Workflow Events"])
app.include_router(resume_hub_routes.router, prefix="/resume-hub", tags=["Resume Hub"])

@app.get("/")
async def read_root():
    from services.lemma_client import check_lemma_health
    return {
        "message": "Welcome to CareerOS — Your AI Recruiting Department",
        "port": PORT,
        "mongo_configured": bool(os.getenv("MONGO_URI")),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "lemma_status": await check_lemma_health(),
    }
