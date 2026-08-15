import json
import math
import os
import unreal


# ============================================================
# Jetrunner Level Editor - JSON to UMap Compiler
# ============================================================
#
# This script reads a LevelData JSON file and generates a .umap.
#
# It creates:
#   - Lighting
#   - PlayerStart
#   - BP_JLE_RuntimeLoader
#   - BP_JLE_SpawnMarker actors
#
# The marker actors store AssetId values.
# At runtime, BP_JLE_RuntimeLoader replaces the markers with real/test objects.
#
# Run this from inside Unreal Editor:
#   Tools -> Execute Python Script
#
# Do NOT run this while Play/Simulate is active.
# ============================================================


# ------------------------------------------------------------
# Config
# ------------------------------------------------------------

PROJECT_DIR = unreal.Paths.project_dir()

# Change this whenever you want to compile a new test level file.
LEVEL_JSON_FILENAME = "Map_Pillars.json"

JSON_PATH = os.path.join(PROJECT_DIR, "LevelData", LEVEL_JSON_FILENAME)


# ------------------------------------------------------------
# Target 8 path option
# ------------------------------------------------------------
#
# For normal compiler-project testing, use:
#   OUTPUT_MAP_ROOT = "/Game/CustomMaps"
#
# For DML/Jetrunner-style testing, we are now trying:
#   OUTPUT_MAP_ROOT = "/Flashback/CustomMaps"
#
# This requires your dummy Flashback plugin to exist and be enabled:
#
#   Plugins/
#   └─ Flashback/
#      ├─ Flashback.uplugin
#      └─ Content/
#
# Generated map path becomes:
#   /Flashback/CustomMaps/<LevelName>
# ------------------------------------------------------------

OUTPUT_MAP_ROOT = "/Flashback/Maps/Campaign/NewYork"

# Fallback/testing option:
# OUTPUT_MAP_ROOT = "/Game/CustomMaps"


# Blueprint asset paths.
# Important: these are Blueprint asset paths, NOT _C generated class paths.
MARKER_BLUEPRINT_PATH = "/Game/JLE/BP_JLE_SpawnMarker.BP_JLE_SpawnMarker"
RUNTIME_LOADER_BLUEPRINT_PATH = "/Game/JLE/BP_JLE_RuntimeLoader.BP_JLE_RuntimeLoader"
RULESET_BLUEPRINT_PATH = "/Flashback/Rulesets/TimeTrial/Ruleset_TimeTrial.Ruleset_TimeTrial"
TIME_TRIAL_GOAL_BLUEPRINT_PATH = "/Flashback/Rulesets/Common/BP_TimeTrialGoal_Sphere.BP_TimeTrialGoal_Sphere"
LEVEL_DEFINITION_PATH = "/Flashback/Maps/Campaign/NewYork/LevelDef_Pillars.LevelDef_Pillars"

# Native classes supplied by the local compatibility shim while authoring and by
# JETRUNNER itself when the cooked replacement map runs in the game.
SB_PLAYER_START_CLASS_PATH = "/Script/JETRUNNER.SBPlayerStart"

# Complex shipped Blueprints must never be serialized from empty editor proxies.
# They are emitted as markers and spawned by BP_JLE_RuntimeLoader at BeginPlay.
DIRECT_GAMEPLAY_ASSETS = {}

# Visible authoring proxies. These are ordinary engine meshes marked editor-only,
# so they help with placement but are stripped from cooked builds.
DUMMY_PLACEHOLDER_ID = "jle_dummy"
DUMMY_PLACEHOLDER_MESH = "/Engine/BasicShapes/Cube.Cube"

