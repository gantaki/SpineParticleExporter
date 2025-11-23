# CLAUDE.md - SpineParticleExporter

## Project Overview

**SpineParticleExporter** is a React-based web application that converts particle system animations into Spine animation format for use in games and interactive media. Users can design and simulate complex particle systems with real-time preview, then export them as production-ready Spine skeleton files with atlas textures.

### Key Capabilities
- Design particle systems with interactive visual editors
- Configure emitter shapes (point, circle, rectangle, rounded rectangle, line)
- Apply physics forces (gravity, drag, noise, attraction, vortex)
- Use curve-based animation for properties over particle lifetime
- Create color gradients with multiple keyframes
- Support multiple emission modes (continuous, burst, duration)
- Enable looping with prewarm capability for seamless animations
- Export as Spine 4.1 compatible JSON with texture atlases
- Package everything as downloadable ZIP files

### Technology Stack
- **React 18+** with TypeScript
- **HTML5 Canvas 2D** for rendering
- **Lucide React** for icons
- **Tailwind CSS** for styling
- **Pure JavaScript** for physics, ZIP creation, and Spine export (no external libraries for core logic)

---

## Codebase Structure

### File Organization

```
SpineParticleExporter/
├── particle-spine-exporter_alpha_v50.tsx   (1,582 lines - Initial version)
├── particle-spine-exporter_alpha_v71.tsx   (1,485 lines - Curve presets)
├── particle-spine-exporter_alpha_v73.tsx   (1,632 lines - Custom curves)
├── particle-spine-exporter_alpha_v74.tsx   (1,971 lines - Emission modes)
├── particle-spine-exporter_alpha_v75.tsx   (2,476 lines - Color gradients)
├── particle-spine-exporter_alpha_v76.tsx   (2,641 lines - Sprite types)
├── particle-spine-exporter_alpha_v77.tsx   (2,681 lines - Curve physics)
├── particle-spine-exporter_alpha_v78.tsx   (2,832 lines - UI polish)
├── particle-spine-exporter_alpha_v79.tsx   (3,049 lines - Loop & prewarm)
└── particle-spine-exporter_alpha_v80.tsx   (3,206 lines - CURRENT VERSION)
```

**IMPORTANT:** Always work with the highest version number (currently v80). Historical versions are kept for reference.

### Code Architecture

Each version file is a complete, self-contained React component with:

1. **Type Definitions** (Lines 1-135)
   - Core interfaces: `Vec2`, `Color`, `Curve`, `ColorGradient`
   - Settings: `EmitterSettings`, `ParticleSettings`
   - Runtime data: `Particle`, `BakedFrame`, `AtlasRegion`

2. **Default Configurations** (Lines 136-220)
   - `DEFAULT_CURVE_PRESETS` - Common curve patterns
   - `DEFAULT_SETTINGS` - Initial particle system state

3. **Utility Functions** (Lines 221-293)
   - `simpleNoise()`, `noise2D()` - Perlin-like noise
   - `evaluateCurve()` - Curve interpolation (linear/smooth)
   - `evaluateColorGradient()` - Color timeline evaluation

4. **React Components** (Lines 294-800+)
   - `ColorPicker` - HSV color selection widget
   - `ColorGradientEditor` - Timeline-based color editor
   - `CurveEditor` - Interactive curve graph with draggable points
   - `CollapsibleSection` - UI organization
   - Helper components for UI

5. **ParticleSystem Class** (Lines 800-1200+)
   - Particle lifecycle management
   - Physics simulation (gravity, drag, forces)
   - Emission logic (shapes, modes, timing)
   - Prewarm for looping animations

6. **SimpleZip Class** (Lines 1200-1400+)
   - ZIP file format implementation
   - CRC32 checksums
   - File compression and packaging

7. **Export Functions** (Lines 1400-2200+)
   - `createParticleSprite()` - Generate particle sprites
   - `createParticleAtlas()` - Pack sprites into texture atlas
   - `generateSpineJSON()` - Convert to Spine skeleton format
   - `bakeParticleAnimation()` - Simulate and capture frames

8. **Main Component** (Lines 2200-3206)
   - `ParticleSpineExporter` - Root React component
   - State management with hooks
   - UI rendering and event handling
   - Settings panels and controls

---

