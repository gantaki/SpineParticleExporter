# Export System Documentation

This document explains how the export system works and how to add support for new export formats (e.g., Unity, Unreal, Godot, etc.).

## Overview

The export system converts real-time particle simulations into pre-baked animation data. The pipeline has four stages:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  1. Simulation  │ ──► │   2. Baking     │ ──► │  3. Generation  │ ──► │  4. Packaging   │
│  ParticleEngine │     │  Frame Capture  │     │  Format-specific│     │  ZIP Download   │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

## File Structure

```
src/export/
├── index.ts          # Barrel file - re-exports everything
├── sprites.ts        # Procedural sprite generation
├── atlas.ts          # Texture atlas packing
├── baking.ts         # Animation frame capture (format-agnostic)
├── spine-json.ts     # Spine 4.2 skeleton JSON generation
├── zip.ts            # ZIP file utilities
└── EXPORT.md         # This documentation
```

## Pipeline Stages

### Stage 1: Sprite Generation (`sprites.ts`)

Creates procedural particle sprites (white silhouettes that get tinted at runtime).

**Input**: Sprite type (`circle`, `star`, `glow`, `needle`, etc.)  
**Output**: `HTMLCanvasElement` (64×64 white sprite)

```typescript
import { createParticleSprite } from "./sprites";

const sprite = createParticleSprite("glow", 64);
```

**Available sprite types**:

- `circle` - Solid circle
- `glow` - Radial gradient (soft edges)
- `star` - 5-pointed star
- `polygon` - Hexagon
- `needle` - Elongated pill shape
- `raindrop` - Teardrop shape
- `snowflake` - 6-arm snowflake
- `smoke` - Soft cloud-like shape

### Stage 2: Atlas Packing (`atlas.ts`)

Packs multiple sprites into a single texture atlas.

**Input**: Array of `{ name: string, canvas: HTMLCanvasElement }`  
**Output**: `{ canvas: HTMLCanvasElement, regions: AtlasRegion[] }`

```typescript
import { createParticleAtlas, generateAtlasFile } from "./atlas";

const { canvas, regions } = createParticleAtlas([
  { name: "sprite_1", canvas: circleSprite },
  { name: "sprite_2", canvas: glowSprite },
]);

// Generate Spine atlas text file
const atlasText = generateAtlasFile(canvas, regions);
```

### Stage 3: Animation Baking (`baking.ts`)

Simulates the particle system and captures frame-by-frame snapshots.

**Input**: `ParticleSettings` (emitter configuration)  
**Output**: `{ frames: BakedFrame[], prewarmFrames: BakedFrame[] }`

```typescript
import { bakeParticleAnimation } from "./baking";

const { frames, prewarmFrames } = bakeParticleAnimation(settings);
// frames[0].particles is a Map<string, ParticleSnapshot>
```

**BakedFrame structure**:

```typescript
interface BakedFrame {
  time: number; // Frame timestamp
  particles: Map<string, ParticleSnapshot>; // Particle states
}

interface ParticleSnapshot {
  emitterId: string;
  localId: number;
  x: number; // Position relative to emitter
  y: number;
  rotation: number; // Degrees
  scale: number;
  scaleX: number;
  scaleY: number;
  alpha: number; // 0-1
  color: { r; g; b; a }; // 0-255
  life: number;
  maxLife: number;
}
```

### Stage 4: Format Generation (`spine-json.ts`)

Converts baked frames into the target format. Currently implements **Spine 4.2**.

**Input**: `frames`, `prewarmFrames`, `settings`, `spriteNameMap`  
**Output**: JSON string

```typescript
import { generateSpineJSON } from "./spine-json";

const json = generateSpineJSON(frames, prewarmFrames, settings, spriteNameMap);
```

### Stage 5: Packaging (`zip.ts`)

Creates a downloadable ZIP file.

```typescript
import { SimpleZip, downloadBlob } from "./zip";

const zip = new SimpleZip();
zip.addFile("particle.json", jsonString);
zip.addFile("particle.atlas", atlasText);
await zip.addCanvasFile("particle.png", atlasCanvas);

downloadBlob(zip.generate(), "particle-export.zip");
```

---

## Adding a New Export Format

To add support for a new engine (e.g., Unity, Godot, Unreal), follow these steps:

### Step 1: Create Format Generator

Create a new file `src/export/{format}-export.ts`:

```typescript
// src/export/unity-export.ts

import type { ParticleSettings, BakedFrame } from "../types";
import type { ParticleSnapshot } from "./baking";

export interface UnityExportOptions {
  // Format-specific options
  animationClipName: string;
  targetFrameRate: number;
}

export function generateUnityAnimation(
  frames: BakedFrame[],
  prewarmFrames: BakedFrame[],
  settings: ParticleSettings,
  options: UnityExportOptions
): string {
  // Convert baked frames to Unity AnimationClip format
  // ...
  return JSON.stringify(unityData);
}
```

### Step 2: Define Output Structure

Each format has different requirements. Common patterns:

