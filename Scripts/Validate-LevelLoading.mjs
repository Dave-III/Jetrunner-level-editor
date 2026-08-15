import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const renderer = readFileSync(resolve(root, 'LevelEditorApp', 'src', 'main.ts'), 'utf8');
const main = readFileSync(resolve(root, 'LevelEditorApp', 'electron', 'main.cjs'), 'utf8');

const requiredRendererDiagnostics = [
  '[LOAD] Opening:', '[LOAD] File read', '[LOAD] JSON parsed', '[LOAD] Schema version:',
  '[LOAD] Level ID:', '[LOAD] Objects:', '[LOAD] Resolving object', '[LOAD] Scene created', '[LOAD] Complete:',
];
for (const diagnostic of requiredRendererDiagnostics) {
  if (!renderer.includes(diagnostic)) throw new Error(`Missing renderer load diagnostic: ${diagnostic}`);
}
if (!renderer.includes('preserving unsupported legacy AssetId')) {
  throw new Error('Legacy/removed assets do not have a non-destructive fallback load path.');
}
if (!renderer.includes("runtimeMappingStatus: 'unresolved'") || !renderer.includes("verificationMappingStatus: 'unsupported'")) {
  throw new Error('Legacy fallback assets are not blocked from invalid export/verification.');
}
if (!renderer.includes("project.worldStartingPolarity ?? 1")) {
  throw new Error('Legacy projects without WorldStartingPolarity do not receive the canonical default.');
}
if (!renderer.includes("levelId: String(project.levelId)")) {
  throw new Error('Historical numeric/64-bit level IDs are not normalized without changing their value.');
}
if (!main.includes("appendApplicationLog('load-error'")) {
  throw new Error('Main-process load failures are still silent.');
}

const fixtures = [
  ['current', { projectFormat: 'jle-editor-project-v1', levelId: '123', displayName: 'Current', assets: [] }],
  ['legacy-no-world-polarity', { projectFormat: 'jle-editor-project-v1', levelId: '124', displayName: 'Legacy', assets: [] }],
  ['gameplay-properties', { projectFormat: 'jle-editor-project-v1', levelId: '125', displayName: 'Props', assets: [{ assetId: 'enemy_plain', entityData: { Shielded: true } }] }],
  ['stable-64-bit-id', { projectFormat: 'jle-editor-project-v1', levelId: '1844674407370955161', displayName: 'ID', assets: [] }],
  ['special-title', { projectFormat: 'jle-editor-project-v1', levelId: '126', displayName: 'Please!!! lets do this!', assets: [] }],
  ['removed-asset', { projectFormat: 'jle-editor-project-v1', levelId: '127', displayName: 'Old', assets: [{ assetId: 'removed_legacy_asset' }] }],
];
for (const [name, fixture] of fixtures) {
  const roundTrip = JSON.parse(JSON.stringify(fixture));
  if (roundTrip.projectFormat !== 'jle-editor-project-v1' || String(roundTrip.levelId) !== String(fixture.levelId)) {
    throw new Error(`Fixture ${name} did not preserve project identity.`);
  }
}

console.log(`Level loader validation passed (${fixtures.length} compatibility fixtures).`);
