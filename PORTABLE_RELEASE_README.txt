JETRUNNER LEVEL EDITOR 0.9.3 - PORTABLE WINDOWS BUILD
================================================

1. Keep this entire folder together. Do not move only the EXE.
2. Run "JLE.exe".
   The Runtime folder contains the application and packaging tools used by
   this launcher; keep that folder beside the EXE.
3. Create a level containing one Player Start, one Finish Goal, and at least
   one surface.
4. Click Export + Install.

The editor searches all Steam library folders for JETRUNNER. If it cannot find
the game, select:

  JETRUNNER\JETRUNNER\Content\Paks

The editor then creates the level pak and installs both it and the required
CustomLevels framework into:

  JETRUNNER\JETRUNNER\Content\Paks\JLE

Level JSON and pipeline logs are saved under:

  Documents\JETRUNNER Level Editor

Editable project saves are automatically created and overwritten in the
Saved Levels folder beside the application launcher:

  JETRUNNER-Level-Editor\Saved Levels

Use the Save and Load buttons in the top toolbar to save immediately or reopen
an earlier project. Placing, moving, rotating, resizing, deleting, pasting, or
editing an object also autosaves the current project.

Save filenames use the readable level name. If that filename is already used
by another project, the editor creates Name_1, Name_2, and so on. Continued
edits overwrite the same chosen file.

Requirements
------------
- 64-bit Windows
- Steam copy of JETRUNNER
- Write access to the JETRUNNER Content\Paks folder

Uninstalling custom levels
--------------------------
Close JETRUNNER, then remove the desired JLE-<level-name>_P.pak from:

  JETRUNNER\JETRUNNER\Content\Paks\JLE

The editor is self-contained. Unreal Engine, Node.js, npm, UAssetGUI, and repak
do not need to be installed separately. The packaged editor supplies the
JavaScript runtime used by its own conversion pipeline.