## Development Workflow

### Git Workflow

1. **Active Branch**: Always develop on `claude/claude-md-mibcpl8dx954c5cv-01XpM9tVHG2YrNFGoHtNfP3e`
2. **Never push to main/master** without explicit permission
3. **Branch naming**: Must start with `claude/` and end with session ID for push authentication

### Making Changes

**CRITICAL RULES:**

1. **Always read before editing** - Use `Read` tool to understand existing code first
2. **Work on the latest version** - Currently `particle-spine-exporter_alpha_v80.tsx`
3. **Preserve existing functionality** - Don't break backward compatibility unless explicitly requested
4. **Test interactively** - This is a visual tool; consider how changes affect user experience
5. **Maintain type safety** - TypeScript strictness is intentional

### Commit Guidelines

```bash
# Good commit messages (follow existing style)
git commit -m "Loop and Prewarm added"
git commit -m "Tweaks for Loop animation"
git commit -m "Added new features."

# Clear, concise, focused on user-facing changes
```

### Push with Retry Logic

```bash
# Always use -u flag and retry on network errors
git push -u origin claude/claude-md-mibcpl8dx954c5cv-01XpM9tVHG2YrNFGoHtNfP3e

# Retry up to 4 times with exponential backoff (2s, 4s, 8s, 16s) if network fails
```

---

## Key Conventions

### Code Style

1. **TypeScript Interfaces** - Always define types explicitly
   ```typescript
   interface Vec2 { x: number; y: number; }  // Good
   // Not: const point = { x: 0, y: 0 };      // Avoid untyped objects
   ```

2. **Immutable Settings** - Settings objects are never mutated
   ```typescript
   setSettings({ ...settings, duration: newValue });  // Good
   settings.duration = newValue;                      // Never do this
   ```

3. **Normalized Time** - All curve evaluations use t ∈ [0, 1]
   ```typescript
   const value = evaluateCurve(curve, life / maxLife);  // Always normalize
   ```

4. **React Patterns**
   - Use `useState` for UI state
   - Use `useRef` for expensive objects (ParticleSystem, Canvas contexts)
   - Use `useCallback` for event handlers to prevent re-renders
   - Use `useEffect` for canvas setup and cleanup

5. **Canvas Rendering** - Always clear and redraw fully each frame
   ```typescript
   ctx.clearRect(0, 0, canvas.width, canvas.height);
   // Draw background, particles, UI overlays
   ```

### Naming Conventions

- **Interfaces**: PascalCase (e.g., `ParticleSettings`, `EmitterSettings`)
- **Functions**: camelCase (e.g., `evaluateCurve`, `spawnParticle`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `DEFAULT_SETTINGS`, `DEFAULT_CURVE_PRESETS`)
- **React Components**: PascalCase (e.g., `ColorPicker`, `CurveEditor`)
- **File naming**: `particle-spine-exporter_alpha_vXX.tsx` (kebab-case with version)

### Magic Numbers to Know

```typescript
// Keyframe optimization thresholds
const POSITION_THRESHOLD = 5.0;      // Skip position keys if change < 5px
const ROTATION_THRESHOLD = 10.0;     // Skip rotation keys if change < 10°
const SCALE_THRESHOLD = 0.1;         // Skip scale keys if change < 0.1

// Default simulation parameters
const DEFAULT_FPS = 30;              // Animation framerate
const DEFAULT_DURATION = 2.0;        // Default animation length (seconds)
const DEFAULT_FRAME_SIZE = 512;      // Canvas/export size (pixels)
const DEFAULT_MAX_PARTICLES = 500;   // Particle pool size
```

---

## Architecture Patterns

### 1. Curve System

**Purpose**: Animate any numeric property over normalized time [0, 1]

```typescript
interface CurvePoint {
  time: number;   // 0.0 to 1.0
  value: number;  // Any numeric value
}

interface Curve {
  points: CurvePoint[];
  interpolation: 'linear' | 'smooth';  // Smooth uses ease-in-out
}

// Usage
const size = evaluateCurve(settings.sizeOverLifetime, particle.life / particle.maxLife);
```

**Applied to**:
- Size, speed, weight, spin, attraction
- Gravity, drag (physics forces)
- Noise strength, angular velocity, vortex strength

