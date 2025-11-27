# CLAUDE.md - SpineParticleExporter

**Last Updated:** 2025-11-27
**Current Version:** v99 (Per-Emitter Sprites)

## Project Overview

SpineParticleExporter is a React/TypeScript web application that converts particle system animations into Spine 4.2 skeletal animation format. It's designed for game developers and animators who need to create particle effects for use in game engines that support Spine animations.

### Core Capabilities

- **Multi-Emitter System (v98+)**: Up to 5 independent particle emitters
- **Per-Emitter Sprites (NEW in v99)**: Unique sprite selection and atlas names per emitter (sprite_1, sprite_2, ...)
- **Viewport Visibility Control (v99)**: Hiding an emitter now hides its particles without deleting the emitter
- **Prewarm Timing (v99)**: Corrected warmup capture with clean starting keys
- **Visual Particle Design**: Interactive editors for creating complex particle systems
- **Real-Time Preview**: HTML5 Canvas-based simulation with live feedback
- **Physics Simulation**: Gravity, drag, noise, attraction, vortex forces
- **Emitter Shapes**: Point, circle, rectangle, rounded rectangle, line
- **Curve-Based Animation**: Control particle properties over lifetime with custom curves
- **Color Gradients**: Multi-keyframe color animations
- **Emission Modes**: Continuous, burst, and duration-based emission
- **Looping Animations**: Prewarm capability for seamless loops
- **Hierarchical Spine Export**: Separate parent bones for each emitter (emitter_1, emitter_2, etc.)
- **Individual Emitter Control**: Enable/disable and show/hide emitters independently
- **ZIP Packaging**: Complete export package with JSON and PNG files

### Technology Stack

- **React 18+** with TypeScript (TSX)
- **HTML5 Canvas 2D API** for rendering and simulation
- **Lucide React** for UI icons
- **Tailwind CSS** for styling
- **Pure JavaScript** for physics and export logic (no external libraries)

### Repository Characteristics

- **Modular Architecture** (v97+): Code split into 6 logical modules for maintainability
- **Multi-Emitter Support** (v98+): Up to 5 independent emitters with separate settings
- **Dual Distribution**: Modular for development, standalone for production
- **Build System**: Automated scripts to generate standalone versions
- **Versioned Iterations**: Keeps latest versions (v96 monolithic, v97 modular, v98 multi-emitter, v99 per-emitter sprites)

---

### Versioning Guidelines

- Each commit that changes the standalone TSX must create the next sequential version file (v99 → v100 → v101, etc.).
- Update `CLAUDE.md` to reflect the new current version and highlight key features/fixes for that release.
- Keep `standalone.html`/server defaults pointing at the newest version.
- Refresh the page header (title + subline) to show the current version and a short list of the latest features for each update.

---

### v99 Highlights

- Emitter visibility toggles now hide emitted particles in the viewport without disabling the emitter.
- Prewarm capture records a single warmup cycle with keys starting at time 0 (no leading timeline gaps).
- Default drag is now 1.0–1.0 for consistent damping.
- Particle sprites are scoped per emitter with new presets (needle, raindrop, snowflake, smoke) plus isolated custom uploads saved as sprite_1, sprite_2, etc.
- Exports are atlas-free; sprite PNGs embed the selected emitter sprites while attachments still reference sprite_# names.
- UI columns scaled up (~110%) for more comfortable controls.

---

## Codebase Structure (v99)

### 🎯 Two Distribution Methods

#### 1. **Modular Structure** (for development)
```
particle-spine-exporter-v98/
├── types.ts           (~380 lines)  - Type definitions, multi-emitter support
├── utils.ts           (~150 lines)  - Utility functions
├── core.ts            (~680 lines)  - ParticleSystem with multi-emitter logic
├── export.ts          (~1200 lines) - Export with emitter bone hierarchy
├── components.tsx     (~1000 lines) - Reusable React UI components
├── index.tsx          (~1350 lines) - Main component with emitter management
└── README.md                        - Module documentation
```

#### 2. **Standalone Version** (for distribution)
```
particle-spine-exporter_alpha_v99.tsx  (~4500 lines)
```

Generated via: `node serve-standalone.js v99` or direct editing (v99 is currently monolithic)

### 🔧 Build Tools & Runtime

