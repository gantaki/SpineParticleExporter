# Spine Particle Exporter v102

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

## Project Structure

```
spine-particle-exporter/
├── src/
│   ├── components/           # UI Components
│   │   ├── fields/           # Reusable form field components
│   │   │   └── index.tsx     # LabeledNumber, LabeledSelect, RangeCurveCombo, etc.
│   │   ├── panels/           # Settings panel components
│   │   │   ├── EmitterManagementPanel.tsx
│   │   │   ├── EmitterSettingsPanel.tsx
│   │   │   ├── ParticleSettingsPanel.tsx
│   │   │   ├── ForcesPanel.tsx
│   │   │   ├── CurvesPanel.tsx
│   │   │   └── ExportPanel.tsx
│   │   ├── Viewport.tsx      # Canvas rendering component
│   │   ├── CurveEditor.tsx   # Bezier curve editor
│   │   ├── ColorGradientEditor.tsx
│   │   ├── ColorPicker.tsx
│   │   ├── Timeline.tsx
│   │   └── ...
│   │
│   ├── context/              # React Contexts
│   │   ├── SettingsContext.tsx   # Particle settings (model state)
│   │   └── ViewportContext.tsx   # Ephemeral UI state (zoom, grid, etc.)
│   │
│   ├── state/                # State Management
│   │   └── EditorMachine.ts  # FSM reducer for editor states
│   │
│   ├── engine/               # Particle Simulation
│   │   └── ParticleEngine.ts # Core simulation with Observer pattern
│   │
│   ├── hooks/                # Custom React Hooks
│   │   ├── useParticleBridge.ts  # Controller: connects engine to UI
│   │   └── useSpriteManager.ts   # Sprite loading/caching
│   │
│   ├── export/               # Export Functionality
│   │   ├── sprites.ts        # Procedural sprite generation
│   │   ├── atlas.ts          # Texture atlas packing
│   │   ├── baking.ts         # Animation frame capture
│   │   ├── spine-json.ts     # Spine skeleton JSON generation
│   │   ├── zip.ts            # ZIP file utilities
│   │   ├── index.ts          # Barrel exports
│   │   └── EXPORT.md         # Export system documentation
│   │
│   ├── types/                # TypeScript Definitions
│   │   └── index.ts          # All interfaces and constants
│   │
│   ├── utils/                # Utility Functions
│   │   └── index.ts          # Math, curves, noise, etc.
│   │
│   ├── App.tsx               # Main application (layout composition)
│   ├── main.tsx              # Vite entry point
│   └── index.css             # Global styles with Tailwind
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
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

### v102 (Current)

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
