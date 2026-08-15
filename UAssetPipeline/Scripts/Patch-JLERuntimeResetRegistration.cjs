#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error(
    'Usage: node Patch-JLERuntimeResetRegistration.cjs <ModActor.json> <patched.json>',
  );
}

const asset = JSON.parse(fs.readFileSync(input, 'utf8'));

function replaceString(value, from, to) {
  if (value === from) return to;
  if (Array.isArray(value)) {
    return value.map((item) => replaceString(item, from, to));
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      value[key] = replaceString(value[key], from, to);
    }
  }
  return value;
}

function addRuntimeRegistration(functionName) {
  const fn = asset.Exports.find((item) => item.ObjectName === functionName);
  if (!fn?.ScriptBytecode) {
    throw new Error(`${functionName} function bytecode was not found.`);
  }

  const serialized = JSON.stringify(fn.ScriptBytecode);
  if (serialized.includes('"RuntimeResettableActors"')) return;

  const resettableIndex = fn.ScriptBytecode.findIndex((expression) =>
    JSON.stringify(expression).includes('"ResettableObjects"'),
  );
  if (resettableIndex < 0) {
    throw new Error(`${functionName} does not add an actor to ResettableObjects.`);
  }

  // The existing expression already invokes Array_Add with the correct
  // component and actor. Reusing it for the runtime array avoids introducing
  // another function import or changing the local-variable layout.
  const runtimeAdd = structuredClone(fn.ScriptBytecode[resettableIndex]);
  replaceString(runtimeAdd, 'ResettableObjects', 'RuntimeResettableActors');
  fn.ScriptBytecode.splice(resettableIndex + 1, 0, runtimeAdd);
}

if (!asset.NameMap.includes('RuntimeResettableActors')) {
  asset.NameMap.push('RuntimeResettableActors');
}

// Dynamic actors are spawned after USBGameComponent_TimeTrial has built its
// runtime list. Register both targets and the goal/resettable actors directly
// so ResetTrial can bind their native lifecycle and completion notifications.
addRuntimeRegistration('AddTarget');
addRuntimeRegistration('AddResettableObject');

fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
