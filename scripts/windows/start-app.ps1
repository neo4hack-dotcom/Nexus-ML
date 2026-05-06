$ErrorActionPreference = "Stop"

$BackendScript = Join-Path $PSScriptRoot "start-backend.ps1"
$FrontendScript = Join-Path $PSScriptRoot "start-frontend.ps1"

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$BackendScript`""
)

Start-Sleep -Seconds 2

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-ExecutionPolicy", "Bypass",
  "-File", "`"$FrontendScript`""
)

Write-Host "Nexus AutoML is starting in two PowerShell windows."
Write-Host "Backend:  http://localhost:8000"
Write-Host "Frontend: check the Vite window for the exact URL, usually http://localhost:3000"
