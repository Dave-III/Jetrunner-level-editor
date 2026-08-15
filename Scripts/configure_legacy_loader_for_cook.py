import unreal

LOADER = "/Game/JLE/BP_JLE_RuntimeLoader.BP_JLE_RuntimeLoader"
TABLE = (
    ("ice_platform_4x4", "/Game/JLE/BP_JLE_TestCube.BP_JLE_TestCube"),
    ("launch_pad", "/Game/JLE/BP_JLE_TestCylinder.BP_JLE_TestCylinder"),
    (
        "time_trial_goal",
        "/Flashback/Rulesets/Common/BP_TimeTrialGoal_Sphere.BP_TimeTrialGoal_Sphere",
    ),
)

blueprint = unreal.load_asset(LOADER)
generated_class = unreal.EditorAssetLibrary.load_blueprint_class(LOADER)
if blueprint is None or generated_class is None:
    raise RuntimeError("Could not load BP_JLE_RuntimeLoader")

asset_ids = []
spawn_classes = []
for asset_id, path in TABLE:
    cls = unreal.EditorAssetLibrary.load_blueprint_class(path)
    if cls is None:
        raise RuntimeError(f"Could not load legacy dependency: {path}")
    asset_ids.append(asset_id)
    spawn_classes.append(cls)

cdo = unreal.get_default_object(generated_class)
cdo.set_editor_property("AssetIds", asset_ids)
cdo.set_editor_property("SpawnClasses", spawn_classes)
unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
if not unreal.EditorAssetLibrary.save_loaded_asset(blueprint, only_if_is_dirty=False):
    raise RuntimeError("Could not save legacy loader configuration")

unreal.log("[JLE] Configured complete legacy loader dependencies for cooking")
