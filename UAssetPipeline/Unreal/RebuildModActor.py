import unreal


SOURCE_LOADER = "/Game/JLE/BP_JLE_RuntimeLoader"
TARGET_FOLDER = "/Game/Mods/CustomLevels"
TARGET_MOD_ACTOR = f"{TARGET_FOLDER}/ModActor"


def require_asset(path: str):
    asset = unreal.EditorAssetLibrary.load_asset(path)
    if asset is None:
        raise RuntimeError(f"Required source asset could not be loaded: {path}")
    return asset


def compile_and_save(blueprint):
    unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
    if not unreal.EditorAssetLibrary.save_loaded_asset(blueprint, only_if_is_dirty=False):
        raise RuntimeError(f"Blueprint could not be saved: {blueprint.get_path_name()}")


def main():
    unreal.EditorAssetLibrary.make_directory(TARGET_FOLDER)
    require_asset(SOURCE_LOADER)

    if unreal.EditorAssetLibrary.does_asset_exist(TARGET_MOD_ACTOR):
        existing = require_asset(TARGET_MOD_ACTOR)
        compile_and_save(existing)
        unreal.log(f"JLE_REBUILD: existing editable ModActor verified at {TARGET_MOD_ACTOR}")
        return

    duplicated = unreal.EditorAssetLibrary.duplicate_asset(
        SOURCE_LOADER,
        TARGET_MOD_ACTOR,
    )
    if duplicated is None:
        raise RuntimeError(
            f"Could not duplicate {SOURCE_LOADER} to {TARGET_MOD_ACTOR}"
        )

    compile_and_save(duplicated)
    unreal.log(f"JLE_REBUILD: created editable ModActor at {TARGET_MOD_ACTOR}")


if __name__ == "__main__":
    main()
