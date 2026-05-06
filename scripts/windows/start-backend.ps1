$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
  throw "Python virtual environment not found. Run .\Install-Windows.cmd first."
}

if (-not $env:BACKEND_HOST) {
  $env:BACKEND_HOST = "127.0.0.1"
}

if (-not $env:BACKEND_PORT) {
  $env:BACKEND_PORT = "8000"
}

Write-Host "Starting Nexus AutoML Python backend on http://$($env:BACKEND_HOST):$($env:BACKEND_PORT)"
& $VenvPython -m backend
