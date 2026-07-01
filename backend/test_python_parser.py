import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.resume_text_parser import parse_resume_text

test_resume = """
John Doe
Email: john.doe@example.com
Phone: 123-456-7890
Location: San Francisco, CA
LinkedIn: https://linkedin.com/in/johndoe
GitHub: https://github.com/johndoe
Portfolio: https://johndoe.dev

PROFESSIONAL SUMMARY
Software Engineer with 5 years of experience in full-stack development. 
Expert in Python, JavaScript, React, and Node.js with a strong background in building scalable web applications.

EXPERIENCE
Software Engineer at Google
San Francisco, CA
Jan 2022 - Present
• Developed microservices using Python and Go
• Improved system performance by 40%
• Led a team of 3 junior developers

Software Developer at Microsoft
Redmond, WA
Jun 2019 - Dec 2021
• Built RESTful APIs using Node.js
• Implemented CI/CD pipelines
• Collaborated with cross-functional teams

EDUCATION
B.Tech in Computer Science
Stanford University
2015 - 2019
CGPA: 3.8/4.0

PROJECTS
E-commerce Platform
Technologies: React, Node.js, MongoDB
• Built a full-stack e-commerce platform
• Implemented payment gateway integration
• Achieved 10,000+ monthly users

Task Management App
Technologies: Python, Django, PostgreSQL
• Developed a task management application
• Implemented real-time notifications
• Deployed on AWS

SKILLS
Python, JavaScript, React, Node.js, Go, Django, PostgreSQL, MongoDB, AWS, Docker, Kubernetes

CERTIFICATIONS
AWS Solutions Architect
by Amazon Web Services
Jan 2023
https://aws.amazon.com/certification/

Google Cloud Professional
by Google Cloud
Mar 2022
https://cloud.google.com/certification
"""

print("=" * 80)
print("TESTING PYTHON-BASED RESUME PARSER")
print("=" * 80)

parsed = parse_resume_text(test_resume)

print("\n" + "=" * 80)
print("PARSED RESULTS")
print("=" * 80)

print(f"\nPersonal Info:")
for key, value in parsed["personal_info"].items():
    print(f"  {key}: {value}")

print(f"\nProfessional Summary:")
print(f"  {parsed['professional_summary']}")

print(f"\nEducation ({len(parsed['education'])} items):")
for edu in parsed["education"]:
    print(f"  - {edu.get('institution')}: {edu.get('degree')}")

print(f"\nExperience ({len(parsed['experience'])} items):")
for exp in parsed["experience"]:
    print(f"  - {exp.get('role')} at {exp.get('company')} ({exp.get('start_date')} - {exp.get('end_date')})")

print(f"\nProjects ({len(parsed['projects'])} items):")
for proj in parsed["projects"]:
    print(f"  - {proj.get('name')}: {', '.join(proj.get('technologies', []))}")

print(f"\nSkills ({len(parsed['skills'])} items):")
print(f"  {', '.join(parsed['skills'])}")

print(f"\nCertifications ({len(parsed['certifications'])} items):")
for cert in parsed["certifications"]:
    print(f"  - {cert.get('name')} by {cert.get('issuer')}")

print("\n" + "=" * 80)
print("SUCCESS: Python parser working!")
print("=" * 80)
