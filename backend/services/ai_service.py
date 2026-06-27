import os
import json
import re
from google import genai
from pydantic import BaseModel

class AIService:
    @staticmethod
    def get_gemini_client():
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "GEMINI_API_KEY":
            return None
        return genai.Client(api_key=api_key)

    @staticmethod
    async def generate(prompt: str, provider: str = "gemini"):
        if provider == "gemini":
            client = AIService.get_gemini_client()
            if not client:
                return None
            try:
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                )
                text = response.text.strip()
                if text.startswith("```json"):
                    text = text[7:]
                if text.endswith("```"):
                    text = text[:-3]
                return json.loads(text.strip())
            except Exception as e:
                print(f"Error in Gemini: {e}")
                return None
        elif provider == "openai":
            # Future placeholder
            return None
        else:
            raise ValueError(f"Unknown provider: {provider}")


def _tokenize(text: str):
    return [t.lower() for t in re.findall(r"[a-zA-Z0-9+#.]+", text or "") if len(t) > 2]


def _fallback_match(job_description: str, resume_text: str):
    job_tokens = set(_tokenize(job_description))
    resume_tokens = set(_tokenize(resume_text))
    overlap = sorted(job_tokens.intersection(resume_tokens))
    missing = [token for token in sorted(job_tokens) if token not in resume_tokens][:6]
    strength_tokens = overlap[:5]
    score = min(96, max(35, int((len(overlap) / max(1, len(job_tokens))) * 100)))
    return {
        "match_score": score,
        "missing_skills": missing,
        "strengths": strength_tokens,
        "weaknesses": ["Resume should emphasize target role keywords"],
        "reasoning": "Local workflow analysis matched your resume against the job description using the available text signals."
    }


async def calculate_match(job_description: str, resume_text: str, provider: str = "gemini"):
    prompt = f"""
    You are an expert technical recruiter and ATS system.
    Evaluate the following resume against the given job description.
    
    Job Description:
    {job_description}
    
    Resume:
    {resume_text}
    
    Return the result strictly as a JSON object with this structure (no markdown tags):
    {{
      "match_score": 85,
      "missing_skills": ["Skill1", "Skill2"],
      "strengths": ["Strength1"],
      "weaknesses": ["Weakness1"],
      "reasoning": "A brief explanation"
    }}
    """
    result = await AIService.generate(prompt, provider)
    if not result:
        return _fallback_match(job_description, resume_text)
    return result

async def optimize_resume(resume_text: str, target_job_description: str = "", provider: str = "gemini"):
    prompt = f"""
    You are an expert resume optimizer.
    Improve the following resume to make it more ATS-friendly and impactful.
    {f"Target this specific Job Description: {target_job_description}" if target_job_description else ""}
    
    Resume:
    {resume_text}
    
    Return strictly as a JSON object (no markdown tags):
    {{
      "optimized_resume": "The full revised text of the resume...",
      "ats_suggestions": ["Suggestion 1", "Suggestion 2"],
      "keyword_suggestions": ["Keyword1", "Keyword2"]
    }}
    """
    result = await AIService.generate(prompt, provider)
    if not result:
        keywords = [token for token in _tokenize(target_job_description) if token not in _tokenize(resume_text)][:8]
        return {
            "optimized_resume": f"{resume_text}\n\nTailored summary for this role:\n- Emphasize the most relevant achievements and tools from the target role.\n- Add measurable impact and role-specific keywords such as {', '.join(keywords[:4]) or 'target stack'}.",
            "ats_suggestions": ["Add the role's top keywords to the summary and skills section", "Use quantified achievements and leadership language"],
            "keyword_suggestions": keywords
        }
    return result

async def generate_interview_questions(job_description: str, company: str = "", provider: str = "gemini"):
    prompt = f"""
    You are an expert technical interviewer.
    Generate interview questions based on the following job description.
    {f"The company is: {company}" if company else ""}
    
    Job Description:
    {job_description}
    
    Return strictly as a JSON object (no markdown tags):
    {{
      "behavioral_questions": ["Q1", "Q2"],
      "technical_questions": ["Q1", "Q2"],
      "preparation_plan": "A brief plan on what to study"
    }}
    """
    result = await AIService.generate(prompt, provider)
    if not result:
        return {
            "behavioral_questions": [f"Tell me about a time you delivered impact in a {company or 'team'} setting.", "Describe a challenging project and how you led it."],
            "technical_questions": [f"How would you approach the key technical requirements in this role: {job_description[:120]}...", "What tradeoffs would you make for scalability and delivery speed?"],
            "preparation_plan": "Review the role requirements, prepare examples with measurable impact, and rehearse a concise STAR-based story for the key areas."
        }
    return result
