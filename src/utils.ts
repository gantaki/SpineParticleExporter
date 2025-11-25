import { Color, ColorGradient, Curve, RangeValue } from './types';

export function simpleNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export function noise2D(x: number, y: number, time: number): { x: number; y: number } {
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

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function sampleRange(range: RangeValue): number {
  return range.min + Math.random() * (range.max - range.min);
}

export function copyCurve(curve: Curve): Curve {
  return {
    interpolation: curve.interpolation,
    points: curve.points.map(p => ({ time: p.time, value: p.value }))
  };
}

export function evaluateCurve(curve: Curve, t: number): number {
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

export function evaluateColorGradient(gradient: ColorGradient, t: number): Color {
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

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s = s / 100;
  l = l / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

export function shouldCreateKey(
  prevValue: number | { x: number; y: number },
  currentValue: number | { x: number; y: number },
  threshold: number
): boolean {
  if (typeof prevValue === 'number' && typeof currentValue === 'number') {
    return Math.abs(currentValue - prevValue) > threshold;
  }

  if (typeof prevValue === 'object' && typeof currentValue === 'object') {
    const dx = currentValue.x - prevValue.x;
    const dy = currentValue.y - prevValue.y;
    return Math.sqrt(dx * dx + dy * dy) > threshold;
  }

  return true;
}

export function normalizeAngle(angle: number, prevAngle: number): number {
  while (angle - prevAngle > 180) angle -= 360;
  while (angle - prevAngle < -180) angle += 360;
  return angle;
}

export function smoothAngles(angles: number[], windowSize: number = 3): number[] {
  const result: number[] = [];
  const half = Math.floor(windowSize / 2);

  for (let i = 0; i < angles.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(angles.length, i + half + 1);
    const window = angles.slice(start, end);

    const sorted = [...window].sort((a, b) => a - b);
    result[i] = sorted[Math.floor(sorted.length / 2)];
  }

  return result;
}

export function isParticleVisible(particle: any): boolean {
  const MIN_ALPHA = 1 / 255;
  return particle && particle.alpha >= MIN_ALPHA;
}
