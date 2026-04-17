# TopViewbot 启动脚本
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host "Building web frontend..." -ForegroundColor Cyan
Set-Location "$projectRoot\web"
& bun run build
Set-Location $projectRoot

Write-Host "Starting TopViewbot server..." -ForegroundColor Green
& bun run packages/topviewbot/src/index.ts start --port 4096 --hostname 0.0.0.0 --no-browser
