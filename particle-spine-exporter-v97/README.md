# Particle Spine Exporter v97 - Modular Structure

This is the modular version of the Particle Spine Exporter, refactored from v96 for better maintainability.

## 📁 File Structure

```
particle-spine-exporter-v97/
├── types.ts           (~300 lines) - All TypeScript interfaces, types, and constants
├── utils.ts           (~150 lines) - Utility functions (noise, curves, math)
├── core.ts            (~700 lines) - ParticleSystem simulation engine
├── export.ts          (~1200 lines) - Export logic (sprites, atlas, baking, Spine JSON)
├── components.tsx     (~1000 lines) - React UI components
└── index.tsx          (~800 lines) - Main ParticleSpineExporter component
```

## 🚀 Usage

### For Development (Modular)

Edit the individual module files:
- Types and constants → `types.ts`
- Particle physics → `core.ts`
- UI components → `components.tsx`
- Export functionality → `export.ts`
- etc.

### For Distribution (Standalone)

Build a single self-contained file:

```bash
npm run build
```

This creates `particle-spine-exporter_alpha_v97.tsx` - a standalone file that can be used without a build system.

## 🔧 Available Commands

```bash
# Build standalone version from modules
npm run build

# Re-split v96 into modules (if needed)
npm run split
```

## 📝 Development Workflow

1. **Edit modules** in `particle-spine-exporter-v97/` directory
2. **Test changes** in your development environment
3. **Build standalone** with `npm run build`
4. **Distribute** the generated `particle-spine-exporter_alpha_v97.tsx`

## 🎯 Benefits of Modular Structure

- ✅ **Easier navigation** - Find code quickly by category
- ✅ **Better maintainability** - Smaller files, clearer responsibilities
- ✅ **Isolated changes** - Modify UI without touching physics
- ✅ **Team collaboration** - Multiple developers can work on different modules
- ✅ **Backward compatible** - Build script generates traditional single-file version

## 📦 Module Descriptions

### `types.ts`
All TypeScript type definitions, interfaces, default presets, and settings. No runtime logic, just type safety and configuration.

### `utils.ts`
Pure functions for mathematical operations, curve evaluation, noise generation, and color interpolation. No side effects, fully testable.

### `core.ts`
The `ParticleSystem` class - handles particle spawning, physics simulation, lifetime management, and rendering to canvas.

### `export.ts`
Everything related to exporting:
- Sprite generation (circle, star, polygon, glow)
- Texture atlas packing
- Animation baking (simulation capture)
- Spine 4.2 JSON generation
- ZIP file creation

### `components.tsx`
All React UI components:
- `ColorPicker` - HSV color wheel selector
- `ColorGradientEditor` - Timeline-based color animation
- `CurveEditor` - Interactive graph for animation curves
- `Timeline` - Playback controls
- `RangeInput` - Min/max value editor
- `CollapsibleSection` - Expandable UI panels

### `index.tsx`
Main `ParticleSpineExporter` component that ties everything together. Manages application state, canvas rendering, and user interactions.

## 🔄 Reverting to Monolithic Structure

If you need to go back to a single-file structure:

```bash
npm run build
```

The generated file is functionally identical to the original v96, just with cleaner organization.

## 📚 Related Files

- `../build-standalone.js` - Script that combines modules into single file
- `../split-to-modules.js` - Script that splits v96 into modules
- `../package.json` - NPM scripts configuration

## 🆚 Comparison with v96

| Aspect | v96 (Monolithic) | v97 (Modular) |
|--------|------------------|---------------|
| Total lines | 4135 | 4175 (split across 6 files) |
| Largest file | 4135 lines | ~1200 lines |
| Maintainability | Hard to navigate | Easy to find code |
| Collaboration | Merge conflicts | Isolated changes |
| Distribution | Ready to use | Build step required |

## 🎓 Best Practices

1. **Keep types in sync** - When adding features, update `types.ts` first
2. **Pure functions** - Keep `utils.ts` side-effect free
3. **Component isolation** - Each component in `components.tsx` should be self-contained
4. **Core stability** - The `ParticleSystem` class is the heart - test changes thoroughly
5. **Build before commit** - Always run `npm run build` to ensure standalone version works

---

**Version:** 97.0.0
**Based on:** v96 (2025-11-25)
**Refactored:** 2025-11-25
