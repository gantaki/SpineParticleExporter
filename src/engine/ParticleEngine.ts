/**
 * ParticleEngine - Refactored with Separation of Concerns
 *
 * This class is responsible ONLY for particle physics and simulation.
 * All rendering logic has been moved to CanvasParticleRenderer.
 *
 * Key changes:
 * 1. Observer pattern for stats updates (bypasses React render cycle)
 * 2. Clean separation: simulation vs rendering
 * 3. DRY: Single removeParticle() method
 */

import type {
  ParticleSettings,
  Particle,
  Vec2,
  EmitterInstance,
} from "../types";
import type { ParticleStats, ParticleStatsCallback } from "../types/editor";
import {
  sampleRange,
  evaluateCurve,
  evaluateColorGradient,
  noise2D,
  clamp01,
} from "../utils";

// ============================================================
// EMITTER STATE
// ============================================================

interface EmitterState {
  spawnAccumulator: number;
  burstCycleIndex: number;
  lastBurstTime: number;
  hasPrewarmed: boolean;
  nextParticleId: number;
}

// ============================================================
// PARTICLE ENGINE CLASS
// ============================================================

export class ParticleEngine {
  particles: Particle[] = [];
  settings: ParticleSettings;
  time: number = 0;

  // Per-emitter state management
  private emitterStates: Map<string, EmitterState> = new Map();

  // Observer pattern: callbacks for stats updates
  private statsCallbacks: Set<ParticleStatsCallback> = new Set();

  // Performance optimization: Cached lookups to avoid repeated searches
  private emitterCache: Map<string, EmitterInstance> = new Map();
  private particleCountPerEmitter: Map<string, number> = new Map();

  // Performance optimization: Avoid sorting particles every frame
  // Group particles by emitter for efficient rendering (used by renderer)
  private particlesByEmitter: Map<string, Particle[]> = new Map();

  constructor(settings: ParticleSettings) {
    this.settings = settings;
    this.initializeEmitterStates();
    this.rebuildEmitterCache();
  }

  // ============================================================
  // CACHE MANAGEMENT
  // ============================================================

  /**
   * Rebuild emitter cache from settings
   * Call this whenever settings.emitters changes
   */
  private rebuildEmitterCache(): void {
    this.emitterCache.clear();
    this.particleCountPerEmitter.clear();
    this.particlesByEmitter.clear();
    for (const emitter of this.settings.emitters) {
      this.emitterCache.set(emitter.id, emitter);
      this.particleCountPerEmitter.set(emitter.id, 0);
      this.particlesByEmitter.set(emitter.id, []);
    }
  }

  // ============================================================
  // PUBLIC API FOR RENDERER
  // ============================================================

  /**
   * Get grouped particles for efficient rendering
   * Used by CanvasParticleRenderer to avoid sorting
   */
  getParticlesByEmitter(): Map<string, Particle[]> {
    return this.particlesByEmitter;
  }

  // ============================================================
  // OBSERVER PATTERN METHODS
  // ============================================================

  /**
   * Subscribe to stats updates (particle count, time)
   * This allows high-frequency updates without React re-renders
   */
  onStatsUpdate(callback: ParticleStatsCallback): () => void {
    this.statsCallbacks.add(callback);
    return () => this.statsCallbacks.delete(callback);
  }

  /**
   * Notify all observers of current stats
   * Called after each update cycle
   */
  notifyStats(): void {
    const stats: ParticleStats = {
      particleCount: this.particles.length,
      time: this.time,
    };
    this.statsCallbacks.forEach((cb) => cb(stats));
  }

  // ============================================================
  // EMITTER STATE MANAGEMENT
  // ============================================================

  initializeEmitterStates(): void {
    this.emitterStates.clear();
    this.rebuildEmitterCache();
    for (const emitter of this.settings.emitters) {
      this.emitterStates.set(emitter.id, {
        spawnAccumulator: 0,
        burstCycleIndex: 0,
        lastBurstTime: 0,
        hasPrewarmed: false,
        nextParticleId: 0,
      });
    }
  }

  reset(): void {
    this.particles = [];
    this.time = 0;
    this.initializeEmitterStates();

    // Clear grouped particles
    for (const emitterParticles of this.particlesByEmitter.values()) {
      emitterParticles.length = 0;
    }

    // Prewarm each emitter if enabled
    for (const emitter of this.settings.emitters) {
      if (emitter.settings.prewarm && emitter.settings.looping) {
        this.prewarmEmitter(emitter.id);
      }
    }

    this.notifyStats();
  }