```
build-standalone-v98.js  - Combines v98 modules into single file
build-standalone.js      - Combines v97 modules into single file
split-to-modules.js      - Splits monolithic file into modules
serve-standalone.js      - Simple HTTP server for testing standalone
standalone.html          - HTML runner for standalone TSX (UPDATE WITH EACH VERSION!)
setup-demo.sh            - Creates Vite dev environment
package.json             - NPM scripts and dependencies
```

**⚠️ IMPORTANT: Update `standalone.html` with each new version!**
- Update title to match version (e.g., "v98")
- Update script src to point to correct standalone file
- Ensure all required Lucide icons are included

---

## Module Architecture (v97)

### 📦 Module Breakdown

#### `types.ts` (~300 lines)
**Purpose:** All TypeScript type definitions, interfaces, and configuration constants

**Key Exports:**
- `Vec2`, `Color` - Basic types
- `CurvePoint`, `Curve` - Animation curve types
- `ColorPoint`, `ColorGradient` - Color animation types
- `EmitterSettings` - Emitter configuration
- `ParticleSettings` - Complete particle system settings
- `ExportSettings` - Export configuration
- `Particle` - Runtime particle data
- `BakedFrame`, `AtlasRegion` - Export pipeline types
- `DEFAULT_CURVE_PRESETS` - Preset curves for common animations
- `DEFAULT_SETTINGS` - Default particle system configuration

**Characteristics:**
- No runtime logic, pure type definitions
- All interfaces and constants in one place
- Easy to extend with new properties
- Single source of truth for configuration

#### `utils.ts` (~150 lines)
**Purpose:** Pure utility functions for math, noise, and curve evaluation

**Key Functions:**
- `simpleNoise(x, y)` - 2D Perlin-like noise generation
- `noise2D(x, y, time)` - Time-varying 2D noise vector
- `clamp01(value)` - Clamp value to [0, 1] range
- `sampleRange(range)` - Random value from min/max range
- `copyCurve(curve)` - Deep copy curve data
- `evaluateCurve(curve, t)` - Interpolate curve value at time t
- `evaluateColorGradient(gradient, t)` - Interpolate color at time t

**Characteristics:**
- Pure functions, no side effects
- No dependencies on React or other modules
- Fully testable in isolation
- Mathematical operations only

#### `core.ts` (~700 lines)
**Purpose:** ParticleSystem class - the simulation engine

**Key Class: `ParticleSystem`**

**Properties:**
- `settings: ParticleSettings` - Configuration
- `particles: Particle[]` - Active particles array
- `time: number` - Current simulation time
- `particleIdCounter: number` - Unique particle IDs

**Core Methods:**
- `update(dt: number)` - Advance simulation by time delta
- `spawnParticle()` - Create new particle with initial properties
- `updateParticle(p: Particle, dt: number)` - Apply physics and lifetime
- `reset()` - Clear all particles and reset state
- `draw(ctx: CanvasRenderingContext2D, time: number)` - Render to canvas

**Emission Logic:**
- Shape-based spawning (point, circle, rectangle, rounded rect, line)
- Emission modes (area, edge)
- Emission types (continuous, burst, duration)
- Rate/count-based emission control

**Physics Pipeline (per particle per frame):**
1. Apply gravity to velocity
2. Apply drag (velocity damping)
3. Apply noise forces (turbulence)
4. Apply attraction (to point or circle edge)
5. Apply vortex (tangential and radial forces)
6. Update position from velocity
7. Update rotation from angular velocity
8. Update age and check lifetime

**Characteristics:**
- Self-contained simulation logic
- No UI dependencies
- Canvas rendering built-in
- Prewarm support for looping animations

#### `export.ts` (~1200 lines)
**Purpose:** All export functionality - sprites, atlases, baking, Spine JSON generation

**Key Functions:**

**Sprite Generation:**
- `createParticleSprite(type, size)` - Generate particle textures
  - Types: circle, star, polygon, glow
  - Returns Canvas element with rendered sprite

**Atlas Packing:**
- `createParticleAtlas(spriteCanvas)` - Pack sprites into texture atlas
  - Returns canvas and region metadata

**Animation Baking:**
- `bakeParticleAnimation(settings)` - Simulate and capture animation
  - Runs full timeline at target FPS
  - Captures particle states at each frame
  - Returns baked frames and prewarm frames

