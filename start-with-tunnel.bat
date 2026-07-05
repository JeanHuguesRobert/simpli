@echo off
REM Start SimpliWiki with tunnel for GitHub OAuth testing
REM Usage: start-with-tunnel.bat

echo 🚀 Starting SimpliWiki with tunnel...

set SCRIPT_DIR=%~dp0
set INSEME_TUNNEL=%SCRIPT_DIR%..\inseme\apps\platform\scripts\tunnel.js

REM Check if inseme tunnel script exists
if not exist "%INSEME_TUNNEL%" (
    echo ❌ Tunnel script not found at: %INSEME_TUNNEL%
    exit /b 1
)

REM Start the tunnel in standalone mode
echo Starting tunnel in standalone mode...
start /B node "%INSEME_TUNNEL%" --standalone --env-file "%SCRIPT_DIR%.env" --port 8080

REM Wait for tunnel to be ready
timeout /t 5 /nobreak >nul

REM Start SimpliWiki
echo Starting SimpliWiki...
node lib/main.js
