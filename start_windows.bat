@echo off
chcp 65001 >nul
where node >nul 2>nul
if errorlevel 1 (
  echo Для запуска нужен Node.js 20 или новее: https://nodejs.org/
  pause
  exit /b 1
)
echo Запуск игры «Грань: Следы Нави»...
start "" http://localhost:8080
node server.mjs
pause
