'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const source = path.join(root, '.codex-tmp', 'batch7-audio', 'Current_ModActor.json');
const patcher = path.join(root, 'UAssetPipeline', 'Scripts', 'Patch-JLEDynamicTargetLifecycle.cjs');
if (!fs.existsSync(source)) throw new Error('Current ModActor pretty JSON fixture is unavailable.');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'jle-tree-reset-'));
const output = path.join(temporary, 'ModActor.patched.json');
const result = spawnSync(process.execPath, [patcher, source, output], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Framework patch failed.');
const asset = JSON.parse(fs.readFileSync(output, 'utf8'));
const importIndex = asset.Imports.findIndex((item) => item.ObjectName === 'AddRuntimeResettableActor');
if (importIndex < 0) throw new Error('Native AddRuntimeResettableActor import is missing.');
const stackNode = -(importIndex + 1);
const fn = asset.Exports.find((item) => item.ObjectName === 'AddResettableObject');
if (!fn?.ScriptBytecode?.some((expression) => expression.StackNode === stackNode)) {
  throw new Error('AddResettableObject does not register its Object with the native runtime reset helper.');
}
const call = fn.ScriptBytecode.find((expression) => expression.StackNode === stackNode);
if (!JSON.stringify(call).includes('"Object"')) throw new Error('Runtime registration does not pass the spawned resettable Object.');
fs.rmSync(temporary, { recursive: true, force: true });
console.log('Minecraft Tree runtime registration patch validation passed.');
