@echo off
title Colados App - Generar APK con Capacitor
color 0E
echo.
echo  ============================================
echo   COLADOS APP - RUTA APK CON CAPACITOR
echo  ============================================
echo.
echo  PASO 1: Compilar el proyecto React...
call npm run build
echo.
echo  PASO 2: Inicializar Capacitor (solo la primera vez)...
call npx cap init "Colados" "com.colados.app" --web-dir dist
echo.
echo  PASO 3: Agregar plataforma Android...
call npx cap add android
echo.
echo  PASO 4: Sincronizar archivos al proyecto Android...
call npx cap sync android
echo.
echo  ============================================
echo   SIGUIENTE PASO PARA OBTENER EL APK:
echo  ============================================
echo.
echo  OPCION A (SIN Android Studio - Recomendada):
echo  1. Ve a https://dashboard.ionicframework.com
echo  2. Crea cuenta gratuita en Ionic Appflow
echo  3. Sube el proyecto y genera el APK en la nube
echo.
echo  OPCION B (Con Android Studio instalado):
echo  Ejecuta: npx cap open android
echo  Luego en Android Studio: Build > Build APK
echo.
pause
