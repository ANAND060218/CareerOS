# Lemma Data Storage and Usage

## Overview

CareerOS uses Lemma SDK as an AI processing engine, but **data persistence is handled by MongoDB**, not Lemma's native storage. This architecture allows for reliable data storage while leveraging Lemma's powerful AI agents and workflows.

## Data Storage Architecture

### Primary Storage: MongoDB Atlas
- **Database**: `jobagg`
- **Collections**:
  - `memory` - User AI memory (skills, preferences, resume text)
  - `applications` - Application tracker data
  - `resumes` - Resume text and metadata
  - `jobs` - Job listings from scraper
  - `events` - Workflow activity timeline
  - `users` - User authentication data

### Lemma Usage: AI Processing Engine
Lemma is used **only for AI agent execution**, not for data persistence:

1. **Agent Execution**: 6 Lemma agents run workflows via REST API
   - `opportunity-scout` - Job ranking and recommendations
   - `job-matcher` - Resume-to-job matching
   - `resume-advisor` - ATS optimization
   - `career-mentor` - Career positioning advice
   - `application-strategist` - Apply/Wait/Skip recommendations
   - `interview-coach` - Interview preparation

2. **Workflow Orchestration**: Backend chains agent calls manually
   - File: `backend/services/workflow_service.py`
   - Each agent receives context from MongoDB memory
   - Results are stored back to MongoDB

3. **Fallback Mechanism**: Gemini API as backup
   - If Lemma fails or quota exhausted, Gemini processes requests
   - Ensures system reliability during hackathon

## Why MongoDB Instead of Lemma Tables?

1. **Reliability**: MongoDB provides consistent, queryable data storage
2. **Flexibility**: Easy to query, filter, and aggregate application data
3. **Simplicity**: Single database for all app data (no split between Lemma and MongoDB)
4. **Performance**: Direct MongoDB access for dashboard analytics and timelines
5. **Development Speed**: Familiar stack for rapid hackathon development

## Data Flow Example

```
User Uploads Resume
  ↓
Extract Text (backend/services/resume_parser.py)
  ↓
Store in MongoDB memory collection
  ↓
Trigger Workflow (optional)
  ↓
Lemma Agent Reads from MongoDB memory
  ↓
Agent Processes (Lemma runtime)
  ↓
Results Stored in MongoDB (applications, events)
  ↓
Dashboard Displays Real Data from MongoDB
```

## Lemma Configuration

- **Pod Name**: `career-os`
- **Pod ID**: Read from `~/.lemma/config.json`
- **Runtime**: Local on `http://127.0.0.1:8711`
- **Agents**: 6 configured agents (see `setup_lemma.ps1`)
- **Profile**: Gemini (can switch to `system:lemma` for demo)

## Key Files

- `backend/services/lemma_client.py` - Lemma REST API client
- `backend/services/workflow_service.py` - Agent orchestration
- `backend/database.py` - MongoDB connection
- `backend/routes/memory.py` - AI memory CRUD
- `backend/routes/events.py` - Timeline events

## Future Improvements

For production deployment, consider:
1. Lemma native workflows (instead of manual REST chaining)
2. Lemma tables for AI-specific data (agent conversations, embeddings)
3. Hybrid approach: MongoDB for app data, Lemma for AI state
4. Lemma surfaces for email/calendar integration

## Current Status

✅ MongoDB handles all data persistence  
✅ Lemma agents process AI workflows  
✅ Fallback to Gemini ensures reliability  
✅ Dashboard shows real data from MongoDB  
❌ Lemma tables not currently used  
❌ Native Lemma workflows not implemented (manual chaining)
