import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings } from 'lucide-react';

interface Vec2 { x: number; y: number; }
interface Color { r: number; g: number; b: number; a: number; }

type CurvePreset = 'constant' | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bell';

interface Curve {
  preset: CurvePreset;
  valueStart: number;
  valueEnd: number;
}

interface EmitterSettings {
  position: Vec2;
  shape: 'point' | 'circle' | 'rectangle' | 'roundedRect' | 'line';
  shapeRadius: number;
  shapeWidth: number;
  shapeHeight: number;
  roundRadius: number;
  lineLength: number;
  emissionMode: 'area' | 'edge';
  angle: number;
  angleSpread: number;
  speedMin: number;
  speedMax: number;
  rate: number;
  maxParticles: number;
}

interface ParticleSettings {
  emitter: EmitterSettings;
  lifeTimeMin: number;
  lifeTimeMax: number;
  gravityY: number;
  drag: number;
  
  // Curves
  sizeOverLifetime: Curve;
  speedOverLifetime: Curve;
  weightOverLifetime: Curve;
  spinOverLifetime: Curve;
  attractionOverLifetime: Curve;
  
  nonUniformScale: boolean;
  scaleRatioX: number;
  scaleRatioY: number;
  
  colorStart: Color;
  colorEnd: Color;
  alphaStart: number;
  alphaEnd: number;
  duration: number;
  fps: number;
  frameSize: number;
  
  attractionPoint: Vec2;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  baseSpeed: number;
  rotation: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  color: Color;
  alpha: number;
}

interface BakedFrame {
  time: number;
  particles: Map<number, {
    x: number;
    y: number;
    rotation: number;
    scale: number;
    scaleX: number;
    scaleY: number;
    alpha: number;
    color: Color;
  }>;
}

interface AtlasRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  atlasIndex: number;
}

const DEFAULT_SETTINGS: ParticleSettings = {
  emitter: {
    position: { x: 256, y: 256 },
    shape: 'point',
    shapeRadius: 20,
    shapeWidth: 100,
    shapeHeight: 100,
    roundRadius: 20,
    lineLength: 100,
    emissionMode: 'area',
    angle: -90,
    angleSpread: 30,
    speedMin: 100,
    speedMax: 200,
    rate: 50,
    maxParticles: 500
  },
  lifeTimeMin: 0.5,
  lifeTimeMax: 1.5,
  gravityY: 200,
  drag: 0.98,
  
  sizeOverLifetime: { preset: 'linear', valueStart: 1.0, valueEnd: 0.2 },
  speedOverLifetime: { preset: 'constant', valueStart: 1.0, valueEnd: 1.0 },
  weightOverLifetime: { preset: 'constant', valueStart: 1.0, valueEnd: 1.0 },
  spinOverLifetime: { preset: 'constant', valueStart: 0, valueEnd: 0 },
  attractionOverLifetime: { preset: 'constant', valueStart: 0, valueEnd: 0 },
  
  nonUniformScale: false,
  scaleRatioX: 1.0,
  scaleRatioY: 1.0,
  
  colorStart: { r: 255, g: 200, b: 100, a: 255 },
  colorEnd: { r: 255, g: 50, b: 50, a: 255 },
  alphaStart: 1.0,
  alphaEnd: 0.0,
  duration: 2.0,
  fps: 30,
  frameSize: 512,
  
  attractionPoint: { x: 256, y: 256 }
};

function evaluateCurve(curve: Curve, t: number): number {
  t = Math.max(0, Math.min(1, t));
  
  const { preset, valueStart, valueEnd } = curve;
  const range = valueEnd - valueStart;
  
  switch (preset) {
    case 'constant':
      return valueStart;
    case 'linear':
      return valueStart + range * t;
    case 'easeIn':
      return valueStart + range * (t * t);
    case 'easeOut':
      return valueStart + range * (1 - (1 - t) * (1 - t));
    case 'easeInOut':
      const easeInOut = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      return valueStart + range * easeInOut;
    case 'bell':
      const bell = Math.sin(t * Math.PI);
      return valueStart + range * bell;
    default:
      return valueStart;
  }
}

