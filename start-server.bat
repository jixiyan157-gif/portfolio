@echo off
rem 本地预览：启动作品集服务（前台 http://localhost:3000 后台 /admin/）
cd /d "%~dp0server"
node server.js
pause