RUNTIME_SPAWN_TABLE = {
    "ice_platform_4x4": (
        "/Game/Maps/DigitalRealm/Assets/"
        "BP_RealVirtualPlatform_Ice.BP_RealVirtualPlatform_Ice"
    ),
    "digital_platform": "/Game/Maps/DigitalRealm/Assets/BP_DigitalPlatform.BP_DigitalPlatform",
    "digital_platform_red": "/Game/Maps/DigitalRealm/Assets/BP_DigitalPlatform_Red.BP_DigitalPlatform_Red",
    "virtual_platform_dark": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_Dark.BP_RealVirtualPlatform_Dark",
    "virtual_platform_orange": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_Orange.BP_RealVirtualPlatform_Orange",
    "virtual_platform_purple": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_Purple.BP_RealVirtualPlatform_Purple",
    "virtual_platform_purple_orange": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_PurpleAndOrange.BP_RealVirtualPlatform_PurpleAndOrange",
    "virtual_platform_white": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_White.BP_RealVirtualPlatform_White",
    "virtual_platform_white_blue": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_WhiteAndBlue.BP_RealVirtualPlatform_WhiteAndBlue",
    "virtual_platform_white_gold": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_WhiteAndGold.BP_RealVirtualPlatform_WhiteAndGold",
    "virtual_platform_white_orange": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_WhiteAndOrange.BP_RealVirtualPlatform_WhiteAndOrange",
    "virtual_platform_white_red": "/Game/Maps/DigitalRealm/Assets/BP_RealVirtualPlatform_WhiteAndRed.BP_RealVirtualPlatform_WhiteAndRed",
    "launch_pad": "/Game/Hazards/LaunchPad/BP_LaunchPad.BP_LaunchPad",
    "ability_jetfreeze": "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetFreeze.BP_ItemOrb_JetFreeze",
    "ability_jethook": "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetHook.BP_ItemOrb_JetHook",
    "ability_jetjellybomb": "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetJellyBomb.BP_ItemOrb_JetJellyBomb",
    "ability_jetleap": "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetLeap.BP_ItemOrb_JetLeap",
    "ability_jetpolarizer": "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetPolarizer.BP_ItemOrb_JetPolarizer",
    "ability_jetslam": "/Game/Hazards/ItemSpawner/PresetSpawners/BP_ItemOrb_JetSlam.BP_ItemOrb_JetSlam",
    "energy_pickup": "/Game/Hazards/EnergyPickup/BP_EnergyPickup.BP_EnergyPickup",
    "enemy_plain": "/Game/Hazards/Targets/BP_Target_Plain.BP_Target_Plain",
    "enemy_gun": "/Game/Hazards/Targets/BP_Target_Gun.BP_Target_Gun",
    "enemy_gatling": "/Game/Hazards/Targets/BP_Target_Gatling.BP_Target_Gatling",
    "enemy_cannon": "/Game/Hazards/Targets/BP_Target_Cannon.BP_Target_Cannon",
    "enemy_laser": "/Game/Hazards/Targets/BP_Target_Laser.BP_Target_Laser",
    "enemy_wall": "/Game/Hazards/Targets/BP_Target_Wall.BP_Target_Wall",
    "time_trial_goal": (
        "/Flashback/Rulesets/Common/"
        "BP_TimeTrialGoal_Sphere.BP_TimeTrialGoal_Sphere"
    ),
}

REQUIRED_STREAMING_LEVELS = (
    "/Game/Maps/CentralPark/Environment_CentralPark",
    "/Game/Maps/CentralPark/Scenarios/Scenario_TheNightThatNeverSleeps",
)


# Default support actor locations.
RUNTIME_LOADER_LOCATION = unreal.Vector(0, 0, 500)
PLAYER_START_LOCATION = unreal.Vector(-600, 0, 200)
PLAYER_START_ROTATION = unreal.Rotator(0, 0, 0)
PLAYER_START_SAFETY_LIFT_CM = 100.0

DIRECTIONAL_LIGHT_LOCATION = unreal.Vector(0, 0, 1500)
DIRECTIONAL_LIGHT_ROTATION = unreal.Rotator(-45, 0, 0)

SKY_LIGHT_LOCATION = unreal.Vector(0, 0, 1000)
TIME_TRIAL_GOAL_LOCATION = unreal.Vector(1200, 0, 200)


# ------------------------------------------------------------
# Logging
# ------------------------------------------------------------

def log(message):
    unreal.log(f"[JLE Compiler] {message}")


def warn(message):
    unreal.log_warning(f"[JLE Compiler] {message}")


def error(message):
    unreal.log_error(f"[JLE Compiler] {message}")


# ------------------------------------------------------------
# JSON helpers
# ------------------------------------------------------------

