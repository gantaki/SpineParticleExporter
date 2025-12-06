# Spine Particle Exporter v107

A React/TypeScript application for converting particle system animations into Spine 4.2 skeletal animation format. Features a clean, layered architecture with FSM-based state management and Observer pattern for high-performance rendering.

## Features

- **Multi-Emitter System**: Up to 5 independent particle emitters with per-emitter settings
- **Per-Emitter Sprites**: Unique sprite selection per emitter (procedural or custom uploads)
- **Visual Particle Design**: Interactive curve editors, color gradient pickers, and real-time preview
- **Physics Simulation**: Gravity, drag, noise fields, attraction points, vortex forces, spin
- **Emitter Shapes**: Point, circle, rectangle, rounded rectangle, line (edge/area emission)
- **Emission Modes**: Continuous, burst, and duration-based emission
- **Curve-Based Animation**: Control size, speed, opacity, color, and forces over particle lifetime
- **Looping & Prewarm**: Seamless loop animations with prewarm support
- **Export to Spine 4.2**: Complete ZIP package with skeleton JSON, texture atlas, and PNG

## Technology Stack

- **React 18+** with TypeScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **HTML5 Canvas 2D API** for rendering

## Architecture

The application follows a **layered architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  (Panels, Fields, Viewport - React Components)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Controller Layer                         │
│  (useParticleBridge hook - orchestrates engine & UI)        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│  State Layer     │ │ Engine Layer │ │    Export Layer      │
│ (FSM + Contexts) │ │ (Simulation) │ │ (Baking + Spine JSON)│
└──────────────────┘ └──────────────┘ └──────────────────────┘
```

### Key Patterns

- **Finite State Machine (FSM)**: Editor states (IDLE, PLAYING, PAUSED, SCRUBBING, EXPORTING)
- **Observer Pattern**: ParticleEngine notifies stats without React re-renders
- **Context Pattern**: SettingsContext (model) + ViewportContext (ephemeral UI state)
- **DRY Components**: Reusable form fields (LabeledNumber, LabeledSelect, RangeCurveCombo, etc.)

When designing and implementing this system, apply SOLID as follows:

Single Responsibility Principle (SRP)
Treat each module as responsible for exactly one well-defined concern (e.g., emission logic, curve evaluation, range sampling, serialization). Avoid mixing unrelated responsibilities inside a single class, function, or file.

Open/Closed Principle (OCP)
Design curves, ranges, and similar behaviors so they can be extended (e.g., by adding new curve types, distribution strategies, or modifiers) without changing existing code. Prefer plug-in style registries, strategy objects, or configuration-driven behavior over hardcoded branching.

Liskov Substitution Principle (LSP)
Avoid deep inheritance hierarchies. Do not rely on subclasses that weaken or break the expected behavior of their base. Prefer composition and clearly defined interfaces so that any implementation can be substituted without changing client code semantics.

Interface Segregation Principle (ISP)
Expose small, focused interfaces or hooks instead of one large, monolithic API. Each consumer should depend only on the methods/events it actually uses (e.g., separate interfaces for sampling, updating, rendering, exporting).

Dependency Inversion Principle (DIP)
High-level components must depend on abstractions (contexts, interfaces, configuration objects), not concrete implementations. Inject dependencies (e.g., random source, time provider, math/curve engine, export backend) via constructors or context objects so implementations can be swapped or mocked without modifying core logic.

## Project Structure

```
spine-particle-exporter/
├── src/
│   ├── App.tsx                  # Page layout, panel orchestration, preview wiring
│   ├── main.tsx                 # React root
│   ├── index.css                # Tailwind + global styles
│   ├── components/              # UI components
│   │   ├── Viewport.tsx         # Preview canvas with timeline controls
│   │   ├── Timeline.tsx         # Transport & scrubber UI
│   │   ├── CurveEditorNew.tsx   # Unified curve editor
│   │   ├── CurveEditor.tsx      # Legacy curve editor (compatibility)
│   │   ├── ColorGradientEditor.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── RangeInput.tsx       # Shared range/number control
│   │   ├── fields/              # Reusable form fields (index.tsx)
│   │   ├── panels/              # Settings and management panels
│   │   │   ├── EmitterManagementPanel.tsx
│   │   │   ├── EmitterSettingsPanel.tsx
│   │   │   ├── ParticleSettingsPanel.tsx
│   │   │   ├── ForcesPanel.tsx
│   │   │   ├── CurvesPanel.tsx
│   │   │   └── ExportPanel.tsx
│   │   └── helpers.ts           # Shared component utilities
│   ├── context/                 # React Contexts
│   │   ├── SettingsContext.tsx  # Particle settings (model state)
│   │   └── ViewportContext.tsx  # Ephemeral UI state (zoom, grid, etc.)
│   ├── state/                   # State Management
│   │   └── EditorMachine.ts     # FSM reducer for editor states
│   ├── engine/                  # Particle Simulation
│   │   └── ParticleEngine.ts    # Core simulation with Observer pattern
│   ├── hooks/                   # Custom React Hooks
│   │   ├── useParticleBridge.ts # Controller: connects engine to UI
│   │   └── useSpriteManager.ts  # Sprite loading/caching
│   ├── export/                  # Export Functionality
│   │   ├── sprites.ts           # Procedural sprite generation
│   │   ├── atlas.ts             # Texture atlas packing
│   │   ├── baking.ts            # Animation frame capture
│   │   ├── spine-json.ts        # Spine skeleton JSON generation
│   │   ├── zip.ts               # ZIP file utilities
│   │   ├── index.ts             # Barrel exports
│   │   └── EXPORT.md            # Export system documentation
│   ├── types/                   # TypeScript Definitions
│   │   └── index.ts             # All interfaces and constants
│   ├── utils/                   # Utility Functions
│   │   └── index.ts             # Math, curves, noise, etc.
├── index.html                   # HTML entry for Vite
├── vite.config.ts               # Vite configuration
├── tailwind.config.js           # Tailwind setup
├── tsconfig.json                # TypeScript compiler options
└── package.json                 # Scripts and dependencies
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The app runs on `http://localhost:5173` with hot module replacement.

