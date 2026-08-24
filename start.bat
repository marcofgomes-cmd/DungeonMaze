@echo off
echo Starting Dungeon Maze on http://localhost:3000
echo Press Ctrl+C to stop.
echo.
cd /d "%~dp0"
npx -y http-server -p 3000 -c-1