def load_level_json(path):
    log(f"Loading level JSON: {path}")

    if not os.path.exists(path):
        raise RuntimeError(f"Level JSON not found: {path}")

    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def vec3(data, default_x=0, default_y=0, default_z=0):
    if data is None:
        data = {}

    return unreal.Vector(
        float(data.get("x", default_x)),
        float(data.get("y", default_y)),
        float(data.get("z", default_z)),
    )


def rotator(data, default_pitch=0, default_yaw=0, default_roll=0):
    if data is None:
        data = {}

    # Unreal Python exposes Rotator's constructor fields in roll/pitch/yaw
    # order. Use named arguments so JSON pitch/yaw/roll can never be assigned
    # to the wrong axes.
    return unreal.Rotator(
        roll=float(data.get("roll", default_roll)),
        pitch=float(data.get("pitch", default_pitch)),
        yaw=float(data.get("yaw", default_yaw)),
    )


# ------------------------------------------------------------
# Asset / level helpers
# ------------------------------------------------------------

def ensure_directory_exists(unreal_folder_path):
    if unreal.EditorAssetLibrary.does_directory_exist(unreal_folder_path):
        return

    log(f"Creating folder: {unreal_folder_path}")

    success = unreal.EditorAssetLibrary.make_directory(unreal_folder_path)

    if not success:
        raise RuntimeError(
            f"Failed to create folder: {unreal_folder_path}\n\n"
            "If this is a plugin path like /Flashback/CustomMaps, make sure the "
            "Flashback plugin exists, is enabled, and CanContainContent is true."
        )


def delete_existing_asset(asset_path):
    if not unreal.EditorAssetLibrary.does_asset_exist(asset_path):
        return

    warn(f"Asset already exists, deleting old version: {asset_path}")

    success = unreal.EditorAssetLibrary.delete_asset(asset_path)

    if not success:
        raise RuntimeError(f"Failed to delete existing asset: {asset_path}")


def create_new_level(level_path):
    log(f"Creating map: {level_path}")

    try:
        if unreal.EditorLevelLibrary.editor_in_play_mode():
            raise RuntimeError(
                "The editor is currently in Play/Simulate mode. "
                "Stop Play/Simulate before running compile_level.py."
            )
    except AttributeError:
        # Some UE versions do not expose editor_in_play_mode() in Python.
        # Just continue. If the editor is in Play/Simulate, later editor operations will fail anyway.
        pass

    ensure_directory_exists(OUTPUT_MAP_ROOT)
    delete_existing_asset(level_path)

    try:
        level_editor_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
        if not level_editor_subsystem.new_level(level_path):
            raise RuntimeError(f"LevelEditorSubsystem.new_level returned false for: {level_path}")
    except Exception as subsystem_error:
        warn("LevelEditorSubsystem.new_level failed. Falling back to EditorLevelLibrary.new_level.")
        warn(str(subsystem_error))
        if not unreal.EditorLevelLibrary.new_level(level_path):
            raise RuntimeError(f"Failed to create new level: {level_path}")


def save_current_level():
    log("Saving current level...")

    try:
        level_editor_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
        level_editor_subsystem.save_current_level()
    except Exception as subsystem_error:
        warn("LevelEditorSubsystem.save_current_level failed. Falling back to EditorLevelLibrary.save_current_level.")
        warn(str(subsystem_error))
        unreal.EditorLevelLibrary.save_current_level()


def load_blueprint_class(blueprint_path, label):
    log(f"Loading {label}: {blueprint_path}")

    blueprint_class = unreal.EditorAssetLibrary.load_blueprint_class(blueprint_path)

    if blueprint_class is None:
        raise RuntimeError(
            f"Could not load {label}: {blueprint_path}\n\n"
            "Make sure the Blueprint exists, is compiled, and is saved.\n"
            "Also make sure you are using the Blueprint asset path, not the _C path."
        )

    return blueprint_class


def load_native_class(class_path, label):
    log(f"Loading {label}: {class_path}")

    native_class = unreal.load_class(None, class_path)
    if native_class is None:
        raise RuntimeError(
            f"Could not load {label}: {class_path}\n\n"
            "Make sure the JETRUNNER compatibility plugin is enabled and compiled."
        )

    return native_class


