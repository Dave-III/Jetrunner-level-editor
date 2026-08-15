import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [exportsArg, visualsArg] = process.argv.slice(2);
if (!exportsArg || !visualsArg) throw new Error('Usage: node Bind-FModelGlbTextures.mjs <exports> <visuals>');
const exportsRoot = path.resolve(exportsArg);
const visualsRoot = path.resolve(visualsArg);
const walk = (root, ext, out = []) => {
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, e.name);
    if (e.isDirectory()) walk(file, ext, out);
    else if (e.name.toLowerCase().endsWith(ext)) out.push(file);
  }
  return out;
};
const indexFiles = (files) => {
  const index = new Map();
  for (const file of files) {
    const key = path.basename(file, path.extname(file)).toLowerCase();
    const values = index.get(key) ?? [];
    values.push(file);
    values.sort((a, b) => a.length - b.length || a.localeCompare(b));
    index.set(key, values);
  }
  return index;
};
const jsonIndex = indexFiles(walk(exportsRoot, '.json'));
const pngIndex = indexFiles(walk(exportsRoot, '.png'));
const priorities = ['Base Color', 'PM_Diffuse', 'Albedo', 'BaseColor', 'Diffuse', 'Emissive'];
const ignored = /normal|mra|specular|rough|metal|mask|dirt|imperfection|opacity/i;
const knownInheritedTextures = [
  [/surface[_ ]?ice/i, 't_ice00_c_srgb'],
];
const cache = new Map();

function chooseAuthoredColor(colors = {}) {
  const entries = Object.entries(colors);
  const preferred = /base\s*color|basecolor|diffuse|albedo|color|colour|tint|param/i;
  const selected = entries.find(([name]) => preferred.test(name)) ?? entries[0];
  if (!selected) return null;
  const value = selected[1] ?? {};
  const rgb = [value.R, value.G, value.B].map(Number);
  if (rgb.some((component) => !Number.isFinite(component))) return null;
  return [...rgb.map((component) => Math.max(0, Math.min(1, component))), 1];
}

function resolveMaterial(materialName) {
  if (!materialName) return null;
  const key = materialName.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  let result = { texture: null, color: null };
  const candidateKeys = new Set([key]);
  if (key.startsWith('mi_')) candidateKeys.add(`m_${key.slice(3).replace(/_inst$/i, '')}`);
  if (key.endsWith('_inst')) candidateKeys.add(key.slice(0, -5));
  const metadataFiles = [...candidateKeys].flatMap((candidate) => jsonIndex.get(candidate) ?? []);
  for (const metadataFile of metadataFiles) {
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
      const textures = metadata.Textures ?? {};
      result.color ??= chooseAuthoredColor(metadata.Parameters?.Colors);
      const refs = [
        ...priorities.map((name) => textures[name]).filter(Boolean),
        ...Object.entries(textures).filter(([name]) => !ignored.test(name)).map(([, value]) => value),
      ];
      for (const ref of refs) {
        const objectName = String(ref).split('.').at(-1).split('/').at(-1).toLowerCase();
        result.texture = (pngIndex.get(objectName) ?? [])[0] ?? null;
        if (result.texture) break;
      }
    } catch { /* Non-material JSON export. */ }
    if (result.texture) break;
  }
  if (!result.texture) {
    const inherited = knownInheritedTextures.find(([pattern]) => pattern.test(materialName));
    if (inherited) result.texture = (pngIndex.get(inherited[1]) ?? [])[0] ?? null;
  }
  cache.set(key, result);
  return result;
}

function readGlb(file) {
  const input = fs.readFileSync(file);
  if (input.readUInt32LE(0) !== 0x46546c67 || input.readUInt32LE(4) !== 2) throw new Error(`Unsupported GLB: ${file}`);
  const chunks = [];
  for (let offset = 12; offset < input.length;) {
    const length = input.readUInt32LE(offset);
    const type = input.readUInt32LE(offset + 4);
    chunks.push({ type, data: input.subarray(offset + 8, offset + 8 + length) });
    offset += 8 + length;
  }
  const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
  const json = JSON.parse(jsonChunk.data.toString('utf8').replace(/[\u0000 ]+$/g, ''));
  return { json, chunks: chunks.filter((chunk) => chunk !== jsonChunk) };
}

function writeGlb(file, json, chunks) {
  let jsonData = Buffer.from(JSON.stringify(json));
  const padding = (4 - jsonData.length % 4) % 4;
  if (padding) jsonData = Buffer.concat([jsonData, Buffer.alloc(padding, 0x20)]);
  const all = [{ type: 0x4e4f534a, data: jsonData }, ...chunks];
  const total = 12 + all.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
  const output = Buffer.alloc(total);
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(total, 8);
  let offset = 12;
  for (const chunk of all) {
    output.writeUInt32LE(chunk.data.length, offset); output.writeUInt32LE(chunk.type, offset + 4);
    chunk.data.copy(output, offset + 8); offset += 8 + chunk.data.length;
  }
  fs.writeFileSync(file, output);
}

let filesChanged = 0, slotsBound = 0, slotsColored = 0, slotsUnresolved = 0;
const copied = new Set();
// Do not delete hashed shared textures here. The binding pass is intentionally
// idempotent, and existing GLBs may already reference those files when a user
// refreshes only part of the export library.
const glbs = fs.readdirSync(visualsRoot).filter((name) => name.endsWith('.glb'));
for (const name of glbs) {
  const glbFile = path.join(visualsRoot, name);
  const { json, chunks } = readGlb(glbFile);
  let changed = false;
  for (const [materialIndex, material] of (json.materials ?? []).entries()) {
    material.pbrMetallicRoughness ??= {};
    if (material.pbrMetallicRoughness.baseColorTexture) continue;
    const resolved = resolveMaterial(material.name);
    const source = resolved?.texture;
    if (!source && resolved?.color) {
      material.pbrMetallicRoughness.baseColorFactor = resolved.color;
      material.pbrMetallicRoughness.metallicFactor ??= 0;
      material.pbrMetallicRoughness.roughnessFactor ??= 0.62;
      material.extras = { ...(material.extras ?? {}), jleResolvedColor: true };
      slotsColored += 1; changed = true;
      continue;
    }
    if (!source) { slotsUnresolved += 1; continue; }
    const sourceBytes = fs.readFileSync(source);
    const digest = crypto.createHash('sha1').update(sourceBytes).digest('hex').slice(0, 10);
    const textureName = `texture__${path.basename(source, path.extname(source))}__${digest}.png`;
    const textureDestination = path.join(visualsRoot, textureName);
    if (!fs.existsSync(textureDestination)) fs.writeFileSync(textureDestination, sourceBytes);
    copied.add(textureName);
    json.images ??= []; json.textures ??= [];
    const imageIndex = json.images.push({ uri: textureName }) - 1;
    const textureIndex = json.textures.push({ source: imageIndex }) - 1;
    material.pbrMetallicRoughness.baseColorTexture = { index: textureIndex };
    material.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1];
    material.extras = { ...(material.extras ?? {}), jleResolvedTexture: true };
    slotsBound += 1; changed = true;
  }
  if (changed) { writeGlb(glbFile, json, chunks); filesChanged += 1; }
}
console.log(JSON.stringify({ filesChanged, slotsBound, slotsColored, slotsUnresolved, copiedTextures: copied.size }, null, 2));
