@echo off
title HIBA-WRITER
cd /d "%~dp0"
echo ==========================================
echo   HIBA-WRITER - Demarrage en cours...
echo ==========================================
echo.

REM Demarrer le serveur dans une nouvelle fenetre
start "HIBA-WRITER Serveur" .venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

echo Serveur en demarrage, ouverture du navigateur dans 3 secondes...
timeout /t 3 /nobreak >nul

REM Ouvrir le navigateur
start "" "http://127.0.0.1:8000"

echo.
echo HIBA-WRITER est ouvert sur http://127.0.0.1:8000
echo Fermez la fenetre "HIBA-WRITER Serveur" pour arreter.
echo.
pause
