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
lemma agent create opportunity-scout --instructions "You discover the best jobs by analyzing 5000+ scraped jobs against the user's AI Memory." || true
lemma agent create job-matcher --instructions "You analyze a specific job and the user's skills to determine strengths, missing skills, and match percentage." || true
lemma agent create resume-advisor --instructions "You rewrite the user's resume for a specific job to maximize ATS compatibility." || true
lemma agent create career-mentor --instructions "You provide high-level career guidance on positioning for this specific role." || true
lemma agent create application-strategist --instructions "You review the match, resume, and mentor advice to make a final recommendation: Apply Now, Wait, or Skip." || true
lemma agent create interview-coach --instructions "You generate behavioral and technical questions based on the job description." || true

echo "Creating Workflows..."
lemma workflow create job-discovery || true
lemma workflow create application-pipeline || true
lemma workflow create status-update || true

echo "Lemma setup completed."
echo "Next: run the backend and frontend from the repo root."
