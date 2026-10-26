@echo off
rem 在线版：启动本地服务 + 公网隧道（公网网址会显示在下方窗口中，每次启动会变）
cd /d "%~dp0server"
start "Portfolio Server" cmd /k "node server.js"
cd /d "%~dp0"
tools\cloudflared.exe tunnel --url http://localhost:3000 --no-autoupdate
