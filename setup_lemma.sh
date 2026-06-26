#!/bin/bash
# CareerOS Ultimate Lemma Setup Script

echo "Setting up Lemma locally..."
# curl -fsSL https://raw.githubusercontent.com/lemma-work/lemma-platform/main/install.sh | bash

# Point CLI to local server
lemma servers select local

echo "Creating CareerOS Pod..."
lemma pod create career-os

echo "Creating Tables..."
# State Tracking
lemma table create workflow_state --schema '{ "status": "string", "current_agent": "string", "job_id": "string", "timestamp": "datetime" }'
lemma table create ai_memory --schema '{ "user_id": "string", "skills": ["string"], "preferred_roles": ["string"] }'
lemma table create applications

echo "Creating Agents..."
lemma agent create opportunity-scout --instructions "You discover the best jobs by analyzing 5000+ scraped jobs against the user's AI Memory."
lemma agent create job-matcher --instructions "You analyze a specific job and the user's skills to determine strengths, missing skills, and match percentage."
lemma agent create resume-advisor --instructions "You rewrite the user's resume for a specific job to maximize ATS compatibility."
lemma agent create career-mentor --instructions "You provide high-level career guidance on positioning for this specific role."
lemma agent create application-strategist --instructions "You review the match, resume, and mentor advice to make a final recommendation: Apply Now, Wait, or Skip."
lemma agent create interview-coach --instructions "You generate behavioral and technical questions based on the job description."

echo "Creating Workflows..."
lemma workflow create job-discovery
lemma workflow create application-pipeline
lemma workflow create status-update

echo "Lemma Setup Complete for the 10/10 Hackathon MVP!"
