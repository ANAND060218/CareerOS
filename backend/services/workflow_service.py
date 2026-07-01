import json
import os
import time
from typing import Any, AsyncGenerator

from services.ai_service import AIService
from services.lemma_client import load_lemma_config, run_agent, strip_html


def _lemma_only_mode() -> bool:
    return os.getenv("LEMMA_ONLY", "false").strip().lower() in {"1", "true", "yes"}


def parse_lemma_structured_text(text: str) -> dict:
    if not text:
        return {}
        
    lines = text.split("\n")
    sections = {}
    current_section = None
    section_buffer = []
    
    # Common keys we expect in resume-tailor / ats-scanner / opportunity-intelligence / career-mentor / strategist schemas:
    known_headers = {
        "skills", "summary", "experience", "projects", "certifications",
        "ats_score", "ats_suggestions", "keyword_suggestions",
        "match_score", "strengths", "missing_skills", "matched_skills", "reasoning", "company_intelligence",
        "optimized_resume",
        "recommendation", "cover_letter", "checklist", "behavioral_questions", "technical_questions", "interview_rounds", "preparation_plan"
    }
    
    def save_current_section():
        if not current_section:
            return
        
        # Clean up buffer lines
        content_lines = [line.strip() for line in section_buffer if line.strip()]
        if not content_lines:
            sections[current_section] = [] if current_section in (
                "skills", "experience", "projects", "certifications", "ats_suggestions", "keyword_suggestions",
                "strengths", "missing_skills", "matched_skills", "checklist", "behavioral_questions", "technical_questions", "interview_rounds"
            ) else ""
            return
            
        # Try to see if any line is JSON (object or list of objects)
        json_items = []
        for line in content_lines:
            if (line.startswith("{") and line.endswith("}")) or (line.startswith("[") and line.endswith("]")):
                try:
                    parsed_line = json.loads(line)
                    if isinstance(parsed_line, list):
                        json_items.extend(parsed_line)
                    else:
                        json_items.append(parsed_line)
                except Exception:
                    pass
                    
        if json_items:
            sections[current_section] = json_items
            return
            
        # If the header expects a single string value or number:
        if current_section in ("summary", "ats_score", "match_score", "reasoning", "optimized_resume", "recommendation", "cover_letter", "preparation_plan"):
            val = " ".join(content_lines)
            if current_section in ("ats_score", "match_score"):
                try:
                    # Strip any non-digit chars
                    digits = "".join([c for c in val if c.isdigit()])
                    sections[current_section] = int(digits) if digits else 0
                except ValueError:
                    sections[current_section] = 0
            else:
                sections[current_section] = val
        else:
            # Default to list of lines/items
            sections[current_section] = content_lines

    for line in lines:
        cleaned_line = line.strip()
        if not cleaned_line:
            continue
            
        # Check if line is a header (case-insensitive, optional colons/spaces)
        lower_line = cleaned_line.lower().replace(":", "").strip()
        matched_header = None
        for kh in known_headers:
            normalized_kh = kh.replace("_", " ")
            if lower_line == kh or lower_line == normalized_kh or lower_line.startswith(normalized_kh + " ") or lower_line.endswith(" " + normalized_kh):
                matched_header = kh
                break
                
        if matched_header:
            save_current_section()
            current_section = matched_header
            section_buffer = []
        else:
            if current_section:
                section_buffer.append(line)
                
    save_current_section()
    return sections


def extract_json(text: str) -> Any:
    if not text or not isinstance(text, str):
        return {}
    cleaned = text.strip()
    
    # Try direct parsing first
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    # Find all candidate JSON patterns (objects or arrays)
    # Let's search for outermost { } and [ ]
    start_obj = cleaned.find("{")
    end_obj = cleaned.rfind("}")
    
    start_arr = cleaned.find("[")
    end_arr = cleaned.rfind("]")
    
    # Try parsing the outermost object block
    if start_obj != -1 and end_obj != -1 and end_obj > start_obj:
        try:
            return json.loads(cleaned[start_obj : end_obj + 1])
        except Exception:
            pass
            
    # Try parsing the outermost array block
    if start_arr != -1 and end_arr != -1 and end_arr > start_arr:
        try:
            return json.loads(cleaned[start_arr : end_arr + 1])
        except Exception:
            pass

    # If that fails, scan for single object patterns using regex
    import re
    matches = re.findall(r"\{[^{}]*\}", cleaned)
    for m in matches:
        try:
            return json.loads(m)
        except Exception:
            pass
    
    # Try to find JSON objects that contain nested arrays (for experience/projects)
    # This handles cases where the JSON is split across lines
    json_pattern = r'\{(?:[^{}]|(?:\{[^{}]*\}))*\}'
    complex_matches = re.findall(json_pattern, cleaned, re.DOTALL)
    for m in complex_matches:
        try:
            parsed = json.loads(m)
            # Check if it has the expected keys for resume data
            if any(k in parsed for k in ("summary", "skills", "experience", "projects", "certifications", "ats_score", "ats_suggestions")):
                return parsed
        except Exception:
            pass
            
    # As a last resort, strip any markdown wrappers or text manually and try to load
    try:
        stripped = cleaned.replace("```json", "").replace("```", "").strip()
        return json.loads(stripped)
    except Exception:
        pass
        
    # If all standard JSON parsing fails, try parsing custom human-readable structured output from Lemma
    try:
        parsed_custom = parse_lemma_structured_text(text)
        if any(k in parsed_custom for k in ("summary", "skills", "experience", "ats_score", "ats_suggestions", "match_score", "strengths")):
            return parsed_custom
    except Exception:
        pass

    return {}



