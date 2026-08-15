[CmdletBinding(DefaultParameterSetName = 'Asset')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Asset')]
    [ValidatePattern('^[a-z0-9_]+$')]
    [string]$AssetId,

    [Parameter(Mandatory = $true, ParameterSetName = 'Skybox')]
    [ValidatePattern('^Scenario_[A-Za-z0-9_]+$')]
    [string]$ScenarioId,

    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(ParameterSetName = 'Asset')]
    [double]$Scale = 100
)

$ErrorActionPreference = 'Stop'
$sourceFile = Get-Item -LiteralPath $Source -ErrorAction Stop
if ($sourceFile.PSIsContainer) { throw 'Source must be a file.' }

$workspace = Split-Path -Parent $PSScriptRoot
$app = Join-Path $workspace 'LevelEditorApp'
$manifestPath = Join-Path $app 'src\visual-manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ($PSCmdlet.ParameterSetName -eq 'Asset') {
    if ($sourceFile.Extension -notin @('.glb', '.gltf')) {
        throw 'Prop visuals must be exported as .glb or .gltf. GLB is recommended.'
    }
    if ($sourceFile.Extension -eq '.gltf') {
        throw 'Use a self-contained .glb so textures and binary buffers cannot be left behind.'
    }
    $destinationDirectory = Join-Path $app 'public\asset-visuals'
    $destinationName = "$AssetId.glb"
    $publicPath = "./asset-visuals/$destinationName"
    Copy-Item -LiteralPath $sourceFile.FullName `
        -Destination (Join-Path $destinationDirectory $destinationName) -Force
    $manifest.assetVisuals | Add-Member -NotePropertyName $AssetId `
        -NotePropertyValue ([pscustomobject]@{ file = $publicPath; scale = $Scale }) -Force
    $label = "asset '$AssetId'"
} else {
    if ($sourceFile.Extension -notin @('.png', '.jpg', '.jpeg', '.webp')) {
        throw 'Skybox previews must be equirectangular PNG, JPG, or WebP images.'
    }
    $destinationDirectory = Join-Path $app 'public\skyboxes'
    $destinationName = "$ScenarioId$($sourceFile.Extension.ToLowerInvariant())"
    $publicPath = "./skyboxes/$destinationName"
    Copy-Item -LiteralPath $sourceFile.FullName `
        -Destination (Join-Path $destinationDirectory $destinationName) -Force
    $manifest.skyboxVisuals | Add-Member -NotePropertyName $ScenarioId `
        -NotePropertyValue $publicPath -Force
    $label = "skybox '$ScenarioId'"
}

$json = $manifest | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText(
    $manifestPath,
    "$json`n",
    [System.Text.UTF8Encoding]::new($false)
)
Write-Host "Imported $label as $publicPath"
Write-Host 'Rebuild or relaunch the editor to load it.'
