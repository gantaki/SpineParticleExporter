# CLAUDE.md - SpineParticleExporter

**Last Updated:** 2025-11-24
**Current Version:** v85

## Project Overview

SpineParticleExporter is a self-contained React/TypeScript web application that converts particle system animations into Spine 4.2 skeletal animation format. It's designed for game developers and animators who need to create particle effects for use in game engines that support Spine animations.

### Core Capabilities

- **Visual Particle Design**: Interactive editors for creating complex particle systems
- **Real-Time Preview**: HTML5 Canvas-based simulation with live feedback
- **Physics Simulation**: Gravity, drag, noise, attraction, vortex forces
- **Emitter Shapes**: Point, circle, rectangle, rounded rectangle, line
- **Curve-Based Animation**: Control particle properties over lifetime with custom curves
- **Color Gradients**: Multi-keyframe color animations
- **Emission Modes**: Continuous, burst, and duration-based emission
- **Looping Animations**: Prewarm capability for seamless loops
- **Spine Export**: Full Spine 4.2 JSON with texture atlases and keyframe optimization
- **ZIP Packaging**: Complete export package with JSON and PNG files

### Technology Stack

- **React 18+** with TypeScript (TSX)
- **HTML5 Canvas 2D API** for rendering and simulation
- **Lucide React** for UI icons
- **Tailwind CSS** for styling
- **Pure JavaScript** for physics and export logic (no external libraries)

### Repository Characteristics

- **Self-Contained Component**: Entire application in single TSX files
- **No Build Pipeline**: Designed to integrate into existing build systems
- **Versioned Iterations**: Keeps 1-2 latest versions (v84, v85 currently)
- **Clean History**: Old versions deleted after merging to keep repo minimal

## Codebase Structure

### File Organization

```
SpineParticleExporter/
├── particle-spine-exporter_alpha_v84.tsx    # Previous stable version
└── particle-spine-exporter_alpha_v85.tsx    # Current version (3,565 lines)
```

### Code Architecture (v85)

The TSX files follow a consistent modular structure:

#### 1. Header & Metadata (Lines 1-12)
```typescript
// particle-spine-exporter_alpha_v85.tsx
// Version v85 - Date: November 23, 2025
// Changes: UI layout updates, color editor moved to curves section
```

#### 2. Type Definitions (Lines 17-160)

**Core Types:**
- `Vec2`: 2D vector `{x: number, y: number}`
- `Color`: RGBA color `{r, g, b, a}` (0-1 range)
- `CurvePoint`: Curve keyframe `{time, value}`
- `Curve`: Animation curve `{points: CurvePoint[], smooth: boolean}`
- `ColorPoint`: Color keyframe `{time, color: Color}`
- `ColorGradient`: Color timeline `{points: ColorPoint[]}`

**Settings Types:**
- `EmitterSettings`: Shape, position, emission parameters
- `ParticleSettings`: Lifetime, physics, visual properties
- `ExportSettings`: Spine format configuration

**Runtime Types:**
- `Particle`: Live particle instance with position, velocity, age
- `BakedFrame`: Captured particle states at specific time
- `AtlasRegion`: Texture atlas sprite metadata

#### 3. Default Configurations (Lines 170-272)

**Curve Presets:**
```typescript
DEFAULT_CURVE_PRESETS = {
  sizeOverLifetime: [{time:0, value:0.2}, {time:0.5, value:1}, {time:1, value:0}],
  speedOverLifetime: [{time:0, value:1}, {time:1, value:0.5}],
  weightOverLifetime: [{time:0, value:0}, {time:1, value:1}],
  spinOverLifetime: [{time:0, value:0}, {time:1, value:1}],
  // ... more presets
}
```

**Default Settings:**
- Initial particle system configuration
- Reasonable starting values for all parameters

#### 4. Utility Functions (Lines 274-345)

- `simpleNoise(x)`: 1D Perlin-like noise
- `noise2D(x, y)`: 2D Perlin-like noise for spatial variation
- `evaluateCurve(curve, t)`: Interpolate curve value at time t
- `evaluateColorGradient(gradient, t)`: Interpolate color at time t

#### 5. React UI Components (Lines 347-1180)

**ColorPicker** (Lines 347-495)
- HSV color wheel with saturation/value square
- Alpha slider
- Canvas-based interactive color selection

**ColorGradientEditor** (Lines 497-706)
- Timeline-based color keyframe editor
- Add/remove/edit color stops
- Visual gradient preview bar

**CurveEditor** (Lines 708-1005)
- Interactive graph with draggable points
- Add points with click, remove with right-click
- Linear vs smooth interpolation toggle
- Full-width responsive layout

**CollapsibleSection** (Lines 1007-1032)
- Expandable/collapsible UI sections
- Chevron icon indicators

