@echo off
setlocal
if "%~1"=="" (
    echo Drag a JETRUNNER level JSON file onto this batch file,
    echo or run: BuildAndInstallLevel.bat "C:\path\level.json"
    pause
    exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0BuildAndInstallLevel.ps1" -JsonPath "%~1"
if errorlevel 1 (
    echo.
    echo BUILD OR INSTALL FAILED.
    pause
    exit /b 1
)
echo.
echo Level cooked, packaged, and installed successfully.
pause