### Build for Production

```bash
npm run build
npm run preview  # Preview production build
```

## Usage

1. **Manage Emitters**: Add/remove emitters, set visibility, select active emitter
2. **Configure Emission**: Set shape, position, emission type (continuous/burst/duration)
3. **Particle Properties**: Lifetime, initial speed, sprite selection, spawn angle
4. **Physics Forces**: Gravity, drag, noise field, attraction point, vortex
5. **Lifetime Curves**: Size, speed, weight, color gradients over particle lifetime
6. **Preview**: Real-time canvas preview with play/pause, timeline scrubbing
7. **Export**: Configure thresholds, select emitters, export ZIP for Spine

## Export System

The export system converts particle simulations to Spine 4.2 skeletal animations:

1. **Baking**: Simulates particles frame-by-frame, capturing snapshots
2. **Spine JSON**: Converts snapshots to bones, slots, skins, and animations
3. **Atlas**: Packs sprites into texture atlas with .atlas file

See [`src/export/EXPORT.md`](src/export/EXPORT.md) for detailed documentation on adding new export formats.

## Version History

### v107 (Current)

Colorize Sprite performance release:

- **Cached tinted sprites**: Colorized rendering now caches tinted sprite variants per emitter and sprite, dramatically reducing per-particle CPU overhead.
- **Color quantization for cache hits**: Colors are quantized before tinting to reuse cached bitmaps across similar gradient values, lowering recolor frequency during heavy previews.
- **Preview stability**: Colorize Sprite mode now scales closer to non-colorized performance before FPS drops appear.

### v106

Spine export rotation fixes:

- **Fixed Rotation Export to Spine JSON**:
  - Changed rotation keyframe field from `"angle"` to `"value"` to match Spine 4.2 JSON format specification
  - Fixed conversion of `spinRange` and `angularVelocityRange` from degrees/second to radians/second
  - Rotation values now export correctly without sign inversion (positive = clockwise in Spine)
  - This ensures particle rotation works properly in Spine and matches the numerical values from the editor

### v105

UI/UX improvements release:

- **Value Scrubbing for Numeric Inputs**: All numeric input fields now support drag-to-adjust functionality
  - Drag right to increase value, drag left to decrease
  - Intelligent step sizing based on current value magnitude
  - Visual feedback with cursor change during scrubbing
- **Unified Curve Editor**: All curve sections now use the enhanced CurveEditorNew component
  - Consistent curve editing experience across all panels
  - Bezier handles, zoom, and preset support everywhere
- **Code Quality**: Updated CurveEditorNew to use centralized `roundToDecimals` utility function (DRY principle)

### v104

Major release focusing on Emitter Settings Panel improvements and advanced curve editing:

- **Enhanced Prewarm Control**: Prewarm is now independent of looping and available for both Continuous and Duration emission modes
- **Reorganized Settings Layout**:
  - Start Delay moved to separate control (no longer grouped with loop settings)
  - Emission Rate and Rate Multiplier combined into collapsible sub-section
  - Shape, Angle, Spread, and emission direction grouped into collapsible "Shape & Emission Direction" sub-section
  - Emitter Position moved to bottom of panel for better workflow
- **Advanced Curve Editor (CurveEditorNew.tsx)**:
  - New curve presets: Ease In, Ease Out, Ease In-Out
  - Bezier handles for fine-tuning curve points (available in Smooth mode)
  - 3x zoom button for precise curve adjustments
  - First implementation in Emission Rate section (foundation for future curve editor updates)
- Improved panel organization with inline collapsible sections for better space efficiency

### v103

- Enhanced Emitters Panel with advanced management features:
  - Double-click to rename emitters with auto-selection
  - Drag and drop to reorder emitters (controls render layering)
  - Duplicate emitter button with full settings copy
  - Enable/disable checkbox for complete emitter control
  - Fixed render order: top emitters now properly overlay bottom emitters
- Improved UX with auto-focus on newly created emitters
- Better visual feedback for disabled emitters

### v102

- Complete architecture refactoring (FSM, Observer pattern, layered design)
- Extracted reusable field components (DRY)
- Split export module into focused files
- App.tsx reduced from 1500+ to ~200 lines
- ParticleEngine with stats observer (bypasses React render cycle)

### v101

- Migrated to Vite build system
- Custom sprites retain native resolution
- Curve multipliers clamped to -1..1

### v100

- Burst and Duration modes export baked animations
- Per-emitter sprites with custom uploads

## Development Guide

### Adding New Features

1. **Types**: Define interfaces in `src/types/index.ts`
2. **Engine**: Extend `ParticleEngine` for new physics/behaviors
3. **UI**: Create panel components in `src/components/panels/`
4. **Hooks**: Add custom hooks in `src/hooks/` for complex logic
5. **Export**: See `src/export/EXPORT.md` for adding export formats

### Code Style

- TypeScript strict mode
- Functional React components with hooks
- Memoization for expensive computations
- Tailwind CSS utility classes
- Observer pattern for high-frequency updates

## License

MIT

## Contributing

Pull requests welcome. For major changes, please open an issue first.