**Timeline** (Lines 1034-1178)
- Playback controls (play/pause/reset)
- Scrubber for manual time control
- Loop toggle

#### 6. ParticleSystem Class (Lines 1185-1673)

**Core Methods:**
- `update(dt)`: Advance simulation by time delta
- `spawnParticle()`: Create new particle with initial properties
- `updateParticle(p, dt)`: Apply physics and update particle state
- `reset()`: Clear all particles and reset emitter
- `draw(ctx, time)`: Render particles to canvas

**Emission Logic:**
- Shape-based spawning (point, circle, rectangle, line)
- Mode handling (continuous, burst, duration)
- Rate/count-based emission

**Physics Simulation:**
- Gravity acceleration
- Drag (velocity dampening)
- Noise-based turbulence
- Attraction to point/circle
- Vortex/spiral forces

**Prewarm Feature:**
- Simulates N seconds instantly before playback
- Ensures looping animations start with particles visible

#### 7. Export Pipeline (Lines 1676-2276)

**createParticleSprite(settings)**
- Generates particle textures: circle, star, polygon, glow
- Returns Canvas element with rendered sprite

**createParticleAtlas(sprites)**
- Packs multiple sprites into single texture
- Returns atlas data with region coordinates

**bakeParticleAnimation(settings, duration, fps)**
- Simulates full animation timeline
- Captures particle states at each frame
- Returns array of `BakedFrame` objects

**generateSpineJSON(baked, atlas, settings)**
- Converts baked frames to Spine 4.2 format
- Creates slots, skins, attachments
- Optimizes keyframes (removes redundant frames)
- Thresholds: 0.01 for position, 0.001 for scale/rotation, 0.01 for color

#### 8. SimpleZip Class (Lines 2278-2401)

Custom ZIP implementation for packaging exports:
- CRC32 checksum calculation
- File entry management
- Binary ZIP generation
- No external dependencies

#### 9. Main Component (Lines 2418-3565)

**ParticleSpineExporter** - Root React component

**State Management:**
- `emitterSettings`, `particleSettings`, `exportSettings`
- `isPlaying`, `currentTime`, `duration`
- Canvas refs and animation frame tracking

**Three-Column Layout (v85):**
1. **Left Column**: Viewport with canvas and timeline
2. **Middle Column**: Emitter and particle settings
3. **Right Column**: Export settings and info

**Canvas Rendering:**
- RequestAnimationFrame loop
- Real-time particle simulation
- Visual feedback for emitter shapes

**Export Functionality:**
- Bakes animation at specified FPS
- Generates Spine JSON and texture atlas
- Creates downloadable ZIP file
- Error handling and user feedback

## Development Workflows

### Version Management

- **Current Approach**: Keep latest 1-2 versions in repository
- **Version Naming**: `particle-spine-exporter_alpha_vXX.tsx` (e.g., v85)
- **Old Versions**: Delete after successful merge to keep repo clean
- **Version History**: Document changes in file header comments

### Making Changes

1. **Always Read First**: Never propose changes without reading the file
2. **Understand Context**: Review current version's header comments for recent changes
3. **Maintain Structure**: Follow the established 9-section architecture
4. **Test Interactively**: Changes should be testable in browser environment

### Testing Considerations

Since there's no test suite:
- Manual testing required for UI changes
- Verify particle physics visually in canvas
- Test export by importing into Spine editor
- Check all curve editor interactions
- Validate ZIP file generation

### Git Workflow

**Branch Naming:**
- AI assistant branches: `claude/claude-md-{session-id}`
- Feature branches: Descriptive names
- Always develop on designated branch

**Commit Guidelines:**
- Clear, concise messages describing user-facing changes
- Examples: "v85 UI layout updates", "Fix curve interpolation bug"
- Group related changes in single commit

**Push Protocol:**
- Always use: `git push -u origin <branch-name>`
- Branch must start with `claude/` for AI assistant work
- Retry up to 4 times with exponential backoff on network errors (2s, 4s, 8s, 16s)

## Key Conventions

### Code Style

**TypeScript:**
- Strict typing throughout
- Interface-based type definitions
- Explicit return types for complex functions

**React Patterns:**
- Functional components with hooks
- Immutable state updates (spread operators)
- UseEffect for canvas animation loops
- UseRef for canvas and DOM references

**Naming Conventions:**
- PascalCase: Components, types, classes (`ParticleSystem`, `CurveEditor`)
- camelCase: Functions, variables (`evaluateCurve`, `currentTime`)
- UPPER_SNAKE_CASE: Constants (`DEFAULT_CURVE_PRESETS`)

**Formatting:**
- No semicolons (consistent omission)
- Template literals for strings
- Destructuring for props and objects

