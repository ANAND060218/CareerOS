import asyncio
import json
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.lemma_client import load_lemma_config, auth_headers

intel_schema = {
    "type": "object",
    "required": [
        "match_score",
        "strengths",
        "missing_skills",
        "matched_skills",
        "reasoning",
        "company_intelligence"
    ],
    "properties": {
        "match_score": {"type": "integer"},
        "strengths": {"type": "array", "items": {"type": "string"}},
        "missing_skills": {"type": "array", "items": {"type": "string"}},
        "matched_skills": {"type": "array", "items": {"type": "string"}},
        "reasoning": {"type": "string"},
        "company_intelligence": {
            "type": "object",
            "required": [
                "about",
                "revenue",
                "employee_count",
                "locations",
                "role_package_details",
                "tech_stack",
                "hiring_trend",
                "interview_process",
                "culture",
                "salary_range",
                "red_flags",
                "interview_stages"
            ],
            "properties": {
                "about": {"type": "string"},
                "revenue": {"type": "string"},
                "employee_count": {"type": "string"},
                "locations": {"type": "string"},
                "role_package_details": {"type": "string"},
                "tech_stack": {"type": "array", "items": {"type": "string"}},
                "hiring_trend": {"type": "string"},
                "interview_process": {"type": "string"},
                "culture": {"type": "string"},
                "salary_range": {"type": "string"},
                "red_flags": {"type": "array", "items": {"type": "string"}},
                "interview_stages": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["name", "focus", "duration", "difficulty"],
                        "properties": {
                            "name": {"type": "string"},
                            "focus": {"type": "string"},
                            "duration": {"type": "string"},
                            "difficulty": {"type": "string"}
                        }
                    }
                }
            }
        }
    }
}

mentor_schema = {
    "type": "object",
    "required": [
        "optimized_resume",
        "ats_suggestions",
        "keyword_suggestions",
        "skills"
    ],
    "properties": {
        "optimized_resume": {"type": "string"},
        "ats_suggestions": {"type": "array", "items": {"type": "string"}},
        "keyword_suggestions": {"type": "array", "items": {"type": "string"}},
        "skills": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "difficulty", "hours", "resources"],
                "properties": {
                    "name": {"type": "string"},
                    "difficulty": {"type": "string"},
                    "hours": {"type": "integer"},
                    "resources": {"type": "array", "items": {"type": "string"}}
                }
            }
        }
    }
}

strategist_schema = {
    "type": "object",
    "required": [
        "recommendation",
        "reasoning",
        "cover_letter",
        "checklist",
        "behavioral_questions",
        "technical_questions",
        "interview_rounds",
        "preparation_plan"
    ],
    "properties": {
        "recommendation": {"type": "string"},
        "reasoning": {"type": "string"},
        "cover_letter": {"type": "string"},
        "checklist": {"type": "array", "items": {"type": "string"}},
        "behavioral_questions": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["question", "answer"],
                "properties": {
                    "question": {"type": "string"},
                    "answer": {"type": "string"}
                }
            }
        },
        "technical_questions": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["question", "answer"],
                "properties": {
                    "question": {"type": "string"},
                    "answer": {"type": "string"}
                }
            }
        },
        "interview_rounds": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "focus", "duration"],
                "properties": {
                    "name": {"type": "string"},
                    "focus": {"type": "string"},
                    "duration": {"type": "string"}
                }
            }
        },
        "preparation_plan": {"type": "string"}
    }
}

tailor_schema = {
    "type": "object",
    "required": ["summary", "skills", "experience", "projects", "certifications"],
    "properties": {
        "summary": {"type": "string"},
        "skills": {"type": "array", "items": {"type": "string"}},
        "experience": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["company", "role", "description"],
                "properties": {
                    "company": {"type": "string"},
                    "role": {"type": "string"},
                    "location": {"type": "string"},
                    "start_date": {"type": "string"},
                    "end_date": {"type": "string"},
                    "description": {"type": "array", "items": {"type": "string"}},
                    "is_current": {"type": "boolean"}
                }
            }
        },
        "projects": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name", "technologies", "description"],
                "properties": {
                    "name": {"type": "string"},
                    "technologies": {"type": "array", "items": {"type": "string"}},
                    "description": {"type": "array", "items": {"type": "string"}},
                    "link": {"type": "string"}
                }
            }
        },
        "certifications": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["name"],
                "properties": {
                    "name": {"type": "string"},
                    "issuer": {"type": "string"},
                    "date": {"type": "string"},
                    "link": {"type": "string"}
                }
            }
        }
    }
}

scanner_schema = {
    "type": "object",
    "required": ["ats_score", "ats_suggestions", "keyword_suggestions"],
    "properties": {
        "ats_score": {"type": "integer"},
        "ats_suggestions": {"type": "array", "items": {"type": "string"}},
        "keyword_suggestions": {"type": "array", "items": {"type": "string"}}
    }
}

insights_schema = {
    "type": "object",
    "required": ["insights"],
    "properties": {
        "insights": {
            "type": "array",
            "items": {
                "type": "object",
                "required": [
                    "id", "job_id", "company", "title", "status",
                    "insight", "action_type", "action_label", "action_url"
                ],
                "properties": {
                    "id": {"type": "string"},
                    "job_id": {"type": "string"},
                    "company": {"type": "string"},
                    "title": {"type": "string"},
                    "status": {"type": "string"},
                    "insight": {"type": "string"},
                    "action_type": {"type": "string"},
                    "action_label": {"type": "string"},
                    "action_url": {"type": "string"}
                }
            }
        }
    }
}

async def update_agent(client, config, name, output_schema):
    url = f"{config.base_url}/pods/{config.pod_id}/agents/{name}"
    headers = auth_headers(config)
    payload = {
        "output_schema": output_schema
    }
    
    print(f"Updating agent '{name}' schema...")
    res = await client.patch(url, json=payload, headers=headers)
    if res.status_code in [200, 201, 204]:
        print(f"[SUCCESS] Successfully updated agent '{name}' schema!")
        return True
    else:
        print(f"[ERROR] Failed to update agent '{name}': {res.status_code} - {res.text}")
        return False

async def main():
    import httpx
    config = load_lemma_config()
    print(f"Loaded config: base_url={config.base_url}, pod_id={config.pod_id}")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        await update_agent(client, config, "opportunity-intelligence", intel_schema)
        await update_agent(client, config, "career-mentor", mentor_schema)
        await update_agent(client, config, "application-strategist", strategist_schema)
        await update_agent(client, config, "resume-tailor", tailor_schema)
        await update_agent(client, config, "ats-scanner", scanner_schema)
        await update_agent(client, config, "insights-agent", insights_schema)

if __name__ == "__main__":
    asyncio.run(main())
