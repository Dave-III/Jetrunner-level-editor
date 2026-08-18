[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$LevelData,

    [string]$GamePaksDirectory,
    [string]$ConverterPath,
    [string]$ConverterTailArgument = 'JETRUNNER',
    [string]$RepakPath,
    [string]$NodePath,
    [switch]$NodeIsElectron,
    [ValidateRange(10, 1800)]
    [int]$ToolTimeoutSeconds = 180,
    [switch]$SkipInstall,
    [switch]$KeepStage
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Resolve-RequiredFile([string]$Path, [string]$Label) {
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label was not found: $Path"
    }
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -eq 0) { throw "$Label is empty: $($item.FullName)" }
    return $item.FullName
}

function Assert-ChildPath([string]$Child, [string]$Parent, [string]$Label) {
    $childFull = [System.IO.Path]::GetFullPath($Child)
    $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    if (-not $childFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label escaped its intended root: $childFull"
    }
    return $childFull
}

function Invoke-Tool([string]$File, [string[]]$Arguments, [string]$Label) {
    Write-Host $Label
    $quoted = foreach ($argument in $Arguments) {
        if ($argument -match '[\s"]') { '"' + ($argument -replace '"', '\"') + '"' } else { $argument }
    }
    # Do not use Start-Process here. On another PC Windows may route an
    # unsigned downloaded executable through a focus-sensitive shell/security
    # prompt. Because the editor deliberately hides child windows, repak then
    # appears to freeze until Escape cancels that invisible prompt.
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $File
    $startInfo.Arguments = ($quoted -join ' ')
    $startInfo.WorkingDirectory = Split-Path -Parent $File
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw "$Label could not start: $File" }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit($ToolTimeoutSeconds * 1000)) {
        try { $process.Kill($true) } catch { $process.Kill() }
        throw "$Label timed out after $ToolTimeoutSeconds seconds. Check Logs and close any converter dialog before retrying."
    }
    $stdout = $stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    if ($stdout) { Write-Host $stdout.TrimEnd() }
    if ($stderr) { [Console]::Error.WriteLine($stderr.TrimEnd()) }
    if ($process.ExitCode -ne 0) {
        throw "$Label failed with exit code $($process.ExitCode). $stderr"
    }
}

function Assert-GeneratedAssetPair([string]$Primary, [string]$Sidecar, [string]$Label) {
    $primaryFile = Resolve-RequiredFile $Primary "$Label primary file"
    $sidecarFile = Resolve-RequiredFile $Sidecar "$Label sidecar file"
    if ((Get-Item -LiteralPath $primaryFile).Length -lt 64) { throw "$Label primary file is unexpectedly small." }
    if ((Get-Item -LiteralPath $sidecarFile).Length -lt 64) { throw "$Label sidecar file is unexpectedly small." }
}

$levelDataPath = Resolve-RequiredFile $LevelData 'Editor level JSON'
if (-not $ConverterPath) {
    $ConverterPath = Join-Path $PSScriptRoot 'Tools\UAssetGUI\UAssetGUI.exe'
}
if (-not $RepakPath) {
    $RepakPath = Join-Path $PSScriptRoot 'Tools\repak\repak.exe'
}
$converter = Resolve-RequiredFile $ConverterPath 'JSON-to-asset converter'
$repak = Resolve-RequiredFile $RepakPath 'repak.exe'
if (-not $NodePath) {
    $bundledNode = Join-Path $PSScriptRoot 'Tools\node\node.exe'
    if (Test-Path -LiteralPath $bundledNode -PathType Leaf) {
        $NodePath = $bundledNode
    } else {
        $NodePath = (Get-Command node.exe -ErrorAction Stop).Source
    }
}
$node = Resolve-RequiredFile $NodePath 'Node.js runtime'

$levelDataObject = Get-Content -LiteralPath $levelDataPath -Raw | ConvertFrom-Json
$rawName = if ($levelDataObject.levelId) { $levelDataObject.levelId } elseif ($levelDataObject.levelName) { $levelDataObject.levelName } else { $levelDataObject.displayName }
$isVerificationLevel = [string]$levelDataObject.levelId -eq 'JLE_VERIFICATION_LEVEL'
$rawDisplayName = if ($levelDataObject.displayName) { [string]$levelDataObject.displayName } else { [string]$levelDataObject.levelName }
$identity = ([string]$rawName -replace '[^A-Za-z0-9_]', '_') -replace '_+', '_'
$identity = $identity.Trim('_')
if (-not $identity) { $identity = 'Unnamed_Level' }
$identity = $identity -replace '^(?:Map_)?JLE_', '' -replace '^Map_', ''
if ($identity -notmatch '^[A-Za-z]') { $identity = "Level_$identity" }
# Keep this normalization identical to Generate-JLEProject.cjs. UAssetGUI
# silently rejects package identities containing multiple authored underscores.
$identity = $identity -replace '_', ''
$displayFileName = ($rawDisplayName -replace '[^A-Za-z0-9 _-]', '') -replace '\s+', '_'
$displayFileName = $displayFileName.Trim('_')
if (-not $displayFileName) { $displayFileName = 'Unnamed_Level' }

