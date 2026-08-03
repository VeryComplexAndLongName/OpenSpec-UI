[CmdletBinding()]
param(
    [string]$WorkspaceRoot = "C:/Prog/OpenSpec-UI",
    [int]$Port = 4317,
    [bool]$AllowExternalCwd = $true,
    [switch]$SkipVolta,
    [switch]$SkipInstall,
    [switch]$NoStart
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[OpenSpec] $Message" -ForegroundColor Cyan
}

function Test-Command {
    param([string]$Name)
    return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

$scriptDir = Split-Path -Parent $PSCommandPath
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location $repoRoot

if (-not (Test-Path "package.json")) {
    throw "package.json was not found in $repoRoot. Run this script from the repository copy."
}

if (-not (Test-Command "npm")) {
    throw "npm is not available in PATH. Install Node.js/npm first."
}

$rootPackage = Get-Content "package.json" -Raw | ConvertFrom-Json
$voltaNode = $rootPackage.volta.node
$voltaNpm = $rootPackage.volta.npm

if (-not $SkipVolta) {
    Write-Step "Checking Volta availability..."

    if (-not (Test-Command "volta")) {
        Write-Step "Volta is not in PATH. Trying to install via winget..."
        try {
            winget install --id Volta.Volta -e --accept-package-agreements --accept-source-agreements | Out-Host
        }
        catch {
            Write-Warning "Volta installation via winget failed: $($_.Exception.Message)"
        }
    }

    if (Test-Command "volta") {
        Write-Step "Pinning runtime from package.json (node=$voltaNode, npm=$voltaNpm)..."
        if ($voltaNode) {
            volta pin "node@$voltaNode" | Out-Host
        }
        if ($voltaNpm) {
            volta pin "npm@$voltaNpm" | Out-Host
        }
    }
    else {
        Write-Warning "Volta is still unavailable. Continuing with current Node/npm from PATH."
        Write-Warning "If MSI installs are blocked by policy, ask your administrator to install Volta."
    }
}
else {
    Write-Step "Skipping Volta setup by request."
}

if (-not $SkipInstall) {
    Write-Step "Installing workspace dependencies (npm install)..."
    npm install | Out-Host
}
else {
    Write-Step "Skipping npm install by request."
}

Write-Step "Building standalone client bundle..."
npm run build --workspace @openspec-ui/server | Out-Host

if ($NoStart) {
    Write-Step "NoStart flag is set. Preparation finished."
    exit 0
}

$startArgs = @("run", "start", "--workspace", "@openspec-ui/server", "--", $WorkspaceRoot, "$Port")
if ($AllowExternalCwd) {
    $startArgs += "--allow-external-cwd"
}

Write-Step "Starting standalone server on http://127.0.0.1:$Port ..."
Write-Step "Workspace root: $WorkspaceRoot"
Write-Step "allowExternalCwd: $AllowExternalCwd"

npm @startArgs
