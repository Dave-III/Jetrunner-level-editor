import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import packageJson from '../package.json' with { type: 'json' };

const root = path.resolve(import.meta.dirname, '..'); const output = path.join(root, 'release', 'payload'); const blobs = path.join(output, 'blobs');
await fs.rm(output, { recursive: true, force: true }); await fs.mkdir(blobs, { recursive: true });
const walk = async (directory) => (await fs.readdir(directory, { withFileTypes: true })).flatMap((entry) => entry.isDirectory() ? [] : [path.join(directory, entry.name)]).concat(...await Promise.all((await fs.readdir(directory, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => walk(path.join(directory, entry.name)))));
const files = [];
for (const source of await walk(path.join(root, 'dist'))) {
  const data = await fs.readFile(source); const sha256 = crypto.createHash('sha256').update(data).digest('hex'); const assetName = `payload-${sha256}.bin`;
  await fs.writeFile(path.join(blobs, assetName), data);
  files.push({ path: path.relative(path.join(root, 'dist'), source).replace(/\\/g, '/'), size: data.length, sha256, assetName });
}
const fullRequired = [/^LevelEditorApp\/electron\//, /^LevelEditorApp\/package(?:-lock)?\.json$/, /^LevelEditorApp\/vite\.config/, /^UAssetPipeline\/(?:Tools|Build-JLELevel)/, /^\.github\/workflows\//];
let changed = [];
try { const previous = execFileSync('git', ['describe', '--tags', '--abbrev=0', 'HEAD^'], { cwd: path.dirname(root), encoding: 'utf8' }).trim(); changed = execFileSync('git', ['diff', '--name-only', `${previous}..HEAD`], { cwd: path.dirname(root), encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean); } catch {}
const updateType = process.env.JLE_UPDATE_TYPE || (!changed.length || changed.some((name) => fullRequired.some((pattern) => pattern.test(name))) ? 'full' : 'payload');
const manifest = { schemaVersion: 1, version: packageJson.version, minimumLauncherVersion: '1.0.7', generatedAt: new Date().toISOString(), files, removed: [], requiresFullUpdate: updateType === 'full' };
const descriptor = { schemaVersion: 1, version: packageJson.version, updateType, manifestAsset: 'payload-manifest.json', fullInstallerFallback: `JETRUNNER-Level-Editor-Setup-${packageJson.version}.exe` };
await fs.writeFile(path.join(output, 'payload-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`); await fs.writeFile(path.join(output, 'payload-release.json'), `${JSON.stringify(descriptor, null, 2)}\n`);
console.log(`Prepared ${files.length} payload files (${updateType} release, ${files.reduce((sum, file) => sum + file.size, 0)} bytes).`);
