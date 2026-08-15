#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const appRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(appRoot, '..');
const generatorPath = path.join(workspaceRoot, 'UAssetPipeline', 'Scripts', 'Generate-JLEProject.cjs');
const manifestPath = path.join(appRoot, 'src', 'visual-manifest.json');
const libraryPath = path.join(appRoot, 'public', 'asset-visuals');
const outputPath = path.join(workspaceRoot, 'Mesh-Gathering-Checklist.csv');
const markdownPath = path.join(workspaceRoot, 'Mesh-Gathering-Checklist.md');

const generator = fs.readFileSync(generatorPath, 'utf8');
const objectBlock = generator.match(/const assetObjects\s*=\s*\{([\s\S]*?)\n\};/);
if (!objectBlock) throw new Error('Could not locate assetObjects in Generate-JLEProject.cjs.');

const assets = [...objectBlock[1].matchAll(/^\s*([a-z0-9_]+):\s*'([^']+)'/gm)]
  .map((match) => ({ assetId: match[1], actorClass: match[2] }))
  .filter(({ assetId }) => assetId !== 'enemy_dim');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const expectedNames = (assetId, actorClass) => {
  const stem = actorClass.replace(/^BP_/, '');
  return [
    `${assetId}.glb`,
    `${assetId}__part-name.glb`,
    `${actorClass}.glb`,
    `SM_${stem}.glb`,
    `SK_${stem}.glb`,
  ];
};
const rows = assets.map(({ assetId, actorClass }) => {
  const visual = manifest.assetVisuals?.[assetId];
  const mappedFiles = visual
    ? (visual.files || [visual.file]).filter(Boolean).map((file) => path.basename(file))
    : [];
  const present = mappedFiles.filter((file) => fs.existsSync(path.join(libraryPath, file)));
  return {
    assetId,
    actorClass,
    status: present.length === mappedFiles.length && present.length > 0 ? 'MAPPED' : 'NEEDS_MESH',
    mappedFiles: mappedFiles.join('; '),
    suggestedSearch: expectedNames(assetId, actorClass).join('; '),
    notes: visual ? 'Manifest entry exists.' : 'Export the actor mesh and required child mesh parts/material textures.',
  };
});

const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const columns = ['assetId', 'actorClass', 'status', 'mappedFiles', 'suggestedSearch', 'notes'];
fs.writeFileSync(outputPath, [columns.join(','), ...rows.map((row) => columns.map((key) => quote(row[key])).join(','))].join('\n') + '\n');

const mapped = rows.filter((row) => row.status === 'MAPPED');
const missing = rows.filter((row) => row.status !== 'MAPPED');
const md = [
  '# JETRUNNER editor mesh-gathering checklist',
  '',
  `Generated from the runtime class registry. Total assets: **${rows.length}**; mapped: **${mapped.length}**; awaiting extraction: **${missing.length}**.`,
  '',
  'Use FModel to export each actor’s visible static/skeletal mesh parts as GLB. Rename a single mesh to `<assetId>.glb`, or multipart meshes to `<assetId>__<part>.glb`, then run `Import Mesh Library.bat`.',
  '',
  '## Already mapped',
  '',
  ...mapped.map((row) => `- [x] \`${row.assetId}\` — \`${row.actorClass}\` — ${row.mappedFiles}`),
  '',
  '## Meshes to gather',
  '',
  ...missing.map((row) => `- [ ] \`${row.assetId}\` — \`${row.actorClass}\` — search for \`${row.suggestedSearch.split('; ')[3]}\``),
  '',
];
fs.writeFileSync(markdownPath, md.join('\n'));
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${markdownPath}`);
console.log(JSON.stringify({ total: rows.length, mapped: mapped.length, missing: missing.length }));
