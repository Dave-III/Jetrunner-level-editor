import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const workspace = process.cwd();
const app = path.join(workspace, 'LevelEditorApp');
const layout = JSON.parse(await fs.readFile(path.join(app, 'src', 'catalog-layout.json'), 'utf8'));
const source = await fs.readFile(path.join(app, 'src', 'main.ts'), 'utf8');

// Include the few original HTML palette buttons as well as the JSON-driven
// catalogue. This makes the diagnostic project exercise the exact assets a
// user can click, including Ice Platform.
const staticPaletteIds = [...source.matchAll(/data-asset-id="([a-z][a-z0-9_]+)"/g)]
  .map((match) => match[1]);
const assetIds = [...new Set([...layout.map((entry) => entry.assetId), ...staticPaletteIds])];
const assetsToPreview = assetIds.filter((assetId) => (
  assetId !== 'player_start' && assetId !== 'time_trial_goal'
));

const spacing = 10_000; // Unreal centimetres = 100 metres.
const columns = 20;
const positionFor = (index) => ({
  x: (index % columns) * spacing,
  y: -Math.floor(index / columns) * spacing,
  z: 0,
});
const transformFor = (index) => ({
  position: positionFor(index),
  rotation: { pitch: 0, yaw: 0, roll: 0 },
  scale: { x: 1, y: 1, z: 1 },
});

const project = {
  projectFormat: 'jle-editor-project-v1',
  savedAt: new Date().toISOString(),
  levelId: 'jle_asset_catalogue_preview',
  displayName: 'Asset Catalogue Preview',
  environment: 'Environment_CentralPark',
  timeOfDay: 'Scenario_YankeyDoodleMorning',
  worldStartingPolarity: 0,
  assets: [
    {
      assetId: 'player_start',
      id: crypto.randomUUID(),
      entityData: {},
      transform: {
        position: { x: -spacing, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
    {
      assetId: 'time_trial_goal',
      id: crypto.randomUUID(),
      entityData: {},
      transform: {
        position: { x: -spacing, y: -spacing, z: 0 },
        rotation: { pitch: 0, yaw: 0, roll: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    },
    ...assetsToPreview.map((assetId, index) => ({
      assetId,
      id: crypto.randomUUID(),
      entityData: {},
      transform: transformFor(index),
    })),
  ],
  camera: {
    position: { x: 100000, y: -180000, z: 115000 },
    target: { x: 95000, y: -75000, z: 0 },
  },
};

const output = path.join(workspace, 'Saved Levels', 'Asset Catalogue Preview.jle.json');
try {
  await fs.access(output);
  throw new Error(`Refusing to overwrite existing diagnostic project: ${output}`);
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') throw error;
}
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(project, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ output, assetCount: project.assets.length, spacingMetres: spacing / 100 }, null, 2));