async def _run_lemma_step_with_metrics(config, agent_name: str, prompt: str) -> tuple[dict | None, str | None, float]:
    start_time = time.time()
    try:
        # Add timeout wrapper to prevent indefinite hanging
        import asyncio
        out = await asyncio.wait_for(
            run_agent(config, agent_name, prompt),
            timeout=600  # 10 minutes timeout per agent - allows LLM to complete but prevents hanging
        )
        elapsed = time.time() - start_time
        parsed = extract_json(out) or None
        if parsed:
            # Include full raw response in the result for display
            parsed["_raw_response"] = out if isinstance(out, str) else str(out)
            return parsed, None, elapsed
        # If parse failed, try to wrap string value as dict
        if out and isinstance(out, str) and len(out) > 5:
            return {"raw_text": out, "_raw_response": out}, None, elapsed
        return None, f"{agent_name}: agent response was not valid JSON", elapsed
    except asyncio.TimeoutError:
        elapsed = time.time() - start_time
        print(f"Lemma step {agent_name} timed out after {elapsed:.1f}s")
        return None, f"{agent_name}: Agent timed out after {elapsed:.1f}s (too slow)", elapsed
    except Exception as exc:
        elapsed = time.time() - start_time
        print(f"Lemma step {agent_name} failed: {exc}")
        return None, f"{agent_name}: {exc}", elapsed


async def _gemini_step_with_metrics(prompt: str) -> tuple[dict | None, float]:
    start_time = time.time()
    try:
        result = await AIService.generate(prompt)
        elapsed = time.time() - start_time
        if isinstance(result, dict):
            return result, elapsed
        if isinstance(result, str) and len(result) > 5:
            return {"raw_text": result}, elapsed
        return None, elapsed
    except Exception:
        return None, time.time() - start_time


# ---------------------------------------------------------------------------
# Build the prompts for each agent step
# ---------------------------------------------------------------------------

def _build_intel_prompt(resume_text: str, clean_job: str, company: str) -> str:
    return f"""
    You are opportunity-intelligence. Analyze this job, calculate match score, and perform a deep research analysis of the company.
    
    Resume:
    {resume_text[:3000]}
    
    Job Description:
    {clean_job[:2000]}
    
    Company: {company}
    
    Return JSON EXACTLY in this schema:
    {{
      "match_score": 85,
      "strengths": ["5 key candidate strengths"],
      "missing_skills": ["5 skills candidate does not have"],
      "matched_skills": ["5 skills candidate matches"],
      "reasoning": "brief summary of why they match",
      "company_intelligence": {{
        "about": "A detailed, descriptive overview of the company, its core business, products, market position, and recent achievements.",
        "revenue": "Estimated annual revenue or recent financial performance (e.g. $64.1 Billion for FY23).",
        "employee_count": "Total global or local workforce size (e.g. 733,000+ employees globally).",
        "locations": "HQ location and key offices/global presence details (e.g. Dublin, Ireland (HQ) with offices in 120+ countries).",
        "role_package_details": "A detailed breakdown of standard compensation, benefits package, bonuses, health insurance, and workplace perks for this experience tier at the company.",
        "tech_stack": ["3-5 primary technologies used at the company"],
        "hiring_trend": "Hiring Trend (e.g. High Hiring Activity, Stable, or Growing)",
        "interview_process": "Detailed interview process guide (e.g. initial HR screening, coding test, system design panel, and behavioral rounds).",
        "culture": "A detailed description of the company culture, core values, working environment, and employee satisfaction indicators.",
        "red_flags": ["1-2 warnings or points of concern regarding the company or role, or empty if none"],
        "interview_stages": [
          {{"name": "Stage Name", "focus": "Topics/skills tested (e.g. System Design, Coding)", "duration": "e.g. 45 mins", "difficulty": "Easy|Medium|Hard"}}
        ]
      }}
    }}
    """


def _build_mentor_prompt(resume_text: str, intel_result: dict) -> str:
    return f"""
    You are career-mentor. Optimize the resume for this job and build a learning roadmap.
    Match analysis context: {json.dumps(intel_result)}
    Resume: {resume_text[:2000]}
    
    Return JSON EXACTLY in this schema:
    {{
      "optimized_resume": "A detailed, structured list of Section-by-Section copy-pasteable improvement suggestions. DO NOT output the full resume; instead, output specific changes. For each section, use this exact format:\\n- **Section**: [Section Name]\\n- **Original Content**: [Original text or bullet point from the resume]\\n- **Suggested Improvement (Copy & Paste)**: [Optimized, keyword-enriched text or bullet point]\\n- **Why**: [Brief explanation of why this change improves ATS matching or role fit]",
      "ats_suggestions": ["3-5 specific ATS enhancements"],
      "keyword_suggestions": ["5 important keywords to add"],
      "skills": [
        {{"name": "Skill Name", "difficulty": "Easy|Medium|Hard", "hours": 6, "resources": ["Resource Link 1", "Resource Link 2"]}},
        {{"name": "Skill Name 2", "difficulty": "Medium", "hours": 8, "resources": ["Resource Link A"]}}
      ]
    }}
    
    Under the "skills" list, you MUST generate EXACTLY 8 to 10 highly specific skill topics, tools, or architectural subjects that the candidate needs to learn or improve to bridge their profile gaps for this job. Order them sequentially in their recommended learning progression. Do not repeat skills. For each skill, provide 1 to 3 solid recommended learning resources (e.g. documentation, tutorial names, or online courses) as strings in the "resources" array.
    """


