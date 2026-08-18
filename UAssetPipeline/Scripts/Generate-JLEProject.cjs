#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => {
  if (!value.startsWith('--')) return [null, null];
  return [value.slice(2), all[index + 1]];
}).filter(([key]) => key));

for (const required of ['level-data', 'map-template', 'leveldef-template', 'example-map', 'output']) {
  if (!args[required]) throw new Error(`Missing --${required}.`);
}

const clone = (value) => JSON.parse(JSON.stringify(value));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const safeName = (value) => {
  let name = String(value || 'Unnamed_Level').trim().replace(/[^A-Za-z0-9_]+/g, '_').replace(/_+/g, '_');
  name = name.replace(/^_+|_+$/g, '');
  if (!name) name = 'Unnamed_Level';
  name = name.replace(/^(?:Map_)?JLE_/i, '').replace(/^Map_/i, '');
  if (!/^[A-Za-z]/.test(name)) name = `Level_${name}`;
  // UAssetGUI silently produces no output for otherwise valid package names
  // containing multiple authored underscores (for example Juan_trials_1).
  // Map_JLE_/LevelDef_JLE_ already provide the required Unreal separators;
  // keep the user-facing display name but make the generated identity purely
  // alphanumeric so every valid editor name can be converted reliably.
  return name.replace(/_/g, '');
};
const replaceToken = (value, token, replacement) => {
  if (typeof value === 'string') return value.split(token).join(replacement);
  if (Array.isArray(value)) return value.map((item) => replaceToken(item, token, replacement));
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) value[key] = replaceToken(value[key], token, replacement);
  }
  return value;
};
const property = (data, nameOrPrefix) => data.find((item) => (
  item.Name === nameOrPrefix || item.Name?.startsWith(nameOrPrefix)
));

