# Deploy CareerOS Lemma pod to lemma.work for hackathon judges.
# Local Docker does NOT provide free LLM - cloud lemma.work does (Lemma credits via system:lemma).

$ErrorActionPreference = "Stop"
$env:PYTHONPATH = "$PSScriptRoot\mock_modules"

$bundleDir = Join-Path $PSScriptRoot "lemma-cloud-bundle"
$podName = "career-os"

Write-Host ""
Write-Host "=== CareerOS -> lemma.work (judge-ready deploy) ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Why this matters:"
Write-Host "  - Your Gemini key is exhausted (429) - local Lemma uses the SAME key"
Write-Host "  - Local Docker cannot run system:lemma LLM (404 on gpt-4o-mini)"
Write-Host "  - lemma.work cloud HAS Lemma-hosted models (free starter credits)"
Write-Host ""

Write-Host "[1/6] Export local pod bundle..."
lemma servers select local
if (Test-Path $bundleDir) { Remove-Item -Recurse -Force $bundleDir }
lemma pod export $bundleDir --pod $podName --force

Write-Host "[2/6] Switch CLI to Lemma Cloud..."
lemma servers cloud --use

Write-Host "[3/6] Login to lemma.work (browser opens if needed)..."
lemma auth login

Write-Host "[4/6] Create or reuse cloud pod '$podName'..."
try {
    lemma pod create $podName 2>$null
} catch {
    Write-Host "  Pod may already exist on cloud - continuing."
}

Write-Host "[5/6] Import bundle into cloud pod..."
lemma pod import $bundleDir --pod $podName

Write-Host "[6/6] Point all 6 agents at Lemma-hosted model (system:lemma)..."
$env:LEMMA_RUNTIME_PROFILE = "system:lemma"
$env:LEMMA_RUNTIME_MODEL = "gpt-4o-mini"
Push-Location (Join-Path $PSScriptRoot "backend")
python update_agents_profile.py
Pop-Location

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps for judges:"
Write-Host "  1. Open https://lemma.work and open pod '$podName'"
Write-Host "  2. Pod Settings -> Default Agent Runtime -> system:lemma / gpt-4o-mini"
Write-Host "  3. Grant pod access to ayush@gappy.ai (Pod Settings -> Members)"
Write-Host "  4. Test: run job-matcher agent in Lemma UI - should NOT show 404"
Write-Host ""
Write-Host "For CareerOS web app (optional live link):"
Write-Host "  - Host backend on Render/Railway with MONGO_URI + GEMINI_API_KEY"
Write-Host "  - Set LEMMA_API_URL=https://api.lemma.work and cloud LEMMA_POD_ID in backend/.env"
Write-Host "  - Host frontend on Vercel with VITE_API_URL pointing to your backend"
Write-Host "  - OR submit demo video + lemma.work pod link (hackathon accepts this)"
Write-Host ""
Write-Host "Submission form: https://forms.gle/Uapf6KpBBuVrqdoZA"
Write-Host "Deadline: July 1, 2026"
Write-Host ""
