@echo off
cd /d "%~dp0"
echo Starting WebCraft at http://localhost:8000 ...
start "WebCraft" /min node tools\server.js
timeout /t 2 >nul
start http://localhost:8000