const assetObjects = {
  capped_platform_tower: 'BP_CappedPlatformTower',
  ice_platform_2x2: 'BP_Ice_Platform_2x2',
  ice_platform_2x3: 'BP_Ice_Platform_2x3',
  ice_platform_2x4: 'BP_Ice_Platform_2x4',
  ice_platform_3x5: 'BP_Ice_Platform_3x5',
  frozen_waterfall: 'BP_FrozenWaterFall',
  wooden_platform_2x2: 'BP_WoodenPlatform_2x2',
  rio_platform_2x2: 'BP_CappedPlatformTower_RioPlatform2x2',
  rio_platform_2x3: 'BP_CappedPlatformTower_RioPlatform2x3',
  rio_platform_2x4: 'BP_CappedPlatformTower_RioPlatform2x4',
  rio_platform_2x5: 'BP_CappedPlatformTower_RioPlatform2x5',
  rio_platform_3x3: 'BP_CappedPlatformTower_RioPlatform3x3',
  rio_platform_3x5: 'BP_CappedPlatformTower_RioPlatform3x5',
  rio_platform_3x9: 'BP_CappedPlatformTower_RioPlatform3x9',
  rio_platform_4x5: 'BP_CappedPlatformTower_RioPlatform4x5',
  skypiercer_tower_2x2: 'BP_SkyPiercer_Tower2x2_01',
  skypiercer_tower_2x3: 'BP_SkyPiercer_Tower2x3_01',
  skypiercer_tower_2x4: 'BP_SkyPiercer_Tower2x4_01',
  skypiercer_tower_3x3: 'BP_SkyPiercer_Tower3x3_01',
  skypiercer_tower_3x4: 'BP_SkyPiercer_Tower3x4_01',
  skypiercer_tower_4x4: 'BP_SkyPiercer_Tower4x4_01',
  skypiercer_edge_detail: 'BP_SkyPiercer_TowerEdgeDetail_01',
  skypiercer_midwall_detail: 'BP_SkyPiercer_TowerMidWallDetail_01',
  skypiercer_special_1x1: 'BP_SkyPiercer_TowerSpecial1x1_01',
  skypiercer_special_2x2: 'BP_SkyPiercer_TowerSpecial2x2_01',
  skypiercer_special_2x3: 'BP_SkyPiercer_TowerSpecial2x3_01',
  tower_wall: 'BP_TowerWall',
  ice_platform_4x4: 'BP_RealVirtualPlatform_Ice',
  digital_platform: 'BP_DigitalPlatform',
  virtual_platform_dark: 'BP_RealVirtualPlatform_Dark',
  virtual_platform_orange: 'BP_RealVirtualPlatform_Orange',
  virtual_platform_purple: 'BP_RealVirtualPlatform_Purple',
  virtual_platform_purple_orange: 'BP_RealVirtualPlatform_PurpleAndOrange',
  virtual_platform_white: 'BP_RealVirtualPlatform_White',
  virtual_platform_white_blue: 'BP_RealVirtualPlatform_WhiteAndBlue',
  virtual_platform_white_gold: 'BP_RealVirtualPlatform_WhiteAndGold',
  virtual_platform_white_orange: 'BP_RealVirtualPlatform_WhiteAndOrange',
  virtual_platform_white_red: 'BP_RealVirtualPlatform_WhiteAndRed',
  destructible_hard_real_virtual: 'BP_DestructibleHard_RealVirtual',
  destructible_hard_virtual: 'BP_DestructibleHard_Virtual',
  destructible_hard_virtual_fragile: 'BP_DestructibleHard_Virtual_Fragile',
  hardlight_box: 'BP_HardlightBox',
  jet_water_surface: 'BP_JetWaterSurface',
  water_body_big: 'BP_WaterBody_Big',
  launch_pad: 'BP_LaunchPad_Big',
  ability_jetfreeze: 'BP_ItemOrb_JetFreeze',
  ability_jethook: 'BP_ItemOrb_JetHook',
  ability_jetjellybomb: 'BP_ItemOrb_JetJellyBomb',
  ability_jetleap: 'BP_ItemOrb_JetLeap',
  ability_jetpolarizer: 'BP_ItemOrb_JetPolarizer',
  ability_jetslam: 'BP_ItemOrb_JetSlam',
  energy_pickup: 'BP_EnergyPickup',
  enemy_plain: 'BP_Target_Plain',
  enemy_gun: 'BP_Target_Gun',
  enemy_gatling: 'BP_Target_Gatling',
  enemy_cannon: 'BP_Target_Cannon',
  enemy_laser: 'BP_Target_Laser',
  enemy_wall: 'BP_Target_Wall',
  // Retained for backwards compatibility with levels authored before the
  // V0.8 catalogue. It is no longer offered by the editor because AllAssets
  // does not advertise it.
  enemy_dim: 'BP_Target_Dim',
  blast_jelly_container: 'BP_BlastJellyContainer',
  blast_jelly_container_evil: 'BP_BlastJellyContainer_Evil',
  blast_jelly_container_grounded: 'BP_BlastJellyContainer_Grounded',
  block_tree: 'BP_BlockTree',
  calculator: 'BP_Calculator',
  damage_box: 'BP_DamageBox',
  health_pickup: 'BP_HealthPickup',
  jet_bubble: 'BP_JetBubble',
  jetmill: 'BP_Jetmill',
  jetmill_supercharged: 'BP_Jetmill_Supercharged',
  juan: 'BP_Juan',
  laser_beam: 'BP_LaserBeam',
  laser_wall: 'BP_LaserWall',
  launch_ring: 'BP_LaunchRing',
  polarity_flipper: 'BP_PolarityFlipper',
  statue_the_man: 'BP_Statue_TheMan',
  swing_bar: 'BP_SwingBar',
  ancient_pillar: 'BP_AncientPillar',
  arcade_token: 'BP_ArcadeToken',
  // The rainbow subclass currently loses the canonical coin mesh and pickup
  // audio in-game. Use the proven Arcade Token actor for both palette variants.
  arcade_token_rainbow: 'BP_ArcadeToken',
  artic_spotlight: 'BP_Artic_Spotlight',
  artic_spotlight_child: 'BP_Artic_Spotlight_Child',
  basekit_house: 'BP_Basekit_House01',
  basekit_small_basewall: 'BP_Basekit_Smol_Basewall',
  basekit_small_basewall_alt: 'BP_Basekit_Smol_Basewall1',
  basekit_small_cube_tower: 'BP_Basekit_Smol_CubeTower',
  basekit_tower: 'BP_Basekit_tower01',
  basekit_trip_trap: 'BP_Basekit_TripTrap',
  basekit_trip_trap_no_slope: 'BP_Basekit_TripTrap_NoSlope',
  basekit_small_house: 'BP_BasekitSmol_BaseHouse',
  basekit_small_house_alt: 'BP_BasekitSmol_BaseHouse1',
  basekit_small_platform: 'BP_BasekitSmol_BasePlatform',
  basekit_small_platform_alt_1: 'BP_BasekitSmol_BasePlatform1',
  basekit_small_platform_alt_2: 'BP_BasekitSmol_BasePlatform2',
  basekit_small_platform_alt_3: 'BP_BasekitSmol_BasePlatform3',
  basekit_small_hollow_cylinder: 'BP_BasekitSmol_HollowCylinder',
  basekit_small_ramp: 'BP_BasekitSmol_Ramp',
  bg_flood_light: 'BP_BGFloodLight',
  chinese_lantern: 'BP_ChineseLantern',
  concrete_pillar: 'BP_ConcretePillar',
  crane: 'BP_Crane',
  digital_audience_gallery: 'BP_DigitalAudienceGallery',
  digital_audience_gallery_synth: 'BP_DigitalAudienceGallery_Synth',
  digital_audience_gallery_white: 'BP_DigitalAudienceGallery_White',
  drone: 'BP_Drone',
  elevator: 'BP_Elevator',
  installation_pillar: 'BP_InstallationPillar',
  kill_cloud: 'BP_KillCloud',
  ladder: 'BP_Ladder',
  lars: 'BP_Lars',
  lcd_screen: 'BP_LCDScreen',
  destructible_leaf_pile: 'BP_LeafPile_Destructible',
  light_pole: 'BP_LightPole',
  light_rims: 'BP_LightRims',
  light_rims_arrow_straight: 'BP_LightRims_ArrowStraight',
  monorail: 'BP_Monorail',
  peony_spectating_box: 'BP_Peony_SpectatingBox',
  rio_gallery_shard: 'BP_RioGalleyShard',
  setback_bounds_waterfall: 'BP_SetbackBoundsWaterfall',
  skypiercer_gallery_shard: 'BP_Skypiercer_GalleryShard_V2',
  sky_pillar: 'BP_SkyPillar',
  sky_platform: 'BP_SkyPlatform',
  sky_platform_blue: 'BP_SkyPlatform_Blue',
  sky_platform_gold: 'BP_SkyPlatform_Gold',
  sky_platform_yellow: 'BP_SkyPlatform_Yellow',
  spectator_drone: 'BP_SpectatorDrone',
  spotlight: 'BP_Spotlight',
  swanboat: 'BP_Swanboat',
  torch_floor: 'BP_Torch_Floor',
  torch_wall: 'BP_Torch_Wall',
  tower_waterfall: 'BP_TowerWaterfall',
  wall_monitor: 'BP_WallMonitor',
  wall_monitor_blimp: 'BP_WallMonitor_Blimp',
  wall_monitor_blimp_peony: 'BP_WallMonitor_Blimp_Peony',
  water_pipe: 'BP_WaterPipe',
  water_pipe_etheral: 'BP_WaterPipe_Etheral',
  water_pipe_rave: 'BP_WaterPipe_Rave',
  window_cleaner: 'BP_WindowCleaner',
  wooden_platform: 'BP_WoodenPlatform',
};

