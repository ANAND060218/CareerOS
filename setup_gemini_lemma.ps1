# Wire GEMINI_API_KEY from backend/.env into a Lemma runtime profile + patch all 6 agents

$ErrorActionPreference = "Stop"
$env:PYTHONPATH = "$PSScriptRoot\mock_modules"

$envFile = Join-Path $PSScriptRoot "backend\.env"
if (-not (Test-Path $envFile)) { Write-Error "backend/.env not found" }

$apiKey = $null
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*GEMINI_API_KEY=(.+)$') { $apiKey = $matches[1].Trim() }
}
if (-not $apiKey) { Write-Error "GEMINI_API_KEY missing in backend/.env" }

Write-Host "Starting Lemma stack..."
try { lemma-stack start 2>$null } catch {}
lemma servers select local

Write-Host "Creating CareerOS Gemini profile..."
$raw = lemma runtime profiles create OPENAI_COMPATIBLE `
    --name "CareerOS Gemini" `
    --base-url "https://generativelanguage.googleapis.com/v1beta/openai" `
    --api-key $apiKey `
    --default-model "gemini-2.5-flash" `
    --model "gemini-2.5-flash" `
    --description "CareerOS hackathon key" 2>&1

$profileId = $null
if ($LASTEXITCODE -eq 0) {
    $profileId = ($raw | ConvertFrom-Json).id
} else {
    $profiles = (lemma runtime profiles list --json | ConvertFrom-Json).items
    $match = $profiles | Where-Object { $_.name -eq "CareerOS Gemini" } | Select-Object -First 1
    if ($match) { $profileId = $match.id }
}

if (-not $profileId) { Write-Error "Could not create or find CareerOS Gemini profile" }
Write-Host "Profile ID: $profileId"

# Update .env
$lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*LEMMA_RUNTIME_PROFILE=' -and $_ -notmatch '^\s*LEMMA_RUNTIME_MODEL=' -and $_ -notmatch '^\s*LEMMA_ONLY=' }
$lines += "LEMMA_RUNTIME_PROFILE=$profileId"
$lines += "LEMMA_RUNTIME_MODEL=gemini-2.5-flash"
$lines += "LEMMA_ONLY=false"
$lines | Set-Content $envFile -Encoding utf8

$env:LEMMA_RUNTIME_PROFILE = $profileId
$env:LEMMA_RUNTIME_MODEL = "gemini-2.5-flash"

Push-Location (Join-Path $PSScriptRoot "backend")
python update_agents_profile.py
Pop-Location

Write-Host ""
Write-Host "Done. All 6 agents use CareerOS Gemini profile."
Write-Host "Restart backend: cd backend; python -m uvicorn main:app --port 5002 --reload"
