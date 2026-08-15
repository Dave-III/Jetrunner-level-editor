param(
    [Parameter(Mandatory = $true)]
    [string]$EnvironmentId,
    [Parameter(Mandatory = $true)]
    [string]$GlbPath,
    [double]$Scale = 100,
    [double]$X = 0,
    [double]$Y = 0,
    [double]$Z = 0
)

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$app = Join-Path $workspace 'LevelEditorApp'
$manifestPath = Join-Path $app 'src\visual-manifest.json'
$destinationDirectory = Join-Path $app 'public\environments'

if (-not (Test-Path -LiteralPath $GlbPath -PathType Leaf)) {
    throw "Combined environment GLB not found: $GlbPath"
}
if ([IO.Path]::GetExtension($GlbPath) -ine '.glb') {
    throw 'The combined environment scene must be a self-contained .glb file.'
}
if ($EnvironmentId -notmatch '^[A-Za-z0-9_]+$') {
    throw "Invalid environment ID '$EnvironmentId'. Use the exact scenario/environment ID from the editor."
}

New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
$destinationName = "$EnvironmentId.glb"
$destinationPath = Join-Path $destinationDirectory $destinationName
Copy-Item -LiteralPath $GlbPath -Destination $destinationPath -Force

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (-not $manifest.environmentScenes) {
    $manifest | Add-Member -MemberType NoteProperty -Name environmentScenes -Value ([pscustomobject]@{})
}
$entry = [ordered]@{
    file = "./environments/$destinationName"
    scale = $Scale
    position = @($X, $Y, $Z)
}
$manifest.environmentScenes | Add-Member -MemberType NoteProperty -Name $EnvironmentId -Value ([pscustomobject]$entry) -Force
$manifest | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $manifestPath -Encoding UTF8

Write-Host "Imported combined environment: $EnvironmentId"
Write-Host "Scene: $destinationPath"
Write-Host 'The editor will now use this complete scene instead of the approximate prop ring.'
