# JETRUNNER UAsset custom-level pipeline

The current pipeline takes the compact JSON exported by the desktop editor,
builds complete UAssetAPI map and LevelDef JSON, converts both assets, packages
them with `repak` V11, and installs the result in `Content\Paks\JLE`.

It no longer launches Unreal Editor, cooks an Unreal project, or overwrites
`Map_Pillars`.

## Required files

1. Put the compatible JSON-to-asset converter at:

   `UAssetPipeline\Tools\UAssetGUI\UAssetGUI.exe`

   `JLE.exe` represents the eventual packaged level-editor application and is
   not part of conversion. UAssetGUI uses the base JETRUNNER mappings, then
   automatically extracts the custom `JLE_ObjectPlacer_C` and `PlacedObject`
   schemas from the cooked assets copied beside the project JSON.

2. The supplied UAssetAPI JSON sources are:

   - `Templates\Map_JLE_MAPNAME.json`, containing `JLE_ObjectPlacer_C_1`;
   - `Templates\LevelDef_JLE_MAPNAME.json`, its matching level definition.
   - `Templates\Example_AllObjects.json`, containing working prototypes for
     every object and its bool/int/float entity arrays.

3. `repak.exe`, `oo2core_9_win64.dll`, `JLE_ObjectPlacer`, and `PlacedObject`
   are local binary resources ignored by Git. Each generated level pak uses
   the exact loose runtime assets supplied in `JLESetup\Resources\Template`;
   these are intentionally packaged with the generated map.

## Automated workflow

`Build-JLELevel.ps1` performs these operations:

1. Creates a clean `Projects\<level name>` folder.
2. Replaces every `MAPNAME` token.
3. Inserts Player Start, goal, editor objects, transforms, entity values,
   skybox, environment, and world polarity.
4. Copies `JLE_ObjectPlacer` and `PlacedObject` beside the project JSON so
   UAssetAPI automatically extracts their unversioned schemas.
5. Numbers `PlacedObjects` exactly like the working example.
6. Converts JSON into `.umap`, `.uasset`, and companion files.
7. Creates a clean staging tree with the required runtime assets.
8. Runs `repak pack --version=V11`.
9. Deletes the staging folder and installs `JLE-<level name>_P.pak` in
   `JETRUNNER\Content\Paks\JLE`.
10. Installs and hash-verifies the supplied `CustomLevelsV1.0.pak` framework beside the level.

## Run

```powershell
.\UAssetPipeline\Build-JLELevel.ps1 `
  -LevelData "C:\path\to\editor-level.json" `
  -GamePaksDirectory "C:\path\to\JETRUNNER\JETRUNNER\Content\Paks"
```

The desktop editor's **Export + Install** button now calls this pipeline
directly. If the normal Steam installation cannot be found, it asks for the
`Content\Paks` directory.

The editor's **Environment** controls export the selected surroundings as
`worldSettings.environment` and the selected scenario/time of day as both
`worldSettings.timeOfDay` and the runtime-compatible
`worldSettings.skybox`. The generator validates and writes these names into
the `JLE_ObjectPlacer` map data.

Dynamic targets are linked to the goal through
`ASBRemoteActivator::AddRemoteActor` and registered through
`USBGameModeFunctionLibrary::AddRuntimeResettableActor`. This preserves the
native target-count, target-finished audio, goal lock/unlock, and completion
event path; do not replace these calls with direct writes to private runtime
arrays.

Generated `PlacedObjects` are always sorted with Player Start first, every
TimeTrial goal next, and all remaining objects afterward. Goal
`FloatProperties` are cleared because the old first float was
`CheckpointRadius`; the uniformly locked goal scale is now the sole source for
its spherical checkpoint range.

`Build-JLELevel.bat` also accepts an exported JSON by drag-and-drop. Use
`-SkipInstall` for isolated package testing and `-KeepStage` for diagnostics.