const CurveEditor: React.FC<{
  label: string;
  curve: Curve;
  onChange: (curve: Curve) => void;
  min?: number;
  max?: number;
  step?: number;
}> = ({ label, curve, onChange, min = 0, max = 2, step = 0.1 }) => {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-300 font-medium">{label}</label>
      <div className="grid grid-cols-3 gap-1">
        <select
          value={curve.preset}
          onChange={e => onChange({ ...curve, preset: e.target.value as CurvePreset })}
          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs col-span-3"
        >
          <option value="constant">Constant</option>
          <option value="linear">Linear</option>
          <option value="easeIn">Ease In</option>
          <option value="easeOut">Ease Out</option>
          <option value="easeInOut">Ease In/Out</option>
          <option value="bell">Bell</option>
        </select>
        <input
          type="number"
          value={curve.valueStart}
          onChange={e => onChange({ ...curve, valueStart: Number(e.target.value) })}
          min={min}
          max={max}
          step={step}
          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
          placeholder="Start"
        />
        <div className="flex items-center justify-center text-xs text-slate-500">→</div>
        <input
          type="number"
          value={curve.valueEnd}
          onChange={e => onChange({ ...curve, valueEnd: Number(e.target.value) })}
          min={min}
          max={max}
          step={step}
          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
          placeholder="End"
        />
      </div>
      <svg width="100%" height="30" className="bg-slate-900/50 rounded border border-slate-700">
        <path
          d={Array.from({ length: 50 }, (_, i) => {
            const t = i / 49;
            const value = evaluateCurve(curve, t);
            const normalized = (value - min) / (max - min);
            const x = (t * 100);
            const y = 30 - (normalized * 28) - 1;
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
          }).join(' ')}
          fill="none"
          stroke="rgb(168, 85, 247)"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
};

class ParticleSystem {
  particles: Particle[] = [];
  settings: ParticleSettings;
  time: number = 0;
  spawnAccumulator: number = 0;
  nextParticleId: number = 0;

  constructor(settings: ParticleSettings) {
    this.settings = settings;
  }

  reset() {
    this.particles = [];
    this.time = 0;
    this.spawnAccumulator = 0;
    this.nextParticleId = 0;
  }

  update(dt: number) {
    this.time += dt;
    this.spawnAccumulator += dt;

    const spawnInterval = 1 / this.settings.emitter.rate;
    while (this.spawnAccumulator >= spawnInterval && this.particles.length < this.settings.emitter.maxParticles) {
      this.spawnParticle();
      this.spawnAccumulator -= spawnInterval;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const t = 1 - (p.life / p.maxLife);
      
      // Size over lifetime
      const sizeMultiplier = evaluateCurve(this.settings.sizeOverLifetime, t);
      p.scale = sizeMultiplier;
      
      if (this.settings.nonUniformScale) {
        p.scaleX = sizeMultiplier * this.settings.scaleRatioX;
        p.scaleY = sizeMultiplier * this.settings.scaleRatioY;
      } else {
        p.scaleX = sizeMultiplier;
        p.scaleY = sizeMultiplier;
      }
      
      // Speed over lifetime
      const speedMultiplier = evaluateCurve(this.settings.speedOverLifetime, t);
      
      // Weight over lifetime (affects gravity)
      const weightMultiplier = evaluateCurve(this.settings.weightOverLifetime, t);
      p.vy += this.settings.gravityY * weightMultiplier * dt;
      
      // Attraction over lifetime
      const attractionStrength = evaluateCurve(this.settings.attractionOverLifetime, t);
      if (attractionStrength !== 0) {
        const dx = this.settings.attractionPoint.x - p.x;
        const dy = this.settings.attractionPoint.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          p.vx += (dx / dist) * attractionStrength * dt;
          p.vy += (dy / dist) * attractionStrength * dt;
        }
      }
      
      // Apply drag
      p.vx *= this.settings.drag;
      p.vy *= this.settings.drag;
      
      // Apply speed multiplier
      p.x += p.vx * speedMultiplier * dt;
      p.y += p.vy * speedMultiplier * dt;
      
      // Spin over lifetime
      const spinSpeed = evaluateCurve(this.settings.spinOverLifetime, t);
      p.rotation += spinSpeed * dt;

      // Color interpolation
      p.alpha = this.lerp(this.settings.alphaStart, this.settings.alphaEnd, t);
      p.color = this.lerpColor(this.settings.colorStart, this.settings.colorEnd, t);
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
    const speed = em.speedMin + Math.random() * (em.speedMax - em.speedMin);

    const particle: Particle = {
      id: this.nextParticleId++,
      x: pos.x,
      y: pos.y,
      vx: Math.cos(angleRad) * speed,
      vy: Math.sin(angleRad) * speed,
      life: this.settings.lifeTimeMin + Math.random() * (this.settings.lifeTimeMax - this.settings.lifeTimeMin),
      maxLife: 0,
      baseSpeed: speed,
      rotation: 0,
      scale: 1,
      scaleX: 1,
      scaleY: 1,
      color: { ...this.settings.colorStart },
      alpha: this.settings.alphaStart
    };
    particle.maxLife = particle.life;

    this.particles.push(particle);
  }

