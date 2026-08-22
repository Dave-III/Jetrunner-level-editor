export type Vector3Value = { x: number; y: number; z: number };
export type TransformValue = { position: Vector3Value; rotation: Vector3Value; scale: Vector3Value };
export type PropertyKind = 'string' | 'number' | 'boolean' | 'select' | 'vector3' | 'colour' | 'asset-reference';
export type PropertySchema = { id: string; label: string; kind: PropertyKind; defaultValue: string | number | boolean | Vector3Value; options?: readonly string[]; minimum?: number; maximum?: number; step?: number };
export type AssetDefinition = { id: string; label: string; category: string; shape: 'box' | 'ramp' | 'cylinder' | 'custom'; defaultTransform: TransformValue; properties?: readonly PropertySchema[] };
export type LevelEntity = { id: string; assetId: string; transform: TransformValue; properties: Record<string, unknown> };
export type FrameworkProject = { schema: string; gameId: string; name: string; entities: LevelEntity[]; gameData: Record<string, unknown> };
export type AdapterCapabilities = { preview: boolean; verification: boolean; runtimePackaging: boolean; environments: boolean };
export type GameConfiguration = { branding:{applicationName:string;editorTitle:string;logo?:string;icon?:string};theme:EditorTheme;categories:readonly string[];snapping:{enabled:boolean;translation:number;rotationDegrees:number;scale:number};grid:{size:number;subdivisions:number};units:{name:string;symbol:string;unitsPerMetre:number};coordinates:{upAxis:'x'|'y'|'z';handedness:'left'|'right';forwardAxis:string};preview:{cameraPosition:Vector3Value;background:string;physics:boolean};gameplayMetadata?:Record<string,unknown> };

export interface GameAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly projectSchema: string;
  readonly capabilities: AdapterCapabilities;
  readonly config: GameConfiguration;
  readonly assets: readonly AssetDefinition[];
  createProject(name: string): FrameworkProject;
  validateProject(input: unknown): FrameworkProject;
  serialize(project: FrameworkProject): string;
  deserialize(source: string): FrameworkProject;
  exportRuntime(project: FrameworkProject): Promise<unknown>;
}

export const identityTransform = (): TransformValue => ({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } });

export function createJsonAdapter(config: Omit<GameAdapter, 'createProject' | 'validateProject' | 'serialize' | 'deserialize'>): GameAdapter {
  const validateProject = (input: unknown): FrameworkProject => {
    if (!input || typeof input !== 'object') throw new Error('Project must be an object.');
    const project = input as FrameworkProject;
    if (project.schema !== config.projectSchema || project.gameId !== config.id || typeof project.name !== 'string' || !Array.isArray(project.entities)) throw new Error(`Invalid ${config.displayName} project.`);
    const assetIds = new Set(config.assets.map(({ id }) => id));
    project.entities.forEach((entity) => { if (!entity?.id || !assetIds.has(entity.assetId) || !entity.transform) throw new Error(`Invalid entity ${entity?.id || '(unknown)'}.`); });
    return project;
  };
  return {
    ...config,
    createProject: (name) => ({ schema: config.projectSchema, gameId: config.id, name, entities: [], gameData: {} }),
    validateProject,
    serialize: (project) => `${JSON.stringify(validateProject(project), null, 2)}\n`,
    deserialize: (source) => validateProject(JSON.parse(source)),
  };
}
import type { EditorTheme } from './theme';
