import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanGameData, Confidence } from './game-data/scanner-core.mjs';

const fixture = path.resolve(import.meta.dirname, 'fixtures/game-data');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'lef-scanner-'));
const options = {
  game: 'fixture-game', fmodel: path.join(fixture, 'fmodel'), headers: path.join(fixture, 'headers'), outputRoot: temp,
  curated: { assets: { BP_OneMesh: { placeable: true, displayName: 'One Mesh', runtimeObjectName: 'BP_OneMesh', dummyFamily: 'generic', fallbackColour: '#888888' } } },
};
const sourceFile = path.join(fixture, 'fmodel', 'SM_Crate.json');
const sourceBefore = await fs.readFile(sourceFile, 'utf8');
const first = await scanGameData(options);
assert.equal(first.index.counts.parseFailures, 1);
assert(first.index.counts.graphNodes >= 9);
assert(first.candidates.some((candidate) => candidate.classification === 'verified placeable'));
assert(first.candidates.some((candidate) => candidate.classification === 'likely placeable'));
assert(first.nodes.some((node) => node.components.length > 1));
assert(first.nodes.some((node) => node.constructionScript));
assert(first.collisions.some((entry) => entry.proxies.some((proxy) => proxy.type === 'box')));
assert(first.materials.some((entry) => entry.slots.length));
assert(first.queue.some((entry) => entry.neededExport === 'parent Blueprint'));
assert(first.dummies.every((entry) => entry.confidence !== Confidence.INFERRED));
const duplicate = first.nodes.find((node) => node.canonicalName === 'BP_DuplicateReferences');
assert.equal(new Set(duplicate.references).size, duplicate.references.length);
const cacheBefore = await fs.stat(path.join(first.output, '.scan-cache.json'));
const second = await scanGameData(options);
const cacheAfter = await fs.stat(path.join(first.output, '.scan-cache.json'));
assert.equal(second.index.counts.graphNodes, first.index.counts.graphNodes);
assert(cacheAfter.size > 0 && cacheBefore.size > 0);
for (const name of ['game-data-index.json', 'header-index.json', 'asset-graph.json', 'asset-candidates.json', 'runtime-sizing.json', 'collision-index.json', 'material-texture-index.json', 'editor-overlay-candidates.json', 'dummy-candidates.json', 'extraction-queue.json']) await fs.access(path.join(first.output, name));
assert.equal(await fs.readFile(sourceFile, 'utf8'), sourceBefore);
await assert.rejects(() => scanGameData({ ...options, game: '../escape' }), /Game id/);
await fs.rm(temp, { recursive: true, force: true });
console.log('Game-data scanner fixtures passed: FModel, UHT, graph, provenance, candidates, overlays, material, sizing, collision, dummy, queue, malformed input, deduplication, cached rescan, read-only sources, and traversal rejection.');
