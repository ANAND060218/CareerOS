"""Patch Lemma agents to use a runtime profile (Lemma hosted or Gemini BYOK)."""

import os

import httpx
from dotenv import load_dotenv

from services.lemma_client import auth_headers, load_lemma_config, patch_pod_default_profile

load_dotenv()

# Lemma hosted models — no Gemini API key, uses Lemma credits (good for hackathon demo)
# Override in backend/.env: LEMMA_RUNTIME_PROFILE=system:lemma  LEMMA_RUNTIME_MODEL=gpt-4o-mini
RUNTIME_PROFILE = os.getenv("LEMMA_RUNTIME_PROFILE", "system:lemma")
RUNTIME_MODEL = os.getenv("LEMMA_RUNTIME_MODEL", "gpt-4o-mini")

# Legacy Gemini profile (only if you set LEMMA_RUNTIME_PROFILE to a Gemini profile id)
LEGACY_GEMINI_PROFILE = os.getenv(
    "LEMMA_GEMINI_PROFILE_ID",
    "019f07e1-5f82-71f8-908c-61578a73e99c",
)
LEGACY_GEMINI_MODEL = os.getenv("LEMMA_GEMINI_MODEL", "gemini-2.5-flash")

AGENTS = [
    "opportunity-intelligence",
    "career-mentor",
    "application-strategist",
    "career-memory",
    "resume-tailor",
    "ats-scanner",
    "insights-agent",
]

AGENTS_INSTRUCTIONS = {
    "opportunity-intelligence": "You analyze the job listing, calculate match score, analyze company details, estimate interview difficulty, and show hiring trends.",
    "career-mentor": "You analyze resume, optimize formatting, identify skill gaps, and generate learning roadmaps and study plans.",
    "application-strategist": "You write cover letters, prepare outreach strategies, outline interview preparation plans, and create follow-up reminders.",
    "career-memory": "You store user preferences, track completed skills, log interviews, and learn from user actions to personalize recommendations.",
    "resume-tailor": "You are a specialized agent that edits and tailors candidate resume content to align precisely with specific target job roles.",
    "ats-scanner": "You are a specialized agent that scans candidate resume versions against target job descriptions to analyze keyword density, scoring compatibility, and highlight formatting opportunities.",
    "insights-agent": "You analyze the candidate's profile details and their job applications status to generate custom, actionable career suggestions."
}


def resolve_runtime() -> tuple[str, str]:
    # Force system:lemma and deepseek-v4-flash on the cloud pod to prevent minimax-m3 failures while saving credits
    return "system:lemma", "deepseek-v4-flash"


def main() -> None:
    profile_id, model_name = resolve_runtime()
    print(f"Setting all agents -> profile={profile_id!r} model={model_name!r}")

    config = load_lemma_config()
    headers = auth_headers(config)

    # 1. Fetch existing agents
    print("Fetching existing agents on pod...")
    existing_agents = []
    with httpx.Client(timeout=30.0) as client:
        try:
            res = client.get(f"{config.base_url}/pods/{config.pod_id}/agents", headers=headers)
            if res.status_code == 200:
                existing_agents = [a.get("name") for a in res.json().get("items", []) if a.get("name")]
                print(f"  Found existing agents: {existing_agents}")
            else:
                print(f"  Warning: failed to list agents (status {res.status_code}): {res.text[:200]}")
        except Exception as e:
            print(f"  Warning: failed to query list agents: {e}")

    # 2. Create missing agents and patch all
    with httpx.Client(timeout=30.0) as client:
        for agent_name in AGENTS:
            # Create if missing
            if agent_name not in existing_agents:
                print(f"Creating missing agent '{agent_name}'...")
                create_payload = {
                    "name": agent_name,
                    "instruction": AGENTS_INSTRUCTIONS[agent_name]
                }
                create_res = client.post(
                    f"{config.base_url}/pods/{config.pod_id}/agents",
                    json=create_payload,
                    headers=headers
                )
                print(f"  Create status: {create_res.status_code}")
                if create_res.status_code not in (200, 201):
                    print(f"    Failed to create agent: {create_res.text[:300]}")

            # Patch runtime profile
            url = f"{config.base_url}/pods/{config.pod_id}/agents/{agent_name}"
            payload = {
                "agent_runtime": {
                    "profile_id": profile_id,
                    "model_name": model_name,
                }
            }
            response = client.patch(url, json=payload, headers=headers)
            print(f"  Patch status for {agent_name}: {response.status_code}")
            if response.status_code != 200:
                print(f"    {response.text[:300]}")


    if profile_id != "system:lemma":
        if patch_pod_default_profile(profile_id):
            print(f"Pod default profile -> {profile_id!r}")
        else:
            print("Warning: could not set pod default profile (Lemma Web UI may still show system:lemma)")


if __name__ == "__main__":
    main()
