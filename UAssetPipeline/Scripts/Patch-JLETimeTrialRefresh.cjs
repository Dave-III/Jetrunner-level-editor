#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node Patch-JLETimeTrialRefresh.cjs <ModActor.json> <patched.json>');
}

const asset = JSON.parse(fs.readFileSync(input, 'utf8'));
const addTarget = asset.Exports.find((item) => item.ObjectName === 'AddTarget');
if (!addTarget?.ScriptBytecode) {
  throw new Error('Pretty AddTarget function bytecode was not found.');
}

if (JSON.stringify(addTarget.ScriptBytecode).includes('"ResetTrial"')) {
  fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
  process.exit(0);
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

if (!asset.NameMap.includes('ResetTrial')) {
  asset.NameMap.push('ResetTrial');
}

// Import USBGameComponent_TimeTrial::ResetTrial. The class is import -147 in
// the supplied working ModActor, matching all existing time-trial accesses.
asset.Imports.push({
  '$type': 'UAssetAPI.Import, UAssetAPI',
  ObjectName: 'ResetTrial',
  OuterIndex: -147,
  ClassPackage: '/Script/CoreUObject',
  ClassName: 'Function',
  PackageName: null,
  bImportOptional: false,
});
const resetTrialImport = -asset.Imports.length;

const refreshTimeTrial = {
  '$type': type('EX_Context'),
  ObjectExpression: local('CallFunc_GetComponentByClass_ReturnValue'),
  Offset: 8,
  PropertyType: 0,
  RValuePointer: pointer('', 0),
  ContextExpression: {
    '$type': type('EX_FinalFunction'),
    StackNode: resetTrialImport,
    Parameters: [
      { '$type': type('EX_False') },
    ],
  },
};

const returnIndex = addTarget.ScriptBytecode.findIndex(
  (expression) => expression.$type?.includes('EX_Return'),
);
if (returnIndex < 0) {
  throw new Error('AddTarget has no return expression.');
}

// At this point the target is in Targets and ResettableObjects, its remote
// goal relationship exists, and NumActiveTargets has been updated. Refreshing
// the native trial makes it bind/broadcast this dynamically added target just
// as it does for actors that were present when the map originally initialized.
addTarget.ScriptBytecode.splice(returnIndex, 0, refreshTimeTrial);
fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
