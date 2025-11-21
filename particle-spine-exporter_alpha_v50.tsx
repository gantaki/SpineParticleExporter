import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings } from 'lucide-react';

// ============================================================================
// ТИПЫ И ИНТЕРФЕЙСЫ
// ============================================================================

interface Vec2 {
  x: number;
  y: number;
}

interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface EmitterSettings {
  position: Vec2;
  shape: 'point' | 'circle' | 'rectangle' | 'roundedRect';
  shapeRadius: number;
  shapeWidth: number;
  shapeHeight: number;
  roundRadius: number; // Радиус закругления углов
  emissionMode: 'area' | 'edge'; // Внутри области или по контуру
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
  scaleStart: number;
  scaleEnd: number;
  colorStart: Color;
  colorEnd: Color;
  alphaStart: number;
  alphaEnd: number;
  duration: number;
  fps: number;
  frameSize: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  scale: number;
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

// ============================================================================
// ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ
// ============================================================================

const DEFAULT_SETTINGS: ParticleSettings = {
  emitter: {
    position: { x: 256, y: 256 },
    shape: 'point',
    shapeRadius: 20,
    shapeWidth: 100,
    shapeHeight: 100,
    roundRadius: 20,
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
  scaleStart: 1.0,
  scaleEnd: 0.2,
  colorStart: { r: 255, g: 200, b: 100, a: 255 },
  colorEnd: { r: 255, g: 50, b: 50, a: 255 },
  alphaStart: 1.0,
  alphaEnd: 0.0,
  duration: 2.0,
  fps: 30,
  frameSize: 512
};

// ============================================================================
// СИСТЕМА ЧАСТИЦ
// ============================================================================

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

    // Спавн частиц
    const spawnInterval = 1 / this.settings.emitter.rate;
    while (this.spawnAccumulator >= spawnInterval && this.particles.length < this.settings.emitter.maxParticles) {
      this.spawnParticle();
      this.spawnAccumulator -= spawnInterval;
    }

    // Обновление частиц
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Физика
      p.vy += this.settings.gravityY * dt;
      p.vx *= this.settings.drag;
      p.vy *= this.settings.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Интерполяция свойств
      const t = 1 - (p.life / p.maxLife);
      p.scale = this.lerp(this.settings.scaleStart, this.settings.scaleEnd, t);
      p.alpha = this.lerp(this.settings.alphaStart, this.settings.alphaEnd, t);
      p.color = this.lerpColor(this.settings.colorStart, this.settings.colorEnd, t);
    }
  }

  spawnParticle() {
    const em = this.settings.emitter;
    let pos = { ...em.position };

    // Позиция в зависимости от формы эмиттера
    if (em.shape === 'point') {
      // Точка - без изменений
    } else if (em.shape === 'circle') {
      if (em.emissionMode === 'area') {
        // Внутри круга
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * em.shapeRadius;
        pos.x += Math.cos(angle) * radius;
        pos.y += Math.sin(angle) * radius;
      } else {
        // По контуру круга
        const angle = Math.random() * Math.PI * 2;
        pos.x += Math.cos(angle) * em.shapeRadius;
        pos.y += Math.sin(angle) * em.shapeRadius;
      }
    } else if (em.shape === 'rectangle') {
      if (em.emissionMode === 'area') {
        // Внутри прямоугольника
        pos.x += (Math.random() - 0.5) * em.shapeWidth;
        pos.y += (Math.random() - 0.5) * em.shapeHeight;
      } else {
        // По контуру прямоугольника
        const perimeter = 2 * (em.shapeWidth + em.shapeHeight);
        const t = Math.random() * perimeter;
        
        if (t < em.shapeWidth) {
          // Верхняя сторона
          pos.x += t - em.shapeWidth / 2;
          pos.y -= em.shapeHeight / 2;
        } else if (t < em.shapeWidth + em.shapeHeight) {
          // Правая сторона
          pos.x += em.shapeWidth / 2;
          pos.y += (t - em.shapeWidth) - em.shapeHeight / 2;
        } else if (t < 2 * em.shapeWidth + em.shapeHeight) {
          // Нижняя сторона
          pos.x += (2 * em.shapeWidth + em.shapeHeight - t) - em.shapeWidth / 2;
          pos.y += em.shapeHeight / 2;
        } else {
          // Левая сторона
          pos.x -= em.shapeWidth / 2;
          pos.y += (perimeter - t) - em.shapeHeight / 2;
        }
      }
    } else if (em.shape === 'roundedRect') {
      const w = em.shapeWidth;
      const h = em.shapeHeight;
      const r = Math.min(em.roundRadius, w / 2, h / 2);
      
      if (em.emissionMode === 'area') {
        // Внутри закругленного прямоугольника (упрощенно - как обычный прямоугольник)
        pos.x += (Math.random() - 0.5) * w;
        pos.y += (Math.random() - 0.5) * h;
      } else {
        // По контуру закругленного прямоугольника
        const straightWidth = w - 2 * r;
        const straightHeight = h - 2 * r;
        const perimeter = 2 * (straightWidth + straightHeight) + 2 * Math.PI * r;
        const t = Math.random() * perimeter;
        
        let accumulated = 0;
        
        // Верхняя прямая
        if (t < straightWidth) {
          pos.x += (t - w / 2 + r);
          pos.y -= h / 2;
        }
        // Правый верхний угол
        else if (t < (accumulated = straightWidth + Math.PI * r / 2)) {
          const angle = (t - straightWidth) / r - Math.PI / 2;
          pos.x += w / 2 - r + Math.cos(angle) * r;
          pos.y -= h / 2 - r + Math.sin(angle) * r;
        }
        // Правая прямая
        else if (t < (accumulated += straightHeight)) {
          pos.x += w / 2;
          pos.y += (t - (straightWidth + Math.PI * r / 2)) - h / 2 + r;
        }
        // Правый нижний угол
        else if (t < (accumulated += Math.PI * r / 2)) {
          const angle = (t - (straightWidth + Math.PI * r / 2 + straightHeight)) / r;
          pos.x += w / 2 - r + Math.cos(angle) * r;
          pos.y += h / 2 - r + Math.sin(angle) * r;
        }
        // Нижняя прямая
        else if (t < (accumulated += straightWidth)) {
          pos.x += w / 2 - (t - (straightWidth + Math.PI * r / 2 + straightHeight + Math.PI * r / 2));
          pos.y += h / 2;
        }
        // Левый нижний угол
        else if (t < (accumulated += Math.PI * r / 2)) {
          const angle = (t - (straightWidth + Math.PI * r / 2 + straightHeight + Math.PI * r / 2 + straightWidth)) / r + Math.PI / 2;
          pos.x -= w / 2 - r + Math.cos(angle) * r;
          pos.y += h / 2 - r + Math.sin(angle) * r;
        }
        // Левая прямая
        else if (t < (accumulated += straightHeight)) {
          pos.x -= w / 2;
          pos.y += h / 2 - (t - (straightWidth + Math.PI * r / 2 + straightHeight + Math.PI * r / 2 + straightWidth + Math.PI * r / 2));
        }
        // Левый верхний угол
        else {
          const angle = (t - (straightWidth + Math.PI * r / 2 + straightHeight + Math.PI * r / 2 + straightWidth + Math.PI * r / 2 + straightHeight)) / r + Math.PI;
          pos.x -= w / 2 - r + Math.cos(angle) * r;
          pos.y -= h / 2 - r + Math.sin(angle) * r;
        }
      }
    }

    // Направление и скорость
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
      scale: this.settings.scaleStart,
      color: { ...this.settings.colorStart },
      alpha: this.settings.alphaStart
    };
    particle.maxLife = particle.life;

    this.particles.push(particle);
  }

  render(ctx: CanvasRenderingContext2D, showEmitter: boolean = false) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Рисуем эмиттер если включено
    if (showEmitter) {
      const em = this.settings.emitter;
      ctx.save();
      
      // Цвет зависит от режима эмиссии
      const strokeColor = em.emissionMode === 'edge' ? 'rgba(255, 150, 100, 0.7)' : 'rgba(100, 255, 100, 0.5)';
      const fillColor = em.emissionMode === 'edge' ? 'rgba(255, 150, 100, 0.1)' : 'rgba(100, 255, 100, 0.2)';
      
      ctx.strokeStyle = strokeColor;
      ctx.fillStyle = fillColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      if (em.shape === 'point') {
        // Рисуем крестик
        ctx.beginPath();
        ctx.moveTo(em.position.x - 10, em.position.y);
        ctx.lineTo(em.position.x + 10, em.position.y);
        ctx.moveTo(em.position.x, em.position.y - 10);
        ctx.lineTo(em.position.x, em.position.y + 10);
        ctx.stroke();
      } else if (em.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(em.position.x, em.position.y, em.shapeRadius, 0, Math.PI * 2);
        if (em.emissionMode === 'area') ctx.fill();
        ctx.stroke();
      } else if (em.shape === 'rectangle') {
        const x = em.position.x - em.shapeWidth / 2;
        const y = em.position.y - em.shapeHeight / 2;
        if (em.emissionMode === 'area') {
          ctx.fillRect(x, y, em.shapeWidth, em.shapeHeight);
        }
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

      // Рисуем направление
      ctx.setLineDash([]);
      ctx.strokeStyle = strokeColor;
      const angleRad = em.angle * Math.PI / 180;
      const dirLength = 40;
      ctx.beginPath();
      ctx.moveTo(em.position.x, em.position.y);
      ctx.lineTo(
        em.position.x + Math.cos(angleRad) * dirLength,
        em.position.y + Math.sin(angleRad) * dirLength
      );
      ctx.stroke();

      // Рисуем конус разброса
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = strokeColor;
      const spread = em.angleSpread * Math.PI / 180;
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
      ctx.globalAlpha = 1;

      ctx.restore();
    }
    
    // Рисуем частицы
    for (const p of this.particles) {
      const size = 8 * p.scale;
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
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

// ============================================================================
// ЗАПЕКАНИЕ АНИМАЦИИ
// ============================================================================

function bakeParticleAnimation(settings: ParticleSettings): BakedFrame[] {
  const frames: BakedFrame[] = [];
  const system = new ParticleSystem(settings);
  const frameCount = Math.ceil(settings.duration * settings.fps);
  const dt = 1 / settings.fps;

  for (let i = 0; i < frameCount; i++) {
    system.update(dt);
    
    // Сохраняем состояние всех частиц с их ID
    const particlesSnapshot = new Map<number, any>();
    
    for (const p of system.particles) {
      particlesSnapshot.set(p.id, {
        x: p.x - settings.emitter.position.x, // Относительно центра
        y: p.y - settings.emitter.position.y,
        rotation: Math.atan2(p.vy, p.vx) * 180 / Math.PI, // Направление движения
        scale: p.scale,
        alpha: p.alpha,
        color: { ...p.color }
      });
    }

    frames.push({
      time: i * dt,
      particles: particlesSnapshot
    });
  }

  return frames;
}

// Рендерим превью из запеченных данных
function renderBakedPreview(frames: BakedFrame[], settings: ParticleSettings): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = settings.frameSize;
  canvas.height = settings.frameSize;
  const ctx = canvas.getContext('2d')!;
  
  const centerX = settings.frameSize / 2;
  const centerY = settings.frameSize / 2;
  
  // Рисуем все кадры наложением для превью
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (const frame of frames) {
    for (const [id, p] of frame.particles) {
      const size = 8 * p.scale;
      ctx.globalAlpha = p.alpha * 0.3; // Уменьшаем для наложения
      ctx.fillStyle = `rgb(${p.color.r}, ${p.color.g}, ${p.color.b})`;
      ctx.beginPath();
      ctx.arc(centerX + p.x, centerY + p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  ctx.globalAlpha = 1;
  return canvas;
}

// ============================================================================
// СОЗДАНИЕ ТЕКСТУРЫ ЧАСТИЦЫ
// ============================================================================

function createParticleTexture(size: number = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const center = size / 2;
  const radius = size / 2 - 2;
  
  // Рисуем круглую частицу с градиентом
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

// Создаём простой атлас с одной текстурой частицы
function createParticleAtlas(): { canvas: HTMLCanvasElement; region: AtlasRegion } {
  const particleCanvas = createParticleTexture(64);
  const atlasSize = 128;
  
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d')!;
  
  // Рисуем текстуру частицы в атласе
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

// ============================================================================
// ГЕНЕРАЦИЯ SPINE JSON И ATLAS
// ============================================================================

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

function generateSpineJSON(frames: BakedFrame[], settings: ParticleSettings): string {
  // Собираем все уникальные ID частиц
  const allParticleIds = new Set<number>();
  for (const frame of frames) {
    for (const [id, _] of frame.particles) {
      allParticleIds.add(id);
    }
  }
  
  const particleIds = Array.from(allParticleIds).sort((a, b) => a - b);
  
  const skeleton = {
    hash: "particle_export",
    spine: "4.1.00",
    x: 0,
    y: 0,
    width: settings.frameSize,
    height: settings.frameSize
  };

  // Создаём кости: root + кость для каждого уникального ID частицы
  const bones: any[] = [{ name: "root" }];
  for (const id of particleIds) {
    bones.push({
      name: `particle_${id}`,
      parent: "root"
    });
  }

  // Создаём слоты для каждой частицы (все attachments выключены по умолчанию)
  const slots: any[] = [];
  for (const id of particleIds) {
    slots.push({
      name: `particle_slot_${id}`,
      bone: `particle_${id}`,
      attachment: null // Выключено в setup pose
    });
  }

  // Skin с одним attachment для всех
  const skins: any = {
    default: {}
  };
  
  for (const id of particleIds) {
    skins.default[`particle_slot_${id}`] = {
      particle: {
        type: "region",
        name: "particle",
        path: "particle",
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        width: 64,
        height: 64
      }
    };
  }

  // Анимация: трансформации костей и цвет слотов
  const animations: any = {
    particle_anim: {
      bones: {},
      slots: {}
    }
  };

  // Пороги для создания ключевых кадров (увеличены для меньшего количества ключей)
  const POSITION_THRESHOLD = 5.0; // пиксели (было 2.0)
  const ROTATION_THRESHOLD = 10.0; // градусы (было 5.0)
  const SCALE_THRESHOLD = 0.1; // (было 0.05)

  // Для каждой кости создаём оптимизированные ключи анимации
  for (const particleId of particleIds) {
    const boneName = `particle_${particleId}`;
    const slotName = `particle_slot_${particleId}`;
    
    const translateKeys: any[] = [];
    const rotateKeys: any[] = [];
    const scaleKeys: any[] = [];
    const attachmentKeys: any[] = [];

    // Собираем все углы для сглаживания
    const allAngles: number[] = [];
    for (const frame of frames) {
      const particle = frame.particles.get(particleId);
      if (particle) {
        allAngles.push(particle.rotation);
      } else {
        allAngles.push(allAngles.length > 0 ? allAngles[allAngles.length - 1] : 0);
      }
    }

    // Сглаживаем углы
    const smoothedAngles = smoothAngles(allAngles, 3);

    let prevPos: { x: number; y: number } | null = null;
    let prevRotation: number | null = null;
    let prevScale: number | null = null;
    let wasVisible = false;
    let hasAppeared = false; // Флаг появления частицы
    let normalizedAngle = 0;

    for (let frameIdx = 0; frameIdx < frames.length; frameIdx++) {
      const frame = frames[frameIdx];
      const particle = frame.particles.get(particleId);
      const isVisible = particle && isParticleVisible(particle);
      const isFirstFrame = frameIdx === 0;
      const isLastFrame = frameIdx === frames.length - 1;
      
      // Появление или исчезновение частицы - всегда создаём ключ
      const visibilityChanged = wasVisible !== isVisible;

      if (particle && isVisible) {
        // Частица появилась впервые
        if (!hasAppeared) {
          hasAppeared = true;
          const time = Math.round(frame.time * 1000) / 1000;
          
          // Включаем attachment
          attachmentKeys.push({
            time,
            name: "particle"
          });
        }

        const currentPos = { x: particle.x, y: particle.y };
        const currentScale = particle.scale;
        
        // Нормализуем угол относительно предыдущего
        if (prevRotation !== null) {
          normalizedAngle = normalizeAngle(smoothedAngles[frameIdx], normalizedAngle);
        } else {
          normalizedAngle = smoothedAngles[frameIdx];
        }

        // Позиция: создаём ключ если значительное изменение или важный момент
        if (isFirstFrame || isLastFrame || visibilityChanged || 
            prevPos === null || shouldCreateKey(prevPos, currentPos, POSITION_THRESHOLD)) {
          translateKeys.push({
            time: Math.round(frame.time * 1000) / 1000,
            x: Math.round(currentPos.x * 100) / 100,
            y: Math.round(currentPos.y * 100) / 100
          });
          prevPos = currentPos;
        }

        // Поворот: создаём ключ если значительное изменение
        if (isFirstFrame || isLastFrame || visibilityChanged ||
            prevRotation === null || shouldCreateKey(prevRotation, normalizedAngle, ROTATION_THRESHOLD)) {
          rotateKeys.push({
            time: Math.round(frame.time * 1000) / 1000,
            angle: Math.round(normalizedAngle * 100) / 100
          });
          prevRotation = normalizedAngle;
        }

        // Масштаб: создаём ключ если значительное изменение
        if (isFirstFrame || isLastFrame || visibilityChanged ||
            prevScale === null || shouldCreateKey(prevScale, currentScale, SCALE_THRESHOLD)) {
          scaleKeys.push({
            time: Math.round(frame.time * 1000) / 1000,
            x: Math.round(currentScale * 1000) / 1000,
            y: Math.round(currentScale * 1000) / 1000
          });
          prevScale = currentScale;
        }

        wasVisible = true;
      } else {
        // Частица не существует или невидима
        if (wasVisible && visibilityChanged) {
          // Частица исчезла - отключаем attachment
          const time = Math.round(frame.time * 1000) / 1000;
          attachmentKeys.push({
            time,
            name: null
          });
        }
        
        if (visibilityChanged && wasVisible) {
          const time = Math.round(frame.time * 1000) / 1000;
          
          // Финальные значения перед исчезновением
          if (prevPos) {
            translateKeys.push({ time, x: Math.round(prevPos.x * 100) / 100, y: Math.round(prevPos.y * 100) / 100 });
          }
          if (prevRotation !== null) {
            rotateKeys.push({ time, angle: Math.round(prevRotation * 100) / 100 });
          }
          if (prevScale !== null) {
            scaleKeys.push({ time, x: 0, y: 0 });
          }
        }
        
        wasVisible = false;
      }
    }

    // Добавляем анимацию только если частица хоть раз появлялась
    if (hasAppeared && translateKeys.length > 0) {
      // Убираем curve: "linear" для компактности - это дефолт в Spine
      animations.particle_anim.bones[boneName] = {
        translate: translateKeys,
        rotate: rotateKeys,
        scale: scaleKeys
      };

      // Только attachment, без color (частицы всегда белые)
      if (attachmentKeys.length > 0) {
        animations.particle_anim.slots[slotName] = {
          attachment: attachmentKeys
        };
      }
    }
  }

  // Используем компактный JSON без лишних пробелов
  return JSON.stringify({
    skeleton,
    bones,
    slots,
    skins,
    animations
  });
}

// ============================================================================
// УТИЛИТЫ ДЛЯ ОПТИМИЗАЦИИ АНИМАЦИИ
// ============================================================================

// Проверка, достаточно ли большое изменение для создания ключа
function shouldCreateKey(
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

// Нормализация угла для избежания скачков через 360°
function normalizeAngle(angle: number, prevAngle: number): number {
  // Приводим угол к диапазону относительно предыдущего
  while (angle - prevAngle > 180) angle -= 360;
  while (angle - prevAngle < -180) angle += 360;
  return angle;
}

// Сглаживание углов (медианный фильтр)
function smoothAngles(angles: number[], windowSize: number = 3): number[] {
  const result: number[] = [];
  const half = Math.floor(windowSize / 2);
  
  for (let i = 0; i < angles.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(angles.length, i + half + 1);
    const window = angles.slice(start, end);
    
    // Медиана
    const sorted = [...window].sort((a, b) => a - b);
    result[i] = sorted[Math.floor(sorted.length / 2)];
  }
  
  return result;
}

// Проверка на видимость частицы (для оптимизации)
function isParticleVisible(particle: any): boolean {
  return particle && particle.alpha > 0.01 && particle.scale > 0.01;
}

// ============================================================================
// УТИЛИТЫ СКАЧИВАНИЯ И ZIP
// ============================================================================

// Простая реализация ZIP без внешних библиотек
class SimpleZip {
  private files: Array<{ name: string; data: Uint8Array }> = [];

  addFile(name: string, data: string | Uint8Array) {
    const uint8Data = typeof data === 'string' 
      ? new TextEncoder().encode(data)
      : data;
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

  // Создаём простой ZIP архив
  generate(): Blob {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let offset = 0;
    const centralDirectory: Uint8Array[] = [];

    // Добавляем файлы
    for (const file of this.files) {
      const nameBytes = encoder.encode(file.name);
      const crc = this.crc32(file.data);
      
      // Local file header
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);
      
      view.setUint32(0, 0x04034b50, true); // Signature
      view.setUint16(4, 20, true); // Version
      view.setUint16(6, 0, true); // Flag
      view.setUint16(8, 0, true); // Compression (0 = no compression)
      view.setUint16(10, 0, true); // Time
      view.setUint16(12, 0, true); // Date
      view.setUint32(14, crc, true); // CRC32
      view.setUint32(18, file.data.length, true); // Compressed size
      view.setUint32(22, file.data.length, true); // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // Name length
      view.setUint16(28, 0, true); // Extra field length
      
      localHeader.set(nameBytes, 30);
      chunks.push(localHeader);
      chunks.push(file.data);

      // Central directory header
      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(centralHeader.buffer);
      
      cdView.setUint32(0, 0x02014b50, true); // Signature
      cdView.setUint16(4, 20, true); // Version made by
      cdView.setUint16(6, 20, true); // Version needed
      cdView.setUint16(8, 0, true); // Flag
      cdView.setUint16(10, 0, true); // Compression
      cdView.setUint16(12, 0, true); // Time
      cdView.setUint16(14, 0, true); // Date
      cdView.setUint32(16, crc, true); // CRC32
      cdView.setUint32(20, file.data.length, true); // Compressed size
      cdView.setUint32(24, file.data.length, true); // Uncompressed size
      cdView.setUint16(28, nameBytes.length, true); // Name length
      cdView.setUint16(30, 0, true); // Extra field length
      cdView.setUint16(32, 0, true); // Comment length
      cdView.setUint16(34, 0, true); // Disk number
      cdView.setUint16(36, 0, true); // Internal attributes
      cdView.setUint32(38, 0, true); // External attributes
      cdView.setUint32(42, offset, true); // Relative offset
      
      centralHeader.set(nameBytes, 46);
      centralDirectory.push(centralHeader);

      offset += localHeader.length + file.data.length;
    }

    // Concatenate central directory
    const centralDirData = new Uint8Array(
      centralDirectory.reduce((sum, cd) => sum + cd.length, 0)
    );
    let cdOffset = 0;
    for (const cd of centralDirectory) {
      centralDirData.set(cd, cdOffset);
      cdOffset += cd.length;
    }

    // End of central directory
    const endOfCentralDir = new Uint8Array(22);
    const eocdView = new DataView(endOfCentralDir.buffer);
    
    eocdView.setUint32(0, 0x06054b50, true); // Signature
    eocdView.setUint16(4, 0, true); // Disk number
    eocdView.setUint16(6, 0, true); // Central dir start disk
    eocdView.setUint16(8, this.files.length, true); // Entries on this disk
    eocdView.setUint16(10, this.files.length, true); // Total entries
    eocdView.setUint32(12, centralDirData.length, true); // Central dir size
    eocdView.setUint32(16, offset, true); // Central dir offset
    eocdView.setUint16(20, 0, true); // Comment length

    // Combine everything
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0) 
                    + centralDirData.length 
                    + endOfCentralDir.length;
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

  // Simple CRC32 implementation
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

// ============================================================================
// REACT КОМПОНЕНТЫ
// ============================================================================

const ParticleSpineExporter: React.FC = () => {
  const [settings, setSettings] = useState<ParticleSettings>(DEFAULT_SETTINGS);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showSettings, setShowSettings] = useState(true);
  const [showEmitter, setShowEmitter] = useState(true);
  const [exportStatus, setExportStatus] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemRef = useRef<ParticleSystem | null>(null);
  const animationRef = useRef<number>();

  // Инициализация системы частиц
  useEffect(() => {
    systemRef.current = new ParticleSystem(settings);
  }, []);

  // Основной цикл анимации
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
        systemRef.current.render(ctx, showEmitter);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, showEmitter]);

  // Обновление настроек системы
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

  const handleExport = async () => {
    setExportStatus('🔄 Запекание анимации...');
    setIsPlaying(false);
    
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // 1. Запекаем кадры с данными частиц по ID
      const frames = bakeParticleAnimation(settings);
      const uniqueParticles = new Set<number>();
      for (const frame of frames) {
        for (const [id, _] of frame.particles) {
          uniqueParticles.add(id);
        }
      }
      setExportStatus(`✓ Запечено ${frames.length} кадров, уникальных частиц: ${uniqueParticles.size}`);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. Создаём атлас с текстурой частицы
      setExportStatus('🎨 Создание текстуры частицы...');
      const { canvas: atlasCanvas, region } = createParticleAtlas();
      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Генерируем файлы
      setExportStatus('📝 Генерация Spine данных...');
      const atlasText = generateAtlasFile(atlasCanvas, region);
      const spineJSON = generateSpineJSON(frames, settings);
      await new Promise(resolve => setTimeout(resolve, 100));

      // 4. Создаём превью для визуализации
      setExportStatus('🖼️ Создание превью...');
      const previewCanvas = renderBakedPreview(frames, settings);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setExportStatus('📦 Создание ZIP архива...');
      await new Promise(resolve => setTimeout(resolve, 100));

      // 5. Создаём ZIP архив
      const zip = new SimpleZip();
      
      // Добавляем текстуру частицы
      setExportStatus('📦 Добавление particles.png...');
      await zip.addCanvasFile('particles.png', atlasCanvas);
      
      // Добавляем превью (опционально)
      setExportStatus('📦 Добавление preview.png...');
      await zip.addCanvasFile('preview.png', previewCanvas);
      
      // Добавляем текстовые файлы
      setExportStatus('📦 Добавление .atlas и .json...');
      zip.addFile('particles.atlas', atlasText);
      zip.addFile('particles_spine.json', spineJSON);
      
      // 6. Генерируем и скачиваем ZIP
      setExportStatus('💾 Создание ZIP файла...');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const zipBlob = zip.generate();
      downloadBlob(zipBlob, 'particles_export.zip');

      setExportStatus(`✅ Экспорт завершён! ${frames.length} кадров, ${uniqueParticles.size} костей → particles_export.zip`);
      setTimeout(() => setExportStatus(''), 5000);
    } catch (error) {
      console.error('Ошибка экспорта:', error);
      setExportStatus('❌ Ошибка: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
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
          <p className="text-slate-300">Создавайте эффекты частиц и экспортируйте в Spine</p>
          <p className="text-sm text-slate-400 mt-2">
            💡 Каждая частица = отдельная кость с трансформациями. Частицы белые, окрашиваются через Spine слоты.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Превью */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Превью</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowEmitter(!showEmitter)}
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      showEmitter 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  >
                    {showEmitter ? '👁️ Эмиттер' : '👁️‍🗨️ Эмиттер'}
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <Play size={16} />
                    {isPlaying ? 'Пауза' : 'Играть'}
                  </button>
                  <button
                    onClick={handleRestart}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <RotateCcw size={16} />
                    Рестарт
                  </button>
                </div>
              </div>
              
              <div className="bg-black rounded-lg overflow-hidden border border-slate-600">
                <canvas
                  ref={canvasRef}
                  width={settings.frameSize}
                  height={settings.frameSize}
                  className="w-full"
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleExport}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all transform hover:scale-105"
                >
                  <Download size={20} />
                  Экспортировать в ZIP
                </button>
              </div>

              {exportStatus && (
                <div className="mt-4 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                  <p className="text-sm">{exportStatus}</p>
                </div>
              )}
            </div>
          </div>

          {/* Настройки */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-6 border border-slate-700 sticky top-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Settings size={20} />
                  Настройки
                </h2>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  {showSettings ? 'Скрыть' : 'Показать'}
                </button>
              </div>

              {showSettings && (
                <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                  {/* Эмиттер */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-purple-400 text-sm uppercase">Эмиттер</h3>
                    
                    <label className="block">
                      <span className="text-sm text-slate-300">Форма</span>
                      <select
                        value={settings.emitter.shape}
                        onChange={e => updateSettings({
                          ...settings,
                          emitter: { ...settings.emitter, shape: e.target.value as any }
                        })}
                        className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm"
                      >
                        <option value="point">📍 Точка</option>
                        <option value="circle">⭕ Круг</option>
                        <option value="rectangle">⬜ Прямоугольник</option>
                        <option value="roundedRect">▢ Скруглённый прямоугольник</option>
                      </select>
                    </label>

                    {settings.emitter.shape !== 'point' && (
                      <label className="block">
                        <span className="text-sm text-slate-300">Режим эмиссии</span>
                        <select
                          value={settings.emitter.emissionMode}
                          onChange={e => updateSettings({
                            ...settings,
                            emitter: { ...settings.emitter, emissionMode: e.target.value as any }
                          })}
                          className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm"
                        >
                          <option value="area">🟢 Внутри области</option>
                          <option value="edge">🟠 По контуру</option>
                        </select>
                      </label>
                    )}

                    {settings.emitter.shape === 'circle' && (
                      <label className="block">
                        <span className="text-sm text-slate-300">Радиус: {settings.emitter.shapeRadius}px</span>
                        <input
                          type="range"
                          min="5"
                          max="150"
                          value={settings.emitter.shapeRadius}
                          onChange={e => updateSettings({
                            ...settings,
                            emitter: { ...settings.emitter, shapeRadius: Number(e.target.value) }
                          })}
                          className="w-full mt-1"
                        />
                      </label>
                    )}

                    {(settings.emitter.shape === 'rectangle' || settings.emitter.shape === 'roundedRect') && (
                      <>
                        <label className="block">
                          <span className="text-sm text-slate-300">Ширина (X): {settings.emitter.shapeWidth}px</span>
                          <input
                            type="range"
                            min="10"
                            max="300"
                            value={settings.emitter.shapeWidth}
                            onChange={e => updateSettings({
                              ...settings,
                              emitter: { ...settings.emitter, shapeWidth: Number(e.target.value) }
                            })}
                            className="w-full mt-1"
                          />
                        </label>

                        <label className="block">
                          <span className="text-sm text-slate-300">Высота (Y): {settings.emitter.shapeHeight}px</span>
                          <input
                            type="range"
                            min="10"
                            max="300"
                            value={settings.emitter.shapeHeight}
                            onChange={e => updateSettings({
                              ...settings,
                              emitter: { ...settings.emitter, shapeHeight: Number(e.target.value) }
                            })}
                            className="w-full mt-1"
                          />
                        </label>
                      </>
                    )}

                    {settings.emitter.shape === 'roundedRect' && (
                      <label className="block">
                        <span className="text-sm text-slate-300">Радиус углов: {settings.emitter.roundRadius}px</span>
                        <input
                          type="range"
                          min="0"
                          max={Math.min(50, settings.emitter.shapeWidth / 2, settings.emitter.shapeHeight / 2)}
                          value={settings.emitter.roundRadius}
                          onChange={e => updateSettings({
                            ...settings,
                            emitter: { ...settings.emitter, roundRadius: Number(e.target.value) }
                          })}
                          className="w-full mt-1"
                        />
                      </label>
                    )}

                    <label className="block">
                      <span className="text-sm text-slate-300">Угол направления: {settings.emitter.angle}°</span>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={settings.emitter.angle}
                        onChange={e => updateSettings({
                          ...settings,
                          emitter: { ...settings.emitter, angle: Number(e.target.value) }
                        })}
                        className="w-full mt-1"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-slate-300">Разброс угла: {settings.emitter.angleSpread}°</span>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        value={settings.emitter.angleSpread}
                        onChange={e => updateSettings({
                          ...settings,
                          emitter: { ...settings.emitter, angleSpread: Number(e.target.value) }
                        })}
                        className="w-full mt-1"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-slate-300">Скорость (min-max)</span>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="number"
                          value={settings.emitter.speedMin}
                          onChange={e => updateSettings({
                            ...settings,
                            emitter: { ...settings.emitter, speedMin: Number(e.target.value) }
                          })}
                          className="w-1/2 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm"
                        />
                        <input
                          type="number"
                          value={settings.emitter.speedMax}
                          onChange={e => updateSettings({
                            ...settings,
                            emitter: { ...settings.emitter, speedMax: Number(e.target.value) }
                          })}
                          className="w-1/2 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="text-sm text-slate-300">Частиц/сек: {settings.emitter.rate}</span>
                      <input
                        type="range"
                        min="1"
                        max="200"
                        value={settings.emitter.rate}
                        onChange={e => updateSettings({
                          ...settings,
                          emitter: { ...settings.emitter, rate: Number(e.target.value) }
                        })}
                        className="w-full mt-1"
                      />
                    </label>
                  </div>

                  {/* Время жизни */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-purple-400 text-sm uppercase">Время жизни</h3>
                    
                    <label className="block">
                      <span className="text-sm text-slate-300">Время (min-max, сек)</span>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="number"
                          step="0.1"
                          value={settings.lifeTimeMin}
                          onChange={e => updateSettings({
                            ...settings,
                            lifeTimeMin: Number(e.target.value)
                          })}
                          className="w-1/2 px-3 py-2 bg-slate-900 border border-slate-600 rounded"
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={settings.lifeTimeMax}
                          onChange={e => updateSettings({
                            ...settings,
                            lifeTimeMax: Number(e.target.value)
                          })}
                          className="w-1/2 px-3 py-2 bg-slate-900 border border-slate-600 rounded"
                        />
                      </div>
                    </label>
                  </div>

                  {/* Физика */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-purple-400 text-sm uppercase">Физика</h3>
                    
                    <label className="block">
                      <span className="text-sm text-slate-300">Гравитация Y: {settings.gravityY}</span>
                      <input
                        type="range"
                        min="-500"
                        max="500"
                        value={settings.gravityY}
                        onChange={e => updateSettings({
                          ...settings,
                          gravityY: Number(e.target.value)
                        })}
                        className="w-full mt-1"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-slate-300">Сопротивление: {settings.drag.toFixed(2)}</span>
                      <input
                        type="range"
                        min="0.9"
                        max="1.0"
                        step="0.01"
                        value={settings.drag}
                        onChange={e => updateSettings({
                          ...settings,
                          drag: Number(e.target.value)
                        })}
                        className="w-full mt-1"
                      />
                    </label>
                  </div>

                  {/* Масштаб */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-purple-400 text-sm uppercase">Масштаб</h3>
                    
                    <label className="block">
                      <span className="text-sm text-slate-300">Начальный: {settings.scaleStart.toFixed(2)}</span>
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.1"
                        value={settings.scaleStart}
                        onChange={e => updateSettings({
                          ...settings,
                          scaleStart: Number(e.target.value)
                        })}
                        className="w-full mt-1"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-slate-300">Конечный: {settings.scaleEnd.toFixed(2)}</span>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        value={settings.scaleEnd}
                        onChange={e => updateSettings({
                          ...settings,
                          scaleEnd: Number(e.target.value)
                        })}
                        className="w-full mt-1"
                      />
                    </label>
                  </div>

                  {/* Экспорт */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-purple-400 text-sm uppercase">Экспорт</h3>
                    
                    <label className="block">
                      <span className="text-sm text-slate-300">Длительность (сек)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.duration}
                        onChange={e => updateSettings({
                          ...settings,
                          duration: Number(e.target.value)
                        })}
                        className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded"
                      />
                    </label>

                    <label className="block">
                      <span className="text-sm text-slate-300">FPS</span>
                      <select
                        value={settings.fps}
                        onChange={e => updateSettings({
                          ...settings,
                          fps: Number(e.target.value)
                        })}
                        className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded"
                      >
                        <option value="24">24</option>
                        <option value="30">30</option>
                        <option value="60">60</option>
                      </select>
                    </label>

                    <div className="text-xs text-slate-400 bg-slate-900/50 p-3 rounded">
                      <div>Кадров: {Math.ceil(settings.duration * settings.fps)}</div>
                      <div className="mt-1 text-purple-300">
                        Частицы → кости (белые, без color keys)
                      </div>
                      <div className="mt-1 text-green-300">
                        {settings.emitter.emissionMode === 'edge' ? '🟠 По контуру' : '🟢 Внутри области'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleReset}
                    className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Сбросить настройки
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