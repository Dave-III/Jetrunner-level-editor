import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const workspace = fs.existsSync(path.join(cwd, 'LevelEditorApp')) ? cwd : path.dirname(cwd);
const app = path.join(workspace, 'LevelEditorApp');
const layout = JSON.parse(fs.readFileSync(path.join(app, 'src', 'catalog-layout.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(app, 'src', 'visual-manifest.json'), 'utf8'));
const blueprintAssemblies = JSON.parse(fs.readFileSync(path.join(app, 'src', 'blueprint-visual-assemblies.json'), 'utf8')).assemblies;
const source = fs.readFileSync(path.join(app, 'src', 'main.ts'), 'utf8');
const compilerSource = fs.readFileSync(path.join(workspace, 'UAssetPipeline', 'Scripts', 'Generate-JLEProject.cjs'), 'utf8');
const newObjectCatalog = JSON.parse(fs.readFileSync(
  path.join(workspace, 'UAssetPipeline', 'Scripts', 'new-object-catalog.json'),
  'utf8',
));
const supportAuditPath = path.join(workspace, 'Scripts', 'asset-support-audit.json');
if (!fs.existsSync(supportAuditPath)) {
  throw new Error('Missing Scripts/asset-support-audit.json. Run node Scripts/Audit-AssetSupport.mjs first.');
}
const supportAudit = JSON.parse(fs.readFileSync(supportAuditPath, 'utf8'));

const profileIds = new Set(
  [...source.matchAll(/\b([a-z][a-z0-9_]+): '(?:basic|orb|target|laserBeam|laserWall|jetmill|polarity|light)'/g)]
    .map((match) => match[1]),
);
const staticPaletteIds = [...source.matchAll(/data-asset-id="([a-z][a-z0-9_]+)"/g)]
  .map((match) => match[1]);
const assetIds = [...new Set([...layout.map((entry) => entry.assetId), ...staticPaletteIds])];
const brokenFiles = [];
const assetObjectsMatch = compilerSource.match(/const assetObjects = \{([\s\S]*?)\n\};/);
if (!assetObjectsMatch) throw new Error('Could not locate the compiler runtime asset catalogue.');
const compilerMappings = new Map(
  [...assetObjectsMatch[1].matchAll(/^\s*([a-z][a-z0-9_]+):\s*'([^']+)'/gm)]
    .map((match) => [match[1], match[2]]),
);
for (const entry of newObjectCatalog) compilerMappings.set(entry.assetId, entry.objectName);
// Player Start and Finish Goal are intentionally emitted by the compiler as
// prerequisite actors rather than through the generic placed-object array.
compilerMappings.set('player_start', 'SBPlayerStart');
compilerMappings.set('time_trial_goal', 'BP_TimeTrialGoal_Sphere');

for (const assetId of assetIds) {
  const entry = manifest.assetVisuals[assetId];
  for (const file of entry ? (entry.files ?? [entry.file]) : []) {
    if (!file || !fs.existsSync(path.join(app, 'public', file.replace(/^\.\//, '')))) {
      brokenFiles.push({ assetId, file });
    }
  }
}
for (const [assetId, assembly] of Object.entries(blueprintAssemblies)) {
  for (const component of assembly.components) {
    if (component.file && !fs.existsSync(path.join(app, 'public', component.file.replace(/^\.\//, '')))) {
      brokenFiles.push({ assetId, file: component.file });
    }
  }
}

const runtimeMappings = new Map(layout.map((entry) => [entry.assetId, entry.objectName]));
const unresolvedRuntimeMappings = assetIds
  .filter((assetId) => !runtimeMappings.get(assetId) || !compilerMappings.has(assetId));
const mismatchedRuntimeMappings = assetIds
  .filter((assetId) => runtimeMappings.get(assetId) && compilerMappings.get(assetId)
    && runtimeMappings.get(assetId) !== compilerMappings.get(assetId))
  .map((assetId) => ({
    assetId,
    editor: runtimeMappings.get(assetId),
    compiler: compilerMappings.get(assetId),
  }));
const glbBackedAssets = assetIds.filter((assetId) => Boolean(manifest.assetVisuals[assetId]));
const centralizedProfileAssets = assetIds.filter((assetId) => (
  !manifest.assetVisuals[assetId] && profileIds.has(assetId)
));
const flatColourFallbackAssets = assetIds.filter((assetId) => (
  !manifest.assetVisuals[assetId] && !profileIds.has(assetId)
));

const representativeIds = [
  'laser_beam', 'laser_wall', 'polarity_flipper', 'jetmill', 'block_tree', 'static_barrel',
];
const report = {
  catalogueAssets: assetIds.length,
  validRuntimeMappings: assetIds.length - unresolvedRuntimeMappings.length - mismatchedRuntimeMappings.length,
  unresolvedRuntimeMappings,
  mismatchedRuntimeMappings,
  glbModelPreviews: glbBackedAssets.length,
  centralizedVisualFallbacks: centralizedProfileAssets.length,
  flatColourFallbacks: flatColourFallbackAssets.length,
  brokenPreviewFiles: brokenFiles,
  representative: Object.fromEntries(representativeIds.map((assetId) => [assetId, {
    catalogued: assetIds.includes(assetId),
    runtimeObjectName: runtimeMappings.get(assetId),
    compilerRuntimeObjectName: compilerMappings.get(assetId),
    glb: Boolean(manifest.assetVisuals[assetId]),
    centralizedProfile: profileIds.has(assetId),
    flatColourFallback: !manifest.assetVisuals[assetId] && !profileIds.has(assetId),
  }])),
  behaviours: {
    runtimeMetadata: source.includes('runtimeObjectName?: string')
      && source.includes('runtimeMappingStatus'),
    exportRejectsUnresolved: source.includes('These assets do not have verified runtime mappings'),
    compilerRejectsMismatch: compilerSource.includes('Runtime mapping mismatch for'),
    laserProfiles: source.includes("laser_beam: 'laserBeam'") && source.includes("laser_wall: 'laserWall'"),
    polarityVariant: source.includes('function polarityColour(mesh: THREE.Mesh)'),
    jetmillSpeedVariant: source.includes('jetmillSpeed >= 1200'),
    treeHasNoPunchMetadata: !source.includes('PunchesToBreak'),
    environmentLighting: source.includes('function applyEditorEnvironmentPreview()') && source.includes('new THREE.PointLight'),
    surfaceGeometryPreserved: source.includes("const geometry = definition.catalog !== 'surface'")
      && source.includes('? basicFallbackGeometry(definition.label)')
      && source.includes(': definition.geometry();'),
    blastJelliesAreRound: [
      'blast_jelly_container',
      'blast_jelly_container_evil',
      'blast_jelly_container_grounded',
    ].every((assetId) => new RegExp(`${assetId}: \\{[^\\n]+SphereGeometry\\(50`).test(source)),
    jetBubblePlaneIsFlat: source.includes("geometry: () => new THREE.PlaneGeometry(100, 100)")
      && source.includes("if (assetId === 'jet_water_surface') material.side = THREE.DoubleSide"),
    allPlaceableGlbsUseZUpBasis: source.includes("if (assetId !== undefined) visual.rotateX(Math.PI / 2)")
      && !source.includes("assetId?.startsWith('static_')"),
    verticalFallbacksUseZUpBasis: source.includes('// Three.js cylinders are Y-up; procedural editor objects are Z-up.')
      && source.includes('geometry.rotateX(Math.PI / 2);'),
    craneUsesStableProceduralPreview: source.includes("assetId === 'crane'")
      && source.includes('separate Blueprint components with large local offsets'),
    lazyMeshThumbnails: source.includes('const assetThumbnailObserver = new IntersectionObserver')
      && source.includes('const assetThumbnailRenderer = new THREE.WebGLRenderer')
      && source.includes('await thumbnailForAsset(assetId)')
      && source.includes('usesProceduralEditorVisual(assetId)')
      && source.includes('multiplyScalar(-thumbnailScale)')
      && source.includes('thumbnailContainsVisiblePixels()')
      && source.includes('forceVisibleThumbnailMaterials(container, assetId)')
      && source.includes("reason: 'model-and-material-retry-rendered-no-pixels'"),
    blueprintTargetPreviews: source.includes("enemy_plain: 'target'")
      && source.includes("enemy_cannon: 'target'")
      && source.includes("profile === 'target'")
      && source.includes("assetId === 'enemy_cannon'"),
    genuineGeometryThumbnailFallback: source.includes('forceVisibleThumbnailMaterials(root: THREE.Object3D')
      && source.includes('forceVisibleThumbnailMaterials(container, assetId)'),
    basekitColourOverrides: source.includes('const forcedFlatColourAssetIds = new Set<AssetId>')
      && source.includes("'static_baskit_smol_ledgefloor_01'")
      && source.includes("'static_basekit_ledgequartercylinder_01'"),
    correctedCylinderAndRampPreviews: !/return assetId === 'crane'[\s\S]{0,180}static_basekit_cylinder_01/.test(source)
      && !/return assetId === 'crane'[\s\S]{0,180}static_basekit_flootslope_01/.test(source)
      && source.includes('const whiteCylinderDefinition')
      && source.includes('const whiteRampDefinition')
      && Boolean(manifest.assetVisuals.static_basekit_cylinder_01?.file)
      && Boolean(manifest.assetVisuals.static_basekit_flootslope_01?.file),
    proceduralCompoundPropsAreAuthoritative: [
      'chinese_lantern', 'torch_floor', 'torch_wall', 'ladder',
      'water_pipe', 'water_pipe_etheral', 'water_pipe_rave',
      'blast_jelly_container', 'blast_jelly_container_evil',
      'blast_jelly_container_grounded', 'jet_bubble', 'jet_water_surface',
      'laser_beam', 'laser_wall',
    ].every((assetId) => source.includes(`|| assetId === '${assetId}'`)),
    nativeTraversalColoursPreserved: source.includes("'blast_jelly_container_grounded', 'jet_bubble', 'laser_wall'")
      && source.includes('nativeRingAssets.has(mesh.userData.assetId as AssetId)'),
    lightsHaveNoDuplicateGlowSphere: source.includes('Keep illumination without adding visible glow geometry.')
      && !/profile === 'light'[\s\S]{0,350}SphereGeometry/.test(source),
    laserBeamMatchesRuntimeTrace: source.includes("beam.name = 'JLE_RuntimeLaserBeam'")
      && source.includes('laserPreviewRaycaster.far = 10000')
      && source.includes('intersectObjects(candidates, false)'),
    laserWallIsHorizontalField: source.includes("new THREE.PlaneGeometry(280, 180)")
      && source.includes("baseDimensions: [300, 200, 10]")
      && source.includes('all four perimeter rails'),
    correctedBasicWallAndWhiteCylinders: source.includes('const basicWallLegsGeometry')
      && source.includes('const basicWallNoLegsGeometry')
      && source.includes('const basicCubePillarGeometry')
      && source.includes('marblePillarDefinition.previewDimensions = [100, 100, 100]')
      && source.includes('const hollowWhiteCylinderGeometry')
      && source.includes('whiteCylinderDefinition.baseDimensions = [400, 400, 400]')
      && source.includes('hollowWhiteCylinderDefinition.baseDimensions = [400, 400, 400]'),
    exactWhitePlatformGeometry: source.includes('topOriginBoxGeometry(400, 400, 50)')
      && source.includes('new THREE.CylinderGeometry(200, 200, 50, 64)')
      && source.includes('shape.absarc(0, 0, 200, 0, Math.PI / 2, false)'),
    genuineBasekitComponentsReused: source.includes('basicWallLegsDefinition.previewDimensions = [344, 12, 202]')
      && source.includes('basicCubePillarDefinition.previewDimensions = [200, 200, 500]')
      && source.includes('concretePillarDefinition.previewDimensions = [96, 96, 100]')
      && manifest.assetVisuals.basekit_small_basewall?.file === './asset-visuals/static_basekit_wall_01.glb'
      && manifest.assetVisuals.basekit_small_basewall_alt?.file === './asset-visuals/static_basekit_wall_01.glb'
      && manifest.assetVisuals.concrete_pillar?.file === './asset-visuals/static_concretecube_cube_001.glb',
    skyPlatformsRebuildBlueprintAssembly: source.includes('function buildSkyPlatformVisual(')
      && source.includes("addPart(side, edgeCenter, 0, 0)")
      && source.includes("addPart(corner, edgeCenter, edgeCenter, 0)")
      && source.includes("top.name = 'SkyPlatform_TopPlane'")
      && ['sky_platform', 'sky_platform_blue', 'sky_platform_gold', 'sky_platform_yellow']
        .every((assetId) => manifest.assetVisuals[assetId]?.files?.length === 2),
    staticBlueprintAssembliesPreserveRuntimeScale: Object.keys(blueprintAssemblies).length >= 26
      && source.includes('function loadBlueprintVisualAssembly(')
      && source.includes('part.scale.setScalar(100)')
      && source.includes('componentRoot.position.set(...component.positionCm)')
      && source.includes('componentRoot.matrix.fromArray(component.matrix)')
      && source.includes('definition.baseDimensions = [...assembly.boundsCm.sizeCm]'),
    blueprintComponentsUseEditorHandedness: source.includes("componentRoot.matrix.fromArray(component.matrix)")
      && JSON.stringify(blueprintAssemblies).includes('"matrix"'),
    basicWallUsesCleanRuntimeAssemblyMaterials: source.includes("assetId === 'basekit_small_basewall'")
      && source.includes('material.userData.jleResolvedColor = true')
      && source.includes('trim ? 0xff7259 : 0xe9f3f7'),
    yellowSkyPlatformIsRuntimeFixedScale: source.includes("resizeAxes: [],")
      && source.includes('Yellow Sky Platform. Its runtime class ignores actor resizing.'),
    catalogueUsesPlacedMaterialPath: !source.includes('forceVisibleThumbnailMaterials(visual, definition)')
      && source.includes('repairExtractedMaterials(visual, assetId)'),
    retiredCatalogueObjectsHidden: ['installation_pillar', 'tower_waterfall', 'wall_monitor_blimp']
      .every((assetId) => !layout.some((entry) => entry.assetId === assetId)),
    deletionRemovesFromActualParent: /function disposePlacedMesh\(mesh: THREE\.Mesh\)[\s\S]{0,500}mesh\.removeFromParent\(\)/
      .test(source),
  },
  verificationSupport: {
    dummyResourcesAvailable: supportAudit.verificationDummyResources?.available === true,
    unsupportedPlaceableAssets: supportAudit.assets
      .filter((asset) => asset.placeable && asset.verifierSupported !== true)
      .map((asset) => asset.assetId),
  },
};

console.log(JSON.stringify(report, null, 2));
if (
  unresolvedRuntimeMappings.length > 0
  || mismatchedRuntimeMappings.length > 0
  || brokenFiles.length > 0
  || !report.verificationSupport.dummyResourcesAvailable
  || report.verificationSupport.unsupportedPlaceableAssets.length > 0
  || Object.values(report.behaviours).some((value) => !value)
) {
  process.exitCode = 1;
}
