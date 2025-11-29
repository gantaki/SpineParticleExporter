import type { Particle, Vec2, WindSettings } from '../types';
import { clamp01, noise2D } from '../utils';

/**
 * Normalize a direction vector, returning +X when the input magnitude is
 * nearly zero.
 */
function normalizeDirectionVector(direction: Vec2): Vec2 {
  const mag = Math.hypot(direction.x, direction.y);
  if (mag < 1e-5) {
    return { x: 1, y: 0 };
  }
  return { x: direction.x / mag, y: direction.y / mag };
}

/**
 * Converts the emitter wind settings and particle-specific angle offset into
 * a normalized direction vector.
 */
function resolveDirection(wind: WindSettings, directionOffsetRad: number): Vec2 {
  const baseVector = wind.directionMode === 'vector'
    ? normalizeDirectionVector(wind.directionVector)
    : { x: Math.cos((wind.directionAngle * Math.PI) / 180), y: Math.sin((wind.directionAngle * Math.PI) / 180) };

  const baseAngle = Math.atan2(baseVector.y, baseVector.x);
  const finalAngle = baseAngle + directionOffsetRad;
  return { x: Math.cos(finalAngle), y: Math.sin(finalAngle) };
}

/**
 * Calculates a 0..1 weight based on whether the particle is inside the wind
 * volume and how far it is from the edges when a falloff is configured.
 */
function computeAreaWeight(wind: WindSettings, position: Vec2): number {
  if (wind.areaShape === 'global') {
    return 1;
  }

  if (wind.areaShape === 'rect') {
    const halfW = wind.areaRect.size.x / 2;
    const halfH = wind.areaRect.size.y / 2;
    const dx = Math.abs(position.x - wind.areaRect.center.x);
    const dy = Math.abs(position.y - wind.areaRect.center.y);
    if (dx > halfW || dy > halfH) return 0;

    const edgeRatio = Math.max(dx / halfW, dy / halfH);
    if (wind.falloff <= 0) return 1;

    const threshold = 1 - wind.falloff;
    if (edgeRatio <= threshold) return 1;

    const normalized = (edgeRatio - threshold) / wind.falloff;
    return clamp01(1 - normalized);
  }

  const dist = Math.hypot(position.x - wind.areaCircle.center.x, position.y - wind.areaCircle.center.y);
  if (dist > wind.areaCircle.radius) return 0;

  if (wind.falloff <= 0) return 1;
  const edgeRatio = dist / wind.areaCircle.radius;
  const threshold = 1 - wind.falloff;
  if (edgeRatio <= threshold) return 1;
  const normalized = (edgeRatio - threshold) / wind.falloff;
  return clamp01(1 - normalized);
}

/**
 * Computes the instantaneous wind acceleration applied to a particle,
 * including area weighting and optional turbulence.
 */
function computeWindAcceleration(particle: Particle, wind: WindSettings, time: number): Vec2 {
  const areaWeight = computeAreaWeight(wind, { x: particle.x, y: particle.y });
  if (areaWeight <= 0) return { x: 0, y: 0 };

  const direction = resolveDirection(wind, particle.windDirectionOffset);
  const strength = wind.strength * particle.windStrengthMultiplier * areaWeight;

  const baseAccel = { x: direction.x * strength, y: direction.y * strength };

  if (!wind.turbulenceEnabled || wind.turbulenceStrength === 0) {
    return baseAccel;
  }

  const noiseX = (particle.x + particle.windTurbulenceOffset.x) * wind.turbulenceScale;
  const noiseY = (particle.y + particle.windTurbulenceOffset.y) * wind.turbulenceScale;
  const gust = noise2D(noiseX, noiseY, time * wind.turbulenceFrequency);
  return {
    x: baseAccel.x + gust.x * wind.turbulenceStrength * areaWeight,
    y: baseAccel.y + gust.y * wind.turbulenceStrength * areaWeight,
  };
}

/**
 * Applies the wind acceleration to the particle velocity for the current
 * frame.
 */
function applyWindForce(particle: Particle, wind: WindSettings | undefined, time: number, dt: number) {
  if (!wind || !wind.enabled) return;

  const accel = computeWindAcceleration(particle, wind, time);
  particle.vx += accel.x * dt;
  particle.vy += accel.y * dt;
}

export { applyWindForce, computeWindAcceleration, computeAreaWeight, resolveDirection };