// Dweeb's AllAssetsNew reference map uses raw StaticMesh names. The generated
// manifest is an allowlist derived from JLE - NewObjects.csv, so X-marked and
// unlisted entries cannot be emitted by the editor.
const newObjectCatalog = readJson(path.join(__dirname, 'new-object-catalog.json'));
for (const entry of newObjectCatalog) assetObjects[entry.assetId] = entry.objectName;

function unrealQuaternion(rotation = {}) {
  const pitch = (Number(rotation.pitch) || 0) * Math.PI / 360;
  const yaw = (Number(rotation.yaw) || 0) * Math.PI / 360;
  const roll = (Number(rotation.roll) || 0) * Math.PI / 360;
  const sp = Math.sin(pitch), cp = Math.cos(pitch);
  const sy = Math.sin(yaw), cy = Math.cos(yaw);
  const sr = Math.sin(roll), cr = Math.cos(roll);
  return {
    '$type': 'UAssetAPI.UnrealTypes.FQuat, UAssetAPI',
    X: cr * sp * sy - sr * cp * cy,
    Y: -cr * sp * cy - sr * cp * sy,
    Z: cr * cp * sy - sr * sp * cy,
    W: cr * cp * cy + sr * sp * sy,
  };
}

function setTransform(item, transform) {
  const transformProperty = property(item.Value, 'Transform_');
  const rotation = property(transformProperty.Value, 'Rotation');
  const translation = property(transformProperty.Value, 'Translation');
  const scale = property(transformProperty.Value, 'Scale3D');
  property(rotation.Value, 'Rotation').Value = unrealQuaternion(transform.rotation);
  const position = transform.position || {};
  const scaleValue = transform.scale || { x: 1, y: 1, z: 1 };
  property(translation.Value, 'Translation').Value = {
    '$type': 'UAssetAPI.UnrealTypes.FVector, UAssetAPI',
    X: Number(position.x) || 0,
    Y: Number(position.y) || 0,
    Z: Number(position.z) || 0,
  };
  property(scale.Value, 'Scale3D').Value = {
    '$type': 'UAssetAPI.UnrealTypes.FVector, UAssetAPI',
    X: Number(scaleValue.x) || 1,
    Y: Number(scaleValue.y) || 1,
    Z: Number(scaleValue.z) || 1,
  };
}

