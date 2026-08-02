# Serve an Aegis installer / portable zip over LAN (ad-hoc; prefer VM :8080 for the group).
# Permanent hosting: publish to the VM with .\scripts\publish-downloads-to-vm.ps1
# Example: .\scripts\serve-installer.ps1 -Path .\Aegis_0.2.6_windows_x64.zip
param(
  [Parameter(Mandatory = $true)]
  [string]$Path,
  [int]$Port = 8766
)

$ErrorActionPreference = 'Stop'

$full = Resolve-Path -LiteralPath $Path
if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
  throw "File not found: $Path"
}

$name = [System.IO.Path]::GetFileName($full)
$bytes = [System.IO.File]::ReadAllBytes($full)
$contentType = 'application/octet-stream'
if ($name.ToLowerInvariant().EndsWith('.zip')) {
  $contentType = 'application/zip'
}

$sizeMb = [math]::Round(($bytes.Length / 1MB), 2)

$bound = $false
$listener = New-Object System.Net.HttpListener
try {
  $listener.Prefixes.Add(('http://+:{0}/' -f $Port))
  $listener.Start()
  $bound = $true
} catch {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add(('http://127.0.0.1:{0}/' -f $Port))
  $listener.Start()
  $bound = $true
  Write-Host 'Could not bind all interfaces; serving on localhost only.' -ForegroundColor Yellow
}

if (-not $bound) { throw 'Failed to start HTTP listener' }

$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -ExpandProperty IPAddress)

Write-Host ''
Write-Host ('Serving {0} ({1} MiB)' -f $name, $sizeMb) -ForegroundColor Green
Write-Host ('  Local:  http://127.0.0.1:{0}/{1}' -f $Port, $name)
foreach ($ip in $ips) {
  Write-Host ('  LAN:    http://{0}:{1}/{2}' -f $ip, $Port, $name)
}
Write-Host 'Ctrl+C to stop.'
Write-Host ''

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response
    $reqPath = $req.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($reqPath) -or $reqPath -eq $name) {
      $res.StatusCode = 200
      $res.ContentType = $contentType
      $res.AddHeader('Content-Disposition', ('attachment; filename="{0}"' -f $name))
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host (('{0} GET /{1} -> 200 ({2})' -f (Get-Date -Format 'HH:mm:ss'), $reqPath, $req.RemoteEndPoint))
    } else {
      $html = '<!doctype html><meta charset=utf-8><title>Aegis</title><p><a href="/' + $name + '">Download ' + $name + '</a></p>'
      $buf = [System.Text.Encoding]::UTF8.GetBytes($html)
      $res.StatusCode = 200
      $res.ContentType = 'text/html; charset=utf-8'
      $res.ContentLength64 = $buf.Length
      $res.OutputStream.Write($buf, 0, $buf.Length)
      Write-Host (('{0} GET /{1} -> index' -f (Get-Date -Format 'HH:mm:ss'), $reqPath))
    }
    $res.OutputStream.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
