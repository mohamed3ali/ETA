# Build the .NET tray app and copy a zip to the SaaS frontend for one-click download.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dotnet = Join-Path $root "dotnet"
$publish = Join-Path $dotnet "publish"
$outDir = Join-Path $root "..\frontend\public\downloads"
$exeSource = Join-Path $publish "EtaSigner.exe"
$exeTarget = Join-Path $outDir "EtaSigner.exe"

Write-Host "Publishing ETA Signer (single-file, win-x64, self-contained)..."
Push-Location $dotnet
if (Test-Path $publish) { Remove-Item $publish -Recurse -Force }
dotnet publish src/EtaSigner.Tray -c Release -r win-x64 --self-contained -o publish
Pop-Location

if (-not (Test-Path $exeSource)) {
    throw "Publish failed: $exeSource not found"
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
Copy-Item $exeSource $exeTarget -Force

$mb = [math]::Round((Get-Item $exeTarget).Length / 1MB, 1)
Write-Host "Created $exeTarget ($mb MB)"
Write-Host "Users download via /download/eta-signer in the SaaS app."
