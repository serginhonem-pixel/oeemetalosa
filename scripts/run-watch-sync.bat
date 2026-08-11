@echo off
setlocal EnableExtensions
cd /d "%~dp0\.."

if not exist "scripts\credentials.local" (
  echo [ERRO] scripts\credentials.local nao encontrado.
  echo Copie scripts\credentials.local.example para scripts\credentials.local e preencha email/senha.
  exit /b 1
)
call "scripts\credentials.local"

if not exist "logs" mkdir "logs"

:loop
echo [%date% %time%] Iniciando watcher... >> "logs\watch-access-sync.log"
call npm run watch:access-sync -- --runNow true >> "logs\watch-access-sync.log" 2>&1
echo [%date% %time%] Watcher encerrou (codigo %errorlevel%). Reiniciando em 10s... >> "logs\watch-access-sync.log"
timeout /t 10 /nobreak >nul
goto loop
