@echo off
REM ============================================================
REM  AI-FaultClassifier - Backend Startup Script
REM  FastAPI + WebSockets | SCADA Digital Protection Relay
REM ============================================================
echo.
echo ================================================================
echo  AI-BASED FAULT DETECTION ^& CLASSIFICATION SYSTEM (v1.0.0)
echo  Backend: FastAPI + DWT db4 + Random Forest (100%% accuracy)
echo  Serving at: http://localhost:8000
echo  WebSocket: ws://localhost:8000/ws/waveform-stream
echo ================================================================
echo.

cd /d "%~dp0"

REM Use Python 3.12 with all dependencies
C:\Users\Lenovo\AppData\Local\Programs\Python\Python312\python.exe run.py

pause

