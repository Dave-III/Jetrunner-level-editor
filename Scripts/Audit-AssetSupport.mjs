import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);
const cwd = process.cwd();
const workspace = fs.existsSync(path.join(cwd, 'LevelEditorApp')) ? cwd : path.dirname(cwd);
const app = path.join(workspace, 'LevelEditorApp');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const layout = readJson(path.join(app, 'src', 'catalog-layout.json'));
const visualManifest = readJson(path.join(app, 'src', 'visual-manifest.json'));
const editorSource = fs.readFileSync(path.join(app, 'src', 'main.ts'), 'utf8');
const verifierSource = fs.readFileSync(path.join(app, 'electron', 'main.cjs'), 'utf8');
const {
  surfaceAssetIds,
  genericStaticMeshMappings,
  verificationObjectAssetIds,
  verificationSpecialAssetIds,
  verificationSupportedAssetIds,
} = require(path.join(app, 'electron', 'verification-assets.cjs'));
const { runtimeAssetStatus } = require(path.join(app, 'electron', 'runtime-asset-status.cjs'));

const runtimeResources = path.join(
  workspace, 'UAssetPipeline', 'Resources', 'JETRUNNER', 'Content', 'Mods', 'CustomLevels',
);
const requiredVerificationFiles = [
  'JLE_ObjectPlacer.uasset', 'JLE_ObjectPlacer.uexp',
  'PlacedObject.uasset', 'PlacedObject.uexp',
];
const verificationDummyAvailable = requiredVerificationFiles.every((file) => (
  fs.existsSync(path.join(runtimeResources, file))
));

const profileIds = new Set(
  [...editorSource.matchAll(/\b([a-z][a-z0-9_]+): '(?:basic|orb|laserBeam|laserWall|jetmill|polarity|light)'/g)]
    .map((match) => match[1]),
);
const removedMatch = editorSource.match(/const editorAssetRemovals: AssetId\[\] = \[([^\]]*)\]/);
if (!removedMatch) throw new Error('Could not locate the editor removal metadata.');
const intentionallyRemoved = new Set([...removedMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]));
const verifierSet = new Set(verificationSupportedAssetIds);
const canonicalLayoutMappings = new Map(layout.map((entry) => [entry.assetId, entry.objectName]));
const invalidGenericStaticMeshMappings = Object.entries(genericStaticMeshMappings)
  .filter(([assetId, objectName]) => canonicalLayoutMappings.get(assetId) !== objectName)
  .map(([assetId, objectName]) => ({
    assetId,
    verifierObjectName: objectName,
    catalogueObjectName: canonicalLayoutMappings.get(assetId) ?? null,
  }));
const staticPaletteIds = [...new Set([...editorSource.matchAll(/data-asset-id="([a-z][a-z0-9_]+)"/g)]
  .map((match) => match[1]))];
