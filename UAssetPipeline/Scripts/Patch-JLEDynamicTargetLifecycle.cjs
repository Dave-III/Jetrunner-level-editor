#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error(
    'Usage: node Patch-JLEDynamicTargetLifecycle.cjs <ModActor.json> <patched.json>',
  );
}

const asset = JSON.parse(fs.readFileSync(input, 'utf8'));
const addTarget = asset.Exports.find((item) => item.ObjectName === 'AddTarget');
const addResettableObject = asset.Exports.find((item) => item.ObjectName === 'AddResettableObject');
if (!addTarget?.ScriptBytecode) {
  throw new Error('Pretty AddTarget function bytecode was not found.');
}
if (!addResettableObject?.ScriptBytecode) {
  throw new Error('Pretty AddResettableObject function bytecode was not found.');
}

const existingRuntimeImportIndex = asset.Imports.findIndex(
  (item) => item.ObjectName === 'AddRuntimeResettableActor',
);
if (existingRuntimeImportIndex >= 0
    && addResettableObject.ScriptBytecode.some(
      (expression) => expression.StackNode === -(existingRuntimeImportIndex + 1),
    )) {
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
const local = (field, owner = 3) => ({
  '$type': type('EX_LocalVariable'),
  Variable: pointer(field, 3),
});

if (!asset.NameMap.includes('SBGameModeFunctionLibrary')) {
  asset.NameMap.push('SBGameModeFunctionLibrary');
}
if (!asset.NameMap.includes('AddRuntimeResettableActor')) {
  asset.NameMap.push('AddRuntimeResettableActor');
}
for (const localName of ['JetTurret', 'CallFunc_GetActorOfClass_ReturnValue', 'Object']) {
  if (!asset.NameMap.includes(localName)) asset.NameMap.push(localName);
}

let addRuntimeImport = existingRuntimeImportIndex >= 0 ? -(existingRuntimeImportIndex + 1) : 0;
if (!addRuntimeImport) {
  const scriptPackageIndex = asset.Imports.findIndex(
    (item) => item.ObjectName === '/Script/JETRUNNER',
  );
  if (scriptPackageIndex < 0) throw new Error('/Script/JETRUNNER package import was not found.');
  asset.Imports.push({
    '$type': 'UAssetAPI.Import, UAssetAPI',
    ObjectName: 'SBGameModeFunctionLibrary',
    OuterIndex: -(scriptPackageIndex + 1),
    ClassPackage: '/Script/CoreUObject',
    ClassName: 'Class',
    PackageName: null,
    bImportOptional: false,
  });
  const libraryImport = -asset.Imports.length;
  asset.Imports.push({
    '$type': 'UAssetAPI.Import, UAssetAPI',
    ObjectName: 'AddRuntimeResettableActor',
    OuterIndex: libraryImport,
    ClassPackage: '/Script/CoreUObject',
    ClassName: 'Function',
    PackageName: null,
    bImportOptional: false,
  });
  addRuntimeImport = -asset.Imports.length;
}

const addRuntimeActor = (actorExpression) => ({
  '$type': type('EX_CallMath'),
  StackNode: addRuntimeImport,
  Parameters: [
    { '$type': type('EX_Self') },
    actorExpression,
  ],
});

// AddRemoteActor is the only context call in the linked AddTarget before the
// GameState lookup. Register both ends immediately after that relationship is
// established. The shipped helper safely updates the component's private
// RuntimeResettableActors list; writing that array directly caused a startup
// access violation.
const gameStateIndex = addTarget.ScriptBytecode.findIndex((expression) =>
  JSON.stringify(expression).includes('"CallFunc_GetGameState_ReturnValue"'),
);
if (gameStateIndex < 0) throw new Error('AddTarget GameState lookup was not found.');

addTarget.ScriptBytecode.splice(
  gameStateIndex,
  0,
  addRuntimeActor(local('CallFunc_GetActorOfClass_ReturnValue')),
  addRuntimeActor(local('JetTurret')),
);

// Every generic resettable (including BP_BlockTree) arrives here after spawn.
// Register the actual actor through the public native helper. This is safer
// than writing USBGameComponent_TimeTrial's private array and fixes actors
// spawned after the trial component completed its initial world scan.
if (!addResettableObject.ScriptBytecode.some((expression) => expression.StackNode === addRuntimeImport)) {
  const returnIndex = addResettableObject.ScriptBytecode.findIndex(
    (expression) => expression.$type?.includes('EX_Return'),
  );
  if (returnIndex < 0) throw new Error('AddResettableObject has no return expression.');
  addResettableObject.ScriptBytecode.splice(
    returnIndex,
    0,
    addRuntimeActor(local('Object', 2)),
  );
}

fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
