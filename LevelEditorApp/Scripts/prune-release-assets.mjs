import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const appRoot = path.resolve(import.meta.dirname, '..');
const distRoot = path.join(appRoot, 'dist');
const visualRoot = path.join(distRoot, 'asset-visuals');
const referenced = new Set();
const textualFiles = [];

async function collectReferences(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (filePath !== visualRoot) await collectReferences(filePath);
      continue;
    }
    if (!/\.(?:js|json|html|css)$/i.test(entry.name)) continue;
    const contents = await fs.readFile(filePath, 'utf8');
    textualFiles.push({ filePath, contents });
    for (const match of contents.matchAll(/asset-visuals\/([^"'\\?]+\.(?:glb|png|jpe?g|webp))/gi)) {
      referenced.add(decodeURIComponent(match[1]).replaceAll('\\', '/').toLowerCase());
    }
  }
}

await collectReferences(distRoot);
let removedFiles = 0;
let removedBytes = 0;
async function pruneDirectory(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await pruneDirectory(filePath);
      continue;
    }
    if (!/\.(?:glb|png|jpe?g|webp)$/i.test(entry.name)) continue;
    const relative = path.relative(visualRoot, filePath).replaceAll('\\', '/').toLowerCase();
    if (referenced.has(relative)) continue;
    const stat = await fs.stat(filePath);
    await fs.rm(filePath);
    removedFiles += 1;
    removedBytes += stat.size;
  }
}
await pruneDirectory(visualRoot);

const hashes = new Map();
async function deduplicateDirectory(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await deduplicateDirectory(filePath);
      continue;
    }
    if (!/\.(?:glb|png|jpe?g|webp)$/i.test(entry.name)) continue;
    const bytes = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(bytes).digest('hex');
    const relative = path.relative(visualRoot, filePath).replaceAll('\\', '/');
    const canonical = hashes.get(hash);
    if (!canonical) {
      hashes.set(hash, relative);
      continue;
    }
    for (const textFile of textualFiles) {
      textFile.contents = textFile.contents.replaceAll(`asset-visuals/${relative}`, `asset-visuals/${canonical}`);
    }
    await fs.rm(filePath);
    removedFiles += 1;
    removedBytes += bytes.length;
  }
}
await deduplicateDirectory(visualRoot);
await Promise.all(textualFiles.map(({ filePath, contents }) => fs.writeFile(filePath, contents)));

console.log(JSON.stringify({ referencedGlbs: referenced.size, removedFiles, removedBytes }));
