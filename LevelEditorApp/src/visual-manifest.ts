export interface VisualTransform {
  scale?: number | [number, number, number];
  position?: [number, number, number];
  rotationDegrees?: [number, number, number];
}

export interface AssetVisualEntry extends VisualTransform {
  file?: string;
  files?: string[];
}

// Add exported GLB files to public/asset-visuals and map their editor asset ID
// here. Placement/collision remains on the invisible authoring placeholder;
// the GLB is only the visual skin rendered over it.
export const assetVisuals =
  manifest.assetVisuals as unknown as Record<string, AssetVisualEntry>;

// Equirectangular JPG/PNG/HDR captures can be assigned per Scenario ID.
// Unmapped scenarios keep using the built-in Central Park panorama.
export const skyboxVisuals =
  manifest.skyboxVisuals as Record<string, string>;

// Optional map-level GLBs exported with their actor hierarchy and transforms.
// When present these replace the approximate ring of individual backdrop props.
export const environmentScenes =
  (manifest as { environmentScenes?: Record<string, AssetVisualEntry> }).environmentScenes ?? {};
import manifest from './visual-manifest.json';
