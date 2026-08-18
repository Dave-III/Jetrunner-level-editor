import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const main = read('LevelEditorApp/src/main.ts');
const schema = read('LevelEditorApp/src/gameplay-properties.ts');
const compiler = read('UAssetPipeline/Scripts/Generate-JLEProject.cjs');
const requireText = (text, value, description) => {
  if (!text.includes(value)) throw new Error(`Missing ${description}: ${value}`);
};
const rejectText = (text, value, description) => {
  if (text.includes(value)) throw new Error(`Unexpected ${description}: ${value}`);
};

rejectText(main, 'entity-new-key', 'generic gameplay-property editor');
rejectText(main, "defaultEntityData:", 'duplicate asset-property defaults');
requireText(schema, 'gameplayPropertiesByAsset', 'central gameplay-property schema');
requireText(schema, "worldStartingPolarity", 'world polarity schema');
requireText(main, 'worldStartingPolarity: currentWorldStartingPolarity()', 'world polarity serialization');
requireText(main, 'project.worldStartingPolarity ?? 1', 'legacy world polarity fallback');
requireText(schema, "'Diamond target'", 'Diamond editor terminology');
requireText(main, '<span>Diamond', 'Diamond verification display');
requireText(main, 'return seconds.toFixed(3)', 'three-decimal medal target formatting');
requireText(main, 'input.value = formatMedalTarget(record[medalKey])', 'formatted medal target inputs');
requireText(main, 'record.platinumTime < record.authorTime', 'Diamond-after-Author medal ordering');
requireText(main, 'record.goldTime < record.platinumTime', 'Gold-after-Diamond medal ordering');
requireText(main, 'record.silverTime < record.goldTime', 'Silver-after-Gold medal ordering');
requireText(main, 'if (medalError) errors.push(medalError)', 'medal ordering export validation');
requireText(main, 'normalizedVerificationRecord', 'legacy medal normalization');
requireText(compiler, "'Diamond'", 'Jetrunner Diamond medal runtime name');
requireText(compiler, 'level.medalTimes.platinumTime', 'preserved Jetrunner medal field');
rejectText(schema, 'bronzeTime', 'Bronze medal editor target');
rejectText(main, 'bronzeTime:', 'serialized Bronze medal target');
rejectText(compiler, 'level.medalTimes.bronzeTime', 'Bronze runtime time threshold');
requireText(compiler, "property(clear.Value, 'bAnyTime').Value = true", 'any-time Bronze completion medal');
requireText(compiler, "property(clear.Value, 'Time').Value = 0", 'zeroed Bronze completion time');
requireText(compiler, "ensureMedalImport('Bronze')", 'Bronze completion medal runtime name');
requireText(main, 'refreshAssetPresentation(contextAsset)', 'immediate editor visual refresh');
requireText(main, 'if (transformChanged)', 'property-only transform preservation');
requireText(main, 'jetmillSpeed >= 1200', 'Jetmill supercharged threshold');
requireText(schema, 'laser_beam:', 'LaserBeam property schema');
requireText(schema, 'laser_wall:', 'LaserWall property schema');
requireText(schema, 'launch_pad:', 'Launch Pad property schema');
requireText(schema, 'jetmill:', 'Jetmill property schema');
console.log('Gameplay property system validation passed.');
