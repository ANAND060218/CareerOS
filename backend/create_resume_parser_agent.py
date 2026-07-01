import asyncio
import os
import sys
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.lemma_client import load_lemma_config, auth_headers

async def create_resume_parser_agent():
    config = load_lemma_config()
    print(f"Loaded config: base_url={config.base_url}, pod_id={config.pod_id}")
    
    import httpx
    
    async with httpx.AsyncClient() as client:
        url = f"{config.base_url}/pods/{config.pod_id}/agents"
        headers = auth_headers(config)
        
        agent_config = {
            "name": "resume-parser",
            "description": "Parses resume text into structured JSON format for auto-filling master profiles",
            "visibility": "POD",
            "instruction": "You are a resume parser. Your job is to extract structured information from resume text and return it as valid JSON.\n\nYou will receive resume text and must return ONLY a JSON object with this exact structure:\n{\n  \"personal_info\": {\n    \"name\": \"Full Name\",\n    \"email\": \"email@example.com\",\n    \"phone\": \"phone number\",\n    \"location\": \"City, Country\",\n    \"linkedin\": \"linkedin URL or empty string\",\n    \"github\": \"github URL or empty string\",\n    \"portfolio\": \"portfolio URL or empty string\",\n    \"website\": \"website URL or empty string\"\n  },\n  \"professional_summary\": \"2-3 sentence professional summary\",\n  \"education\": [\n    {\n      \"institution\": \"University name\",\n      \"degree\": \"Degree type\",\n      \"field_of_study\": \"Field of study\",\n      \"start_date\": \"Start date\",\n      \"end_date\": \"End date\",\n      \"grade\": \"Grade/CGPA or empty string\"\n    }\n  ],\n  \"experience\": [\n    {\n      \"company\": \"Company name\",\n      \"role\": \"Job title\",\n      \"location\": \"Location\",\n      \"start_date\": \"Start date\",\n      \"end_date\": \"End date or 'Present'\",\n      \"description\": [\"bullet point 1\", \"bullet point 2\"],\n      \"is_current\": false\n    }\n  ],\n  \"projects\": [\n    {\n      \"name\": \"Project name\",\n      \"technologies\": [\"tech1\", \"tech2\"],\n      \"description\": [\"bullet point 1\", \"bullet point 2\"],\n      \"link\": "project URL or empty string\"\n    }\n  ],\n  \"skills\": [\"skill1\", \"skill2\", \"skill3\"],\n  \"certifications\": [\n    {\n      \"name\": \"Certification name\",\n      \"issuer\": \"Issuer name\",\n      \"date\": \"Date earned\",\n      \"link\": \"Certification URL or empty string\"\n    }\n  ]\n}\n\nCRITICAL: Your entire response must be valid JSON parseable by JSON.parse(). Do NOT wrap in ```json fences. Do NOT add explanations. No other text before or after the JSON.",
            "agent_runtime": {
                "profile_id": "system:lemma",
                "model_name": "deepseek-v4-flash"
            },
            "output_schema": None  # No structured output, return raw JSON
        }
        
        print("\nCreating resume-parser agent...")
        response = await client.post(url, json=agent_config, headers=headers)
        print(f"Response status: {response.status_code}")
        
        if response.status_code in [200, 201]:
            print("[SUCCESS] resume-parser agent created!")
            print(f"Response: {response.json()}")
        else:
            print(f"[ERROR] Failed to create agent: {response.text}")

if __name__ == "__main__":
    asyncio.run(create_resume_parser_agent())
