@echo off
start /b python -m http.server 8123
timeout /t 1 /nobreak >nul
rem A unique query bypasses any legacy service-worker entry on the first load.
start "" http://localhost:8123/?dev=%RANDOM%
