import requests
import json
import time

BASE_URL = "http://127.0.0.1:5002"
resume_text = "Anand, Backend Software Engineer. Skills: Python, FastAPI, SQL database design, Docker, Git. Experienced in building high-performance REST APIs."
job_id = "6a3f3632df38724c67bd87ee"

print("--- STARTING PROGRAMMATIC INTEGRATION TEST ---")

# Step 1: Upload resume
print("\n1. Uploading resume...")
r = requests.post(f"{BASE_URL}/resumes/upload", json={"text": resume_text})
print("Status:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text)
    exit(1)

# Step 2: Save resume memory
print("\n2. Saving resume memory...")
r = requests.post(f"{BASE_URL}/memory/", json={"resume_text": resume_text})
print("Status:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text)
    exit(1)

# Step 3: Run AI workflow (calls live Lemma agents under the hood!)
print("\n3. Running AI workflow (this runs live Lemma agents and might take a moment)...")
payload = {
    "resume_text": resume_text,
    "job_description": "Looking for a Python Developer with experience in FastAPI, MongoDB, Docker.",
    "company": "Accenture"
}
start_time = time.time()
r = requests.post(f"{BASE_URL}/ai/workflow", json=payload)
print("Status:", r.status_code)
print("Time taken:", round(time.time() - start_time, 2), "seconds")
if r.status_code != 200:
    print("Error:", r.text)
    exit(1)
else:
    data = r.json()
    print("Workflow message:", data.get("message"))
    print("Workflow agents executed:")
    for agent in data.get("agents", []):
        print(f"  - {agent.get('name')}: {agent.get('status')} ({agent.get('summary')})")

# Step 4: Create job application
print("\n4. Creating job application in database...")
r = requests.post(f"{BASE_URL}/applications/", json={"job_id": job_id, "status": "Saved"})
print("Status:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text)
    exit(1)
else:
    print("Application successfully created with ID:", r.json().get("id"))
    print("Nested job details title:", r.json().get("job_details", {}).get("title"))

# Step 5: Get applications list
print("\n5. Fetching all applications...")
r = requests.get(f"{BASE_URL}/applications/")
print("Status:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text)
    exit(1)
else:
    apps = r.json()
    print(f"Successfully fetched {len(apps)} applications.")
    for app in apps:
        print(f"  - Job Title: {app.get('job_details', {}).get('title')} | Status: {app.get('status')}")

# Step 6: Get recommendations for dashboard (uses live Gemini model!)
print("\n6. Fetching dashboard recommendations (runs live Gemini call)...")
r = requests.post(f"{BASE_URL}/dashboard/recommendations", json={"limit": 5})
print("Status:", r.status_code)
if r.status_code != 200:
    print("Error:", r.text)
    exit(1)
else:
    recs = r.json()
    print(f"Successfully fetched {len(recs)} dashboard recommendations.")
    for rec in recs:
        print(f"  - Recommended: {rec.get('job_details', {}).get('title')} | Match score: {rec.get('match_score')}%")

print("\n--- ALL BACKEND ENDPOINTS AND WORKFLOW FLOWS ARE 100% WORKING PERFECTLY! ---")
