import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = readFileSync(resolve(root, 'LevelEditorApp/src/main.ts'), 'utf8');
const required = [
  'static_basekit_floor_01',
  'static_basekit_floorcylinder_01',
  'static_basekit_floorquartercylinder_01',
  'static_ice_platform01',
  'static_artic_platform',
  'static_artic_platform_2x2',
  'static_snow_01',
  'static_woodenoctagonplatform',
  'static_woodensquareplatform',
  'static_2x2_rio_platform_flat_01',
  'static_2x2_rio_platform_top_brick_01',
  'static_2x3_rio_platform_top_brick_01',
  'static_stage_1x1',
  'static_stage_2x2',
  'static_stage_2x3',
  'static_stage_floor01',
  'static_specialplatform2x7_1',
];

for (const assetId of required) {
  const pattern = new RegExp(`${assetId}: \\{ shape: '[^']+', size: \\[\\d+, \\d+, \\d+\\]`);
  if (!pattern.test(source)) throw new Error(`Missing centralized Preview collision proxy for ${assetId}.`);
}
for (const marker of [
  "shape === 'circle'",
  "shape === 'quarter-circle'",
  "shape === 'octagon'",
  'previewProxyGroundAt',
  '!previewPlatformCollision[mesh.userData.assetId as AssetId]',
]) {
  if (!source.includes(marker)) throw new Error(`Missing Preview collision behavior: ${marker}`);
}
if (!source.includes("'digital_platform_red'")) throw new Error('Digital Platform Red legacy ID was not retained.');
const removals = source.match(/const editorAssetRemovals: AssetId\[\] = \[([^\]]*)\]/)?.[1] || '';
if (!removals.includes("'digital_platform_red'")) {
  throw new Error('Digital Platform Red remains exposed in the placement palette.');
}

console.log(`Preview collision validation passed for ${required.length} mandatory platforms.`);
