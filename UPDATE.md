# JLE 1.1.2

## Update reliability

- Fixed an issue where JLE could continue showing an update prompt after that version had already been installed.
- Improved update version matching so stale updater information cannot re-offer the current version.
- Opening or creating a level now waits for an update check already in progress. If an update is available, its update window is shown before entering the editor.

## Update presentation

- Fixed update notes supplied by the installer updater rendering as raw HTML text.
- Update notes now display normal headings and bullet points.

If you encounter an issue, please message Dave (Me) with screenshots and relevant logs found at: `Documents\JETRUNNER Level Editor\Logs`.