def configure_runtime_loader():
    """Persist the data-driven AssetId -> genuine game class mapping."""
    log("Configuring BP_JLE_RuntimeLoader spawn table")
    blueprint = unreal.load_asset(RUNTIME_LOADER_BLUEPRINT_PATH)
    if blueprint is None:
        raise RuntimeError(f"Could not load runtime loader: {RUNTIME_LOADER_BLUEPRINT_PATH}")
    generated_class = unreal.EditorAssetLibrary.load_blueprint_class(
        RUNTIME_LOADER_BLUEPRINT_PATH
    )
    if generated_class is None:
        raise RuntimeError("Runtime loader has no generated class")

    asset_ids = []
    spawn_classes = []
    for asset_id, class_path in RUNTIME_SPAWN_TABLE.items():
        spawn_class = unreal.EditorAssetLibrary.load_blueprint_class(class_path)
        if spawn_class is None:
            raise RuntimeError(
                f"Missing editor proxy for runtime mapping {asset_id}: {class_path}"
            )
        asset_ids.append(asset_id)
        spawn_classes.append(spawn_class)

    default_object = unreal.get_default_object(generated_class)
    default_object.set_editor_property("AssetIds", asset_ids)
    default_object.set_editor_property("SpawnClasses", spawn_classes)
    unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
    if not unreal.EditorAssetLibrary.save_loaded_asset(blueprint, only_if_is_dirty=False):
        raise RuntimeError("Failed to save configured BP_JLE_RuntimeLoader")
    log(f"Verified runtime spawn mappings: {', '.join(asset_ids)}")
    return generated_class


def set_editor_property_checked(obj, property_name, value, label):
    try:
        obj.set_editor_property(property_name, value)
    except Exception as property_error:
        raise RuntimeError(
            f"Failed to set {label} ({property_name}).\n"
            "The local JETRUNNER shim may not match the dumped reflected property.\n\n"
            f"Original error: {property_error}"
        )


def configure_world_settings(data):
    log("Configuring ASBWorldSettings")

    world = unreal.EditorLevelLibrary.get_editor_world()
    if world is None:
        raise RuntimeError("Could not obtain the editor world after creating the level")

    world_settings = world.get_world_settings()
    if world_settings is None:
        raise RuntimeError("Could not obtain World Settings for the new level")

    actual_class = world_settings.get_class().get_name()
    if actual_class != "SBWorldSettings":
        raise RuntimeError(
            "The new map is not using ASBWorldSettings.\n"
            f"Actual class: {actual_class}\n\n"
            "Check WorldSettingsClassName in Config/DefaultEngine.ini and restart Unreal Editor."
        )

    settings_data = data.get("worldSettings", {})
    ruleset_path = settings_data.get("defaultRuleset", RULESET_BLUEPRINT_PATH)
    ruleset_class = load_blueprint_class(ruleset_path, "time-trial ruleset")
    level_definition_path = settings_data.get("levelDefinition", LEVEL_DEFINITION_PATH)
    level_definition = unreal.EditorAssetLibrary.load_asset(level_definition_path)
    if level_definition is None:
        raise RuntimeError(
            f"Could not load level definition placeholder: {level_definition_path}\n\n"
            "Run Scripts/fix_flashback_asset_paths.py once before compiling the level."
        )

    set_editor_property_checked(world_settings, "default_ruleset", ruleset_class, "DefaultRuleset")
    set_editor_property_checked(
        world_settings,
        "level_definition",
        level_definition,
        "LevelDefinition",
    )
    required_settings = (
        ("is_menu_world", bool(settings_data.get("isMenuWorld", False)), "bIsMenuWorld"),
        ("energy_at_start", float(settings_data.get("energyAtStart", 0.0)), "EnergyAtStart"),
        (
            "world_starting_polarity",
            int(settings_data.get("worldStartingPolarity", 0)),
            "WorldStartingPolarity",
        ),
        (
            "is_flashback_world",
            bool(settings_data.get("isFlashbackWorld", False)),
            "bIsFlashbackWorld",
        ),
    )
    for property_name, value, label in required_settings:
        set_editor_property_checked(world_settings, property_name, value, label)
        actual_value = world_settings.get_editor_property(property_name)
        if actual_value != value:
            raise RuntimeError(
                f"World setting {label} failed verification: "
                f"expected {value!r}, got {actual_value!r}"
            )

    log(
        "Verified ASBWorldSettings prerequisites: DefaultRuleset, "
        "LevelDefinition, bIsMenuWorld, EnergyAtStart, "
        "WorldStartingPolarity, bIsFlashbackWorld"
    )
    return world_settings


