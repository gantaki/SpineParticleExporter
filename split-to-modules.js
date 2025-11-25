#!/usr/bin/env node
/**
 * Split v96 into modular structure for v97
 */

const fs = require('fs');
const path = require('path');

const inputFile = './particle-spine-exporter_alpha_v96.tsx';
const outputDir = './particle-spine-exporter-v97';

// Read the entire v96 file
const content = fs.readFileSync(inputFile, 'utf8');
const lines = content.split('\n');

// Helper to extract lines by range
function extractLines(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

// Helper to find line numbers by pattern
function findLine(pattern, startFrom = 0) {
  for (let i = startFrom; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1; // 1-indexed
    }
  }
  return -1;
}

// Find key boundaries
console.log('Analyzing file structure...');

const boundaries = {
  // Find interface definitions
  interfaceStart: 18,
  // Find DEFAULT_CURVE_PRESETS
  defaultCurveStart: findLine(/^const DEFAULT_CURVE_PRESETS/),
  // Find DEFAULT_SETTINGS
  defaultSettingsStart: findLine(/^const DEFAULT_SETTINGS/),
  // Find first utility function
  utilsStart: findLine(/^function simpleNoise/),
  // Find ColorPicker component
  colorPickerStart: findLine(/^const ColorPicker:/),
  // Find ParticleSystem class
  particleSystemStart: findLine(/^class ParticleSystem/),
  // Find createParticleSprite
  exportStart: findLine(/^function createParticleSprite/),
  // Find main component
  mainComponentStart: findLine(/^const ParticleSpineExporter/),
  // Find export default
  exportDefault: findLine(/^export default ParticleSpineExporter/),
};

console.log('Boundaries found:', boundaries);

// ============ CREATE types.ts ============
console.log('Creating types.ts...');

const typesContent = `/**
 * Type definitions and constants for Particle Spine Exporter v97
 */

// ========== Types and Interfaces ==========

${extractLines(18, boundaries.defaultCurveStart - 1)}

// ========== Default Presets ==========

${extractLines(boundaries.defaultCurveStart, boundaries.defaultSettingsStart - 1)}

// ========== Default Settings ==========

${extractLines(boundaries.defaultSettingsStart, boundaries.utilsStart - 1)}

export {
  type Vec2,
  type Color,
  type CurvePoint,
  type Curve,
  type RangeValue,
  type ColorPoint,
  type ColorGradient,
  type EmitterSettings,
  type ExportSettings,
  type ParticleSettings,
  type Particle,
  type BakedFrame,
  type AtlasRegion,
  DEFAULT_CURVE_PRESETS,
  DEFAULT_SETTINGS,
};
`;

fs.writeFileSync(path.join(outputDir, 'types.ts'), typesContent);

// ============ CREATE utils.ts ============
console.log('Creating utils.ts...');

const utilsContent = `/**
 * Utility functions for curves, noise, and math operations
 */

import type { Curve, ColorGradient, Color, RangeValue, Vec2 } from './types';

${extractLines(boundaries.utilsStart, boundaries.colorPickerStart - 1)}

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

// ============ CREATE components.tsx ============
console.log('Creating components.tsx...');

const componentsContent = `/**
 * UI Components for Particle Spine Exporter v97
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';
import type { Color, ColorGradient, ColorPoint, Curve, CurvePoint, RangeValue } from './types';
import { clamp01, evaluateCurve, evaluateColorGradient } from './utils';

${extractLines(boundaries.colorPickerStart, boundaries.particleSystemStart - 1)}

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

// ============ CREATE core.ts ============
console.log('Creating core.ts...');

const coreContent = `/**
 * Core ParticleSystem simulation engine
 */

import type { ParticleSettings, Particle, Vec2, Color } from './types';
import { sampleRange, evaluateCurve, evaluateColorGradient, noise2D } from './utils';

${extractLines(boundaries.particleSystemStart, boundaries.exportStart - 1)}

export { ParticleSystem };
`;

fs.writeFileSync(path.join(outputDir, 'core.ts'), coreContent);

// ============ CREATE export.ts ============
console.log('Creating export.ts...');

const exportContent = `/**
 * Export functionality: sprite generation, atlas packing, baking, Spine JSON generation
 */

import type { ParticleSettings, BakedFrame, AtlasRegion, Color } from './types';
import { ParticleSystem } from './core';

${extractLines(boundaries.exportStart, boundaries.mainComponentStart - 1)}

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

// ============ CREATE index.tsx ============
console.log('Creating index.tsx...');

const indexContent = `/**
 * Particle → Spine Exporter v97 (Alpha) - Main Component
 *
 * Version: 97
 * Date: 2025-11-25
 *
 * Changes in v97:
 * - Refactored into modular structure for better maintainability
 * - Split into 6 modules: types, utils, components, core, export, index
 * - Added build script to generate standalone version
 * - All functionality preserved from v96
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';

// Type imports
import type { ParticleSettings, Curve, RangeValue, Vec2 } from './types';
import { DEFAULT_SETTINGS } from './types';

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

${extractLines(boundaries.mainComponentStart, boundaries.exportDefault)}
`;

fs.writeFileSync(path.join(outputDir, 'index.tsx'), indexContent);

console.log('\n✅ Successfully split v96 into modular v97 structure!');
console.log('\nCreated files:');
console.log('  - types.ts');
console.log('  - utils.ts');
console.log('  - components.tsx');
console.log('  - core.ts');
console.log('  - export.ts');
console.log('  - index.tsx');