function setFirstArrayValue(item, prefix, value) {
  const target = property(item.Value, prefix);
  if (!target || !Array.isArray(target.Value) || target.Value.length === 0) return;
  target.Value[0].Value = value;
}

let arrayValueTemplates = {};
function setArrayValues(item, prefix, values) {
  const target = property(item.Value, prefix);
  if (!target || !Array.isArray(target.Value)) return;
  values.forEach((value, index) => {
    if (!target.Value[index] && arrayValueTemplates[prefix]) {
      const appended = clone(arrayValueTemplates[prefix]);
      appended.Name = String(index);
      appended.ArrayIndex = 0;
      target.Value.push(appended);
    }
    if (target.Value[index]) target.Value[index].Value = value;
  });
}

function clearArrayValue(item, prefix) {
  const target = property(item.Value, prefix);
  if (target && Array.isArray(target.Value)) target.Value = [];
}

function uniformGoalTransform(transform = {}) {
  const scale = transform.scale || {};
  const uniformScale = Number(scale.x ?? scale.y ?? scale.z) || 1;
  return {
    ...transform,
    scale: {
      x: uniformScale,
      y: uniformScale,
      z: uniformScale,
    },
  };
}

function runtimeLaserBeamTransform(transform = {}) {
  const editorScale = transform.scale || {};
  const authoredLengthScale = Math.max(0.001, Math.abs(Number(editorScale.x) || 1));
  return {
    ...transform,
    // BP_LaserBeam traces along its component-local Z axis. JLE authors beam
    // length on X, so map 3 m at scale 1 onto BeamRangeMax=10000 cm.
    scale: { x: 1, y: 1, z: authoredLengthScale * 0.03 },
  };
}

