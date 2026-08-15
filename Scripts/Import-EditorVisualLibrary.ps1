[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$SourceDirectory,

    [string]$OverridesFile,

    [string]$GroupMapFile,

    [switch]$Rebuild,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$source = Get-Item -LiteralPath $SourceDirectory -ErrorAction Stop
if (-not $source.PSIsContainer) { throw 'SourceDirectory must be a folder.' }

$workspace = Split-Path -Parent $PSScriptRoot
$app = Join-Path $workspace 'LevelEditorApp'
$mainSource = Join-Path $app 'src\main.ts'
$manifestPath = Join-Path $app 'src\visual-manifest.json'
$destination = Join-Path $app 'public\asset-visuals'
New-Item -ItemType Directory -Force -Path $destination | Out-Null

# Read the legacy catalogue identifiers from its string-literal union, then
# merge Dweeb's generated static-mesh allowlist. This prevents an unapproved
# FModel export from silently becoming a live editor asset.
$sourceText = Get-Content -LiteralPath $mainSource -Raw
$assetTypeMatch = [regex]::Match(
    $sourceText,
    '(?s)type\s+LegacyAssetId\s*=\s*(?<body>.*?);\s*\r?\n\s*\r?\n'
)
if (-not $assetTypeMatch.Success) { throw 'Could not read LegacyAssetId catalogue from src\main.ts.' }
$validIds = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
[regex]::Matches($assetTypeMatch.Groups['body'].Value, "'(?<id>[a-z0-9_]+)'") |
    ForEach-Object { [void]$validIds.Add($_.Groups['id'].Value) }

$newCataloguePath = Join-Path $app 'src\new-object-catalog.json'
$newCatalogue = Get-Content -LiteralPath $newCataloguePath -Raw | ConvertFrom-Json
foreach ($entry in $newCatalogue) { [void]$validIds.Add([string]$entry.assetId) }

# Accept game-facing Blueprint/static-mesh names as aliases. This allows raw
# FModel exports such as BP_WaterPipe.glb or SM_WaterPipe.glb to map to the
# editor's canonical water_pipe ID without manual renaming.
$generatorPath = Join-Path $workspace 'UAssetPipeline\Scripts\Generate-JLEProject.cjs'
$generatorText = Get-Content -LiteralPath $generatorPath -Raw
$aliases = @{}
[regex]::Matches($generatorText, "(?m)^\s*(?<id>[a-z0-9_]+):\s*'(?<class>BP_[^']+)'") |
    ForEach-Object {
        $id = $_.Groups['id'].Value
        $class = $_.Groups['class'].Value
        $stem = $class -replace '^BP_', ''
        foreach ($alias in @($class, $stem, "SM_$stem", "SK_$stem")) {
            $aliases[$alias.ToLowerInvariant()] = $id
        }
    }

# AllAssetsNew uses raw StaticMesh object names rather than Blueprint class
# names. Accept both the exact package name and the conventional SM_ prefix;
# no other game meshes are admitted because new-object-catalog.json is the
# authoritative allowlist.
foreach ($entry in $newCatalogue) {
    $id = [string]$entry.assetId
    $name = [string]$entry.objectName
    foreach ($alias in @($name, "SM_$name")) {
        $aliases[$alias.ToLowerInvariant()] = $id
    }
}

function Get-NormalizedMeshStem([string]$name) {
    $stem = [IO.Path]::GetFileNameWithoutExtension($name)
    # Split CamelCase words without breaking acronyms and size tokens such as
    # SM, ICE, BOT or 2x2.
    $stem = $stem -creplace '([a-z])([A-Z][a-z])', '$1_$2'
    $stem = $stem.ToLowerInvariant()
    $stem = $stem -replace '^(bp|sm|sk)_', ''
    $stem = $stem -replace '(?:_lod\d+|_low|_high|_nanite)$', ''
    $stem = $stem -replace '[^a-z0-9]+', '_'
    return $stem.Trim('_')
}

function Get-MeshSignature([string]$name) {
    $ignored = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    @('bp', 'sm', 'sk', 'big', 'bot', 'bottom', 'top', 'snow', 'mesh', 'static', 'low', 'high', 'nanite', '01') |
        ForEach-Object { [void]$ignored.Add($_) }
    $tokens = (Get-NormalizedMeshStem $name) -split '_' |
        Where-Object { $_ -and -not $ignored.Contains($_) } |
        Sort-Object -Unique
    return @($tokens)
}

function Test-TokenSubset($left, $right) {
    foreach ($token in @($left)) { if ($token -notin @($right)) { return $false } }
    return $true
}

# FModel's raw batch output keeps the game-facing package names. Add normalized
# aliases as well so small punctuation/casing differences do not prevent a
# direct BP/SM/SK match.
$normalizedAliases = @{}
foreach ($pair in $aliases.GetEnumerator()) {
    $normalized = Get-NormalizedMeshStem $pair.Key
    if (-not $normalizedAliases.ContainsKey($normalized)) {
        $normalizedAliases[$normalized] = $pair.Value
    }
}

$signatureAliases = [System.Collections.Generic.List[object]]::new()
foreach ($pair in $aliases.GetEnumerator()) {
    $tokens = @(Get-MeshSignature $pair.Key)
    if ($tokens.Count -gt 0) {
        $signatureAliases.Add([pscustomobject]@{ AssetId = $pair.Value; Tokens = $tokens; Compact = ($tokens -join '') })
    }
}
# Some editor-only catalogue entries (for example wooden_platform_2x2) do not
# have a class alias in the runtime generator. Include every canonical AssetId
# in fuzzy matching so raw FModel mesh names can still resolve to them.
foreach ($assetId in $validIds) {
    $tokens = @(Get-MeshSignature $assetId)
    if ($tokens.Count -gt 0) {
        $signatureAliases.Add([pscustomobject]@{ AssetId = $assetId; Tokens = $tokens; Compact = ($tokens -join '') })
    }
}

function Find-SignatureAssetId([string]$name) {
    $tokens = @(Get-MeshSignature $name)
    if ($tokens.Count -eq 0) { return $null }
    $compact = $tokens -join ''
    $matches = foreach ($candidate in $signatureAliases) {
        $overlap = @($tokens | Where-Object { $_ -in $candidate.Tokens }).Count
        if ($compact -eq $candidate.Compact) {
            [pscustomobject]@{ AssetId = $candidate.AssetId; Score = 1.0 }
        } elseif ($overlap -gt 0 -and ((Test-TokenSubset $tokens $candidate.Tokens) -or (Test-TokenSubset $candidate.Tokens $tokens))) {
            [pscustomobject]@{
                AssetId = $candidate.AssetId
                Score = $overlap / [Math]::Max($tokens.Count, $candidate.Tokens.Count)
            }
        }
    }
    if (-not $matches) { return $null }
    $bestScore = ($matches | Measure-Object Score -Maximum).Maximum
    $bestIds = @($matches | Where-Object Score -eq $bestScore | Select-Object -ExpandProperty AssetId -Unique)
    if ($bestIds.Count -eq 1) { return $bestIds[0] }
    return $null
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if (-not $manifest.assetVisuals) {
    $manifest | Add-Member -NotePropertyName assetVisuals -NotePropertyValue ([pscustomobject]@{}) -Force
}

if ([string]::IsNullOrWhiteSpace($OverridesFile)) {
    $candidate = Join-Path $source.FullName 'mesh-map.overrides.json'
    if (Test-Path -LiteralPath $candidate) { $OverridesFile = $candidate }
}
$overrides = if ($OverridesFile) {
    Get-Content -LiteralPath $OverridesFile -Raw | ConvertFrom-Json
} else {
    [pscustomobject]@{}
}

if ([string]::IsNullOrWhiteSpace($GroupMapFile)) {
    $candidate = Join-Path $source.FullName 'mesh-groups.json'
    if (Test-Path -LiteralPath $candidate) { $GroupMapFile = $candidate }
}
$groupMap = if ($GroupMapFile) {
    Get-Content -LiteralPath $GroupMapFile -Raw | ConvertFrom-Json
} else {
    [pscustomobject]@{}
}

# Blueprint property exports contain the StaticMesh/SkeletalMesh package paths
# used by composite actors. When those JSON files are present beside FModel's
# GLBs, use them to associate every referenced part with the Blueprint's JLE
# asset ID. Ambiguous shared meshes are left for mesh-groups.json to resolve.
$dependencyCandidates = @{}
Get-ChildItem -LiteralPath $source.FullName -Filter '*.json' -File -Recurse |
    ForEach-Object {
        $blueprintKey = $_.BaseName.ToLowerInvariant()
        $assetId = $null
        if ($aliases.ContainsKey($blueprintKey)) { $assetId = $aliases[$blueprintKey] }
        elseif ($normalizedAliases.ContainsKey((Get-NormalizedMeshStem $_.BaseName))) {
            $assetId = $normalizedAliases[(Get-NormalizedMeshStem $_.BaseName)]
        }
        if (-not $assetId) { return }
        $jsonText = Get-Content -LiteralPath $_.FullName -Raw
        [regex]::Matches(
            $jsonText,
            '(?i)(?:AssetPathName|ObjectPath)"?\s*:\s*"[^"]*/(?<mesh>(?:SM|SK)_[A-Za-z0-9_]+)(?:\.[^"]*)?"'
        ) | ForEach-Object {
            $key = (Get-NormalizedMeshStem $_.Groups['mesh'].Value)
            if (-not $dependencyCandidates.ContainsKey($key)) {
                $dependencyCandidates[$key] = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
            }
            [void]$dependencyCandidates[$key].Add($assetId)
        }
    }

$dependencyAliases = @{}
foreach ($pair in $dependencyCandidates.GetEnumerator()) {
    if ($pair.Value.Count -eq 1) { $dependencyAliases[$pair.Key] = @($pair.Value)[0] }
}

function Get-ExplicitGroups([IO.FileInfo]$model) {
    $matches = [System.Collections.Generic.List[string]]::new()
    if (-not $groupMap.groups) { return $matches }
    $relative = $model.FullName.Substring($source.FullName.Length).TrimStart('\', '/') -replace '\\', '/'
    foreach ($property in $groupMap.groups.PSObject.Properties) {
        if (-not $validIds.Contains($property.Name)) { continue }
        foreach ($pattern in @($property.Value)) {
            if ($relative -like ([string]$pattern -replace '\\', '/')) {
                $matches.Add($property.Name)
                break
            }
        }
    }
    return $matches
}

$imported = [System.Collections.Generic.List[string]]::new()
$rejected = [System.Collections.Generic.List[string]]::new()
$models = Get-ChildItem -LiteralPath $source.FullName -Filter '*.glb' -File -Recurse
if ($models.Count -eq 0) { throw "No .glb files were found under: $($source.FullName)" }

$groupedModels = @{}
foreach ($model in $models) {
    $explicitGroups = @(Get-ExplicitGroups $model)
    $rawGroup = ($model.BaseName.ToLowerInvariant() -split '__', 2)[0]
    $normalized = Get-NormalizedMeshStem $model.BaseName
    $automaticId = $null
    if ($validIds.Contains($rawGroup)) { $automaticId = $rawGroup }
    elseif ($aliases.ContainsKey($rawGroup)) { $automaticId = $aliases[$rawGroup] }
    elseif ($normalizedAliases.ContainsKey($normalized)) { $automaticId = $normalizedAliases[$normalized] }
    elseif ($dependencyAliases.ContainsKey($normalized)) { $automaticId = $dependencyAliases[$normalized] }
    elseif ($normalized -match '^(?<size>[0-9]+x[0-9]+)_ice(?:_|$)') {
        $sizedIceId = "ice_platform_$($Matches['size'])"
        if ($validIds.Contains($sizedIceId)) { $automaticId = $sizedIceId }
    }
    else { $automaticId = Find-SignatureAssetId $model.BaseName }

    $assetIds = if ($explicitGroups.Count -gt 0) { $explicitGroups } elseif ($automaticId) { @($automaticId) } else { @() }
    if ($assetIds.Count -eq 0) {
        $rejected.Add("$($model.FullName) (no unambiguous Blueprint/alias/group mapping)")
        continue
    }
    foreach ($assetId in $assetIds) {
        if (-not $groupedModels.ContainsKey($assetId)) {
            $groupedModels[$assetId] = [System.Collections.Generic.List[IO.FileInfo]]::new()
        }
        $groupedModels[$assetId].Add($model)
    }
}

foreach ($assetId in ($groupedModels.Keys | Sort-Object)) {
    $group = @($groupedModels[$assetId] | Sort-Object FullName)
    if ($assetId -like 'static_*' -and $group.Count -gt 1) {
        # Raw static-mesh catalogue entries are single objects, not composite
        # Blueprints. Duplicate package basenames can exist in old and newer
        # environment folders; prefer NewTemples where available, otherwise
        # use the shortest canonical package path instead of stacking copies.
        $preferred = @($group | Where-Object FullName -Match '(?i)[\\/]NewTemples[\\/]')
        if ($preferred.Count -gt 0) { $group = @($preferred | Select-Object -First 1) }
        else { $group = @($group | Sort-Object { $_.FullName.Length }, FullName | Select-Object -First 1) }
    }
    if ($assetId -eq 'wooden_platform') {
        # The game contains several unrelated wooden platform silhouettes.
        # The resizable catalogue surface is the square platform; importing
        # the octagon and tower-side variants as additional parts stacks three
        # complete models on top of one another.
        $squarePlatform = @($group | Where-Object BaseName -Match '(?i)wooden_square_platform')
        if ($squarePlatform.Count -gt 0) { $group = $squarePlatform }
    }
    # A Blueprint can reference the same package repeatedly. Keep one physical
    # part per source file and one per byte-identical GLB.
    $seenHashes = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    $group = @($group | Where-Object {
        $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        $seenHashes.Add($hash)
    })

    $publicFiles = [System.Collections.Generic.List[string]]::new()
    $usedNames = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($model in $group) {
        $part = Get-NormalizedMeshStem $model.BaseName
        $targetName = if ($group.Count -eq 1) { "$assetId.glb" } else { "${assetId}__${part}.glb" }
        if (-not $usedNames.Add($targetName)) {
            $shortHash = (Get-FileHash -LiteralPath $model.FullName -Algorithm SHA256).Hash.Substring(0, 8).ToLowerInvariant()
            $targetName = "${assetId}__${part}_${shortHash}.glb"
            [void]$usedNames.Add($targetName)
        }
        if (-not $DryRun) {
            Copy-Item -LiteralPath $model.FullName -Destination (Join-Path $destination $targetName) -Force
        }
        $publicFiles.Add("./asset-visuals/$targetName")
    }

    $entry = [ordered]@{
        scale = 100
    }
    if ($publicFiles.Count -eq 1) { $entry['file'] = $publicFiles[0] }
    else { $entry['files'] = @($publicFiles) }
    $overrideProperty = $overrides.PSObject.Properties[$assetId]
    if ($overrideProperty) {
        $override = $overrideProperty.Value
        foreach ($property in @('scale', 'position', 'rotationDegrees')) {
            if ($null -ne $override.$property) { $entry[$property] = $override.$property }
        }
    }
    $manifest.assetVisuals | Add-Member -NotePropertyName $assetId `
        -NotePropertyValue ([pscustomobject]$entry) -Force
    $imported.Add($assetId)
}

# Reuse one representative visual for related catalogue IDs without copying the
# same GLBs. Example: { "ice_platform_2x3": "ice_platform_2x2" }.
if ($groupMap.familyAliases) {
    foreach ($property in $groupMap.familyAliases.PSObject.Properties) {
        $targetId = $property.Name
        $sourceId = [string]$property.Value
        if (-not $validIds.Contains($targetId)) { throw "Unknown family alias target '$targetId'." }
        $sourceEntry = $manifest.assetVisuals.PSObject.Properties[$sourceId]
        if (-not $sourceEntry) { throw "Family alias '$targetId' references missing visual '$sourceId'." }
        $manifest.assetVisuals | Add-Member -NotePropertyName $targetId -NotePropertyValue $sourceEntry.Value -Force
        $imported.Add($targetId)
    }
}

# Produce stable output so mesh-map changes remain easy to review.
$sortedVisuals = [ordered]@{}
$manifest.assetVisuals.PSObject.Properties |
    Sort-Object Name |
    ForEach-Object { $sortedVisuals[$_.Name] = $_.Value }
$output = [ordered]@{
    assetVisuals = $sortedVisuals
    skyboxVisuals = $manifest.skyboxVisuals
}
if (-not $DryRun) {
    [IO.File]::WriteAllText(
        $manifestPath,
        (($output | ConvertTo-Json -Depth 12) + "`n"),
        [Text.UTF8Encoding]::new($false)
    )
}

Write-Host "Imported $($imported.Count) editor mesh(es):" -ForegroundColor Green
$imported | ForEach-Object { Write-Host "  + $_" }
if ($rejected.Count -gt 0) {
    Write-Warning "Skipped $($rejected.Count) file(s):"
    $rejected | ForEach-Object { Write-Warning "  - $_" }
}
Write-Host "Mesh map: $manifestPath"
Write-Host "Physical library: $destination"
if ($DryRun) { Write-Host 'Dry run: no files or manifest entries were written.' -ForegroundColor Yellow }

if (-not $DryRun) {
    $textureBinder = Join-Path $PSScriptRoot 'Bind-FModelGlbTextures.mjs'
    Write-Host 'Binding exported FModel base-colour textures to imported GLBs...'
    & node $textureBinder $source.FullName $destination
    if ($LASTEXITCODE -ne 0) { throw 'FModel GLB texture binding failed.' }
}

if ($Rebuild -and -not $DryRun) {
    Push-Location $app
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Editor build failed with exit code $LASTEXITCODE." }
    } finally {
        Pop-Location
    }
}