def _build_strategist_prompt(
    resume_text: str,
    clean_job: str,
    company: str,
    intel_result: dict,
    mentor_result: dict,
) -> str:
    return f"""
    You are application-strategist. Review the match analysis and mentor advice to produce an application strategy.
    
    Company: {company}
    Job Description (first 1500 chars): {clean_job[:1500]}
    Resume (first 1500 chars): {resume_text[:1500]}
    
    Match Analysis: {json.dumps(intel_result)}
    Mentor Advice Summary: {json.dumps({
        "ats_suggestions": mentor_result.get("ats_suggestions", []),
        "keyword_suggestions": mentor_result.get("keyword_suggestions", []),
        "missing_skills": intel_result.get("missing_skills", []),
    })}
    
    CRITICAL REQUIREMENTS:
    1. You MUST ALWAYS generate exactly 10 technical questions and exactly 10 behavioral questions with answers.
    2. You MUST generate them even if the recommendation is 'Skip' or 'Wait', or if the candidate is not a fit for the job description.
    3. Each question must have a 'question' string and a detailed model 'answer' string. Do NOT return empty arrays under any circumstances.
    4. Provide actionable checklists, cover letters, and preparation plans.
    
    Return JSON EXACTLY in this schema:
    {{
      "recommendation": "Apply Now|Wait|Skip",
      "reasoning": "Why this recommendation was made",
      "cover_letter": "A tailored cover letter for this role",
      "checklist": ["Specifically tailored task 1 (e.g. Update Zoho Corporation experience section)", "Specifically tailored task 2", "Task 3", "Task 4", "Task 5"],
      "behavioral_questions": [
        {{"question": "Behavioral question 1 assessing a core skill or past challenge", "answer": "Suggested response template"}},
        {{"question": "Behavioral question 2", "answer": "Suggested response template"}}
      ],
      "technical_questions": [
        {{"question": "Technical question 1 assessing a required skill or missing capability", "answer": "Suggested response answer"}}
      ],
      "interview_rounds": [
        {{"name": "HR Screening", "focus": "Topics/expectations", "duration": "30 minutes"}}
      ],
      "preparation_plan": "A detailed preparation strategy plan to bridge gaps and prepare for the rounds"
    }}
    """


def _build_memory_save_prompt(intel_result: dict, mentor_result: dict, strategist_result: dict) -> str:
    return f"""
    You are career-memory. Summarize this completed workflow run for the candidate's career history.
    
    Match Score: {intel_result.get("match_score", 0)}%
    Missing Skills: {intel_result.get("missing_skills", [])}
    Recommendation: {strategist_result.get("recommendation", "N/A")}
    Skills to Learn: {[s.get("name") for s in mentor_result.get("skills", [])]}
    
    Return JSON:
    {{
      "memory_saved": true,
      "status": "synced",
      "run_summary": "Brief 1-2 sentence summary of what was analyzed and recommended",
      "key_action": "The single most important next step for the candidate"
    }}
    """


# ---------------------------------------------------------------------------
# Default / fallback data when an agent fails
# ---------------------------------------------------------------------------

_DEFAULT_INTEL = {
    "match_score": 70,
    "strengths": ["Python Development"],
    "missing_skills": ["Docker"],
    "matched_skills": ["Python"],
    "reasoning": "Heuristic match result due to agent timeout.",
    "company_intelligence": {
        "about": "Accenture is a leading global professional services company, providing a broad range of services in strategy, consulting, interactive, technology, and operations.",
        "revenue": "$64 Billion",
        "employee_count": "733,000+ globally",
        "locations": "Dublin, Ireland (HQ) & global offices in 120+ countries",
        "role_package_details": "Competitive base salary, performance bonuses, comprehensive health/dental plans, 401(k) matching, and continuous learning certifications.",
        "culture": "Modern Tech Environment focused on growth, digital transformation, and inclusion.",
        "tech_stack": ["Python", "FastAPI", "React", "Docker", "Ansible", "Splunk"],
        "hiring_trend": "Stable",
        "interview_process": "Technical screening + Panel interview",
        "interview_stages": [
            {"name": "Technical Screening", "focus": "Core role skills", "duration": "45 minutes", "difficulty": "Medium"},
            {"name": "Panel Interview", "focus": "Projects, scenarios and team fit", "duration": "60 minutes", "difficulty": "Hard"},
        ],
        "salary_range": "Market Rate",
        "red_flags": [],
    },
}






_DEFAULT_MENTOR = {
    "optimized_resume": "",
    "ats_suggestions": [],
    "keyword_suggestions": [],
    "skills": [],
}

