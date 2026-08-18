import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const main = read('LevelEditorApp/electron/main.cjs');
const packageJson = read('LevelEditorApp/package.json');
const renderer = read('LevelEditorApp/src/main.ts');
const pipeline = read('UAssetPipeline/Build-JLELevel.ps1');
const generator = read('UAssetPipeline/Scripts/Generate-JLEProject.cjs');

const requirePattern = (source, pattern, message) => {
  if (!pattern.test(source)) throw new Error(message);
};

requirePattern(main, /await ensureJETRUNNERIsClosed\(gamePaks, status, consoleLine\);[\s\S]*runCommand\(powerShell,/,
  'Shared export pipeline must close JETRUNNER before running the build.');
if (main.includes('inspectCustomLevelsConflicts') || main.includes('CustomLevelsV1.0.pak')) {
  throw new Error('The editor must not automatically inspect or install CustomLevels framework paks.');
}
if (packageJson.includes('Framework/CustomLevelsV1.0.pak')) {
  throw new Error('The manual CustomLevels framework pak must not be bundled with the editor.');
}
requirePattern(main, /assertReadableFile\(payload\.Pak[\s\S]*assertReadableFile\(payload\.InstalledPak/,
  'Generated and installed paks must both be independently checked.');
requirePattern(main, /waitForJETRUNNERStart[\s\S]*findRunningJETRUNNERProcesses/,
  'Verification launch must confirm that the intended game process started.');
requirePattern(main, /removeVerificationArtifacts[\s\S]*verificationInstalledPak[\s\S]*outputPak[\s\S]*filePath/,
  'Verification cleanup must cover installed, output, and exported temporary files.');
requirePattern(renderer, /id="check-verification"[^>]*>Finish verification</,
  'The player-controlled verification finish action must remain available.');
requirePattern(renderer, /finishVerification[\s\S]*readVerification[\s\S]*createVerificationRecord\(result\.time/,
  'Finishing verification must read and apply the recorded best time.');
requirePattern(renderer, /!currentVerification\(\) && !checkVerificationButton\.disabled[\s\S]*finishVerification\(\)/,
  'Export must finalize an active verification session before packaging.');
if (renderer.includes('class="controls-card"')) {
  throw new Error('Obsolete sidebar controls explanation must remain removed.');
}
requirePattern(main, /'-WorkspaceRoot', pipelineWorkspaceDirectory\(\)/,
  'Packaged builds must place generated pipeline files in the writable per-user workspace.');
requirePattern(pipeline, /\$outputDirectory = Join-Path \$workspaceRootPath 'Output'/,
  'Generated paks must use the configured writable workspace Output directory.');
requirePattern(pipeline, /\$projectsRoot = Join-Path \$workspaceRootPath 'Projects'/,
  'Generated UAsset projects must use the configured writable workspace.');
requirePattern(pipeline, /"Converting \$mapName\.json\.\.\." \$projectContent/,
  'UAssetGUI map conversion must run from the writable generated project workspace.');
requirePattern(pipeline, /"Converting \$levelDefName\.json\.\.\." \$projectContent/,
  'UAssetGUI LevelDef conversion must run from the writable generated project workspace.');
requirePattern(main, /'JetrunnerGame\.exe'/,
  'Process handling must include the executable name used by the current Steam build.');
requirePattern(pipeline, /Get-FileHash \$outputPak[\s\S]*Get-FileHash \$installedPak/,
  'Installed pak content must remain hash-verified.');
requirePattern(generator, /replace\(\/_\/g, ''\)/,
  'Generated Unreal package identities must remove authored underscores rejected by UAssetGUI.');
requirePattern(generator, /const permanentLevelCode = \(levelId\) =>/,
  'Generated LevelDefs must derive a stable player-facing level code.');
requirePattern(generator, /property\(levelDefExport\.Data, 'ExperienceId'\)\.Value = generatedExperienceId/,
  'ExperienceId must use the short permanent level code rather than the leaderboard identity.');
requirePattern(pipeline, /\$identity = \$identity -replace '_', ''/,
  'PowerShell pipeline identity must match the generator underscore normalization.');

console.log('Packaging and verification reliability validation passed.');
