[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$mainPath = Join-Path $workspace 'LevelEditorApp\src\main.ts'
$generatorPath = Join-Path $workspace 'UAssetPipeline\Scripts\Generate-JLEProject.cjs'
$manifestPath = Join-Path $workspace 'LevelEditorApp\src\visual-manifest.json'
$csvPath = Join-Path $workspace 'Mesh-Gathering-Checklist.csv'
$markdownPath = Join-Path $workspace 'Mesh-Gathering-Checklist.md'

$source = Get-Content -LiteralPath $mainPath -Raw
$assetType = [regex]::Match($source, '(?s)type\s+AssetId\s*=\s*(?<body>.*?);\s*\r?\n\s*type\s+SurfaceGroup')
if (-not $assetType.Success) { throw 'Could not read the editor AssetId catalogue.' }
$catalogueIds = @([regex]::Matches($assetType.Groups['body'].Value, "'(?<id>[a-z0-9_]+)'") |
    ForEach-Object { $_.Groups['id'].Value } | Sort-Object -Unique)

$generator = Get-Content -LiteralPath $generatorPath -Raw
$classes = @{}
[regex]::Matches($generator, "(?m)^\s*(?<id>[a-z0-9_]+):\s*'(?<class>BP_[^']+)'") | ForEach-Object {
    $classes[$_.Groups['id'].Value] = $_.Groups['class'].Value
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$rows = foreach ($assetId in $catalogueIds) {
    if (-not $classes.ContainsKey($assetId)) { continue }
    $entryProperty = $manifest.assetVisuals.PSObject.Properties[$assetId]
    $files = @()
    if ($entryProperty) {
        if ($entryProperty.Value.file) { $files += [string]$entryProperty.Value.file }
        if ($entryProperty.Value.files) { $files += @($entryProperty.Value.files) }
    }
    [pscustomobject]@{
        assetId = $assetId
        actorClass = $classes[$assetId]
        status = if ($files.Count) { 'MAPPED' } else { 'NEEDS_FMODEL_EXPORT' }
        mappedFiles = (($files | ForEach-Object { Split-Path $_ -Leaf }) -join '; ')
        suggestedSearch = $classes[$assetId]
        notes = if ($files.Count) {
            'Grouped visual manifest entry exists.'
        } else {
            'Export the Blueprint property JSON and every referenced visible SM/SK component as GLB; the importer groups them automatically.'
        }
    }
}

$rows | Export-Csv -LiteralPath $csvPath -NoTypeInformation -Encoding utf8
$mapped = @($rows | Where-Object status -eq 'MAPPED')
$missing = @($rows | Where-Object status -eq 'NEEDS_FMODEL_EXPORT')
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add('# JETRUNNER editor mesh-gathering checklist')
$lines.Add('')
$lines.Add("Generated from the live editor catalogue and visual manifest. Runtime-backed assets: **$($rows.Count)**; mapped: **$($mapped.Count)**; awaiting FModel export: **$($missing.Count)**.")
$lines.Add('')
$lines.Add('Batch-export each Blueprint property JSON plus its referenced static/skeletal meshes from FModel, then drag the FModel `Output\\Exports` folder onto `Import Mesh Library.bat`. Multipart meshes are grouped automatically.')
$lines.Add('')
$lines.Add('## Already mapped')
$lines.Add('')
foreach ($row in $mapped) { $lines.Add(('- [x] `{0}` - `{1}` - {2}' -f $row.assetId, $row.actorClass, $row.mappedFiles)) }
$lines.Add('')
$lines.Add('## Awaiting FModel export')
$lines.Add('')
foreach ($row in $missing) { $lines.Add(('- [ ] `{0}` - search for `{1}`' -f $row.assetId, $row.actorClass)) }
[IO.File]::WriteAllLines($markdownPath, $lines, [Text.UTF8Encoding]::new($false))

Write-Host "Updated mesh coverage: $($mapped.Count)/$($rows.Count) mapped; $($missing.Count) awaiting FModel export."
