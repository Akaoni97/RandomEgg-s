@echo off
title LucaTekno_Machine LT-1
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js non trovato.
  echo  Installa la versione LTS da https://nodejs.org e poi riavvia questo file.
  echo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Prima installazione: scarico le dipendenze ^(serve internet solo questa volta^)...
  call npm install
  if errorlevel 1 ( pause & exit /b 1 )
)
echo Avvio LucaTekno_Machine... il browser si aprira' da solo su http://localhost:4173
echo Per spegnere la macchina chiudi questa finestra.
call npm start
pause
