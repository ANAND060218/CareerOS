import asyncio
import json
from dotenv import load_dotenv
load_dotenv()

from services.workflow_service import _enrich_mentor_result

async def main():
    print("Testing Mentor Result Roadmap & Suggestions Enrichment...")
    resume = (
        "Anand V. Student. B.Tech in CSBS (CGPA: 8.53). Zoho Software Developer Intern. "
        "Experience with Spring Boot backends, OAuth2 Zoho Cliq extensions, webhooks, Zoho Catalyst, "
        "asynchronous processing. Built offline Knowledge Platform NORA using Electron and FastAPI/ChromaDB. "
        "Built GitSense AI tool."
    )
    job = (
        "Accenture is looking for an Infra Tech Support Practitioner. "
        "Must have skills: Splunk Enterprise Architecture and Design. "
        "Good to have: Python, Ansible on Microsoft Azure. Minimum 5 years of experience."
    )
    
    dummy_intel = {
        "gaps": ["No Splunk experience", "No Ansible experience"]
    }
    
    dummy_mentor = {
        "optimized_resume": "Plain resume text without comparisons",
        "ats_suggestions": [],
        "skills": []
    }
    
    try:
        enriched = await _enrich_mentor_result(dummy_mentor, resume, job, dummy_intel)
        print("\nEnrichment Successful!")
        print(f"Number of sequential skills: {len(enriched.get('skills', []))}")
        print("\nSample Resume Suggestion Content (first 300 chars):")
        print(enriched.get('optimized_resume', '')[:300])
        
        print("\nRoadmap sample:")
        if enriched.get('skills'):
            print(json.dumps(enriched['skills'][0], indent=2))
    except Exception as e:
        print("\nEnrichment failed:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
