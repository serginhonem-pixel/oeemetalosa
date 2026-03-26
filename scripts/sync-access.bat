@echo off
setlocal EnableExtensions
cd /d C:\Users\coordpcp\telha-oee

set "ACCESS_PATH=C:\DadosVBA\BDMETALOSA.accdb"
set "LOCK_FILE=C:\DadosVBA\BDMETALOSA.laccdb"

echo [1/4] Exportando Access...

if exist "%LOCK_FILE%" (
  echo [AVISO] Access esta aberto ^(arquivo .laccdb detectado^). Tentando exportar mesmo assim...
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$job = Start-Job -ScriptBlock { & '.\scripts\export-access-oee.ps1' -AccessPath '%ACCESS_PATH%' -OutDir '.\data-import' }; ^
   if (!(Wait-Job $job -Timeout 45)) { Stop-Job $job; Write-Host '[AVISO] Timeout ao exportar Access (45s).'; exit 2 }; ^
   Receive-Job $job; ^
   if ($job.State -eq 'Failed') { exit 1 }"

if %errorlevel%==2 (
  echo [AVISO] Export travou. Verificando se CSV existente pode ser usado...
  if not exist ".\data-import\import_producao.csv" goto :fail_sem_csv
  if not exist ".\data-import\import_paradas.csv" goto :fail_sem_csv
  echo [OK] Usando CSV da ultima exportacao bem-sucedida.
  goto :sync
)
if errorlevel 1 goto :fail

:sync
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

:fail_sem_csv
echo [FALHA] Nao foi possivel exportar o Access e nao ha CSV anterior disponivel.
pause
endlocal
exit /b 1

:fail
echo [FALHA] O processo foi interrompido.
pause
endlocal
exit /b 1

:success
endlocal
exit /b 0
