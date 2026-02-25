@echo off
cd /d C:\Users\coordpcp\telha-oee

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-access-oee.ps1 -AccessPath "C:\DadosVBA\BDMETALOSA.accdb" -OutDir ".\data-import"
if errorlevel 1 exit /b 1

node .\scripts\sync-access-rest.mjs --email "pcp@metalosa.com.br" --senha "Steaml4d@" --maquinaId "CONFORMADORA_TELHAS" --inputDir ".\data-import"
if errorlevel 1 exit /b 1

set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=chore: atualiza dados do Access"

git add -A
if errorlevel 1 exit /b 1

git diff --cached --quiet
if %errorlevel%==0 (
  echo Nenhuma alteracao para commit.
  exit /b 0
)

git commit -m "%COMMIT_MSG%"
if errorlevel 1 exit /b 1

exit /b 0
