import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cwd = process.cwd();
const workspace = fs.existsSync(path.join(cwd, 'LevelEditorApp')) ? cwd : path.dirname(cwd);
const layout = JSON.parse(fs.readFileSync(path.join(workspace, 'LevelEditorApp', 'src', 'catalog-layout.json'), 'utf8'));
const { verificationObjectAssetIds } = require(path.join(
  workspace, 'LevelEditorApp', 'electron', 'verification-assets.cjs',
));
const verifierAssetIds = new Set(verificationObjectAssetIds);
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'jle-asset-support-'));
const transformFor = (index) => ({
  position: { x: (index % 20) * 1000, y: Math.floor(index / 20) * 1000, z: 0 },
  rotation: { pitch: 0, yaw: 0, roll: 0 },
  scale: { x: 1, y: 1, z: 1 },
});
const objects = layout
  // Exercise the compiler only with IDs the actual JLE_ObjectPlacer verifier
  // accepts. Catalogue presence alone is intentionally not sufficient.
  .filter((entry) => verifierAssetIds.has(entry.assetId))
  .map((entry, index) => ({
    id: `audit_${entry.assetId}`,
    placeholderAssetId: 'jle_dummy',
    assetId: entry.assetId,
    runtimeObjectName: entry.objectName,
    entityData: {},
    ...transformFor(index),
  }));
const levelData = {
  frameworkVersion: 'jle-uasset-v1',
  levelId: 'JLE_ASSET_SUPPORT_AUDIT',
  levelName: 'AssetSupportAudit',
  displayName: 'Asset Support Audit',
  worldSettings: {
    defaultRuleset: '/Flashback/Rulesets/TimeTrial/Ruleset_TimeTrial.Ruleset_TimeTrial',
    levelDefinition: '/Game/Mods/CustomLevels/LevelDef_MyFirstLevel.LevelDef_MyFirstLevel',
    leaderboardId: 'JLE_ASSET_SUPPORT_AUDIT',
    isMenuWorld: false,
    energyAtStart: 0,
    worldStartingPolarity: 0,
    isFlashbackWorld: false,
    environment: 'Environment_CentralPark',
    skybox: 'Scenario_DayAboveTheClouds',
    timeOfDay: 'Scenario_DayAboveTheClouds',
  },
  playerStart: { ...transformFor(-1), teamId: 0, gameModeGameplayTag: 'TimeTrial', teamGameplayTag: '' },
  timeTrialGoal: {
    assetPath: '/Flashback/Rulesets/Common/BP_TimeTrialGoal_Sphere.BP_TimeTrialGoal_Sphere',
    ...transformFor(-2),
  },
  objects,
};
const levelPath = path.join(tempRoot, 'asset-support-audit-level.json');
fs.writeFileSync(levelPath, `${JSON.stringify(levelData, null, 2)}\n`);

try {
  execFileSync(process.execPath, [
    path.join(workspace, 'UAssetPipeline', 'Scripts', 'Generate-JLEProject.cjs'),
    '--level-data', levelPath,
    '--map-template', path.join(workspace, 'UAssetPipeline', 'Templates', 'Map_JLE_MAPNAME.json'),
    '--leveldef-template', path.join(workspace, 'UAssetPipeline', 'Templates', 'LevelDef_JLE_MAPNAME.json'),
    '--example-map', path.join(workspace, 'UAssetPipeline', 'Templates', 'Example_AllObjects.json'),
    '--output', path.join(tempRoot, 'project'),
  ], { stdio: 'inherit' });
  const mapJson = path.join(tempRoot, 'project', 'JETRUNNER', 'Content', 'Mods', 'CustomLevels', 'Map_JLE_AssetSupportAudit.json');
  if (!fs.existsSync(mapJson)) throw new Error('The generator did not create the audit map JSON.');
  const projectContent = path.dirname(mapJson);
  const resourceDirectory = path.join(
    workspace,
    'UAssetPipeline',
    'Resources',
    'JETRUNNER',
    'Content',
    'Mods',
    'CustomLevels',
  );
  for (const file of ['JLE_ObjectPlacer.uasset', 'JLE_ObjectPlacer.uexp', 'PlacedObject.uasset', 'PlacedObject.uexp']) {
    fs.copyFileSync(path.join(resourceDirectory, file), path.join(projectContent, file));
  }
  const mapOutput = path.join(tempRoot, 'Map_JLE_AssetSupportAudit.umap');
  execFileSync(path.join(workspace, 'UAssetPipeline', 'Tools', 'UAssetGUI', 'UAssetGUI.exe'), [
    'fromjson', mapJson, mapOutput, 'JETRUNNER',
  ], { stdio: 'inherit' });
  if (!fs.existsSync(mapOutput)) throw new Error('UAssetGUI did not create the audit map asset.');
  console.log(`Serialized and converted ${objects.length} verifier-supported placeable assets using the canonical PlacedObject schema.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
