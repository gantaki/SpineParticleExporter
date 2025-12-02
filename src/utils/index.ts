/**
 * Utility functions for curves, noise, and math operations
 */

import type { Curve, ColorGradient, Color, RangeValue, Vec2 } from '../types';

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function simpleNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function noise2D(x: number, y: number, time: number): Vec2 {
  const steppedTime = Math.floor(time * 3);
  const coarse = simpleNoise(x * 1.37 + steppedTime * 11.17, y * 1.37 - steppedTime * 7.41);
  const spikes = Math.pow(simpleNoise(x * 4.11 + time * 6.73, y * 4.11 - time * 5.29), 3);
  const flicker = (simpleNoise(x * 0.63 + steppedTime * 3.19, y * 0.63 - steppedTime * 2.71) * 2 - 1) * 0.35;

  const baseAngle = (coarse * 2 - 1) * Math.PI + flicker * Math.PI;
  const pulse = Math.abs(Math.sin((time + coarse) * 6)) * 0.35;
  const strength = Math.min(2, 0.35 + spikes * 1.4 + pulse + Math.abs(flicker));

  return {
    x: Math.cos(baseAngle) * strength,
    y: Math.sin(baseAngle) * strength
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function roundToDecimals(value: number, decimals: number = 2): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round(value * multiplier) / multiplier;
}

function sampleRange(range: RangeValue): number {
  return range.min + Math.random() * (range.max - range.min);
}

function copyCurve(curve: Curve): Curve {
  return {
    interpolation: curve.interpolation,
    points: curve.points.map(p => ({ time: p.time, value: p.value }))
  };
}

function evaluateCurve(curve: Curve, t: number): number {
  t = Math.max(0, Math.min(1, t));
  
  const points = [...curve.points].sort((a, b) => a.time - b.time);
  
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].value;
  
  let i = 0;
  while (i < points.length - 1 && points[i + 1].time < t) {
    i++;
  }
  
  if (i >= points.length - 1) return points[points.length - 1].value;
  
  const p1 = points[i];
  const p2 = points[i + 1];
  
  const localT = (t - p1.time) / (p2.time - p1.time);
  
  if (curve.interpolation === 'linear') {
    return p1.value + (p2.value - p1.value) * localT;
  } else {
    const smoothT = localT < 0.5 
      ? 2 * localT * localT 
      : 1 - Math.pow(-2 * localT + 2, 2) / 2;
    return p1.value + (p2.value - p1.value) * smoothT;
  }
}

function evaluateColorGradient(gradient: ColorGradient, t: number): Color {
  t = Math.max(0, Math.min(1, t));
  
  const points = [...gradient.points].sort((a, b) => a.time - b.time);
  
  if (points.length === 0) return { r: 255, g: 255, b: 255, a: 255 };
  if (points.length === 1) return { ...points[0].color };
  
  let i = 0;
  while (i < points.length - 1 && points[i + 1].time < t) {
    i++;
  }
  
  if (i >= points.length - 1) return { ...points[points.length - 1].color };
  
  const p1 = points[i];
  const p2 = points[i + 1];
  
  const localT = (t - p1.time) / (p2.time - p1.time);
  
  return {
    r: Math.round(p1.color.r + (p2.color.r - p1.color.r) * localT),
    g: Math.round(p1.color.g + (p2.color.g - p1.color.g) * localT),
    b: Math.round(p1.color.b + (p2.color.b - p1.color.b) * localT),
    a: Math.round(p1.color.a + (p2.color.a - p1.color.a) * localT),
  };
}


export {
  simpleNoise,
  noise2D,
  clamp01,
  roundToDecimals,
  sampleRange,
  copyCurve,
  evaluateCurve,
  evaluateColorGradient,
};