### State Management

**Immutability Pattern:**
```typescript
// Correct
setParticleSettings(prev => ({
  ...prev,
  lifetime: { ...prev.lifetime, min: value }
}))

// Incorrect (mutation)
particleSettings.lifetime.min = value
setParticleSettings(particleSettings)
```

**Normalized Time Values:**
- All curve/gradient times use range [0, 1]
- Convert to actual seconds using duration when needed
- Ensures curves work with any animation length

### Physics Conventions

**Units:**
- Position: Canvas pixels
- Velocity: Pixels per second
- Acceleration: Pixels per second squared
- Time: Seconds (normalized to 0-1 for curves)

**Coordinate System:**
- Origin: Top-left corner
- X-axis: Left to right
- Y-axis: Top to bottom
- Gravity typically positive Y value (down)

### Export Conventions

**Spine Format:**
- Version: 4.2.x compatible
- Skeleton name: "particle-effect"
- Bone hierarchy: root → emitter → particle bones
- Keyframe optimization enabled by default

**Texture Atlas:**
- PNG format
- Power-of-2 dimensions when possible
- Maximum 2048x2048 (configurable)
- Padding between sprites to prevent bleeding

**File Naming:**
- JSON: `{name}.json`
- Atlas: `{name}.atlas.txt`
- Texture: `{name}.png`
- ZIP: `{name}.zip`

## Architecture Patterns

### Curve System

**Purpose:** Animates particle properties over their lifetime

**Structure:**
- Array of `CurvePoint` with time (0-1) and value
- Smooth or linear interpolation
- Interactive graph editor for visual editing

**Evaluation:**
```typescript
evaluateCurve(curve, t):
  - Find surrounding points at time t
  - Interpolate between points (linear or cubic)
  - Return computed value
```

**Common Curves:**
- Size: Fade in, peak, fade out
- Speed: Start fast, slow down
- Weight: Increase over time (fall faster)
- Spin: Constant or accelerating rotation
- Alpha: Fade in/out transparency

### Particle Simulation

**Lifecycle:**
1. **Spawn**: Create particle at emitter with initial properties
2. **Update**: Apply physics forces, update position/velocity
3. **Evaluate**: Apply curves for size, color, rotation
4. **Render**: Draw to canvas with current properties
5. **Death**: Remove when age > lifetime

**Physics Pipeline (per frame):**
```
1. Apply gravity to velocity
2. Apply drag (velocity *= 1 - drag * dt)
3. Apply noise forces (turbulence)
4. Apply attraction (to point or circle edge)
5. Apply vortex (tangential and radial forces)
6. Update position (position += velocity * dt)
7. Update age (age += dt)
```

### Export Pipeline

**Baking Process:**
1. **Reset**: Clear particle system, apply prewarm if looping
2. **Simulate**: Step through timeline at target FPS
3. **Capture**: Record all particle states at each frame
4. **Convert**: Transform to Spine bone keyframes
5. **Optimize**: Remove redundant keyframes within thresholds
6. **Package**: Bundle JSON, atlas, and textures into ZIP

**Keyframe Optimization:**
- Position threshold: 0.01 pixels
- Scale threshold: 0.001
- Rotation threshold: 0.001 degrees
- Color threshold: 0.01 (RGBA)
- Keeps first and last keyframes always

### UI State Synchronization

**Pattern:**
```typescript
// State change → Update system → Trigger re-render
const handleSettingChange = (newValue) => {
  setSettings(newValue)           // Update React state
  if (systemRef.current) {
    systemRef.current.settings = newValue  // Sync runtime
  }
}
```

**Canvas Rendering:**
- Separate from React render cycle
- RequestAnimationFrame loop
- Refs for canvas and system instances
- Cleanup on component unmount

## Important Constants & Thresholds

### Physics Constants

```typescript
// Particle System
MAX_PARTICLES = 10000              // Hard limit to prevent memory issues
DEFAULT_LIFETIME = 2.0             // Seconds
DEFAULT_SPAWN_RATE = 50            // Particles per second

// Forces
DEFAULT_GRAVITY = 200              // Pixels/second²
DEFAULT_DRAG = 0.1                 // Velocity damping factor
DEFAULT_NOISE_STRENGTH = 50        // Noise force magnitude

// Vortex
VORTEX_TANGENTIAL_FORCE = 100      // Rotational force
VORTEX_RADIAL_FORCE = 50           // Inward/outward force
```

### Export Thresholds

```typescript
// Keyframe Optimization
POSITION_THRESHOLD = 0.01          // Pixels
SCALE_THRESHOLD = 0.001            // Scale factor
ROTATION_THRESHOLD = 0.001         // Degrees
COLOR_THRESHOLD = 0.01             // RGBA components

// Texture Atlas
MAX_ATLAS_SIZE = 2048              // Maximum texture dimension
SPRITE_PADDING = 2                 // Pixels between sprites
DEFAULT_PARTICLE_SIZE = 64         // Base sprite size
```

