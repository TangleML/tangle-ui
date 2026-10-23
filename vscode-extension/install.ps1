# Installs the Tangent Local Agent VS Code / Cursor extension from a Tangle
# deployment: resolves the latest build, downloads the .vsix, and installs it
# with the cursor (or code) CLI.
#
#   $env:TANGENT_BASE_URL = "https://app.example.com"
#   iwr "$env:TANGENT_BASE_URL/extension/install.ps1" -UseBasicParsing | iex
param([string]$BaseUrl = $env:TANGENT_BASE_URL)
$ErrorActionPreference = "Stop"

if (-not $BaseUrl) {
  Write-Error "Usage: install.ps1 <tangle-base-url> (or set `$env:TANGENT_BASE_URL)"
  exit 1
}
$BaseUrl = $BaseUrl.TrimEnd('/')

$cli = $null
foreach ($candidate in @("cursor", "code")) {
  if (Get-Command $candidate -ErrorAction SilentlyContinue) { $cli = $candidate; break }
}
if (-not $cli) {
  Write-Error "Neither 'cursor' nor 'code' is on your PATH."
  exit 1
}

$manifest = Invoke-RestMethod "$BaseUrl/extension/latest.json"
$relUrl = $manifest.url
if (-not $relUrl) {
  Write-Error "Could not read the extension URL from $BaseUrl/extension/latest.json"
  exit 1
}
$vsixUrl = if ($relUrl -match '^https?://') { $relUrl } else { "$BaseUrl$relUrl" }

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("tangent-local-agent-" + [guid]::NewGuid().ToString() + ".vsix")
try {
  Write-Host "Downloading Tangent Local Agent $($manifest.version)..."
  Invoke-WebRequest $vsixUrl -OutFile $tmp -UseBasicParsing
  Write-Host "Installing into $cli..."
  & $cli --install-extension $tmp --force
  Write-Host "Done. Reload or restart $cli to activate the extension."
}
finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}
