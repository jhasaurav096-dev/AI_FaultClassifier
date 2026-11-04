@echo off
REM ============================================================
REM  AI-FaultClassifier - Frontend Dev Server Startup Script
REM  React + Vite + Tailwind CSS (Industrial SCADA Theme)
REM ============================================================
echo.
echo ================================================================
echo  AI-FAULTCLASSIFIER FRONTEND (SCADA Control Room UI)
echo  Serving at: http://localhost:5173
echo  Backend must be running at: http://localhost:8000
echo ================================================================
echo.

cd /d "%~dp0"

npm run dev

pause

