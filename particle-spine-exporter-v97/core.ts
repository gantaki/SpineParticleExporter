/**
 * Core ParticleSystem simulation engine
 */

import type { ParticleSettings, Particle, Vec2, Color } from './types';
import { sampleRange, evaluateCurve, evaluateColorGradient, noise2D } from './utils';

class ParticleSystem {
  particles: Particle[] = [];
  settings: ParticleSettings;
  time: number = 0;
  spawnAccumulator: number = 0;
  nextParticleId: number = 0;
  burstCycleIndex: number = 0;
  lastBurstTime: number = 0;
  hasPrewarmed: boolean = false;

  constructor(settings: ParticleSettings) {
    this.settings = settings;
  }

  reset() {
    this.particles = [];
    this.time = 0;
    this.spawnAccumulator = 0;
    this.nextParticleId = 0;
    this.burstCycleIndex = 0;
    this.lastBurstTime = 0;
    this.hasPrewarmed = false;
    
    // Prewarm if enabled
    if (this.settings.emitter.prewarm && this.settings.emitter.looping) {
      this.prewarm();
    }
  }
  
  prewarm() {
    // Simulate one full duration cycle
    const duration = this.settings.duration;
    const dt = 1 / 60; // 60 fps simulation
    const steps = Math.ceil(duration / dt);
    
    for (let i = 0; i < steps; i++) {
      this.update(dt, true); // Skip time advancement in loop
    }
    
    // Reset time but keep particles
    this.time = 0;
    this.hasPrewarmed = true;
  }

