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

# The .vsix is executable code, so only fetch it over https or from loopback.
if ($BaseUrl -notmatch '^https://' -and
    $BaseUrl -notmatch '^http://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$') {
  Write-Error "Refusing to install over an insecure base URL: $BaseUrl (use https:// or a loopback address)"
  exit 1
}

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
# Keep only the manifest URL's path and resolve it under $BaseUrl, so the
# download can never be redirected to another origin.
$relPath = if ($relUrl -match '^[a-zA-Z][a-zA-Z0-9+.-]*://') {
  ([uri]$relUrl).PathAndQuery
} elseif ($relUrl.StartsWith('/')) {
  $relUrl
} else {
  "/$relUrl"
}
$vsixUrl = "$BaseUrl$relPath"

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
