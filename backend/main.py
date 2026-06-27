import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import jobs, applications, resumes, ai, dashboard, memory

app = FastAPI(title="CareerOS API", description="Backend for CareerOS", version="1.0.0")

PORT = int(os.getenv("PORT", "5002"))

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
app.include_router(applications.router, prefix="/applications", tags=["Applications"])
app.include_router(resumes.router, prefix="/resumes", tags=["Resumes"])
app.include_router(ai.router, prefix="/ai", tags=["AI Services"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(memory.router, prefix="/memory", tags=["AI Memory"])

@app.get("/")
def read_root():
    return {
        "message": "Welcome to CareerOS API",
        "port": PORT,
        "mongo_configured": bool(os.getenv("MONGO_URI")),
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
    }