const level = readJson(args['level-data']);
const mapTemplate = readJson(args['map-template']);
const levelDefTemplate = readJson(args['leveldef-template']);
const exampleMap = readJson(args['example-map']);
// Unreal package/object names have strict character rules, while the visible
// title does not. Use the stable level ID for internal assets so punctuation,
// Unicode, and later renames never change the map path or leaderboard identity.
const identity = safeName(level.levelId || level.levelName || level.displayName);
const displayName = String(level.displayName || level.levelName || 'Unnamed Level').trim() || 'Unnamed Level';

replaceToken(mapTemplate, 'MAPNAME', identity);
replaceToken(levelDefTemplate, 'MAPNAME', identity);

const levelDefExport = levelDefTemplate.Exports.find((item) => item.ObjectName === `LevelDef_JLE_${identity}`)
  || levelDefTemplate.Exports[0];
const generatedLevelId =
  String(level.worldSettings?.leaderboardId || level.levelId || `JLE_${identity}`);
property(levelDefExport.Data, 'LevelId').Value = generatedLevelId;
property(levelDefExport.Data, 'ExperienceId').Value = generatedLevelId;
property(levelDefExport.Data, 'ExperienceName').CultureInvariantString = displayName;
property(levelDefExport.Data, 'bHasArcadeToken').Value = (level.objects || []).some((object) => (
  object.assetId === 'arcade_token' || object.assetId === 'arcade_token_rainbow'
));
if (!levelDefTemplate.NameMap.includes(generatedLevelId)) {
  levelDefTemplate.NameMap.push(generatedLevelId);
}

function ensureMedalImport(name) {
  const existing = levelDefTemplate.Imports.findIndex((item) => item.ObjectName === `MedalDef_${name}`);
  if (existing >= 0) return -(existing + 1);
  const packageName = `/Game/Medals/MedalDef_${name}`;
  let packageIndex = levelDefTemplate.Imports.findIndex((item) => item.ObjectName === packageName);
  if (packageIndex < 0) {
    const packageImport = clone(levelDefTemplate.Imports.find((item) => item.ClassName === 'Package'));
    packageImport.ObjectName = packageName;
    packageImport.OuterIndex = 0;
    levelDefTemplate.Imports.push(packageImport);
    packageIndex = levelDefTemplate.Imports.length - 1;
  }
  const medalImport = clone(levelDefTemplate.Imports.find((item) => item.ObjectName === 'MedalDef_DevMedal'));
  medalImport.ObjectName = `MedalDef_${name}`;
  medalImport.OuterIndex = -(packageIndex + 1);
  levelDefTemplate.Imports.push(medalImport);
  for (const value of [packageName, `MedalDef_${name}`]) {
    if (!levelDefTemplate.NameMap.includes(value)) levelDefTemplate.NameMap.push(value);
  }
  return -levelDefTemplate.Imports.length;
}

if (level.medalTimes?.authorTime > 0) {
  const medalTimes = property(levelDefExport.Data, 'MedalTimes');
  const clear = clone(medalTimes.Value[0]);
  const timedTemplate = clone(medalTimes.Value[1]);
  const timedMedal = (name, time, arrayIndex) => {
    const entry = clone(timedTemplate);
    entry.Name = String(arrayIndex);
    property(entry.Value, 'bAnyTime').Value = false;
    property(entry.Value, 'Time').Value = Number(time);
    property(entry.Value, 'Medal').Value = ensureMedalImport(name);
    return entry;
  };
  clear.Name = '0';
  property(clear.Value, 'bAnyTime').Value = false;
  property(clear.Value, 'Time').Value = Number(level.medalTimes.bronzeTime ?? level.medalTimes.silverTime);
  property(clear.Value, 'Medal').Value = ensureMedalImport('Bronze');
  medalTimes.Value = [
    clear,
    timedMedal('Silver', level.medalTimes.silverTime, 1),
    timedMedal('Gold', level.medalTimes.goldTime, 2),
    timedMedal('Diamond', level.medalTimes.platinumTime, 3),
    timedMedal('DevMedal', level.medalTimes.authorTime, 4),
  ];
}

