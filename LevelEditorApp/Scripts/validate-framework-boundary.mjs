import fs from 'node:fs/promises'; import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..', 'src', 'framework');
for (const name of await fs.readdir(root)) { if (!/\.ts$/.test(name)) continue; const source = await fs.readFile(path.join(root, name), 'utf8'); if (/from\s+['"][^'"]*(?:games\/jetrunner|gameplay-properties|visual-manifest)/i.test(source)) throw new Error(`Framework boundary violation in ${name}`); }
for (const file of ['src/games/example-game/adapter.ts', 'src/example-game-main.ts']) { const source = await fs.readFile(path.resolve(import.meta.dirname, '..', file), 'utf8'); if (/from\s+['"][^'"]*(?:games\/jetrunner|gameplay-properties|visual-manifest)/i.test(source)) throw new Error(`ExampleGame leaked a JETRUNNER dependency: ${file}`); }
for (const file of ['Scripts/game-data/scanner-core.mjs', '../Scripts/Scan-GameData.mjs']) { const source = await fs.readFile(path.resolve(import.meta.dirname, '..', file), 'utf8'); if (/jetrunner|unreal/i.test(source)) throw new Error(`Game-independent scanner leaked game/engine-specific interpretation: ${file}`); }
const exampleCss = await fs.readFile(path.resolve(import.meta.dirname, '..', 'src/example-game.css'), 'utf8');
if (/#[0-9a-f]{3,8}\b/i.test(exampleCss) || !/var\(--editor-accent|var\(--editor-bg/.test(exampleCss)) throw new Error('ExampleGame styling must be supplied by adapter theme tokens.');
console.log('Framework boundary validation passed.');
