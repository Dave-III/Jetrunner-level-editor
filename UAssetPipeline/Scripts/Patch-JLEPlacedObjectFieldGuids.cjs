#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error('Usage: node Patch-JLEPlacedObjectFieldGuids.cjs <input.json> <output.json>');
  process.exit(2);
}

const replacements = new Map([
  ['ObjectName_2_306D1B814881C99762FC4BAA40A7538D', 'ObjectName_9_6410CAE949534E802EE78BBA1C35E0CB'],
  ['Transform_4_4EB916A54205CC642149988BFE9705AD', 'Transform_5_DB89AE104A1AFBFE0CA704908E167E4E'],
  ['BoolProperties_6_82F23EC2480B5D5C038090B8CE9AE023', 'BoolProperties_48_CC042C004A2683E3A1A55E9CAAB66F57'],
  ['IntProperties_8_8E6FDFD44D58D77D7A30C2A2C13D89CC', 'IntProperties_51_91EE3B334F38BA7337DB2780F65346FC'],
  ['FloatProperties_10_9E362F6045FE869FFEB33F8DC6881A1E', 'FloatProperties_54_646D23C046FF1B747BB171ABBA8AA12D'],
]);

let json = fs.readFileSync(path.resolve(inputPath), 'utf8');
const counts = {};

for (const [source, target] of replacements) {
  const matches = json.split(source).length - 1;
  if (matches === 0) {
    throw new Error(`Expected loader field reference was not found: ${source}`);
  }
  counts[source] = matches;
  json = json.split(source).join(target);
}

for (const source of replacements.keys()) {
  if (json.includes(source)) {
    throw new Error(`Loader still contains obsolete field reference: ${source}`);
  }
}

fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(path.resolve(outputPath), json, 'utf8');
console.log(JSON.stringify({ output: path.resolve(outputPath), replacements: counts }, null, 2));
