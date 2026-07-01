#!/bin/bash
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"

if ! command -v lemma-stack >/dev/null 2>&1; then
  echo "Installing Lemma CLI..."
  curl -fsSL https://raw.githubusercontent.com/lemma-work/lemma-platform/main/install.sh | bash
fi

if ! command -v lemma-stack >/dev/null 2>&1; then
  echo "Lemma CLI is still unavailable after installation."
  exit 1
fi

echo "Installing and starting the local Lemma stack..."
lemma-stack install --runtime docker --channel stable --yes --use-cli --start || true

if ! command -v lemma >/dev/null 2>&1; then
  echo "The lemma CLI was not registered automatically. You may need to run:"
  echo "  lemma-stack install --runtime docker --channel stable --yes --use-cli --start"
  exit 0
fi

echo "Setting up Lemma for CareerOS..."
lemma servers select local || true

echo "Creating CareerOS Pod..."
lemma pod create career-os || true

echo "Creating Tables..."
lemma table create workflow_state --schema '{"status":"string","current_agent":"string","job_id":"string","timestamp":"datetime"}' || true
lemma table create ai_memory --schema '{"user_id":"string","skills":["string"],"preferred_roles":["string"]}' || true
lemma table create applications || true

echo "Creating Agents..."
lemma agent create opportunity-intelligence --instructions "You analyze the job listing, calculate match score, analyze company details, estimate interview difficulty, and show hiring trends." || true
lemma agent create career-mentor --instructions "You analyze resume, optimize formatting, identify skill gaps, and generate learning roadmaps and study plans." || true
lemma agent create application-strategist --instructions "You write cover letters, prepare outreach strategies, outline interview preparation plans, and create follow-up reminders." || true
lemma agent create career-memory --instructions "You store user preferences, track completed skills, log interviews, and learn from user actions to personalize recommendations." || true
lemma agent create resume-tailor --instructions "You are a specialized agent that edits and tailors candidate resume content to align precisely with specific target job roles." || true
lemma agent create ats-scanner --instructions "You are a specialized agent that scans candidate resume versions against target job descriptions to analyze keyword density, scoring compatibility, and highlight formatting opportunities." || true


echo "Creating Workflows..."
lemma workflow create job-discovery || true
lemma workflow create application-pipeline || true
lemma workflow create status-update || true

echo "Lemma setup completed."
echo "Next: run the backend and frontend from the repo root."