  prewarmEmitter(emitterId: string): void {
    const duration = this.settings.duration;
    const dt = 1 / 60;
    const steps = Math.ceil(duration / dt);

    for (let i = 0; i < steps; i++) {
      this.updateEmitter(emitterId, dt, true);
      this.updateParticles(dt);
    }

    const state = this.emitterStates.get(emitterId);
    if (state) {
      state.hasPrewarmed = true;
    }
  }

  // ============================================================
  // PARTICLE MANAGEMENT (DRY)
  // ============================================================

  /**
   * Remove particle at index and update all caches
   * DRY: Single place for particle removal logic
   */
  private removeParticle(index: number): void {
    const particle = this.particles[index];

    // Remove from main array
    this.particles.splice(index, 1);

    // Update cached particle count
    const currentCount = this.particleCountPerEmitter.get(particle.emitterId) || 1;
    this.particleCountPerEmitter.set(particle.emitterId, currentCount - 1);

    // Remove from grouped particles
    const emitterParticles = this.particlesByEmitter.get(particle.emitterId);
    if (emitterParticles) {
      const idx = emitterParticles.indexOf(particle);
      if (idx !== -1) {
        emitterParticles.splice(idx, 1);
      }
    }
  }

  // ============================================================
  // SIMULATION UPDATE
  // ============================================================

  update(dt: number, skipTimeReset: boolean = false): void {
    this.time += dt;

    for (const emitter of this.settings.emitters) {
      if (!emitter.enabled) continue; // Skip disabled emitters
      this.updateEmitter(emitter.id, dt, skipTimeReset);
    }

    this.updateParticles(dt);
    this.notifyStats();
  }

  updateEmitter(
    emitterId: string,
    dt: number,
    skipTimeReset: boolean = false
  ): void {
    const emitter = this.emitterCache.get(emitterId);
    if (!emitter) return;

    const em = emitter.settings;
    const state = this.emitterStates.get(emitterId);
    if (!state) return;

    // Handle looping
    if (em.looping && !skipTimeReset) {
      const effectiveTime = this.time - em.startDelay;
      if (effectiveTime >= this.settings.duration) {
        state.burstCycleIndex = 0;
        state.lastBurstTime = em.startDelay;
      }
    } else if (!em.looping && !skipTimeReset) {
      const maxTime = em.startDelay + this.settings.duration;
      if (this.time > maxTime) {
        return;
      }
    }

    const effectiveTime = this.time - em.startDelay;
    const isActive = effectiveTime >= 0;

    const normalizedTime =
      this.settings.duration > 0
        ? Math.max(
            0,
            Math.min(1, (this.time - em.startDelay) / this.settings.duration)
          )
        : 0;
    const rateMultiplier = Math.max(
      0,
      evaluateCurve(em.rateOverTime, normalizedTime)
    );

    const getEffectiveRate = () => em.rate * rateMultiplier;

    if (isActive) {
      // Use cached particle count instead of filter
      const emitterParticleCount = this.particleCountPerEmitter.get(emitterId) || 0;

      if (em.emissionType === "continuous") {
        const effectiveRate = getEffectiveRate();
        if (effectiveRate > 0) {
          state.spawnAccumulator += dt;
          const spawnInterval = 1 / effectiveRate;

          while (
            state.spawnAccumulator >= spawnInterval &&
            emitterParticleCount < em.maxParticles
          ) {
            this.spawnParticle(emitterId);
            state.spawnAccumulator -= spawnInterval;
          }
        }
      } else if (em.emissionType === "burst") {
        const cycleLimit = em.looping ? Infinity : em.burstCycles;

        if (state.burstCycleIndex < cycleLimit) {
          const timeSinceLastBurst =
            effectiveTime - (state.lastBurstTime - em.startDelay);

          if (
            timeSinceLastBurst >= em.burstInterval ||
            state.burstCycleIndex === 0
          ) {
            for (
              let i = 0;
              i < em.burstCount && emitterParticleCount + i < em.maxParticles;
              i++
            ) {
              this.spawnParticle(emitterId);
            }
            state.lastBurstTime = this.time;
            state.burstCycleIndex++;
          }
        }
      } else if (em.emissionType === "duration") {
        if (
          effectiveTime >= em.durationStart &&
          effectiveTime <= em.durationEnd
        ) {
          const effectiveRate = getEffectiveRate();
          if (effectiveRate > 0) {
            state.spawnAccumulator += dt;
            const spawnInterval = 1 / effectiveRate;

            while (
              state.spawnAccumulator >= spawnInterval &&
              emitterParticleCount < em.maxParticles
            ) {
              this.spawnParticle(emitterId);
              state.spawnAccumulator -= spawnInterval;
            }
          }
        }
      }
    }
  }

  updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];

      // Use cached emitter lookup
      const emitter = this.emitterCache.get(p.emitterId);
      if (!emitter || !emitter.enabled) {
        this.removeParticle(i);
        continue;
      }

      const em = emitter.settings;

      p.life -= dt;
      if (p.life <= 0) {
        this.removeParticle(i);
        continue;
      }

      const t = 1 - p.life / p.maxLife;

      // Size scaling - use uniform or separate modes
      if (em.separateSize) {
        // Separate mode - use individual X and Y curves
        const sizeXMultiplier = clamp01(evaluateCurve(em.sizeXOverLifetime, t));
        const sizeYMultiplier = clamp01(evaluateCurve(em.sizeYOverLifetime, t));
        p.scaleX = p.baseSizeX * sizeXMultiplier * em.scaleRatioX;
        p.scaleY = p.baseSizeY * sizeYMultiplier * em.scaleRatioY;
      } else {
        // Uniform mode - use single size curve for both axes
        const sizeMultiplier = clamp01(evaluateCurve(em.sizeOverLifetime, t));
        p.scaleX = p.baseSizeX * sizeMultiplier * em.scaleRatioX;
        p.scaleY = p.baseSizeY * sizeMultiplier * em.scaleRatioY;
      }
      p.scale = (p.scaleX + p.scaleY) / 2;

      const speedMultiplier = clamp01(evaluateCurve(em.speedOverLifetime, t));
      const weightMultiplier = clamp01(evaluateCurve(em.weightOverLifetime, t));

      const gravity =
        p.baseGravity * clamp01(evaluateCurve(em.gravityOverLifetime, t));
      const weight = p.baseWeight * weightMultiplier;
      p.vy += gravity * weight * dt;

      const noiseStrength =
        p.baseNoiseStrength *
        clamp01(evaluateCurve(em.noiseStrengthOverLifetime, t));
      if (noiseStrength !== 0) {
        const noiseX = p.x * p.baseNoiseFrequency;
        const noiseY = p.y * p.baseNoiseFrequency;
        const noiseTime = this.time * p.baseNoiseSpeed;

        const noiseForce = noise2D(noiseX, noiseY, noiseTime);

        p.vx += noiseForce.x * noiseStrength * dt;
        p.vy += noiseForce.y * noiseStrength * dt;
      }

      const attractionStrength =
        p.baseAttraction * clamp01(evaluateCurve(em.attractionOverLifetime, t));
      if (attractionStrength !== 0) {
        const dx = em.attractionPoint.x - p.x;
        const dy = em.attractionPoint.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          p.vx += (dx / dist) * attractionStrength * dt;
          p.vy += (dy / dist) * attractionStrength * dt;
        }
      }

      const vortexStrength =
        p.baseVortexStrength *
        clamp01(evaluateCurve(em.vortexStrengthOverLifetime, t));
      if (vortexStrength !== 0) {
        const dx = em.vortexPoint.x - p.x;
        const dy = em.vortexPoint.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          const ndx = dx / dist;
          const ndy = dy / dist;

          const tangentX = -ndy;
          const tangentY = ndx;

          const falloff = 1 / (1 + dist * 0.001);

          p.vx += tangentX * vortexStrength * falloff * dt;
          p.vy += tangentY * vortexStrength * falloff * dt;

          p.vx += ndx * vortexStrength * 0.3 * falloff * dt;
          p.vy += ndy * vortexStrength * 0.3 * falloff * dt;
        }
      }

      const drag = p.baseDrag * clamp01(evaluateCurve(em.dragOverLifetime, t));
      p.vx *= drag;
      p.vy *= drag;

      const speedFactor = p.baseSpeedScale * speedMultiplier;
      p.x += p.vx * speedFactor * dt;
      p.y += p.vy * speedFactor * dt;

      const spinSpeed =
        p.baseSpinRate * clamp01(evaluateCurve(em.spinOverLifetime, t));
      p.rotation += spinSpeed * dt;

      const colorData = evaluateColorGradient(em.colorOverLifetime, t);
      p.color = { r: colorData.r, g: colorData.g, b: colorData.b, a: 255 };
      p.alpha = colorData.a / 255;
    }
  }

  // ============================================================
  // PARTICLE SPAWNING
  // ============================================================

  spawnParticle(emitterId: string): void {
    const emitter = this.settings.emitters.find((e) => e.id === emitterId);
    if (!emitter) return;

    const state = this.emitterStates.get(emitterId);
    if (!state) return;

    const em = emitter.settings;
    let pos = { ...em.position };

    // Shape-based position calculation
    pos = this.calculateSpawnPosition(em, pos);

    const baseAngleDeg =
      em.angle + (em.shape === "line" ? em.lineSpreadRotation : 0);
    const angleRad =
      ((baseAngleDeg + (Math.random() - 0.5) * Math.abs(em.angleSpread)) * Math.PI) / 180;
    const speed = sampleRange(em.initialSpeedRange);

    let initialRotation = 0;
    switch (em.spawnAngleMode) {
      case "alignMotion":
        initialRotation = angleRad;
        break;
      case "specific":
        initialRotation = (em.spawnAngle * Math.PI) / 180;
        break;
      case "random":
        initialRotation = Math.random() * Math.PI * 2;
        break;
      case "range":
      default:
        initialRotation =
          ((em.spawnAngleMin +
            Math.random() * (em.spawnAngleMax - em.spawnAngleMin)) *
            Math.PI) /
          180;
        break;
    }

    const particle: Particle = {
      id: state.nextParticleId++,
      emitterId,
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angleRad) * speed,
      vy: Math.sin(angleRad) * speed,
      life: em.lifeTimeMin + Math.random() * (em.lifeTimeMax - em.lifeTimeMin),
      maxLife: 0,
      baseSpeed: speed,
      rotation: initialRotation,
      baseSpinRate: (sampleRange(em.spinRange) * Math.PI) / 180,
      baseGravity: sampleRange(em.gravityRange),
      baseDrag: sampleRange(em.dragRange),
      baseNoiseStrength: sampleRange(em.noiseStrengthRange),
      baseNoiseFrequency: sampleRange(em.noiseFrequencyRange),
      baseNoiseSpeed: sampleRange(em.noiseSpeedRange),
      baseAttraction: sampleRange(em.attractionRange),
      baseVortexStrength: sampleRange(em.vortexStrengthRange),
      baseSpeedScale: sampleRange(em.speedRange),
      baseWeight: sampleRange(em.weightRange),
      // Size - use uniform or separate modes
      // In uniform mode, both axes must use the same sampled value for proportional scaling
      baseSizeX: 0, // Will be set below
      baseSizeY: 0, // Will be set below
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      color: { r: 255, g: 255, b: 255, a: 255 },
      alpha: 1,
    };

    // Set size values based on mode
    if (em.separateSize) {
      // Separate mode - sample X and Y independently
      particle.baseSizeX = sampleRange(em.sizeXRange);
      particle.baseSizeY = sampleRange(em.sizeYRange);
    } else {
      // Uniform mode - sample once and use for both axes (proportional scaling)
      const uniformSize = sampleRange(em.sizeRange);
      particle.baseSizeX = uniformSize;
      particle.baseSizeY = uniformSize;
    }

    particle.maxLife = particle.life;

    this.particles.push(particle);

    // Increment cached particle count
    this.particleCountPerEmitter.set(
      emitterId,
      (this.particleCountPerEmitter.get(emitterId) || 0) + 1
    );

    // Add to grouped particles for efficient rendering
    const emitterParticles = this.particlesByEmitter.get(emitterId);
    if (emitterParticles) {
      emitterParticles.push(particle);
    }
  }

  private calculateSpawnPosition(
    em: EmitterInstance["settings"],
    pos: Vec2
  ): Vec2 {
    if (em.shape === "point") {
      // Point - no change
    } else if (em.shape === "line") {
      const angleRad = (em.angle * Math.PI) / 180;
      const t = Math.random();
      const distance = (t - 0.5) * em.lineLength;
      pos.x += Math.cos(angleRad) * distance;
      pos.y += Math.sin(angleRad) * distance;
    } else if (em.shape === "circle") {
      // Calculate arc range (default 360° = full circle)
      const arcRad = (em.circleArc * Math.PI) / 180;
      const rotationRad = (em.shapeRotation * Math.PI) / 180;
      const startAngle = -arcRad / 2 + rotationRad; // Center the arc and apply rotation
      const angle = startAngle + Math.random() * arcRad;

      if (em.emissionMode === "area") {
        const radius = Math.random() * em.shapeRadius;
        pos.x += Math.cos(angle) * radius;
        pos.y += Math.sin(angle) * radius;
      } else {
        // Edge mode with thickness
        const thickness = em.circleThickness;
        const minRadius = Math.max(0, em.shapeRadius - thickness / 2);
        const maxRadius = em.shapeRadius + thickness / 2;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        pos.x += Math.cos(angle) * radius;
        pos.y += Math.sin(angle) * radius;
      }
    } else if (em.shape === "rectangle") {
      let offsetX = 0;
      let offsetY = 0;

      if (em.emissionMode === "area") {
        offsetX = (Math.random() - 0.5) * em.shapeWidth;
        offsetY = (Math.random() - 0.5) * em.shapeHeight;
      } else {
        // Edge mode with crop and thickness support
        const w = em.shapeWidth;
        const h = em.shapeHeight;
        const perimeter = 2 * (w + h);
        const cropFraction = em.rectangleArc / 360;
        const activePerimeter = perimeter * cropFraction;
        const thickness = em.rectangleThickness;

        // Random position along the active perimeter (starting from top-left, going clockwise)
        const t = Math.random() * activePerimeter;

        // Random offset perpendicular to edge (within thickness)
        const thicknessOffset = (Math.random() - 0.5) * thickness;

        let normalX = 0;
        let normalY = 0;

        if (t < w) {
          // Top edge
          offsetX = t - w / 2;
          offsetY = -h / 2;
          normalX = 0;
          normalY = -1; // Normal points outward (up)
        } else if (t < w + h) {
          // Right edge
          offsetX = w / 2;
          offsetY = (t - w) - h / 2;
          normalX = 1; // Normal points outward (right)
          normalY = 0;
        } else if (t < 2 * w + h) {
          // Bottom edge
          offsetX = w - (t - w - h) - w / 2;
          offsetY = h / 2;
          normalX = 0;
          normalY = 1; // Normal points outward (down)
        } else {
          // Left edge
          offsetX = -w / 2;
          offsetY = h - (t - 2 * w - h) - h / 2;
          normalX = -1; // Normal points outward (left)
          normalY = 0;
        }

        // Apply thickness offset along the normal
        offsetX += normalX * thicknessOffset;
        offsetY += normalY * thicknessOffset;
      }

      // Apply rotation
      const rotRad = (em.shapeRotation * Math.PI) / 180;
      const cosRot = Math.cos(rotRad);
      const sinRot = Math.sin(rotRad);
      pos.x += offsetX * cosRot - offsetY * sinRot;
      pos.y += offsetX * sinRot + offsetY * cosRot;
    } else if (em.shape === "roundedRect") {
      pos = this.calculateRoundedRectPosition(em, pos);
    }

    return pos;
  }

  private calculateRoundedRectPosition(
    em: EmitterInstance["settings"],
    pos: Vec2
  ): Vec2 {
    let offsetX = 0;
    let offsetY = 0;

    if (em.emissionMode === "area") {
      offsetX = (Math.random() - 0.5) * em.shapeWidth;
      offsetY = (Math.random() - 0.5) * em.shapeHeight;
    } else {
      // Edge mode with crop and thickness support
      const w = em.shapeWidth;
      const h = em.shapeHeight;
      const r = Math.min(em.roundRadius, w / 2, h / 2);
      const thickness = em.rectangleThickness;

      const straightWidth = w - 2 * r;
      const straightHeight = h - 2 * r;
      const perimeter = 2 * (straightWidth + straightHeight) + 2 * Math.PI * r;
      const cropFraction = em.rectangleArc / 360;
      const activePerimeter = perimeter * cropFraction;
      const t = Math.random() * activePerimeter;

      // Random offset perpendicular to edge (within thickness)
      const thicknessOffset = (Math.random() - 0.5) * thickness;

      if (t < straightWidth) {
        // Top edge
        offsetX = t - w / 2 + r;
        offsetY = -h / 2;
        // Apply thickness offset (normal points up)
        offsetY += -thicknessOffset;
      } else if (t < straightWidth + (Math.PI * r) / 2) {
        // Top-right corner
        const arcProgress = (t - straightWidth) / r;
        const angle = arcProgress - Math.PI / 2;
        const centerX = w / 2 - r;
        const centerY = -h / 2 + r;
        // Base position on the center radius
        offsetX = centerX + Math.cos(angle) * r;
        offsetY = centerY + Math.sin(angle) * r;
        // Apply thickness offset radially
        offsetX += Math.cos(angle) * thicknessOffset;
        offsetY += Math.sin(angle) * thicknessOffset;
      } else if (t < straightWidth + (Math.PI * r) / 2 + straightHeight) {
        // Right edge
        offsetX = w / 2;
        offsetY = (t - straightWidth - (Math.PI * r) / 2) - h / 2 + r;
        // Apply thickness offset (normal points right)
        offsetX += thicknessOffset;
      } else if (t < straightWidth + Math.PI * r + straightHeight) {
        // Bottom-right corner
        const arcProgress =
          (t - (straightWidth + (Math.PI * r) / 2 + straightHeight)) / r;
        const angle = arcProgress;
        const centerX = w / 2 - r;
        const centerY = h / 2 - r;
        offsetX = centerX + Math.cos(angle) * r;
        offsetY = centerY + Math.sin(angle) * r;
        // Apply thickness offset radially
        offsetX += Math.cos(angle) * thicknessOffset;
        offsetY += Math.sin(angle) * thicknessOffset;
      } else if (t < 2 * straightWidth + Math.PI * r + straightHeight) {
        // Bottom edge
        offsetX = (w / 2 - r) - (t - (straightWidth + Math.PI * r + straightHeight));
        offsetY = h / 2;
        // Apply thickness offset (normal points down)
        offsetY += thicknessOffset;
      } else if (
        t <
        2 * straightWidth + (3 * Math.PI * r) / 2 + straightHeight
      ) {
        // Bottom-left corner
        const arcProgress =
          (t - (2 * straightWidth + Math.PI * r + straightHeight)) / r;
        const angle = arcProgress + Math.PI / 2;
        const centerX = -w / 2 + r;
        const centerY = h / 2 - r;
        offsetX = centerX + Math.cos(angle) * r;
        offsetY = centerY + Math.sin(angle) * r;
        // Apply thickness offset radially
        offsetX += Math.cos(angle) * thicknessOffset;
        offsetY += Math.sin(angle) * thicknessOffset;
      } else if (
        t <
        2 * straightWidth + (3 * Math.PI * r) / 2 + 2 * straightHeight
      ) {
        // Left edge
        offsetX = -w / 2;
        offsetY =
          (h / 2 - r) -
          (t - (2 * straightWidth + (3 * Math.PI * r) / 2 + straightHeight));
        // Apply thickness offset (normal points left)
        offsetX += -thicknessOffset;
      } else {
        // Top-left corner
        const arcProgress =
          (t -
            (2 * straightWidth + (3 * Math.PI * r) / 2 + 2 * straightHeight)) /
          r;
        const angle = arcProgress + Math.PI;
        const centerX = -w / 2 + r;
        const centerY = -h / 2 + r;
        offsetX = centerX + Math.cos(angle) * r;
        offsetY = centerY + Math.sin(angle) * r;
        // Apply thickness offset radially
        offsetX += Math.cos(angle) * thicknessOffset;
        offsetY += Math.sin(angle) * thicknessOffset;
      }
    }

    // Apply rotation
    const rotRad = (em.shapeRotation * Math.PI) / 180;
    const cosRot = Math.cos(rotRad);
    const sinRot = Math.sin(rotRad);
    pos.x += offsetX * cosRot - offsetY * sinRot;
    pos.y += offsetX * sinRot + offsetY * cosRot;

    return pos;
  }


  // ============================================================
  // UTILITY
  // ============================================================

  getParticleCount(): number {
    return this.particles.length;
  }

  getTime(): number {
    return this.time;
  }
}
