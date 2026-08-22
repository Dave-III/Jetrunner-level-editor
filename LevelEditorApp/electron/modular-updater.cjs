const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const STATE_SCHEMA = 1;
const MANIFEST_SCHEMA = 1;
const MAX_MANIFEST_FILES = 20000;

function compareVersions(a, b) {
  const parse = (value) => String(value).split('-')[0].split('.').map((part) => Number(part) || 0);
  const left = parse(a); const right = parse(b);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] || 0) !== (right[index] || 0)) return (left[index] || 0) - (right[index] || 0);
  }
  return 0;
}

function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || path.isAbsolute(value)) return null;
  const normalized = value.replace(/\\/g, '/');
  if (normalized.startsWith('/') || normalized.split('/').some((part) => !part || part === '.' || part === '..')) return null;
  return normalized;
}

function validateManifest(input, { launcherVersion, allowedHosts = ['github.com', 'objects.githubusercontent.com'] } = {}) {
  if (!input || input.schemaVersion !== MANIFEST_SCHEMA || typeof input.version !== 'string') throw new Error('Unsupported payload manifest.');
  if (!Array.isArray(input.files) || input.files.length > MAX_MANIFEST_FILES) throw new Error('Payload manifest file list is invalid.');
  if (input.minimumLauncherVersion && launcherVersion && compareVersions(launcherVersion, input.minimumLauncherVersion) < 0) {
    return { ...input, requiresFullUpdate: true, reason: `Launcher ${input.minimumLauncherVersion} or newer is required.` };
  }
  const seen = new Set();
  const files = input.files.map((file) => {
    const relative = safeRelativePath(file?.path);
    if (!relative || seen.has(relative.toLowerCase())) throw new Error(`Unsafe or duplicate payload path: ${file?.path}`);
    seen.add(relative.toLowerCase());
    if (!Number.isSafeInteger(file.size) || file.size < 0 || !/^[a-f0-9]{64}$/i.test(file.sha256 || '')) throw new Error(`Invalid payload metadata: ${relative}`);
    if (file.url) {
      const url = new URL(file.url);
      if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname)) throw new Error(`Untrusted payload URL: ${relative}`);
    }
    return { path: relative, size: file.size, sha256: file.sha256.toLowerCase(), url: file.url, assetName: file.assetName };
  });
  const removed = (input.removed || []).map((entry) => {
    const relative = safeRelativePath(entry);
    if (!relative) throw new Error(`Unsafe removed payload path: ${entry}`);
    return relative;
  });
  return { ...input, files, removed, requiresFullUpdate: Boolean(input.requiresFullUpdate) };
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    while (true) { const { bytesRead } = await handle.read(buffer, 0, buffer.length); if (!bytesRead) break; hash.update(buffer.subarray(0, bytesRead)); }
  } finally { await handle.close(); }
  return hash.digest('hex');
}

async function atomicJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, filePath);
}

async function copyTree(source, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.cp(source, destination, { recursive: true, force: true, errorOnExist: false });
}

