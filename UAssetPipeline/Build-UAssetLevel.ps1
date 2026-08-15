[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$LevelName,

    [string]$MapJson,

    [string]$LevelDefinitionJson,

    [string]$UAssetGuiPath,
    [string]$UnrealPakPath = 'C:\UE_5.6\Engine\Binaries\Win64\UnrealPak.exe',
    [string]$MappingsPath,
    [string]$NameToken = 'MAPNAME',
    [string]$ModsDirectory = 'C:\Program Files (x86)\Steam\steamapps\common\JETRUNNER\JETRUNNER\Content\Paks\~mods',
    [string]$OutputDirectory,
    [switch]$KeepWorkingDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ([string]::IsNullOrWhiteSpace($MapJson)) {
    $MapJson = Join-Path $PSScriptRoot 'Templates\Map_JLE_MAPNAME.json'
}
if ([string]::IsNullOrWhiteSpace($LevelDefinitionJson)) {
    $LevelDefinitionJson = Join-Path $PSScriptRoot 'Templates\LevelDef_JLE_MAPNAME.json'
}

function Resolve-RequiredFile {
    param([string]$Path, [string]$Label)
    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "$Label was not specified."
    }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label was not found: $Path"
    }
    return (Resolve-Path -LiteralPath $Path).Path
}

function Resolve-UAssetGui {
    param([string]$RequestedPath)

    $candidates = @()
    if ($RequestedPath) { $candidates += $RequestedPath }
    $candidates += (Join-Path $PSScriptRoot 'Tools\UAssetGUI\UAssetGUI.exe')
    $command = Get-Command UAssetGUI.exe -ErrorAction SilentlyContinue
    if ($command) { $candidates += $command.Source }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw @"
UAssetGUI.exe was not found.

Place the portable release here:
  $PSScriptRoot\Tools\UAssetGUI\UAssetGUI.exe

Or pass:
  -UAssetGuiPath "C:\path\to\UAssetGUI.exe"
"@
}

