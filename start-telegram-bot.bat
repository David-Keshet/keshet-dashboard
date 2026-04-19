@echo off
title בוט טלגרם - דפוס קשת
cd /d "%~dp0"
echo.
echo  =============================
echo   בוט טלגרם - דפוס קשת
echo  =============================
echo.
node "n8n-scripts\telegram-bot.js"
echo.
echo הבוט הפסיק לרוץ. לחץ כל מקש לסגירה.
pause > nul
