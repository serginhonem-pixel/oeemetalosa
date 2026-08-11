# Registra a Tarefa Agendada do Windows que roda o auto-sync do Access
# (export + git commit + git push) sozinho, sempre que voce logar no PC.
#
# Uso: abra o PowerShell nesta pasta (telha-oee) e rode:
#   powershell -ExecutionPolicy Bypass -File scripts\setup-auto-sync-task.ps1

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$vbsPath = Join-Path $repoRoot "scripts\run-auto-sync-access-hidden.vbs"

if (!(Test-Path $vbsPath)) {
  throw "Nao encontrei $vbsPath. Rode este script de dentro da pasta do projeto telha-oee."
}

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask `
  -TaskName "TelhaOEE-AutoSyncAccess" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Observa BDMETALOSA.accdb e faz commit/push automatico dos dados exportados para o repo telha-oee." `
  -Force | Out-Null

Write-Output "Tarefa 'TelhaOEE-AutoSyncAccess' registrada com sucesso."
Write-Output "Testando agora (sem esperar reiniciar o PC)..."
Start-ScheduledTask -TaskName "TelhaOEE-AutoSyncAccess"

Start-Sleep -Seconds 3
$task = Get-ScheduledTask -TaskName "TelhaOEE-AutoSyncAccess"
$info = Get-ScheduledTaskInfo -TaskName "TelhaOEE-AutoSyncAccess"
Write-Output "Estado: $($task.State) | Ultima execucao: $($info.LastRunTime) | Ultimo resultado: $($info.LastTaskResult)"
Write-Output "Acompanhe o log em: $repoRoot\logs\auto-sync-access.log"
