@echo off
setlocal
title Hot Profiles - Conector
cd /d "%~dp0"
set "HOT_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "HOT_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not "%HOT_NODE%"=="node" if not exist "%HOT_NODE%" (
  echo Instale Node.js 22 ou superior em https://nodejs.org
  echo Depois abra este arquivo novamente.
  pause
  exit /b 1
)
"%HOT_NODE%" "%~dp0bridge.mjs"
pause
