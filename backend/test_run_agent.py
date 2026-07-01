"""Smoke test: verify CareerOS Lemma agents respond via the shared client."""

import asyncio
import sys
from dotenv import load_dotenv

load_dotenv()

from services.lemma_client import check_lemma_health, load_lemma_config, run_agent


async def main() -> int:
    print("=== CareerOS Lemma Agent Test ===\n")

    health = await check_lemma_health()
    if not health.get("connected"):
        print("Lemma connection failed:", health.get("error"))
        return 1

    print(f"Connected to Lemma at {health['base_url']}")
    print(f"Pod ID: {health['pod_id']}")
    print(f"Agents ({health['agent_count']}):")
    for name in health.get("agents", []):
        print(f"  - {name}")

    config = load_lemma_config()
    prompt = (
        "Resume: Python backend developer, FastAPI, SQL\n\n"
        "Job Description: Looking for a Python Developer with experience in FastAPI, MongoDB, Docker.\n\n"
        "Return a JSON object with match_score, strengths, missing_skills, and reasoning."
    )

    print("\nRunning opportunity-intelligence agent...")
    result = await run_agent(config, "opportunity-intelligence", prompt)
    print("\nAgent response:")
    print(result[:2000] + ("..." if len(result) > 2000 else ""))
    print("\n=== Lemma agent test passed ===")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
