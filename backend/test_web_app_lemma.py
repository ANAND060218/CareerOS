"""
Validate CareerOS web-app Lemma integration without a browser.

Checks:
1. Lemma platform connectivity and agents
2. Backend API health (if running)
3. Full /ai/workflow path through Lemma agents
"""

import asyncio
import sys
import time

import httpx

from services.lemma_client import check_lemma_health

BACKEND_URL = "http://127.0.0.1:5002"
SAMPLE_RESUME = (
    "Anand, Backend Software Engineer. Skills: Python, FastAPI, SQL database design, "
    "Docker, Git. Experienced in building high-performance REST APIs."
)
SAMPLE_JOB = (
    "Looking for a Python Developer with experience in FastAPI, MongoDB, Docker."
)


async def test_lemma_direct() -> bool:
    print("\n[1/3] Lemma platform connectivity")
    health = await check_lemma_health()
    if not health.get("connected"):
        print("  FAIL:", health.get("error"))
        return False

    print(f"  OK - {health['agent_count']} agents on pod {health['pod_id']}")
    for name in health.get("agents", []):
        print(f"       - {name}")
    return True


def test_backend_health() -> bool:
    print("\n[2/3] Backend API health")
    try:
        with httpx.Client(timeout=10.0) as client:
            root = client.get(f"{BACKEND_URL}/")
            lemma = client.get(f"{BACKEND_URL}/ai/lemma/status")
    except httpx.ConnectError:
        print(f"  SKIP - backend not running at {BACKEND_URL}")
        print("       Start it with: cd backend && uvicorn main:app --port 5002")
        return False

    if root.status_code != 200:
        print("  FAIL - root endpoint:", root.status_code)
        return False

    lemma_data = lemma.json()
    if not lemma_data.get("connected"):
        print("  FAIL - /ai/lemma/status:", lemma_data.get("error"))
        return False

    print("  OK - backend up and Lemma status endpoint connected")
    return True


def test_workflow_endpoint() -> bool:
    print("\n[3/3] Workflow endpoint (Lemma agents via web API)")
    payload = {
        "resume_text": SAMPLE_RESUME,
        "job_description": SAMPLE_JOB,
        "company": "Accenture",
    }

    start = time.time()
    try:
        with httpx.Client(timeout=300.0) as client:
            response = client.post(f"{BACKEND_URL}/ai/workflow", json=payload)
    except httpx.ConnectError:
        print("  SKIP - backend not running")
        return False

    elapsed = round(time.time() - start, 1)
    if response.status_code != 200:
        print(f"  FAIL - status {response.status_code}: {response.text[:500]}")
        return False

    data = response.json()
    source = data.get("source", "unknown")
    print(f"  OK - completed in {elapsed}s via {source}")
    print(f"       message: {data.get('message')}")
    for agent in data.get("agents", []):
        print(f"       - {agent.get('name')}: {agent.get('summary')}")

    if source != "lemma":
        print("  WARN - workflow used fallback instead of Lemma agents")
        return False
    return True


async def main() -> int:
    print("=== CareerOS Web App Lemma Validation ===")

    lemma_ok = await test_lemma_direct()
    backend_ok = test_backend_health()
    workflow_ok = test_workflow_endpoint() if backend_ok else False

    print("\n=== Summary ===")
    print(f"  Lemma direct: {'PASS' if lemma_ok else 'FAIL'}")
    print(f"  Backend health: {'PASS' if backend_ok else 'SKIP/FAIL'}")
    print(f"  Workflow via API: {'PASS' if workflow_ok else 'SKIP/FAIL'}")

    if lemma_ok and (not backend_ok or workflow_ok):
        print("\nLemma integration is working.")
        return 0

    print("\nSome checks failed. Fix Lemma auth with: lemma auth login")
    return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