class ModularUpdater {
  constructor({ root, bundledPayload, launcherVersion, fetchImpl = global.fetch, logger = () => {}, allowedHosts, keepVersions = 3 }) {
    this.root = root; this.bundledPayload = bundledPayload; this.launcherVersion = launcherVersion;
    this.fetchImpl = fetchImpl; this.logger = logger; this.allowedHosts = allowedHosts; this.keepVersions = keepVersions;
    this.versions = path.join(root, 'versions'); this.staging = path.join(root, 'staging'); this.recovery = path.join(root, 'recovery');
    this.statePath = path.join(root, 'current.json');
  }
  async readState() {
    try { const state = JSON.parse(await fs.readFile(this.statePath, 'utf8')); if (state.schemaVersion === STATE_SCHEMA) return state; } catch {}
    return { schemaVersion: STATE_SCHEMA, active: null, previous: null, knownGood: null, pending: null, updatedAt: new Date().toISOString() };
  }
  versionRoot(version) { return path.join(this.versions, version); }
  async initialize() {
    await Promise.all([fs.mkdir(this.versions, { recursive: true }), fs.mkdir(this.staging, { recursive: true }), fs.mkdir(this.recovery, { recursive: true })]);
    let state = await this.readState();
    if (state.pending) { this.logger('warning', `Discarding interrupted payload staging for ${state.pending}.`); await fs.rm(path.join(this.staging, state.pending), { recursive: true, force: true }); state.pending = null; await atomicJson(this.statePath, state); }
    if (!state.active && this.bundledPayload) {
      state = { ...state, active: this.launcherVersion, knownGood: this.launcherVersion, updatedAt: new Date().toISOString() };
      await atomicJson(this.statePath, state);
    }
    if (this.bundledPayload && compareVersions(this.launcherVersion, state.active || '0.0.0') > 0) {
      state = { ...state, previous: state.active, active: this.launcherVersion, knownGood: this.launcherVersion, pending: null, updatedAt: new Date().toISOString() };
      await atomicJson(this.statePath, state);
    }
    if (state.active && state.active !== this.launcherVersion) { try { await fs.access(this.versionRoot(state.active)); } catch { state.active = state.knownGood === this.launcherVersion ? this.launcherVersion : null; await atomicJson(this.statePath, state); } }
    return state;
  }
  async activePayload() { const state = await this.initialize(); if (!state.active || state.active === this.launcherVersion) return this.bundledPayload; return this.versionRoot(state.active); }
  async plan(manifestInput) {
    const manifest = validateManifest(manifestInput, { launcherVersion: this.launcherVersion, allowedHosts: this.allowedHosts });
    const state = await this.initialize();
    if (manifest.requiresFullUpdate) return { kind: 'full', manifest, state, changed: [] };
    if (state.active && compareVersions(manifest.version, state.active) <= 0) return { kind: 'none', manifest, state, changed: [] };
    const activeRoot = state.active === this.launcherVersion ? this.bundledPayload : (state.active ? this.versionRoot(state.active) : null);
    const changed = [];
    for (const file of manifest.files) {
      const source = activeRoot && path.join(activeRoot, ...file.path.split('/'));
      let matches = false;
      if (source) { try { const stat = await fs.stat(source); matches = stat.size === file.size && await sha256File(source) === file.sha256; } catch {} }
      if (!matches) changed.push(file);
    }
    return { kind: changed.length || manifest.removed.length ? 'payload' : 'activate-existing', manifest, state, changed };
  }
  async install(manifestInput, { resolveUrl, progress = () => {}, healthCheck = async () => true } = {}) {
    const plan = await this.plan(manifestInput);
    if (plan.kind === 'none' || plan.kind === 'full') return plan;
    const { manifest, state } = plan; const candidate = path.join(this.staging, manifest.version);
    await fs.rm(candidate, { recursive: true, force: true });
    const activeSource = state.active === this.launcherVersion ? this.bundledPayload : (state.active ? this.versionRoot(state.active) : null);
    if (activeSource) await copyTree(activeSource, candidate); else await fs.mkdir(candidate, { recursive: true });
    await atomicJson(this.statePath, { ...state, pending: manifest.version, updatedAt: new Date().toISOString() });
    try {
      for (const removed of manifest.removed) await fs.rm(path.join(candidate, ...removed.split('/')), { recursive: true, force: true });
      let completed = 0; const total = plan.changed.reduce((sum, file) => sum + file.size, 0);
      for (const file of plan.changed) {
        const url = file.url || resolveUrl?.(file);
        if (!url) throw new Error(`No download URL for ${file.path}`);
        const parsed = new URL(url); const allowed = this.allowedHosts || ['github.com', 'objects.githubusercontent.com'];
        if (parsed.protocol !== 'https:' || !allowed.includes(parsed.hostname)) throw new Error(`Untrusted download URL for ${file.path}`);
        const response = await this.fetchImpl(url); if (!response.ok) throw new Error(`Download failed (${response.status}) for ${file.path}`);
        const data = Buffer.from(await response.arrayBuffer());
        if (data.length !== file.size || crypto.createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(`Integrity check failed for ${file.path}`);
        const destination = path.join(candidate, ...file.path.split('/')); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.writeFile(destination, data);
        completed += data.length; progress({ completed, total, percent: total ? completed / total * 100 : 100, file: file.path });
      }
      for (const file of manifest.files) {
        const target = path.join(candidate, ...file.path.split('/')); const stat = await fs.stat(target);
        if (stat.size !== file.size || await sha256File(target) !== file.sha256) throw new Error(`Candidate validation failed for ${file.path}`);
      }
      if (!await healthCheck(candidate, manifest)) throw new Error('Candidate payload failed its startup health check.');
      if (state.active === this.launcherVersion) {
        const baseline = this.versionRoot(state.active);
        try { await fs.access(baseline); } catch { await copyTree(this.bundledPayload, baseline); }
      }
      const installed = this.versionRoot(manifest.version); await fs.rm(installed, { recursive: true, force: true }); await fs.rename(candidate, installed);
      const next = { ...state, previous: state.active, active: manifest.version, knownGood: manifest.version, pending: null, updatedAt: new Date().toISOString() };
      await atomicJson(this.statePath, next); await this.prune(next); return { ...plan, kind: 'installed', state: next };
    } catch (error) {
      await fs.rm(candidate, { recursive: true, force: true }).catch(() => {}); await atomicJson(this.statePath, { ...state, pending: null, updatedAt: new Date().toISOString() }); throw error;
    }
  }
  async rollback() {
    const state = await this.initialize(); const target = state.previous || state.knownGood;
    if (!target || target === state.active) return { rolledBack: false, state };
    await fs.access(this.versionRoot(target));
    const next = { ...state, active: target, previous: state.active, knownGood: target, pending: null, updatedAt: new Date().toISOString() };
    await atomicJson(this.statePath, next); return { rolledBack: true, state: next };
  }
  async prune(state) {
    state ||= await this.readState();
    const entries = await fs.readdir(this.versions, { withFileTypes: true });
    const protectedVersions = new Set([state.active, state.previous, state.knownGood].filter(Boolean));
    const candidates = await Promise.all(entries.filter((entry) => entry.isDirectory() && !protectedVersions.has(entry.name)).map(async (entry) => ({ name: entry.name, time: (await fs.stat(path.join(this.versions, entry.name))).mtimeMs })));
    candidates.sort((a, b) => b.time - a.time);
    await Promise.all(candidates.slice(Math.max(0, this.keepVersions - protectedVersions.size)).map((entry) => fs.rm(path.join(this.versions, entry.name), { recursive: true, force: true })));
  }
}

module.exports = { ModularUpdater, validateManifest, compareVersions, safeRelativePath, sha256File, atomicJson };
