# JETRUNNER editor prop visuals

This is the editor's physical mesh library. Each self-contained `.glb` is named
after its exact JLE asset ID, for example `wooden_platform.glb` or `crane.glb`.
Multipart actors use a double-underscore suffix, for example
`wooden_platform__top.glb` and `wooden_platform__supports.glb`. The importer
groups those files into one visual entry automatically.

Raw FModel batch exports are also supported. The importer reads Blueprint
property JSON files, associates referenced `SM_`/`SK_` packages with the
correct JLE asset ID, groups multipart actors, removes byte-identical parts,
and gives copied files stable canonical names. Direct BP/SM/SK aliases are used
when no Blueprint property JSON is available.

For shared or ambiguous meshes, place `mesh-groups.json` at the root of the
batch export. Its `groups` values are wildcard paths. `familyAliases` can reuse
one representative visual for size-only catalogue variants. See
`mesh-groups.example.json` in this folder.

For a bulk import, put any number of correctly named GLBs in one folder and
drag that folder onto `Import Mesh Library.bat` in the workspace root. The
importer validates names against the real catalogue, copies the files here,
updates `src/visual-manifest.json`, and verifies the editor build.

An optional `mesh-map.overrides.json` beside the source GLBs can specify
editor-only scale, position, and rotation. See
`mesh-map.overrides.example.json` for its format.

The GLB is a visual child of the editor placeholder. The placeholder remains
responsible for selection, snapping, transforms, collision, and exported JSON.
This means a visual export can never change the runtime object class.

FModel exports should use a self-contained GLB with embedded materials and
textures. Standard glTF metre units default to scale 100 because the editor and
Unreal author transforms in centimetres.
