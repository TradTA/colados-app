@echo off
title Colados App - Servidor Local
color 0A
echo.
echo ==============================================
echo   INICIANDO COLADOS APP (OFFLINE PWA)
echo ==============================================
echo.
cd /d "%~dp0"

echo [1] Buscando tu IP local (para usar en tu celular):
ipconfig | findstr IPv4
echo.
echo (Usa esa direccion IPv4 en el navegador de tu celular, agregando :5173)
echo Ejemplo: http://192.168.1.5:5173
echo.
echo [2] Arrancando servidor Vite...
echo.

call npm run dev

echo.
echo [!] El servidor se ha detenido.
pause
