#!/usr/bin/env node
/**
 * Split v99 standalone file into modular structure for easier development.
 */

const fs = require('fs');
const path = require('path');

const inputFile = './particle-spine-exporter_alpha_v99.tsx';
const outputDir = './particle-spine-exporter-v99';

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

function extractLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function findLine(pattern, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return -1;
}

const boundaries = {
  typesStart: findLine(/^interface Vec2/),
  defaultCurveStart: findLine(/^const DEFAULT_CURVE_PRESETS/),
  defaultSettingsStart: findLine(/^const DEFAULT_SETTINGS/),
  utilityHeaderStart: findLine(/^\/\/ UTILITY FUNCTIONS/),
  utilsStart: findLine(/^function simpleNoise/),
  uiHeaderStart: findLine(/^\/\/ UI COMPONENTS/),
  colorPickerStart: findLine(/^const ColorPicker:/),
  coreHeaderStart: findLine(/^\/\/ PARTICLE SYSTEM CORE/),
  particleSystemStart: findLine(/^class ParticleSystem/),
  exportHeaderStart: findLine(/^\/\/ EXPORT FUNCTIONALITY/),
  exportStart: findLine(/^function createParticleSprite/),
  mainComponentStart: findLine(/^const ParticleSpineExporter/),
};

console.log('Boundaries:', boundaries);

// types.ts
const utilityHeaderBlockStart = Math.max(1, boundaries.utilityHeaderStart - 1);
const uiHeaderBlockStart = Math.max(1, boundaries.uiHeaderStart - 1);
const coreHeaderBlockStart = Math.max(1, boundaries.coreHeaderStart - 1);
const exportHeaderBlockStart = Math.max(1, boundaries.exportHeaderStart - 1);

const typesContent = `/**
 * Type definitions and constants for Particle Spine Exporter v99
 */

// ============================================================
// TYPES AND INTERFACES
// ============================================================

// ========== Types and Interfaces ==========

${extractLines(boundaries.typesStart, boundaries.defaultCurveStart - 1)}

${extractLines(boundaries.defaultCurveStart, boundaries.defaultSettingsStart - 1)}

${extractLines(boundaries.defaultSettingsStart, utilityHeaderBlockStart - 1)}

export {
  type Vec2,
  type Color,
  type CurvePoint,
  type Curve,
  type RangeValue,
  type ColorPoint,
  type ColorGradient,
  type EmitterInstanceSettings,
  type EmitterInstance,
  type ExportSettings,
  type ParticleSettings,
  type Particle,
  type BakedFrame,
  type AtlasRegion,
  type BakedParticleKey,
  DEFAULT_CURVE_PRESETS,
  createDefaultEmitterSettings,
  createEmitterInstance,
  DEFAULT_SETTINGS,
};
`;
fs.writeFileSync(path.join(outputDir, 'types.ts'), typesContent);

// utils.ts
const utilsContent = `/**
 * Utility functions for curves, noise, and math operations
 */

import type { Curve, ColorGradient, Color, RangeValue, Vec2 } from './types';

${extractLines(utilityHeaderBlockStart, uiHeaderBlockStart - 1)}

export {
  simpleNoise,
  noise2D,
  clamp01,
  sampleRange,
  copyCurve,
  evaluateCurve,
  evaluateColorGradient,
};
`;
fs.writeFileSync(path.join(outputDir, 'utils.ts'), utilsContent);

// components.tsx
const componentsContent = `/**
 * UI Components for Particle Spine Exporter v99
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings, ChevronDown, ChevronUp, Trash2, RefreshCw, Plus, Eye, EyeOff } from 'lucide-react';
import type { Color, ColorGradient, ColorPoint, Curve, CurvePoint, RangeValue } from './types';
import { clamp01, evaluateCurve, evaluateColorGradient } from './utils';

${extractLines(uiHeaderBlockStart, coreHeaderBlockStart - 1)}

export {
  ColorPicker,
  ColorGradientEditor,
  CurveEditor,
  Timeline,
  RangeInput,
  CollapsibleSection,
};
`;
fs.writeFileSync(path.join(outputDir, 'components.tsx'), componentsContent);

// core.ts
const coreContent = `/**
 * Core ParticleSystem simulation engine
 */

import type { ParticleSettings, Particle, Vec2, Color, EmitterInstance } from './types';
import { sampleRange, evaluateCurve, evaluateColorGradient, noise2D } from './utils';

${extractLines(coreHeaderBlockStart, exportHeaderBlockStart - 1)}

export { ParticleSystem };
`;
fs.writeFileSync(path.join(outputDir, 'core.ts'), coreContent);

// export.ts
const exportContent = `/**
 * Export functionality: sprite generation, atlas packing, baking, Spine JSON generation
 */

import type { ParticleSettings, BakedFrame, AtlasRegion, Color, EmitterInstance } from './types';
import { ParticleSystem } from './core';

${extractLines(exportHeaderBlockStart, boundaries.mainComponentStart - 1)}

export {
  createParticleSprite,
  createParticleAtlas,
  bakeParticleAnimation,
  renderBakedPreview,
  generateAtlasFile,
  generateSpineJSON,
  SimpleZip,
  downloadBlob,
};
`;
fs.writeFileSync(path.join(outputDir, 'export.ts'), exportContent);

// index.tsx
const mainSection = extractLines(boundaries.mainComponentStart, lines.length);
const sanitizedMain = mainSection.replace(/\n?\/\/ Make component globally available[\s\S]*?}\s*$/, '\n');

const indexContent = `/**
 * Particle → Spine Exporter v99 (Alpha) - Main Component
 *
 * Version: 99
 * Date: 2025-11-27
 *
 * Changes in v99:
 * - Fixed emitter visibility to hide particle output, not just gizmos
 * - Prewarm baking corrected to avoid extra warmup time and misplaced keys
 * - Drag defaults set to 1 for consistent damping
 * - Per-emitter particle sprites with new shapes and isolated selection
 * - Export now names attachments per emitter (sprite_1, sprite_2, ...)
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings, ChevronDown, ChevronUp, Trash2, RefreshCw, Plus, Eye, EyeOff } from 'lucide-react';

// Type imports
import type { ParticleSettings, Curve, RangeValue, Vec2, EmitterInstance, BakedFrame } from './types';
import { DEFAULT_SETTINGS, createEmitterInstance } from './types';

// Component imports
import {
  ColorPicker,
  ColorGradientEditor,
  CurveEditor,
  Timeline,
  RangeInput,
  CollapsibleSection,
} from './components';

// Core imports
import { ParticleSystem } from './core';

// Export imports
import {
  createParticleSprite,
  createParticleAtlas,
  bakeParticleAnimation,
  renderBakedPreview,
  generateAtlasFile,
  generateSpineJSON,
  SimpleZip,
  downloadBlob,
} from './export';

${sanitizedMain}

export default ParticleSpineExporter;
`;
fs.writeFileSync(path.join(outputDir, 'index.tsx'), indexContent);

console.log('\n✅ Successfully split v99 into modular structure!');
