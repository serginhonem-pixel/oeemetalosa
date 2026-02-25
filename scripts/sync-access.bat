@echo off
setlocal EnableExtensions
cd /d C:\Users\coordpcp\telha-oee

echo [1/4] Exportando Access...
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-access-oee.ps1 -AccessPath "C:\DadosVBA\BDMETALOSA.accdb" -OutDir ".\data-import"
if errorlevel 1 goto :fail

echo [2/4] Sincronizando com Firebase...
node .\scripts\sync-access-rest.mjs --email "pcp@metalosa.com.br" --senha "Steaml4d@" --maquinaId "CONFORMADORA_TELHAS" --inputDir ".\data-import"
if errorlevel 1 goto :fail

set "COMMIT_MSG=%~1"
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=chore: atualiza dados do Access"

if exist ".git\index.lock" (
  echo [ERRO] Existe um lock do Git em .git\index.lock. Feche outro Git em execucao e tente novamente.
  goto :fail
)

echo [3/4] Preparando commit...
git add -A
if errorlevel 1 goto :fail

git diff --cached --quiet
if %errorlevel%==0 (
  echo [OK] Nenhuma alteracao para commit.
  goto :success
)

echo [4/4] Criando commit...
git commit -m "%COMMIT_MSG%"
if errorlevel 1 goto :fail

echo [OK] Sincronizacao concluida com commit.
goto :success

:fail
echo [FALHA] O processo foi interrompido.
pause
endlocal
exit /b 1

:success
endlocal
exit /b 0