$projectsRoot = Join-Path $PSScriptRoot 'Projects'
$packagingRoot = Join-Path $PSScriptRoot 'Packaging'
$project = Assert-ChildPath (Join-Path $projectsRoot $identity) $projectsRoot 'Project directory'
$stage = Assert-ChildPath (Join-Path $packagingRoot $identity) $packagingRoot 'Packaging stage'

foreach ($target in @($project, $stage)) {
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $target | Out-Null
}

try {
    $generator = Join-Path $PSScriptRoot 'Scripts\Generate-JLEProject.cjs'
    $mapTemplate = Join-Path $PSScriptRoot 'Templates\Map_JLE_MAPNAME.json'
    $levelDefTemplate = Join-Path $PSScriptRoot 'Templates\LevelDef_JLE_MAPNAME.json'
    $exampleMap = Join-Path $PSScriptRoot 'Templates\Example_AllObjects.json'
    $previousElectronRunAsNode = $env:ELECTRON_RUN_AS_NODE
    try {
        if ($NodeIsElectron) { $env:ELECTRON_RUN_AS_NODE = '1' }
        Invoke-Tool $node @(
            $generator,
            '--level-data', $levelDataPath,
            '--map-template', $mapTemplate,
            '--leveldef-template', $levelDefTemplate,
            '--example-map', $exampleMap,
            '--output', $project
        ) 'Creating the tokenized UAssetAPI project JSON...'
    } finally {
        $env:ELECTRON_RUN_AS_NODE = $previousElectronRunAsNode
    }

    $mapName = "Map_JLE_$identity"
    $levelDefName = "LevelDef_JLE_$identity"
    $projectContent = Join-Path $project 'JETRUNNER\Content\Mods\CustomLevels'
    $stageContent = Join-Path $stage 'JETRUNNER\Content\Mods\CustomLevels'
    New-Item -ItemType Directory -Force -Path $stageContent | Out-Null

    $runtimeResources = Join-Path $PSScriptRoot 'Resources\JETRUNNER\Content\Mods\CustomLevels'
    # UAssetAPI automatically extracts missing unversioned schemas from
    # referenced Blueprint/struct assets when it can resolve them beside the
    # source JSON. Keep the framework's exact class assets in Projects for
    # conversion only. CustomLevelsV0.9.2.pak supplies these classes at
    # runtime; embedding a second copy in every level pak creates a mount-order
    # collision and can make the placed-object array deserialize as empty.
    Get-ChildItem -LiteralPath $runtimeResources -File |
        Copy-Item -Destination $projectContent -Force

    $mapJson = Join-Path $projectContent "$mapName.json"
    $levelDefJson = Join-Path $projectContent "$levelDefName.json"
    $mapOutput = Join-Path $stageContent "$mapName.umap"
    $levelDefOutput = Join-Path $stageContent "$levelDefName.uasset"
    $tail = if ([string]::IsNullOrWhiteSpace($ConverterTailArgument)) { @() } else { @($ConverterTailArgument) }

    Invoke-Tool $converter (@('fromjson', $mapJson, $mapOutput) + $tail) "Converting $mapName.json..."
    if (-not (Test-Path -LiteralPath $mapOutput -PathType Leaf)) {
        throw @"
The converter produced no map asset. Verify that JLE_ObjectPlacer.uasset/.uexp
and PlacedObject.uasset/.uexp exist beside the generated JSON, and that the
JETRUNNER mappings are present under the bundled UAssetGUI Data folder.
Converter: $converter
"@
    }
    Assert-GeneratedAssetPair $mapOutput ([System.IO.Path]::ChangeExtension($mapOutput, '.uexp')) 'Generated map'
    Invoke-Tool $converter (@('fromjson', $levelDefJson, $levelDefOutput) + $tail) "Converting $levelDefName.json..."
    if (-not (Test-Path -LiteralPath $levelDefOutput -PathType Leaf)) {
        throw "The converter produced no LevelDef asset. Check the bundled mappings and template files."
    }
    Assert-GeneratedAssetPair $levelDefOutput ([System.IO.Path]::ChangeExtension($levelDefOutput, '.uexp')) 'Generated LevelDef'

    Invoke-Tool $repak @('pack', '--version=V11', $stage) 'Packaging the V11 pak with repak...'
    $repakOutput = "$stage.pak"
    if (-not (Test-Path -LiteralPath $repakOutput -PathType Leaf)) {
        throw "repak reported success but did not create: $repakOutput"
    }
    if ((Get-Item -LiteralPath $repakOutput).Length -lt 1024) {
        throw "repak created an unexpectedly small pak: $repakOutput"
    }

    # Preserve the established output contract used by the Electron workflow
    # and existing external tooling. The installed destination remains Paks\JLE.
    $outputDirectory = Join-Path $PSScriptRoot 'Output'
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    $pakName = if ($isVerificationLevel) { 'JLE-VERIFICATIONLEVEL.pak' } else { "JLE-$displayFileName.pak" }
    $outputPak = Join-Path $outputDirectory $pakName
    $legacyOutputPak = Join-Path $outputDirectory "JLE-$identity`_P.pak"
    if (Test-Path -LiteralPath $legacyOutputPak -PathType Leaf) {
        Remove-Item -LiteralPath $legacyOutputPak -Force
    }
    Move-Item -LiteralPath $repakOutput -Destination $outputPak -Force

    $installedPak = $null
    if (-not $SkipInstall) {
        Write-Host 'Installing JLE output into the JETRUNNER pak directory...'
        if (-not (Test-Path -LiteralPath $GamePaksDirectory -PathType Container)) {
            throw "JETRUNNER Paks directory was not found: $GamePaksDirectory"
        }
        $jleDirectory = Join-Path $GamePaksDirectory 'JLE'
        New-Item -ItemType Directory -Force -Path $jleDirectory | Out-Null
        $installedPak = Join-Path $jleDirectory $pakName
        $temporaryInstalledPak = "$installedPak.jle-installing"
        $previousInstalledPak = "$installedPak.jle-previous"
        $legacyInstalledPak = Join-Path $jleDirectory "JLE-$identity`_P.pak"
        if (Test-Path -LiteralPath $legacyInstalledPak -PathType Leaf) {
            Remove-Item -LiteralPath $legacyInstalledPak -Force
        }
        Remove-Item -LiteralPath $temporaryInstalledPak -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $previousInstalledPak -Force -ErrorAction SilentlyContinue
        Copy-Item -LiteralPath $outputPak -Destination $temporaryInstalledPak -Force
        if ((Get-FileHash $outputPak -Algorithm SHA256).Hash -ne
            (Get-FileHash $temporaryInstalledPak -Algorithm SHA256).Hash) {
            Remove-Item -LiteralPath $temporaryInstalledPak -Force -ErrorAction SilentlyContinue
            throw 'Temporary installed pak failed SHA-256 verification.'
        }
        try {
            if (Test-Path -LiteralPath $installedPak -PathType Leaf) {
                Move-Item -LiteralPath $installedPak -Destination $previousInstalledPak -Force
            }
            Move-Item -LiteralPath $temporaryInstalledPak -Destination $installedPak -Force
            if ((Get-FileHash $outputPak -Algorithm SHA256).Hash -ne
                (Get-FileHash $installedPak -Algorithm SHA256).Hash) {
                throw 'Installed pak failed SHA-256 verification.'
            }
            Remove-Item -LiteralPath $previousInstalledPak -Force -ErrorAction SilentlyContinue
        } catch {
            Remove-Item -LiteralPath $installedPak -Force -ErrorAction SilentlyContinue
            if (Test-Path -LiteralPath $previousInstalledPak -PathType Leaf) {
                Move-Item -LiteralPath $previousInstalledPak -Destination $installedPak -Force
            }
            Remove-Item -LiteralPath $temporaryInstalledPak -Force -ErrorAction SilentlyContinue
            throw
        }
    }

    [pscustomobject]@{
        Success = $true
        Identity = $identity
        Map = "/Game/Mods/CustomLevels/$mapName"
        LevelDefinition = "/Game/Mods/CustomLevels/$levelDefName"
        Pak = $outputPak
        InstalledPak = $installedPak
    } | ConvertTo-Json -Compress | Write-Output
} finally {
    if (-not $KeepStage -and (Test-Path -LiteralPath $stage)) {
        $verifiedStage = Assert-ChildPath $stage $packagingRoot 'Packaging cleanup'
        Remove-Item -LiteralPath $verifiedStage -Recurse -Force
    }
}
