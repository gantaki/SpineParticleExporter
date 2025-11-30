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

  constructor(settings: ParticleSettings) {
    this.settings = settings;
    this.initializeEmitterStates();
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
      if (!emitter) {
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

      const sizeXMultiplier = clamp01(evaluateCurve(em.sizeXOverLifetime, t));
      const sizeYMultiplier = clamp01(evaluateCurve(em.sizeYOverLifetime, t));

      p.scaleX = p.baseSizeX * sizeXMultiplier * em.scaleRatioX;
      p.scaleY = p.baseSizeY * sizeYMultiplier * em.scaleRatioY;
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

      const angularVelocity =
        p.baseAngularVelocity *
        clamp01(evaluateCurve(em.angularVelocityOverLifetime, t));
      p.rotation += angularVelocity * dt;

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
      baseSpinRate: sampleRange(em.spinRange),
      baseAngularVelocity: sampleRange(em.angularVelocityRange),
      baseGravity: sampleRange(em.gravityRange),
      baseDrag: sampleRange(em.dragRange),
      baseNoiseStrength: sampleRange(em.noiseStrengthRange),
      baseNoiseFrequency: sampleRange(em.noiseFrequencyRange),
      baseNoiseSpeed: sampleRange(em.noiseSpeedRange),
      baseAttraction: sampleRange(em.attractionRange),
      baseVortexStrength: sampleRange(em.vortexStrengthRange),
      baseSpeedScale: sampleRange(em.speedRange),
      baseWeight: sampleRange(em.weightRange),
      baseSizeX: sampleRange(em.sizeXRange),
      baseSizeY: sampleRange(em.sizeYRange),
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      color: { r: 255, g: 255, b: 255, a: 255 },
      alpha: 1,
    };
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
      if (em.emissionMode === "area") {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * em.shapeRadius;
        pos.x += Math.cos(angle) * radius;
        pos.y += Math.sin(angle) * radius;
      } else {
        const angle = Math.random() * Math.PI * 2;
        pos.x += Math.cos(angle) * em.shapeRadius;
        pos.y += Math.sin(angle) * em.shapeRadius;
      }
    } else if (em.shape === "rectangle") {
      let offsetX = 0;
      let offsetY = 0;

      if (em.emissionMode === "area") {
        offsetX = (Math.random() - 0.5) * em.shapeWidth;
        offsetY = (Math.random() - 0.5) * em.shapeHeight;
      } else {
        const perimeter = 2 * (em.shapeWidth + em.shapeHeight);
        const t = Math.random() * perimeter;

        if (t < em.shapeWidth) {
          offsetX = t - em.shapeWidth / 2;
          offsetY = -em.shapeHeight / 2;
        } else if (t < em.shapeWidth + em.shapeHeight) {
          offsetX = em.shapeWidth / 2;
          offsetY = t - em.shapeWidth - em.shapeHeight / 2;
        } else if (t < 2 * em.shapeWidth + em.shapeHeight) {
          offsetX = 2 * em.shapeWidth + em.shapeHeight - t - em.shapeWidth / 2;
          offsetY = em.shapeHeight / 2;
        } else {
          offsetX = -em.shapeWidth / 2;
          offsetY = perimeter - t - em.shapeHeight / 2;
        }
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
    const w = em.shapeWidth;
    const h = em.shapeHeight;
    const r = Math.min(em.roundRadius, w / 2, h / 2);

    let offsetX = 0;
    let offsetY = 0;

    if (em.emissionMode === "area") {
      offsetX = (Math.random() - 0.5) * w;
      offsetY = (Math.random() - 0.5) * h;
    } else {
      const straightWidth = w - 2 * r;
      const straightHeight = h - 2 * r;
      const perimeter = 2 * (straightWidth + straightHeight) + 2 * Math.PI * r;
      const t = Math.random() * perimeter;

      if (t < straightWidth) {
        // Top edge
        offsetX = t - w / 2 + r;
        offsetY = -h / 2;
      } else if (t < straightWidth + (Math.PI * r) / 2) {
        // Top-right corner
        const arcProgress = (t - straightWidth) / r;
        const angle = arcProgress - Math.PI / 2;
        const centerX = w / 2 - r;
        const centerY = -h / 2 + r;
        offsetX = centerX + Math.cos(angle) * r;
        offsetY = centerY + Math.sin(angle) * r;
      } else if (t < straightWidth + (Math.PI * r) / 2 + straightHeight) {
        // Right edge
        offsetX = w / 2;
        offsetY = t - (straightWidth + (Math.PI * r) / 2) - h / 2 + r;
      } else if (t < straightWidth + Math.PI * r + straightHeight) {
        // Bottom-right corner
        const arcProgress =
          (t - (straightWidth + (Math.PI * r) / 2 + straightHeight)) / r;
        const angle = arcProgress;
        const centerX = w / 2 - r;
        const centerY = h / 2 - r;
        offsetX = centerX + Math.cos(angle) * r;
        offsetY = centerY + Math.sin(angle) * r;
      } else if (t < 2 * straightWidth + Math.PI * r + straightHeight) {
        // Bottom edge
        offsetX = (w / 2 - r) - (t - (straightWidth + Math.PI * r + straightHeight));
        offsetY = h / 2;
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
      } else if (
        t <
        2 * straightWidth + (3 * Math.PI * r) / 2 + 2 * straightHeight
      ) {
        // Left edge
        offsetX = -w / 2;
        offsetY =
          (h / 2 - r) -
          (t - (2 * straightWidth + (3 * Math.PI * r) / 2 + straightHeight));
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
    for (const p of this.particles) {
      const emitter = this.settings.emitters.find((e) => e.id === p.emitterId);
      if (!emitter || !emitter.visible) continue;

      const spriteCanvas = spriteCanvases ? spriteCanvases[emitter.id] : null;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(p.scaleX, p.scaleY);
      ctx.globalAlpha = p.alpha;

      if (spriteCanvas) {
        const size = 16;
        const tempCanvas = document.createElement("canvas");
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

  private renderEmitters(ctx: CanvasRenderingContext2D, zoom: number): void {
    for (const emitter of this.settings.emitters) {
      if (!emitter.visible) continue;

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
      ctx.beginPath();
      ctx.arc(em.position.x, em.position.y, em.shapeRadius, 0, Math.PI * 2);
      if (em.emissionMode === "area") ctx.fill();
      ctx.stroke();
    } else if (em.shape === "rectangle") {
      ctx.save();
      ctx.translate(em.position.x, em.position.y);
      ctx.rotate((em.shapeRotation * Math.PI) / 180);

      const x = -em.shapeWidth / 2;
      const y = -em.shapeHeight / 2;
      if (em.emissionMode === "area")
        ctx.fillRect(x, y, em.shapeWidth, em.shapeHeight);
      ctx.strokeRect(x, y, em.shapeWidth, em.shapeHeight);

      ctx.restore();
    } else if (em.shape === "roundedRect") {
      ctx.save();
      ctx.translate(em.position.x, em.position.y);
      ctx.rotate((em.shapeRotation * Math.PI) / 180);

      const x = -em.shapeWidth / 2;
      const y = -em.shapeHeight / 2;
      const r = Math.min(em.roundRadius, em.shapeWidth / 2, em.shapeHeight / 2);

      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + em.shapeWidth - r, y);
      ctx.arcTo(x + em.shapeWidth, y, x + em.shapeWidth, y + r, r);
      ctx.lineTo(x + em.shapeWidth, y + em.shapeHeight - r);
      ctx.arcTo(
        x + em.shapeWidth,
        y + em.shapeHeight,
        x + em.shapeWidth - r,
        y + em.shapeHeight,
        r
      );
      ctx.lineTo(x + r, y + em.shapeHeight);
      ctx.arcTo(x, y + em.shapeHeight, x, y + em.shapeHeight - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();

      if (em.emissionMode === "area") ctx.fill();
      ctx.stroke();

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
