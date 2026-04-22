@echo off
setlocal EnableExtensions
cd /d C:\Users\coordpcp\telha-oee

echo [1/2] Exportando Access direto para public/data-import...
if not exist ".\public\data-import" mkdir ".\public\data-import"
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-access-oee.ps1 -AccessPath "C:\DadosVBA\BDMETALOSA.accdb" -OutDir ".\public\data-import"
if errorlevel 1 (
  echo [FALHA] Export do Access falhou.
  pause
  exit /b 1
)

set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=chore: atualiza dados do Access"

if exist ".git\index.lock" (
  echo [ERRO] Existe um lock do Git. Feche outro Git em execucao e tente novamente.
  pause
  exit /b 1
)

echo [2/2] Preparando commit...
git add -A
if errorlevel 1 (
  echo [FALHA] git add falhou.
  pause
  exit /b 1
)

git diff --cached --quiet
if %errorlevel%==0 (
  echo [OK] Nenhuma alteracao para commit.
  pause
  exit /b 0
)

echo [2/2] Criando commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo [FALHA] git commit falhou.
  pause
  exit /b 1
)

echo [OK] Sincronizacao concluida com commit.
pause
endlocal
exit /b 0