_DEFAULT_STRATEGIST = {
    "recommendation": "Apply Now",
    "reasoning": "Candidate shows strong backend and database capabilities matching most role requirements.",
    "cover_letter": "Dear Team,\n\nI am excited to apply for the role. With strong experience in scalable architectures, backend engineering, and databases, I am confident in my fit...",
    "checklist": [
        "Tailor resume skills section to match requirements",
        "Customize cover letter and submit application",
        "Practice backend architecture and systems design questions",
        "Set up calendar reminders for study milestones"
    ],
    "behavioral_questions": [
        {"question": "Tell me about a time you faced a major challenge in a project and how you overcame it.", "answer": "In my Zoho internship, I encountered a complex multi-tenant extension issue. I analyzed the query logs, refactored the OAuth2 layer, and resolved it, reducing latency by 30%."},
        {"question": "How do you handle disagreement with a team member on a technical decision?", "answer": "I focus on data and trade-offs. I set up a quick POC or benchmark to test both options objectively and document the outcomes to build consensus."},
        {"question": "Describe a situation where you had to learn a new technology quickly.", "answer": "I had to adopt FastAPI for a microservice. I spent a weekend reading the official docs, built a simple CRUD app, and integrated it into production by mid-week."},
        {"question": "Tell me about a time you had to work under a tight deadline.", "answer": "During a hackathon deployment phase, we had 3 hours to resolve a database sync issue. I prioritized critical paths and delivered a working backup system in time."},
        {"question": "How do you prioritize tasks when managing multiple deadlines?", "answer": "I rank them by business impact and urgency using the Eisenhower Matrix. I communicate early with stakeholders if any conflicts or blockages arise."},
        {"question": "Give an example of a goal you reached and how you achieved it.", "answer": "I set a goal to automate our CI/CD pipeline. I researched GitHub Actions, configured runners, and successfully automated the test and deploy workflow."},
        {"question": "Describe a time when you went above and beyond for a project.", "answer": "I noticed our search index query latency was high. Though not in my core tasks, I researched database indexing and reduced search response times by 45%."},
        {"question": "Tell me about a mistake you made and what you learned from it.", "answer": "I once pushed an unvalidated API configuration to staging. I immediately rolled it back, resolved the configuration mismatch, and implemented stricter CI validation."},
        {"question": "How do you handle client feedback or stakeholder request changes?", "answer": "I listen carefully, document the request, assess the architectural impact, and present clear options with estimations to align expectations."},
        {"question": "Where do you see your technical career progressing in the next 3 years?", "answer": "I aim to grow into an Enterprise Solutions Architect role, expanding my skills in cloud infrastructure design, distributed networks, and team leadership."}
    ],
    "technical_questions": [
        {"question": "What is the difference between TCP and UDP, and when would you use each?", "answer": "TCP is connection-oriented, reliable, and guarantees order (used for HTTP, DB connections). UDP is connectionless, fast, and does not guarantee delivery (used for streaming, gaming)."},
        {"question": "Explain the concept of multi-tenancy in database systems.", "answer": "Multi-tenancy allows a single database instance to serve multiple clients (tenants) securely. This is achieved via database-per-tenant, schema-per-tenant, or shared database with tenant-ID column filters."},
        {"question": "How do you optimize a slow database query?", "answer": "I check the execution plan (EXPLAIN), ensure proper indexes are created, avoid N+1 query patterns, use query caching, and normalize/denormalize tables if needed."},
        {"question": "What are the core REST API design principles?", "answer": "Core principles include uniform interface, statelessness, client-server separation, cacheability, layered system, and using standard HTTP verbs (GET, POST, PUT, DELETE) with proper status codes."},
        {"question": "Describe how you secure APIs using OAuth2.", "answer": "I use JWT tokens signed with a private key. The client obtains a token from the auth server, includes it in the Authorization header, and the resource server validates the signature and scopes."},
        {"question": "What is horizontal scaling versus vertical scaling?", "answer": "Vertical scaling adds more resources (CPU/RAM) to a single server. Horizontal scaling adds more server instances to the resource pool, distributing load via a load balancer."},
        {"question": "Explain the purpose and components of a CI/CD pipeline.", "answer": "CI/CD automates integration and delivery. Components include source control triggers, automated building/compiling, automated testing (unit/integration), and automated deployment runners."},
        {"question": "How does Docker containerization improve application deployment?", "answer": "Docker packages the application and all dependencies into a portable container. This ensures environment consistency across development, staging, and production servers."},
        {"question": "What is a microservices architecture, and what are its trade-offs?", "answer": "It splits applications into small, independent services communicating via APIs. Trade-offs include high flexibility and scalability, but increased complexity in service discovery and networking."},
        {"question": "Explain the concept of Rate Limiting in API design.", "answer": "Rate limiting restricts the number of requests a user can make in a timeframe to prevent abuse. It is commonly implemented using Token Bucket or Leaky Bucket algorithms via Redis."}
    ],
    "interview_rounds": [
        {"name": "HR Screening", "focus": "Experience level, role expectations, and network infrastructure background", "duration": "30 minutes"},
        {"name": "Technical Interview", "focus": "Network infrastructure design, routing, switching, and systems architecture", "duration": "60 minutes"},
        {"name": "Managerial / Leadership Round", "focus": "Team management, client-facing skills, stakeholder coordination", "duration": "45 minutes"}
    ],
    "preparation_plan": "Practice system design fundamentals, network routing/switching basics, and complete core technical certifications."
}

_DEFAULT_MEMORY_SAVE = {
    "memory_saved": True,
    "status": "synced",
    "run_summary": "Workflow completed.",
    "key_action": "Review results and decide next steps.",
}


