@echo off
cd /d C:\Users\coordpcp\telha-oee

powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\export-access-oee.ps1 -AccessPath "C:\DadosVBA\BDMETALOSA.accdb" -OutDir ".\data-import"
if errorlevel 1 exit /b 1

node .\scripts\sync-access-rest.mjs --email "pcp@metalosa.com.br" --senha "Steaml4d@" --maquinaId "CONFORMADORA_TELHAS" --inputDir ".\data-import"
if errorlevel 1 exit /b 1

exit /b 0
