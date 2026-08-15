import unreal

MAP_PATH = "/Flashback/Maps/Campaign/NewYork/Map_Pillars"


def out(message):
    unreal.log_warning(f"[JLE AUDIT] {message}")


level_subsystem = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if not level_subsystem.load_level(MAP_PATH):
    raise RuntimeError(f"Could not load {MAP_PATH}")

world = unreal.EditorLevelLibrary.get_editor_world()
settings = world.get_world_settings()
out(f"WorldSettings class={settings.get_class().get_name()}")

for name in (
    "default_ruleset",
    "level_definition",
    "is_menu_world",
    "energy_at_start",
    "world_starting_polarity",
    "is_flashback_world",
):
    try:
        out(f"WorldSettings.{name}={settings.get_editor_property(name)}")
    except Exception as exc:
        out(f"WorldSettings.{name}=ERROR {exc}")

actors = unreal.EditorLevelLibrary.get_all_level_actors()
out(f"Persistent actor count={len(actors)}")
for actor in actors:
    out(
        f"Actor label={actor.get_actor_label()} "
        f"class={actor.get_class().get_name()}"
    )

ruleset_class = settings.get_editor_property("default_ruleset")
if ruleset_class:
    ruleset = unreal.get_default_object(ruleset_class)
    out(f"Ruleset class={ruleset_class.get_name()}")
    for name in (
        "dev_name",
        "game_mode_gameplay_tag",
        "pawn_data",
        "action_sets",
        "actions",
    ):
        try:
            value = ruleset.get_editor_property(name)
            out(f"Ruleset.{name}={value}")
        except Exception as exc:
            out(f"Ruleset.{name}=ERROR {exc}")

level_def = settings.get_editor_property("level_definition")
if level_def:
    out(f"LevelDefinition class={level_def.get_class().get_name()}")
    for name in ("level_id", "map_asset_ptr", "map_asset", "medal_map", "story_asset"):
        try:
            out(f"LevelDefinition.{name}={level_def.get_editor_property(name)}")
        except Exception as exc:
            out(f"LevelDefinition.{name}=ERROR {exc}")

out("Audit complete")
