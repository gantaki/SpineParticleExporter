/**
 * Export Module
 *
 * Re-exports all export functionality:
 * - sprites.ts: Procedural sprite generation (circle, star, glow, etc.)
 * - atlas.ts: Texture atlas packing and Spine atlas file generation
 * - baking.ts: Particle animation simulation and frame capture
 * - spine-json.ts: Spine skeleton JSON generation
 * - zip.ts: ZIP file creation and download utilities
 */

// Sprite generation
export { createParticleSprite, type SpriteType } from "./sprites";

// Atlas packing
export {
  createParticleAtlas,
  generateAtlasFile,
  type SpriteEntry,
} from "./atlas";

// Animation baking
export {
  bakeParticleAnimation,
  renderBakedPreview,
  makeParticleKey,
  type ParticleSnapshot,
} from "./baking";

// Spine JSON generation
export { generateSpineJSON } from "./spine-json";

// Keyframe optimization
export { decimateKeyframes, analyzeKeyframeDensity } from "./keyframe-decimation";

// ZIP utilities
export { SimpleZip, downloadBlob } from "./zip";
