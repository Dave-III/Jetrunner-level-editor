#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node Patch-JLETargetInclusion.cjs <ModActor.json> <patched.json>');
}

const asset = JSON.parse(fs.readFileSync(input, 'utf8'));
const addTarget = asset.Exports.find((item) => item.ObjectName === 'AddTarget');
if (!addTarget?.ScriptBytecode) {
  throw new Error('Pretty AddTarget function bytecode was not found.');
}

const serializedFunction = JSON.stringify(addTarget.ScriptBytecode);
if (serializedFunction.includes('"bIncludeInTargetCount"')) {
  fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
  process.exit(0);
}

const type = (name) => `UAssetAPI.Kismet.Bytecode.Expressions.${name}, UAssetAPI`;
const pointer = (field, owner) => ({
  '$type': 'UAssetAPI.Kismet.Bytecode.KismetPropertyPointer, UAssetAPI',
  New: {
    '$type': 'UAssetAPI.UnrealTypes.FFieldPath, UAssetAPI',
    Path: [field],
    ResolvedOwner: owner,
  },
});
const local = (field) => ({
  '$type': type('EX_LocalVariable'),
  Variable: pointer(field, 3),
});

// AddTarget's JetTurret parameter is an SBRemoteActivator. Setting this before
// registration makes the native time-trial component subscribe to the target
// and include its RemoteActivate/RemoteDeactivate changes in the live count.
const includeInTargetCount = {
  '$type': type('EX_Let'),
  Value: pointer('bIncludeInTargetCount', -151),
  Variable: {
    '$type': type('EX_Context'),
    ObjectExpression: local('JetTurret'),
    Offset: 9,
    PropertyType: 0,
    RValuePointer: pointer('bIncludeInTargetCount', -151),
    ContextExpression: {
      '$type': type('EX_InstanceVariable'),
      Variable: pointer('bIncludeInTargetCount', -151),
    },
  },
  Expression: { '$type': type('EX_True') },
};

if (!asset.NameMap.includes('bIncludeInTargetCount')) {
  asset.NameMap.push('bIncludeInTargetCount');
}

// Keep the existing first expression (goal lookup), then configure the target
// before it is added to either the goal or the time-trial arrays.
addTarget.ScriptBytecode.splice(1, 0, includeInTargetCount);
fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
