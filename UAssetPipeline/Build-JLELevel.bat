@echo off
setlocal

if "%~1"=="" (
    echo Drag an exported JETRUNNER Level Editor JSON onto this file,
    echo or run:
    echo   Build-JLELevel.bat "C:\path\to\level.json" "C:\path\to\JETRUNNER\JETRUNNER\Content\Paks"
    pause
    exit /b 1
)

set "PAKS=C:\Program Files (x86)\Steam\steamapps\common\JETRUNNER\JETRUNNER\Content\Paks"
if not "%~2"=="" set "PAKS=%~2"

powershell.exe -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0Build-JLELevel.ps1" ^
  -LevelData "%~1" ^
  -GamePaksDirectory "%PAKS%"

if errorlevel 1 (
    echo.
    echo JLE BUILD FAILED.
    pause
    exit /b 1
)

echo.
echo Level converted, packaged, and installed in Content\Paks\JLE.
pause
