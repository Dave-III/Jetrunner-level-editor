import fs from 'node:fs';
import path from 'node:path';

const [exportsArg, visualsArg] = process.argv.slice(2);
if (!exportsArg || !visualsArg) throw new Error('Usage: node Audit-UnresolvedEditorMaterials.mjs <exports> <visuals>');
const exportsRoot = path.resolve(exportsArg);
const visualsRoot = path.resolve(visualsArg);

function walk(root, extension, output = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const item = path.join(root, entry.name);
    if (entry.isDirectory()) walk(item, extension, output);
    else if (entry.name.toLowerCase().endsWith(extension)) output.push(item);
  }
  return output;
}

function indexFiles(files) {
  const index = new Map();
  for (const file of files) {
    const key = path.basename(file, path.extname(file)).toLowerCase();
    const matches = index.get(key) ?? [];
    matches.push(file);
    matches.sort((a, b) => a.length - b.length || a.localeCompare(b));
    index.set(key, matches);
  }
  return index;
}

const jsonIndex = indexFiles(walk(exportsRoot, '.json'));
const pngIndex = indexFiles(walk(exportsRoot, '.png'));
const priorities = ['Base Color', 'PM_Diffuse', 'Albedo', 'BaseColor', 'Diffuse'];
const ignored = /normal|mra|specular|rough|metal|mask|dirt|imperfection|opacity/i;
const knownInheritedTextures = [[/surface[_ ]?ice/i, 't_ice00_c_srgb']];

function hasAuthoredColor(colors = {}) {
  return Object.values(colors).some((value) =>
    [value?.R, value?.G, value?.B].every((component) => Number.isFinite(Number(component))),
  );
}

function auditMaterial(materialName) {
  if (!materialName) return { texture: false, color: false, metadata: [] };
  let texture = false;
  let color = false;
  const metadata = [];
  const key = materialName.toLowerCase();
  const candidateKeys = new Set([key]);
  if (key.startsWith('mi_')) candidateKeys.add(`m_${key.slice(3).replace(/_inst$/i, '')}`);
  if (key.endsWith('_inst')) candidateKeys.add(key.slice(0, -5));
  for (const metadataFile of [...candidateKeys].flatMap((candidate) => jsonIndex.get(candidate) ?? [])) {
    try {
      const document = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
      metadata.push(path.relative(exportsRoot, metadataFile));
      color ||= hasAuthoredColor(document.Parameters?.Colors);
      const textures = document.Textures ?? {};
      const refs = [
        ...priorities.map((name) => textures[name]).filter(Boolean),
        ...Object.entries(textures).filter(([name]) => !ignored.test(name)).map(([, value]) => value),
      ];
      texture ||= refs.some((ref) => {
        const objectName = String(ref).split('.').at(-1).split('/').at(-1).toLowerCase();
        return (pngIndex.get(objectName) ?? []).length > 0;
      });
    } catch { /* Ignore unrelated JSON sharing a filename. */ }
  }
  if (!texture) {
    const inherited = knownInheritedTextures.find(([pattern]) => pattern.test(materialName));
    if (inherited) texture = (pngIndex.get(inherited[1]) ?? []).length > 0;
  }
  return { texture, color, metadata };
}

function readMaterials(file) {
  const input = fs.readFileSync(file);
  for (let offset = 12; offset < input.length;) {
    const length = input.readUInt32LE(offset);
    const type = input.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      const json = JSON.parse(input.subarray(offset + 8, offset + 8 + length).toString('utf8').replace(/[\u0000 ]+$/g, ''));
      return (json.materials ?? []).map((material) => material.name || '(unnamed material)');
    }
    offset += 8 + length;
  }
  return [];
}

const unresolved = [];
for (const filename of fs.readdirSync(visualsRoot).filter((name) => name.endsWith('.glb')).sort()) {
  const assetId = filename.replace(/__.*$/, '').replace(/\.glb$/i, '');
  for (const material of [...new Set(readMaterials(path.join(visualsRoot, filename)))]) {
    const resolution = auditMaterial(material === '(unnamed material)' ? '' : material);
    if (!resolution.texture && !resolution.color) unresolved.push({ assetId, file: filename, material, metadata: resolution.metadata });
  }
}

console.log(JSON.stringify({ unresolvedSlots: unresolved.length, assets: [...new Set(unresolved.map((item) => item.assetId))].length, unresolved }, null, 2));
