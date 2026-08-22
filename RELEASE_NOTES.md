# JLE 1.1.0 — Major Quality & Reliability Update

This release brings together the improvements made since the original 1.0.0 release.

## Level authoring

- Levels now save as a single shareable `.jle` project file. The JSON needed by the game build process is temporary and cleaned up automatically.
- Added compatibility for loading both `.jle` projects and supported legacy JSON-style levels.
- Corrected world starting polarity so the editor setting matches the in-game state.
- Improved default object sizing, visual scaling, pivots, collision/selection bounds, and centred move/rotate/resize gizmos.
- Repaired grid snapping and one-sided resize behaviour, including placement at the centre of grid squares.
- Added Unreal-style **Alt+Drag** duplication, keeping the copied object at the source height.
- Fixed deleted objects remaining invisibly in the editor and several cases where edited entities could disappear.

## Verification & game integration

- Improved the level verification and packaging pipeline, including clearer recovery guidance for common locked-file and access errors.
- Added Steam and Epic Games installation support.
- Improved medal handling: bronze is no longer required, and medal targets consistently show three decimal places.
- Improved runtime mappings, level identity naming, asset handling, and collision/preview support for supported JETRUNNER content.

## Editor controls & presentation

- Added advanced camera-relative WASD movement as an optional setting.
- Limited camera pitch safely to prevent straight-down rotation instability.
- Moved the menu shortcut away from Alt so Alt+Drag works without opening the application menu.
- Restored the Juan application icon and renamed the installed executable to `JLE.exe`.
- Added more helpful pipeline-console explanations and log locations when recoverable errors occur.

## Updates & reliability

- Added the in-app updater, update recovery controls, and a clear update-available prompt.
- Update notes now appear automatically once after a successful update, with a close button.
- Added safe rollback/recovery handling for interrupted payload updates.
- Improved release publishing so large modular payloads resume, upload in paced batches, and retry temporary GitHub rate-limit errors instead of failing partway through.
- Added a configurable, game-adapter framework and data-ingestion tooling to support future editor/game integrations without changing JETRUNNER’s existing workflow.

If you encounter an issue, please message the JLE team with screenshots and the relevant logs from `Documents\JETRUNNER Level Editor\Logs`.
