# pi-web Build Script
# Builds client, server, and Tauri desktop app
# Requires: Node.js, Rust (via rustup)

Write-Host "=== Step 1: Build client + server ===" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Client/Server build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Step 2: Build Tauri desktop app ===" -ForegroundColor Cyan

# Ensure rustup's cargo is first in PATH
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

# Find and add Windows SDK rc.exe
$sdkBase = "C:\Program Files (x86)\Windows Kits\10\bin"
if (Test-Path $sdkBase) {
    $latestSdk = Get-ChildItem $sdkBase -Directory | 
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+' } |
        Sort-Object { [version]$_.Name } -Descending |
        Select-Object -First 1
    if ($latestSdk) {
        $sdkPath = Join-Path $latestSdk.FullName "x64"
        if (Test-Path (Join-Path $sdkPath "rc.exe")) {
            $env:PATH = "$sdkPath;$env:PATH"
            Write-Host "Windows SDK $($latestSdk.Name) found" -ForegroundColor Green
        }
    }
}

Push-Location tauri
Write-Host "Building Tauri app (release + bundle)..." -ForegroundColor Cyan
cargo tauri build
$result = $LASTEXITCODE
Pop-Location

if ($result -ne 0) {
    Write-Host "ERROR: Tauri build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Build Complete ===" -ForegroundColor Green
Write-Host "EXE:    tauri\target\x86_64-pc-windows-msvc\release\pi-web.exe"
Write-Host "MSI:    tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\pi-web_*.msi"
Write-Host "SETUP:  tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\pi-web_*-setup.exe"
Write-Host ""
Write-Host "Run the EXE directly or install via MSI/SETUP." -ForegroundColor Yellow
Write-Host "NOTE: Node.js must be installed on the system." -ForegroundColor Yellow
