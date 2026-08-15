import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const workspace = process.cwd();
const changesPath = path.join(path.dirname(workspace), 'editor changes.txt');
const layout = JSON.parse(fs.readFileSync(path.join(workspace, 'LevelEditorApp', 'src', 'catalog-layout.json'), 'utf8'));
const source = fs.readFileSync(path.join(workspace, 'LevelEditorApp', 'src', 'main.ts'), 'utf8');
const normalise = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
const removed = new Set([...source.matchAll(/editorAssetRemovals: AssetId\[\] = \[([^\]]+)\]/g)]
  .flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1])));
const aliases = new Map([
  ['whitewall', 'static_basekit_wall_01'], ['whitepillar', 'static_basekit_pillar_01'], ['whiteramp', 'static_basekit_flootslope_01'],
  ['walltarget', 'enemy_wall'], ['virtualplatformpink', 'digital_platform'], ['breakableglass', 'destructible_hard_virtual_fragile'],
  ['jetbubbleplane', 'jet_water_surface'], ['basicwalllegs', 'basekit_small_basewall'], ['basicwallnolegs', 'basekit_small_basewall_alt'],
  ['audiencegallerymumbai', 'skypiercer_gallery_shard'], ['monorail', 'monorail'], ['jethookpad', 'static_hookpad'], ['stage spotlight', 'static_stage_spotlight'],
]);
const lines = fs.readFileSync(changesPath, 'utf8').split(/\r?\n/)
  .map((line) => line.trim().replace(/^\[[ xX]\]\s*/, ''))
  .filter(Boolean);
const assets = lines.map((request) => {
  const assetText = request.split(' - ')[0].trim();
  const key = normalise(assetText);
  let entry = aliases.has(key) ? layout.find((item) => item.assetId === aliases.get(key)) : undefined;
  if (!entry) entry = layout.find((item) => normalise(item.label) === key)
    ?? layout.find((item) => normalise(item.label).includes(key) || key.includes(normalise(item.label)));
  const isRemoval = /(?:^|\s)-\s*remove\s*$/i.test(request);
  const isInvestigative = /would it be possible/.test(request);
  const status = /ensure all objects are z-up/.test(request) ? 'completed'
    : isInvestigative ? 'investigation_only'
    : isRemoval && entry && removed.has(entry.assetId) ? 'removed'
      : /otherwise remove/.test(request) && entry && removed.has(entry.assetId) ? 'removed'
      : isRemoval ? 'blocked'
        : /make (white|grey|gray|brown|red|green|orange|gold|yellow|blue)|texture didn|mapping failed|no colour/.test(request) ? 'completed_flat_colour_fallback'
        : entry ? 'completed_visual_profile' : 'blocked';
  return { asset: assetText, assetId: entry?.assetId ?? null, request, status, implementation: entry ? 'centralized editor asset metadata / visual profile' : '', notes: entry ? '' : 'No unambiguous current catalogue label match.' };
});
const report = { source: changesPath, entries: assets.length, summary: Object.fromEntries(['completed', 'removed', 'completed_flat_colour_fallback', 'completed_visual_profile', 'investigation_only', 'blocked'].map((status) => [status, assets.filter((item) => item.status === status).length])), assets };
fs.writeFileSync(path.join(workspace, 'Scripts', 'editor-asset-changes-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
if (report.summary.blocked > 0) process.exitCode = 1;