function Resolve-UAssetGuiMappings {
    param([string]$RequestedPath, [string]$UAssetGuiExe)

    $mappingDirectory = Join-Path (Split-Path $UAssetGuiExe -Parent) 'Data\Mappings'
    $candidate = $RequestedPath
    if ([string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $mappingDirectory)) {
        $available = @(Get-ChildItem -LiteralPath $mappingDirectory -Filter '*.usmap' -File)
        if ($available.Count -eq 1) {
            $candidate = $available[0].FullName
        } elseif ($available.Count -gt 1) {
            $preferred = @($available | Where-Object BaseName -eq 'JETRUNNER')
            if ($preferred.Count -eq 1) { $candidate = $preferred[0].FullName }
        }
    }
    if ([string]::IsNullOrWhiteSpace($candidate)) { return $null }

    $resolved = Resolve-RequiredFile $candidate 'UAssetGUI mappings file'
    New-Item -ItemType Directory -Force -Path $mappingDirectory | Out-Null
    $portableCopy = Join-Path $mappingDirectory ([System.IO.Path]::GetFileName($resolved))
    if (-not [System.IO.Path]::GetFullPath($resolved).Equals(
        [System.IO.Path]::GetFullPath($portableCopy),
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        Copy-Item -LiteralPath $resolved -Destination $portableCopy -Force
    }

    # UAssetGUI 1.1.0 accepts the mapping name from Data\Mappings, without
    # an extension. Newer releases also accept this backwards-compatible form.
    return [System.IO.Path]::GetFileNameWithoutExtension($portableCopy)
}

function Get-SafeLevelName {
    param([string]$Name)
    $safe = ($Name.Trim() -replace '[^A-Za-z0-9_]', '_') -replace '_+', '_'
    $safe = $safe.Trim('_')
    if (-not $safe) { throw 'LevelName must contain at least one letter or number.' }
    if ($safe -notmatch '^[A-Za-z]') { $safe = "Level_$safe" }
    return $safe
}

function Write-PatchedTemplate {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Token,
        [string]$Replacement
    )

    $raw = [System.IO.File]::ReadAllText($Source)
    try {
        $null = $raw | ConvertFrom-Json
    } catch {
        throw "Template is not valid JSON: $Source`n$($_.Exception.Message)"
    }

    if ($Token -and -not $raw.Contains($Token)) {
        throw "Template does not contain the required name token '$Token': $Source"
    }

    $patched = if ($Token) { $raw.Replace($Token, $Replacement) } else { $raw }
    try {
        $null = $patched | ConvertFrom-Json
    } catch {
        throw "Token replacement produced invalid JSON for: $Source`n$($_.Exception.Message)"
    }

    [System.IO.File]::WriteAllText(
        $Destination,
        $patched,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments, [string]$Label)
    Write-Host $Label

    # UAssetGUI is a Windows GUI-subsystem executable. Invoking it with `&`
    # can return before conversion completes and may leave LASTEXITCODE unset.
    # Start-Process provides a real waitable process and deterministic code.
    $quotedArguments = foreach ($argument in $Arguments) {
        if ($argument -match '[\s"]') {
            '"' + ($argument -replace '(\\*)"', '$1$1\"' -replace '(\\+)$', '$1$1') + '"'
        } else {
            $argument
        }
    }
    $process = Start-Process `
        -FilePath $File `
        -ArgumentList $quotedArguments `
        -WindowStyle Hidden `
        -Wait `
        -PassThru
    if ($process.ExitCode -ne 0) {
        throw "$Label failed with exit code $($process.ExitCode)."
    }
}

function Add-AssetFamilyToPakList {
    param(
        [string]$BasePath,
        [string]$DestinationRoot,
        [System.Collections.Generic.List[string]]$Lines
    )

    $extensions = @('.uasset', '.umap', '.uexp', '.ubulk', '.uptnl')
    $added = 0
    foreach ($extension in $extensions) {
        $source = [System.IO.Path]::ChangeExtension($BasePath, $extension)
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $destination = "$DestinationRoot/$([System.IO.Path]::GetFileName($source))"
        $Lines.Add("""$source"" ""$destination""")
        $added++
    }
    if ($added -eq 0) {
        throw "UAssetGUI produced no asset files for: $BasePath"
    }
}

$safeName = Get-SafeLevelName $LevelName
$identityName = $safeName
if ($identityName.StartsWith('Map_', [System.StringComparison]::OrdinalIgnoreCase)) {
    $identityName = $identityName.Substring(4)
}
if ($identityName.StartsWith('JLE_', [System.StringComparison]::OrdinalIgnoreCase)) {
    $identityName = $identityName.Substring(4)
}
if (-not $identityName) {
    throw 'LevelName must contain an identity after optional Map_ and JLE_ prefixes.'
}
$assetIdentityName = "JLE_$identityName"
$mapObjectName = "Map_$assetIdentityName"
$levelDefinitionObjectName = "LevelDef_$assetIdentityName"
$pakName = "JLE-$identityName.pak"

$resolvedMapJson = Resolve-RequiredFile $MapJson 'Map template JSON'
$resolvedLevelDefinitionJson = Resolve-RequiredFile $LevelDefinitionJson 'LevelDefinition template JSON'
$resolvedUAssetGui = Resolve-UAssetGui $UAssetGuiPath
$resolvedUnrealPak = Resolve-RequiredFile $UnrealPakPath 'UnrealPak.exe'

$resolvedMappings = Resolve-UAssetGuiMappings $MappingsPath $resolvedUAssetGui

if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $PSScriptRoot 'Output'
}
$OutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
$workRoot = Join-Path $PSScriptRoot 'Working'
$workDirectory = Join-Path $workRoot ("{0}-{1}" -f $identityName, [guid]::NewGuid().ToString('N'))
$jsonDirectory = Join-Path $workDirectory 'Json'
$assetDirectory = Join-Path $workDirectory 'Assets'
$responseFile = Join-Path $workDirectory 'PakResponse.txt'

New-Item -ItemType Directory -Force -Path $jsonDirectory, $assetDirectory, $OutputDirectory | Out-Null

try {
    $patchedMapJson = Join-Path $jsonDirectory "$mapObjectName.json"
    $patchedLevelDefinitionJson = Join-Path $jsonDirectory "$levelDefinitionObjectName.json"
    Write-PatchedTemplate $resolvedMapJson $patchedMapJson $NameToken $identityName
    Write-PatchedTemplate $resolvedLevelDefinitionJson $patchedLevelDefinitionJson $NameToken $identityName

    $mapOutput = Join-Path $assetDirectory "$mapObjectName.umap"
    $levelDefinitionOutput = Join-Path $assetDirectory "$levelDefinitionObjectName.uasset"

    $mapArgs = @('fromjson', $patchedMapJson, $mapOutput)
    $levelDefinitionArgs = @('fromjson', $patchedLevelDefinitionJson, $levelDefinitionOutput)
    if ($resolvedMappings) {
        $mapArgs += $resolvedMappings
        $levelDefinitionArgs += $resolvedMappings
    }

    Invoke-Checked $resolvedUAssetGui $mapArgs "Converting map JSON to $mapObjectName.umap..."
    if (-not (Test-Path -LiteralPath $mapOutput -PathType Leaf)) {
        $hiddenError = Get-Clipboard -Raw -ErrorAction SilentlyContinue
        $detail = if ($hiddenError -match '^System\.[A-Za-z]+Exception:') {
            "`n`nUAssetGUI diagnostic:`n$hiddenError"
        } else { '' }
        throw "UAssetGUI reported success but did not create: $mapOutput$detail"
    }

    Invoke-Checked $resolvedUAssetGui $levelDefinitionArgs "Converting LevelDef JSON to $levelDefinitionObjectName.uasset..."
    if (-not (Test-Path -LiteralPath $levelDefinitionOutput -PathType Leaf)) {
        throw "UAssetGUI reported success but did not create: $levelDefinitionOutput"
    }

    $pakLines = [System.Collections.Generic.List[string]]::new()
    $mountRoot = '../../../JETRUNNER/Content/Mods/CustomLevels'
    Add-AssetFamilyToPakList $mapOutput $mountRoot $pakLines
    Add-AssetFamilyToPakList $levelDefinitionOutput $mountRoot $pakLines
    [System.IO.File]::WriteAllLines($responseFile, $pakLines, [System.Text.UTF8Encoding]::new($false))

    $outputPak = Join-Path $OutputDirectory $pakName
    $legacyOutputPak = Join-Path $OutputDirectory "JLE-$identityName`_P.pak"
    if (Test-Path -LiteralPath $legacyOutputPak -PathType Leaf) {
        Remove-Item -LiteralPath $legacyOutputPak -Force
    }
    Invoke-Checked $resolvedUnrealPak @($outputPak, "-create=$responseFile", '-compress') 'Packaging custom-level pak...'
    Invoke-Checked $resolvedUnrealPak @($outputPak, '-list') 'Verifying custom-level pak contents...'

    New-Item -ItemType Directory -Force -Path $ModsDirectory | Out-Null
    $installedPak = Join-Path $ModsDirectory $pakName
    $legacyInstalledPak = Join-Path $ModsDirectory "JLE-$identityName`_P.pak"
    if (Test-Path -LiteralPath $legacyInstalledPak -PathType Leaf) {
        Remove-Item -LiteralPath $legacyInstalledPak -Force
    }
    Copy-Item -LiteralPath $outputPak -Destination $installedPak -Force

    $sourceHash = (Get-FileHash -LiteralPath $outputPak -Algorithm SHA256).Hash
    $installedHash = (Get-FileHash -LiteralPath $installedPak -Algorithm SHA256).Hash
    if ($sourceHash -ne $installedHash) {
        throw 'Installed pak failed SHA-256 verification.'
    }

    Write-Host ''
    Write-Host 'SUCCESS'
    Write-Host "Map: /Game/Mods/CustomLevels/$mapObjectName"
    Write-Host "LevelDef: /Game/Mods/CustomLevels/$levelDefinitionObjectName"
    Write-Host "Pak: $installedPak"
    Write-Host "SHA256: $installedHash"
} finally {
    if (-not $KeepWorkingDirectory -and (Test-Path -LiteralPath $workDirectory)) {
        Remove-Item -LiteralPath $workDirectory -Recurse -Force
    } elseif ($KeepWorkingDirectory) {
        Write-Host "Working files retained: $workDirectory"
    }
}
