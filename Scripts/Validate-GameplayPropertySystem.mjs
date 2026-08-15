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
requireText(main, 'record.platinumTime < record.authorTime', 'Diamond-after-Author medal ordering');
requireText(main, 'record.goldTime < record.platinumTime', 'Gold-after-Diamond medal ordering');
requireText(main, 'record.silverTime < record.goldTime', 'Silver-after-Gold medal ordering');
requireText(main, 'if (medalError) errors.push(medalError)', 'medal ordering export validation');
requireText(compiler, "'Diamond'", 'Jetrunner Diamond medal runtime name');
requireText(compiler, 'level.medalTimes.platinumTime', 'preserved Jetrunner medal field');
requireText(main, 'refreshAssetPresentation(contextAsset)', 'immediate editor visual refresh');
requireText(main, 'jetmillSpeed >= 1200', 'Jetmill supercharged threshold');
requireText(schema, 'laser_beam:', 'LaserBeam property schema');
requireText(schema, 'laser_wall:', 'LaserWall property schema');
requireText(schema, 'launch_pad:', 'Launch Pad property schema');
requireText(schema, 'jetmill:', 'Jetmill property schema');
console.log('Gameplay property system validation passed.');
