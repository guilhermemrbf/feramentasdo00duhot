@echo off
setlocal
title Hot Profiles - Conector
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 22 ou superior em https://nodejs.org
  echo Depois abra este arquivo novamente.
  pause
  exit /b 1
)
node "%~dp0bridge.mjs"
pause