### 2. Color Gradient System

**Purpose**: Animate color over particle lifetime

```typescript
interface ColorGradient {
  points: ColorPoint[];  // Multiple color stops
}

interface ColorPoint {
  time: number;    // 0.0 to 1.0
  color: Color;    // RGBA (0-255)
}

// Interpolates between color points linearly
```

### 3. Emission Modes

**Three distinct modes**:

1. **Continuous**: Spawns particles at constant rate
   ```typescript
   emissionType: 'continuous'
   rate: 50  // particles per second
   ```

2. **Burst**: Spawns batches at intervals
   ```typescript
   emissionType: 'burst'
   burstCount: 50      // particles per burst
   burstCycles: 3      // number of bursts
   burstInterval: 0.5  // seconds between bursts
   ```

3. **Duration**: Spawns only within time window
   ```typescript
   emissionType: 'duration'
   durationStart: 0.0  // start time (seconds)
   durationEnd: 2.0    // end time (seconds)
   ```

### 4. Emitter Shapes

**Shape Types**: point, circle, rectangle, roundedRect, line

**Emission Modes**:
- `area` - Particles spawn anywhere within shape
- `edge` - Particles spawn only on perimeter

**Velocity**: All particles get initial velocity based on:
- `angle` - Base direction (degrees, -90 = up)
- `angleSpread` - Random variance (±degrees)
- `speedMin`/`speedMax` - Random speed range

### 5. Looping & Prewarm

**Looping**: Animation repeats seamlessly
```typescript
looping: true
```

**Prewarm**: Pre-simulate one full cycle before playback starts
```typescript
prewarm: true  // Only works if looping is true
```

**Why prewarm?** Ensures loop starts with particles already in motion, avoiding empty first frames.

**Implementation**: `ParticleSystem.prewarm()` runs silent simulation for `duration` seconds.

### 6. Baking Pipeline

**Process Flow**:
```
1. Reset ParticleSystem
2. Simulate frame-by-frame (dt = 1/fps)
3. Capture particle state each frame → BakedFrame[]
4. Convert to Spine keyframes
5. Optimize (remove redundant keys)
6. Generate JSON + atlas
7. Package as ZIP
```

**Key Function**: `bakeParticleAnimation()`
- Returns `BakedFrame[]` array
- Each frame stores `Map<particleId, particleData>`
- Handles wrap-around simulation for looping particles

### 7. Spine Export Structure

**Skeleton Hierarchy**:
```
root (bone)
└── ALL_PARTICLES (container bone)
    ├── particle_0 (bone + slot + attachment)
    ├── particle_1 (bone + slot + attachment)
    └── particle_N (bone + slot + attachment)
```

**Animation Tracks** (per particle):
- **Translate**: X/Y position keyframes
- **Rotate**: Rotation with angle smoothing (median filter)
- **Scale**: X/Y scale (supports non-uniform scaling)
- **Attachment**: Visibility (show/hide particle)
- **Color**: RGBA over time

**Angle Smoothing**: Median filter over 5-frame window prevents rotation jitter from 360° wrapping.

---

## Version Evolution

### v50 → v71: Curve Presets
- Replaced simple start/end values with preset curves
- Types: constant, linear, easeIn, easeOut, easeInOut, bell

### v71 → v73: Custom Curves
- **Major shift**: Point-based curves with custom interpolation
- Added `CurveEditor` component for visual editing
- Click to add points, drag to modify

### v73 → v74: Advanced Emission
- Added emission types (continuous, burst, duration)
- New forces: vortex, Perlin noise
- Line emitter shape

### v74 → v75: Color Gradients
- Multi-point color timeline
- `ColorGradientEditor` component
- Replaced simple start/end colors

### v75 → v76: Particle Sprites
- Multiple sprite types: circle, star, polygon, glow, custom
- Canvas-based sprite generation

### v76 → v77: Curve Physics
- Gravity and drag became curves over lifetime
- Better physics control

### v77 → v78: UI Improvements
- Enhanced controls and visualization

### v78 → v79: Loop & Prewarm
- Added looping support
- Prewarm simulation for seamless loops
- Start delay parameter

### v79 → v80: Quality Polish (CURRENT)
- Loop animation tweaks
- Enhanced timeline handling
- Improved keyframe optimization
- Better angle smoothing

