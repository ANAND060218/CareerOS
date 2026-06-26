import os
import json
from google import genai
from pydantic import BaseModel

class AIService:
    @staticmethod
    def get_gemini_client():
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "GEMINI_API_KEY":
            return genai.Client()
        return genai.Client(api_key=api_key)

    @staticmethod
    async def generate(prompt: str, provider: str = "gemini"):
        if provider == "gemini":
            client = AIService.get_gemini_client()
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
        return {
            "match_score": 0,
            "missing_skills": [],
            "strengths": [],
            "weaknesses": [],
            "reasoning": "Failed to analyze."
        }
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
        return {
            "optimized_resume": resume_text,
            "ats_suggestions": ["Failed to analyze"],
            "keyword_suggestions": []
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
            "behavioral_questions": [],
            "technical_questions": [],
            "preparation_plan": "Failed to analyze"
        }
    return result
