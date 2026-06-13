@echo off
start /b python -m http.server 8123
timeout /t 1 /nobreak >nul
start "" http://localhost:8123