---

## Important Areas to Understand

### 1. Particle Physics (`ParticleSystem.update()`)

**Update Loop** (called every frame):
```typescript
1. Apply gravity (curve-based, affects vy)
2. Apply drag (curve-based, multiplies vx/vy)
3. Apply noise force (Perlin-like turbulence)
4. Apply attraction force (pull toward point)
5. Apply vortex force (spiral around point)
6. Update velocity: vx += ax, vy += ay
7. Update position: x += vx * dt, y += vy * dt
8. Update rotation: += angularVelocity * dt
9. Update scale: from sizeOverLifetime curve
10. Update color: from colorOverLifetime gradient
11. Age particle: life += dt
12. Remove if life > maxLife
```

### 2. Curve Evaluation (`evaluateCurve()`)

**Algorithm**:
```typescript
1. Clamp t to [0, 1]
2. Sort curve points by time
3. Find two points that bracket t
4. Calculate local interpolation factor
5. Linear: lerp(p1.value, p2.value, localT)
6. Smooth: apply ease-in-out, then lerp
```

**Smooth Interpolation**: Uses quadratic ease-in-out
```typescript
smoothT = t < 0.5
  ? 2 * t * t
  : 1 - Math.pow(-2 * t + 2, 2) / 2;
```

### 3. Spine JSON Generation (`generateSpineJSON()`)

**Steps**:
```typescript
1. Create root + ALL_PARTICLES bones
2. For each particle:
   a. Create bone (child of ALL_PARTICLES)
   b. Create slot (references bone)
   c. Create attachment (sprite region)
3. Build animation:
   a. For each particle, for each frame:
      - Extract position, rotation, scale, color
      - Optimize keyframes (skip if change < threshold)
      - Smooth rotation angles (median filter)
      - Create timeline entries
4. Return JSON with bones, slots, skins, animations
```

**Keyframe Optimization**: Only add keyframe if value changed beyond threshold. Reduces file size dramatically.

### 4. ZIP Creation (`SimpleZip`)

**Custom Implementation** (no libraries):
```typescript
1. For each file:
   - Write local file header
   - Write file data
   - Calculate CRC32 checksum
2. Write central directory
3. Write end of central directory record
4. Convert to Blob for download
```

**Files in ZIP**:
- `particle_spine.json` - Skeleton + animations
- `particle.atlas` - Texture atlas metadata
- `particle_0.png` - Base64-encoded particle sprite
- `particle_1.png` - Additional sprites if needed

---

## Common Tasks

### Adding a New Particle Property

1. **Add to interface**:
   ```typescript
   interface ParticleSettings {
     // ... existing
     myNewPropertyOverLifetime: Curve;
   }
   ```

2. **Add default curve**:
   ```typescript
   const DEFAULT_CURVE_PRESETS = {
     // ... existing
     myNewProperty: { points: [{ time: 0, value: 0 }, { time: 1, value: 1 }], interpolation: 'linear' }
   };
   ```

3. **Add to DEFAULT_SETTINGS**:
   ```typescript
   myNewPropertyOverLifetime: DEFAULT_CURVE_PRESETS.myNewProperty
   ```

4. **Update ParticleSystem.update()**:
   ```typescript
   const myValue = evaluateCurve(this.settings.myNewPropertyOverLifetime, t);
   // Apply to particle
   ```

5. **Add UI in main component**:
   ```tsx
   <CurveEditor
     curve={settings.myNewPropertyOverLifetime}
     onChange={(curve) => updateSettings({ myNewPropertyOverLifetime: curve })}
     label="My New Property"
   />
   ```

### Adding a New Emitter Shape

1. **Add to type union**:
   ```typescript
   shape: 'point' | 'circle' | 'rectangle' | 'roundedRect' | 'line' | 'myNewShape';
   ```

2. **Add shape parameters**:
   ```typescript
   myNewShapeParam1: number;
   myNewShapeParam2: number;
   ```

3. **Update `spawnParticle()` in ParticleSystem**:
   ```typescript
   case 'myNewShape':
     // Calculate spawn position based on shape
     spawnX = ...;
     spawnY = ...;
     break;
   ```

4. **Add UI controls** for shape parameters

### Adding a New Force

