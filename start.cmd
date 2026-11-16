@echo off
rem Chay start.ps1 ma khong vuong ExecutionPolicy. Co the double-click hoac: start.cmd -Open -Port 3001
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
