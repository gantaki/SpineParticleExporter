# Particle Spine Exporter v101 - Modular Structure

Modularized source for the v101 release (full-res custom sprites, relocated emitter controls, clamped multiplier curves). Edit these files during development and rebuild the standalone TSX when ready to distribute.

## 📁 File Structure
```
particle-spine-exporter-v101/
├── types.ts           - TypeScript interfaces, presets, default settings
├── utils.ts           - Math helpers, curve evaluators, noise utilities
├── components.tsx     - Reusable React UI components
├── core.ts            - ParticleSystem simulation engine
├── export.ts          - Sprite generation, atlas packing, baking, Spine export
└── index.tsx          - Main ParticleSpineExporter component
```

## 🚀 Usage
- **Edit in modules**: Make all code changes inside the module files above.
- **Build standalone**: Run `npm run build:v101` to produce `particle-spine-exporter_alpha_v101.tsx` from the modules.
- **Standalone testing**: Open `standalone.html` (pointing at the v101 file) or serve via `npm run serve`.

## 🔧 Available Commands
```bash
# Build standalone v101 from modules
npm run build:v101

# Re-split the current v99 standalone into modules (safety net)
node split-v99-to-modules.js
```

## 🧭 Module Highlights
- **types.ts** – All shared types, curve presets, default emitter factory, and initial settings.
- **utils.ts** – Pure helpers for clamping, range sampling, curves, colors, and noise fields.
- **components.tsx** – UI widgets (color tools, curves, timeline, collapsible panels) used throughout the app.
- **core.ts** – `ParticleSystem` with multi-emitter simulation, visibility handling, and per-emitter sprite state.
- **export.ts** – Bakes frames, builds atlases (sprite_1, sprite_2, ...), and emits Spine 4.2 JSON + ZIP.
- **index.tsx** – React container wiring emitters, playback, sprite selection per emitter, and export actions.

## 📝 Workflow
1. Update or extend features inside the modules.
2. Rebuild the standalone TSX with `npm run build:v101`.
3. Commit the regenerated `particle-spine-exporter_alpha_v101.tsx` (or bump version per CLAUDE.md guidance).