def create_custom_level_definition(data, output_level_path):
    """Create a unique experience identity so custom maps never reuse Pillars' LB."""
    level_id = str(data.get("levelId", "")).strip()
    if not level_id.startswith("jle_"):
        raise RuntimeError("A valid custom levelId is required for leaderboard isolation")
    safe_id = "".join(character for character in level_id if character.isalnum() or character == "_")
    asset_name = f"LevelDef_{safe_id}"
    package_path = "/Game/JLE/LevelDefinitions"
    asset_path = f"{package_path}/{asset_name}"
    level_definition = unreal.EditorAssetLibrary.load_asset(asset_path)
    if level_definition is None:
        if not unreal.EditorAssetLibrary.does_directory_exist(package_path):
            unreal.EditorAssetLibrary.make_directory(package_path)
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", unreal.JetLevelDefinition)
        level_definition = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            asset_name, package_path, unreal.JetLevelDefinition, factory
        )
    if level_definition is None:
        raise RuntimeError(f"Could not create custom level definition: {asset_path}")
    set_editor_property_checked(level_definition, "level_id", level_id, "LevelId")
    set_editor_property_checked(level_definition, "experience_id", level_id, "ExperienceId")
    display_name = str(data.get("displayName", "Custom Level"))
    set_editor_property_checked(level_definition, "experience_name", display_name, "ExperienceName")
    set_editor_property_checked(level_definition, "is_playable", True, "bIsPlayable")
    if not unreal.EditorAssetLibrary.save_loaded_asset(level_definition, only_if_is_dirty=False):
        raise RuntimeError(f"Failed to save custom level definition: {asset_path}")
    data.setdefault("worldSettings", {})["levelDefinition"] = asset_path
    log(f"Custom leaderboard identity: {level_id} ({asset_path})")
    return level_definition


def safe_runtime_scale(data, object_id):
    """Keep marker scales inside the native loader's numerically safe range."""
    raw = (
        float((data or {}).get("x", 1)),
        float((data or {}).get("y", 1)),
        float((data or {}).get("z", 1)),
    )
    if not all(math.isfinite(value) for value in raw):
        raise RuntimeError(f"Object {object_id} has a non-finite scale: {raw}")

    minimum_magnitude = 0.01
    magnitudes = [max(abs(value), minimum_magnitude) for value in raw]
    largest = max(magnitudes)
    smallest_allowed = largest / 32.0
    corrected = [
        math.copysign(max(magnitude, smallest_allowed), value or 1.0)
        for value, magnitude in zip(raw, magnitudes)
    ]

    if any(abs(before - after) > 0.000001 for before, after in zip(raw, corrected)):
        warn(
            f"Corrected unsafe scale for {object_id}: "
            f"{raw} -> {tuple(round(value, 6) for value in corrected)}"
        )
    return unreal.Vector(*corrected)


def add_sky_environment_levels():
    log("Adding original Pillars sky/environment layers")

    world = unreal.EditorLevelLibrary.get_editor_world()
    if world is None:
        raise RuntimeError("Could not obtain the editor world for streaming levels")

    for level_path in REQUIRED_STREAMING_LEVELS:
        if not unreal.EditorAssetLibrary.does_asset_exist(level_path):
            raise RuntimeError(
                f"Missing editor-only streaming-level proxy: {level_path}\n\n"
                "Run Scripts/create_game_asset_proxies.py once before compiling."
            )

        streaming_level = unreal.EditorLevelUtils.add_level_to_world(
            world,
            level_path,
            unreal.LevelStreamingAlwaysLoaded,
        )
        if streaming_level is None:
            raise RuntimeError(f"Failed to add streaming level: {level_path}")

# ------------------------------------------------------------
# Support actors
# ------------------------------------------------------------