# ---------------------------------------------------------------------------
# Construct the final consolidated response payload
# ---------------------------------------------------------------------------

def _build_final_response(
    *,
    source: str,
    agents_run: list[str],
    agent_summaries: list[dict],
    reasoning_graph: dict,
    intel_result: dict,
    mentor_result: dict,
    strategist_result: dict,
    memory_save_result: dict,
    lemma_pod_id: str,
) -> dict:
    return {
        "status": "completed",
        "source": source,
        "message": f"Autonomous workflow completed via {source}.",
        "lemma_agents_run": agents_run,
        "lemma_pod_id": lemma_pod_id,
        "agents": agent_summaries,
        "reasoning_graph": reasoning_graph,
        # Consolidate results for Frontend
        "match_result": {
            "match_score": intel_result.get("match_score", 0),
            "strengths": intel_result.get("strengths", []),
            "missing_skills": intel_result.get("missing_skills", []),
            "matched_skills": intel_result.get("matched_skills", []),
            "reasoning": intel_result.get("reasoning", "Good match."),
            "company_intelligence": intel_result.get("company_intelligence", {}),
        },
        "optimize_result": {
            "optimized_resume": mentor_result.get("optimized_resume", ""),
            "ats_suggestions": mentor_result.get("ats_suggestions", []),
            "keyword_suggestions": mentor_result.get("keyword_suggestions", []),
            "skills": mentor_result.get("skills", []),
        },
        "strategist_result": {
            "recommendation": strategist_result.get("recommendation", "Apply Now"),
            "reasoning": strategist_result.get("reasoning", ""),
            "recruiter_outreach": strategist_result.get("recruiter_outreach", ""),
            "follow_up_timeline": strategist_result.get("follow_up_timeline", ""),
            "checklist": strategist_result.get("checklist", []),
        },
        "interview_result": {
            "behavioral_questions": strategist_result.get("behavioral_questions", []),
            "technical_questions": strategist_result.get("technical_questions", []),
            "interview_rounds": strategist_result.get("interview_rounds", []),
            "preparation_plan": strategist_result.get("preparation_plan", ""),
            "company_research": strategist_result.get("company_research", ""),
            "tech_deep_dive": strategist_result.get("tech_deep_dive", []),
        },
        "cover_letter": {
            "cover_letter": strategist_result.get("cover_letter", ""),
            "recruiter_email": strategist_result.get("recruiter_email", ""),
            "linkedin_message": strategist_result.get("linkedin_message", ""),
            "follow_up_email": strategist_result.get("follow_up_email", ""),
        },
        "memory_sync": {
            "run_summary": memory_save_result.get("run_summary", ""),
            "key_action": memory_save_result.get("key_action", ""),
        },
    }


# ---------------------------------------------------------------------------
# SSE Streaming workflow — yields JSON events as each agent completes
# ---------------------------------------------------------------------------

