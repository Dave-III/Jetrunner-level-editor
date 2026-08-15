# Combined environment scenes

## FModel environment manifests

Raw FModel map JSON can be converted with the shared converter:

```powershell
python Scripts/convert_environments.py "C:\path\to\Maps.zip" `
  --output LevelEditorApp/public/environments/converted `
  --mesh-library UAssetPipeline/Tools/FModel/Output/Exports `
  --dependency-library "C:\path\to\FModel\Exports"
```

The converter accepts a JSON file, a directory tree, or a zip. It writes one
compact manifest per map plus `required_meshes.json`, which is the canonical
list of unique Unreal StaticMesh packages that still need preview GLBs.

When `--mesh-library` is supplied, matching FModel GLBs are hard-linked into
`converted/meshes` where possible, avoiding duplicate file data. Existing files are marked
`previewAvailable`, allowing the renderer to load each GLB once and render its
placements with `THREE.InstancedMesh`. Missing previews safely retain the
editor's existing approximate surroundings.

`--dependency-library` indexes exported Blueprint property JSON files. This
lets map components inherit their exact mesh and default transform from FModel
`Template` references instead of relying on per-map asset-name guesses.

This folder holds optional map-level GLB exports. A combined scene must retain
the actor hierarchy and transforms from the source map. Import one with:

```powershell
powershell -ExecutionPolicy Bypass -File ..\Scripts\Import-EnvironmentScene.ps1 `
  -EnvironmentId Environment_CentralPark -GlbPath C:\Exports\CentralPark.glb
```

The importer registers the scene in `src/visual-manifest.json`. When a scene is
registered, the editor loads it as a non-selectable background and does not
construct the approximate ring of individual catalogue props.
