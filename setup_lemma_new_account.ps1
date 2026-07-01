# PowerShell script to configure CareerOS Lemma with a new account

$ErrorActionPreference = "Stop"
$env:PYTHONPATH = "$PSScriptRoot\mock_modules"

Write-Host "=== CareerOS Lemma New Account Setup ===" -ForegroundColor Cyan
Write-Host ""

# 1. Switch CLI to Cloud
Write-Host "[1/6] Selecting cloud server..." -ForegroundColor Cyan
lemma servers cloud --use

# 2. Login
Write-Host "[2/6] Logging out from previous account and logging in to the new account..." -ForegroundColor Cyan
try {
    lemma auth logout 2>$null
} catch {}
Write-Host "A browser window will open now. Please log in with your NEW Lemma account..." -ForegroundColor Yellow
lemma auth login

# Resolve default organization for the new account to avoid 403 errors
Write-Host "Resolving default organization for your new account..." -ForegroundColor Cyan
$orgsJson = lemma orgs list --json
$orgs = $orgsJson | ConvertFrom-Json
if ($orgs -and $orgs.Count -gt 0) {
    $defaultOrgId = $orgs[0].id
    Write-Host "Setting active organization to: $defaultOrgId"
    lemma config set-default-org $defaultOrgId > $null
} else {
    Write-Warning "Could not find any organizations for this user."
}

# 3. Create Cloud Pod
$podName = "career-os"
Write-Host "[3/6] Creating pod '$podName' on cloud..." -ForegroundColor Cyan
try {
    lemma pod create $podName 2>$null
    Write-Host "  Pod '$podName' created successfully."
} catch {
    Write-Host "  Pod may already exist on your new account or there was a non-blocking issue. Continuing."
}

# 4. Import local bundle
Write-Host "[4/6] Importing local bundle into cloud pod..." -ForegroundColor Cyan
$bundleDir = Join-Path $PSScriptRoot "lemma-cloud-bundle"
if (-not (Test-Path $bundleDir)) {
    Write-Error "Local bundle directory not found at $bundleDir. Cannot import pod contents."
    exit 1
}
lemma pod import $bundleDir --pod $podName

# 5. Fetch new Cloud Pod ID
Write-Host "[5/6] Fetching new cloud Pod ID..." -ForegroundColor Cyan
$pods = (lemma pod list --json | ConvertFrom-Json)
$match = $pods | Where-Object { $_.name -eq $podName } | Select-Object -First 1
if (-not $match) {
    Write-Error "Could not retrieve pod '$podName' from cloud list."
    exit 1
}
$podId = $match.id
Write-Host "  Found Pod ID: $podId" -ForegroundColor Green

# 6. Patch agents
Write-Host "[6/6] Patching all agents on new cloud pod..." -ForegroundColor Cyan
$env:PYTHONPATH = "$PSScriptRoot\mock_modules"
$env:LEMMA_POD_ID = $podId
$env:LEMMA_RUNTIME_PROFILE = "system:lemma"
$env:LEMMA_RUNTIME_MODEL = "deepseek-v4-flash"

Push-Location (Join-Path $PSScriptRoot "backend")
python update_agents_profile.py
Pop-Location

# 7. Update .env file
$envFile = Join-Path $PSScriptRoot "backend\.env"
if (Test-Path $envFile) {
    Write-Host "Updating backend/.env file..." -ForegroundColor Cyan
    $lines = Get-Content $envFile
    $filtered = $lines | Where-Object {
        $_ -notmatch '^\s*LEMMA_POD_ID=' -and
        $_ -notmatch '^\s*LEMMA_RUNTIME_PROFILE=' -and
        $_ -notmatch '^\s*LEMMA_RUNTIME_MODEL=' -and
        $_ -notmatch '^\s*LEMMA_ONLY=' -and
        $_ -notmatch '^\s*LEMMA_API_URL='
    }
    $filtered += "LEMMA_POD_ID=$podId"
    $filtered += "LEMMA_RUNTIME_PROFILE=system:lemma"
    $filtered += "LEMMA_RUNTIME_MODEL=deepseek-v4-flash"
    $filtered += "LEMMA_ONLY=false"
    $filtered += "LEMMA_API_URL=https://api.lemma.work"
    $filtered | Set-Content $envFile -Encoding utf8
    Write-Host "  Successfully updated backend/.env with your new Pod ID and cloud configurations!" -ForegroundColor Green
} else {
    Write-Warning "  backend/.env not found. Please create it and set LEMMA_POD_ID=$podId."
}

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host "New Pod ID: $podId"
Write-Host "Ensure you commit and push the updated backend/.env (if tracked) or prepare it for Render."
Write-Host ""