1. **Add curve to ParticleSettings**:
   ```typescript
   myForceOverLifetime: Curve;
   ```

2. **Add to DEFAULT_SETTINGS**

3. **Apply in `ParticleSystem.update()`**:
   ```typescript
   const forceStrength = evaluateCurve(this.settings.myForceOverLifetime, t);
   // Calculate force vector
   p.vx += fx * dt;
   p.vy += fy * dt;
   ```

### Modifying Export Format

1. **Locate `generateSpineJSON()`** function
2. **Modify JSON structure** (bones, slots, animations)
3. **Test with Spine viewer** to ensure compatibility
4. **Update version comments** if format changes

### Debugging Visual Issues

1. **Canvas rendering** - Check `render()` in main component
2. **Particle state** - Add console.log in `ParticleSystem.update()`
3. **Curve values** - Log `evaluateCurve()` output
4. **Export validation** - Download JSON and inspect manually

---

## Testing and Validation

### Manual Testing Checklist

When making changes, test:

1. **Emission modes**: Continuous, burst, duration all work
2. **Emitter shapes**: Point, circle, rectangle, rounded rect, line
3. **Emission modes**: Area vs edge for shapes
4. **Forces**: Gravity, drag, noise, attraction, vortex
5. **Curves**: Linear and smooth interpolation
6. **Color gradients**: Multiple color points
7. **Looping**: Animation loops seamlessly
8. **Prewarm**: Loop starts with particles in motion
9. **Sprite types**: Circle, star, polygon, glow
10. **Export**: ZIP downloads correctly
11. **Spine compatibility**: JSON loads in Spine

### Visual Validation

1. **Preview canvas** - Particles should render smoothly
2. **Timeline scrubbing** - Seek forward/backward works
3. **Settings changes** - Immediate visual feedback
4. **Curve editors** - Points draggable, values update
5. **Color picker** - HSV selector works correctly

### Export Validation

```bash
# Unzip and inspect
unzip particle_export.zip -d export_test/
cat export_test/particle_spine.json | jq .  # Pretty-print JSON
```

**Check**:
- JSON is valid
- Atlas references correct images
- PNG files are valid base64
- Animation keyframes exist for all particles
- Bone hierarchy is correct

---

## Performance Considerations

### Current Limits

- **Max Particles**: 500 (default, configurable)
- **Frame Rate**: 30 FPS (default, affects smoothness vs file size)
- **Canvas Size**: 512×512 (default, affects export resolution)
- **Animation Duration**: 2.0s (default, longer = more keyframes)

### Optimization Strategies

1. **Keyframe Thresholds** - Increase to reduce JSON size
   ```typescript
   const POSITION_THRESHOLD = 10.0;  // More aggressive
   ```

2. **Lower FPS** - Fewer frames = faster baking
   ```typescript
   fps: 15  // Half the keyframes
   ```

3. **Smaller Canvas** - Faster rendering
   ```typescript
   frameSize: 256  // Quarter the pixels
   ```

4. **Fewer Particles** - Less simulation work
   ```typescript
   maxParticles: 200
   ```

### Known Performance Bottlenecks

1. **Baking** - Simulates entire animation (can take seconds for long/dense animations)
2. **Angle Smoothing** - Median filter over all frames (O(n * particles))
3. **Canvas Rendering** - Redraws every frame (use requestAnimationFrame throttling)
4. **ZIP Generation** - CRC32 calculation for all files

---

## File Paths Reference

**Current working directory**: `/home/user/SpineParticleExporter`

**Key files**:
- `/home/user/SpineParticleExporter/particle-spine-exporter_alpha_v80.tsx` - **CURRENT VERSION (work here)**
- `/home/user/SpineParticleExporter/particle-spine-exporter_alpha_v79.tsx` - Previous version (loop/prewarm)
- `/home/user/SpineParticleExporter/particle-spine-exporter_alpha_v50.tsx` - Original version (reference)

---

## Important Notes for AI Assistants

### DO:
- ✅ Always read the latest version file before making changes
- ✅ Preserve type safety - maintain all TypeScript interfaces
- ✅ Test changes visually (this is an interactive tool)
- ✅ Maintain backward compatibility with existing features
- ✅ Follow existing code patterns and conventions
- ✅ Update version number if making significant changes
- ✅ Commit with clear, concise messages
- ✅ Use the designated git branch for all work