**Preview Rendering:**
- `renderBakedPreview(frames, settings)` - Generate preview image

**Atlas File Generation:**
- `generateAtlasFile(atlasCanvas, region)` - Create Spine atlas text file

**Spine JSON Generation:**
- `generateSpineJSON(frames, prewarmFrames, settings)` - Convert to Spine 4.2 format
  - Creates bone hierarchy
  - Generates keyframe animations
  - Optimizes redundant keyframes
  - Supports separate loop/prewarm animations

**Keyframe Optimization:**
- Position threshold: 12.0 pixels
- Rotation threshold: 20.0 degrees
- Scale threshold: 0.2
- Color threshold: 100 (0-255 range)
- Always keeps first and last keyframes

**ZIP Packaging:**
- `SimpleZip` class - Custom ZIP implementation
  - No external dependencies
  - CRC32 checksum calculation
  - Binary ZIP generation

**Helper Functions:**
- `shouldCreateKey()` - Determine if keyframe needed
- `normalizeAngle()` - Handle angle wrapping
- `smoothAngles()` - Reduce angle jitter
- `isParticleVisible()` - Check if particle should be included
- `downloadBlob()` - Trigger browser download

**Characteristics:**
- Heavy computational logic
- No React dependencies
- Pure data transformation
- Self-contained export pipeline

#### `components.tsx` (~1000 lines)
**Purpose:** All React UI components for the editor interface

**Key Components:**

**`ColorPicker`**
- HSV color wheel with saturation/value square
- Alpha slider
- Canvas-based interactive color selection
- Props: `color`, `onChange`

**`ColorGradientEditor`**
- Timeline-based color keyframe editor
- Add/remove/edit color stops
- Visual gradient preview bar
- Draggable time handles
- Props: `gradient`, `onChange`

**`CurveEditor`**
- Interactive graph with draggable points
- Add points with click, remove with right-click
- Linear vs smooth interpolation toggle
- Full-width responsive layout
- Grid background with axis labels
- Props: `curve`, `label`, `onChange`

**`Timeline`**
- Playback controls (play/pause/reset)
- Time scrubber for manual control
- Loop toggle
- Real-time preview updates
- Props: `isPlaying`, `currentTime`, `duration`, `onPlayPause`, `onReset`, `onSeek`, `looping`, `onLoopToggle`

**`RangeInput`**
- Min/max value editor
- Synchronized number inputs
- Prevents invalid ranges (min > max)
- Props: `label`, `min`, `max`, `range`, `step`, `onChange`

**`CollapsibleSection`**
- Expandable/collapsible UI panels
- Chevron icon indicators
- Props: `title`, `defaultOpen`, `children`

**Helper Function:**
- `hslToRgb()` - HSL to RGB color conversion

**Characteristics:**
- Pure UI components
- No business logic
- Controlled components (props + callbacks)
- Reusable across projects

#### `index.tsx` (~800 lines)
**Purpose:** Main `ParticleSpineExporter` component - ties everything together

**State Management:**
- `settings: ParticleSettings` - Current particle system configuration
- `isPlaying: boolean` - Playback state
- `currentTime: number` - Current timeline position
- `canvasRef`, `systemRef` - Refs for canvas and ParticleSystem

**Three-Column Layout:**
1. **Left Column**: Canvas viewport + timeline controls
2. **Middle Column**: Emitter and particle settings
3. **Right Column**: Export settings and actions

**Canvas Rendering:**
- RequestAnimationFrame loop
- Real-time particle simulation
- Visual feedback for emitter shapes
- Vortex point visualization

**Settings UI Sections:**
- Emitter settings (position, shape, emission)
- Particle lifetime
- Physics forces (gravity, drag, noise, attraction, vortex)
- Size/scale curves
- Speed/weight curves
- Rotation (spawn angle, spin, angular velocity)
- Color gradient editor
- Export settings (thresholds, channels)

**Export Functionality:**
- Bake animation at specified FPS
- Generate Spine JSON and texture atlas
- Create ZIP package
- Download to user's machine
- Error handling and user feedback

**Characteristics:**
- Application state management
- UI layout and organization
- Event handlers and user interactions
- Integrates all other modules

---

## Development Workflows

### 🎯 Choosing Development Mode

**Use Modular Structure When:**
- Adding new features
- Refactoring existing code
- Working in a team (fewer merge conflicts)
- Need to quickly find specific functionality
- Want better code organization