  update(dt: number, skipTimeReset: boolean = false) {
    this.time += dt;
    
    const em = this.settings.emitter;
    
    // Handle looping
    if (em.looping && !skipTimeReset) {
      const effectiveTime = this.time - em.startDelay;
      if (effectiveTime >= this.settings.duration) {
        // Loop back
        this.time = em.startDelay;
        this.burstCycleIndex = 0;
        this.lastBurstTime = em.startDelay;
      }
    } else if (!em.looping && !skipTimeReset) {
      // When not looping, cap time at duration
      const maxTime = em.startDelay + this.settings.duration;
      if (this.time > maxTime) {
        this.time = maxTime;
      }
    }
    
    // Check if we're in the active emission period (after start delay)
    const effectiveTime = this.time - em.startDelay;
    const isActive = effectiveTime >= 0;
    
    if (isActive) {
      if (em.emissionType === 'continuous') {
        this.spawnAccumulator += dt;
        const spawnInterval = 1 / em.rate;
        
        while (this.spawnAccumulator >= spawnInterval && this.particles.length < em.maxParticles) {
          this.spawnParticle();
          this.spawnAccumulator -= spawnInterval;
        }
      } 
      else if (em.emissionType === 'burst') {
        const cycleLimit = em.looping ? Infinity : em.burstCycles;
        
        if (this.burstCycleIndex < cycleLimit) {
          const timeSinceLastBurst = effectiveTime - (this.lastBurstTime - em.startDelay);
          
          if (timeSinceLastBurst >= em.burstInterval || this.burstCycleIndex === 0) {
            for (let i = 0; i < em.burstCount && this.particles.length < em.maxParticles; i++) {
              this.spawnParticle();
            }
            this.lastBurstTime = this.time;
            this.burstCycleIndex++;
          }
        }
      }
      else if (em.emissionType === 'duration') {
        if (effectiveTime >= em.durationStart && effectiveTime <= em.durationEnd) {
          this.spawnAccumulator += dt;
          const spawnInterval = 1 / em.rate;
          
          while (this.spawnAccumulator >= spawnInterval && this.particles.length < em.maxParticles) {
            this.spawnParticle();
            this.spawnAccumulator -= spawnInterval;
          }
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const t = 1 - (p.life / p.maxLife);

      const sizeXMultiplier = clamp01(evaluateCurve(this.settings.sizeXOverLifetime, t));
      const sizeYMultiplier = clamp01(evaluateCurve(this.settings.sizeYOverLifetime, t));

      p.scaleX = p.baseSizeX * sizeXMultiplier * this.settings.scaleRatioX;
      p.scaleY = p.baseSizeY * sizeYMultiplier * this.settings.scaleRatioY;

      p.scale = (p.scaleX + p.scaleY) / 2;

      const speedMultiplier = clamp01(evaluateCurve(this.settings.speedOverLifetime, t));
      const weightMultiplier = clamp01(evaluateCurve(this.settings.weightOverLifetime, t));

      const gravity = p.baseGravity * clamp01(evaluateCurve(this.settings.gravityOverLifetime, t));
      const weight = p.baseWeight * weightMultiplier;
      p.vy += gravity * weight * dt;

      const noiseStrength = p.baseNoiseStrength * clamp01(evaluateCurve(this.settings.noiseStrengthOverLifetime, t));
      if (noiseStrength !== 0) {
        const noiseX = p.x * p.baseNoiseFrequency;
        const noiseY = p.y * p.baseNoiseFrequency;
        const noiseTime = this.time * p.baseNoiseSpeed;

        const noiseForce = noise2D(noiseX, noiseY, noiseTime);

        p.vx += noiseForce.x * noiseStrength * dt;
        p.vy += noiseForce.y * noiseStrength * dt;
      }

      const attractionStrength = p.baseAttraction * clamp01(evaluateCurve(this.settings.attractionOverLifetime, t));
      if (attractionStrength !== 0) {
        const dx = this.settings.attractionPoint.x - p.x;
        const dy = this.settings.attractionPoint.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          p.vx += (dx / dist) * attractionStrength * dt;
          p.vy += (dy / dist) * attractionStrength * dt;
        }
      }
      
      const vortexStrength = p.baseVortexStrength * clamp01(evaluateCurve(this.settings.vortexStrengthOverLifetime, t));
      if (vortexStrength !== 0) {
        const dx = this.settings.vortexPoint.x - p.x;
        const dy = this.settings.vortexPoint.y - p.y;
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
      
      const drag = p.baseDrag * clamp01(evaluateCurve(this.settings.dragOverLifetime, t));
      p.vx *= drag;
      p.vy *= drag;

      const speedFactor = p.baseSpeedScale * speedMultiplier;
      p.x += p.vx * speedFactor * dt;
      p.y += p.vy * speedFactor * dt;

      const spinSpeed = p.baseSpinRate * clamp01(evaluateCurve(this.settings.spinOverLifetime, t));
      p.rotation += spinSpeed * dt;

      const angularVelocity = p.baseAngularVelocity * clamp01(evaluateCurve(this.settings.angularVelocityOverLifetime, t));
      p.rotation += angularVelocity * dt;

      const colorData = evaluateColorGradient(this.settings.colorOverLifetime, t);
      p.color = { r: colorData.r, g: colorData.g, b: colorData.b, a: 255 };
      p.alpha = colorData.a / 255;
    }
  }

  spawnParticle() {
    const em = this.settings.emitter;
    let pos = { ...em.position };

    if (em.shape === 'point') {
      // Point
    } else if (em.shape === 'line') {
      const angleRad = em.angle * Math.PI / 180;
      const t = Math.random();
      const distance = (t - 0.5) * em.lineLength;
      pos.x += Math.cos(angleRad) * distance;
      pos.y += Math.sin(angleRad) * distance;
    } else if (em.shape === 'circle') {
      if (em.emissionMode === 'area') {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * em.shapeRadius;
        pos.x += Math.cos(angle) * radius;
        pos.y += Math.sin(angle) * radius;
      } else {
        const angle = Math.random() * Math.PI * 2;
        pos.x += Math.cos(angle) * em.shapeRadius;
        pos.y += Math.sin(angle) * em.shapeRadius;
      }
    } else if (em.shape === 'rectangle') {
      if (em.emissionMode === 'area') {
        pos.x += (Math.random() - 0.5) * em.shapeWidth;
        pos.y += (Math.random() - 0.5) * em.shapeHeight;
      } else {
        const perimeter = 2 * (em.shapeWidth + em.shapeHeight);
        const t = Math.random() * perimeter;
        
        if (t < em.shapeWidth) {
          pos.x += t - em.shapeWidth / 2;
          pos.y -= em.shapeHeight / 2;
        } else if (t < em.shapeWidth + em.shapeHeight) {
          pos.x += em.shapeWidth / 2;
          pos.y += (t - em.shapeWidth) - em.shapeHeight / 2;
        } else if (t < 2 * em.shapeWidth + em.shapeHeight) {
          pos.x += (2 * em.shapeWidth + em.shapeHeight - t) - em.shapeWidth / 2;
          pos.y += em.shapeHeight / 2;
        } else {
          pos.x -= em.shapeWidth / 2;
          pos.y += (perimeter - t) - em.shapeHeight / 2;
        }
      }
    } else if (em.shape === 'roundedRect') {
      const w = em.shapeWidth;
      const h = em.shapeHeight;
      const r = Math.min(em.roundRadius, w / 2, h / 2);
      
      if (em.emissionMode === 'area') {
        pos.x += (Math.random() - 0.5) * w;
        pos.y += (Math.random() - 0.5) * h;
      } else {
        const straightWidth = w - 2 * r;
        const straightHeight = h - 2 * r;
        const perimeter = 2 * (straightWidth + straightHeight) + 2 * Math.PI * r;
        const t = Math.random() * perimeter;
        
        if (t < straightWidth) {
          pos.x += (t - w / 2 + r);
          pos.y -= h / 2;
        } else if (t < straightWidth + Math.PI * r / 2) {
          const angle = (t - straightWidth) / r - Math.PI / 2;
          pos.x += w / 2 - r + Math.cos(angle) * r;
          pos.y -= h / 2 - r + Math.sin(angle) * r;
        } else if (t < straightWidth + Math.PI * r / 2 + straightHeight) {
          pos.x += w / 2;
          pos.y += (t - (straightWidth + Math.PI * r / 2)) - h / 2 + r;
        } else if (t < straightWidth + Math.PI * r + straightHeight) {
          const angle = (t - (straightWidth + Math.PI * r / 2 + straightHeight)) / r;
          pos.x += w / 2 - r + Math.cos(angle) * r;
          pos.y += h / 2 - r + Math.sin(angle) * r;
        } else if (t < 2 * straightWidth + Math.PI * r + straightHeight) {
          pos.x += w / 2 - (t - (straightWidth + Math.PI * r + straightHeight));
          pos.y += h / 2;
        } else if (t < 2 * straightWidth + 3 * Math.PI * r / 2 + straightHeight) {
          const angle = (t - (2 * straightWidth + Math.PI * r + straightHeight)) / r + Math.PI / 2;
          pos.x -= w / 2 - r - Math.cos(angle) * r;
          pos.y += h / 2 - r + Math.sin(angle) * r;
        } else if (t < 2 * straightWidth + 3 * Math.PI * r / 2 + 2 * straightHeight) {
          pos.x -= w / 2;
          pos.y += h / 2 - (t - (2 * straightWidth + 3 * Math.PI * r / 2 + straightHeight));
        } else {
          const angle = (t - (2 * straightWidth + 3 * Math.PI * r / 2 + 2 * straightHeight)) / r + Math.PI;
          pos.x -= w / 2 - r + Math.cos(angle) * r;
          pos.y -= h / 2 - r + Math.sin(angle) * r;
        }
      }
    }

    const angleRad = (em.angle + (Math.random() - 0.5) * em.angleSpread) * Math.PI / 180;
    const speed = sampleRange(this.settings.initialSpeedRange);

    let initialRotation = 0;
    switch (this.settings.spawnAngleMode) {
      case 'alignMotion':
        initialRotation = angleRad;
        break;
      case 'specific':
        initialRotation = this.settings.spawnAngle * Math.PI / 180;
        break;
      case 'random':
        initialRotation = Math.random() * Math.PI * 2;
        break;
      case 'range':
      default:
        initialRotation = (this.settings.spawnAngleMin +
          Math.random() * (this.settings.spawnAngleMax - this.settings.spawnAngleMin)) * Math.PI / 180;
        break;
    }

    const baseGravity = sampleRange(this.settings.gravityRange);
    const baseDrag = sampleRange(this.settings.dragRange);
    const baseNoiseStrength = sampleRange(this.settings.noiseStrengthRange);
    const baseNoiseFrequency = sampleRange(this.settings.noiseFrequencyRange);
    const baseNoiseSpeed = sampleRange(this.settings.noiseSpeedRange);
    const baseAttraction = sampleRange(this.settings.attractionRange);
    const baseVortexStrength = sampleRange(this.settings.vortexStrengthRange);
    const baseSpeedScale = sampleRange(this.settings.speedRange);
    const baseWeight = sampleRange(this.settings.weightRange);
    const baseSizeX = sampleRange(this.settings.sizeXRange);
    const baseSizeY = sampleRange(this.settings.sizeYRange);
    const baseSpinRate = sampleRange(this.settings.spinRange);
    const baseAngularVelocity = sampleRange(this.settings.angularVelocityRange);

    const particle: Particle = {
      id: this.nextParticleId++,
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angleRad) * speed,
      vy: Math.sin(angleRad) * speed,
      life: this.settings.lifeTimeMin + Math.random() * (this.settings.lifeTimeMax - this.settings.lifeTimeMin),
      maxLife: 0,
      baseSpeed: speed,
      rotation: initialRotation,
      baseSpinRate,
      baseAngularVelocity,
      baseGravity,
      baseDrag,
      baseNoiseStrength,
      baseNoiseFrequency,
      baseNoiseSpeed,
      baseAttraction,
      baseVortexStrength,
      baseSpeedScale,
      baseWeight,
      baseSizeX,
      baseSizeY,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      color: { r: 255, g: 255, b: 255, a: 255 },
      alpha: 1
    };
    particle.maxLife = particle.life;

    this.particles.push(particle);
  }

  render(ctx: CanvasRenderingContext2D, showEmitter: boolean, zoom: number, spriteCanvas: HTMLCanvasElement | null, showGrid: boolean = false, backgroundImage?: HTMLImageElement | null, bgPosition?: { x: number; y: number }) {
    // Clear entire canvas first
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    
    // Set up zoom transform centered on emitter
    const emitterX = this.settings.emitter.position.x;
    const emitterY = this.settings.emitter.position.y;
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    
    const offsetX = centerX - emitterX * zoom;
    const offsetY = centerY - emitterY * zoom;
    
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
    
    // Draw background
    if (backgroundImage && bgPosition) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.drawImage(backgroundImage, bgPosition.x, bgPosition.y);
      ctx.restore();
    }

    // Draw grid
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
      ctx.lineWidth = 1 / zoom;
      const gridStep = 50;

      // Calculate visible area
      const visibleLeft = -offsetX / zoom;
      const visibleRight = (ctx.canvas.width - offsetX) / zoom;
      const visibleTop = -offsetY / zoom;
      const visibleBottom = (ctx.canvas.height - offsetY) / zoom;

      // Draw vertical lines
      const startX = Math.floor(visibleLeft / gridStep) * gridStep;
      const endX = Math.ceil(visibleRight / gridStep) * gridStep;
      for (let x = startX; x <= endX; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, visibleTop);
        ctx.lineTo(x, visibleBottom);
        ctx.stroke();
      }

      // Draw horizontal lines
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

    // Draw particles
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(p.scaleX, p.scaleY);
      
      ctx.globalAlpha = p.alpha;
      
      if (spriteCanvas) {
        const size = 16;
        
        // Create a temporary canvas for colored sprite
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = size * 2;
        tempCanvas.height = size * 2;
        const tempCtx = tempCanvas.getContext('2d')!;
        
        // Draw white sprite
        tempCtx.drawImage(spriteCanvas, 0, 0, size * 2, size * 2);
        
        // Apply color tint
        tempCtx.globalCompositeOperation = 'source-in';
        tempCtx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 1)`;
        tempCtx.fillRect(0, 0, size * 2, size * 2);
        
        // Draw colored sprite to main canvas
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
    
    // Draw emitter on top
    if (showEmitter) {
      const em = this.settings.emitter;
      ctx.save();
      
      const strokeColor = em.emissionMode === 'edge' ? 'rgba(255, 150, 100, 0.7)' : 'rgba(100, 255, 100, 0.5)';
      const fillColor = em.emissionMode === 'edge' ? 'rgba(255, 150, 100, 0.1)' : 'rgba(100, 255, 100, 0.2)';
      
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);

      if (em.shape === 'point') {
        ctx.beginPath();
        ctx.moveTo(em.position.x - 10, em.position.y);
        ctx.lineTo(em.position.x + 10, em.position.y);
        ctx.moveTo(em.position.x, em.position.y - 10);
        ctx.lineTo(em.position.x, em.position.y + 10);
        ctx.stroke();
      } else if (em.shape === 'line') {
        const angleRad = em.angle * Math.PI / 180;
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
      } else if (em.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(em.position.x, em.position.y, em.shapeRadius, 0, Math.PI * 2);
        if (em.emissionMode === 'area') ctx.fill();
        ctx.stroke();
      } else if (em.shape === 'rectangle') {
        const x = em.position.x - em.shapeWidth / 2;
        const y = em.position.y - em.shapeHeight / 2;
        if (em.emissionMode === 'area') ctx.fillRect(x, y, em.shapeWidth, em.shapeHeight);
        ctx.strokeRect(x, y, em.shapeWidth, em.shapeHeight);
      } else if (em.shape === 'roundedRect') {
        const x = em.position.x - em.shapeWidth / 2;
        const y = em.position.y - em.shapeHeight / 2;
        const r = Math.min(em.roundRadius, em.shapeWidth / 2, em.shapeHeight / 2);
        
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + em.shapeWidth - r, y);
        ctx.arcTo(x + em.shapeWidth, y, x + em.shapeWidth, y + r, r);
        ctx.lineTo(x + em.shapeWidth, y + em.shapeHeight - r);
        ctx.arcTo(x + em.shapeWidth, y + em.shapeHeight, x + em.shapeWidth - r, y + em.shapeHeight, r);
        ctx.lineTo(x + r, y + em.shapeHeight);
        ctx.arcTo(x, y + em.shapeHeight, x, y + em.shapeHeight - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
        
        if (em.emissionMode === 'area') ctx.fill();
        ctx.stroke();
      }

      ctx.setLineDash([]);
      ctx.strokeStyle = strokeColor;
      const angleRad = em.angle * Math.PI / 180;
      const dirLength = 40;
      ctx.beginPath();
      ctx.moveTo(em.position.x, em.position.y);
      ctx.lineTo(em.position.x + Math.cos(angleRad) * dirLength, em.position.y + Math.sin(angleRad) * dirLength);
      ctx.stroke();

      ctx.globalAlpha = 0.2;
      ctx.fillStyle = strokeColor;
      const spread = em.angleSpread * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(em.position.x, em.position.y);
      ctx.arc(em.position.x, em.position.y, dirLength, angleRad - spread / 2, angleRad + spread / 2);
      ctx.closePath();
      ctx.fill();

      if (this.settings.showVortexVisualization) {
        const previewStrength = evaluateCurve(this.settings.vortexStrengthOverLifetime, 0.5);
        const directionSign = previewStrength === 0 ? 1 : Math.sign(previewStrength);
        const arrowCount = 8;
        const radius = 60;
        const arcSpan = (Math.PI * 2) / arrowCount;

        ctx.save();
        ctx.setLineDash([]);
        ctx.lineWidth = 2 / zoom;
        ctx.strokeStyle = directionSign > 0 ? 'rgba(137, 207, 240, 0.9)' : 'rgba(255, 137, 207, 0.9)';
        ctx.fillStyle = ctx.strokeStyle;

        for (let i = 0; i < arrowCount; i++) {
          const startAngle = i * arcSpan;
          const endAngle = startAngle + arcSpan * 0.75 * directionSign;
          const anticlockwise = directionSign < 0;

          ctx.beginPath();
          ctx.arc(this.settings.vortexPoint.x, this.settings.vortexPoint.y, radius, startAngle, endAngle, anticlockwise);
          ctx.stroke();

          const endX = this.settings.vortexPoint.x + Math.cos(endAngle) * radius;
          const endY = this.settings.vortexPoint.y + Math.sin(endAngle) * radius;
          const headAngle = endAngle + (directionSign > 0 ? -Math.PI / 6 : Math.PI / 6);

          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(endX + Math.cos(headAngle) * 10, endY + Math.sin(headAngle) * 10);
          ctx.lineTo(endX + Math.cos(headAngle + (directionSign > 0 ? Math.PI / 6 : -Math.PI / 6)) * 10, endY + Math.sin(headAngle + (directionSign > 0 ? Math.PI / 6 : -Math.PI / 6)) * 10);
          ctx.closePath();
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(this.settings.vortexPoint.x, this.settings.vortexPoint.y, 6 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }
    
    ctx.restore();
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpColor(a: Color, b: Color, t: number): Color {
    return {
      r: Math.round(this.lerp(a.r, b.r, t)),
      g: Math.round(this.lerp(a.g, b.g, t)),
      b: Math.round(this.lerp(a.b, b.b, t)),
      a: 255
    };
  }
}


export { ParticleSystem };