  render(ctx: CanvasRenderingContext2D, showEmitter: boolean = false, backgroundImage?: HTMLImageElement | null, bgPosition?: { x: number; y: number }) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    if (backgroundImage && bgPosition) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.drawImage(backgroundImage, bgPosition.x, bgPosition.y);
      ctx.restore();
    }
    
    if (showEmitter) {
      const em = this.settings.emitter;
      ctx.save();
      
      const strokeColor = em.emissionMode === 'edge' ? 'rgba(255, 150, 100, 0.7)' : 'rgba(100, 255, 100, 0.5)';
      const fillColor = em.emissionMode === 'edge' ? 'rgba(255, 150, 100, 0.1)' : 'rgba(100, 255, 100, 0.2)';
      
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

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
      ctx.globalAlpha = 1;

      ctx.restore();
    }
    
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(p.scaleX, p.scaleY);
      
      const size = 8;
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }
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

function bakeParticleAnimation(settings: ParticleSettings): BakedFrame[] {
  const frames: BakedFrame[] = [];
  const system = new ParticleSystem(settings);
  const frameCount = Math.ceil(settings.duration * settings.fps);
  const dt = 1 / settings.fps;

  for (let i = 0; i < frameCount; i++) {
    system.update(dt);
    const particlesSnapshot = new Map<number, any>();
    
    for (const p of system.particles) {
      particlesSnapshot.set(p.id, {
        x: p.x - settings.emitter.position.x,
        y: p.y - settings.emitter.position.y,
        rotation: p.rotation * 180 / Math.PI,
        scale: p.scale,
        scaleX: p.scaleX,
        scaleY: p.scaleY,
        alpha: p.alpha,
        color: { ...p.color }
      });
    }

    frames.push({ time: i * dt, particles: particlesSnapshot });
  }

  return frames;
}

