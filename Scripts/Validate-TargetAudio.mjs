import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const generatorPath = join(root, 'UAssetPipeline', 'Scripts', 'Generate-JLEProject.cjs');
const converter = join(root, 'UAssetPipeline', 'Tools', 'UAssetGUI', 'UAssetGUI.exe');
const targetDirectory = join(root, '.asset-inspect', 'JETRUNNER', 'Content', 'Hazards', 'Targets');
const generator = readFileSync(generatorPath, 'utf8');
const expectedMappings = new Map([
  ['enemy_plain', 'BP_Target_Plain'],
  ['enemy_gun', 'BP_Target_Gun'],
  ['enemy_gatling', 'BP_Target_Gatling'],
  ['enemy_cannon', 'BP_Target_Cannon'],
  ['enemy_laser', 'BP_Target_Laser'],
  ['enemy_wall', 'BP_Target_Wall'],
]);

for (const [assetId, objectName] of expectedMappings) {
  const mapping = new RegExp(`\\b${assetId}:\\s*['\"]${objectName}['\"]`);
  if (!mapping.test(generator)) throw new Error(`${assetId} does not map to canonical class ${objectName}.`);
}

const targetPropertyBlock = generator.match(
  /if \(objectName\.startsWith\('BP_Target_'\)[\s\S]*?\n  }\n  if \(objectName === 'BP_EnergyPickup'\)/,
)?.[0] || '';
if (!targetPropertyBlock.includes('Shielded')) throw new Error('Canonical target Shielded property mapping is missing.');
if (/Audio|Sound|EventTag_Destroy/.test(targetPropertyBlock)) {
  throw new Error('Target audio must remain class-driven; speculative audio fields were found in PlacedObject serialization.');
}

if (!existsSync(converter) || !existsSync(join(targetDirectory, 'BP_TargetBase.uasset'))) {
  throw new Error('The bundled converter or extracted target reference assets are unavailable.');
}

const working = mkdtempSync(join(tmpdir(), 'jle-target-audio-'));
try {
  const classes = ['BP_TargetBase', ...new Set(expectedMappings.values())];
  const report = [];
  for (const className of classes) {
    const source = join(targetDirectory, `${className}.uasset`);
    const destination = join(working, `${className}.json`);
    const conversion = spawnSync(converter, [
      'tojson', source, destination, 'VER_UE5_6', 'JETRUNNER',
    ], { encoding: 'utf8', windowsHide: true });
    if (conversion.error || conversion.status !== 0 || !existsSync(destination)) {
      throw new Error(`Could not inspect ${className}: ${conversion.error?.message || conversion.stderr || `exit ${conversion.status}`}`);
    }
    const asset = JSON.parse(readFileSync(destination, 'utf8'));
    const serialized = JSON.stringify(asset);
    if (className === 'BP_TargetBase') {
      if (!serialized.includes('BPC_AudioTargets')) throw new Error('BP_TargetBase lacks BPC_AudioTargets.');
      if (!serialized.includes('Sound.Target.Destroy')) throw new Error('BP_TargetBase lacks its canonical destroy sound tag.');
    }
    const destroyEvent = serialized.match(/Event\.Target\.Destroy\.[A-Za-z0-9_]+/)?.[0] || null;
    if (className !== 'BP_TargetBase' && className !== 'BP_Target_Wall' && !destroyEvent) {
      throw new Error(`${className} lacks its canonical Event.Target.Destroy tag.`);
    }
    report.push({
      className,
      destroyEvent,
      classDrivenAudio: className === 'BP_TargetBase'
        ? serialized.includes('Sound.Target.Destroy')
        : Boolean(destroyEvent),
    });
  }
  console.log(JSON.stringify({
    result: 'Target audio mapping valid',
    mechanism: 'Canonical target Blueprint class -> BPC_AudioTargets -> gameplay audio tags',
    serializedAudioProperties: 0,
    targets: report,
  }, null, 2));
} finally {
  rmSync(working, { recursive: true, force: true });
}
