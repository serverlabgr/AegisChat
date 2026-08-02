# Download latest (or tagged) Aegis release assets and publish them to the LAN VM
# downloads nginx at http://192.168.1.235:8080/
#
# Example:
#   .\scripts\publish-downloads-to-vm.ps1
#   .\scripts\publish-downloads-to-vm.ps1 -Tag v0.2.6
#   .\scripts\publish-downloads-to-vm.ps1 -RemoveNsisFromGitHub

param(
  [string]$Tag = '',
  [string]$Repo = 'serverlabgr/AegisChat',
  [string]$VmHost = '192.168.1.235',
  [string]$VmUser = 'craccchat',
  [string]$SshKey = "$env:USERPROFILE\.ssh\aegis_vm",
  [string]$RemoteDir = '/opt/aegis-chat/downloads',
  [string]$LanBase = 'http://192.168.1.235:8080',
  [switch]$RemoveNsisFromGitHub
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SshKey)) {
  throw "SSH key not found: $SshKey"
}

if ([string]::IsNullOrWhiteSpace($Tag)) {
  $Tag = (gh release view --repo $Repo --json tagName -q .tagName).Trim()
  if ([string]::IsNullOrWhiteSpace($Tag)) { throw 'Could not resolve latest release tag' }
}

Write-Host "Publishing $Tag from $Repo -> ${VmUser}@${VmHost}:$RemoteDir" -ForegroundColor Cyan

$stage = Join-Path $env:TEMP ("aegis-publish-" + ($Tag -replace '[^\w\.-]', '_'))
if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
New-Item -ItemType Directory -Force -Path $stage | Out-Null

gh release download $Tag --repo $Repo -D $stage --clobber

$setup = Get-ChildItem -LiteralPath $stage -Filter 'Aegis_*_x64-setup.exe' | Select-Object -First 1
$zip = Get-ChildItem -LiteralPath $stage -Filter 'Aegis_*_windows_x64.zip' | Select-Object -First 1
$sig = Get-ChildItem -LiteralPath $stage -Filter 'Aegis_*_x64-setup.exe.sig' | Select-Object -First 1
$latestPath = Join-Path $stage 'latest.json'

if (-not $setup) { throw "Missing NSIS setup in $stage" }
if (-not $zip) { Write-Host 'Warning: portable zip missing' -ForegroundColor Yellow }
if (-not (Test-Path $latestPath)) { throw "Missing latest.json in $stage" }

# Rewrite updater URLs to LAN (avoid GitHub cloud-blocked asset API URLs)
$json = Get-Content -LiteralPath $latestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$lanSetupUrl = "$LanBase/$($setup.Name)"
if ($json.platforms) {
  foreach ($prop in $json.platforms.PSObject.Properties) {
    $prop.Value.url = $lanSetupUrl
  }
}
$json | ConvertTo-Json -Depth 8 | ForEach-Object { [System.IO.File]::WriteAllText($latestPath, $_) }

# Friendly index (repo copy may be older on VM — refresh from release notes)
$indexSrc = Join-Path (Split-Path $PSScriptRoot -Parent) 'downloads\index.html'
if (Test-Path -LiteralPath $indexSrc) {
  Copy-Item -LiteralPath $indexSrc -Destination (Join-Path $stage 'index.html') -Force
}

# Ensure remote dir exists
$sshTarget = "${VmUser}@${VmHost}"
$sshArgs = @('-i', $SshKey, '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=15')
& ssh @sshArgs $sshTarget "mkdir -p '$RemoteDir'"

# Upload assets
$files = @($setup.FullName, $latestPath)
if ($zip) { $files += $zip.FullName }
if ($sig) { $files += $sig.FullName }
$indexStaged = Join-Path $stage 'index.html'
if (Test-Path -LiteralPath $indexStaged) { $files += $indexStaged }

# Keep a stable "latest" copy name for the zip (optional convenience)
if ($zip) {
  Copy-Item $zip.FullName (Join-Path $stage 'Aegis_latest_windows_x64.zip') -Force
  $files += (Join-Path $stage 'Aegis_latest_windows_x64.zip')
}
if ($setup) {
  Copy-Item $setup.FullName (Join-Path $stage 'Aegis_latest_x64-setup.exe') -Force
  $files += (Join-Path $stage 'Aegis_latest_x64-setup.exe')
}

& scp @('-i', $SshKey, '-o', 'StrictHostKeyChecking=no') @files "${sshTarget}:${RemoteDir}/"

Write-Host ''
Write-Host 'Published:' -ForegroundColor Green
Write-Host "  ZIP:   $LanBase/$($zip.Name)"
Write-Host "  ZIP*:  $LanBase/Aegis_latest_windows_x64.zip"
Write-Host "  Setup: $LanBase/$($setup.Name)"
Write-Host "  Setup*:$LanBase/Aegis_latest_x64-setup.exe"
Write-Host "  Meta:  $LanBase/latest.json"
Write-Host "  Index: $LanBase/"

if ($RemoveNsisFromGitHub) {
  Write-Host ''
  Write-Host 'Removing NSIS + GitHub latest.json from GitHub Releases (LAN is source of truth)...' -ForegroundColor Yellow
  foreach ($name in @($setup.Name, 'latest.json')) {
    try {
      gh release delete-asset $Tag $name --repo $Repo --yes
      Write-Host "  deleted $name"
    } catch {
      Write-Host "  skip $name : $_"
    }
  }
}

Write-Host ''
Write-Host 'Verify:' -ForegroundColor Cyan
Write-Host "  curl -I $LanBase/Aegis_latest_windows_x64.zip"
Write-Host "  curl -s $LanBase/latest.json"
