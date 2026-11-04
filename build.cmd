@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo npm.cmd tidak ditemukan. Instal Node.js dari https://nodejs.org/
    exit /b 1
)

call npm.cmd run build
exit /b %errorlevel%
