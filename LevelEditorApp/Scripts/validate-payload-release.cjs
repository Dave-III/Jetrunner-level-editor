const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const root = path.join(__dirname, '..', 'release', 'payload'); const descriptor = JSON.parse(fs.readFileSync(path.join(root, 'payload-release.json'))); const manifest = JSON.parse(fs.readFileSync(path.join(root, descriptor.manifestAsset)));
if (!['payload', 'full'].includes(descriptor.updateType) || descriptor.version !== manifest.version) throw new Error('Release classification metadata is inconsistent.');
for (const file of manifest.files) { const blob = fs.readFileSync(path.join(root, 'blobs', file.assetName)); if (blob.length !== file.size || crypto.createHash('sha256').update(blob).digest('hex') !== file.sha256) throw new Error(`Payload blob mismatch: ${file.path}`); }
console.log(`Payload release validation passed (${descriptor.updateType}, ${manifest.files.length} files).`);
