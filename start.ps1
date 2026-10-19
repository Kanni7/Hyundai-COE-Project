# One-command start on Windows: sets up the backend venv and frontend build on first run,
# then serves the whole app at http://127.0.0.1:8000
#   powershell -ExecutionPolicy Bypass -File start.ps1 [-Rebuild] [-Port 8000]
param([switch]$Rebuild, [int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$py = Join-Path $root 'backend\.venv\Scripts\python.exe'

if (-not (Test-Path $py)) {
    Write-Host '[setup] Creating backend virtual environment...'
    python -m venv (Join-Path $root 'backend\.venv')
    & $py -m pip install --upgrade pip
    & $py -m pip install -r (Join-Path $root 'backend\requirements-app.txt')
    & $py -m pip install -e (Join-Path $root 'backend')
}

if ($Rebuild -or -not (Test-Path (Join-Path $root 'frontend\dist\index.html'))) {
    Write-Host '[setup] Building frontend...'
    Push-Location (Join-Path $root 'frontend')
    try {
        if (-not (Test-Path node_modules)) { npm install }
        npm run build
    } finally { Pop-Location }
}

Write-Host "[run] http://127.0.0.1:$Port"
Push-Location (Join-Path $root 'backend')
try { & $py -m bhashadrive.cli serve --port $Port } finally { Pop-Location }
