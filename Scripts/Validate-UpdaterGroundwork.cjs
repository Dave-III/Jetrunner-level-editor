'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
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
const appRoot = path.join(__dirname, '..', 'LevelEditorApp');
const mainProcess = fs.readFileSync(path.join(appRoot, 'electron', 'main.cjs'), 'utf8');
const preload = fs.readFileSync(path.join(appRoot, 'electron', 'preload.cjs'), 'utf8');
const renderer = fs.readFileSync(path.join(appRoot, 'src', 'main.ts'), 'utf8');
const styles = fs.readFileSync(path.join(appRoot, 'src', 'styles.css'), 'utf8');
assert.match(mainProcess, /update:state/);
assert.match(mainProcess, /update:download/);
assert.match(preload, /onEditorUpdateState/);
assert.match(renderer, /id="home-update"/);
assert.match(renderer, /New Version.*Available/);
assert.match(styles, /\.home-update\{/);
console.log('Updater groundwork validation passed.');