for (const identityProperty of ['LevelId', 'ExperienceId']) {
  if (property(levelDefExport.Data, identityProperty)?.Value !== generatedLevelId) {
    throw new Error(`Generated LevelDef ${identityProperty} did not match ${generatedLevelId}.`);
  }
}

const examplePlacer = exampleMap.Exports.find((item) => item.ObjectName?.startsWith('JLE_ObjectPlacer'));
const examplePlaced = property(examplePlacer.Data, 'PlacedObjects').Value;
arrayValueTemplates = Object.fromEntries(
  ['BoolProperties_', 'IntProperties_', 'FloatProperties_'].map((prefix) => {
    const source = examplePlaced
      .map((item) => property(item.Value, prefix))
      .find((field) => Array.isArray(field?.Value) && field.Value.length > 0);
    return [prefix, source ? clone(source.Value[0]) : null];
  }),
);
const prototypes = new Map(examplePlaced.map((item) => [
  property(item.Value, 'ObjectName_').Value,
  item,
]));
const mapPlacer = mapTemplate.Exports.find((item) => item.ObjectName?.startsWith('JLE_ObjectPlacer'));
const outputArray = property(mapPlacer.Data, 'PlacedObjects');
const blankPlacedObject = outputArray.Value[0];
const placedFieldNames = Object.fromEntries(
  blankPlacedObject.Value.map((field) => [field.Name.split('_')[0], field.Name]),
);

