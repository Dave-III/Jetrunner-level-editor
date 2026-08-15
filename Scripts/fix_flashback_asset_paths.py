import unreal


MOVES = (
    (
        "/Flashback/Content/Rulesets/TimeTrial/Ruleset_TimeTrial",
        "/Flashback/Rulesets/TimeTrial/Ruleset_TimeTrial",
    ),
    (
        "/Flashback/Content/Rulesets/Common/BP_TimeTrialGoal_Sphere",
        "/Flashback/Rulesets/Common/BP_TimeTrialGoal_Sphere",
    ),
)


def ensure_directory(path):
    if not unreal.EditorAssetLibrary.does_directory_exist(path):
        if not unreal.EditorAssetLibrary.make_directory(path):
            raise RuntimeError(f"Could not create asset directory: {path}")


for source, destination in MOVES:
    if unreal.EditorAssetLibrary.does_asset_exist(destination):
        unreal.log(f"[JLE Path Fix] Already correct: {destination}")
        continue

    if not unreal.EditorAssetLibrary.does_asset_exist(source):
        raise RuntimeError(f"Source asset does not exist: {source}")

    ensure_directory(destination.rsplit("/", 1)[0])
    unreal.log(f"[JLE Path Fix] Moving {source} -> {destination}")
    if not unreal.EditorAssetLibrary.rename_asset(source, destination):
        raise RuntimeError(f"Failed to move {source} to {destination}")

unreal.EditorAssetLibrary.save_directory("/Flashback", only_if_is_dirty=False, recursive=True)

level_definition_path = "/Flashback/Maps/Campaign/NewYork/LevelDef_Pillars"
if not unreal.EditorAssetLibrary.does_asset_exist(level_definition_path):
    unreal.log(f"[JLE Path Fix] Creating editor-only placeholder: {level_definition_path}")
    factory = unreal.DataAssetFactory()
    factory.set_editor_property("data_asset_class", unreal.JetLevelDefinition)
    asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        "LevelDef_Pillars",
        "/Flashback/Maps/Campaign/NewYork",
        unreal.JetLevelDefinition,
        factory,
    )
    if asset is None:
        raise RuntimeError(f"Failed to create {level_definition_path}")
    unreal.EditorAssetLibrary.save_loaded_asset(asset, only_if_is_dirty=False)
else:
    unreal.log(f"[JLE Path Fix] Already present: {level_definition_path}")

unreal.log("[JLE Path Fix] Flashback asset paths corrected successfully")