### UI Constants

```typescript
// Timeline
DEFAULT_DURATION = 3.0             // Seconds
MIN_DURATION = 0.1                 // Minimum animation length
MAX_DURATION = 60.0                // Maximum animation length

// Canvas
CANVAS_WIDTH = 600                 // Default viewport width
CANVAS_HEIGHT = 400                // Default viewport height
BACKGROUND_COLOR = '#1a1a1a'       // Dark gray

// Curve Editor
MIN_CURVE_POINTS = 2               // Minimum for valid curve
CURVE_POINT_RADIUS = 6             // Hit detection radius
CURVE_LINE_WIDTH = 2               // Stroke width
```

## Magic Numbers to Avoid Changing

These values are carefully tuned for optimal results:

- **Noise seed variation**: `simpleNoise(x * 0.01)` - The 0.01 multiplier controls noise frequency
- **Cubic interpolation smoothness**: Hermite tangent calculation in `evaluateCurve()`
- **Vortex angle calculation**: `Math.atan2(dy, dx)` for spiral forces
- **Prewarm step size**: `1/60` seconds (60 FPS simulation during prewarm)
- **Color interpolation**: Linear RGB interpolation (not HSV) for predictable results
- **Canvas composite operation**: `'lighter'` blend mode for additive particle rendering

## Common Tasks

### Adding a New Curve

1. Define curve in `ParticleSettings` type
2. Add to `DEFAULT_CURVE_PRESETS`
3. Add UI editor in main component
4. Apply in `ParticleSystem.updateParticle()` or `draw()` methods

### Adding a New Emitter Shape

1. Add shape type to `EmitterSettings.shape` union
2. Add shape parameters to `EmitterSettings`
3. Implement spawn logic in `ParticleSystem.spawnParticle()`
4. Add UI controls in main component
5. Add visual preview in canvas rendering

### Adding a New Force Type

1. Add force settings to `ParticleSettings`
2. Implement force calculation in `ParticleSystem.updateParticle()`
3. Add UI controls with range sliders
4. Document force units and expected ranges

### Optimizing Export

1. Adjust keyframe thresholds in `generateSpineJSON()`
2. Reduce FPS for less critical animations
3. Limit particle count
4. Simplify curves (fewer points)
5. Use smaller texture sizes

## Debugging Tips

### Canvas Issues
- Check canvas ref is connected: `canvasRef.current !== null`
- Verify RAF loop is running: Check `animationFrameIdRef.current`
- Inspect particle count: Log `particles.length` in update loop

### Physics Problems
- Add visual debug rendering: Draw velocity vectors, force indicators
- Log particle properties: Position, velocity, age
- Verify time step: Ensure `dt` is in seconds, not milliseconds

### Export Problems
- Check baked frame count: Should match `duration * fps`
- Verify atlas generation: Inspect returned region coordinates
- Test ZIP structure: Use external tool to validate ZIP format
- Import to Spine: Best way to validate complete export pipeline

## Version History

- **v50** (Early versions): Basic particle system, simple emission
- **v71-v83**: Added curves, emission modes, physics forces, sprite types
- **v84**: Stable version with full feature set
- **v85** (Nov 23, 2025): UI layout reorganization - 3-column layout, color editor moved to curves section

## Future Considerations

When extending this codebase, consider:

- **Performance**: Large particle counts (>5000) may cause frame drops
- **Browser Compatibility**: Canvas API and RAF are universal, but test on target browsers
- **Memory Management**: Ensure particles are properly cleaned up
- **File Size**: Large animations with high FPS create big JSON files
- **Integration**: Component expects to run in environment with React, TypeScript, Tailwind
- **Build System**: May need Vite/Webpack configuration when integrating into projects

## AI Assistant Guidelines

When working on this codebase:

1. **Always read the file first** - Don't propose changes blindly
2. **Check version number** - Ensure you're editing the correct file
3. **Maintain structure** - Keep the 9-section architecture intact
4. **Test assumptions** - Particle physics can be unintuitive, verify behavior
5. **Document changes** - Update header comments with version and changes
6. **Consider performance** - Canvas rendering is expensive, optimize where possible
7. **Preserve magic numbers** - Don't change physics constants without understanding impact
8. **Follow immutability** - All React state updates must be immutable
9. **Use proper types** - TypeScript strict mode is implied, maintain type safety
10. **Think about integration** - This is a component, not a standalone app

---

**Note:** This is a living document. Update it when making significant architectural changes or adding new patterns to the codebase.
