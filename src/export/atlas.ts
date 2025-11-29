/**
 * Atlas Packing
 * Creates texture atlases from sprite entries and generates Spine atlas files
 */

import type { AtlasRegion } from "../types";
import { createParticleSprite } from "./sprites";

export interface SpriteEntry {
  name: string;
  canvas: HTMLCanvasElement;
}

/**
 * Creates a texture atlas from sprite entries
 * Packs sprites into a grid layout with padding
 */
export function createParticleAtlas(spriteEntries: SpriteEntry[]): {
  canvas: HTMLCanvasElement;
  regions: AtlasRegion[];
} {
  const spriteSize = 64;
  const padding = 8;
  const columns = Math.max(1, Math.ceil(Math.sqrt(spriteEntries.length || 1)));
  const rows = Math.max(1, Math.ceil((spriteEntries.length || 1) / columns));
  const cellSize = spriteSize + padding * 2;

  const canvas = document.createElement("canvas");
  canvas.width = cellSize * columns;
  canvas.height = cellSize * rows;
  const ctx = canvas.getContext("2d")!;

  const regions: AtlasRegion[] = [];

  spriteEntries.forEach((entry, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * cellSize + padding;
    const y = row * cellSize + padding;

    ctx.drawImage(entry.canvas, x, y, spriteSize, spriteSize);
    regions.push({
      name: entry.name,
      x,
      y,
      width: spriteSize,
      height: spriteSize,
      atlasIndex: 0,
    });
  });

  // If no entries provided, draw a default circle sprite
  if (spriteEntries.length === 0) {
    const fallback = createParticleSprite("circle", spriteSize);
    ctx.drawImage(fallback, padding, padding, spriteSize, spriteSize);
    regions.push({
      name: "sprite_1",
      x: padding,
      y: padding,
      width: spriteSize,
      height: spriteSize,
      atlasIndex: 0,
    });
  }

  return { canvas, regions };
}

/**
 * Generates a Spine atlas text file from atlas canvas and regions
 */
export function generateAtlasFile(
  atlasCanvas: HTMLCanvasElement,
  regions: AtlasRegion[]
): string {
  let atlasText = "";

  atlasText += `particle.png\n`;
  atlasText += `size: ${atlasCanvas.width},${atlasCanvas.height}\n`;
  atlasText += `format: RGBA8888\n`;
  atlasText += `filter: Linear,Linear\n`;
  atlasText += `repeat: none\n`;

  regions.forEach((region) => {
    atlasText += `${region.name}\n`;
    atlasText += `  rotate: false\n`;
    atlasText += `  xy: ${region.x}, ${region.y}\n`;
    atlasText += `  size: ${region.width}, ${region.height}\n`;
    atlasText += `  orig: ${region.width}, ${region.height}\n`;
    atlasText += `  offset: 0, 0\n`;
    atlasText += `  index: -1\n`;
  });

  return atlasText;
}