const layoutSet = new Set(layout.map((entry) => entry.assetId));
const catalogueEntries = [
  ...layout,
  ...staticPaletteIds
    .filter((assetId) => !layoutSet.has(assetId))
    .map((assetId) => ({ assetId, label: assetId, objectName: null })),
];
const editorAssetIds = new Set(catalogueEntries.map((entry) => entry.assetId));
const candidatePlaceable = catalogueEntries.filter((entry) => !intentionallyRemoved.has(entry.assetId));
const unsupportedEditorAssets = candidatePlaceable.filter((entry) => (
  !verifierSet.has(entry.assetId) || !entry.objectName
));
const finalPlaceable = candidatePlaceable.filter((entry) => (
  verifierSet.has(entry.assetId) && Boolean(entry.objectName)
));
const verifierNotExposed = verificationSupportedAssetIds.filter((assetId) => !editorAssetIds.has(assetId));
const legacySurfaceVariantIds = new Set([
  'capped_platform_tower', 'ice_platform_2x2', 'ice_platform_2x3',
  'ice_platform_2x4', 'ice_platform_3x5', 'frozen_waterfall',
  'wooden_platform_2x2', 'rio_platform_2x2', 'rio_platform_2x3',
  'rio_platform_2x4', 'rio_platform_2x5', 'rio_platform_3x3',
  'rio_platform_3x5', 'rio_platform_3x9', 'rio_platform_4x5',
  'skypiercer_tower_2x2', 'skypiercer_tower_2x3', 'skypiercer_tower_2x4',
  'skypiercer_tower_3x3', 'skypiercer_tower_3x4', 'skypiercer_tower_4x4',
  'skypiercer_edge_detail', 'skypiercer_midwall_detail',
  'skypiercer_special_1x1', 'skypiercer_special_2x2',
  'skypiercer_special_2x3', 'tower_wall',
]);
const unexposedVerifierAssets = verifierNotExposed.map((assetId) => {
  if (legacySurfaceVariantIds.has(assetId)) {
    return { assetId, disposition: 'legacy_surface_variant', notes: 'Superseded by the current resizable surface catalogue.' };
  }
  if (assetId === 'jetmill_supercharged') {
    return { assetId, disposition: 'derived_variant', notes: 'Selected automatically from JetmillSpeed >= 1200; not a separate palette item.' };
  }
  if (assetId === 'enemy_dim') {
    return { assetId, disposition: 'legacy_gameplay_variant', notes: 'No approved current target entry exists in the editor catalogue.' };
  }
  if (assetId === 'digital_platform_red') {
    return { assetId, disposition: 'unsupported_legacy_asset', notes: 'No verified JLE_ObjectPlacer runtime mapping; retained only for legacy project diagnostics.' };
  }
  return { assetId, disposition: 'legacy_prefab', notes: 'Legacy prefab retained for old level compatibility; current explicit static catalogue is used instead.' };
});
const rendererUsesVerifierGate = editorSource.includes('verificationMappingStatus')
  && editorSource.includes('verifierSupportedAssetIds')
  && editorSource.includes('not supported by the installed verification dummy');
const detailedVerifierErrors = verifierSource.includes("uses unsupported AssetId '")
  && verifierSource.includes('object?.assetLabel');