function makeObject(objectName, transform, entityData = {}) {
  // The supercharged Jetmill is a visual class selected from the authored
  // speed. Both variants otherwise share the same data schema.
  if (objectName === 'BP_Jetmill' || objectName === 'BP_Jetmill_Supercharged') {
    objectName = Number(entityData.JetmillSpeed ?? 500) >= 1200
      ? 'BP_Jetmill_Supercharged'
      : 'BP_Jetmill';
  }
  const prototype = prototypes.get(objectName);
  // Most V0.8 additions are plain spawnable actors with no custom property
  // arrays. The supplied template's blank record is their canonical schema.
  // Classes with gameplay data still use their richer legacy prototypes.
  const item = clone(prototype || blankPlacedObject);
  // PlacedObject's generated field GUIDs changed in the V0.8 template. Keep
  // the per-class values from the comprehensive example, but serialize them
  // under the exact field names advertised by the current struct schema.
  for (const field of item.Value) {
    const currentName = placedFieldNames[field.Name.split('_')[0]];
    if (currentName) field.Name = currentName;
  }
  property(item.Value, 'ObjectName_').Value = objectName;
  setTransform(item, objectName === 'BP_LaserBeam' ? runtimeLaserBeamTransform(transform) : transform);
  if (objectName.startsWith('BP_Target_') && objectName !== 'BP_Target_Wall') {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.Shielded ?? false)]);
  }
  if (objectName === 'BP_EnergyPickup') {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.ShowAmmo ?? true)]);
    setArrayValues(item, 'IntProperties_', [Math.max(0, Math.trunc(Number(entityData.Charges ?? entityData.AmountToGive) || 6))]);
  }
  if (objectName.startsWith('BP_ItemOrb_')) {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.RespawnOnUse ?? false)]);
    setArrayValues(item, 'IntProperties_', [Math.max(1, Math.trunc(Number(entityData.Charges) || 1))]);
  }
  if (['BP_LaunchPad_Big', 'BP_LaunchRing', 'BP_BlastJellyContainer',
    'BP_BlastJellyContainer_Evil', 'BP_BlastJellyContainer_Grounded'].includes(objectName)) {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.UsePolarity ?? false), Boolean(entityData.Polarity ?? true)]);
    const fallback = objectName === 'BP_BlastJellyContainer_Evil' ? 2000 : 1000;
    setArrayValues(item, 'FloatProperties_', [Number(entityData.LaunchForce ?? fallback)]);
  }
  if (objectName === 'BP_JetBubble') {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.UsePolarity ?? false), Boolean(entityData.Polarity ?? true)]);
  }
  if (['BP_LaserBeam', 'BP_LaserWall'].includes(objectName)) {
    setArrayValues(item, 'BoolProperties_', [
      Boolean(entityData.UsePolarity ?? false),
      Boolean(entityData.LocalPolarity ?? true),
      Boolean(entityData.Instakill ?? false),
    ]);
    setArrayValues(item, 'FloatProperties_', [Number(entityData.RepellForce ?? 500)]);
  }
  if (objectName === 'BP_DamageBox') {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.KillOnTouch ?? false), Boolean(entityData.KillOnPunch ?? false)]);
    setArrayValues(item, 'FloatProperties_', [Number(entityData.RepellForce ?? 500)]);
  }
  if (objectName === 'BP_Calculator') {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.Polarity ?? true)]);
    setArrayValues(item, 'IntProperties_', [Math.trunc(Number(entityData.Answer ?? 123456))]);
  }
  if (objectName === 'BP_PolarityFlipper') setArrayValues(item, 'BoolProperties_', [Boolean(entityData.Polarity ?? true)]);
  if (objectName === 'BP_HardlightBox') setArrayValues(item, 'BoolProperties_', [Boolean(entityData.PolarityLocal ?? true)]);
  if (objectName === 'BP_Jetmill' || objectName === 'BP_Jetmill_Supercharged') {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.Forwards ?? true), Boolean(entityData.UsePolarity ?? false)]);
    setArrayValues(item, 'FloatProperties_', [Number(entityData.JetmillSpeed ?? 500)]);
  }
  if (objectName === 'BP_HealthPickup') {
    setArrayValues(item, 'IntProperties_', [Math.max(0, Math.trunc(Number(entityData.AmountToGive ?? 100)))]);
  }
  if (objectName === 'BP_SwingBar') {
    setArrayValues(item, 'BoolProperties_', [Boolean(entityData.UsePolarity ?? false), Boolean(entityData.Polarity ?? true)]);
  }
  if (objectName === 'BP_BlockTree') {
    setArrayValues(item, 'IntProperties_', [Math.max(1, Math.trunc(Number(entityData.PunchesToBreak ?? 5)))]);
  }
  if (objectName === 'BP_TimeTrialGoal_Sphere') {
    // Goal range is driven exclusively by the uniformly scaled sphere. The
    // legacy prototype's FloatProperties[0] was CheckpointRadius (800), which
    // would override that scale and make the editor preview misleading.
    clearArrayValue(item, 'FloatProperties_');
  }
  return item;
}

if (!level.playerStart || !level.timeTrialGoal) {
  throw new Error('Level data must contain one Player Start and one Time Trial Goal.');
}
const goalTransforms = Array.isArray(level.timeTrialGoals) && level.timeTrialGoals.length > 0
  ? level.timeTrialGoals
  : [level.timeTrialGoal];