function renderBakedPreview(frames: BakedFrame[], settings: ParticleSettings): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = settings.frameSize;
  canvas.height = settings.frameSize;
  const ctx = canvas.getContext('2d')!;
  
  const centerX = settings.frameSize / 2;
  const centerY = settings.frameSize / 2;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (const frame of frames) {
    for (const [id, p] of frame.particles) {
      const size = 8 * p.scale;
      ctx.globalAlpha = p.alpha * 0.3;
      ctx.fillStyle = `rgb(${p.color.r}, ${p.color.g}, ${p.color.b})`;
      ctx.beginPath();
      ctx.arc(centerX + p.x, centerY + p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.globalAlpha = 1;
  return canvas;
}

function createParticleTexture(size: number = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const center = size / 2;
  const radius = size / 2 - 2;
  
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas;
}

function createParticleAtlas(): { canvas: HTMLCanvasElement; region: AtlasRegion } {
  const particleCanvas = createParticleTexture(64);
  const atlasSize = 128;
  
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d')!;
  
  ctx.drawImage(particleCanvas, 0, 0);
  
  const region: AtlasRegion = {
    name: 'particle',
    x: 0,
    y: 0,
    width: 64,
    height: 64,
    atlasIndex: 0
  };
  
  return { canvas, region };
}

function generateAtlasFile(atlasCanvas: HTMLCanvasElement, region: AtlasRegion): string {
  let atlasText = '';
  
  atlasText += `particles.png\n`;
  atlasText += `size: ${atlasCanvas.width},${atlasCanvas.height}\n`;
  atlasText += `format: RGBA8888\n`;
  atlasText += `filter: Linear,Linear\n`;
  atlasText += `repeat: none\n`;
  atlasText += `${region.name}\n`;
  atlasText += `  rotate: false\n`;
  atlasText += `  xy: ${region.x}, ${region.y}\n`;
  atlasText += `  size: ${region.width}, ${region.height}\n`;
  atlasText += `  orig: ${region.width}, ${region.height}\n`;
  atlasText += `  offset: 0, 0\n`;
  atlasText += `  index: -1\n`;

  return atlasText;
}

function shouldCreateKey(prevValue: number | { x: number; y: number }, currentValue: number | { x: number; y: number }, threshold: number): boolean {
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

function normalizeAngle(angle: number, prevAngle: number): number {
  while (angle - prevAngle > 180) angle -= 360;
  while (angle - prevAngle < -180) angle += 360;
  return angle;
}

function smoothAngles(angles: number[], windowSize: number = 3): number[] {
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

function isParticleVisible(particle: any): boolean {
  return particle && particle.alpha > 0.01 && particle.scale > 0.01;
}

function generateSpineJSON(frames: BakedFrame[], settings: ParticleSettings): string {
  const allParticleIds = new Set<number>();
  for (const frame of frames) {
    for (const [id, _] of frame.particles) {
      allParticleIds.add(id);
    }
  }
  
  const particleIds = Array.from(allParticleIds).sort((a, b) => a - b);
  
  const skeleton = { hash: "particle_export", spine: "4.1.00", x: 0, y: 0, width: settings.frameSize, height: settings.frameSize };

  const bones: any[] = [{ name: "root" }];
  for (const id of particleIds) {
    bones.push({ name: `particle_${id}`, parent: "root" });
  }

  const slots: any[] = [];
  for (const id of particleIds) {
    slots.push({ name: `particle_slot_${id}`, bone: `particle_${id}`, attachment: null });
  }

  const skins: any = { default: {} };
  
  for (const id of particleIds) {
    skins.default[`particle_slot_${id}`] = {
      particle: { type: "region", name: "particle", path: "particle", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, width: 64, height: 64 }
    };
  }

  const animations: any = { particle_anim: { bones: {}, slots: {} } };

  const POSITION_THRESHOLD = 5.0;
  const ROTATION_THRESHOLD = 10.0;
  const SCALE_THRESHOLD = 0.1;

  for (const particleId of particleIds) {
    const boneName = `particle_${particleId}`;
    const slotName = `particle_slot_${particleId}`;
    
    const translateKeys: any[] = [];
    const rotateKeys: any[] = [];
    const scaleKeys: any[] = [];
    const attachmentKeys: any[] = [];

    const allAngles: number[] = [];
    for (const frame of frames) {
      const particle = frame.particles.get(particleId);
      if (particle) {
        allAngles.push(particle.rotation);
      } else {
        allAngles.push(allAngles.length > 0 ? allAngles[allAngles.length - 1] : 0);
      }
    }

    const smoothedAngles = smoothAngles(allAngles, 3);

    let prevPos: { x: number; y: number } | null = null;
    let prevRotation: number | null = null;
    let prevScale: { x: number; y: number } | null = null;
    let wasVisible = false;
    let hasAppeared = false;
    let normalizedAngle = 0;

    for (let frameIdx = 0; frameIdx < frames.length; frameIdx++) {
      const frame = frames[frameIdx];
      const particle = frame.particles.get(particleId);
      const isVisible = particle && isParticleVisible(particle);
      const isFirstFrame = frameIdx === 0;
      const isLastFrame = frameIdx === frames.length - 1;
      
      const visibilityChanged = wasVisible !== isVisible;

      if (particle && isVisible) {
        if (!hasAppeared) {
          hasAppeared = true;
          const time = Math.round(frame.time * 1000) / 1000;
          attachmentKeys.push({ time, name: "particle" });
        }

        const currentPos = { x: particle.x, y: particle.y };
        const currentScale = { x: particle.scaleX, y: particle.scaleY };
        
        if (prevRotation !== null) {
          normalizedAngle = normalizeAngle(smoothedAngles[frameIdx], normalizedAngle);
        } else {
          normalizedAngle = smoothedAngles[frameIdx];
        }

        if (isFirstFrame || isLastFrame || visibilityChanged || prevPos === null || shouldCreateKey(prevPos, currentPos, POSITION_THRESHOLD)) {
          translateKeys.push({ time: Math.round(frame.time * 1000) / 1000, x: Math.round(currentPos.x * 100) / 100, y: Math.round(currentPos.y * 100) / 100 });
          prevPos = currentPos;
        }

        if (isFirstFrame || isLastFrame || visibilityChanged || prevRotation === null || shouldCreateKey(prevRotation, normalizedAngle, ROTATION_THRESHOLD)) {
          rotateKeys.push({ time: Math.round(frame.time * 1000) / 1000, angle: Math.round(normalizedAngle * 100) / 100 });
          prevRotation = normalizedAngle;
        }

        if (isFirstFrame || isLastFrame || visibilityChanged || prevScale === null || 
            Math.abs(currentScale.x - prevScale.x) > SCALE_THRESHOLD || Math.abs(currentScale.y - prevScale.y) > SCALE_THRESHOLD) {
          scaleKeys.push({ 
            time: Math.round(frame.time * 1000) / 1000, 
            x: Math.round(currentScale.x * 1000) / 1000, 
            y: Math.round(currentScale.y * 1000) / 1000 
          });
          prevScale = currentScale;
        }

        wasVisible = true;
      } else {
        if (wasVisible && visibilityChanged) {
          const time = Math.round(frame.time * 1000) / 1000;
          attachmentKeys.push({ time, name: null });
        }
        
        if (visibilityChanged && wasVisible) {
          const time = Math.round(frame.time * 1000) / 1000;
          if (prevPos) translateKeys.push({ time, x: Math.round(prevPos.x * 100) / 100, y: Math.round(prevPos.y * 100) / 100 });
          if (prevRotation !== null) rotateKeys.push({ time, angle: Math.round(prevRotation * 100) / 100 });
          if (prevScale !== null) scaleKeys.push({ time, x: 0, y: 0 });
        }
        
        wasVisible = false;
      }
    }

    if (hasAppeared && translateKeys.length > 0) {
      animations.particle_anim.bones[boneName] = { translate: translateKeys, rotate: rotateKeys, scale: scaleKeys };

      if (attachmentKeys.length > 0) {
        animations.particle_anim.slots[slotName] = { attachment: attachmentKeys };
      }
    }
  }

  return JSON.stringify({ skeleton, bones, slots, skins, animations });
}

class SimpleZip {
  private files: Array<{ name: string; data: Uint8Array }> = [];

  addFile(name: string, data: string | Uint8Array) {
    const uint8Data = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.files.push({ name, data: uint8Data });
  }

  async addCanvasFile(name: string, canvas: HTMLCanvasElement) {
    return new Promise<void>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Failed to convert canvas to blob'));
          return;
        }
        blob.arrayBuffer().then(buffer => {
          this.addFile(name, new Uint8Array(buffer));
          resolve();
        }).catch(reject);
      }, 'image/png');
    });
  }

  generate(): Blob {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let offset = 0;
    const centralDirectory: Uint8Array[] = [];

    for (const file of this.files) {
      const nameBytes = encoder.encode(file.name);
      const crc = this.crc32(file.data);
      
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);
      
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, file.data.length, true);
      view.setUint32(22, file.data.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      
      localHeader.set(nameBytes, 30);
      chunks.push(localHeader);
      chunks.push(file.data);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(centralHeader.buffer);
      
      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, 0, true);
      cdView.setUint16(14, 0, true);
      cdView.setUint32(16, crc, true);
      cdView.setUint32(20, file.data.length, true);
      cdView.setUint32(24, file.data.length, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, offset, true);
      
      centralHeader.set(nameBytes, 46);
      centralDirectory.push(centralHeader);

      offset += localHeader.length + file.data.length;
    }

    const centralDirData = new Uint8Array(centralDirectory.reduce((sum, cd) => sum + cd.length, 0));
    let cdOffset = 0;
    for (const cd of centralDirectory) {
      centralDirData.set(cd, cdOffset);
      cdOffset += cd.length;
    }

    const endOfCentralDir = new Uint8Array(22);
    const eocdView = new DataView(endOfCentralDir.buffer);
    
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, this.files.length, true);
    eocdView.setUint16(10, this.files.length, true);
    eocdView.setUint32(12, centralDirData.length, true);
    eocdView.setUint32(16, offset, true);
    eocdView.setUint16(20, 0, true);

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + centralDirData.length + endOfCentralDir.length;
    const result = new Uint8Array(totalSize);
    
    let resultOffset = 0;
    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }
    result.set(centralDirData, resultOffset);
    resultOffset += centralDirData.length;
    result.set(endOfCentralDir, resultOffset);

    return new Blob([result], { type: 'application/zip' });
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

