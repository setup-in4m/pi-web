@echo off
REM === pi-web Build Script ===
REM Builds client, server, and Tauri desktop app
REM Requires: Node.js, Rust (via rustup), Windows SDK rc.exe

echo === Step 1: Build client + server ===
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Client/Server build failed
    exit /b 1
)

echo.
echo === Step 2: Build Tauri desktop app ===
REM Ensure rustup's cargo is used (not chocolatey's)
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

REM Add Windows SDK rc.exe to PATH (for windres)
for /f "delims=" %%i in ('dir /b /ad "C:\Program Files (x86)\Windows Kits\10\bin\10.0.*" 2^>nul ^| sort /r') do (
    set SDK_VER=%%i
    goto :sdk_found
)
:sdk_found
if defined SDK_VER (
    set PATH=C:\Program Files (x86)\Windows Kits\10\bin\%SDK_VER%\x64;%PATH%
    echo Windows SDK %SDK_VER% found
) else (
    echo WARNING: Windows SDK not found. Build may fail if rc.exe is missing.
)

cd tauri
echo Building Tauri app (release + bundle)...
cargo tauri build
set BUILD_RESULT=%ERRORLEVEL%
cd ..

if %BUILD_RESULT% NEQ 0 (
    echo ERROR: Tauri build failed
    exit /b 1
)

echo.
echo === Build Complete ===
echo EXE:    tauri\target\x86_64-pc-windows-msvc\release\pi-web.exe
echo MSI:    tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\pi-web_*.msi
echo SETUP:  tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\pi-web_*-setup.exe
echo.
echo Run the EXE directly: tauri\target\x86_64-pc-windows-msvc\release\pi-web.exe
echo Or install via MSI/SETUP.
echo.
echo NOTE: Node.js must be installed on the system for the app to run.
