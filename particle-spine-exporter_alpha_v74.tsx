import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

interface Vec2 { x: number; y: number; }
interface Color { r: number; g: number; b: number; a: number; }

interface CurvePoint {
  time: number;
  value: number;
}

interface Curve {
  points: CurvePoint[];
  interpolation: 'linear' | 'smooth';
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
  
  emissionType: 'continuous' | 'burst' | 'duration';
  burstCount: number;
  burstCycles: number;
  burstInterval: number;
  durationStart: number;
  durationEnd: number;
}

interface ParticleSettings {
  emitter: EmitterSettings;
  lifeTimeMin: number;
  lifeTimeMax: number;
  gravityY: number;
  drag: number;
  
  sizeOverLifetime: Curve;
  speedOverLifetime: Curve;
  weightOverLifetime: Curve;
  spinOverLifetime: Curve;
  attractionOverLifetime: Curve;
  
  noiseStrengthOverLifetime: Curve;
  noiseFrequency: number;
  noiseSpeed: number;
  
  angularVelocityOverLifetime: Curve;
  
  vortexStrengthOverLifetime: Curve;
  vortexPoint: Vec2;
  
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
    maxParticles: 500,
    
    emissionType: 'continuous',
    burstCount: 50,
    burstCycles: 1,
    burstInterval: 0.5,
    durationStart: 0,
    durationEnd: 2,
  },
  lifeTimeMin: 0.5,
  lifeTimeMax: 1.5,
  gravityY: 200,
  drag: 0.98,
  
  sizeOverLifetime: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 0.2 }], interpolation: 'linear' },
  speedOverLifetime: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 1.0 }], interpolation: 'linear' },
  weightOverLifetime: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 1.0 }], interpolation: 'linear' },
  spinOverLifetime: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  attractionOverLifetime: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  
  noiseStrengthOverLifetime: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  noiseFrequency: 0.01,
  noiseSpeed: 1.0,
  
  angularVelocityOverLifetime: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  
  vortexStrengthOverLifetime: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  vortexPoint: { x: 256, y: 256 },
  
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

function simpleNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function noise2D(x: number, y: number, time: number): Vec2 {
  const angle = simpleNoise(x, y + time) * Math.PI * 2;
  const strength = simpleNoise(x + 100, y + 100 + time);
  
  return {
    x: Math.cos(angle) * strength,
    y: Math.sin(angle) * strength
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

const CurveEditor: React.FC<{
  label: string;
  curve: Curve;
  onChange: (curve: Curve) => void;
  min?: number;
  max?: number;
}> = ({ label, curve, onChange, min = 0, max = 2 }) => {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const width = 260;
  const height = 80;
  const padding = 8;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const valueToY = (value: number) => {
    const normalized = (value - min) / (max - min);
    return height - padding - normalized * graphHeight;
  };

  const timeToX = (time: number) => {
    return padding + time * graphWidth;
  };

  const xToTime = (x: number) => {
    return Math.max(0, Math.min(1, (x - padding) / graphWidth));
  };

  const yToValue = (y: number) => {
    const normalized = (height - padding - y) / graphHeight;
    return min + normalized * (max - min);
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) return;
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const clickedPoint = curve.points.findIndex(p => {
      const px = timeToX(p.time);
      const py = valueToY(p.value);
      const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      return distance < 8;
    });

    if (clickedPoint !== -1) {
      setSelectedPoint(clickedPoint);
      return;
    }

    const newTime = xToTime(x);
    const newValue = yToValue(y);

    const newPoints = [...curve.points, { time: newTime, value: newValue }]
      .sort((a, b) => a.time - b.time);

    onChange({ ...curve, points: newPoints });
    setSelectedPoint(newPoints.findIndex(p => p.time === newTime && p.value === newValue));
  };

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSelectedPoint(index);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || selectedPoint === null) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newTime = xToTime(x);
    const newValue = Math.max(min, Math.min(max, yToValue(y)));

    const newPoints = [...curve.points];
    
    if (selectedPoint === 0) {
      newPoints[selectedPoint] = { time: 0, value: newValue };
    } else if (selectedPoint === newPoints.length - 1) {
      newPoints[selectedPoint] = { time: 1, value: newValue };
    } else {
      newPoints[selectedPoint] = { time: newTime, value: newValue };
    }

    onChange({ ...curve, points: newPoints.sort((a, b) => a.time - b.time) });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDeletePoint = () => {
    if (selectedPoint === null || curve.points.length <= 2) return;
    
    const newPoints = curve.points.filter((_, i) => i !== selectedPoint);
    onChange({ ...curve, points: newPoints });
    setSelectedPoint(null);
  };

  const generatePath = () => {
    const pathPoints: string[] = [];
    
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const value = evaluateCurve(curve, t);
      const x = timeToX(t);
      const y = valueToY(value);
      pathPoints.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
    }
    
    return pathPoints.join(' ');
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-300">{label}</label>
        <div className="flex items-center gap-1">
          <select
            value={curve.interpolation}
            onChange={e => onChange({ ...curve, interpolation: e.target.value as any })}
            className="px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-[10px]"
          >
            <option value="linear">Linear</option>
            <option value="smooth">Smooth</option>
          </select>
          {selectedPoint !== null && curve.points.length > 2 && (
            <button
              onClick={handleDeletePoint}
              className="p-0.5 bg-red-600 hover:bg-red-700 rounded"
              title="Delete point"
            >
              <Trash2 size={10} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded border border-slate-700 p-1">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="cursor-crosshair"
          onClick={handleSvgClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <line
              key={`v-${t}`}
              x1={timeToX(t)}
              y1={padding}
              x2={timeToX(t)}
              y2={height - padding}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
          ))}
          
          <path
            d={generatePath()}
            fill="none"
            stroke="rgb(168, 85, 247)"
            strokeWidth="2"
          />

          {curve.points.map((point, i) => (
            <g key={i}>
              <circle
                cx={timeToX(point.time)}
                cy={valueToY(point.value)}
                r={selectedPoint === i ? 5 : 4}
                fill={selectedPoint === i ? "rgb(236, 72, 153)" : "rgb(168, 85, 247)"}
                stroke="white"
                strokeWidth="1.5"
                className="cursor-move"
                onMouseDown={(e) => handleMouseDown(e, i)}
              />
              {selectedPoint === i && (
                <text
                  x={timeToX(point.time)}
                  y={valueToY(point.value) - 10}
                  fill="white"
                  fontSize="9"
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {point.value.toFixed(1)}
                </text>
              )}
            </g>
          ))}
        </svg>

        {selectedPoint !== null && (
          <div className="mt-1 grid grid-cols-2 gap-1">
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={curve.points[selectedPoint].time.toFixed(2)}
              onChange={e => {
                const newPoints = [...curve.points];
                const newTime = selectedPoint === 0 ? 0 : selectedPoint === newPoints.length - 1 ? 1 : parseFloat(e.target.value);
                newPoints[selectedPoint] = { ...newPoints[selectedPoint], time: newTime };
                onChange({ ...curve, points: newPoints.sort((a, b) => a.time - b.time) });
              }}
              disabled={selectedPoint === 0 || selectedPoint === curve.points.length - 1}
              className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
              placeholder="Time"
            />
            <input
              type="number"
              min={min}
              max={max}
              step="0.1"
              value={curve.points[selectedPoint].value.toFixed(2)}
              onChange={e => {
                const newPoints = [...curve.points];
                newPoints[selectedPoint] = { ...newPoints[selectedPoint], value: parseFloat(e.target.value) };
                onChange({ ...curve, points: newPoints });
              }}
              className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
              placeholder="Value"
            />
          </div>
        )}
      </div>
    </div>
  );
};