**Use Standalone When:**
- Quick bug fixes (1-2 lines)
- Distributing to users
- Integrating into existing projects
- No build tools available

### 📝 Modular Development Workflow

#### Making Changes

1. **Identify the Module:**
   - UI changes? → `components.tsx`
   - Particle physics? → `core.ts`
   - Export logic? → `export.ts`
   - Types/constants? → `types.ts`
   - Math/utilities? → `utils.ts`
   - Main app logic? → `index.tsx`

2. **Edit the Module:**
   ```bash
   # Navigate to modular directory
   cd particle-spine-exporter-v97/

   # Edit the relevant file
   vim core.ts  # or your preferred editor
   ```

3. **Build Standalone:**
   ```bash
   # From repository root
   npm run build
   ```

   This generates `particle-spine-exporter_alpha_v97.tsx`

4. **Test:**
   - Use the demo environment: `./setup-demo.sh`
   - Or integrate into your React project

#### Adding New Features

**Example: Adding a new curve parameter**

1. **Update `types.ts`:**
   ```typescript
   interface ParticleSettings {
     // ... existing properties
     myNewCurveOverLifetime: Curve;
     myNewCurveRange: RangeValue;
   }

   // Add to DEFAULT_CURVE_PRESETS
   const DEFAULT_CURVE_PRESETS = {
     // ... existing presets
     myNewCurve: { points: [...], interpolation: 'linear' }
   };

   // Add to DEFAULT_SETTINGS
   const DEFAULT_SETTINGS = {
     // ... existing settings
     myNewCurveOverLifetime: DEFAULT_CURVE_PRESETS.myNewCurve,
     myNewCurveRange: { min: 0, max: 1 }
   };
   ```

2. **Apply in `core.ts`:**
   ```typescript
   updateParticle(p: Particle, dt: number) {
     // ... existing code

     // Evaluate your new curve
     const curveValue = evaluateCurve(
       this.settings.myNewCurveOverLifetime,
       p.life / p.maxLife
     );
     const myNewValue = p.baseMyNewValue * curveValue;

     // Apply the value
     // ... your logic here
   }
   ```

3. **Add UI in `index.tsx`:**
   ```tsx
   <CollapsibleSection title="My New Feature">
     <CurveEditor
       curve={settings.myNewCurveOverLifetime}
       label="My New Curve"
       onChange={(curve) => updateSetting('myNewCurveOverLifetime', curve)}
     />
     <RangeInput
       label="My New Range"
       min={0}
       max={10}
       step={0.1}
       range={settings.myNewCurveRange}
       onChange={(range) => updateSetting('myNewCurveRange', range)}
     />
   </CollapsibleSection>
   ```

4. **Build and test:**
   ```bash
   npm run build
   # Test in demo environment or your project
   ```

### 🔄 Converting Between Formats

#### Monolithic → Modular
```bash
npm run split
```

This reads `particle-spine-exporter_alpha_v96.tsx` and creates modular structure.

#### Modular → Standalone
```bash
npm run build
```

This reads modules and creates `particle-spine-exporter_alpha_v97.tsx`.

### 🧪 Testing Workflow

Since there's no automated test suite:

1. **Visual Testing:**
   - Run demo environment: `./setup-demo.sh`
   - Create particle systems with various settings
   - Verify visual output matches expectations

