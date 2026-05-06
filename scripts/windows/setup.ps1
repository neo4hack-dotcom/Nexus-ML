$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $Root

function Resolve-Python {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    return @{ Exe = "py"; Args = @("-3") }
  }

  if (Get-Command python -ErrorAction SilentlyContinue) {
    return @{ Exe = "python"; Args = @() }
  }

  throw "Python 3 was not found. Install Python 3.10+ from https://www.python.org/downloads/windows/ and enable 'Add python.exe to PATH'."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found. Install Node.js LTS from https://nodejs.org/."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Reinstall Node.js LTS from https://nodejs.org/."
}

$Python = Resolve-Python
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
  Write-Host "Creating Python virtual environment in .venv..."
  & $Python.Exe @($Python.Args) -m venv ".venv"
}

Write-Host "Installing Python backend dependencies..."
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install -r "requirements.txt"

Write-Host "Installing frontend dependencies..."
npm install

if (-not (Test-Path ".env.local")) {
  Copy-Item ".env.example" ".env.local"
  Write-Host "Created .env.local from .env.example"
}

Write-Host ""
Write-Host "Setup complete."
Write-Host "Start the app with: .\NexusAutoML-Windows.cmd"
