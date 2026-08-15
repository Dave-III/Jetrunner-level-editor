@echo off
setlocal

if "%~1"=="" (
    echo Usage:
    echo   Build-UAssetLevel.bat "Level Name"
    echo.
    echo The supplied map and LevelDef templates are used automatically.
    pause
    exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0Build-UAssetLevel.ps1" ^
  -LevelName "%~1"

if errorlevel 1 (
    echo.
    echo UASSET LEVEL BUILD FAILED.
    pause
    exit /b 1
)

echo.
echo Custom level converted, packaged, verified, and installed.
pause
