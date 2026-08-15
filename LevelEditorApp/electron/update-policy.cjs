'use strict';

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(value || '').trim());
  if (!match) throw new Error(`Invalid release version: ${value}`);
  return { parts: match.slice(1, 4).map(Number), prerelease: match[4] || '' };
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) return Math.sign(a.parts[index] - b.parts[index]);
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function evaluateReleaseManifest(currentVersion, manifest) {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error('Unsupported update manifest.');
  if (typeof manifest.version !== 'string' || typeof manifest.releaseUrl !== 'string') {
    throw new Error('Update manifest is incomplete.');
  }
  if (!/^https:\/\//i.test(manifest.releaseUrl)) throw new Error('Update URL must use HTTPS.');
  return {
    currentVersion,
    latestVersion: manifest.version,
    updateAvailable: compareVersions(manifest.version, currentVersion) > 0,
    releaseUrl: manifest.releaseUrl,
  };
}

module.exports = { compareVersions, evaluateReleaseManifest };
