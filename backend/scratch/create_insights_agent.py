import asyncio
import os
import sys
import httpx
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from services.lemma_client import auth_headers, load_lemma_config

insights_schema = {
    "type": "object",
    "required": ["insights"],
    "properties": {
        "insights": {
            "type": "array",
            "items": {
                "type": "object",
                "required": [
                    "id",
                    "job_id",
                    "company",
                    "title",
                    "status",
                    "insight",
                    "action_type",
                    "action_label",
                    "action_url"
                ],
                "properties": {
                    "id": {"type": "string"},
                    "job_id": {"type": "string"},
                    "company": {"type": "string"},
                    "title": {"type": "string"},
                    "status": {"type": "string"},
                    "insight": {"type": "string"},
                    "action_type": {"type": "string"},
                    "action_label": {"type": "string"},
                    "action_url": {"type": "string"}
                }
            }
        }
    }
}

async def main():
    config = load_lemma_config()
    headers = auth_headers(config)
    
    print(f"Lemma Config: base_url={config.base_url}, pod_id={config.pod_id}")
    
    # 1. Fetch existing agents
    print("Fetching existing agents...")
    existing_agents = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(f"{config.base_url}/pods/{config.pod_id}/agents", headers=headers)
        if res.status_code == 200:
            existing_agents = [a.get("name") for a in res.json().get("items", []) if a.get("name")]
            print(f"Existing agents: {existing_agents}")
        else:
            print(f"Failed to fetch agents: {res.status_code} - {res.text}")
            return
            
    # 2. Create insights-agent if missing
    agent_name = "insights-agent"
    async with httpx.AsyncClient(timeout=30.0) as client:
        if agent_name not in existing_agents:
            print(f"Creating agent '{agent_name}'...")
            payload = {
                "name": agent_name,
                "instruction": "You analyze the candidate's profile details and their job applications status to generate custom, actionable career suggestions."
            }
            create_res = await client.post(
                f"{config.base_url}/pods/{config.pod_id}/agents",
                json=payload,
                headers=headers
            )
            print(f"Create status: {create_res.status_code} - {create_res.text[:200]}")
        else:
            print(f"Agent '{agent_name}' already exists.")
            
        # 3. Patch runtime profile to match pod standard
        profile_id = "system:lemma"
        model_name = "deepseek-v4-flash"
        
        print(f"Patching agent runtime profile: profile={profile_id}, model={model_name}...")
        runtime_payload = {
            "agent_runtime": {
                "profile_id": profile_id,
                "model_name": model_name
            }
        }
        runtime_res = await client.patch(
            f"{config.base_url}/pods/{config.pod_id}/agents/{agent_name}",
            json=runtime_payload,
            headers=headers
        )
        print(f"Runtime patch status: {runtime_res.status_code}")
        
        # 4. Patch output schema
        print("Patching output schema to follow insights structure...")
        schema_payload = {
            "output_schema": insights_schema
        }
        schema_res = await client.patch(
            f"{config.base_url}/pods/{config.pod_id}/agents/{agent_name}",
            json=schema_payload,
            headers=headers
        )
        print(f"Schema patch status: {schema_res.status_code} - {schema_res.text[:200]}")
        
        if schema_res.status_code in (200, 201, 204):
            print(f"[SUCCESS] Agent '{agent_name}' is fully created and configured with the required insights schema!")

if __name__ == "__main__":
    asyncio.run(main())