const CollapsibleSection: React.FC<{
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, isOpen, onToggle, children }) => {
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/70 hover:bg-slate-800 transition-colors"
      >
        <span className="text-sm font-semibold text-purple-300">{title}</span>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {isOpen && (
        <div className="p-3 bg-slate-800/30 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
};

class ParticleSystem {
  particles: Particle[] = [];
  settings: ParticleSettings;
  time: number = 0;
  spawnAccumulator: number = 0;
  nextParticleId: number = 0;
  burstCycleIndex: number = 0;
  lastBurstTime: number = 0;

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
  }

  update(dt: number) {
    this.time += dt;
    
    const em = this.settings.emitter;
    
    if (em.emissionType === 'continuous') {
      this.spawnAccumulator += dt;
      const spawnInterval = 1 / em.rate;
      
      while (this.spawnAccumulator >= spawnInterval && this.particles.length < em.maxParticles) {
        this.spawnParticle();
        this.spawnAccumulator -= spawnInterval;
      }
    } 
    else if (em.emissionType === 'burst') {
      if (this.burstCycleIndex < em.burstCycles) {
        const timeSinceLastBurst = this.time - this.lastBurstTime;
        
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
      if (this.time >= em.durationStart && this.time <= em.durationEnd) {
        this.spawnAccumulator += dt;
        const spawnInterval = 1 / em.rate;
        
        while (this.spawnAccumulator >= spawnInterval && this.particles.length < em.maxParticles) {
          this.spawnParticle();
          this.spawnAccumulator -= spawnInterval;
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
      
      const sizeMultiplier = evaluateCurve(this.settings.sizeOverLifetime, t);
      p.scale = sizeMultiplier;
      
      if (this.settings.nonUniformScale) {
        p.scaleX = sizeMultiplier * this.settings.scaleRatioX;
        p.scaleY = sizeMultiplier * this.settings.scaleRatioY;
      } else {
        p.scaleX = sizeMultiplier;
        p.scaleY = sizeMultiplier;
      }
      
      const speedMultiplier = evaluateCurve(this.settings.speedOverLifetime, t);
      const weightMultiplier = evaluateCurve(this.settings.weightOverLifetime, t);
      p.vy += this.settings.gravityY * weightMultiplier * dt;
      
      const noiseStrength = evaluateCurve(this.settings.noiseStrengthOverLifetime, t);
      if (noiseStrength !== 0) {
        const noiseX = p.x * this.settings.noiseFrequency;
        const noiseY = p.y * this.settings.noiseFrequency;
        const noiseTime = this.time * this.settings.noiseSpeed;
        
        const noiseForce = noise2D(noiseX, noiseY, noiseTime);
        
        p.vx += noiseForce.x * noiseStrength * dt;
        p.vy += noiseForce.y * noiseStrength * dt;
      }
      
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
      
      const vortexStrength = evaluateCurve(this.settings.vortexStrengthOverLifetime, t);
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
      
      p.vx *= this.settings.drag;
      p.vy *= this.settings.drag;
      
      p.x += p.vx * speedMultiplier * dt;
      p.y += p.vy * speedMultiplier * dt;
      
      const spinSpeed = evaluateCurve(this.settings.spinOverLifetime, t);
      p.rotation += spinSpeed * dt;
      
      const angularVelocity = evaluateCurve(this.settings.angularVelocityOverLifetime, t);
      p.rotation += angularVelocity * dt;

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

  render(ctx: CanvasRenderingContext2D, showEmitter: boolean = false, zoom: number = 1, backgroundImage?: HTMLImageElement | null, bgPosition?: { x: number; y: number }) {
    ctx.save();
    ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
    
    ctx.clearRect(0, 0, ctx.canvas.width / zoom, ctx.canvas.height / zoom);
    
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
  const [showEmitter, setShowEmitter] = useState(true);
  const [exportStatus, setExportStatus] = useState('');
  const [liveParticleCount, setLiveParticleCount] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [bgPosition, setBgPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const [emitterOpen, setEmitterOpen] = useState(true);
  const [particleOpen, setParticleOpen] = useState(true);
  const [forcesOpen, setForcesOpen] = useState(true);
  const [curvesOpen, setCurvesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  
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
        systemRef.current.render(ctx, showEmitter, zoom, backgroundImage, bgPosition);
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
  }, [isPlaying, showEmitter, zoom, backgroundImage, bgPosition]);

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

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.25, Math.min(4, prev * delta)));
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
    setExportStatus('🔄 Baking...');
    setIsPlaying(false);
    
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const frames = bakeParticleAnimation(settings);
      const uniqueParticles = new Set<number>();
      for (const frame of frames) {
        for (const [id, _] of frame.particles) {
          uniqueParticles.add(id);
        }
      }
      setExportStatus(`✓ ${frames.length} frames, ${uniqueParticles.size} particles`);
      await new Promise(resolve => setTimeout(resolve, 50));

      const { canvas: atlasCanvas, region } = createParticleAtlas();
      const atlasText = generateAtlasFile(atlasCanvas, region);
      const spineJSON = generateSpineJSON(frames, settings);
      const previewCanvas = renderBakedPreview(frames, settings);
      
      const zip = new SimpleZip();
      await zip.addCanvasFile('particles.png', atlasCanvas);
      await zip.addCanvasFile('preview.png', previewCanvas);
      zip.addFile('particles.atlas', atlasText);
      zip.addFile('particles_spine.json', spineJSON);
      
      const zipBlob = zip.generate();
      downloadBlob(zipBlob, 'particles_export.zip');

      setExportStatus(`✅ Exported!`);
      setTimeout(() => setExportStatus(''), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('❌ Error: ' + (error instanceof Error ? error.message : 'Unknown'));
      setTimeout(() => setExportStatus(''), 3000);
    } finally {
      setIsPlaying(true);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Particle → Spine Exporter v74
          </h1>
          <p className="text-xs text-slate-400">Noise Field • Vortex • Angular Velocity • Emission Modes</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
          <div className="space-y-3">
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-3 border border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">Preview</span>
                <div className="flex gap-1.5">
                  <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs">
                    📁
                  </button>
                  {backgroundImage && (
                    <button onClick={() => setBackgroundImage(null)} className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs">
                      🗑️
                    </button>
                  )}
                  <button onClick={() => setShowEmitter(!showEmitter)} className={`px-2 py-1 rounded text-xs ${showEmitter ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-700 hover:bg-slate-600'}`}>
                    {showEmitter ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button onClick={() => setIsPlaying(!isPlaying)} className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs">
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button onClick={handleRestart} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs">
                    <RotateCcw size={12} />
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
              
              <div className="bg-black rounded overflow-hidden border border-slate-600 relative">
                <canvas
                  ref={canvasRef}
                  width={settings.frameSize}
                  height={settings.frameSize}
                  className="w-full h-[400px]"
                  style={{ imageRendering: 'pixelated', cursor: backgroundImage ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                  onWheel={handleWheel}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
                <div className="absolute top-1.5 left-1.5 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono">
                  Live: {liveParticleCount} | Zoom: {zoom.toFixed(1)}x
                </div>
                <div className="absolute bottom-1.5 right-1.5 bg-black/70 px-2 py-0.5 rounded text-[10px] text-slate-400">
                  Scroll to zoom
                </div>
              </div>

              <button onClick={handleExport} className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded font-semibold text-sm transition-all">
                <Download size={14} className="inline mr-1" />
                Export ZIP
              </button>

              {exportStatus && (
                <div className="mt-2 p-2 bg-slate-700/50 rounded border border-slate-600 text-[10px]">
                  {exportStatus}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <CollapsibleSection title="🎯 Emitter Settings" isOpen={emitterOpen} onToggle={() => setEmitterOpen(!emitterOpen)}>
              <div className="space-y-2">
                <label className="block">
                  <span className="text-xs text-slate-300">Emission Type</span>
                  <select 
                    value={settings.emitter.emissionType} 
                    onChange={e => updateSettings({ 
                      ...settings, 
                      emitter: { ...settings.emitter, emissionType: e.target.value as any }
                    })} 
                    className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                  >
                    <option value="continuous">🌊 Continuous</option>
                    <option value="burst">💥 Burst</option>
                    <option value="duration">⏱️ Duration</option>
                  </select>
                </label>

                {settings.emitter.emissionType === 'burst' && (
                  <div className="space-y-2 pl-2 border-l-2 border-purple-500">
                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Count (particles per burst)</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="500" 
                        value={settings.emitter.burstCount} 
                        onChange={e => updateSettings({ 
                          ...settings, 
                          emitter: { ...settings.emitter, burstCount: Number(e.target.value) }
                        })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                      />
                    </label>
                    
                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Cycles (how many times)</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="20" 
                        value={settings.emitter.burstCycles} 
                        onChange={e => updateSettings({ 
                          ...settings, 
                          emitter: { ...settings.emitter, burstCycles: Number(e.target.value) }
                        })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                      />
                    </label>
                    
                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Interval (seconds between bursts)</span>
                      <input 
                        type="number" 
                        min="0.1" 
                        max="5" 
                        step="0.1"
                        value={settings.emitter.burstInterval} 
                        onChange={e => updateSettings({ 
                          ...settings, 
                          emitter: { ...settings.emitter, burstInterval: Number(e.target.value) }
                        })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                      />
                    </label>
                  </div>
                )}

                {settings.emitter.emissionType === 'duration' && (
                  <div className="space-y-2 pl-2 border-l-2 border-blue-500">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Start (sec)</span>
                        <input 
                          type="number" 
                          min="0" 
                          max={settings.emitter.durationEnd - 0.1}
                          step="0.1"
                          value={settings.emitter.durationStart} 
                          onChange={e => updateSettings({ 
                            ...settings, 
                            emitter: { ...settings.emitter, durationStart: Number(e.target.value) }
                          })} 
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                        />
                      </label>
                      
                      <label className="block">
                        <span className="text-xs text-slate-300">End (sec)</span>
                        <input 
                          type="number" 
                          min={settings.emitter.durationStart + 0.1}
                          max={settings.duration}
                          step="0.1"
                          value={settings.emitter.durationEnd} 
                          onChange={e => updateSettings({ 
                            ...settings, 
                            emitter: { ...settings.emitter, durationEnd: Number(e.target.value) }
                          })} 
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                        />
                      </label>
                    </div>
                    
                    <label className="block">
                      <span className="text-xs text-slate-300">Rate (particles per sec)</span>
                      <input 
                        type="number" 
                        min="1" 
                        max="200" 
                        value={settings.emitter.rate} 
                        onChange={e => updateSettings({ 
                          ...settings, 
                          emitter: { ...settings.emitter, rate: Number(e.target.value) }
                        })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                      />
                    </label>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs text-slate-300">Shape</span>
                  <select value={settings.emitter.shape} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shape: e.target.value as any }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs">
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
                    <select value={settings.emitter.emissionMode} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, emissionMode: e.target.value as any }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs">
                      <option value="area">🟢 Inside</option>
                      <option value="edge">🟠 Edge</option>
                    </select>
                  </label>
                )}

                {settings.emitter.shape === 'line' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Length</span>
                    <input type="number" min="10" max="400" value={settings.emitter.lineLength} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, lineLength: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                {settings.emitter.shape === 'circle' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Radius</span>
                    <input type="number" min="5" max="150" value={settings.emitter.shapeRadius} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeRadius: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                {(settings.emitter.shape === 'rectangle' || settings.emitter.shape === 'roundedRect') && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Width</span>
                      <input type="number" min="10" max="300" value={settings.emitter.shapeWidth} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeWidth: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-300">Height</span>
                      <input type="number" min="10" max="300" value={settings.emitter.shapeHeight} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeHeight: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                  </div>
                )}

                {settings.emitter.shape === 'roundedRect' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Corner Radius</span>
                    <input type="number" min="0" max={Math.min(50, settings.emitter.shapeWidth / 2, settings.emitter.shapeHeight / 2)} value={settings.emitter.roundRadius} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, roundRadius: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Angle</span>
                    <input type="number" min="-180" max="180" value={settings.emitter.angle} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, angle: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Spread</span>
                    <input type="number" min="0" max="360" value={settings.emitter.angleSpread} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, angleSpread: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Speed Min</span>
                    <input type="number" value={settings.emitter.speedMin} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, speedMin: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Speed Max</span>
                    <input type="number" value={settings.emitter.speedMax} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, speedMax: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                </div>

                {settings.emitter.emissionType === 'continuous' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Rate (per sec)</span>
                    <input type="number" min="1" max="200" value={settings.emitter.rate} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, rate: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="✨ Particle Settings" isOpen={particleOpen} onToggle={() => setParticleOpen(!particleOpen)}>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Life Min (s)</span>
                    <input type="number" step="0.1" value={settings.lifeTimeMin} onChange={e => updateSettings({ ...settings, lifeTimeMin: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Life Max (s)</span>
                    <input type="number" step="0.1" value={settings.lifeTimeMax} onChange={e => updateSettings({ ...settings, lifeTimeMax: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Gravity Y</span>
                    <input type="number" min="-500" max="500" value={settings.gravityY} onChange={e => updateSettings({ ...settings, gravityY: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Drag</span>
                    <input type="number" min="0.9" max="1.0" step="0.01" value={settings.drag} onChange={e => updateSettings({ ...settings, drag: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                </div>

                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={settings.nonUniformScale} onChange={e => updateSettings({ ...settings, nonUniformScale: e.target.checked })} className="rounded" />
                  <span className="text-xs text-slate-300">Non-uniform Scale</span>
                </label>

                {settings.nonUniformScale && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Ratio X</span>
                      <input type="number" min="0.1" max="3" step="0.1" value={settings.scaleRatioX} onChange={e => updateSettings({ ...settings, scaleRatioX: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-300">Ratio Y</span>
                      <input type="number" min="0.1" max="3" step="0.1" value={settings.scaleRatioY} onChange={e => updateSettings({ ...settings, scaleRatioY: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                  </div>
                )}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="⚡ Forces & Fields" isOpen={forcesOpen} onToggle={() => setForcesOpen(!forcesOpen)}>
              <div className="space-y-3">
                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-purple-300 mb-2">🌪️ Noise Field</h4>
                  
                  <CurveEditor 
                    label="Noise Strength" 
                    curve={settings.noiseStrengthOverLifetime} 
                    onChange={curve => updateSettings({ ...settings, noiseStrengthOverLifetime: curve })} 
                    min={0} 
                    max={500} 
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Frequency</span>
                      <input 
                        type="number" 
                        min="0.001" 
                        max="0.1" 
                        step="0.001"
                        value={settings.noiseFrequency} 
                        onChange={e => updateSettings({ ...settings, noiseFrequency: Number(e.target.value) })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                      />
                      <span className="text-[10px] text-slate-500">Lower = bigger swirls</span>
                    </label>
                    
                    <label className="block">
                      <span className="text-xs text-slate-300">Speed</span>
                      <input 
                        type="number" 
                        min="0" 
                        max="5" 
                        step="0.1"
                        value={settings.noiseSpeed} 
                        onChange={e => updateSettings({ ...settings, noiseSpeed: Number(e.target.value) })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                      />
                      <span className="text-[10px] text-slate-500">Flow animation speed</span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-pink-300 mb-2">🌀 Vortex Force</h4>
                  
                  <CurveEditor 
                    label="Vortex Strength" 
                    curve={settings.vortexStrengthOverLifetime} 
                    onChange={curve => updateSettings({ ...settings, vortexStrengthOverLifetime: curve })} 
                    min={-1000} 
                    max={1000} 
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Center X</span>
                      <input 
                        type="number" 
                        value={settings.vortexPoint.x} 
                        onChange={e => updateSettings({ 
                          ...settings, 
                          vortexPoint: { ...settings.vortexPoint, x: Number(e.target.value) }
                        })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                      />
                    </label>
                    
                    <label className="block">
                      <span className="text-xs text-slate-300">Center Y</span>
                      <input 
                        type="number" 
                        value={settings.vortexPoint.y} 
                        onChange={e => updateSettings({ 
                          ...settings, 
                          vortexPoint: { ...settings.vortexPoint, y: Number(e.target.value) }
                        })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" 
                      />
                    </label>
                  </div>
                </div>

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-cyan-300 mb-2">🔄 Angular Velocity</h4>
                  
                  <CurveEditor 
                    label="Rotation Speed (deg/sec)" 
                    curve={settings.angularVelocityOverLifetime} 
                    onChange={curve => updateSettings({ ...settings, angularVelocityOverLifetime: curve })} 
                    min={-720} 
                    max={720} 
                  />
                  
                  <p className="text-[10px] text-slate-500 mt-1">
                    Positive = clockwise, Negative = counter-clockwise
                  </p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="📈 Curves Over Lifetime" isOpen={curvesOpen} onToggle={() => setCurvesOpen(!curvesOpen)}>
              <div className="space-y-2">
                <CurveEditor label="Size" curve={settings.sizeOverLifetime} onChange={curve => updateSettings({ ...settings, sizeOverLifetime: curve })} min={0} max={2} />
                <CurveEditor label="Speed" curve={settings.speedOverLifetime} onChange={curve => updateSettings({ ...settings, speedOverLifetime: curve })} min={0} max={2} />
                <CurveEditor label="Weight" curve={settings.weightOverLifetime} onChange={curve => updateSettings({ ...settings, weightOverLifetime: curve })} min={0} max={2} />
                <CurveEditor label="Attraction" curve={settings.attractionOverLifetime} onChange={curve => updateSettings({ ...settings, attractionOverLifetime: curve })} min={-500} max={500} />
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="💾 Export Settings" isOpen={exportOpen} onToggle={() => setExportOpen(!exportOpen)}>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Duration (s)</span>
                    <input type="number" step="0.1" value={settings.duration} onChange={e => updateSettings({ ...settings, duration: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">FPS</span>
                    <select value={settings.fps} onChange={e => updateSettings({ ...settings, fps: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs">
                      <option value="24">24</option>
                      <option value="30">30</option>
                      <option value="60">60</option>
                    </select>
                  </label>
                </div>
                <div className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded">
                  Total Frames: {Math.ceil(settings.duration * settings.fps)}
                </div>
              </div>
            </CollapsibleSection>

            <button onClick={handleReset} className="w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-xs">
              Reset All Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParticleSpineExporter;
