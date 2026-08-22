# New Game Editor Quickstart

1. Create `LevelEditorApp/src/games/<game>/adapter.ts` implementing `GameAdapter`. Declare branding/theme, units, coordinates, grid/snapping, preview defaults, categories, assets, capabilities, serialization, and export behavior.
2. Keep curated exceptions in an adapter-owned JSON file. Never edit generated reports.
3. Scan read-only source dumps:

   ```powershell
   node Scripts/Scan-GameData.mjs --game my-game --fmodel "D:\Exports\MyGame" --headers "D:\Dumps\Headers" --curated "LevelEditorApp\src\games\my-game\curated-overrides.json"
   ```

4. Review `generated/game-data/my-game/asset-candidates.json` and `extraction-queue.json`. Only approve placeable assets supported by authoritative/high-confidence evidence.
5. Export requested Blueprints, meshes, material instances, textures, parents, maps, or Construction Script evidence from the queue and rerun the same command. Unchanged files are served from the scan cache.
6. Review overlays, materials, dimensions, collision, and dummy candidates. Curate only genuine exceptions such as pivot corrections, editor-only materials, fallback colours, or known proxies.
7. Define the game-specific exporter/install/verification contracts. The framework does not assume Unreal, `.pak`, centimetres, Z-up, or any particular runtime ID.
8. Create a Vite entry like `example-game.html`, apply the adapter theme, and register its assets.
9. Run:

   ```powershell
   npm --prefix LevelEditorApp run test:game-data
   npm --prefix LevelEditorApp run test:framework
   npm --prefix LevelEditorApp run build
   ```

10. Manually test palette placement, transforms/snapping, inspector properties, save/load, preview, export, and any adapter-specific install or verification flow before publishing.
