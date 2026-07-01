import re
from typing import Dict, List, Any

def parse_resume_text(text: str) -> Dict[str, Any]:
    """
    Parse resume text using regex and pattern matching.
    Extracts structured data without using AI agents.
    """
    result = {
        "personal_info": {},
        "professional_summary": "",
        "education": [],
        "experience": [],
        "projects": [],
        "skills": [],
        "certifications": []
    }
    
    lines = text.split('\n')
    current_section = None
    current_item = {}
    
    # Patterns for matching
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    phone_pattern = r'[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}'
    url_pattern = r'https?://[^\s]+'
    date_pattern = r'(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|(?:\d{1,2}/\d{1,2}/\d{4}|\d{4}-\d{2}-\d{2})|Present'
    
    # Extract personal info from header
    for i, line in enumerate(lines[:20]):  # Check first 20 lines for header
        line = line.strip()
        if not line:
            continue
        
        # Name (usually first non-empty line without special chars)
        if not result["personal_info"].get("name") and len(line.split()) <= 4 and not re.search(r'[@:/.]', line):
            result["personal_info"]["name"] = line
        
        # Email
        email_match = re.search(email_pattern, line)
        if email_match:
            result["personal_info"]["email"] = email_match.group()
        
        # Phone
        phone_match = re.search(phone_pattern, line)
        if phone_match:
            result["personal_info"]["phone"] = phone_match.group()
        
        # Location
        if re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}|[A-Z][a-z]+,\s*[A-Z][a-z]+', line) and not re.search(r'@|http', line):
            result["personal_info"]["location"] = line.strip()
        
        # URLs
        url_matches = re.findall(url_pattern, line)
        for url in url_matches:
            if 'linkedin' in url.lower():
                result["personal_info"]["linkedin"] = url
            elif 'github' in url.lower():
                result["personal_info"]["github"] = url
            elif 'portfolio' in url.lower():
                result["personal_info"]["portfolio"] = url
            else:
                result["personal_info"]["website"] = url
    
    # Parse sections
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Detect section headers
        line_upper = line.upper()
        if 'SUMMARY' in line_upper or 'PROFILE' in line_upper or 'OBJECTIVE' in line_upper:
            current_section = 'summary'
            continue
        elif 'EXPERIENCE' in line_upper or 'WORK' in line_upper or 'EMPLOYMENT' in line_upper:
            current_section = 'experience'
            continue
        elif 'EDUCATION' in line_upper or 'ACADEMIC' in line_upper:
            current_section = 'education'
            continue
        elif 'PROJECT' in line_upper:
            current_section = 'projects'
            continue
        elif 'SKILL' in line_upper:
            current_section = 'skills'
            continue
        elif 'CERTIFICATION' in line_upper or 'CERTIFICATE' in line_upper:
            current_section = 'certifications'
            continue
        
        # Process based on current section
        if current_section == 'summary':
            if result["professional_summary"]:
                result["professional_summary"] += " " + line
            else:
                result["professional_summary"] = line
        
        elif current_section == 'experience':
            # Check if line looks like a job entry (company/role)
            if re.search(r'at|@|-|–', line) and any(word in line.upper() for word in ['ENGINEER', 'DEVELOPER', 'MANAGER', 'ANALYST', 'DESIGNER', 'DIRECTOR']):
                if current_item:
                    result["experience"].append(current_item)
                current_item = {"company": "", "role": "", "location": "", "start_date": "", "end_date": "", "description": [], "is_current": False}
                
                # Try to extract company and role
                parts = re.split(r'at|@|-|–', line, maxsplit=1)
                if len(parts) == 2:
                    current_item["role"] = parts[0].strip()
                    current_item["company"] = parts[1].strip()
                else:
                    current_item["role"] = line.strip()
            
            # Check for dates
            date_matches = re.findall(date_pattern, line)
            if date_matches and current_item:
                if len(date_matches) >= 1:
                    current_item["start_date"] = date_matches[0]
                if len(date_matches) >= 2:
                    current_item["end_date"] = date_matches[1]
                elif 'present' in line.lower():
                    current_item["end_date"] = "Present"
                    current_item["is_current"] = True
            
            # Check for location
            if re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}', line) and current_item:
                current_item["location"] = re.search(r'[A-Z][a-z]+,\s*[A-Z]{2}', line).group()
            
            # Bullet points
            if line.startswith(('•', '-', '*', '·')) or re.match(r'^\d+\.', line):
                bullet = line.lstrip('•-*·0123456789.').strip()
                if current_item:
                    current_item["description"].append(bullet)
        
        elif current_section == 'education':
            # Check if line looks like an education entry
            if re.search(r'University|College|Institute|School', line, re.IGNORECASE):
                if current_item:
                    result["education"].append(current_item)
                current_item = {"institution": line.strip(), "degree": "", "field_of_study": "", "start_date": "", "end_date": "", "grade": ""}
            
            # Degree/field
            if current_item and re.search(r'B\.?Tech|M\.?Tech|B\.?S\.?|M\.?S\.?|PhD|Bachelor|Master|Diploma', line, re.IGNORECASE):
                current_item["degree"] = line.strip()
            
            # Dates
            date_matches = re.findall(date_pattern, line)
            if date_matches and current_item:
                if len(date_matches) >= 1:
                    current_item["start_date"] = date_matches[0]
                if len(date_matches) >= 2:
                    current_item["end_date"] = date_matches[1]
            
            # Grade/CGPA
            if re.search(r'CGPA|GPA|grade|score', line, re.IGNORECASE) and current_item:
                current_item["grade"] = re.search(r'[\d.]+/[\d.]+|[\d.]+', line).group() if re.search(r'[\d.]+', line) else line.strip()
        
        elif current_section == 'projects':
            # Check if line looks like a project entry
            if re.search(r'Project|App|Application|System|Platform', line, re.IGNORECASE) and not line.startswith(('•', '-', '*')):
                if current_item:
                    result["projects"].append(current_item)
                current_item = {"name": line.strip(), "technologies": [], "description": [], "link": ""}
            
            # Technologies
            if current_item and re.search(r'[A-Z][a-z]+,\s*[A-Z][a-z]+|[A-Z][a-z]+\s+[A-Z][a-z]+', line):
                techs = [t.strip() for t in re.split(r',|and|&|\|', line) if t.strip()]
                current_item["technologies"] = techs
            
            # Bullet points
            if line.startswith(('•', '-', '*', '·')) or re.match(r'^\d+\.', line):
                bullet = line.lstrip('•-*·0123456789.').strip()
                if current_item:
                    current_item["description"].append(bullet)
            
            # URL
            url_match = re.search(url_pattern, line)
            if url_match and current_item:
                current_item["link"] = url_match.group()
        
        elif current_section == 'skills':
            # Extract skills from comma-separated or bullet lists
            skills = re.split(r',|;|\||•|-|\*', line)
            for skill in skills:
                skill = skill.strip()
                if skill and len(skill) > 2 and skill not in result["skills"]:
                    result["skills"].append(skill)
        
        elif current_section == 'certifications':
            # Check if line looks like a certification entry
            if re.search(r'Certified|Certificate|Certification', line, re.IGNORECASE):
                if current_item:
                    result["certifications"].append(current_item)
                current_item = {"name": line.strip(), "issuer": "", "date": "", "link": ""}
            
            # Issuer
            if current_item and re.search(r'by|from|@', line, re.IGNORECASE):
                issuer = re.split(r'by|from|@', line, maxsplit=1)[-1].strip()
                current_item["issuer"] = issuer
            
            # Date
            date_match = re.search(date_pattern, line)
            if date_match and current_item:
                current_item["date"] = date_match.group()
            
            # URL
            url_match = re.search(url_pattern, line)
            if url_match and current_item:
                current_item["link"] = url_match.group()
    
    # Add last item if exists
    if current_item:
        if current_section == 'experience':
            result["experience"].append(current_item)
        elif current_section == 'education':
            result["education"].append(current_item)
        elif current_section == 'projects':
            result["projects"].append(current_item)
        elif current_section == 'certifications':
            result["certifications"].append(current_item)
    
    # Add IDs to array items
    import time
    timestamp = time.time()
    for i, exp in enumerate(result["experience"]):
        exp["id"] = f"exp-{timestamp}-{i}"
        if not exp.get("description"):
            exp["description"] = []
        if "is_current" not in exp:
            exp["is_current"] = False
    
    for i, proj in enumerate(result["projects"]):
        proj["id"] = f"proj-{timestamp}-{i}"
        if not proj.get("description"):
            proj["description"] = []
        if not proj.get("technologies"):
            proj["technologies"] = []
    
    for i, edu in enumerate(result["education"]):
        edu["id"] = f"edu-{timestamp}-{i}"
    
    for i, cert in enumerate(result["certifications"]):
        cert["id"] = f"cert-{timestamp}-{i}"
    
    return result
