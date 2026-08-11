@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if not exist "logs" mkdir "logs"

:loop
echo [%date% %time%] Iniciando auto-sync do Access... >> "logs\auto-sync-access.log"
call npm run auto-sync:access -- --runNow true >> "logs\auto-sync-access.log" 2>&1
echo [%date% %time%] Auto-sync encerrou (codigo %errorlevel%). Reiniciando em 10s... >> "logs\auto-sync-access.log"
timeout /t 10 /nobreak >nul
goto loop