const ParticleSpineExporter: React.FC = () => {
  const [settings, setSettings] = useState<ParticleSettings>(DEFAULT_SETTINGS);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [showEmitter, setShowEmitter] = useState(true);
  const [exportStatus, setExportStatus] = useState('');
  const [liveParticleCount, setLiveParticleCount] = useState(0);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [bgPosition, setBgPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemRef = useRef<ParticleSystem | null>(null);
  const animationRef = useRef<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    systemRef.current = new ParticleSystem(settings);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !systemRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (isPlaying && systemRef.current) {
        systemRef.current.update(dt);
        systemRef.current.render(ctx, showEmitter, backgroundImage, bgPosition);
        setLiveParticleCount(systemRef.current.particles.length);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, showEmitter, backgroundImage, bgPosition]);

  const updateSettings = useCallback((newSettings: ParticleSettings) => {
    setSettings(newSettings);
    if (systemRef.current) {
      systemRef.current.settings = newSettings;
    }
  }, []);

  const handleRestart = () => {
    if (systemRef.current) {
      systemRef.current.reset();
    }
  };

  const handleReset = () => {
    updateSettings(DEFAULT_SETTINGS);
    handleRestart();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setBackgroundImage(img);
          setBgPosition({ x: 0, y: 0 });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!backgroundImage) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) * (settings.frameSize / rect.width);
    const y = (e.clientY - rect.top) * (settings.frameSize / rect.height);
    
    setIsDragging(true);
    setDragStart({ x: x - bgPosition.x, y: y - bgPosition.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !backgroundImage) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) * (settings.frameSize / rect.width);
    const y = (e.clientY - rect.top) * (settings.frameSize / rect.height);
    
    setBgPosition({ x: x - dragStart.x, y: y - dragStart.y });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleExport = async () => {
    setExportStatus('🔄 Baking animation...');
    setIsPlaying(false);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const frames = bakeParticleAnimation(settings);
      const uniqueParticles = new Set<number>();
      for (const frame of frames) {
        for (const [id, _] of frame.particles) {
          uniqueParticles.add(id);
        }
      }
      setExportStatus(`✓ Baked ${frames.length} frames, ${uniqueParticles.size} unique particles`);
      await new Promise(resolve => setTimeout(resolve, 100));

      setExportStatus('🎨 Creating particle texture...');
      const { canvas: atlasCanvas, region } = createParticleAtlas();
      await new Promise(resolve => setTimeout(resolve, 100));

      setExportStatus('📝 Generating Spine data...');
      const atlasText = generateAtlasFile(atlasCanvas, region);
      const spineJSON = generateSpineJSON(frames, settings);
      await new Promise(resolve => setTimeout(resolve, 100));

      setExportStatus('🖼️ Creating preview...');
      const previewCanvas = renderBakedPreview(frames, settings);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setExportStatus('📦 Creating ZIP archive...');
      await new Promise(resolve => setTimeout(resolve, 100));

      const zip = new SimpleZip();
      
      setExportStatus('📦 Adding particles.png...');
      await zip.addCanvasFile('particles.png', atlasCanvas);
      
      setExportStatus('📦 Adding preview.png...');
      await zip.addCanvasFile('preview.png', previewCanvas);
      
      setExportStatus('📦 Adding .atlas and .json...');
      zip.addFile('particles.atlas', atlasText);
      zip.addFile('particles_spine.json', spineJSON);
      
      setExportStatus('💾 Generating ZIP file...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const zipBlob = zip.generate();
      downloadBlob(zipBlob, 'particles_export.zip');

      setExportStatus(`✅ Export complete! ${frames.length} frames, ${uniqueParticles.size} bones → particles_export.zip`);
      setTimeout(() => setExportStatus(''), 5000);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setTimeout(() => setExportStatus(''), 5000);
    } finally {
      setIsPlaying(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Particle → Spine Exporter
          </h1>
          <p className="text-slate-300">Create particle effects with curve-based parameters</p>
          <p className="text-xs text-slate-400 mt-2">
            💡 Advanced particle system with Size, Speed, Weight, Spin, and Attraction curves over lifetime
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                <h2 className="text-xl font-semibold">Preview</h2>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-sm">
                    📁 Load
                  </button>
                  {backgroundImage && (
                    <button onClick={() => setBackgroundImage(null)} className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors text-sm">
                      🗑️
                    </button>
                  )}
                  <button onClick={() => setShowEmitter(!showEmitter)} className={`px-3 py-2 rounded-lg transition-colors text-sm ${showEmitter ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-700 hover:bg-slate-600'}`}>
                    {showEmitter ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button onClick={() => setIsPlaying(!isPlaying)} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-sm">
                    {isPlaying ? 'Pause' : 'Play'}
                  </button>
                  <button onClick={handleRestart} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm">
                    <RotateCcw size={14} className="inline" />
                  </button>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              
              <div className="bg-black rounded-lg overflow-hidden border border-slate-600 relative">
                <canvas
                  ref={canvasRef}
                  width={settings.frameSize}
                  height={settings.frameSize}
                  className="w-full"
                  style={{ imageRendering: 'pixelated', cursor: backgroundImage ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
                <div className="absolute top-2 left-2 bg-black/70 px-3 py-1 rounded text-xs font-mono">
                  Live: {liveParticleCount}
                </div>
              </div>

              <div className="mt-4">
                <button onClick={handleExport} className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold transition-all transform hover:scale-105">
                  <Download size={18} className="inline mr-2" />
                  Export to ZIP
                </button>
              </div>

              {exportStatus && (
                <div className="mt-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
                  <p className="text-xs">{exportStatus}</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-4 border border-slate-700 sticky top-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Settings size={18} />
                  Settings
                </h2>
                <button onClick={() => setShowSettings(!showSettings)} className="text-xs text-slate-400 hover:text-white">
                  {showSettings ? 'Hide' : 'Show'}
                </button>
              </div>

              {showSettings && (
                <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-purple-400 text-xs uppercase">Emitter</h3>
                    
                    <label className="block">
                      <span className="text-xs text-slate-300">Shape</span>
                      <select value={settings.emitter.shape} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shape: e.target.value as any }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs">
                        <option value="point">📍 Point</option>
                        <option value="line">➖ Line</option>
                        <option value="circle">⭕ Circle</option>
                        <option value="rectangle">⬜ Rectangle</option>
                        <option value="roundedRect">▢ Rounded</option>
                      </select>
                    </label>

                    {settings.emitter.shape !== 'point' && settings.emitter.shape !== 'line' && (
                      <label className="block">
                        <span className="text-xs text-slate-300">Mode</span>
                        <select value={settings.emitter.emissionMode} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, emissionMode: e.target.value as any }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs">
                          <option value="area">🟢 Inside</option>
                          <option value="edge">🟠 Edge</option>
                        </select>
                      </label>
                    )}

                    {settings.emitter.shape === 'line' && (
                      <label className="block">
                        <span className="text-xs text-slate-300">Length (px)</span>
                        <input type="number" min="10" max="400" value={settings.emitter.lineLength} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, lineLength: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </label>
                    )}

                    {settings.emitter.shape === 'circle' && (
                      <label className="block">
                        <span className="text-xs text-slate-300">Radius (px)</span>
                        <input type="number" min="5" max="150" value={settings.emitter.shapeRadius} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeRadius: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </label>
                    )}

                    {(settings.emitter.shape === 'rectangle' || settings.emitter.shape === 'roundedRect') && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="text-xs text-slate-300">Width</span>
                          <input type="number" min="10" max="300" value={settings.emitter.shapeWidth} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeWidth: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                        </label>
                        <label className="block">
                          <span className="text-xs text-slate-300">Height</span>
                          <input type="number" min="10" max="300" value={settings.emitter.shapeHeight} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeHeight: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                        </label>
                      </div>
                    )}

                    {settings.emitter.shape === 'roundedRect' && (
                      <label className="block">
                        <span className="text-xs text-slate-300">Corner Radius</span>
                        <input type="number" min="0" max={Math.min(50, settings.emitter.shapeWidth / 2, settings.emitter.shapeHeight / 2)} value={settings.emitter.roundRadius} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, roundRadius: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </label>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Angle</span>
                        <input type="number" min="-180" max="180" value={settings.emitter.angle} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, angle: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Spread</span>
                        <input type="number" min="0" max="360" value={settings.emitter.angleSpread} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, angleSpread: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs text-slate-300">Speed (min / max)</span>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <input type="number" value={settings.emitter.speedMin} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, speedMin: Number(e.target.value) }})} className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                        <input type="number" value={settings.emitter.speedMax} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, speedMax: Number(e.target.value) }})} className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </div>
                    </label>

                    <label className="block">
                      <span className="text-xs text-slate-300">Rate (per sec)</span>
                      <input type="number" min="1" max="200" value={settings.emitter.rate} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, rate: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-purple-400 text-xs uppercase">Lifetime</h3>
                    <label className="block">
                      <span className="text-xs text-slate-300">Time (min / max, sec)</span>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <input type="number" step="0.1" value={settings.lifeTimeMin} onChange={e => updateSettings({ ...settings, lifeTimeMin: Number(e.target.value) })} className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                        <input type="number" step="0.1" value={settings.lifeTimeMax} onChange={e => updateSettings({ ...settings, lifeTimeMax: Number(e.target.value) })} className="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </div>
                    </label>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-purple-400 text-xs uppercase">Physics</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Gravity Y</span>
                        <input type="number" min="-500" max="500" value={settings.gravityY} onChange={e => updateSettings({ ...settings, gravityY: Number(e.target.value) })} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Drag</span>
                        <input type="number" min="0.9" max="1.0" step="0.01" value={settings.drag} onChange={e => updateSettings({ ...settings, drag: Number(e.target.value) })} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-purple-400 text-xs uppercase">Curves Over Lifetime</h3>
                    
                    <CurveEditor
                      label="Size"
                      curve={settings.sizeOverLifetime}
                      onChange={curve => updateSettings({ ...settings, sizeOverLifetime: curve })}
                      min={0}
                      max={2}
                      step={0.1}
                    />

                    <CurveEditor
                      label="Speed"
                      curve={settings.speedOverLifetime}
                      onChange={curve => updateSettings({ ...settings, speedOverLifetime: curve })}
                      min={0}
                      max={2}
                      step={0.1}
                    />

                    <CurveEditor
                      label="Weight (Gravity)"
                      curve={settings.weightOverLifetime}
                      onChange={curve => updateSettings({ ...settings, weightOverLifetime: curve })}
                      min={0}
                      max={2}
                      step={0.1}
                    />

                    <CurveEditor
                      label="Spin (deg/s)"
                      curve={settings.spinOverLifetime}
                      onChange={curve => updateSettings({ ...settings, spinOverLifetime: curve })}
                      min={-360}
                      max={360}
                      step={10}
                    />

                    <CurveEditor
                      label="Attraction"
                      curve={settings.attractionOverLifetime}
                      onChange={curve => updateSettings({ ...settings, attractionOverLifetime: curve })}
                      min={-500}
                      max={500}
                      step={10}
                    />

                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={settings.nonUniformScale}
                        onChange={e => updateSettings({ ...settings, nonUniformScale: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-xs text-slate-300">Non-uniform Scale</span>
                    </label>

                    {settings.nonUniformScale && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="block">
                          <span className="text-xs text-slate-300">Ratio X</span>
                          <input type="number" min="0.1" max="3" step="0.1" value={settings.scaleRatioX} onChange={e => updateSettings({ ...settings, scaleRatioX: Number(e.target.value) })} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                        </label>
                        <label className="block">
                          <span className="text-xs text-slate-300">Ratio Y</span>
                          <input type="number" min="0.1" max="3" step="0.1" value={settings.scaleRatioY} onChange={e => updateSettings({ ...settings, scaleRatioY: Number(e.target.value) })} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-purple-400 text-xs uppercase">Export</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Duration (s)</span>
                        <input type="number" step="0.1" value={settings.duration} onChange={e => updateSettings({ ...settings, duration: Number(e.target.value) })} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">FPS</span>
                        <select value={settings.fps} onChange={e => updateSettings({ ...settings, fps: Number(e.target.value) })} className="w-full mt-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs">
                          <option value="24">24</option>
                          <option value="30">30</option>
                          <option value="60">60</option>
                        </select>
                      </label>
                    </div>
                    <div className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded">
                      Frames: {Math.ceil(settings.duration * settings.fps)}
                    </div>
                  </div>

                  <button onClick={handleReset} className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-xs">
                    Reset Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticleSpineExporter;