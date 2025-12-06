/**
 * CanvasParticleRenderer - Separation of Concerns (SRP)
 *
 * This class handles ALL Canvas 2D rendering logic.
 * ParticleEngine is responsible ONLY for physics/simulation.
 *
 * Benefits:
 * - Clean separation: simulation vs presentation
 * - Can be replaced with other renderers (WebGL, PixiJS, etc.)
 * - All Canvas-specific optimizations in one place
 */

import type { ParticleSettings, EmitterInstance } from "../types";
import type { ParticleEngine } from "./ParticleEngine";
import { evaluateCurve } from "../utils";

// ============================================================
// RENDER OPTIONS (Ephemeral UI State)
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
// CANVAS PARTICLE RENDERER CLASS
// ============================================================

export class CanvasParticleRenderer {
  // Canvas pool for colorization (avoid DOM allocations)
  private tempCanvasPool: HTMLCanvasElement[] = [];
  private readonly CANVAS_POOL_SIZE = 5;

  // Cache for tinted sprites to avoid per-particle recoloring
  private tintedSpriteCache: Map<string, HTMLCanvasElement> = new Map();
  private tintedCacheOrder: string[] = [];
  private readonly TINT_CACHE_LIMIT = 128;
  private spriteCacheIds: WeakMap<HTMLCanvasElement, number> = new WeakMap();
  private spriteIdCounter = 0;

  // Cache 2D contexts (avoid repeated getContext() calls)
  private canvasContextCache: Map<HTMLCanvasElement, CanvasRenderingContext2D> = new Map();

  constructor() {
    this.initializeCanvasPool();
  }

  // ============================================================
  // CANVAS POOL MANAGEMENT
  // ============================================================

  /**
   * Initialize the canvas pool with pre-created canvases
   */
  private initializeCanvasPool(): void {
    const size = 32; // Default sprite size (16 * 2)
    for (let i = 0; i < this.CANVAS_POOL_SIZE; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      this.tempCanvasPool.push(canvas);

      // Pre-cache 2D context
      const ctx = canvas.getContext("2d");
      if (ctx) {
        this.canvasContextCache.set(canvas, ctx);
      }
    }
  }

  /**
   * Get a temporary canvas from the pool
   * Only resizes if necessary (resize clears internal buffer!)
   */
  private getTempCanvas(width: number, height: number): HTMLCanvasElement {
    if (this.tempCanvasPool.length > 0) {
      const canvas = this.tempCanvasPool.pop()!;
      // Only resize if necessary (expensive operation!)
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return canvas;
    }
    // Fallback: create new canvas if pool exhausted
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    // Cache context
    const ctx = canvas.getContext("2d");
    if (ctx) {
      this.canvasContextCache.set(canvas, ctx);
    }
    return canvas;
  }

  /**
   * Get cached 2D context for a canvas
   */
  private getCachedContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
    let ctx = this.canvasContextCache.get(canvas);
    if (!ctx) {
      ctx = canvas.getContext("2d")!;
      this.canvasContextCache.set(canvas, ctx);
    }
    return ctx;
  }

  /**
   * Return canvas to pool for reuse
   */
  private returnTempCanvas(canvas: HTMLCanvasElement): void {
    if (this.tempCanvasPool.length < this.CANVAS_POOL_SIZE) {
      this.tempCanvasPool.push(canvas);
    }
  }

  // ============================================================
  // MAIN RENDER METHOD
  // ============================================================

  /**
   * Render the particle system to canvas
   * @param ctx Canvas 2D context
   * @param engine Particle engine (for data access)
   * @param settings Particle settings
   * @param options Render options (zoom, grid, etc.)
   */
  render(
    ctx: CanvasRenderingContext2D,
    engine: ParticleEngine,
    settings: ParticleSettings,
    options: RenderOptions
  ): void {
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
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const offsetX = centerX;
    const offsetY = centerY;

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
    this.renderParticles(ctx, engine, settings, spriteCanvases);

    // Draw emitters
    if (showEmitter) {
      this.renderEmitters(ctx, settings, zoom);
    }

    ctx.restore();
  }

  // ============================================================
  // GRID RENDERING
  // ============================================================

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

  // ============================================================
  // PARTICLE RENDERING
  // ============================================================

  private renderParticles(
    ctx: CanvasRenderingContext2D,
    engine: ParticleEngine,
    settings: ParticleSettings,
    spriteCanvases: Record<string, HTMLCanvasElement | null> | null
  ): void {
    // Get grouped particles from engine
    const particlesByEmitter = engine.getParticlesByEmitter();

    // Render particles grouped by emitter (no sorting needed!)
    // Render in reverse order so first emitter (index 0) renders last = on top
    for (let i = settings.emitters.length - 1; i >= 0; i--) {
      const emitter = settings.emitters[i];
      if (!emitter.visible || !emitter.enabled) continue;

      const emitterParticles = particlesByEmitter.get(emitter.id);
      if (!emitterParticles || emitterParticles.length === 0) continue;

      const spriteCanvas = spriteCanvases ? spriteCanvases[emitter.id] : null;
      const canvasWidth = spriteCanvas?.width ?? 32;
      const canvasHeight = spriteCanvas?.height ?? 32;
      const colorizeSprite = this.shouldColorizeSprite(emitter.settings);

      // Render all particles from this emitter
      for (const p of emitterParticles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(p.scaleX, p.scaleY);
        ctx.globalAlpha = p.alpha;

        if (spriteCanvas) {
          if (!colorizeSprite) {
            ctx.scale(1, -1);
            ctx.drawImage(
              spriteCanvas,
              -canvasWidth / 2,
              -canvasHeight / 2,
              canvasWidth,
              canvasHeight
            );
          } else {
            const tintedSprite = this.getTintedSprite(
              emitter.id,
              spriteCanvas,
              p.color,
              canvasWidth,
              canvasHeight
            );

            ctx.scale(1, -1);
            ctx.drawImage(
              tintedSprite,
              -canvasWidth / 2,
              -canvasHeight / 2,
              canvasWidth,
              canvasHeight
            );
          }
        } else {
          const circleSize = 8;
          ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 1)`;
          ctx.beginPath();
          ctx.arc(0, 0, circleSize, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }

  private shouldColorizeSprite(settings: EmitterInstance["settings"]): boolean {
    const legacySpriteColorMode = (settings as any).spriteColorMode as
      | "none"
      | "colorize"
      | undefined;
    const legacyTintFlag = (settings as any).tintSprite as boolean | undefined;
    if (typeof settings.colorizeSprite === "boolean") {
      return settings.colorizeSprite;
    }
    if (legacySpriteColorMode) {
      return legacySpriteColorMode === "colorize" || legacyTintFlag === true;
    }
    return legacyTintFlag ?? true;
  }

  private getTintedSprite(
    emitterId: string,
    spriteCanvas: HTMLCanvasElement,
    color: { r: number; g: number; b: number },
    canvasWidth: number,
    canvasHeight: number
  ): HTMLCanvasElement {
    const quantizedColor = this.quantizeColor(color);
    const spriteId = this.getSpriteCacheId(spriteCanvas);
    const cacheKey = `${emitterId}:${spriteId}:${canvasWidth}x${canvasHeight}:${quantizedColor.r}-${quantizedColor.g}-${quantizedColor.b}`;
    const cached = this.tintedSpriteCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tintCanvas = document.createElement("canvas");
    tintCanvas.width = canvasWidth;
    tintCanvas.height = canvasHeight;
    const tintCtx = this.getCachedContext(tintCanvas);
    tintCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    tintCtx.drawImage(spriteCanvas, 0, 0, canvasWidth, canvasHeight);
    tintCtx.globalCompositeOperation = "source-in";
    tintCtx.fillStyle = `rgba(${quantizedColor.r}, ${quantizedColor.g}, ${quantizedColor.b}, 1)`;
    tintCtx.fillRect(0, 0, canvasWidth, canvasHeight);
    tintCtx.globalCompositeOperation = "source-over";

    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = canvasWidth;
    resultCanvas.height = canvasHeight;
    const resultCtx = this.getCachedContext(resultCanvas);
    resultCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    resultCtx.drawImage(spriteCanvas, 0, 0, canvasWidth, canvasHeight);
    resultCtx.globalAlpha = 0.65;
    resultCtx.drawImage(tintCanvas, 0, 0, canvasWidth, canvasHeight);
    resultCtx.globalAlpha = 1;

    this.cacheTintedSprite(cacheKey, resultCanvas);
    return resultCanvas;
  }

  private cacheTintedSprite(key: string, canvas: HTMLCanvasElement): void {
    if (this.tintedSpriteCache.has(key)) return;
    this.tintedSpriteCache.set(key, canvas);
    this.tintedCacheOrder.push(key);
    if (this.tintedCacheOrder.length > this.TINT_CACHE_LIMIT) {
      const oldestKey = this.tintedCacheOrder.shift();
      if (oldestKey) {
        const oldestCanvas = this.tintedSpriteCache.get(oldestKey);
        this.tintedSpriteCache.delete(oldestKey);
        if (oldestCanvas) {
          this.canvasContextCache.delete(oldestCanvas);
        }
      }
    }
  }

  private quantizeColor(color: { r: number; g: number; b: number }) {
    const step = 8;
    return {
      r: Math.min(255, Math.max(0, Math.round(color.r / step) * step)),
      g: Math.min(255, Math.max(0, Math.round(color.g / step) * step)),
      b: Math.min(255, Math.max(0, Math.round(color.b / step) * step)),
    };
  }

  private getSpriteCacheId(spriteCanvas: HTMLCanvasElement): number {
    const existingId = this.spriteCacheIds.get(spriteCanvas);
    if (existingId !== undefined) {
      return existingId;
    }
    const newId = this.spriteIdCounter++;
    this.spriteCacheIds.set(spriteCanvas, newId);
    return newId;
  }

  // ============================================================
  // EMITTER RENDERING
  // ============================================================

  private renderEmitters(
    ctx: CanvasRenderingContext2D,
    settings: ParticleSettings,
    zoom: number
  ): void {
    for (const emitter of settings.emitters) {
      if (!emitter.visible || !emitter.enabled) continue;

      const em = emitter.settings;
      const isCurrentEmitter =
        emitter.id === settings.emitters[settings.currentEmitterIndex]?.id;

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
        ctx.beginPath();
        ctx.arc(em.position.x, em.position.y, em.shapeRadius, startAngle, endAngle);
        if (em.circleArc < 360) {
          ctx.lineTo(em.position.x, em.position.y);
          ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
      } else {
        const thickness = em.circleThickness;
        const innerRadius = Math.max(0, em.shapeRadius - thickness / 2);
        const outerRadius = em.shapeRadius + thickness / 2;

        ctx.beginPath();
        ctx.arc(em.position.x, em.position.y, outerRadius, startAngle, endAngle);
        ctx.stroke();

        if (innerRadius > 0) {
          ctx.beginPath();
          ctx.arc(em.position.x, em.position.y, innerRadius, startAngle, endAngle);
          ctx.stroke();
        }

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

        ctx.beginPath();
        ctx.arc(em.position.x, em.position.y, em.shapeRadius, startAngle, endAngle);
        ctx.stroke();
      }
    } else if (em.shape === "rectangle") {
      this.renderRectangleShape(ctx, em);
    } else if (em.shape === "roundedRect") {
      this.renderRoundedRectShape(ctx, em);
    }
  }

  private renderRectangleShape(
    ctx: CanvasRenderingContext2D,
    em: EmitterInstance["settings"]
  ): void {
    ctx.save();
    ctx.translate(em.position.x, em.position.y);
    ctx.rotate((em.shapeRotation * Math.PI) / 180);

    const x = -em.shapeWidth / 2;
    const y = -em.shapeHeight / 2;
    const w = em.shapeWidth;
    const h = em.shapeHeight;

    if (em.emissionMode === "area") {
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    } else {
      const thickness = em.rectangleThickness;
      const cropFraction = em.rectangleArc / 360;

      const outerX = x - thickness / 2;
      const outerY = y - thickness / 2;
      const outerW = w + thickness;
      const outerH = h + thickness;

      const innerX = x + thickness / 2;
      const innerY = y + thickness / 2;
      const innerW = w - thickness;
      const innerH = h - thickness;

      if (cropFraction >= 1) {
        ctx.strokeRect(outerX, outerY, outerW, outerH);
        if (innerW > 0 && innerH > 0) {
          ctx.strokeRect(innerX, innerY, innerW, innerH);
        }
        ctx.strokeRect(x, y, w, h);
      } else {
        const drawPartialRect = (rx: number, ry: number, rw: number, rh: number) => {
          const rectPerimeter = 2 * (rw + rh);
          const cropLength = rectPerimeter * cropFraction;
          let remaining = cropLength;

          ctx.beginPath();

          if (remaining > 0) {
            const len = Math.min(remaining, rw);
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx + len, ry);
            remaining -= len;

            if (remaining > 0) {
              const len = Math.min(remaining, rh);
              ctx.lineTo(rx + rw, ry);
              ctx.lineTo(rx + rw, ry + len);
              remaining -= len;

              if (remaining > 0) {
                const len = Math.min(remaining, rw);
                ctx.lineTo(rx + rw, ry + rh);
                ctx.lineTo(rx + rw - len, ry + rh);
                remaining -= len;

                if (remaining > 0) {
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
  }

  private renderRoundedRectShape(
    ctx: CanvasRenderingContext2D,
    em: EmitterInstance["settings"]
  ): void {
    ctx.save();
    ctx.translate(em.position.x, em.position.y);
    ctx.rotate((em.shapeRotation * Math.PI) / 180);

    const x = -em.shapeWidth / 2;
    const y = -em.shapeHeight / 2;
    const w = em.shapeWidth;
    const h = em.shapeHeight;
    const r = Math.min(em.roundRadius, w / 2, h / 2);

    if (em.emissionMode === "area") {
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
      const thickness = em.rectangleThickness;
      const cropFraction = em.rectangleArc / 360;

      const drawRoundedRect = (offset: number) => {
        const ox = x + offset;
        const oy = y + offset;
        const ow = w - 2 * offset;
        const oh = h - 2 * offset;
        const or = Math.max(0, r + offset);

        if (ow <= 0 || oh <= 0) return;

        if (cropFraction >= 1) {
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
          const straightWidth = ow - 2 * or;
          const straightHeight = oh - 2 * or;
          const fullPerimeter = 2 * (straightWidth + straightHeight) + 2 * Math.PI * or;
          const cropLength = fullPerimeter * cropFraction;
          let remaining = cropLength;

          ctx.beginPath();
          const startX = ox + or;
          const startY = oy;
          ctx.moveTo(startX, startY);

          if (remaining > 0 && straightWidth > 0) {
            const len = Math.min(remaining, straightWidth);
            ctx.lineTo(ox + or + len, oy);
            remaining -= len;

            if (remaining > 0) {
              const cornerArc = (Math.PI * or) / 2;
              if (remaining >= cornerArc) {
                ctx.arcTo(ox + ow, oy, ox + ow, oy + or, or);
                remaining -= cornerArc;

                if (remaining > 0 && straightHeight > 0) {
                  const len = Math.min(remaining, straightHeight);
                  ctx.lineTo(ox + ow, oy + or + len);
                  remaining -= len;

                  if (remaining > 0) {
                    if (remaining >= cornerArc) {
                      ctx.arcTo(ox + ow, oy + oh, ox + ow - or, oy + oh, or);
                      remaining -= cornerArc;

                      if (remaining > 0 && straightWidth > 0) {
                        const len = Math.min(remaining, straightWidth);
                        ctx.lineTo(ox + ow - or - len, oy + oh);
                        remaining -= len;

                        if (remaining > 0) {
                          if (remaining >= cornerArc) {
                            ctx.arcTo(ox, oy + oh, ox, oy + oh - or, or);
                            remaining -= cornerArc;

                            if (remaining > 0 && straightHeight > 0) {
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

      drawRoundedRect(-thickness / 2);
      drawRoundedRect(0);
      drawRoundedRect(thickness / 2);
    }

    ctx.restore();
  }

  private renderVortexVisualization(
    ctx: CanvasRenderingContext2D,
    em: EmitterInstance["settings"],
    zoom: number
  ): void {
    const previewStrength = evaluateCurve(em.vortexStrengthOverLifetime, 0.5);
    const directionSign = previewStrength === 0 ? 1 : Math.sign(previewStrength);
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
}
