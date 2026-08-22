# 1.1.1 Patch Info

## Level authoring

- Levels now save as a single shareable `.jle` project file.
- Added compatibility for loading `.jle` projects and supported legacy JSON-style levels.
- Corrected World Starting Polarity so the editor setting matches the in-game state.
- Improved object sizing, visual scaling, pivots, collision/selection bounds, and centred transform options.
- Improved grid snapping and one-sided resize behaviour.
- Added Unreal-style Alt+Drag duplication.
- Fixed deleted objects remaining invisibly in the editor and several cases where edited entities could disappear.

## Verification & game integration

- Improved verification and packaging reliability, with clearer recovery guidance for locked-file and access errors.
- Added Steam and Epic Games installation support.
- Bronze verification times are no longer required.
- Medal targets now consistently display three decimal places.
- Improved runtime mappings, level naming, asset handling, and preview collision.

## Editor controls & presentation

- Added optional camera-relative WASD movement.
- Added a safe camera pitch limit to prevent straight-down rotation instability.
- Moved the menu shortcut away from Alt so Alt+Drag works cleanly.
- Restored the Juan application icon and renamed the installed executable to `JLE.exe`.
- Added clearer pipeline-console error explanations and log-location guidance.

## Updates & reliability

- Added in-app update checking, update recovery options, and update-available prompts on the home screen.
- Patch notes now appear automatically once after a successful update.
- Fixed the update prompt repeating after a successful restart.
- Added the top update notice, dismissible bottom-right Update and What’s New controls, and formatted patch notes.
- Added safe rollback/recovery handling for interrupted payload updates.
- Improved release publishing to resume uploads, upload in paced batches, and retry temporary GitHub rate-limit errors.

If you encounter an issue, please message Dave (Me) with screenshots and relevant logs found at: `Documents\JETRUNNER Level Editor\Logs`.
