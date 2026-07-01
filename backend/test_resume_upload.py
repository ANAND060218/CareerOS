import asyncio
import os
import sys
from dotenv import load_dotenv
load_dotenv()

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.resume_parser import extract_text_from_upload
from services.lemma_client import load_lemma_config, run_agent
from services.workflow_service import extract_json

async def test_resume_parsing():
    # Create a test resume text
    test_resume = """
    John Doe
    Email: john.doe@example.com
    Phone: 123-456-7890
    Location: San Francisco, CA
    LinkedIn: linkedin.com/in/johndoe
    GitHub: github.com/johndoe

    PROFESSIONAL SUMMARY
    Software Engineer with 5 years of experience in full-stack development. 
    Expert in Python, JavaScript, React, and Node.js with a strong background in building scalable web applications.

    EXPERIENCE
    Software Engineer at Google
    San Francisco, CA
    Jan 2022 - Present
    - Developed microservices using Python and Go
    - Improved system performance by 40%
    - Led a team of 3 junior developers

    Software Developer at Microsoft
    Redmond, WA
    Jun 2019 - Dec 2021
    - Built RESTful APIs using Node.js
    - Implemented CI/CD pipelines
    - Collaborated with cross-functional teams

    EDUCATION
    B.Tech in Computer Science
    Stanford University
    2015 - 2019
    CGPA: 3.8/4.0

    PROJECTS
    E-commerce Platform
    Technologies: React, Node.js, MongoDB
    - Built a full-stack e-commerce platform
    - Implemented payment gateway integration
    - Achieved 10,000+ monthly users

    Task Management App
    Technologies: Python, Django, PostgreSQL
    - Developed a task management application
    - Implemented real-time notifications
    - Deployed on AWS

    SKILLS
    Python, JavaScript, React, Node.js, Go, Django, PostgreSQL, MongoDB, AWS, Docker, Kubernetes

    CERTIFICATIONS
    AWS Solutions Architect
    Amazon Web Services
    Jan 2023
    https://aws.amazon.com/certification/

    Google Cloud Professional
    Google Cloud
    Mar 2022
    https://cloud.google.com/certification
    """
    
    print("=" * 80)
    print("TESTING RESUME PARSING")
    print("=" * 80)
    
    # Test 1: Direct text parsing
    print("\nTest 1: Parsing resume text directly...")
    prompt = f"""
    You are a resume parser. Extract structured information from the following resume text.
    
    Resume Text:
    {test_resume}
    
    Return ONLY a JSON object with this exact structure:
    {{
      "personal_info": {{
        "name": "Full Name",
        "email": "email@example.com",
        "phone": "phone number",
        "location": "City, Country",
        "linkedin": "linkedin URL or empty string",
        "github": "github URL or empty string",
        "portfolio": "portfolio URL or empty string",
        "website": "website URL or empty string"
      }},
      "professional_summary": "2-3 sentence professional summary",
      "education": [
        {{
          "institution": "University name",
          "degree": "Degree type",
          "field_of_study": "Field of study",
          "start_date": "Start date",
          "end_date": "End date",
          "grade": "Grade/CGPA or empty string"
        }}
      ],
      "experience": [
        {{
          "company": "Company name",
          "role": "Job title",
          "location": "Location",
          "start_date": "Start date",
          "end_date": "End date or 'Present'",
          "description": ["bullet point 1", "bullet point 2"],
          "is_current": false
        }}
      ],
      "projects": [
        {{
          "name": "Project name",
          "technologies": ["tech1", "tech2"],
          "description": ["bullet point 1", "bullet point 2"],
          "link": "project URL or empty string"
        }}
      ],
      "skills": ["skill1", "skill2", "skill3"],
      "certifications": [
        {{
          "name": "Certification name",
          "issuer": "Issuer name",
          "date": "Date earned",
          "link": "Certification URL or empty string"
        }}
      ]
    }}
    
    Your entire response must be valid JSON parseable by JSON.parse().
    Do NOT wrap in ```json fences. Do NOT add explanations.
    """
    
    try:
        # Use ats-scanner Lemma agent (now with resume parsing capability)
        config = load_lemma_config()
        print(f"Loaded config: base_url={config.base_url}, pod_id={config.pod_id}")
        print("Calling ats-scanner Lemma agent for resume parsing...")
        raw = await run_agent(config, "ats-scanner", prompt, poll_seconds=180)
        print(f"Raw response length: {len(str(raw))}")
        print(f"Raw response preview: {str(raw)[:500]}...")
        
        parsed = extract_json(raw)
        print(f"\nParsed result type: {type(parsed)}")
        
        if isinstance(parsed, dict):
            print(f"Keys found: {parsed.keys()}")
            print(f"\nPersonal info: {parsed.get('personal_info', {})}")
            print(f"Skills: {parsed.get('skills', [])}")
            print(f"Experience count: {len(parsed.get('experience', []))}")
            print(f"Projects count: {len(parsed.get('projects', []))}")
            print(f"Education count: {len(parsed.get('education', []))}")
            print(f"Certifications count: {len(parsed.get('certifications', []))}")
            print("\nSUCCESS: Resume parsed successfully!")
        else:
            print("ERROR: Parsed result is not a dictionary")
                
    except Exception as e:
        print(f"Lemma failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_resume_parsing())
