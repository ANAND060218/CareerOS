# PowerShell script to set up Lemma Platform on Windows

# 1. Install Lemma CLI if not installed
if (!(Get-Command lemma-stack -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Lemma CLI..."
    Invoke-RestMethod -Uri "https://raw.githubusercontent.com/lemma-work/lemma-platform/main/install.ps1" | Invoke-Expression
}

if (!(Get-Command lemma-stack -ErrorAction SilentlyContinue)) {
    Write-Error "Lemma CLI (lemma-stack) is still unavailable after installation. Please verify your PATH or run the install.ps1 command manually."
    exit 1
}

# 2. Start Lemma local stack
Write-Host "Installing and starting the local Lemma stack (requires Docker Desktop to be running)..."
lemma-stack install --runtime docker --channel stable --yes --use-cli --start

if (!(Get-Command lemma -ErrorAction SilentlyContinue)) {
    Write-Host "The 'lemma' command was not found in path. Trying to re-run stack start..."
    lemma-stack start
}

# 3. Setup workspace elements in Lemma
Write-Host "Setting up Lemma for CareerOS..."
try { lemma servers select local } catch {}

Write-Host "Creating CareerOS Pod..."
try { lemma pod create career-os } catch {}

Write-Host "Creating Tables..."
try { lemma table create workflow_state --schema '{"status":"string","current_agent":"string","job_id":"string","timestamp":"datetime"}' } catch {}
try { lemma table create ai_memory --schema '{"user_id":"string","skills":["string"],"preferred_roles":["string"]}' } catch {}
try { lemma table create applications } catch {}

Write-Host "Creating Agents..."
try { lemma agent create opportunity-intelligence --instructions "You analyze the job listing, calculate match score, analyze company details, estimate interview difficulty, and show hiring trends." } catch {}
try { lemma agent create career-mentor --instructions "You analyze resume, optimize formatting, identify skill gaps, and generate learning roadmaps and study plans." } catch {}
try { lemma agent create application-strategist --instructions "You write cover letters, prepare outreach strategies, outline interview preparation plans, and create follow-up reminders." } catch {}
try { lemma agent create career-memory --instructions "You store user preferences, track completed skills, log interviews, and learn from user actions to personalize recommendations." } catch {}
try { lemma agent create resume-tailor --instructions "You are a specialized agent that edits and tailors candidate resume content to align precisely with specific target job roles." } catch {}
try { lemma agent create ats-scanner --instructions "You are a specialized agent that scans candidate resume versions against target job descriptions to analyze keyword density, scoring compatibility, and highlight formatting opportunities." } catch {}

Write-Host "Creating Workflows..."
try { lemma workflow create job-discovery } catch {}
try { lemma workflow create application-pipeline } catch {}
try { lemma workflow create status-update } catch {}

Write-Host "Lemma setup completed successfully!"
