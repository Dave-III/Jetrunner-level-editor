# Reusable Level Editor Framework

`LevelEditorApp/src/framework` is the game-neutral contract layer. It defines transforms, entities, asset/property schemas, project serialization, adapter capabilities, and adapter registration. It must never import JETRUNNER modules; `npm run test:framework` enforces that boundary.

Each game lives under `src/games/<game-id>` and supplies a `GameAdapter` with:

- a stable game ID and project schema;
- asset definitions and default transforms;
- supported features (`preview`, `verification`, `runtimePackaging`, `environments`);
- strict project validation and serialization;
- a runtime export implementation.

JETRUNNER is represented by `src/games/jetrunner/adapter.ts`. Its mature editor remains the production `index.html` entry while game-specific catalogues, Unreal serialization, validation, medals, environments, polarity, UAsset packaging, and verification stay in the JETRUNNER layer. They are intentionally excluded from the generic framework.

## Adding a game

1. Create `src/games/my-game/adapter.ts` using `createJsonAdapter`, or implement `GameAdapter` directly.
2. Define primitive/custom assets, properties, transforms, validation, and export behavior without importing another game's files.
3. Build a Vite entry point like `example-game.html` and compose the generic services with the adapter.
4. Run `npm run build` and `npm run test:framework`.

## ExampleGame proof

`example-game.html` is a runnable, independently branded sample editor using only the framework contract and `src/games/example-game`. It includes Cube, Platform, Ramp, and Cylinder palette items; centred move/rotate/resize controls; snapping; selection/deletion; project creation; JSON save/load; runtime JSON export; and a working 3D preview viewport. It deliberately has no JETRUNNER imports, Unreal pipeline, medals, polarity, verification, or JETRUNNER assets. Open the generated `dist/example-game.html` or use the Vite development server to test it.

## Current extraction boundary

The contract, registry, second-game adapter, project schema, and independent sample are reusable today. JLE's legacy production renderer remains a large JETRUNNER composition root; migrating its scene/history/selection/inspector modules behind the same contract can now happen incrementally without destabilising the shipped editor. That remaining composition-root coupling is documented rather than hidden.

## Theme and game configuration

Every adapter owns a `GameConfiguration`: branding, an `EditorTheme`, catalogue categories, snapping/grid defaults, units, coordinate conventions, preview defaults, capabilities, and optional gameplay metadata. `applyEditorTheme` converts the theme into centralized `--editor-*` CSS variables. Generic UI consumes these tokens and does not assume an engine, package format, unit scale, up axis, medals, or runtime identifier scheme. JETRUNNER declares those facts in its adapter; ExampleGame declares metres, right-handed Y-up coordinates, and its independent Aurora theme.

## Game-data ingestion

`Scripts/Scan-GameData.mjs` recursively reads an FModel export directory and/or header/UHT directory without modifying either source. It indexes JSON exports, models, textures, Blueprint/component relationships, classes, inheritance, interfaces, properties, functions, structs, enums, references, bounds, transforms, collision, materials, and textures. Malformed and unrelated files are recorded and skipped. Header evidence is structural only and is never presented as a runtime value.

The scanner merges evidence into a keyed asset graph with provenance and one of these confidence values: `AUTHORITATIVE`, `HIGH_CONFIDENCE`, `CONSTRUCTION_SCRIPT_DEPENDENT`, `INFERRED`, `MISSING_SOURCE`, or `MANUAL_OVERRIDE`. Curated overrides take precedence but remain separate from generated reports. Inferred data alone never creates an approved dummy mapping.

Generated output is isolated under `generated/game-data/<game>`:

- `game-data-index.json` and `header-index.json`
- `asset-graph.json` and `asset-candidates.json`
- `runtime-sizing.json` and `collision-index.json`
- `material-texture-index.json`
- `editor-overlay-candidates.json`
- `dummy-candidates.json`
- `extraction-queue.json`

Overlay records preserve per-component hierarchy/transforms. Material records follow discovered slot/material/texture evidence and support controlled fallback colours. Sizing keeps visual, collision, selection, and snapping bounds separate. Collision output favours box/sphere/capsule or safe proxy metadata rather than raw triangle collision.

The extraction queue explains the missing export, reason, expected data, references, and priority. A metadata cache reuses unchanged parsed files on rescans, while newly exported files update the graph and can remove queue entries automatically.

## Dummy and verification capability

Dummy candidates are emitted only when a curated game mapping identifies a verified placeable runtime object and dummy family. The adapter still owns final approval, required properties/transforms, exporter, build/install flow, and verification contract. JETRUNNER's current `verification-assets.cjs`, runtime mappings, and UAsset pipeline remain authoritative while generated evidence is compared in `jetrunner-curated-comparison.json`.

## Onboarding another game

Create the adapter and theme, scan available dumps, review candidates and the extraction queue, export missing evidence, rescan, curate approved assets/collision/material fallbacks, implement exporter/install capabilities, then build a dedicated Vite entry. See `NEW_GAME_EDITOR_QUICKSTART.md` for commands and the full checklist.