const assets = catalogueEntries.map((entry) => {
  const verifierSupported = verifierSet.has(entry.assetId);
  const deliberatelyRemoved = intentionallyRemoved.has(entry.assetId);
  const visual = visualManifest.assetVisuals?.[entry.assetId];
  const runtimeQa = runtimeAssetStatus[entry.assetId] ?? {
    runtimeSpawnStatus: 'untested', manualTestStatus: 'untested',
    reason: 'No in-game spawn result has been recorded.',
  };
  return {
    name: entry.label,
    assetId: entry.assetId,
    runtimeMapping: Boolean(entry.objectName),
    verificationDummy: verificationSpecialAssetIds.includes(entry.assetId)
      ? 'mandatory-map-actor'
      : Object.hasOwn(genericStaticMeshMappings, entry.assetId)
        ? 'generic-static-placed-object'
        : verifierSupported ? 'JLE_ObjectPlacer generic object' : null,
    verifierSupported,
    verifierPath: verificationSpecialAssetIds.includes(entry.assetId)
      ? 'mandatory-map-actor'
      : verifierSupported ? 'JLE_ObjectPlacer generic object' : null,
    isSurface: surfaceAssetIds.includes(entry.assetId),
    catalogRuntimeObjectName: entry.objectName || null,
    editorVisualKind: visual ? 'glb' : profileIds.has(entry.assetId) ? 'profile' : 'flat-colour-fallback',
    editorVisualStatus: visual || profileIds.has(entry.assetId) ? 'available' : 'fallback',
    editorCollisionStatus: editorSource.includes(`'${entry.assetId}'`) ? 'metadata-present-or-visual-bounds' : 'untested',
    verificationStatus: verifierSupported ? 'supported' : 'unsupported',
    runtimeSpawnStatus: runtimeQa.runtimeSpawnStatus,
    manualTestStatus: runtimeQa.manualTestStatus,
    placeable: !deliberatelyRemoved && verifierSupported && Boolean(entry.objectName),
    status: entry.assetId === 'digital_platform_red'
      ? 'blocked_missing_verification_or_runtime_mapping'
      : deliberatelyRemoved
        ? 'intentionally_hidden'
        : verifierSupported && entry.objectName ? 'verification_supported_runtime_unconfirmed' : 'blocked_missing_verification_or_runtime_mapping',
    notes: entry.assetId === 'digital_platform_red'
      ? 'Unsupported legacy asset; no authoritative JLE_ObjectPlacer mapping is available.'
      : deliberatelyRemoved
        ? 'Intentionally removed from the palette; retained for backward-compatible loading.'
      : Object.hasOwn(genericStaticMeshMappings, entry.assetId)
        ? `Canonical static ObjectName matches the approved catalogue. ${runtimeQa.reason}`
        : verifierSupported ? `Existing verifier mapping. ${runtimeQa.reason}` : runtimeQa.reason,
  };
});
const count = (predicate) => assets.filter(predicate).length;
const platforms = assets.filter((asset) => asset.placeable && (
  asset.isSurface || /platform|\bfloor\b|\bstage\b/i.test(asset.name)
)).map((asset) => ({
  assetId: asset.assetId,
  name: asset.name,
  savedJson: true,
  verificationDummy: asset.verificationDummy,
  verifierSupported: asset.verifierSupported,
  runtimeMapping: asset.runtimeMapping,
  editorVisualKind: asset.editorVisualKind,
  status: asset.verifierSupported && asset.runtimeMapping ? 'verification-compatible' : 'blocked',
}));
const report = {
  generatedAt: new Date().toISOString(),
  verifierSource: 'LevelEditorApp/electron/verification-assets.cjs',
  verificationDummyResources: {
    available: verificationDummyAvailable,
    requiredFiles: requiredVerificationFiles.map((file) => ({
      file, present: fs.existsSync(path.join(runtimeResources, file)),
    })),
  },
  summary: {
    editorCatalogueAssets: catalogueEntries.length,
    editorPlaceableBeforeVerifierGate: candidatePlaceable.length,
    verifierSupportedAssetIds: verificationSupportedAssetIds.length,
    verifierGenericObjectAssetIds: verificationObjectAssetIds.length,
    verifierMandatoryActorAssetIds: verificationSpecialAssetIds.length,
    verifiedGenericStaticMeshMappings: Object.keys(genericStaticMeshMappings).length,
    exactIntersection: finalPlaceable.length,
    editorAssetsBlockedByVerifier: unsupportedEditorAssets.length,
    verifierAssetIdsNotExposedByEditor: verifierNotExposed.length,
    supportedPlaceableAfterAudit: finalPlaceable.length,
    glbModelPreviews: count((asset) => asset.placeable && asset.editorVisualKind === 'glb'),
    flatColourFallbacks: count((asset) => asset.placeable && asset.editorVisualKind === 'flat-colour-fallback'),
    centralizedVisualFallbacks: count((asset) => asset.placeable && asset.editorVisualKind === 'profile'),
  },
  exactIntersection: finalPlaceable.map((entry) => entry.assetId),
  placeableInEditorButNotSupportedByVerifier: unsupportedEditorAssets.map((entry) => ({
    assetId: entry.assetId, label: entry.label, objectName: entry.objectName,
  })),
  verifierAssetIdsNotCurrentlyExposedByEditor: unexposedVerifierAssets,
  rendererUsesVerifierGate,
  detailedVerifierErrors,
  invalidGenericStaticMeshMappings,
  platformVerification: {
    auditedPlaceablePlatforms: platforms.length,
    incompatiblePlaceablePlatforms: platforms.filter((asset) => asset.status !== 'verification-compatible'),
    assets: platforms,
  },
  assets,
};

const output = path.join(workspace, 'Scripts', 'asset-support-audit.json');
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
if (!verificationDummyAvailable || !rendererUsesVerifierGate || !detailedVerifierErrors
  || invalidGenericStaticMeshMappings.length > 0 || assets.some((asset) => (
  asset.placeable && !asset.verifierSupported
))) {
  process.exitCode = 1;
}
