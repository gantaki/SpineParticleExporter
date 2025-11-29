# Spine Particle Exporter v101 (Vite Edition)

A React/TypeScript application for converting particle system animations into Spine 4.2 skeletal animation format.

## Features

- **Multi-Emitter System**: Up to 5 independent particle emitters
- **Per-Emitter Sprites**: Unique sprite selection per emitter
- **Visual Particle Design**: Interactive editors for complex particle systems
- **Real-Time Preview**: HTML5 Canvas-based simulation
- **Physics Simulation**: Gravity, drag, noise, attraction, vortex forces
- **Emitter Shapes**: Point, circle, rectangle, rounded rectangle, line
- **Curve-Based Animation**: Control particle properties over lifetime
- **Color Gradients**: Multi-keyframe color animations
- **Export to Spine**: Complete ZIP package with JSON and PNG files

## Technology Stack

- **React 18+** with TypeScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **HTML5 Canvas 2D API** for rendering

## Project Structure

```
spine-particle-exporter/
├── src/
│   ├── components/     # UI components
│   │   └── index.tsx   # ColorPicker, CurveEditor, Timeline, etc.
│   ├── core/           # Particle simulation engine
│   │   └── index.ts    # ParticleSystem class
│   ├── export/         # Export functionality
│   │   └── index.ts    # Sprite generation, Spine JSON generation
│   ├── types/          # TypeScript type definitions
│   │   └── index.ts    # All interfaces and constants
│   ├── utils/          # Utility functions
│   │   └── index.ts    # Math and curve evaluation
│   ├── App.tsx         # Main application component
│   ├── main.tsx        # Vite entry point
│   └── index.css       # Global styles with Tailwind
├── index.html          # HTML template
├── vite.config.ts      # Vite configuration
├── tsconfig.json       # TypeScript configuration
├── tailwind.config.js  # Tailwind CSS configuration
└── package.json        # Project dependencies
```

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server (runs on http://localhost:3000)
npm run dev
```

The app will automatically open in your default browser with hot module replacement enabled.

### Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

The built files will be in the `dist/` directory.

## Usage

1. **Configure Emitters**: Add up to 5 emitters and adjust their positions and shapes
2. **Set Particle Properties**: Configure lifetime, physics, size, rotation, and colors
3. **Preview in Real-Time**: See your particle system animated in the viewport
4. **Export**: Generate a ZIP file containing Spine JSON and texture atlases

## Version History

### v101 (Current - Vite Edition)
- Migrated to Vite build system
- Restructured into modular src/ architecture
- Added proper TypeScript configuration
- Improved development experience with HMR

### v101 (Alpha)
- Custom sprites retain native resolution
- Improved emitter settings UI
- Curve multipliers clamped to -1..1

### v100
- Burst and Duration modes export baked animations
- Improved default values

### v99
- Per-emitter sprites with custom uploads
- Emitter visibility toggle
- Prewarm timing fixes

## Development

### Adding New Features

1. **Types**: Add new interfaces in `src/types/index.ts`
2. **Core Logic**: Extend `ParticleSystem` in `src/core/index.ts`
3. **UI Components**: Create components in `src/components/index.tsx`
4. **Main App**: Update `src/App.tsx` to integrate new features

### Code Style

- Use TypeScript for type safety
- Follow React hooks patterns
- Keep components pure and functional
- Use Tailwind CSS utility classes

## License

MIT

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
