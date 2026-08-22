import path from 'node:path';
import { scanGameData } from '../LevelEditorApp/Scripts/game-data/scanner-core.mjs';
const args={};for(let i=2;i<process.argv.length;i++){const key=process.argv[i];if(key.startsWith('--'))args[key.slice(2)]=process.argv[++i]}
if(!args.game||(!args.fmodel&&!args.headers)){console.error('Usage: node Scripts/Scan-GameData.mjs --game <id> [--fmodel <directory>] [--headers <directory>] [--curated <json>] [--output <directory>]');process.exit(2)}
const projectRoot=path.resolve(import.meta.dirname,'..');const outputRoot=args.output?path.resolve(args.output):path.join(projectRoot,'generated','game-data');
const result=await scanGameData({game:args.game,fmodel:args.fmodel,headers:args.headers,curatedPath:args.curated,outputRoot,progress:({kind,parsed,file})=>console.log(`[${kind}] parsed ${parsed}: ${file}`)});
console.log(JSON.stringify({output:result.output,counts:result.index.counts,verifiedPlaceable:result.candidates.filter(c=>c.classification==='verified placeable').length,likelyPlaceable:result.candidates.filter(c=>c.classification==='likely placeable').length,extractionQueue:result.queue.length},null,2));
