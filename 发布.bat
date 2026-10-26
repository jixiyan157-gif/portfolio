@echo off
chcp 65001 >nul
rem 一键发布：构建静态版 → 推送到码云 → 去码云 Pages 页面点「更新」
cd /d "%~dp0"

echo [1/3] 构建静态版（读取本地后台项目，需先运行 start-server.bat）
python build_offline.py --out dist/index.html
if errorlevel 1 (
  echo 构建失败：请确认后端已启动（start-server.bat）后重试
  pause
  exit /b 1
)

echo [2/3] 提交并推送到码云
git add -A
git commit -m "更新作品集内容" >nul 2>&1
git push
if errorlevel 1 (
  echo 推送失败：请检查网络或登录状态
  pause
  exit /b 1
)

echo [3/3] 完成！最后一步：
echo   打开 https://gitee.com/ywq1618/portfolio/pages
echo   点击「更新」按钮即可生效
pause
