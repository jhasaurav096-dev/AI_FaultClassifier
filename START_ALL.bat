@echo off
REM ============================================================
REM  AI-FaultClassifier - Full Stack Launcher (Both Processes)
REM ============================================================
echo.
echo ================================================================
echo  LAUNCHING: AI-FAULTCLASSIFIER FULL STACK
echo ================================================================

start "AI-FaultClassifier Backend (FastAPI:8000)" cmd /k "cd /d %~dp0backend && C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe run.py"

timeout /t 4 /nobreak > nul

start "AI-FaultClassifier Frontend (Vite:5173)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both services are starting...
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.
timeout /t 5 /nobreak > nul
start "" "http://localhost:5173"

