export type GameplayPropertyValue = string | number | boolean;
export type GameplayPropertyKind = 'boolean' | 'integer' | 'number' | 'text';

export interface GameplayPropertyDefinition {
  key: string;
  label: string;
  kind: GameplayPropertyKind;
  defaultValue: GameplayPropertyValue;
  min?: number;
  max?: number;
  step?: number;
}

const booleanProperty = (key: string, label: string, defaultValue: boolean): GameplayPropertyDefinition => ({ key, label, kind: 'boolean', defaultValue });
const integerProperty = (key: string, label: string, defaultValue: number, min = 0, max = 999999): GameplayPropertyDefinition => ({ key, label, kind: 'integer', defaultValue, min, max, step: 1 });
const numberProperty = (key: string, label: string, defaultValue: number, min = -999999, max = 999999, step = 0.1): GameplayPropertyDefinition => ({ key, label, kind: 'number', defaultValue, min, max, step });

const shielded = [booleanProperty('Shielded', 'Invincible bullet shield', false)];
const pickup = [booleanProperty('RespawnOnUse', 'Respawn after use', false), integerProperty('Charges', 'Charges', 1, 1)];
const polarityLaunch = [
  booleanProperty('UsePolarity', 'Affected by polarity', false),
  booleanProperty('Polarity', 'Local polarity', true),
  numberProperty('LaunchForce', 'Launch force', 1000, 0, 100000, 10),
];
const polarityToggle = [
  booleanProperty('UsePolarity', 'Affected by polarity', false),
  booleanProperty('Polarity', 'Local polarity', true),
];

/**
 * Canonical editor property metadata. Keys intentionally use the exact names
 * expected by the level compiler/runtime; labels are editor-facing only.
 */
export const gameplayPropertiesByAsset: Record<string, GameplayPropertyDefinition[]> = {
  energy_pickup: [booleanProperty('ShowAmmo', 'Show ammo amount', true), integerProperty('Charges', 'Ammo', 6, 0)],
  health_pickup: [integerProperty('AmountToGive', 'Health amount', 100, 0)],
  ability_jetleap: pickup,
  ability_jetslam: pickup,
  ability_jetjellybomb: pickup,
  ability_jethook: pickup,
  ability_jetfreeze: pickup,
  ability_jetpolarizer: pickup,
  enemy_plain: shielded,
  enemy_gun: shielded,
  enemy_gatling: shielded,
  enemy_cannon: shielded,
  enemy_laser: shielded,
  blast_jelly_container: polarityLaunch,
  blast_jelly_container_evil: [...polarityLaunch.slice(0, 2), numberProperty('LaunchForce', 'Launch force', 2000, 0, 100000, 10)],
  blast_jelly_container_grounded: polarityLaunch,
  launch_pad: polarityLaunch,
  launch_ring: polarityLaunch,
  swing_bar: polarityToggle,
  jet_bubble: polarityToggle,
  laser_beam: [
    booleanProperty('UsePolarity', 'Affected by polarity', false),
    booleanProperty('LocalPolarity', 'Local polarity', true),
    booleanProperty('Instakill', 'Instant kill', false),
    numberProperty('RepellForce', 'Repel force', 500, 0, 100000, 10),
  ],
  laser_wall: [
    booleanProperty('UsePolarity', 'Affected by polarity', false),
    booleanProperty('LocalPolarity', 'Local polarity', true),
    booleanProperty('Instakill', 'Instant kill', false),
    numberProperty('RepellForce', 'Repel force', 500, 0, 100000, 10),
  ],
  damage_box: [
    booleanProperty('KillOnTouch', 'Kill on touch', false),
    booleanProperty('KillOnPunch', 'Kill on punch', false),
    numberProperty('RepellForce', 'Repel force', 500, 0, 100000, 10),
  ],
  polarity_flipper: [booleanProperty('Polarity', 'Polarity', true)],
  hardlight_box: [booleanProperty('PolarityLocal', 'Local polarity', true)],
  jetmill: [
    booleanProperty('Forwards', 'Move forwards', true),
    booleanProperty('UsePolarity', 'Affected by polarity', false),
    numberProperty('JetmillSpeed', 'Jetmill speed', 500, 0, 100000, 10),
  ],
  jetmill_supercharged: [
    booleanProperty('Forwards', 'Move forwards', true),
    booleanProperty('UsePolarity', 'Affected by polarity', false),
    numberProperty('JetmillSpeed', 'Jetmill speed', 1200, 0, 100000, 10),
  ],
  calculator: [booleanProperty('Polarity', 'Polarity', true), integerProperty('Answer', 'Answer', 123456, -999999, 999999)],
};

export function gameplayPropertiesForAsset(assetId: string) {
  return gameplayPropertiesByAsset[assetId] ?? [];
}

export function defaultGameplayProperties(assetId: string): Record<string, GameplayPropertyValue> {
  return Object.fromEntries(gameplayPropertiesForAsset(assetId).map((property) => [property.key, property.defaultValue]));
}

export function validateGameplayProperty(property: GameplayPropertyDefinition, value: unknown): GameplayPropertyValue {
  if (property.kind === 'boolean') return Boolean(value);
  if (property.kind === 'text') return String(value ?? '');
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${property.label} must be a number.`);
  const bounded = Math.min(property.max ?? Number.POSITIVE_INFINITY, Math.max(property.min ?? Number.NEGATIVE_INFINITY, number));
  return property.kind === 'integer' ? Math.trunc(bounded) : bounded;
}

/** Serialized compiler field stays `platinumTime`; only the editor label is Diamond. */
export const medalPropertyDefinitions = {
  platinumTime: numberProperty('platinumTime', 'Diamond target', 0, 0, 36000, 0.001),
  goldTime: numberProperty('goldTime', 'Gold target', 0, 0, 36000, 0.001),
  silverTime: numberProperty('silverTime', 'Silver target', 0, 0, 36000, 0.001),
  bronzeTime: numberProperty('bronzeTime', 'Bronze target', 0, 0, 36000, 0.001),
} as const;

export const worldPropertyDefinitions = {
  worldStartingPolarity: integerProperty('worldStartingPolarity', 'World starting polarity', 0, 0, 1),
} as const;
