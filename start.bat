@echo off
title ProductPilot AI - Starting Services

echo Starting Backend...
start "Backend" cmd /k "cd /d %~dp0 && .venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000"

echo Starting Frontend...
start "Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo Services starting:
echo.
echo - Backend: http://127.0.0.1:8000
echo - API Docs: http://127.0.0.1:8000/docs
echo - Frontend: http://localhost:3000
echo.
echo Please wait for both services to fully start before use.
echo.
pause >nul