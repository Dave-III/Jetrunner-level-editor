import unreal


BLUEPRINT_PROXIES = (
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_Ice"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_DigitalPlatform"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_DigitalPlatform_Red"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_Dark"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_Orange"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_Purple"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_PurpleAndOrange"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_White"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_WhiteAndBlue"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_WhiteAndGold"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_WhiteAndOrange"),
    ("/Game/Maps/DigitalRealm/Assets", "BP_RealVirtualPlatform_WhiteAndRed"),
    ("/Game/Hazards/LaunchPad", "BP_LaunchPad"),
    ("/Game/Hazards/ItemSpawner/PresetSpawners", "BP_ItemOrb_JetFreeze"),
    ("/Game/Hazards/ItemSpawner/PresetSpawners", "BP_ItemOrb_JetHook"),
    ("/Game/Hazards/ItemSpawner/PresetSpawners", "BP_ItemOrb_JetJellyBomb"),
    ("/Game/Hazards/ItemSpawner/PresetSpawners", "BP_ItemOrb_JetLeap"),
    ("/Game/Hazards/ItemSpawner/PresetSpawners", "BP_ItemOrb_JetPolarizer"),
    ("/Game/Hazards/ItemSpawner/PresetSpawners", "BP_ItemOrb_JetSlam"),
    ("/Game/Hazards/EnergyPickup", "BP_EnergyPickup"),
    ("/Game/Hazards/Targets", "BP_Target_Plain"),
    ("/Game/Hazards/Targets", "BP_Target_Gun"),
    ("/Game/Hazards/Targets", "BP_Target_Gatling"),
    ("/Game/Hazards/Targets", "BP_Target_Cannon"),
    ("/Game/Hazards/Targets", "BP_Target_Laser"),
    ("/Game/Hazards/Targets", "BP_Target_Wall"),
)

LEVEL_PROXIES = (
    "/Game/Maps/CentralPark/Environment_CentralPark",
    "/Game/Maps/CentralPark/Scenarios/Scenario_TheNightThatNeverSleeps",
)


def ensure_directory(path):
    if not unreal.EditorAssetLibrary.does_directory_exist(path):
        if not unreal.EditorAssetLibrary.make_directory(path):
            raise RuntimeError(f"Could not create directory: {path}")


asset_tools = unreal.AssetToolsHelpers.get_asset_tools()

for package_path, asset_name in BLUEPRINT_PROXIES:
    asset_path = f"{package_path}/{asset_name}"
    if unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        unreal.log(f"[JLE Proxy Setup] Already present: {asset_path}")
        continue

    ensure_directory(package_path)
    factory = unreal.BlueprintFactory()
    factory.set_editor_property("parent_class", unreal.Actor)
    asset = asset_tools.create_asset(asset_name, package_path, unreal.Blueprint, factory)
    if asset is None:
        raise RuntimeError(f"Failed to create Blueprint proxy: {asset_path}")
    unreal.EditorAssetLibrary.save_loaded_asset(asset, only_if_is_dirty=False)
    unreal.log(f"[JLE Proxy Setup] Created Blueprint proxy: {asset_path}")

level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)

for level_path in LEVEL_PROXIES:
    if unreal.EditorAssetLibrary.does_asset_exist(level_path):
        unreal.log(f"[JLE Proxy Setup] Already present: {level_path}")
        continue

    ensure_directory(level_path.rsplit("/", 1)[0])
    if not level_subsystem.new_level(level_path):
        raise RuntimeError(f"Failed to create level proxy: {level_path}")
    if not level_subsystem.save_current_level():
        raise RuntimeError(f"Failed to save level proxy: {level_path}")
    unreal.log(f"[JLE Proxy Setup] Created level proxy: {level_path}")

unreal.log("[JLE Proxy Setup] Game asset proxies created successfully")
