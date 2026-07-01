import asyncio
import os
import sys
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.lemma_client import load_lemma_config, auth_headers

async def update_ats_scanner_agent():
    config = load_lemma_config()
    print(f"Loaded config: base_url={config.base_url}, pod_id={config.pod_id}")
    
    import httpx
    import json
    
    # Read the updated schema
    with open(os.path.join(os.path.dirname(__file__), '..', 'lemma_schemas', 'ats_scanner.json'), 'r') as f:
        schema = json.load(f)
    
    async with httpx.AsyncClient() as client:
        # First try to delete existing agent
        delete_url = f"{config.base_url}/pods/{config.pod_id}/agents/ats-scanner"
        headers = auth_headers(config)
        
        print("\nDeleting existing ats-scanner agent...")
        delete_response = await client.delete(delete_url, headers=headers)
        print(f"Delete status: {delete_response.status_code}")
        
        # Then create new agent
        create_url = f"{config.base_url}/pods/{config.pod_id}/agents"
        
        print("\nCreating new ats-scanner agent...")
        response = await client.post(create_url, json=schema, headers=headers)
        print(f"Create status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            print("[SUCCESS] ats-scanner agent updated!")
            print(f"Response: {response.json()}")
        else:
            print(f"[ERROR] Failed to create agent: {response.text}")

if __name__ == "__main__":
    asyncio.run(update_ats_scanner_agent())
