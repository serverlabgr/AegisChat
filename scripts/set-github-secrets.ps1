# Set GitHub Actions secrets for Aegis Windows updater releases.
# Requires: gh auth login, and local signing key at %USERPROFILE%\.tauri\aegis.key
#
# Usage (PowerShell):
#   $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "your-key-password"
#   .\scripts\set-github-secrets.ps1
#
# Optional:
#   $env:VITE_API_URL = "http://192.168.1.235:3001"

$ErrorActionPreference = "Stop"
$Repo = "mpoukas/aegis-chat"
$KeyPath = Join-Path $env:USERPROFILE ".tauri\aegis.key"

if (-not (Test-Path $KeyPath)) {
  throw "Missing signing key: $KeyPath"
}
if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) {
  throw "Set TAURI_SIGNING_PRIVATE_KEY_PASSWORD to the password for aegis.key"
}

$ApiUrl = if ($env:VITE_API_URL) { $env:VITE_API_URL } else { "http://192.168.1.235:3001" }

gh auth status
gh repo view $Repo --json nameWithOwner,visibility,url

Get-Content -Raw $KeyPath | gh secret set TAURI_SIGNING_PRIVATE_KEY --repo $Repo
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo $Repo
$ApiUrl | gh secret set VITE_API_URL --repo $Repo

Write-Host "Secrets set on $Repo :"
Write-Host "  TAURI_SIGNING_PRIVATE_KEY"
Write-Host "  TAURI_SIGNING_PRIVATE_KEY_PASSWORD"
Write-Host "  VITE_API_URL=$ApiUrl"