def spawn_directional_light():
    log("Spawning Directional Light")

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.DirectionalLight,
        DIRECTIONAL_LIGHT_LOCATION,
        DIRECTIONAL_LIGHT_ROTATION,
    )

    if actor is None:
        raise RuntimeError("Failed to spawn Directional Light")

    actor.set_actor_label("JLE_DirectionalLight")

    # Make it bright enough for simple test maps.
    try:
        light_component = actor.get_component_by_class(unreal.DirectionalLightComponent)
        if light_component:
            light_component.set_editor_property("intensity", 5.0)
    except Exception as e:
        warn(f"Could not set Directional Light intensity: {e}")

    return actor


def spawn_sky_light():
    log("Spawning Sky Light")

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.SkyLight,
        SKY_LIGHT_LOCATION,
        unreal.Rotator(0, 0, 0),
    )

    if actor is None:
        raise RuntimeError("Failed to spawn Sky Light")

    actor.set_actor_label("JLE_SkyLight")

    try:
        light_component = actor.get_component_by_class(unreal.SkyLightComponent)
        if light_component:
            light_component.set_editor_property("intensity", 1.0)
    except Exception as e:
        warn(f"Could not set Sky Light intensity: {e}")

    return actor


def spawn_player_start(data):
    log("Spawning ASBPlayerStart")

    player_start_data = data.get("playerStart", {})

    position = vec3(
        player_start_data.get("position", {}),
        PLAYER_START_LOCATION.x,
        PLAYER_START_LOCATION.y,
        PLAYER_START_LOCATION.z,
    )
    original_z = position.z
    position.z += PLAYER_START_SAFETY_LIFT_CM
    log(
        f"Applying PlayerStart collision clearance: Z {original_z:.1f} -> "
        f"{position.z:.1f} cm"
    )

    rotation = rotator(
        player_start_data.get("rotation", {}),
        PLAYER_START_ROTATION.pitch,
        PLAYER_START_ROTATION.yaw,
        PLAYER_START_ROTATION.roll,
    )

    player_start_class = load_native_class(SB_PLAYER_START_CLASS_PATH, "ASBPlayerStart")

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        player_start_class,
        position,
        rotation,
    )

    if actor is None:
        raise RuntimeError("Failed to spawn ASBPlayerStart")

    actor.set_actor_label("JLE_SBPlayerStart")

    game_mode_tag_name = str(
        player_start_data.get("gameModeGameplayTag", "TimeTrial") or ""
    ).strip()
    team_tag_name = str(player_start_data.get("teamGameplayTag", "") or "").strip()
    actor.set_jle_gameplay_tags(game_mode_tag_name, team_tag_name)
    actual_game_mode_tag = actor.get_editor_property("game_mode_gameplay_tag")
    if game_mode_tag_name and not str(actual_game_mode_tag):
        raise RuntimeError(
            f"ASBPlayerStart gameplay tag is not registered: {game_mode_tag_name}"
        )

    set_editor_property_checked(
        actor,
        "team_id",
        int(player_start_data.get("teamId", 0)),
        "TeamID",
    )
    return actor


def spawn_runtime_loader(runtime_loader_class):
    log("Spawning BP_JLE_RuntimeLoader")

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        runtime_loader_class,
        RUNTIME_LOADER_LOCATION,
        unreal.Rotator(0, 0, 0),
    )

    if actor is None:
        raise RuntimeError("Failed to spawn BP_JLE_RuntimeLoader")

    actor.set_actor_label("BP_JLE_RuntimeLoader")
    return actor


def spawn_time_trial_goal(data):
    log("Spawning BP_TimeTrialGoal_Sphere")

    goal_data = data.get("timeTrialGoal", {})
    goal_path = goal_data.get("assetPath", TIME_TRIAL_GOAL_BLUEPRINT_PATH)
    goal_class = load_blueprint_class(goal_path, "time-trial goal")

    position = vec3(
        goal_data.get("position", {}),
        TIME_TRIAL_GOAL_LOCATION.x,
        TIME_TRIAL_GOAL_LOCATION.y,
        TIME_TRIAL_GOAL_LOCATION.z,
    )
    rotation = rotator(goal_data.get("rotation", {}))
    scale = vec3(goal_data.get("scale", {}), 1, 1, 1)

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(goal_class, position, rotation)
    if actor is None:
        raise RuntimeError("Failed to spawn BP_TimeTrialGoal_Sphere")

    actor.set_actor_label("JLE_TimeTrialGoal")
    actor.set_actor_scale3d(scale)
    return actor


