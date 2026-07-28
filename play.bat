@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>&1
if errorlevel 1 (
  echo Cold Call needs Python to run the local test server.
  echo Install Python, then run play.bat again.
  pause
  exit /b 1
)

rem --directory pins the server to this project even when launched from an IDE
rem whose terminal is currently in another folder.
start "" /b python -m http.server 8123 --directory "%~dp0"
timeout /t 1 /nobreak >nul
rem A unique query bypasses any legacy service-worker entry on the first load.
start "" "http://127.0.0.1:8123/?dev=%RANDOM%"
