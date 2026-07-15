import json
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
RULESET_BLUEPRINT_PATH = "/Flashback/Content/Rulesets/TimeTrial/Ruleset_TimeTrial.Ruleset_TimeTrial"

# Native classes supplied by the local compatibility shim while authoring and by
# JETRUNNER itself when the cooked replacement map runs in the game.
SB_PLAYER_START_CLASS_PATH = "/Script/JETRUNNER.SBPlayerStart"


# Default support actor locations.
RUNTIME_LOADER_LOCATION = unreal.Vector(0, 0, 500)
PLAYER_START_LOCATION = unreal.Vector(-600, 0, 200)
PLAYER_START_ROTATION = unreal.Rotator(0, 0, 0)

DIRECTIONAL_LIGHT_LOCATION = unreal.Vector(0, 0, 1500)
DIRECTIONAL_LIGHT_ROTATION = unreal.Rotator(-45, 0, 0)

SKY_LIGHT_LOCATION = unreal.Vector(0, 0, 1000)


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

    return unreal.Rotator(
        float(data.get("pitch", default_pitch)),
        float(data.get("yaw", default_yaw)),
        float(data.get("roll", default_roll)),
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
        level_editor_subsystem.new_level(level_path)
    except Exception as subsystem_error:
        warn("LevelEditorSubsystem.new_level failed. Falling back to EditorLevelLibrary.new_level.")
        warn(str(subsystem_error))
        unreal.EditorLevelLibrary.new_level(level_path)


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

    set_editor_property_checked(world_settings, "default_ruleset", ruleset_class, "DefaultRuleset")
    set_editor_property_checked(
        world_settings,
        "is_menu_world",
        bool(settings_data.get("isMenuWorld", False)),
        "bIsMenuWorld",
    )
    set_editor_property_checked(
        world_settings,
        "energy_at_start",
        float(settings_data.get("energyAtStart", 100.0)),
        "EnergyAtStart",
    )
    set_editor_property_checked(
        world_settings,
        "world_starting_polarity",
        int(settings_data.get("worldStartingPolarity", 0)),
        "WorldStartingPolarity",
    )
    set_editor_property_checked(
        world_settings,
        "is_flashback_world",
        bool(settings_data.get("isFlashbackWorld", True)),
        "bIsFlashbackWorld",
    )

    return world_settings


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


# ------------------------------------------------------------
# Marker spawning
# ------------------------------------------------------------

def spawn_marker_actor(marker_class, obj):
    object_id = obj.get("id", "JLE_SpawnMarker")
    asset_id = obj.get("assetId", "")

    position = vec3(obj.get("position", {}))
    rotation = rotator(obj.get("rotation", {}))
    scale = vec3(obj.get("scale", {}), 1, 1, 1)

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


# ------------------------------------------------------------
# Main compiler
# ------------------------------------------------------------

def compile_level():
    data = load_level_json(JSON_PATH)

    level_name = data.get("levelName", "JLE_Untitled")
    objects = data.get("objects", [])

    if not isinstance(objects, list):
        raise RuntimeError("LevelData.json error: 'objects' must be a list.")

    output_level_path = f"{OUTPUT_MAP_ROOT}/{level_name}"

    create_new_level(output_level_path)

    configure_world_settings(data)

    # Clean/generated map support actors.
    spawn_directional_light()
    spawn_sky_light()
    spawn_player_start(data)

    runtime_loader_class = load_blueprint_class(
        RUNTIME_LOADER_BLUEPRINT_PATH,
        "runtime loader Blueprint class",
    )

    marker_class = load_blueprint_class(
        MARKER_BLUEPRINT_PATH,
        "spawn marker Blueprint class",
    )

    spawn_runtime_loader(runtime_loader_class)

    log(f"Compiling {len(objects)} object(s)...")

    for obj in objects:
        if not isinstance(obj, dict):
            warn(f"Skipping invalid object entry: {obj}")
            continue

        if "assetId" not in obj:
            warn(f"Skipping object without assetId: {obj}")
            continue

        spawn_marker_actor(marker_class, obj)

    save_current_level()

    log("Compilation complete.")
    log(f"Saved generated map: {output_level_path}")


compile_level()
