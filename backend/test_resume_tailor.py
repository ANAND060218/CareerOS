import asyncio
import json
import os
import sys
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.lemma_client import load_lemma_config, run_agent
from services.workflow_service import extract_json

async def test_resume_tailor():
    # Load Lemma config
    config = load_lemma_config()
    print(f"Loaded config: base_url={config.base_url}, pod_id={config.pod_id}")
    
    # Create a test master profile
    master_profile = {
        "personal_info": {
            "name": "Test User",
            "email": "test@example.com",
            "phone": "123-456-7890",
            "location": "Chennai, India"
        },
        "professional_summary": "Final-year Computer Science student with internship experience in software development.",
        "education": [
            {
                "institution": "CIT Chennai",
                "degree": "B.Tech",
                "field_of_study": "Computer Science",
                "start_date": "2022",
                "end_date": "2026"
            }
        ],
        "experience": [
            {
                "company": "Zoho",
                "role": "SDE Intern",
                "location": "Chennai",
                "start_date": "Feb 2026",
                "end_date": "March 2026",
                "description": ["Completed SDE internship gaining hands-on exposure to software development processes."],
                "is_current": False
            }
        ],
        "projects": [
            {
                "name": "Portfolio Website",
                "technologies": ["React", "Node.js"],
                "description": ["Built a personal portfolio website with modern tech stack."],
                "link": "https://portfolio.example.com"
            }
        ],
        "skills": ["Python", "JavaScript", "React", "Node.js", "SQL"],
        "certifications": []
    }
    
    # Create the prompt
    target_role = "Software Engineer"
    job_description = "Looking for a Software Engineer with experience in Python, JavaScript, React, and database management."
    
    prompt = f"""
    You are resume-tailor. You receive a MASTER_PROFILE (JSON object containing personal_info, professional_summary, education, experience, projects, skills, certifications) and a TARGET_ROLE with optional JOB_DESCRIPTION. Your job is to tailor the resume for that specific role.
    
    INPUT:
    - MASTER_PROFILE: Complete candidate profile with all resume sections
    - TARGET_ROLE: The job title to tailor for (e.g., "Software Engineer")
    - JOB_DESCRIPTION: Optional job description to align with
    
    PROCESS:
    1. Select the most relevant education, experience, projects, skills, and certifications from MASTER_PROFILE for the TARGET_ROLE.
    2. Rewrite bullet point descriptions to highlight technologies, tools, and methodologies relevant to this target role.
    3. Add quantitative outcomes where possible based on the profile data.
    4. Keep all facts truthful — never invent employers, dates, or tools not in the profile.
    5. Curate a focused skills list matching the target role.
    6. Write a tailored 2-3 sentence professional summary.
    
    OUTPUT (STRICT — no prose, no markdown, no headings):
    Return ONLY a JSON object matching this exact shape:
    {{
      "summary": "<2-3 sentence tailored summary>",
      "skills": ["string", ...],
      "experience": [{{"role","company","start_date","end_date","is_current","location","description":["bullet",...]}}],
      "projects":   [{{"name","description":["bullet",...],"technologies":["..."],"link":""}}],
      "certifications": [{{"name","issuer","date","link":""}}]
    }}
    Your entire reply must be valid JSON parseable by JSON.parse().
    Do NOT wrap in ```json fences. Do NOT add explanations. No other text before or after the JSON.
    
    TARGET_ROLE: {target_role}
    JOB_DESCRIPTION: {job_description}
    
    MASTER_PROFILE:
    {json.dumps(master_profile, indent=2)}
    """
    
    print("=" * 80)
    print("SENDING PROMPT TO resume-tailor AGENT")
    print("=" * 80)
    print(prompt)
    print("=" * 80)
    
    try:
        # Run the agent
        print("\nRunning resume-tailor agent...")
        raw_response = await run_agent(config, "resume-tailor", prompt, poll_seconds=120)
        
        print("\n" + "=" * 80)
        print("RAW AGENT RESPONSE:")
        print("=" * 80)
        print(raw_response)
        print("=" * 80)
        
        # Try to parse JSON
        print("\nAttempting to parse JSON...")
        parsed = extract_json(raw_response)
        
        print("\n" + "=" * 80)
        print("PARSED JSON:")
        print("=" * 80)
        print(json.dumps(parsed, indent=2))
        print("=" * 80)
        
        # Validate structure
        print("\nValidating structure...")
        required_keys = ["summary", "skills", "experience", "projects", "certifications"]
        missing_keys = [k for k in required_keys if k not in parsed]
        if missing_keys:
            print(f"ERROR: Missing required keys: {missing_keys}")
        else:
            print("SUCCESS: All required keys present")
            print(f"- summary: {parsed.get('summary', '')[:100]}...")
            print(f"- skills: {len(parsed.get('skills', []))} items")
            print(f"- experience: {len(parsed.get('experience', []))} items")
            print(f"- projects: {len(parsed.get('projects', []))} items")
            print(f"- certifications: {len(parsed.get('certifications', []))} items")
            
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_resume_tailor())
