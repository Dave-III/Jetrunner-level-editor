import unreal


for name in sorted(dir(unreal)):
    lowered = name.lower()
    if "struct" in lowered or "blueprinteditor" in lowered:
        unreal.log(f"JLE_API: {name}")

for owner_name in ("BlueprintEditorLibrary", "EditorAssetLibrary"):
    owner = getattr(unreal, owner_name, None)
    if owner is None:
        continue
    for name in sorted(dir(owner)):
        if any(token in name.lower() for token in ("variable", "struct", "member", "compile")):
            unreal.log(f"JLE_API: {owner_name}.{name}")
