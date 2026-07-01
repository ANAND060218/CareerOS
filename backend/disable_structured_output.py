import asyncio
import json
import os
import sys
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.lemma_client import load_lemma_config, auth_headers

async def disable_structured_output():
    config = load_lemma_config()
    print(f"Loaded config: base_url={config.base_url}, pod_id={config.pod_id}")
    
    import httpx
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Disable structured output for resume-tailor
        url = f"{config.base_url}/pods/{config.pod_id}/agents/resume-tailor"
        headers = auth_headers(config)
        
        # Get current agent config first
        print("\nGetting current resume-tailor config...")
        get_res = await client.get(url, headers=headers)
        print(f"Current config: {get_res.status_code}")
        if get_res.status_code == 200:
            current_config = get_res.json()
            print(json.dumps(current_config, indent=2))
        
        # Update to disable structured output
        payload = {
            "output_schema": None,  # Remove output schema to disable structured output
            "instruction": "You are resume-tailor. You receive a MASTER_PROFILE (JSON object containing personal_info, professional_summary, education, experience, projects, skills, certifications) and a TARGET_ROLE with optional JOB_DESCRIPTION. Your job is to tailor the resume for that specific role.\n\nINPUT:\n- MASTER_PROFILE: Complete candidate profile with all resume sections\n- TARGET_ROLE: The job title to tailor for (e.g., \"Software Engineer\")\n- JOB_DESCRIPTION: Optional job description to align with\n\nPROCESS:\n1. Select the most relevant education, experience, projects, skills, and certifications from MASTER_PROFILE for the TARGET_ROLE.\n2. Rewrite bullet point descriptions to highlight technologies, tools, and methodologies relevant to this target role.\n3. Add quantitative outcomes where possible based on the profile data.\n4. Keep all facts truthful — never invent employers, dates, or tools not in the profile.\n5. Curate a focused skills list matching the target role.\n6. Write a tailored 2-3 sentence professional summary.\n\nOUTPUT (STRICT — no prose, no markdown, no headings):\nReturn ONLY a JSON object matching this exact shape:\n{\n  \"summary\": \"<2-3 sentence tailored summary>\",\n  \"skills\": [\"string\", ...],\n  \"experience\": [{\"role\",\"company\",\"start_date\",\"end_date\",\"is_current\",\"location\",\"description\":[\"bullet\",...]}],\n  \"projects\":   [{\"name\",\"description\":[\"bullet\",...],\"technologies\":[\"...\"],\"link\":\"\"}],\n  \"certifications\": [{\"name\",\"issuer\",\"date\",\"link\":\"\"}]\n}\nYour entire reply must be valid JSON parseable by JSON.parse().\nDo NOT wrap in ```json fences. Do NOT add explanations. No other text before or after the JSON."
        }
        
        print("\nDisabling structured output for resume-tailor...")
        patch_res = await client.patch(url, json=payload, headers=headers)
        print(f"Patch result: {patch_res.status_code}")
        if patch_res.status_code in [200, 201, 204]:
            print("[SUCCESS] Disabled structured output for resume-tailor")
        else:
            print(f"[ERROR] Failed: {patch_res.text}")
        
        # Do the same for ats-scanner
        url2 = f"{config.base_url}/pods/{config.pod_id}/agents/ats-scanner"
        payload2 = {
            "output_schema": None,
            "instruction": "You are ats-scanner. You receive a RESUME_VERSION (JSON object containing all resume sections) and a JOB_DESCRIPTION. Your job is to evaluate ATS compatibility and provide actionable feedback.\n\nINPUT:\n- RESUME_VERSION: Complete resume with personal_info, summary, experience, projects, skills, etc.\n- JOB_DESCRIPTION: The target job description to scan against\n\nPROCESS:\n1. Analyze keyword overlap between resume skills/experience and job requirements.\n2. Evaluate formatting and phrasing for ATS compatibility.\n3. Calculate an ATS score (0-100) based on alignment strength.\n4. Generate 3-5 specific, action-oriented suggestions for improvement.\n5. Identify 5 missing or under-represented keywords/skills from the job description.\n\nOUTPUT (STRICT — no prose, no markdown, no headings):\nReturn ONLY a JSON object matching this exact shape:\n{\n  \"ats_score\": <integer 0-100>,\n  \"ats_suggestions\": [\"action-oriented suggestion 1\", \"action-oriented suggestion 2\", ...],\n  \"keyword_suggestions\": [\"missing keyword 1\", \"missing keyword 2\", ...]\n}\nYour entire reply must be valid JSON parseable by JSON.parse().\nDo NOT wrap in ```json fences. Do NOT add explanations. No other text before or after the JSON."
        }
        
        print("\nDisabling structured output for ats-scanner...")
        patch_res2 = await client.patch(url2, json=payload2, headers=headers)
        print(f"Patch result: {patch_res2.status_code}")
        if patch_res2.status_code in [200, 201, 204]:
            print("[SUCCESS] Disabled structured output for ats-scanner")
        else:
            print(f"[ERROR] Failed: {patch_res2.text}")

if __name__ == "__main__":
    asyncio.run(disable_structured_output())
