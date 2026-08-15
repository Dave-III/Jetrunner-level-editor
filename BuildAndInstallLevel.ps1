param(
    [Parameter(Mandatory = $true)]
    [string]$JsonPath
)

$ErrorActionPreference = 'Stop'
$compilerProject = 'C:\Users\Connor Seakins\Documents\Unreal Projects\Updated Compiler'
$projectFile = Join-Path $compilerProject 'JetrunnerMapCompiler.uproject'
$compilerScript = Join-Path $compilerProject 'Scripts\compile_level.py'
$compilerJson = Join-Path $compilerProject 'LevelData\Map_Pillars.json'
$unrealEditor = 'C:\UE_5.6\Engine\Binaries\Win64\UnrealEditor-Cmd.exe'
$runUat = 'C:\UE_5.6\Engine\Build\BatchFiles\RunUAT.bat'
$packageScript = Join-Path $compilerProject 'package_map_pillars.bat'
$pakName = 'JLE-Map_MyFirstLevel_P.pak'
$sourcePak = Join-Path $compilerProject "PackagedMods\$pakName"
$frameworkPak = Join-Path $PSScriptRoot 'Framework\CustomLevelsV0_2.pak'
$frameworkPakName = 'CustomLevelsV0_2.pak'
$levelDefinitionPak = Join-Path $PSScriptRoot 'Framework\MyFirstLevel.pak'
$levelDefinitionPakName = 'MyFirstLevel.pak'
$modsDir = 'C:\Program Files (x86)\Steam\steamapps\common\JETRUNNER\JETRUNNER\Content\Paks\~mods'
$installedPak = Join-Path $modsDir $pakName
$installedFrameworkPak = Join-Path $modsDir $frameworkPakName
$installedLevelDefinitionPak = Join-Path $modsDir $levelDefinitionPakName

$resolvedJson = (Resolve-Path -LiteralPath $JsonPath).Path
$level = Get-Content -LiteralPath $resolvedJson -Raw | ConvertFrom-Json
$level.levelName = 'Map_MyFirstLevel'
$level.worldSettings.levelDefinition = '/Game/Mods/CustomLevels/LevelDef_MyFirstLevel.LevelDef_MyFirstLevel'
$stagedJson = $level | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($compilerJson, $stagedJson, [System.Text.UTF8Encoding]::new($false))

if (-not (Test-Path -LiteralPath $frameworkPak)) {
    throw "Custom-level framework pak is missing: $frameworkPak"
}
if (-not (Test-Path -LiteralPath $levelDefinitionPak)) {
    throw "Dreams End LevelDef pak is missing: $levelDefinitionPak"
}

Write-Host '[1/5] Compiling Unreal map...'
$compileStarted = Get-Date
& $unrealEditor $projectFile "-ExecutePythonScript=$compilerScript" -unattended -nop4 -nosplash
if ($LASTEXITCODE -ne 0) { throw "Unreal compilation failed with exit code $LASTEXITCODE" }
$compilerLog = Join-Path $compilerProject 'Saved\Logs\JetrunnerMapCompiler.log'
if (Test-Path -LiteralPath $compilerLog) {
    $pythonFailure = Select-String -LiteralPath $compilerLog -Pattern 'LogPython: Error:|Python script executed with errors' -Quiet
    if ($pythonFailure -and (Get-Item -LiteralPath $compilerLog).LastWriteTime -ge $compileStarted) {
        throw "Unreal Python compilation failed. See: $compilerLog"
    }
}

Write-Host '[2/5] Cooking /Game/Mods/CustomLevels/Map_MyFirstLevel...'
& $runUat BuildCookRun "-project=$projectFile" -noP4 -platform=Win64 -clientconfig=Development -cook '-map=/Game/Mods/CustomLevels/Map_MyFirstLevel' -skipstage -unattended -utf8output
if ($LASTEXITCODE -ne 0) { throw "Unreal cook failed with exit code $LASTEXITCODE" }

Write-Host '[3/5] Packaging level pak...'
& $packageScript --no-pause
if ($LASTEXITCODE -ne 0) { throw "Pak packaging failed with exit code $LASTEXITCODE" }

Write-Host '[4/5] Installing custom-level framework...'
New-Item -ItemType Directory -Path $modsDir -Force | Out-Null
# V0.1 and V0.2 export the same ModActor asset path. Never mount both.
Remove-Item -LiteralPath (Join-Path $modsDir 'CustomLevelsV0_1.pak') -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath $frameworkPak -Destination $installedFrameworkPak -Force
Copy-Item -LiteralPath $levelDefinitionPak -Destination $installedLevelDefinitionPak -Force
$frameworkSourceHash = (Get-FileHash -LiteralPath $frameworkPak -Algorithm SHA256).Hash
$frameworkInstalledHash = (Get-FileHash -LiteralPath $installedFrameworkPak -Algorithm SHA256).Hash
if ($frameworkSourceHash -ne $frameworkInstalledHash) {
    throw 'Installed custom-level framework pak verification failed.'
}
$levelDefinitionSourceHash = (Get-FileHash -LiteralPath $levelDefinitionPak -Algorithm SHA256).Hash
$levelDefinitionInstalledHash = (Get-FileHash -LiteralPath $installedLevelDefinitionPak -Algorithm SHA256).Hash
if ($levelDefinitionSourceHash -ne $levelDefinitionInstalledHash) {
    throw 'Installed Dreams End LevelDef pak verification failed.'
}

Write-Host '[5/5] Installing generated level pak...'
Copy-Item -LiteralPath $sourcePak -Destination $installedPak -Force
$sourceHash = (Get-FileHash -LiteralPath $sourcePak -Algorithm SHA256).Hash
$installedHash = (Get-FileHash -LiteralPath $installedPak -Algorithm SHA256).Hash
if ($sourceHash -ne $installedHash) { throw 'Installed pak verification failed.' }

Write-Host "SUCCESS: $installedPak"
Write-Host "SHA256: $installedHash"
Write-Host "FRAMEWORK: $installedFrameworkPak"
Write-Host "FRAMEWORK SHA256: $frameworkInstalledHash"
Write-Host "LEVELDEF: $installedLevelDefinitionPak"
Write-Host "LEVELDEF SHA256: $levelDefinitionInstalledHash"
