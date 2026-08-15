#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node Patch-JLENativeTargetLink.cjs <ModActor.json> <patched.json>');
}

const asset = JSON.parse(fs.readFileSync(input, 'utf8'));
const addTarget = asset.Exports.find((item) => item.ObjectName === 'AddTarget');
if (!addTarget?.ScriptBytecode) {
  throw new Error('Pretty AddTarget function bytecode was not found.');
}

const type = (name) => `UAssetAPI.Kismet.Bytecode.Expressions.${name}, UAssetAPI`;
const pointer = (field, owner) => ({
  '$type': 'UAssetAPI.Kismet.Bytecode.KismetPropertyPointer, UAssetAPI',
  New: {
    '$type': 'UAssetAPI.UnrealTypes.FFieldPath, UAssetAPI',
    Path: field ? [field] : [],
    ResolvedOwner: owner,
  },
});
const local = (field) => ({
  '$type': type('EX_LocalVariable'),
  Variable: pointer(field, 3),
});

if (!asset.NameMap.includes('AddRemoteActor')) asset.NameMap.push('AddRemoteActor');
asset.Imports.push({
  '$type': 'UAssetAPI.Import, UAssetAPI',
  ObjectName: 'AddRemoteActor',
  OuterIndex: -151, // ASBRemoteActivator
  ClassPackage: '/Script/CoreUObject',
  ClassName: 'Function',
  PackageName: null,
  bImportOptional: false,
});
const addRemoteActorImport = -asset.Imports.length;

const nativeLink = {
  '$type': type('EX_Context'),
  ObjectExpression: local('JetTurret'),
  Offset: 8,
  PropertyType: 0,
  RValuePointer: pointer('', 0),
  ContextExpression: {
    '$type': type('EX_FinalFunction'),
    StackNode: addRemoteActorImport,
    Parameters: [
      local('CallFunc_GetActorOfClass_ReturnValue'),
    ],
  },
};

// The original Blueprint directly mutates RuntimeRemoteActors and
// RuntimeActivators. That bypasses ASBRemoteActivator::AddRemoteActor, which
// synchronizes the reverse relationship and applies the activator's current
// state through ISBRemoteActivationInterface.
const runtimeRemoteIndex = addTarget.ScriptBytecode.findIndex((expression) =>
  JSON.stringify(expression).includes('"RuntimeRemoteActors"'),
);
const runtimeActivatorIndex = addTarget.ScriptBytecode.findIndex((expression) =>
  JSON.stringify(expression).includes('"RuntimeActivators"'),
);
if (runtimeRemoteIndex < 0 || runtimeActivatorIndex !== runtimeRemoteIndex + 1) {
  throw new Error('Expected adjacent private runtime-array writes were not found.');
}
addTarget.ScriptBytecode.splice(runtimeRemoteIndex, 2, nativeLink);

// Directly changing this private field suppresses TimeTrialGoal's
// OnLockStateChanged event. Let the native remote-activation call own it.
const unlockedIndex = addTarget.ScriptBytecode.findIndex((expression) =>
  JSON.stringify(expression).includes('"bUnlocked"'),
);
if (unlockedIndex >= 0) addTarget.ScriptBytecode.splice(unlockedIndex, 1);

fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