2. **Export Testing:**
   - Export to Spine JSON
   - Import into Spine Editor (https://esotericsoftware.com/)
   - Verify animation playback
   - Check texture atlas

3. **Edge Cases:**
   - Test with 0 particles
   - Test with max particles (500+)
   - Test extreme curve values
   - Test all emission modes
   - Test all particle shapes
   - Test loop + prewarm combinations

4. **Cross-Browser:**
   - Chrome/Edge (Chromium)
   - Firefox
   - Safari (Canvas rendering differences)

---

## Version History

### Major Versions

- **v50-v83**: Early iterations, monolithic structure
- **v84-v85**: Stable monolithic versions
- **v86-v95**: Continuous improvements, bug fixes, new features
- **v96** (2025-11-25): Latest monolithic version
  - Loop + Prewarm animations named "loop" and "prewarm"
  - Duplicate frame 0 at end for seamless looping
  - Prewarm animation only includes bones with offset data
  - 4135 lines, single file
- **v97** (2025-11-25): Modular refactor
  - Split into 6 modules for maintainability
  - Added build system for standalone generation
  - All v96 functionality preserved
  - 4175 lines total (across 6 files)
- **v98** (2025-11-26): **Current version - Multi-emitter support**
  - Up to 5 independent particle emitters
  - Per-emitter settings and configuration
  - Hierarchical bone export (emitter_1, emitter_2, etc.)
  - Individual emitter enable/disable for export
  - Viewport visibility toggle per emitter
  - Current emitter highlighted in viewport
  - 4463 lines total (across 6 files)

### v98 Changes Log

**Major Changes:**
- Added multi-emitter architecture supporting up to 5 emitters
- Created `EmitterInstance` and `EmitterInstanceSettings` types
- Reorganized `ParticleSettings` to contain array of emitters
- Updated `ParticleSystem` to manage multiple emitters with separate state
- Modified export pipeline to create parent bones for each emitter
- Added emitter management UI (add, remove, select, show/hide)
- Added per-emitter export enable/disable in export settings
- Updated all particle/emitter settings to work with current emitter

**New Features:**
- ✅ Up to 5 simultaneous emitters
- ✅ Independent settings per emitter
- ✅ Emitter selection UI with visibility toggles
- ✅ Hierarchical Spine bone structure per emitter
- ✅ Export filtering by emitter
- ✅ All emitters rendered simultaneously
- ✅ Current emitter highlighted in viewport

**Technical Changes:**
- `Particle` now includes `emitterId` field
- `BakedFrame` particles include `emitterId`
- `ParticleSystem` uses `Map<string, EmitterState>` for per-emitter state
- Export creates `emitter_N` bones as parents for particle bones
- UI uses `updateEmitter()` helper for current emitter updates

**Benefits:**
- ✅ Create complex multi-layered particle effects
- ✅ Each emitter fully independent
- ✅ Better organization for complex effects
- ✅ Backward compatible (uses 1 emitter by default)

### v97 Changes Log

**Major Changes:**
- Refactored monolithic v96 into modular structure
- Created 6 logical modules: types, utils, core, export, components, index
- Added `build-standalone.js` for automated standalone generation
- Added `split-to-modules.js` for converting monolithic to modular
- Added `setup-demo.sh` for quick development environment
- Created comprehensive documentation (V97-USAGE.md)
- Added .gitignore for build artifacts

**Functionality:**
- ✅ All v96 features preserved
- ✅ No breaking changes
- ✅ Identical export output
- ✅ Same UI/UX

**Benefits:**
- ✅ Easier navigation (150-1200 lines per file vs 4135 in one)
- ✅ Better code organization
- ✅ Clearer separation of concerns
- ✅ Reduced merge conflicts in team development
- ✅ Faster development iteration

---

## Git Workflow for AI Assistant

### Branch Naming

**For AI Assistant:**
- Format: `claude/<description>-<session-id>`
- Example: `claude/refactor-code-structure-01TP67eowUrag6BveJukedyP`
- Session ID must match for push to succeed

**For Features:**
- Format: `feature/<description>`
- Example: `feature/add-triangle-emitter`

### Commit Guidelines

**Good Commit Messages:**
```
Add triangle emitter shape

- Implemented triangle spawn logic in core.ts
- Added triangleSize parameter to EmitterSettings
- Added UI controls in index.tsx
- Updated types and defaults
```

**Bad Commit Messages:**
```
"Update files"
"Fix bug"
"WIP"
```

### Push Protocol

```bash
# Always use -u flag
git push -u origin <branch-name>

# Branch must start with 'claude/' for AI assistant work

# On network failure: Retry up to 4 times with exponential backoff
# 2s, 4s, 8s, 16s
```

### When to Commit

**Always Commit When:**
- User explicitly asks to commit
- Completing a feature or fix
- Before switching tasks
- After building standalone version

**Never Commit:**
- Work in progress (unless user requests)
- Broken code
- Without testing first
- node_modules or build artifacts (use .gitignore)

### What to Include

**Do Commit:**
- Source code changes (modular files)
- Built standalone version (v97.tsx)
- Documentation updates (CLAUDE.md, README.md)
- Build scripts (build-standalone.js)
- Configuration (package.json, tsconfig.json)

**Don't Commit:**
- node_modules/
- dist/ or build/ folders
- .DS_Store, Thumbs.db
- IDE-specific files (.vscode/, .idea/)
- Demo project (particle-exporter-demo/) - user can recreate with setup-demo.sh

---

## AI Assistant Best Practices

### When Making Changes

1. **Always read first** - Never propose changes to code you haven't read
2. **Check version** - Ensure you're editing the correct file (v97 modules vs standalone)
3. **Maintain structure** - Keep modular architecture intact
4. **Follow patterns** - Use existing code patterns (immutability, pure functions)
5. **Test assumptions** - Particle physics can be unintuitive
6. **Document changes** - Update comments and CLAUDE.md if needed
7. **Build after editing** - Always run `npm run build` after module changes
8. **Commit appropriately** - Clear messages, logical grouping

### Communication

- **Be concise** - Users are developers, technical language is fine
- **Show code examples** - Demonstrate solutions with code snippets
- **Explain tradeoffs** - Multiple solutions? Explain pros/cons
- **Ask when unclear** - Don't guess at user intent
- **Confirm before major changes** - Refactoring, architecture changes
- **Provide context** - File locations, line numbers, function names

### Problem Solving

1. **Understand the problem** - Ask clarifying questions
2. **Locate relevant code** - Identify which module(s) to change
3. **Plan the solution** - Outline steps before coding
4. **Implement incrementally** - Small changes, test frequently
5. **Verify the fix** - Test edge cases, check for regressions
6. **Document the solution** - Update comments, docs if needed

### Common Pitfalls to Avoid

- ❌ Don't modify magic numbers without understanding their purpose
- ❌ Don't break immutability patterns in React state
- ❌ Don't add external dependencies without discussion
- ❌ Don't remove features without explicit request
- ❌ Don't commit broken code
- ❌ Don't skip building standalone after module changes
- ❌ Don't guess at physics formulas (vectors, angles, etc.)
- ❌ Don't over-engineer simple fixes

---

## Quick Reference

### File Locations

```
particle-spine-exporter-v97/types.ts       - Types and constants
particle-spine-exporter-v97/utils.ts       - Utility functions
particle-spine-exporter-v97/core.ts        - ParticleSystem class
particle-spine-exporter-v97/export.ts      - Export pipeline
particle-spine-exporter-v97/components.tsx - UI components
particle-spine-exporter-v97/index.tsx      - Main component

particle-spine-exporter_alpha_v97.tsx      - Standalone (generated)

build-standalone.js                        - Build script
split-to-modules.js                        - Split script
setup-demo.sh                              - Demo environment setup
package.json                               - NPM configuration
V97-USAGE.md                               - User documentation
```

### Common Commands

```bash
# Build standalone from modules
npm run build

# Split monolithic into modules
npm run split

# Create demo environment
./setup-demo.sh

# Start demo dev server
cd particle-exporter-demo && npm run dev

# Open demo in browser
http://localhost:3000
```

### Key Interfaces

```typescript
// Core types
Vec2: { x: number; y: number }
Color: { r: number; g: number; b: number; a: number }
Curve: { points: CurvePoint[]; interpolation: 'linear' | 'smooth' }
ColorGradient: { points: ColorPoint[] }

// Configuration
ParticleSettings: { emitter, lifetime, forces, curves, export, ... }
EmitterSettings: { position, shape, rate, mode, ... }
ExportSettings: { thresholds, enabled channels, ... }

// Runtime
Particle: { position, velocity, life, properties, ... }
BakedFrame: { time, particles: Map<id, data> }
```

### Important Functions

```typescript
// Utils
evaluateCurve(curve, t): number
evaluateColorGradient(gradient, t): Color
simpleNoise(x, y): number
noise2D(x, y, time): Vec2

// Core
ParticleSystem.update(dt): void
ParticleSystem.spawnParticle(): void
ParticleSystem.draw(ctx, time): void

// Export
bakeParticleAnimation(settings): { frames, prewarmFrames }
generateSpineJSON(frames, prewarmFrames, settings): string
createParticleAtlas(sprite): { canvas, region }
```

---

**End of CLAUDE.md**

This document is the source of truth for AI assistants working on SpineParticleExporter.
Keep it updated as the codebase evolves.

Last updated: 2025-11-25 by Claude (Anthropic AI Assistant)
