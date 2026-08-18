'use strict';

// Manual runtime evidence is deliberately separate from static catalogue and
// verifier support. A string in a mapping table is not proof that the shipped
// cooked ModActor can spawn it.
const runtimeAssetStatus = Object.freeze({
  digital_platform_red: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No authoritative JLE_ObjectPlacer mapping for BP_DigitalPlatform_Red exists in the shipped v0.9.2 framework.' },
  static_reservoirbuildings_building1: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_ReservoirBuildings_Building1 mapping exists in the authoritative v0.9.2 ModActor.' },
  static_reservoirbuildings_building2: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_ReservoirBuildings_Building2 mapping exists in the authoritative v0.9.2 ModActor.' },
  static_reservoirbuildings_building3: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_ReservoirBuildings_Building3 mapping exists in the authoritative v0.9.2 ModActor.' },
  static_stageslope_filled: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_StageSlope_Filled mapping exists in the authoritative v0.9.2 ModActor.' },
  static_stageslope_stair: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_StageSlope_Stair mapping exists in the authoritative v0.9.2 ModActor.' },
  static_strut_6x6: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_Strut_6x6 mapping exists in the authoritative v0.9.2 ModActor.' },
  static_strut_1x4_wall: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_Strut_1x4_Wall mapping exists in the authoritative v0.9.2 ModActor.' },
  static_toweredgecapdetail_1: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_TowerEdgeCapDetail_1 mapping exists in the authoritative v0.9.2 ModActor.' },
  static_toweredgedetail_1: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_TowerEdgeDetail_1 mapping exists in the authoritative v0.9.2 ModActor.' },
  static_towermidwalldetail_1: { runtimeSpawnStatus: 'failed', manualTestStatus: 'failed', reason: 'No SM_TowerMidWallDetail_1 mapping exists in the authoritative v0.9.2 ModActor.' },
  bg_flood_light: { runtimeSpawnStatus: 'untested', manualTestStatus: 'pending-retest', reason: 'BP_BGFloodLight_C exists in v0.9.2; retest after restoring the unmodified framework.' },
});

const runtimeFailedAssetIds = Object.freeze(Object.entries(runtimeAssetStatus)
  .filter(([, status]) => status.runtimeSpawnStatus === 'failed')
  .map(([assetId]) => assetId));

module.exports = { runtimeAssetStatus, runtimeFailedAssetIds };
