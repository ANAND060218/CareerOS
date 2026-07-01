# WARNING: system:lemma (gpt-4o-mini) fails on LOCAL Lemma stack with 404 generateContent errors.
# Use setup_gemini_lemma.ps1 instead for local development.
# This script is only for lemma.work cloud where system:lemma works.

Write-Host "NOTE: system:lemma does NOT work on local Lemma Docker (routes to Gemini incorrectly)."
Write-Host "Run setup_gemini_lemma.ps1 instead to use your Gemini API key with Lemma agents."
Write-Host ""
$confirm = Read-Host "Continue anyway for cloud Lemma? (y/N)"
if ($confirm -ne "y") { exit 0 }

$env:PYTHONPATH = "$PSScriptRoot\mock_modules"
$env:LEMMA_RUNTIME_PROFILE = "system:lemma"
$env:LEMMA_RUNTIME_MODEL = "gpt-4o"
Push-Location (Join-Path $PSScriptRoot "backend")
python update_agents_profile.py
Pop-Location
