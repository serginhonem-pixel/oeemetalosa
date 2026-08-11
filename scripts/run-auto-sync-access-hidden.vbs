' Dispara o run-auto-sync-access.bat sem deixar janela de console aberta.
Set objShell = CreateObject("WScript.Shell")
Dim scriptDir
scriptDir = Left(WScript.ScriptFullName, Len(WScript.ScriptFullName) - Len(WScript.ScriptName))
objShell.Run """" & scriptDir & "run-auto-sync-access.bat""", 0, False
