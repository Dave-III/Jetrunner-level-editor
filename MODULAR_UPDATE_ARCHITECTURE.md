# JLE modular update architecture

## Boundary

The installed Electron executable is the stable launcher/runtime. It owns startup, update discovery, file associations, project files, native UAsset tools, verification, security checks, recovery, and the full NSIS fallback. The compiled Vite `dist` directory is the independently versioned editor payload. A routine payload release may change renderer JavaScript, CSS, images, and renderer-owned data only.

Changes to `electron/**`, Electron/Node dependencies, preload bridges, `package*.json`, installer settings, native tools, signing, or file associations require a full NSIS update. The release generator classifies these explicitly as `updateType: full`; the client then uses the existing `electron-updater` path. Payload metadata absent, malformed, incompatible, or unreachable also falls back safely to the full updater.

## Installed layout and state

Payloads live outside Program Files at `%APPDATA%/jetrunner-level-editor/ModularUpdates`:

```text
current.json                 active/previous/knownGood/pending pointers
versions/<version>/          immutable verified payloads
staging/<version>/           incomplete candidate only
recovery/                    reserved recovery diagnostics
```

User levels, recent files, settings, logs, and pipeline output retain their existing locations and are never included in payload manifests or cleanup. The app always ships a bundled `dist` fallback. On first modular startup it is copied into the version store as the baseline known-good version.

## Release and activation flow

1. GitHub Actions builds and tests the editor and the normal NSIS fallback.
2. `build-payload-release.mjs` hashes every payload file and emits `payload-release.json`, `payload-manifest.json`, and content-addressed blobs.
3. The launcher discovers only the latest stable GitHub Release over HTTPS.
4. It validates schema, semantic compatibility, paths, host allowlists, byte sizes, and SHA-256 values.
5. It compares the active files and downloads only changed blobs. Unchanged files are copied locally.
6. The candidate is assembled in staging. Removed files are applied only from the signed release manifest's safe relative paths.
7. Every candidate file is rehashed and the entry point plus referenced resources receive a pre-activation health check.
8. The candidate directory is atomically renamed and `current.json` is atomically replaced. Restart activates it.
9. The renderer sends a startup-ready handshake. A startup renderer crash before that handshake automatically rolls back and restarts.

Failed downloads, hash mismatches, network loss, or interrupted staging leave the active pointer unchanged. Interrupted candidates are discarded at next startup. Active, previous, and known-good payloads are protected from retention cleanup. Advanced Options shows installed/recovery versions and provides one-click rollback and access to diagnostic files.

## Security assumptions

The GitHub release workflow is the trust root and must be protected with least-privilege repository permissions. HTTPS, a strict GitHub host allowlist, manifest schema validation, traversal rejection, duplicate-path rejection, file-size validation, and SHA-256 content checks prevent arbitrary or partial payload activation. Windows code signing remains required for the launcher/NSIS runtime and cannot be replaced by payload hashes. A future detached manifest signature can be added without changing the version layout.

## Operations

- Routine renderer release: ensure changed files stay inside the permitted payload boundary, bump version, run `npm run payload:build` and `npm run payload:validate`, then publish through the existing tagged workflow.
- Runtime release: classification is `full`; publish the NSIS artifacts normally.
- Test rollback: Advanced > Update recovery > Restore previous editor.
- Manual recovery: close JLE, inspect `current.json`, retain user data, and reinstall the latest NSIS package. The installer keeps app data.
- No release is published merely by these scripts; only a pushed version tag invokes publishing.
