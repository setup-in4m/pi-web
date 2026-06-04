@echo off
REM === pi-web Quick Run ===
REM Starts server + client in dev mode (hot reload)
echo Starting pi-web in dev mode...
echo Server: http://localhost:3456
echo Client: http://localhost:5173
echo.
call npm run dev
