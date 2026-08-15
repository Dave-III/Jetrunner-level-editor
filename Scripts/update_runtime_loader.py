import unreal

LOADER_PATH = "/Game/JLE/BP_JLE_RuntimeLoader.BP_JLE_RuntimeLoader"
SPAWN_TABLE = [
    (
        "ice_platform_4x4",
        "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_Ice.BP_RealVirtualPlatform_Ice",
    ),
    ("digital_platform", "/Game/Maps/DigitalRealm/Assets/BP_DigitalPlatform.BP_DigitalPlatform"),
    ("digital_platform_red", "/Game/Maps/DigitalRealm/Assets/BP_DigitalPlatform_Red.BP_DigitalPlatform_Red"),
    ("virtual_platform_dark", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_Dark.BP_RealVirtualPlatform_Dark"),
    ("virtual_platform_orange", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_Orange.BP_RealVirtualPlatform_Orange"),
    ("virtual_platform_purple", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_Purple.BP_RealVirtualPlatform_Purple"),
    ("virtual_platform_purple_orange", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_PurpleAndOrange.BP_RealVirtualPlatform_PurpleAndOrange"),
    ("virtual_platform_white", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_White.BP_RealVirtualPlatform_White"),
    ("virtual_platform_white_blue", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_WhiteAndBlue.BP_RealVirtualPlatform_WhiteAndBlue"),
    ("virtual_platform_white_gold", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_WhiteAndGold.BP_RealVirtualPlatform_WhiteAndGold"),
    ("virtual_platform_white_orange", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_WhiteAndOrange.BP_RealVirtualPlatform_WhiteAndOrange"),
    ("virtual_platform_white_red", "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_WhiteAndRed.BP_RealVirtualPlatform_WhiteAndRed"),
    (
        "launch_pad",
        "/Game/Hazards/LaunchPad/BP_LaunchPad.BP_LaunchPad",
    ),
    ("ability_jetfreeze", "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetFreeze.BP_ItemOrb_JetFreeze"),
    ("ability_jethook", "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetHook.BP_ItemOrb_JetHook"),
    ("ability_jetjellybomb", "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetJellyBomb.BP_ItemOrb_JetJellyBomb"),
    ("ability_jetleap", "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetLeap.BP_ItemOrb_JetLeap"),
    ("ability_jetpolarizer", "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetPolarizer.BP_ItemOrb_JetPolarizer"),
    ("ability_jetslam", "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetSlam.BP_ItemOrb_JetSlam"),
    ("energy_pickup", "/Game/Hazards/EnergyPickup/BP_EnergyPickup.BP_EnergyPickup"),
    ("enemy_plain", "/Game/Hazards/Targets/BP_Target_Plain.BP_Target_Plain"),
    ("enemy_gun", "/Game/Hazards/Targets/BP_Target_Gun.BP_Target_Gun"),
    ("enemy_gatling", "/Game/Hazards/Targets/BP_Target_Gatling.BP_Target_Gatling"),
    ("enemy_cannon", "/Game/Hazards/Targets/BP_Target_Cannon.BP_Target_Cannon"),
    ("enemy_laser", "/Game/Hazards/Targets/BP_Target_Laser.BP_Target_Laser"),
    ("enemy_wall", "/Game/Hazards/Targets/BP_Target_Wall.BP_Target_Wall"),
    (
        "time_trial_goal",
        "/Flashback/Rulesets/Common/BP_TimeTrialGoal_Sphere.BP_TimeTrialGoal_Sphere",
    ),
]

blueprint = unreal.load_asset(LOADER_PATH)
if blueprint is None:
    raise RuntimeError(f"Could not load runtime loader: {LOADER_PATH}")

generated_class = unreal.EditorAssetLibrary.load_blueprint_class(LOADER_PATH)
if generated_class is None:
    raise RuntimeError("Runtime loader has no generated class")

default_object = unreal.get_default_object(generated_class)
asset_ids = []
spawn_classes = []

for asset_id, class_path in SPAWN_TABLE:
    spawn_class = unreal.EditorAssetLibrary.load_blueprint_class(class_path)
    if spawn_class is None:
        raise RuntimeError(
            f"Missing editor-only gameplay proxy for {asset_id}: {class_path}\n"
            "Run Scripts/create_game_asset_proxies.py first."
        )
    asset_ids.append(asset_id)
    spawn_classes.append(spawn_class)

default_object.set_editor_property("AssetIds", asset_ids)
default_object.set_editor_property("SpawnClasses", spawn_classes)
unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)

if not unreal.EditorAssetLibrary.save_loaded_asset(blueprint, only_if_is_dirty=False):
    raise RuntimeError("Failed to save BP_JLE_RuntimeLoader")

unreal.log(f"[JLE Loader] Updated {len(asset_ids)} runtime spawn mappings")
for asset_id, class_path in SPAWN_TABLE:
    unreal.log(f"[JLE Loader] {asset_id} -> {class_path}")