# ------------------------------------------------------------
# Marker spawning
# ------------------------------------------------------------

def spawn_marker_actor(marker_class, obj):
    object_id = obj.get("id", "JLE_SpawnMarker")
    asset_id = obj.get("assetId", "")

    position = vec3(obj.get("position", {}))
    rotation = rotator(obj.get("rotation", {}))
    scale = safe_runtime_scale(obj.get("scale", {}), object_id)

    log(f"Spawning marker: id={object_id}, assetId={asset_id}")

    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(
        marker_class,
        position,
        rotation,
    )

    if actor is None:
        raise RuntimeError(f"Failed to spawn marker actor for object: {object_id}")

    actor.set_actor_label(object_id)
    actor.set_actor_scale3d(scale)

    try:
        actor.set_editor_property("AssetId", asset_id)
    except Exception as property_error:
        raise RuntimeError(
            "Failed to set AssetId on BP_JLE_SpawnMarker.\n"
            "Make sure BP_JLE_SpawnMarker has a String variable named exactly:\n"
            "AssetId\n\n"
            f"Original error: {property_error}"
        )

    return actor


def spawn_editor_dummy(obj):
    asset_id = obj.get("assetId", "")
    if not asset_id:
        return None
    placeholder_id = obj.get("placeholderAssetId", DUMMY_PLACEHOLDER_ID)
    if placeholder_id != DUMMY_PLACEHOLDER_ID:
        raise RuntimeError(
            f"Unsupported placeholderAssetId '{placeholder_id}' for {asset_id}; "
            f"expected '{DUMMY_PLACEHOLDER_ID}'"
        )
    mesh_path = DUMMY_PLACEHOLDER_MESH

    object_id = obj.get("id", "JLE_SpawnMarker")
    position = vec3(obj.get("position", {}))
    rotation = rotator(obj.get("rotation", {}))
    scale = safe_runtime_scale(obj.get("scale", {}), object_id)
    mesh = unreal.load_asset(mesh_path)
    if mesh is None:
        raise RuntimeError(f"Could not load editor dummy mesh: {mesh_path}")

    dummy = unreal.EditorLevelLibrary.spawn_actor_from_class(
        unreal.StaticMeshActor,
        position,
        rotation,
    )
    if dummy is None:
        raise RuntimeError(f"Failed to spawn editor dummy for: {object_id}")

    dummy.set_actor_label(f"JLE_DUMMY_{object_id}_{asset_id}")
    dummy.set_actor_scale3d(scale)
    dummy.set_editor_property("is_editor_only_actor", True)

    mesh_component = dummy.static_mesh_component
    mesh_component.set_static_mesh(mesh)
    mesh_component.set_editor_property("hidden_in_game", True)
    mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
    return dummy


def validate_prerequisite_actors(player_start, runtime_loader, marker_actors, direct_actors):
    """Fail compilation before cooking if the persistent gameplay contract is incomplete."""
    if player_start is None or player_start.get_class().get_name() != "SBPlayerStart":
        raise RuntimeError("Generated map is missing its required ASBPlayerStart")
    if marker_actors and runtime_loader is None:
        raise RuntimeError("Generated map is missing BP_JLE_RuntimeLoader")
    direct_goals = [
        actor for actor in direct_actors
        if actor.get_class().get_name() == "TimeTrialGoal"
    ]
    marker_goals = [
        actor for actor in marker_actors
        if str(actor.get_editor_property("AssetId")) == "time_trial_goal"
    ]
    goal_count = len(direct_goals) + len(marker_goals)
    if goal_count != 1:
        raise RuntimeError(
            f"Generated map requires exactly one time-trial goal; found {goal_count}"
        )
    log(
        f"Verified prerequisite actors: ASBPlayerStart, runtime loader, "
        f"{len(marker_actors)} marker(s), exactly one time-trial goal"
    )


