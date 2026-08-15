// This is the authoritative editor-side contract for JLE_ObjectPlacer's
// verification dummy. Keep this list deliberately separate from editor
// previews and compiler object names: an ID is playable only when the dummy
// has an explicit handler for it.
const surfaceAssetIds = [
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
  'ice_platform_4x4', 'digital_platform', 'digital_platform_red',
  'virtual_platform_dark', 'virtual_platform_orange', 'virtual_platform_purple',
  'virtual_platform_purple_orange', 'virtual_platform_white',
  'virtual_platform_white_blue', 'virtual_platform_white_gold',
  'virtual_platform_white_orange', 'virtual_platform_white_red',
  'destructible_hard_real_virtual', 'destructible_hard_virtual',
  'destructible_hard_virtual_fragile', 'hardlight_box',
  'jet_water_surface', 'water_body_big',
  'ancient_pillar', 'basekit_house', 'basekit_small_basewall',
  'basekit_small_basewall_alt', 'basekit_small_cube_tower',
  'basekit_tower', 'basekit_trip_trap', 'basekit_trip_trap_no_slope',
  'basekit_small_house', 'basekit_small_house_alt',
  'basekit_small_platform', 'basekit_small_platform_alt_1',
  'basekit_small_platform_alt_2', 'basekit_small_platform_alt_3',
  'basekit_small_hollow_cylinder', 'basekit_small_ramp',
  'concrete_pillar', 'installation_pillar', 'sky_pillar',
  'sky_platform', 'sky_platform_blue', 'sky_platform_gold',
  'sky_platform_yellow', 'wooden_platform',
];

// All approved V0.9 static meshes use JLE_ObjectPlacer's generic
// PlacedObject record. The compiler uses this same catalogue and falls back
// to that blank record when an object does not require a gameplay prototype.
// Importing the single approved catalogue keeps each AssetId paired with its
// canonical runtime ObjectName rather than treating an ID allowlist as proof.
const approvedStaticCatalogue = require('../src/new-object-catalog.json');
const genericStaticMeshMappings = Object.freeze(Object.fromEntries(
  approvedStaticCatalogue.map(({ assetId, objectName }) => [assetId, objectName]),
));

const verificationObjectAssetIds = [
  ...surfaceAssetIds,
  ...Object.keys(genericStaticMeshMappings),
  'launch_pad', 'ability_jetfreeze', 'ability_jethook', 'ability_jetjellybomb',
  'ability_jetleap', 'ability_jetpolarizer', 'ability_jetslam',
  'energy_pickup', 'enemy_plain', 'enemy_gun', 'enemy_gatling',
  'enemy_cannon', 'enemy_laser', 'enemy_wall', 'enemy_dim',
  'blast_jelly_container', 'blast_jelly_container_evil',
  'blast_jelly_container_grounded', 'block_tree', 'calculator',
  'damage_box', 'health_pickup', 'jet_bubble', 'jetmill',
  'jetmill_supercharged', 'juan', 'laser_beam', 'laser_wall',
  'launch_ring', 'polarity_flipper', 'statue_the_man', 'swing_bar',
  'arcade_token', 'arcade_token_rainbow', 'artic_spotlight',
  'artic_spotlight_child', 'bg_flood_light', 'chinese_lantern',
  'crane', 'digital_audience_gallery', 'digital_audience_gallery_synth',
  'digital_audience_gallery_white', 'drone', 'elevator', 'kill_cloud',
  'ladder', 'lars', 'lcd_screen', 'destructible_leaf_pile',
  'light_pole', 'light_rims', 'light_rims_arrow_straight', 'monorail',
  'peony_spectating_box', 'rio_gallery_shard',
  'setback_bounds_waterfall', 'skypiercer_gallery_shard',
  'spectator_drone', 'spotlight', 'swanboat', 'torch_floor',
  'torch_wall', 'tower_waterfall', 'wall_monitor',
  'wall_monitor_blimp', 'wall_monitor_blimp_peony', 'water_pipe',
  'water_pipe_etheral', 'water_pipe_rave', 'window_cleaner',
];

// These are placed through mandatory map actors, not the generic object
// array, so the generic verifier never checks them in allowedAssetIds.
const verificationSpecialAssetIds = ['player_start', 'time_trial_goal'];

module.exports = {
  surfaceAssetIds,
  genericStaticMeshMappings,
  verificationObjectAssetIds,
  verificationSpecialAssetIds,
  verificationSupportedAssetIds: [...new Set([
    ...verificationObjectAssetIds,
    ...verificationSpecialAssetIds,
  ])],
};
