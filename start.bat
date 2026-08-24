@echo off
echo Starting Dungeon Maze on http://localhost:8000
echo Press Ctrl+C to stop.
echo.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File start.ps1