### DON'T:
- ❌ Break existing functionality without explicit request
- ❌ Add external dependencies without discussion
- ❌ Change Spine export format without validation
- ❌ Remove features or settings without permission
- ❌ Mutate settings objects (always create new objects)
- ❌ Skip type definitions (no `any` types)
- ❌ Push to main/master branch
- ❌ Work on old version files (always use v80)

### When Uncertain:
1. **Read the code** first (especially ParticleSystem and export functions)
2. **Ask the user** for clarification on requirements
3. **Test incrementally** (small changes are safer)
4. **Check version history** (git log) to understand past changes
5. **Validate exports** (download and inspect ZIP files)

---

## Quick Reference

### Key Functions

| Function | Purpose | Location |
|----------|---------|----------|
| `evaluateCurve(curve, t)` | Get curve value at time t | ~Line 237 |
| `evaluateColorGradient(gradient, t)` | Get color at time t | ~Line 267 |
| `ParticleSystem.update(dt)` | Physics simulation step | ParticleSystem class |
| `ParticleSystem.prewarm()` | Pre-simulate for looping | ParticleSystem class |
| `bakeParticleAnimation()` | Capture all frames | ~Line 1800 |
| `generateSpineJSON()` | Create Spine skeleton | ~Line 1900 |
| `createParticleAtlas()` | Generate texture atlas | ~Line 2100 |
| `SimpleZip.generate()` | Create ZIP file | SimpleZip class |

### Key Interfaces

| Interface | Purpose | Key Properties |
|-----------|---------|----------------|
| `ParticleSettings` | Complete particle system config | emitter, curves, gradients, duration, fps |
| `EmitterSettings` | Emission configuration | shape, position, angle, speed, emission type |
| `Curve` | Animation curve | points[], interpolation |
| `ColorGradient` | Color timeline | points[] with time+color |
| `Particle` | Runtime particle state | position, velocity, life, rotation, scale, color |
| `BakedFrame` | Captured animation frame | time, particles Map |

### UI Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `ColorPicker` | HSV color selection | color, onChange |
| `ColorGradientEditor` | Color timeline editor | gradient, onChange |
| `CurveEditor` | Interactive curve graph | curve, onChange, label, min, max |
| `CollapsibleSection` | Expandable settings panel | title, children, defaultOpen |

---

## Additional Resources

### Spine Animation Format
- Spine JSON specification: http://esotericsoftware.com/spine-json-format
- Spine runtimes: http://esotericsoftware.com/spine-runtimes

### Related Concepts
- Particle systems: https://en.wikipedia.org/wiki/Particle_system
- Perlin noise: https://en.wikipedia.org/wiki/Perlin_noise
- Bezier curves: https://en.wikipedia.org/wiki/B%C3%A9zier_curve
- ZIP format: https://en.wikipedia.org/wiki/ZIP_(file_format)

---

## Changelog

### v80 (Current - 2025-11-23)
- Loop animation tweaks for better seamless looping
- Enhanced timeline handling for wrap-around particles
- Improved angle smoothing and keyframe optimization

### v79
- Added looping and prewarm features
- Start delay parameter for emission control

### v78
- UI polish and expanded controls
- Better visualization and interaction patterns

### v77
- Gravity and drag converted to curves over lifetime
- Duration emission mode with start/end parameters

### v76
- Multiple particle sprite types (circle, star, polygon, glow, custom)
- Canvas-based sprite generation

### v75
- Color gradient system with timeline editor
- Multi-point color interpolation

### v74
- Emission types: continuous, burst, duration
- Vortex and noise force systems
- Line emitter shape

### v73
- Custom point-based curves with interpolation
- Interactive CurveEditor component
- Visual curve manipulation

### v71
- Curve preset system
- Non-uniform scaling support

### v50
- Initial version with basic particle physics
- Simple emitter shapes and emission modes
- Basic Spine export functionality

---

**Last Updated**: 2025-11-23
**Current Version**: particle-spine-exporter_alpha_v80.tsx
**Repository**: gantaki/SpineParticleExporter
**Active Branch**: claude/claude-md-mibcpl8dx954c5cv-01XpM9tVHG2YrNFGoHtNfP3e