| Engine | Animation Format        | Sprite Format | Notes                    |
| ------ | ----------------------- | ------------- | ------------------------ |
| Spine  | Skeleton JSON + .atlas  | PNG atlas     | Bones for each particle  |
| Unity  | AnimationClip (.anim)   | Sprite Sheet  | Uses Transform keyframes |
| Godot  | AnimationPlayer (.tres) | AtlasTexture  | Resource-based           |
| Unreal | Sequencer / Niagara     | Flipbook      | Blueprint or C++         |

### Step 3: Map Particle Properties

Map `ParticleSnapshot` fields to target format:

```typescript
function mapToUnityKeyframe(snapshot: ParticleSnapshot, time: number) {
  return {
    time: time,
    // Unity uses Y-up, our system uses Y-down
    position: { x: snapshot.x, y: -snapshot.y, z: 0 },
    // Unity rotation is in quaternions or euler angles
    rotation: { x: 0, y: 0, z: snapshot.rotation },
    // Unity scale
    scale: { x: snapshot.scaleX, y: snapshot.scaleY, z: 1 },
    // Unity color (0-1 range)
    color: {
      r: snapshot.color.r / 255,
      g: snapshot.color.g / 255,
      b: snapshot.color.b / 255,
      a: snapshot.alpha,
    },
  };
}
```

### Step 4: Handle Visibility

Particles appear and disappear. Handle this with:

- **Spine**: `attachment: null` to hide
- **Unity**: Disable renderer or set alpha to 0
- **Godot**: `visible = false` or modulate alpha

```typescript
function handleVisibility(
  prevVisible: boolean,
  currentVisible: boolean,
  time: number
) {
  if (!prevVisible && currentVisible) {
    // Particle appeared - add "show" keyframe
  } else if (prevVisible && !currentVisible) {
    // Particle disappeared - add "hide" keyframe
  }
}
```

### Step 5: Add Keyframe Optimization

Use thresholds to reduce file size (same as Spine export):

```typescript
const POSITION_THRESHOLD = settings.exportSettings.positionThreshold;
const ROTATION_THRESHOLD = settings.exportSettings.rotationThreshold;
const SCALE_THRESHOLD = settings.exportSettings.scaleThreshold;
const COLOR_THRESHOLD = settings.exportSettings.colorThreshold;

// Only create keyframe if value changed significantly
if (Math.abs(current.x - prev.x) > POSITION_THRESHOLD) {
  addPositionKeyframe(time, current);
}
```

### Step 6: Export to Index

Add exports to `src/export/index.ts`:

```typescript
// Add to index.ts
export {
  generateUnityAnimation,
  type UnityExportOptions,
} from "./unity-export";
```

### Step 7: Add UI Panel

Create export options in `ExportPanel.tsx`:

```typescript
// In ExportPanel.tsx, add format selector and format-specific options
<LabeledSelect
  label="Export Format"
  value={exportFormat}
  options={[
    { value: "spine", label: "Spine 4.2" },
    { value: "unity", label: "Unity AnimationClip" },
    { value: "godot", label: "Godot AnimationPlayer" },
  ]}
  onChange={setExportFormat}
/>
```

---

## Spine Export Details

The current Spine export creates:

### Skeleton Structure

```
root (bone)
├── emitter_1 (bone)
│   ├── e1_particle_0 (bone) → e1_particle_slot_0 (slot)
│   ├── e1_particle_1 (bone) → e1_particle_slot_1 (slot)
│   └── ...
├── emitter_2 (bone)
│   └── ...
```

### Animation Tracks

Per particle:

- **translate**: Position keyframes (x, y relative to emitter)
- **rotate**: Rotation keyframes (degrees)
- **scale**: Scale keyframes (scaleX, scaleY)
- **attachment**: Visibility (sprite name or null)
- **rgba**: Color keyframes (hex string `rrggbbaa`)

### Animation Names

- `loop_N` - Looping emitter animation
- `burst_N` - Burst emitter animation
- `duration_N` - Duration-based animation
- `prewarm_N` - Prewarm animation (plays once before loop)

### Keyframe Optimization

- Only writes keyframes when values change beyond threshold
- Uses `stepped` curve after visibility changes to prevent interpolation artifacts
- Normalizes angles to prevent 360° jumps
- Smooths rotation with median filter to reduce jitter

---

## Testing Export Formats

1. **Visual comparison**: Export and reimport to target engine
2. **Frame accuracy**: Compare frame-by-frame with preview
3. **Performance**: Check file size and load time
4. **Edge cases**:
   - Empty frames (no particles)
   - Single particle
   - Maximum particles
   - Looping transitions
   - Prewarm sequences

---

## Common Issues

### Y-Axis Inversion

Most game engines use Y-up, but browser canvas uses Y-down. Always negate Y:

```typescript
y: -snapshot.y;
```

### Rotation Units

- Our system: Radians internally, degrees in snapshots
- Spine: Degrees
- Unity: Degrees or Quaternions
- Godot: Radians

### Color Ranges

- Our snapshots: RGB 0-255, Alpha 0-1
- Spine: Hex string `rrggbbaa`
- Unity: RGBA 0-1
- Godot: Color(r, g, b, a) 0-1

### Time Precision

Round times to avoid floating-point artifacts:

```typescript
time: Math.round(frame.time * 1000) / 1000;
```
