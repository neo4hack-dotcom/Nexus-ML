$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

if (-not (Test-Path "node_modules")) {
  throw "Frontend dependencies not found. Run .\Install-Windows.cmd first."
}

Write-Host "Starting Nexus AutoML frontend..."
npm run dev
