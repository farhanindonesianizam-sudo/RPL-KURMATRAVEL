@echo off
setlocal
cd /d "%~dp0"

call build.cmd
if errorlevel 1 (
    echo Build frontend gagal.
    exit /b 1
)

set "PYTHON_CMD="
where py.exe >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=py -3"
if not defined PYTHON_CMD (
    where python.exe >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=python"
)
if not defined PYTHON_CMD (
    echo.
    echo Python tidak ditemukan.
    echo Pasang Python lalu centang "Add python.exe to PATH".
    echo Setelah itu, tutup dan buka kembali Command Prompt.
    echo Download: https://www.python.org/downloads/
    exit /b 1
)

echo.
echo Membuka website di http://127.0.0.1:5000
%PYTHON_CMD% app.py
exit /b %errorlevel%
