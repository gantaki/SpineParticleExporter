/**
 * ParticleEngine - Refactored ParticleSystem with Observer Pattern
 *
 * This class encapsulates the core particle simulation logic.
 * Key changes from original ParticleSystem:
 * 1. Observer pattern for stats updates (bypasses React render cycle)
 * 2. Clean render signature - receives all ephemeral UI data as parameters
 * 3. Separated concerns: simulation vs rendering
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
// RENDER OPTIONS (Ephemeral UI State passed to render)
// ============================================================

export interface RenderOptions {
  showEmitter: boolean;
  zoom: number;
  spriteCanvases: Record<string, HTMLCanvasElement | null> | null;
  showGrid: boolean;
  backgroundImage: HTMLImageElement | null;
  bgPosition: { x: number; y: number };
}

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

  // Performance optimization: Reusable canvas pool for particle colorization
  // Avoids creating new canvas DOM elements on every frame
  private tempCanvasPool: HTMLCanvasElement[] = [];
  private readonly CANVAS_POOL_SIZE = 5;

  constructor(settings: ParticleSettings) {
    this.settings = settings;
    this.initializeEmitterStates();
    this.initializeCanvasPool();
  }

  // ============================================================
  // CANVAS POOL MANAGEMENT (Performance Optimization)
  // ============================================================

  /**
   * Initialize the canvas pool with pre-created canvases
   * This avoids DOM element creation during rendering
   */
  private initializeCanvasPool(): void {
    const size = 32; // Default sprite size (16 * 2)
    for (let i = 0; i < this.CANVAS_POOL_SIZE; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      this.tempCanvasPool.push(canvas);
    }
  }

  /**
   * Get a temporary canvas from the pool for colorization
   * If pool is empty, creates a new one (fallback)
   */
  private getTempCanvas(): HTMLCanvasElement {
    if (this.tempCanvasPool.length > 0) {
      return this.tempCanvasPool.pop()!;
    }
    // Fallback: create new canvas if pool exhausted
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    return canvas;
  }

  /**
   * Return a canvas to the pool for reuse
   */
  private returnTempCanvas(canvas: HTMLCanvasElement): void {
    // Only return to pool if not exceeding max size
    if (this.tempCanvasPool.length < this.CANVAS_POOL_SIZE) {
      this.tempCanvasPool.push(canvas);
    }
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
    const emitter = this.settings.emitters.find((e) => e.id === emitterId);
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
      const emitterParticleCount = this.particles.filter(
        (p) => p.emitterId === emitterId
      ).length;

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

      const emitter = this.settings.emitters.find((e) => e.id === p.emitterId);
      if (!emitter || !emitter.enabled) {
        this.particles.splice(i, 1);
        continue;
      }

      const em = emitter.settings;

      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
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
  // RENDERING (Pure function - no internal state mutation)
  // ============================================================

  /**
   * Render the current particle state to canvas
   * All ephemeral UI data is passed as RenderOptions
   */
  render(ctx: CanvasRenderingContext2D, options: RenderOptions): void {
    const {
      showEmitter,
      zoom,
      spriteCanvases,
      showGrid,
      backgroundImage,
      bgPosition,
    } = options;

    // Clear entire canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();

    // Calculate zoom transform centered on world origin (0, 0)
    const centerEmitterX = 0;
    const centerEmitterY = 0;

    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const offsetX = centerX - centerEmitterX * zoom;
    const offsetY = centerY - centerEmitterY * zoom;

    ctx.save();
    // Invert Y axis so positive Y goes up (mathematical convention)
    ctx.setTransform(zoom, 0, 0, -zoom, offsetX, offsetY);

    // Draw background
    if (backgroundImage && bgPosition) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      // Compensate for inverted Y axis when drawing images
      ctx.scale(1, -1);
      ctx.drawImage(backgroundImage, bgPosition.x, -bgPosition.y - backgroundImage.height);
      ctx.restore();
    }

    // Draw grid
    if (showGrid) {
      this.renderGrid(ctx, zoom, offsetX, offsetY);
    }

    // Draw particles
    this.renderParticles(ctx, spriteCanvases);

    // Draw emitters
    if (showEmitter) {
      this.renderEmitters(ctx, zoom);
    }

    ctx.restore();
  }

  private renderGrid(
    ctx: CanvasRenderingContext2D,
    zoom: number,
    offsetX: number,
    offsetY: number
  ): void {
    ctx.save();
    ctx.strokeStyle = "rgba(100, 100, 100, 0.3)";
    ctx.lineWidth = 1 / zoom;
    const gridStep = 50;

    const visibleLeft = -offsetX / zoom;
    const visibleRight = (ctx.canvas.width - offsetX) / zoom;
    const visibleTop = -offsetY / zoom;
    const visibleBottom = (ctx.canvas.height - offsetY) / zoom;

    const startX = Math.floor(visibleLeft / gridStep) * gridStep;
    const endX = Math.ceil(visibleRight / gridStep) * gridStep;
    for (let x = startX; x <= endX; x += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, visibleTop);
      ctx.lineTo(x, visibleBottom);
      ctx.stroke();
    }

    const startY = Math.floor(visibleTop / gridStep) * gridStep;
    const endY = Math.ceil(visibleBottom / gridStep) * gridStep;
    for (let y = startY; y <= endY; y += gridStep) {
      ctx.beginPath();
      ctx.moveTo(visibleLeft, y);
      ctx.lineTo(visibleRight, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  private renderParticles(
    ctx: CanvasRenderingContext2D,
    spriteCanvases: Record<string, HTMLCanvasElement | null> | null
  ): void {
    // Render particles grouped by emitter order (first emitter = top layer, last = bottom layer)
    // Reverse the array so first emitter (index 0) renders last (on top)
    for (const emitter of this.settings.emitters.slice().reverse()) {
      if (!emitter.visible || !emitter.enabled) continue;

      const spriteCanvas = spriteCanvases ? spriteCanvases[emitter.id] : null;

      // Render all particles from this emitter
      for (const p of this.particles) {
        if (p.emitterId !== emitter.id) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(p.scaleX, p.scaleY);
        ctx.globalAlpha = p.alpha;

        if (spriteCanvas) {
          const size = 16;
          // Get canvas from pool instead of creating new one
          const tempCanvas = this.getTempCanvas();
          tempCanvas.width = size * 2;
          tempCanvas.height = size * 2;
          const tempCtx = tempCanvas.getContext("2d")!;

          tempCtx.drawImage(spriteCanvas, 0, 0, size * 2, size * 2);
          tempCtx.globalCompositeOperation = "source-in";
          tempCtx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 1)`;
          tempCtx.fillRect(0, 0, size * 2, size * 2);

          // Compensate for inverted Y axis when drawing sprite images
          ctx.scale(1, -1);
          ctx.drawImage(tempCanvas, -size, -size, size * 2, size * 2);

          // Return canvas to pool for reuse
          this.returnTempCanvas(tempCanvas);
        } else {
          const size = 8;
          ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 1)`;
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }

  private renderEmitters(ctx: CanvasRenderingContext2D, zoom: number): void {
    for (const emitter of this.settings.emitters) {
      if (!emitter.visible || !emitter.enabled) continue;

      const em = emitter.settings;
      const isCurrentEmitter =
        emitter.id ===
        this.settings.emitters[this.settings.currentEmitterIndex]?.id;

      ctx.save();

      const strokeColor = isCurrentEmitter
        ? em.emissionMode === "edge"
          ? "rgba(255, 200, 50, 0.9)"
          : "rgba(50, 255, 50, 0.9)"
        : em.emissionMode === "edge"
        ? "rgba(255, 150, 100, 0.5)"
        : "rgba(100, 255, 100, 0.3)";
      const fillColor = isCurrentEmitter
        ? em.emissionMode === "edge"
          ? "rgba(255, 200, 50, 0.2)"
          : "rgba(50, 255, 50, 0.2)"
        : em.emissionMode === "edge"
        ? "rgba(255, 150, 100, 0.05)"
        : "rgba(100, 255, 100, 0.1)";

      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = isCurrentEmitter ? 3 / zoom : 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);

      this.renderEmitterShape(ctx, em);

      // Direction indicator
      ctx.setLineDash([]);
      ctx.strokeStyle = strokeColor;
      const angleRad =
        ((em.angle + (em.shape === "line" ? em.lineSpreadRotation : 0)) *
          Math.PI) /
        180;
      const dirLength = 40;
      ctx.beginPath();
      ctx.moveTo(em.position.x, em.position.y);
      ctx.lineTo(
        em.position.x + Math.cos(angleRad) * dirLength,
        em.position.y + Math.sin(angleRad) * dirLength
      );
      ctx.stroke();

      // Spread cone
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = strokeColor;
      const spread = (Math.abs(em.angleSpread) * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(em.position.x, em.position.y);
      ctx.arc(
        em.position.x,
        em.position.y,
        dirLength,
        angleRad - spread / 2,
        angleRad + spread / 2
      );
      ctx.closePath();
      ctx.fill();

      // Vortex visualization
      if (em.showVortexVisualization) {
        this.renderVortexVisualization(ctx, em, zoom);
      }

      ctx.restore();
    }
  }

  private renderEmitterShape(
    ctx: CanvasRenderingContext2D,
    em: EmitterInstance["settings"]
  ): void {
    if (em.shape === "point") {
      ctx.beginPath();
      ctx.moveTo(em.position.x - 10, em.position.y);
      ctx.lineTo(em.position.x + 10, em.position.y);
      ctx.moveTo(em.position.x, em.position.y - 10);
      ctx.lineTo(em.position.x, em.position.y + 10);
      ctx.stroke();
    } else if (em.shape === "line") {
      const angleRad = (em.angle * Math.PI) / 180;
      const halfLength = em.lineLength / 2;
      const x1 = em.position.x - Math.cos(angleRad) * halfLength;
      const y1 = em.position.y - Math.sin(angleRad) * halfLength;
      const x2 = em.position.x + Math.cos(angleRad) * halfLength;
      const y2 = em.position.y + Math.sin(angleRad) * halfLength;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x1, y1, 3, 0, Math.PI * 2);
      ctx.arc(x2, y2, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (em.shape === "circle") {
      const arcRad = (em.circleArc * Math.PI) / 180;
      const rotationRad = (em.shapeRotation * Math.PI) / 180;
      const startAngle = -arcRad / 2 + rotationRad;
      const endAngle = startAngle + arcRad;

      if (em.emissionMode === "area") {
        // Area mode: draw filled arc
        ctx.beginPath();
        ctx.arc(em.position.x, em.position.y, em.shapeRadius, startAngle, endAngle);
        // Close path to center if not full circle
        if (em.circleArc < 360) {
          ctx.lineTo(em.position.x, em.position.y);
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
      } else {
        // Edge mode: draw arc with thickness visualization
        const thickness = em.circleThickness;
        const innerRadius = Math.max(0, em.shapeRadius - thickness / 2);
        const outerRadius = em.shapeRadius + thickness / 2;

        // Draw outer arc
        ctx.beginPath();
        ctx.arc(em.position.x, em.position.y, outerRadius, startAngle, endAngle);
        ctx.stroke();

        // Draw inner arc if thickness is visible
        if (innerRadius > 0) {
          ctx.beginPath();
          ctx.arc(em.position.x, em.position.y, innerRadius, startAngle, endAngle);
          ctx.stroke();
        }

        // Draw connecting lines at arc ends if not full circle
        if (em.circleArc < 360) {
          ctx.beginPath();
          ctx.moveTo(
            em.position.x + Math.cos(startAngle) * innerRadius,
            em.position.y + Math.sin(startAngle) * innerRadius
          );
          ctx.lineTo(
            em.position.x + Math.cos(startAngle) * outerRadius,
            em.position.y + Math.sin(startAngle) * outerRadius
          );
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(
            em.position.x + Math.cos(endAngle) * innerRadius,
            em.position.y + Math.sin(endAngle) * innerRadius
          );
          ctx.lineTo(
            em.position.x + Math.cos(endAngle) * outerRadius,
            em.position.y + Math.sin(endAngle) * outerRadius
          );
          ctx.stroke();
        }

        // Draw center line at main radius
        ctx.beginPath();
        ctx.arc(em.position.x, em.position.y, em.shapeRadius, startAngle, endAngle);
        ctx.stroke();
      }
    } else if (em.shape === "rectangle") {
      ctx.save();
      ctx.translate(em.position.x, em.position.y);
      ctx.rotate((em.shapeRotation * Math.PI) / 180);

      const x = -em.shapeWidth / 2;
      const y = -em.shapeHeight / 2;
      const w = em.shapeWidth;
      const h = em.shapeHeight;

      if (em.emissionMode === "area") {
        // Area mode: draw filled rectangle (or partial if arc < 360)
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      } else {
        // Edge mode with crop and thickness visualization
        const thickness = em.rectangleThickness;
        const cropFraction = em.rectangleArc / 360;

        // Draw outer rectangle
        const outerX = x - thickness / 2;
        const outerY = y - thickness / 2;
        const outerW = w + thickness;
        const outerH = h + thickness;

        // Draw inner rectangle
        const innerX = x + thickness / 2;
        const innerY = y + thickness / 2;
        const innerW = w - thickness;
        const innerH = h - thickness;

        if (cropFraction >= 1) {
          // Full perimeter
          ctx.strokeRect(outerX, outerY, outerW, outerH);
          if (innerW > 0 && innerH > 0) {
            ctx.strokeRect(innerX, innerY, innerW, innerH);
          }
          // Draw center rectangle
          ctx.strokeRect(x, y, w, h);
        } else {
          // Partial perimeter - draw only crop portion
          // Helper function to draw partial rectangle outline
          const drawPartialRect = (rx: number, ry: number, rw: number, rh: number) => {
            // Calculate crop length for this specific rectangle size
            const rectPerimeter = 2 * (rw + rh);
            const cropLength = rectPerimeter * cropFraction;
            let remaining = cropLength;

            ctx.beginPath();

            // Top edge (starting from top-left corner)
            if (remaining > 0) {
              const len = Math.min(remaining, rw);
              ctx.moveTo(rx, ry);
              ctx.lineTo(rx + len, ry);
              remaining -= len;

              if (remaining > 0) {
                // Right edge
                const len = Math.min(remaining, rh);
                ctx.lineTo(rx + rw, ry);
                ctx.lineTo(rx + rw, ry + len);
                remaining -= len;

                if (remaining > 0) {
                  // Bottom edge
                  const len = Math.min(remaining, rw);
                  ctx.lineTo(rx + rw, ry + rh);
                  ctx.lineTo(rx + rw - len, ry + rh);
                  remaining -= len;

                  if (remaining > 0) {
                    // Left edge
                    const len = Math.min(remaining, rh);
                    ctx.lineTo(rx, ry + rh);
                    ctx.lineTo(rx, ry + rh - len);
                  }
                }
              }
            }
            ctx.stroke();
          };

          drawPartialRect(outerX, outerY, outerW, outerH);
          if (innerW > 0 && innerH > 0) {
            drawPartialRect(innerX, innerY, innerW, innerH);
          }
          drawPartialRect(x, y, w, h);
        }
      }

      ctx.restore();
    } else if (em.shape === "roundedRect") {
      ctx.save();
      ctx.translate(em.position.x, em.position.y);
      ctx.rotate((em.shapeRotation * Math.PI) / 180);

      const x = -em.shapeWidth / 2;
      const y = -em.shapeHeight / 2;
      const w = em.shapeWidth;
      const h = em.shapeHeight;
      const r = Math.min(em.roundRadius, w / 2, h / 2);

      if (em.emissionMode === "area") {
        // Area mode: draw filled rounded rectangle
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Edge mode with crop and thickness visualization
        const thickness = em.rectangleThickness;
        const cropFraction = em.rectangleArc / 360;

        // Helper function to draw rounded rectangle outline
        const drawRoundedRect = (offset: number) => {
          const ox = x + offset;
          const oy = y + offset;
          const ow = w - 2 * offset;
          const oh = h - 2 * offset;
          const or = Math.max(0, r + offset);

          if (ow <= 0 || oh <= 0) return;

          if (cropFraction >= 1) {
            // Full perimeter
            ctx.beginPath();
            ctx.moveTo(ox + or, oy);
            ctx.lineTo(ox + ow - or, oy);
            ctx.arcTo(ox + ow, oy, ox + ow, oy + or, or);
            ctx.lineTo(ox + ow, oy + oh - or);
            ctx.arcTo(ox + ow, oy + oh, ox + ow - or, oy + oh, or);
            ctx.lineTo(ox + or, oy + oh);
            ctx.arcTo(ox, oy + oh, ox, oy + oh - or, or);
            ctx.lineTo(ox, oy + or);
            ctx.arcTo(ox, oy, ox + or, oy, or);
            ctx.closePath();
            ctx.stroke();
          } else {
            // Partial perimeter - draw crop portion
            const straightWidth = ow - 2 * or;
            const straightHeight = oh - 2 * or;
            const fullPerimeter = 2 * (straightWidth + straightHeight) + 2 * Math.PI * or;
            const cropLength = fullPerimeter * cropFraction;
            let remaining = cropLength;

            ctx.beginPath();
            // Start from top-left corner after radius
            const startX = ox + or;
            const startY = oy;
            ctx.moveTo(startX, startY);

            // Top edge
            if (remaining > 0 && straightWidth > 0) {
              const len = Math.min(remaining, straightWidth);
              ctx.lineTo(ox + or + len, oy);
              remaining -= len;

              if (remaining > 0) {
                // Top-right corner
                const cornerArc = (Math.PI * or) / 2;
                if (remaining >= cornerArc) {
                  ctx.arcTo(ox + ow, oy, ox + ow, oy + or, or);
                  remaining -= cornerArc;

                  if (remaining > 0 && straightHeight > 0) {
                    // Right edge
                    const len = Math.min(remaining, straightHeight);
                    ctx.lineTo(ox + ow, oy + or + len);
                    remaining -= len;

                    if (remaining > 0) {
                      // Bottom-right corner
                      if (remaining >= cornerArc) {
                        ctx.arcTo(ox + ow, oy + oh, ox + ow - or, oy + oh, or);
                        remaining -= cornerArc;

                        if (remaining > 0 && straightWidth > 0) {
                          // Bottom edge
                          const len = Math.min(remaining, straightWidth);
                          ctx.lineTo(ox + ow - or - len, oy + oh);
                          remaining -= len;

                          if (remaining > 0) {
                            // Bottom-left corner
                            if (remaining >= cornerArc) {
                              ctx.arcTo(ox, oy + oh, ox, oy + oh - or, or);
                              remaining -= cornerArc;

                              if (remaining > 0 && straightHeight > 0) {
                                // Left edge
                                const len = Math.min(remaining, straightHeight);
                                ctx.lineTo(ox, oy + oh - or - len);
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            ctx.stroke();
          }
        };

        // Draw three outlines (outer, center, inner)
        drawRoundedRect(-thickness / 2); // Outer
        drawRoundedRect(0); // Center
        drawRoundedRect(thickness / 2); // Inner
      }

      ctx.restore();
    }
  }

  private renderVortexVisualization(
    ctx: CanvasRenderingContext2D,
    em: EmitterInstance["settings"],
    zoom: number
  ): void {
    const previewStrength = evaluateCurve(em.vortexStrengthOverLifetime, 0.5);
    const directionSign =
      previewStrength === 0 ? 1 : Math.sign(previewStrength);
    const arrowCount = 8;
    const radius = 60;
    const arcSpan = (Math.PI * 2) / arrowCount;

    ctx.save();
    ctx.setLineDash([]);
    ctx.lineWidth = 2 / zoom;
    ctx.strokeStyle =
      directionSign > 0
        ? "rgba(137, 207, 240, 0.9)"
        : "rgba(255, 137, 207, 0.9)";
    ctx.fillStyle = ctx.strokeStyle;

    for (let i = 0; i < arrowCount; i++) {
      const startAngle = i * arcSpan;
      const endAngle = startAngle + arcSpan * 0.75 * directionSign;
      const anticlockwise = directionSign < 0;

      ctx.beginPath();
      ctx.arc(
        em.vortexPoint.x,
        em.vortexPoint.y,
        radius,
        startAngle,
        endAngle,
        anticlockwise
      );
      ctx.stroke();

      const endX = em.vortexPoint.x + Math.cos(endAngle) * radius;
      const endY = em.vortexPoint.y + Math.sin(endAngle) * radius;
      const headAngle =
        endAngle + (directionSign > 0 ? -Math.PI / 6 : Math.PI / 6);

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX + Math.cos(headAngle) * 10,
        endY + Math.sin(headAngle) * 10
      );
      ctx.lineTo(
        endX +
          Math.cos(
            headAngle + (directionSign > 0 ? Math.PI / 6 : -Math.PI / 6)
          ) *
            10,
        endY +
          Math.sin(
            headAngle + (directionSign > 0 ? Math.PI / 6 : -Math.PI / 6)
          ) *
            10
      );
      ctx.closePath();
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(em.vortexPoint.x, em.vortexPoint.y, 6 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
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
