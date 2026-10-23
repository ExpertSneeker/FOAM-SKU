@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12 or later is required.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci --no-fund
  if errorlevel 1 goto failed
)
call npm run build
if errorlevel 1 goto failed
start "" "http://127.0.0.1:4173/"
node scripts/local-server.mjs
if errorlevel 1 goto failed
exit /b 0
:failed
echo Unable to start FOAM SKU. See the message above.
pause
exit /b 1