const stagedObjects = [
  // SBPlayerStart must exist before the game resolves its initial pawn spawn.
  // Goals still precede every target/object so their registration remains
  // deterministic. This order makes the first run match subsequent retries.
  {
    priority: 0,
    order: 0,
    objectName: 'SBPlayerStart',
    transform: {
      position: level.playerStart.position,
      rotation: level.playerStart.rotation,
      scale: { x: 1, y: 1, z: 1 },
    },
    entityData: {},
  },
  ...goalTransforms.map((goal, index) => ({
    priority: 1,
    order: index,
    objectName: 'BP_TimeTrialGoal_Sphere',
    transform: uniformGoalTransform(goal),
    entityData: {},
  })),
  ...(level.objects || []).map((object, index) => {
    const objectName = assetObjects[object.assetId];
    if (!objectName) throw new Error(`Unsupported editor assetId: ${object.assetId}`);
    // New editor exports carry the authoritative runtime class explicitly.
    // Older level JSON only has assetId, so retain the catalogue lookup as its
    // backwards-compatible source of truth. Never silently accept a stale
    // editor mapping: it would produce a visually valid editor object that
    // spawns the wrong runtime class in-game.
    const legacyRainbowMapping = object.assetId === 'arcade_token_rainbow'
      && object.runtimeObjectName === 'BP_ArcadeToken_Rainbow'
      && objectName === 'BP_ArcadeToken';
    if (object.runtimeObjectName !== undefined && object.runtimeObjectName !== objectName && !legacyRainbowMapping) {
      throw new Error(
        `Runtime mapping mismatch for ${object.assetId}: editor exported ${object.runtimeObjectName}, expected ${objectName}.`,
      );
    }
    return {
      priority: 2,
      order: index,
      objectName,
      transform: object,
      entityData: object.entityData || {},
    };
  }),
];
const placed = stagedObjects
  .sort((left, right) => left.priority - right.priority || left.order - right.order)
  .map((object) => makeObject(
    object.objectName,
    object.transform,
    object.entityData,
  ));
placed.forEach((item, index) => {
  item.Name = String(index);
  // Array elements are numbered by their synthetic Name. ArrayIndex remains
  // zero in the working UAssetAPI JSON, including elements after index zero.
  item.ArrayIndex = 0;
});
outputArray.Value = placed;

property(mapPlacer.Data, 'Skybox').Value =
  level.worldSettings?.timeOfDay || level.worldSettings?.skybox
  || level.skybox || 'Scenario_MistyHalloween';
property(mapPlacer.Data, 'Environment').Value =
  level.worldSettings?.environment || level.environment || 'Backdrop_Peony_Mountainrange_ProcPlusLandscape';

if ((level.worldSettings?.environment || level.environment) === 'Environment_NewYorkSubway') {
  const subwayLayout = level.worldSettings?.subwayLayout === 'two-layer' ? 'two-layer' : 'roof';
  // JETRUNNER's ModActor resolves a single JLE_ObjectPlacer, so a second
  // placer is ignored even when it is a valid PersistentLevel actor. The
  // existing placer already exposes two level-name slots that the runtime
  // loads independently. Subway scenes use the Environment slot for the base
  // and the Skybox slot for the chosen always-loaded roof extension.
  property(mapPlacer.Data, 'Skybox').Value = subwayLayout === 'two-layer'
    ? 'EnvironmentExtension_NewYorkSubway_SecondFloor'
    : 'EnvironmentExtension_NewYorkSubway_Roof';
}
const worldSettings = mapTemplate.Exports.find((item) => item.ObjectName === 'SBWorldSettings');
property(worldSettings.Data, 'WorldStartingPolarity').Value =
  Math.trunc(Number(level.worldSettings?.worldStartingPolarity) || 0);

const projectRoot = path.resolve(args.output);
const content = path.join(projectRoot, 'JETRUNNER', 'Content', 'Mods', 'CustomLevels');
fs.mkdirSync(content, { recursive: true });
const mapName = `Map_JLE_${identity}`;
const levelDefName = `LevelDef_JLE_${identity}`;
fs.writeFileSync(path.join(content, `${mapName}.json`), `${JSON.stringify(mapTemplate, null, 2)}\n`);
fs.writeFileSync(path.join(content, `${levelDefName}.json`), `${JSON.stringify(levelDefTemplate, null, 2)}\n`);
process.stdout.write(`${JSON.stringify({
  identity,
  mapName,
  levelDefName,
  objectCount: placed.length,
  projectRoot,
  content,
})}\n`);