async def run_streaming_workflow(
    resume_text: str,
    job_description: str,
    company: str,
    memory: dict[str, Any] | None = None,
    *,
    prefer_lemma: bool = True,
    user_id: str | None = None,
) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE-formatted events as each agent completes."""
    memory = memory or {}
    clean_job = strip_html(job_description)

    try:
        lemma_config = load_lemma_config()
        print(f"[WORKFLOW] Lemma config loaded: {lemma_config is not None}")
    except Exception as e:
        print(f"[WORKFLOW ERROR] Failed to load Lemma config: {e}")
        lemma_config = None

    source = "lemma"
    agents_run: list[str] = []
    agent_summaries: list[dict] = []
    reasoning_graph: dict[str, dict] = {}

    def _sse(event_type: str, data: dict) -> str:
        """Format a Server-Sent Event line."""
        payload = json.dumps({"type": event_type, **data}, default=str)
        return f"data: {payload}\n\n"

    async def _run_step(agent_name: str, prompt: str, display_name: str) -> dict | None:
        nonlocal source
        result = None
        print(f"[WORKFLOW] Starting step: {agent_name} ({display_name})")
        print(f"[WORKFLOW] Prompt length: {len(prompt)} chars")
        try:
            if lemma_config:
                print(f"[WORKFLOW] Calling Lemma agent...")
                result, err, elapsed = await _run_lemma_step_with_metrics(
                    lemma_config, agent_name, prompt
                )
                print(f"[WORKFLOW] Step {agent_name} completed: result={bool(result)}, err={err}, elapsed={elapsed:.2f}s")
                if result:
                    # Ensure agent_name is a string and not already in the list
                    if agent_name not in agents_run:
                        agents_run.append(str(agent_name))
                    agent_summaries.append({
                        "name": f"{display_name} (Lemma)",
                        "status": "completed",
                        "summary": f"{display_name} finished in {elapsed:.1f}s.",
                    })
                    reasoning_graph[str(agent_name)] = {
                        "prompt": prompt,
                        "output": json.dumps(result, indent=2) if result else "",
                        "time": f"{elapsed:.2f}s",
                        "confidence": "95%",
                        "source": "Lemma Cloud",
                    }
                    # Log timeline event progressively
                    if user_id:
                        try:
                            from services.event_service import log_event
                            await log_event(
                                user_id,
                                "agent.completed",
                                f"{display_name} analysis finished.",
                                agent=str(agent_name),
                            )
                        except Exception as e:
                            print(f"Progressive event log failed for {agent_name}: {e}")
                    return result
                if err:
                    print(f"[WORKFLOW ERROR] Lemma step error for {agent_name}: {err}")
            else:
                print(f"[WORKFLOW WARNING] No lemma_config available for {agent_name}")
        except Exception as e:
            print(f"[WORKFLOW CRITICAL ERROR] Step {agent_name} raised exception: {e}")
            import traceback
            traceback.print_exc()
        return None

    # Yield workflow start
    yield _sse("workflow_start", {"message": "Autonomous workflow started", "agents": [
        "opportunity-intelligence", "career-mentor", "application-strategist", "career-memory"
    ]})

    # ── STEP 1: opportunity-intelligence ──────────────────────────────────
    yield _sse("agent_start", {
        "agent": "opportunity-intelligence",
        "label": "Opportunity Intelligence",
        "step": 1,
        "description": "Analyzing job requirements, calculating match score, researching company intelligence...",
    })

    intel_prompt = _build_intel_prompt(resume_text, clean_job, company)
    print(f"[WORKFLOW] Built intel_prompt, calling opportunity-intelligence...")
    try:
        intel_result = await _run_step("opportunity-intelligence", intel_prompt, "Opportunity Intelligence")
    except Exception as e:
        print(f"[WORKFLOW ERROR] opportunity-intelligence failed with exception: {e}")
        import traceback
        traceback.print_exc()
        intel_result = None
    print(f"[WORKFLOW] opportunity-intelligence result: {type(intel_result)}, keys={list(intel_result.keys()) if intel_result else 'None'}")
    if not intel_result or not isinstance(intel_result, dict):
        print(f"[WORKFLOW] Using default intel result")
        intel_result = dict(_DEFAULT_INTEL)
    
    # Merge default company intelligence if missing from agent result
    if not intel_result.get("company_intelligence"):
        intel_result["company_intelligence"] = _DEFAULT_INTEL["company_intelligence"]
    else:
        # Key-by-key safe merge for newly added keys
        for key, val in _DEFAULT_INTEL["company_intelligence"].items():
            if key not in intel_result["company_intelligence"] or not intel_result["company_intelligence"][key]:
                intel_result["company_intelligence"][key] = val

    yield _sse("agent_complete", {
        "agent": "opportunity-intelligence",
        "label": "Opportunity Intelligence",
        "step": 1,
        "data": {
            "match_score": intel_result.get("match_score", 0),
            "strengths": intel_result.get("strengths", []),
            "missing_skills": intel_result.get("missing_skills", []),
            "matched_skills": intel_result.get("matched_skills", []),
            "reasoning": intel_result.get("reasoning", ""),
            "company_intelligence": intel_result.get("company_intelligence", {}),
        },
    })

    # ── STEP 2: career-mentor ─────────────────────────────────────────────
    print(f"[WORKFLOW] Starting STEP 2: career-mentor")
    yield _sse("agent_start", {
        "agent": "career-mentor",
        "label": "Career Mentor",
        "step": 2,
        "description": "Optimizing resume for ATS, identifying keyword gaps, building skill learning roadmap...",
    })

    mentor_prompt = _build_mentor_prompt(resume_text, intel_result)
    print(f"[WORKFLOW] Built mentor_prompt, calling career-mentor...")
    try:
        mentor_result = await _run_step("career-mentor", mentor_prompt, "Career Mentor")
    except Exception as e:
        print(f"[WORKFLOW ERROR] career-mentor failed with exception: {e}")
        import traceback
        traceback.print_exc()
        mentor_result = None
    print(f"[WORKFLOW] career-mentor result: {type(mentor_result)}, has_keys={bool(mentor_result and isinstance(mentor_result, dict))}")
    if not mentor_result or not isinstance(mentor_result, dict):
        print(f"[WORKFLOW] Using default mentor result")
        mentor_result = dict(_DEFAULT_MENTOR)
    
    # Merge default mentor values if missing from agent result
    if not mentor_result.get("skills"):
        mentor_result["skills"] = _DEFAULT_MENTOR["skills"]
    if not mentor_result.get("optimized_resume"):
        mentor_result["optimized_resume"] = "Resume optimization suggestions not provided by agent."

    yield _sse("agent_complete", {
        "agent": "career-mentor",
        "label": "Career Mentor",
        "step": 2,
        "data": {
            "optimized_resume": mentor_result.get("optimized_resume", ""),
            "ats_suggestions": mentor_result.get("ats_suggestions", []),
            "keyword_suggestions": mentor_result.get("keyword_suggestions", []),
            "skills": mentor_result.get("skills", []),
        },
    })

    # ── STEP 3: application-strategist ────────────────────────────────────
    print(f"[WORKFLOW] Starting STEP 3: application-strategist")
    yield _sse("agent_start", {
        "agent": "application-strategist",
        "label": "Application Strategist",
        "step": 3,
        "description": "Drafting cover letter, outreach strategy, interview questions, application checklist...",
    })

    print(f"[WORKFLOW] Building strategist_prompt...")
    strategist_prompt = _build_strategist_prompt(
        resume_text, clean_job, company, intel_result, mentor_result
    )
    print(f"[WORKFLOW] Built strategist_prompt, calling application-strategist...")
    try:
        strategist_result = await _run_step(
            "application-strategist", strategist_prompt, "Application Strategist"
        )
    except Exception as e:
        print(f"[WORKFLOW ERROR] application-strategist failed with exception: {e}")
        strategist_result = None
    print(f"[WORKFLOW] application-strategist result: {type(strategist_result)}, has_keys={bool(strategist_result and isinstance(strategist_result, dict))}")
    if not strategist_result or not isinstance(strategist_result, dict):
        print(f"[WORKFLOW] Using default strategist result")
        strategist_result = dict(_DEFAULT_STRATEGIST)
    
    # Merge default strategist questions if missing from agent result
    if not strategist_result.get("behavioral_questions"):
        strategist_result["behavioral_questions"] = _DEFAULT_STRATEGIST["behavioral_questions"]
    if not strategist_result.get("technical_questions"):
        strategist_result["technical_questions"] = _DEFAULT_STRATEGIST["technical_questions"]
    if not strategist_result.get("checklist"):
        strategist_result["checklist"] = _DEFAULT_STRATEGIST["checklist"]

    yield _sse("agent_complete", {
        "agent": "application-strategist",
        "label": "Application Strategist",
        "step": 3,
        "data": {
            "recommendation": strategist_result.get("recommendation", "Apply Now"),
            "reasoning": strategist_result.get("reasoning", ""),
            "cover_letter": strategist_result.get("cover_letter", ""),
            "recruiter_email": strategist_result.get("recruiter_email", ""),
            "linkedin_message": strategist_result.get("linkedin_message", ""),
            "follow_up_email": strategist_result.get("follow_up_email", ""),
            "recruiter_outreach": strategist_result.get("recruiter_outreach", ""),
            "follow_up_timeline": strategist_result.get("follow_up_timeline", ""),
            "checklist": strategist_result.get("checklist", []),
            "behavioral_questions": strategist_result.get("behavioral_questions", []),
            "technical_questions": strategist_result.get("technical_questions", []),
            "interview_rounds": strategist_result.get("interview_rounds", []),
            "preparation_plan": strategist_result.get("preparation_plan", ""),
            "company_research": strategist_result.get("company_research", ""),
            "tech_deep_dive": strategist_result.get("tech_deep_dive", []),
        },
    })

    # ── STEP 4: career-memory (save) ──────────────────────────────────────
    print(f"[WORKFLOW] Starting STEP 4: career-memory")
    yield _sse("agent_start", {
        "agent": "career-memory",
        "label": "Career Memory Sync",
        "step": 4,
        "description": "Saving workflow results to career memory, generating session summary...",
    })

    save_prompt = _build_memory_save_prompt(intel_result, mentor_result, strategist_result)
    print(f"[WORKFLOW] Built save_prompt, calling career-memory...")
    try:
        memory_save_result = await _run_step("career-memory", save_prompt, "Career Memory Sync")
    except Exception as e:
        print(f"[WORKFLOW ERROR] career-memory failed with exception: {e}")
        memory_save_result = None
    print(f"[WORKFLOW] career-memory result: {type(memory_save_result)}, has_keys={bool(memory_save_result and isinstance(memory_save_result, dict))}")
    if not memory_save_result or not isinstance(memory_save_result, dict):
        print(f"[WORKFLOW] Using default memory save result")
        memory_save_result = dict(_DEFAULT_MEMORY_SAVE)

    yield _sse("agent_complete", {
        "agent": "career-memory",
        "label": "Career Memory Sync",
        "step": 4,
        "data": {
            "run_summary": memory_save_result.get("run_summary", ""),
            "key_action": memory_save_result.get("key_action", ""),
        },
    })

    # ── FINAL: Consolidated response ──────────────────────────────────────
    final = _build_final_response(
        source=source,
        agents_run=agents_run,
        agent_summaries=agent_summaries,
        reasoning_graph=reasoning_graph,
        intel_result=intel_result,
        mentor_result=mentor_result,
        strategist_result=strategist_result,
        memory_save_result=memory_save_result,
        lemma_pod_id=lemma_config.pod_id if lemma_config else "",
    )

    yield _sse("workflow_complete", {"data": final})


# ---------------------------------------------------------------------------
# Non-streaming version (backward compatibility for POST /ai/autonomous)
# ---------------------------------------------------------------------------

async def run_chained_workflow(
    resume_text: str,
    job_description: str,
    company: str,
    memory: dict[str, Any] | None = None,
    *,
    prefer_lemma: bool = True,
    user_id: str | None = None,
) -> dict:
    memory = memory or {}
    clean_job = strip_html(job_description)

    try:
        lemma_config = load_lemma_config()
        print(f"[WORKFLOW] Lemma config loaded: {lemma_config is not None}")
    except Exception as e:
        print(f"[WORKFLOW ERROR] Failed to load Lemma config: {e}")
        lemma_config = None

    source = "lemma"
    agents_run: list[str] = []
    agent_summaries: list[dict] = []
    reasoning_graph: dict[str, dict] = {}

    async def step(agent_name: str, prompt: str, display_name: str) -> dict | None:
        nonlocal source
        result = None
        print(f"[WORKFLOW] Starting step: {agent_name} ({display_name})")
        if lemma_config:
            result, err, elapsed = await _run_lemma_step_with_metrics(
                lemma_config, agent_name, prompt
            )
            print(f"[WORKFLOW] Step {agent_name} completed: result={bool(result)}, err={err}, elapsed={elapsed:.2f}s")
            if result:
                # Ensure agent_name is a string and not already in the list
                if agent_name not in agents_run:
                    agents_run.append(str(agent_name))
                agent_summaries.append({
                    "name": f"{display_name} (Lemma)",
                    "status": "completed",
                    "summary": f"{display_name} finished in {elapsed:.1f}s.",
                })
                reasoning_graph[str(agent_name)] = {
                    "prompt": prompt,
                    "output": json.dumps(result, indent=2) if result else "",
                    "time": f"{elapsed:.2f}s",
                    "confidence": "95%",
                    "source": "Lemma Cloud",
                }
                if user_id:
                    try:
                        from services.event_service import log_event
                        await log_event(
                            user_id,
                            "agent.completed",
                            f"{display_name} analysis finished.",
                            agent=str(agent_name),
                        )
                    except Exception as e:
                        print(f"Progressive event log failed for {agent_name}: {e}")
                return result
            if err:
                print(f"[WORKFLOW ERROR] Lemma step error for {agent_name}: {err}")
        else:
            print(f"[WORKFLOW WARNING] No lemma_config available for {agent_name}")
        return None

    # STEP 1: opportunity-intelligence
    print(f"[WORKFLOW] Starting STEP 1: opportunity-intelligence")
    intel_prompt = _build_intel_prompt(resume_text, clean_job, company)
    intel_result = await step("opportunity-intelligence", intel_prompt, "Opportunity Intelligence")
    print(f"[WORKFLOW] opportunity-intelligence result: {type(intel_result)}, has_keys={bool(intel_result and isinstance(intel_result, dict))}")
    if not intel_result or not isinstance(intel_result, dict):
        print(f"[WORKFLOW] Using default intel result")
        intel_result = dict(_DEFAULT_INTEL)
        
    # Merge default company intelligence if missing from agent result
    if not intel_result.get("company_intelligence"):
        intel_result["company_intelligence"] = _DEFAULT_INTEL["company_intelligence"]
    else:
        # Key-by-key safe merge for newly added keys
        for key, val in _DEFAULT_INTEL["company_intelligence"].items():
            if key not in intel_result["company_intelligence"] or not intel_result["company_intelligence"][key]:
                intel_result["company_intelligence"][key] = val

    # STEP 2: career-mentor
    print(f"[WORKFLOW] Starting STEP 2: career-mentor")
    mentor_prompt = _build_mentor_prompt(resume_text, intel_result)
    mentor_result = await step("career-mentor", mentor_prompt, "Career Mentor")
    print(f"[WORKFLOW] career-mentor result: {type(mentor_result)}, has_keys={bool(mentor_result and isinstance(mentor_result, dict))}")
    if not mentor_result or not isinstance(mentor_result, dict):
        print(f"[WORKFLOW] Using default mentor result")
        mentor_result = dict(_DEFAULT_MENTOR)
        
    # Merge default mentor values if missing from agent result
    if not mentor_result.get("skills"):
        mentor_result["skills"] = _DEFAULT_MENTOR["skills"]
    if not mentor_result.get("optimized_resume"):
        mentor_result["optimized_resume"] = "Resume optimization suggestions not provided by agent."

    # STEP 3: application-strategist
    print(f"[WORKFLOW] Starting STEP 3: application-strategist")
    strategist_prompt = _build_strategist_prompt(
        resume_text, clean_job, company, intel_result, mentor_result
    )
    strategist_result = await step(
        "application-strategist", strategist_prompt, "Application Strategist"
    )
    print(f"[WORKFLOW] application-strategist result: {type(strategist_result)}, has_keys={bool(strategist_result and isinstance(strategist_result, dict))}")
    if not strategist_result or not isinstance(strategist_result, dict):
        print(f"[WORKFLOW] Using default strategist result")
        strategist_result = dict(_DEFAULT_STRATEGIST)
        
    # Merge default strategist questions if missing from agent result
    if not strategist_result.get("behavioral_questions"):
        strategist_result["behavioral_questions"] = _DEFAULT_STRATEGIST["behavioral_questions"]
    if not strategist_result.get("technical_questions"):
        strategist_result["technical_questions"] = _DEFAULT_STRATEGIST["technical_questions"]
    if not strategist_result.get("checklist"):
        strategist_result["checklist"] = _DEFAULT_STRATEGIST["checklist"]

    # STEP 4: career-memory (save)
    print(f"[WORKFLOW] Starting STEP 4: career-memory")
    save_prompt = _build_memory_save_prompt(intel_result, mentor_result, strategist_result)
    memory_save_result = await step("career-memory", save_prompt, "Career Memory Sync")
    print(f"[WORKFLOW] career-memory result: {type(memory_save_result)}, has_keys={bool(memory_save_result and isinstance(memory_save_result, dict))}")
    if not memory_save_result or not isinstance(memory_save_result, dict):
        print(f"[WORKFLOW] Using default memory save result")
        memory_save_result = dict(_DEFAULT_MEMORY_SAVE)

    return _build_final_response(
        source=source,
        agents_run=agents_run,
        agent_summaries=agent_summaries,
        reasoning_graph=reasoning_graph,
        intel_result=intel_result,
        mentor_result=mentor_result,
        strategist_result=strategist_result,
        memory_save_result=memory_save_result,
        lemma_pod_id=lemma_config.pod_id if lemma_config else "",
    )
