@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/2] Building web frontend...
cd web
call bun run build
cd ..

echo [2/2] Starting TopViewbot server...
call bun run packages/topviewbot/src/index.ts start --port 4096 --hostname 0.0.0.0 --no-browser

pause
