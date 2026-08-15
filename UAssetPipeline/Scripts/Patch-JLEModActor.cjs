#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node Patch-JLEModActor.cjs <ModActor.json> <patched.json>');
}

const asset = JSON.parse(fs.readFileSync(input, 'utf8'));
const addTarget = asset.Exports.find((item) => item.ObjectName === 'AddTarget');
if (!addTarget) throw new Error('AddTarget function export was not found.');

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
const instance = (field, owner) => ({
  '$type': type('EX_InstanceVariable'),
  Variable: pointer(field, owner),
});
const contextProperty = (objectExpression, field, owner) => ({
  '$type': type('EX_Context'),
  ObjectExpression: objectExpression,
  Offset: 9,
  PropertyType: 0,
  RValuePointer: pointer(field, owner),
  ContextExpression: instance(field, owner),
});

const goalReference = local('CallFunc_GetActorOfClass_ReturnValue');
const timeTrialReference = local('CallFunc_GetComponentByClass_ReturnValue');

const lockGoal = {
  '$type': type('EX_Let'),
  Value: pointer('bUnlocked', -154),
  Variable: contextProperty(goalReference, 'bUnlocked', -154),
  Expression: { '$type': type('EX_False') },
};

const currentActiveCount = contextProperty(
  timeTrialReference,
  'NumActiveTargets',
  -147,
);
const incrementActiveCount = {
  '$type': type('EX_Let'),
  Value: pointer('NumActiveTargets', -147),
  Variable: contextProperty(timeTrialReference, 'NumActiveTargets', -147),
  Expression: {
    '$type': type('EX_CallMath'),
    StackNode: -170,
    Parameters: [
      currentActiveCount,
      { '$type': type('EX_IntConst'), Value: 1 },
    ],
  },
};

const returnIndex = addTarget.ScriptBytecode.findIndex(
  (expression) => expression.$type?.includes('EX_Return'),
);
if (returnIndex < 0) throw new Error('AddTarget has no return expression.');

for (const requiredName of [
  'bUnlocked',
  'NumActiveTargets',
]) {
  if (!asset.NameMap.includes(requiredName)) asset.NameMap.push(requiredName);
}

addTarget.ScriptBytecode.splice(
  returnIndex,
  0,
  lockGoal,
  incrementActiveCount,
);
fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
