@echo off
setlocal
cd /d "%~dp0"

where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo npm.cmd tidak ditemukan. Instal Node.js dari https://nodejs.org/
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
    echo 1. Pasang Python dari https://www.python.org/downloads/
    echo 2. Centang "Add python.exe to PATH" saat instalasi.
    echo 3. Tutup lalu buka kembali Command Prompt sebelum menjalankan setup.cmd.
    exit /b 1
)

echo [1/2] Menginstal dependensi Node.js...
call npm.cmd install
if errorlevel 1 exit /b 1

echo [2/2] Menginstal dependensi Python...
%PYTHON_CMD% -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

echo.
echo Instalasi selesai. Jalankan run.cmd untuk build dan membuka server.
endlocal