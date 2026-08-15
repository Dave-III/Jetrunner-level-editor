'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { compareVersions, evaluateReleaseManifest } = require('../LevelEditorApp/electron/update-policy.cjs');

assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
assert.equal(compareVersions('1.1.0', '1.0.9'), 1);
assert.equal(compareVersions('1.0.0-beta.1', '1.0.0'), -1);
const result = evaluateReleaseManifest('1.0.0', {
  schemaVersion: 1,
  version: '1.1.0',
  releaseUrl: 'https://example.invalid/jle/releases/1.1.0',
});
assert.equal(result.updateAvailable, true);
assert.throws(() => evaluateReleaseManifest('1.0.0', {
  schemaVersion: 1, version: '1.1.0', releaseUrl: 'http://unsafe.invalid/update.exe',
}), /HTTPS/);
assert.ok(path.normalize('Documents/Jetrunner Level Editor/Levels').includes(`Documents${path.sep}Jetrunner Level Editor${path.sep}Levels`));
console.log('Updater groundwork validation passed.');
