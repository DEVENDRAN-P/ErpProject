@echo off
title ProductPilot AI - Starting Services

echo Starting Backend...
start "Backend" cmd /c "cd /d %~dp0 && .venv\\Scripts\\activate && uvicorn backend.main:app --reload"

echo Starting Frontend...
start "Frontend" cmd /c "cd /d %~dp0 && npm run dev"

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