def spawn_direct_gameplay_actor(obj):
    object_id = obj.get("id", "JLE_GameplayActor")
    asset_id = obj.get("assetId", "")
    class_path = DIRECT_GAMEPLAY_ASSETS[asset_id]

    position = vec3(obj.get("position", {}))
    rotation = rotator(obj.get("rotation", {}))
    scale = safe_runtime_scale(obj.get("scale", {}), object_id)

    if class_path.startswith("/Script/"):
        actor_class = unreal.load_class(None, class_path)
    else:
        actor_class = load_blueprint_class(class_path, f"gameplay asset '{asset_id}'")
    if actor_class is None:
        raise RuntimeError(f"Could not load gameplay class '{class_path}' for {asset_id}")
    actor = unreal.EditorLevelLibrary.spawn_actor_from_class(actor_class, position, rotation)
    if actor is None:
        raise RuntimeError(f"Failed to spawn gameplay actor: {object_id} ({asset_id})")

    actor.set_actor_label(object_id)
    actor.set_actor_scale3d(scale)
    return actor


# ------------------------------------------------------------
# Main compiler
# ------------------------------------------------------------

def compile_level():
    data = load_level_json(JSON_PATH)

    level_name = data.get("levelName", "JLE_Untitled")
    raw_objects = data.get("objects", [])
    if not isinstance(raw_objects, list):
        raise RuntimeError("LevelData.json error: 'objects' must be a list.")
    # timeTrialGoal is the canonical goal representation. Older editor builds
    # could also leave goal objects in this array, which spawned two native
    # goals and could crash JETRUNNER's time-trial reset flow.
    objects = [
        obj for obj in raw_objects
        if not isinstance(obj, dict) or obj.get("assetId") != "time_trial_goal"
    ]

    requested_asset_ids = {
        obj.get("assetId") for obj in objects if isinstance(obj, dict)
    }
    unmapped_asset_ids = sorted(
        asset_id for asset_id in requested_asset_ids
        if asset_id and asset_id not in RUNTIME_SPAWN_TABLE
    )
    if unmapped_asset_ids:
        raise RuntimeError(
            "No genuine runtime class mapping for AssetId(s): "
            + ", ".join(unmapped_asset_ids)
        )

    goal_data = data.get("timeTrialGoal")
    if isinstance(goal_data, dict):
        objects.append({
            "id": "JLE_TimeTrialGoal",
            "assetId": "time_trial_goal",
            "position": goal_data.get("position", {}),
            "rotation": goal_data.get("rotation", {}),
            "scale": goal_data.get("scale", {}),
        })

    output_level_path = f"{OUTPUT_MAP_ROOT}/{level_name}"

    create_new_level(output_level_path)

    configure_world_settings(data)

    # Clean/generated map support actors.
    spawn_directional_light()
    spawn_sky_light()
    player_start = spawn_player_start(data)

    marker_objects = [
        obj for obj in objects
        if isinstance(obj, dict) and obj.get("assetId") not in DIRECT_GAMEPLAY_ASSETS
    ]

    runtime_loader_class = None
    marker_class = None
    runtime_loader = None
    marker_actors = []
    direct_actors = []
    if marker_objects:
        runtime_loader_class = configure_runtime_loader()
        marker_class = load_blueprint_class(
            MARKER_BLUEPRINT_PATH,
            "spawn marker Blueprint class",
        )
        runtime_loader = spawn_runtime_loader(runtime_loader_class)

    log(f"Compiling {len(objects)} object(s)...")

    for obj in objects:
        if not isinstance(obj, dict):
            warn(f"Skipping invalid object entry: {obj}")
            continue

        if "assetId" not in obj:
            warn(f"Skipping object without assetId: {obj}")
            continue

        if obj.get("assetId") in DIRECT_GAMEPLAY_ASSETS:
            direct_actors.append(spawn_direct_gameplay_actor(obj))
        else:
            marker_actors.append(spawn_marker_actor(marker_class, obj))
            spawn_editor_dummy(obj)

    validate_prerequisite_actors(player_start, runtime_loader, marker_actors, direct_actors)

    # Adding a streaming level makes it the current editing level, so populate
    # and save the persistent map first. Then attach the environment layers and
    # save every dirty map package, including the persistent map's new refs.
    save_current_level()
    add_sky_environment_levels()
    if not unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True):
        raise RuntimeError("Failed to save map packages after adding sky/environment layers")

    log("Compilation complete.")
    log(f"Saved generated map: {output_level_path}")


compile_level()
