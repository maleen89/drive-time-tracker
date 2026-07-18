@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Sta -File "%~dp0scripts\launch.ps1"
