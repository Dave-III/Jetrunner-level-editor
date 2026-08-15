#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const [input, expressionCountText, output, functionName = 'ExecuteUbergraph_ModActor'] =
  process.argv.slice(2);
if (!input || !expressionCountText || !output) {
  throw new Error(
    'Usage: node Create-JLEBytecodePrefix.cjs <asset.json> <expression-count> <output.json> [function-name]',
  );
}

const expressionCount = Number(expressionCountText);
if (!Number.isInteger(expressionCount) || expressionCount < 0) {
  throw new Error('expression-count must be a non-negative integer.');
}

const asset = JSON.parse(fs.readFileSync(input, 'utf8'));
const ubergraph = asset.Exports.find(
  (item) => item.ObjectName === functionName,
);
if (!ubergraph?.ScriptBytecode) {
  throw new Error(`${functionName} bytecode was not found.`);
}

const endOfScript = {
  '$type': 'UAssetAPI.Kismet.Bytecode.Expressions.EX_EndOfScript, UAssetAPI',
};
ubergraph.ScriptBytecode = [
  ...ubergraph.ScriptBytecode.slice(0, expressionCount),
  endOfScript,
];
fs.writeFileSync(output, `${JSON.stringify(asset, null, 2)}\n`);
