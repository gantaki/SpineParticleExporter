/**
 * Particle → Spine Exporter v94 (Alpha)
 *
 * Version: 94
 * Date: 2025-11-25
 *
 * Major Changes in v94:
 * - Fixed bone collection to exclude prewarm-inherited particles
 * - Now collects particle IDs only from second half of loop animation
 * - This ensures only "pure" loop particles get bones, avoiding duplication
 * - Fixes issue where loop animation had double the expected animated bones
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';

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

interface RangeValue {
  min: number;
  max: number;
}

interface ColorPoint {
  time: number;
  color: Color;
}

interface ColorGradient {
  points: ColorPoint[];
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
  rate: number;
  maxParticles: number;
  
  emissionType: 'continuous' | 'burst' | 'duration';
  burstCount: number;
  burstCycles: number;
  burstInterval: number;
  durationStart: number;
  durationEnd: number;
  
  looping: boolean;
  prewarm: boolean;
  startDelay: number;
}

interface ExportSettings {
  exportTranslate: boolean;
  exportRotate: boolean;
  exportScale: boolean;
  exportColor: boolean;

  positionThreshold: number;
  rotationThreshold: number;
  scaleThreshold: number;
  colorThreshold: number;
}

interface ParticleSettings {
  emitter: EmitterSettings;
  lifeTimeMin: number;
  lifeTimeMax: number;

  gravityOverLifetime: Curve;
  gravityRange: RangeValue;
  dragOverLifetime: Curve;
  dragRange: RangeValue;

  sizeXOverLifetime: Curve;
  sizeXRange: RangeValue;
  sizeYOverLifetime: Curve;
  sizeYRange: RangeValue;
  initialSpeedRange: RangeValue;
  speedOverLifetime: Curve;
  speedRange: RangeValue;
  weightOverLifetime: Curve;
  weightRange: RangeValue;
  spinOverLifetime: Curve;
  spinRange: RangeValue;
  attractionOverLifetime: Curve;
  attractionRange: RangeValue;

  noiseStrengthOverLifetime: Curve;
  noiseStrengthRange: RangeValue;
  noiseFrequencyRange: RangeValue;
  noiseSpeedRange: RangeValue;

  angularVelocityOverLifetime: Curve;
  angularVelocityRange: RangeValue;

  vortexStrengthOverLifetime: Curve;
  vortexStrengthRange: RangeValue;
  vortexPoint: Vec2;
  showVortexVisualization: boolean;
  scaleRatioX: number;
  scaleRatioY: number;

  colorOverLifetime: ColorGradient;

  duration: number;
  fps: number;
  frameSize: number;

  attractionPoint: Vec2;

  particleSprite: 'circle' | 'star' | 'polygon' | 'glow' | 'custom';
  customSpriteData: string | null;

  spawnAngleMode: 'alignMotion' | 'specific' | 'random' | 'range';
  spawnAngle: number;
  spawnAngleMin: number;
  spawnAngleMax: number;

  exportSettings: ExportSettings;
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
  baseSpinRate: number;
  baseAngularVelocity: number;
  baseGravity: number;
  baseDrag: number;
  baseNoiseStrength: number;
  baseNoiseFrequency: number;
  baseNoiseSpeed: number;
  baseAttraction: number;
  baseVortexStrength: number;
  baseSpeedScale: number;
  baseWeight: number;
  baseSizeX: number;
  baseSizeY: number;
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

const DEFAULT_CURVE_PRESETS: { [key: string]: Curve } = {
  sizeX: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 0.2 }], interpolation: 'linear' },
  sizeY: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 0.2 }], interpolation: 'linear' },
  speed: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 1.0 }], interpolation: 'linear' },
  weight: { points: [{ time: 0, value: 1.0 }, { time: 1, value: 1.0 }], interpolation: 'linear' },
  spin: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  attraction: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  noise: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  angularVelocity: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  vortex: { points: [{ time: 0, value: 0 }, { time: 1, value: 0 }], interpolation: 'linear' },
  gravity: { points: [{ time: 0, value: 1 }, { time: 1, value: 1 }], interpolation: 'linear' },
  drag: { points: [{ time: 0, value: 1 }, { time: 1, value: 1 }], interpolation: 'linear' },
};

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
    rate: 10,
    maxParticles: 500,
    
    emissionType: 'continuous',
    burstCount: 50,
    burstCycles: 1,
    burstInterval: 0.5,
    durationStart: 0,
    durationEnd: 2,
    
    looping: true,
    prewarm: false,
    startDelay: 0,
  },
  lifeTimeMin: 0.5,
  lifeTimeMax: 1.5,

  gravityOverLifetime: DEFAULT_CURVE_PRESETS.gravity,
  gravityRange: { min: 0, max: 0 },
  dragOverLifetime: DEFAULT_CURVE_PRESETS.drag,
  dragRange: { min: 0.98, max: 0.98 },

  sizeXOverLifetime: DEFAULT_CURVE_PRESETS.sizeX,
  sizeXRange: { min: 1, max: 1 },
  sizeYOverLifetime: DEFAULT_CURVE_PRESETS.sizeY,
  sizeYRange: { min: 1, max: 1 },
  initialSpeedRange: { min: 100, max: 200 },
  speedOverLifetime: DEFAULT_CURVE_PRESETS.speed,
  speedRange: { min: 1, max: 1 },
  weightOverLifetime: DEFAULT_CURVE_PRESETS.weight,
  weightRange: { min: 1, max: 1 },
  spinOverLifetime: DEFAULT_CURVE_PRESETS.spin,
  spinRange: { min: 0, max: 0 },
  attractionOverLifetime: DEFAULT_CURVE_PRESETS.attraction,
  attractionRange: { min: 0, max: 0 },

  noiseStrengthOverLifetime: DEFAULT_CURVE_PRESETS.noise,
  noiseStrengthRange: { min: 0, max: 0 },
  noiseFrequencyRange: { min: 0.02, max: 0.08 },
  noiseSpeedRange: { min: 2.0, max: 4.0 },

  angularVelocityOverLifetime: DEFAULT_CURVE_PRESETS.angularVelocity,
  angularVelocityRange: { min: 0, max: 0 },

  vortexStrengthOverLifetime: DEFAULT_CURVE_PRESETS.vortex,
  vortexStrengthRange: { min: 0, max: 0 },
  vortexPoint: { x: 256, y: 256 },
  showVortexVisualization: false,
  scaleRatioX: 1.0,
  scaleRatioY: 1.0,
  
  colorOverLifetime: {
    points: [
      { time: 0, color: { r: 255, g: 255, b: 255, a: 255 } },
      { time: 1, color: { r: 255, g: 255, b: 255, a: 0 } }
    ]
  },
  
  duration: 2.0,
  fps: 30,
  frameSize: 512,
  
  attractionPoint: { x: 256, y: 256 },
  
  particleSprite: 'circle',
  customSpriteData: null,

  spawnAngleMode: 'alignMotion',
  spawnAngle: 0,
  spawnAngleMin: -45,
  spawnAngleMax: 45,

  exportSettings: {
    exportTranslate: true,
    exportRotate: true,
    exportScale: true,
    exportColor: true,

    positionThreshold: 12.0,
    rotationThreshold: 20.0,
    scaleThreshold: 0.2,
    colorThreshold: 100,
  },
};

function simpleNoise(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function noise2D(x: number, y: number, time: number): Vec2 {
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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sampleRange(range: RangeValue): number {
  return range.min + Math.random() * (range.max - range.min);
}

function copyCurve(curve: Curve): Curve {
  return {
    interpolation: curve.interpolation,
    points: curve.points.map(p => ({ time: p.time, value: p.value }))
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

function evaluateColorGradient(gradient: ColorGradient, t: number): Color {
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

const ColorPicker: React.FC<{
  color: Color;
  onChange: (color: Color) => void;
}> = ({ color, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d')!;
    const width = canvas.width;
    const height = canvas.height;
    
    for (let y = 0; y < height; y++) {
      const saturation = 100;
      const lightness = (1 - y / height) * 100;
      
      const gradient = ctx.createLinearGradient(0, y, width, y);
      for (let x = 0; x <= width; x++) {
        const hue = (x / width) * 360;
        gradient.addColorStop(x / width, `hsl(${hue}, ${saturation}%, ${lightness}%)`);
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, y, width, 1);
    }
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const hue = (x / rect.width) * 360;
    const lightness = (1 - y / rect.height) * 100;
    const saturation = 100;
    
    const rgb = hslToRgb(hue, saturation, lightness);
    onChange({ ...rgb, a: color.a });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    handleCanvasClick(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      handleCanvasClick(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={200}
        height={150}
        className="w-full rounded border border-slate-600 cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="flex items-center gap-2">
        <div 
          className="w-8 h-8 rounded border-2 border-white flex-shrink-0"
          style={{ backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})` }}
        />
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[10px] text-slate-400 w-12">Alpha:</span>
            <input
              type="range"
             
              max="255"
              value={color.a}
              onChange={e => onChange({ ...color, a: parseInt(e.target.value) })}
              className="flex-1"
            />
            <span className="text-[10px] text-slate-400 w-8 text-right">{color.a}</span>
          </div>
          <div className="text-[10px] font-mono text-slate-400">
            RGB({color.r}, {color.g}, {color.b})
          </div>
        </div>
      </div>
    </div>
  );
};

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
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

const ColorGradientEditor: React.FC<{
  gradient: ColorGradient;
  onChange: (gradient: ColorGradient) => void;
}> = ({ gradient, onChange }) => {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(260);

  useEffect(() => {
    const measureWidth = () => {
      if (containerRef.current) {
        // Reduce width by 20px to prevent overflow
        setWidth(Math.max(260, containerRef.current.clientWidth - 20));
      }
    };

    // Immediate measurement
    measureWidth();

    // Delayed measurement to handle collapsible section animation
    const timeoutId = setTimeout(measureWidth, 10);

    window.addEventListener('resize', measureWidth);
    return () => {
      window.removeEventListener('resize', measureWidth);
      clearTimeout(timeoutId);
    };
  }, []);

  const height = 50;
  const padding = 8;
  const graphWidth = width - padding * 2;

  const timeToX = (time: number) => padding + time * graphWidth;
  const xToTime = (x: number) => Math.max(0, Math.min(1, (x - padding) / graphWidth));

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) return;
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;

    const clickedPoint = gradient.points.findIndex(p => {
      const px = timeToX(p.time);
      const distance = Math.abs(x - px);
      return distance < 8;
    });

    if (clickedPoint !== -1) {
      setSelectedPoint(clickedPoint);
      setShowColorPicker(true);
      return;
    }

    const newTime = xToTime(x);
    const newColor = evaluateColorGradient(gradient, newTime);

    const newPoints = [...gradient.points, { time: newTime, color: newColor }]
      .sort((a, b) => a.time - b.time);

    onChange({ points: newPoints });
    setSelectedPoint(newPoints.findIndex(p => p.time === newTime));
    setShowColorPicker(true);
  };

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSelectedPoint(index);
    setIsDragging(true);
    setShowColorPicker(true);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || selectedPoint === null) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const newTime = xToTime(x);

    const newPoints = [...gradient.points];
    
    if (selectedPoint === 0) {
      newPoints[selectedPoint] = { ...newPoints[selectedPoint], time: 0 };
    } else if (selectedPoint === newPoints.length - 1) {
      newPoints[selectedPoint] = { ...newPoints[selectedPoint], time: 1 };
    } else {
      newPoints[selectedPoint] = { ...newPoints[selectedPoint], time: newTime };
    }

    onChange({ points: newPoints.sort((a, b) => a.time - b.time) });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDeletePoint = () => {
    if (selectedPoint === null || gradient.points.length <= 2) return;
    
    const newPoints = gradient.points.filter((_, i) => i !== selectedPoint);
    onChange({ points: newPoints });
    setSelectedPoint(null);
    setShowColorPicker(false);
  };

  const handleColorChange = (channel: 'r' | 'g' | 'b' | 'a', value: number) => {
    if (selectedPoint === null) return;
    
    const newPoints = [...gradient.points];
    newPoints[selectedPoint] = {
      ...newPoints[selectedPoint],
      color: { ...newPoints[selectedPoint].color, [channel]: value }
    };
    onChange({ points: newPoints });
  };

  const handleColorPickerChange = (newColor: Color) => {
    if (selectedPoint === null) return;
    
    const newPoints = [...gradient.points];
    newPoints[selectedPoint] = {
      ...newPoints[selectedPoint],
      color: newColor
    };
    onChange({ points: newPoints });
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-300">Color Over Lifetime</label>
        {selectedPoint !== null && gradient.points.length > 2 && (
          <button
            onClick={handleDeletePoint}
            className="p-0.5 bg-red-600 hover:bg-red-700 rounded"
            title="Delete point"
          >
            <Trash2 size={10} />
          </button>
        )}
      </div>

      <div className="bg-slate-900 rounded border border-slate-700 p-1">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="cursor-crosshair w-full"
          onClick={handleSvgClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <defs>
            <linearGradient id="colorGradient">
              {gradient.points.map((point, i) => (
                <stop
                  key={i}
                  offset={`${point.time * 100}%`}
                  stopColor={`rgba(${point.color.r}, ${point.color.g}, ${point.color.b}, ${point.color.a / 255})`}
                />
              ))}
            </linearGradient>
          </defs>
          
          <rect
            x={padding}
            y={padding}
            width={graphWidth}
            height={height - padding * 2}
            fill="url(#colorGradient)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />

          {gradient.points.map((point, i) => (
            <g key={i}>
              <circle
                cx={timeToX(point.time)}
                cy={height / 2}
                r={selectedPoint === i ? 6 : 5}
                fill={`rgba(${point.color.r}, ${point.color.g}, ${point.color.b}, ${point.color.a / 255})`}
                stroke="white"
                strokeWidth="2"
                className="cursor-move"
                onMouseDown={(e) => handleMouseDown(e, i)}
              />
            </g>
          ))}
        </svg>

        {selectedPoint !== null && (
          <div className="mt-2 space-y-2">
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="w-full px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
            >
              {showColorPicker ? 'Hide' : 'Show'} Color Picker
            </button>

            {showColorPicker && (
              <ColorPicker
                color={gradient.points[selectedPoint].color}
                onChange={handleColorPickerChange}
              />
            )}

            <div className="grid grid-cols-4 gap-1">
              <div>
                <label className="text-[10px] text-slate-400">R</label>
                <input
                  type="number"
                 
                  max="255"
                  value={gradient.points[selectedPoint].color.r}
                  onChange={e => handleColorChange('r', parseInt(e.target.value) || 0)}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">G</label>
                <input
                  type="number"
                 
                  max="255"
                  value={gradient.points[selectedPoint].color.g}
                  onChange={e => handleColorChange('g', parseInt(e.target.value) || 0)}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">B</label>
                <input
                  type="number"
                 
                  max="255"
                  value={gradient.points[selectedPoint].color.b}
                  onChange={e => handleColorChange('b', parseInt(e.target.value) || 0)}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">A</label>
                <input
                  type="number"
                 
                  max="255"
                  value={gradient.points[selectedPoint].color.a}
                  onChange={e => handleColorChange('a', parseInt(e.target.value) || 0)}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] text-slate-400">Time</label>
              <input
                type="number"
               
                max="1"
                step="0.01"
                value={gradient.points[selectedPoint].time.toFixed(2)}
                onChange={e => {
                  const newPoints = [...gradient.points];
                  const newTime = selectedPoint === 0 ? 0 : selectedPoint === newPoints.length - 1 ? 1 : parseFloat(e.target.value);
                  newPoints[selectedPoint] = { ...newPoints[selectedPoint], time: newTime };
                  onChange({ points: newPoints.sort((a, b) => a.time - b.time) });
                }}
                disabled={selectedPoint === 0 || selectedPoint === gradient.points.length - 1}
                className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CurveEditor: React.FC<{
  label: string;
  curve: Curve;
  onChange: (curve: Curve) => void;
  onReset?: () => void;
  min?: number;
  max?: number;
  autoScale?: boolean;
}> = ({ label, curve, onChange, onReset, min = -1, max = 1, autoScale = true }) => {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(260);
  const [viewMin, setViewMin] = useState(min);
  const [viewMax, setViewMax] = useState(max);

  useEffect(() => {
    const measureWidth = () => {
      if (containerRef.current) {
        const nextWidth = Math.max(260, containerRef.current.clientWidth);
        setWidth(nextWidth);
      }
    };

    // Immediate measurement
    measureWidth();

    // Delayed measurement to handle collapsible section animation
    const timeoutId = setTimeout(measureWidth, 10);

    window.addEventListener('resize', measureWidth);
    return () => {
      window.removeEventListener('resize', measureWidth);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!autoScale) {
      setViewMin(min);
      setViewMax(max);
      return;
    }

    const values = curve.points.map(p => p.value);
    const minValue = Math.min(min, ...values);
    const maxValue = Math.max(max, ...values);
    const range = Math.max(maxValue - minValue, 0.01);
    const padding = Math.max(range * 0.1, 0.05);

    setViewMin(minValue - padding);
    setViewMax(maxValue + padding);
  }, [autoScale, curve.points, min, max]);

  const height = 80;
  const padding = 8;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const valueToY = (value: number) => {
    const normalized = viewMax === viewMin ? 0.5 : (value - viewMin) / (viewMax - viewMin);
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
    return viewMin + normalized * (viewMax - viewMin);
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
    const proposed = yToValue(y);
    const newValue = autoScale ? proposed : Math.max(min, Math.min(max, proposed));

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
    <div className="space-y-1" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs text-slate-300">{label}</label>
        <div className="flex items-center gap-1">
          {onReset && (
            <button
              onClick={onReset}
              className="p-0.5 bg-slate-700 hover:bg-slate-600 rounded"
              title="Reset to default"
            >
              <RefreshCw size={10} />
            </button>
          )}
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

          {viewMin < 0 && viewMax > 0 && (
            <line
              x1={padding}
              y1={valueToY(0)}
              x2={width - padding}
              y2={valueToY(0)}
              stroke="rgba(255,200,100,0.4)"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          )}

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
              type="text"
              value={curve.points[selectedPoint].time.toString()}
              onChange={e => {
                const newPoints = [...curve.points];
                const parsed = parseFloat(e.target.value);
                const newTime = selectedPoint === 0 ? 0 : selectedPoint === newPoints.length - 1 ? 1 : parsed;
                if (!Number.isNaN(newTime)) {
                  newPoints[selectedPoint] = { ...newPoints[selectedPoint], time: newTime };
                  onChange({ ...curve, points: newPoints.sort((a, b) => a.time - b.time) });
                }
              }}
              disabled={selectedPoint === 0 || selectedPoint === curve.points.length - 1}
              className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
              placeholder="Time"
            />
            <input
              type="text"
              value={curve.points[selectedPoint].value.toString()}
              onChange={e => {
                const parsed = parseFloat(e.target.value);
                if (!Number.isNaN(parsed)) {
                  const newPoints = [...curve.points];
                  newPoints[selectedPoint] = { ...newPoints[selectedPoint], value: parsed };
                  onChange({ ...curve, points: newPoints });
                }
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

const Timeline: React.FC<{
  currentTime: number;
  duration: number;
  fps: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  onRestart: () => void;
  onSpeedChange: (speed: number) => void;
  onDurationChange: (duration: number) => void;
  onFpsChange: (fps: number) => void;
}> = ({ currentTime, duration, fps, isPlaying, playbackSpeed, onTimeChange, onPlayPause, onRestart, onSpeedChange, onDurationChange, onFpsChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    updateTimeFromMouse(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      updateTimeFromMouse(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateTimeFromMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    onTimeChange(percentage * duration);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-lg p-3 border border-slate-700">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onPlayPause}
          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-semibold"
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        
        <button
          onClick={onRestart}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
        >
          <RotateCcw size={14} />
        </button>
        
        <select
          value={playbackSpeed}
          onChange={e => onSpeedChange(parseFloat(e.target.value))}
          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
        >
          <option value="0.25">0.25x</option>
          <option value="0.5">0.5x</option>
          <option value="1">1x</option>
          <option value="2">2x</option>
          <option value="4">4x</option>
        </select>

        <div className="flex-1 text-center text-xs font-mono text-slate-300">
          {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
        </div>
        
        <input
          type="number"
         
          max="10"
          step="0.1"
          value={duration}
          onChange={e => onDurationChange(Number(e.target.value))}
          className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-600 rounded text-xs"
          title="Duration"
        />
        <span className="text-xs text-slate-400">s</span>
        
        <select
          value={fps}
          onChange={e => onFpsChange(Number(e.target.value))}
          className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
          title="FPS"
        >
          <option value="24">24fps</option>
          <option value="30">30fps</option>
          <option value="60">60fps</option>
        </select>
      </div>

      <div
        ref={timelineRef}
        className="relative h-8 bg-slate-900 rounded cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Progress bar */}
        <div
          className="absolute top-0 left-0 h-full bg-purple-600/30 rounded"
          style={{ width: `${progress}%` }}
        />

        {/* Time markers */}
        <div className="absolute inset-0 flex items-center px-2">
          {[0, 0.25, 0.5, 0.75, 1].map(t => (
            <div
              key={t}
              className="absolute w-px h-full bg-slate-600"
              style={{ left: `${t * 100}%` }}
            />
          ))}
        </div>

        {/* Current time indicator */}
        <div
          className="absolute top-0 w-1 h-full bg-purple-400 shadow-lg"
          style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-purple-400 rounded-full border-2 border-white" />
        </div>

        {/* Time labels */}
        <div className="absolute -bottom-5 left-0 text-[9px] text-slate-500">0s</div>
        <div className="absolute -bottom-5 right-0 text-[9px] text-slate-500">{duration.toFixed(1)}s</div>
      </div>
    </div>
  );
};

const RangeInput: React.FC<{
  label: string;
  range: RangeValue;
  onChange: (range: RangeValue) => void;
  helper?: string;
}> = ({ label, range, onChange, helper }) => {
  const handleChange = (key: 'min' | 'max') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    onChange({ ...range, [key]: Number.isNaN(value) ? range[key] : value });
  };

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        {helper && <span className="text-[10px] text-slate-500">{helper}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <input
          type="number"
          value={range.min}
          onChange={handleChange('min')}
          className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
          placeholder="Min"
        />
        <input
          type="number"
          value={range.max}
          onChange={handleChange('max')}
          className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
          placeholder="Max"
        />
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

function createParticleSprite(type: 'circle' | 'star' | 'polygon' | 'glow', size: number = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const center = size / 2;
  
  ctx.clearRect(0, 0, size, size);
  
  if (type === 'circle') {
    const radius = size / 2 - 2;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'glow') {
    const radius = size / 2 - 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'star') {
    const outerRadius = size / 2 - 2;
    const innerRadius = outerRadius * 0.5;
    const spikes = 5;
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fill();
  } else if (type === 'polygon') {
    const radius = size / 2 - 2;
    const sides = 6;
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fill();
  }
  
  return canvas;
}

function createParticleAtlas(spriteCanvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; region: AtlasRegion } {
  const atlasSize = 128;
  const spriteSize = 64;
  
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d')!;
  
  // Draw sprite centered in the atlas
  const offsetX = (atlasSize - spriteSize) / 2;
  const offsetY = (atlasSize - spriteSize) / 2;
  ctx.drawImage(spriteCanvas, offsetX, offsetY, spriteSize, spriteSize);
  
  const region: AtlasRegion = {
    name: 'particle',
    x: offsetX,
    y: offsetY,
    width: spriteSize,
    height: spriteSize,
    atlasIndex: 0
  };
  
  return { canvas, region };
}

function bakeParticleAnimation(settings: ParticleSettings): { frames: BakedFrame[]; prewarmFrames: BakedFrame[] } {
  const frames: BakedFrame[] = [];
  const prewarmBakedFrames: BakedFrame[] = [];
  const system = new ParticleSystem(settings);

  const dt = 1 / settings.fps;

  // Store prewarm animation frames for loop
  const prewarmFrameMap: Map<number, Map<number, any>> = new Map();

  // Apply prewarm if enabled and capture full animation
  if (settings.emitter.prewarm && settings.emitter.looping) {
    const prewarmSteps = Math.ceil(settings.duration * settings.fps);

    // Simulate prewarm and capture every frame
    for (let i = 0; i < prewarmSteps; i++) {
      system.update(dt, true); // skipTimeReset = true during prewarm

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
          color: { ...p.color },
          life: p.life,
          maxLife: p.maxLife
        });
      }
      prewarmFrameMap.set(i, particlesSnapshot);
      prewarmBakedFrames.push({ time: i * dt, particles: particlesSnapshot });
    }

    // Reset time but keep particles for main simulation
    system.time = settings.emitter.startDelay;
    system.hasPrewarmed = true;
  }

  const duration = settings.duration;
  const frameCount = Math.ceil(duration * settings.fps);

  // For looping: simulate extra time to capture wrap-around particles
  const isLooping = settings.emitter.looping;
  const extraTime = isLooping ? settings.lifeTimeMax : 0;
  const totalSimTime = duration + extraTime;
  const totalFrameCount = Math.ceil(totalSimTime * settings.fps);

  // Store all simulated frames including extra ones
  const allFrames: Map<number, Map<number, any>> = new Map();
  
  for (let i = 0; i < totalFrameCount; i++) {
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
        color: { ...p.color },
        life: p.life,
        maxLife: p.maxLife
      });
    }
    
    allFrames.set(i, particlesSnapshot);
  }
  
  // Build final frames
  for (let i = 0; i < frameCount; i++) {
    const time = i * dt;
    const currentFrame = allFrames.get(i) || new Map();
    const particlesSnapshot = new Map<number, any>(currentFrame);

    // Add prewarm particles (for looping animations)
    if (isLooping && prewarmFrameMap.size > 0) {
      // Get prewarm frame for current position
      const prewarmFrame = prewarmFrameMap.get(i);

      if (prewarmFrame) {
        for (const [id, particleData] of prewarmFrame) {
          // Add prewarm particle if not already present in simulation
          if (!currentFrame.has(id)) {
            particlesSnapshot.set(id, particleData);
          }
        }
      }

      // Also add prewarm particles at the END for smooth loop transition
      // Calculate which prewarm frame corresponds to the end of cycle
      const framesFromEnd = frameCount - i - 1;
      if (framesFromEnd >= 0 && framesFromEnd < prewarmFrameMap.size) {
        const endPrewarmFrame = prewarmFrameMap.get(prewarmFrameMap.size - 1 - framesFromEnd);

        if (endPrewarmFrame) {
          for (const [id, particleData] of endPrewarmFrame) {
            // Add prewarm particle at end if not already present
            if (!particlesSnapshot.has(id)) {
              particlesSnapshot.set(id, particleData);
            }
          }
        }
      }
    }

    // If looping, add wrap-around particles from the end
    if (isLooping) {
      const wrapFrameIndex = frameCount + i;
      const wrapFrame = allFrames.get(wrapFrameIndex);

      if (wrapFrame) {
        for (const [id, particleData] of wrapFrame) {
          // Check if this particle is from wrap-around (not present in current frame)
          if (!currentFrame.has(id)) {
            // Calculate how much life the particle should have lost
            const timeIntoWrap = i * dt;
            const adjustedLife = particleData.life - timeIntoWrap;

            // Only add if particle is still alive
            if (adjustedLife > 0) {
              particlesSnapshot.set(id, {
                ...particleData,
                life: adjustedLife
              });
            }
          }
        }
      }
    }

    frames.push({ time, particles: particlesSnapshot });
  }

  return { frames, prewarmFrames: prewarmBakedFrames };
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

function generateAtlasFile(atlasCanvas: HTMLCanvasElement, region: AtlasRegion): string {
  let atlasText = '';
  
  atlasText += `particle.png\n`;
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
  // Particle is visible based only on alpha
  // Alpha >= 1/255 (0.00392 in normalized form, 1 out of 255 in Spine color range)
  const MIN_ALPHA = 1 / 255;
  return particle && particle.alpha >= MIN_ALPHA;
}

function generateSpineJSON(frames: BakedFrame[], prewarmFrames: BakedFrame[], settings: ParticleSettings): string {
  const allParticleIds = new Set<number>();

  // Collect particle IDs only from second half of loop animation
  // This avoids including particles inherited from prewarm period
  // which would double the number of bones needed for a clean loop
  const startFrameIndex = Math.floor(frames.length / 2);
  for (let i = startFrameIndex; i < frames.length; i++) {
    const frame = frames[i];
    for (const [id, _] of frame.particles) {
      allParticleIds.add(id);
    }
  }

  const particleIds = Array.from(allParticleIds).sort((a, b) => a - b);

  const skeleton = { hash: "particle_export", spine: "4.2.00", x: 0, y: 0, width: settings.frameSize, height: settings.frameSize };

  const bones: any[] = [
    { name: "root" },
    { name: "ALL_PARTICLES", parent: "root" }
  ];

  for (const id of particleIds) {
    bones.push({ name: `particle_${id}`, parent: "ALL_PARTICLES" });
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

  const animations: any = {};

  const POSITION_THRESHOLD = settings.exportSettings.positionThreshold;
  const ROTATION_THRESHOLD = settings.exportSettings.rotationThreshold;
  const SCALE_THRESHOLD = settings.exportSettings.scaleThreshold;
  const COLOR_THRESHOLD = settings.exportSettings.colorThreshold;

  const addAnimation = (animationName: string, sourceFrames: BakedFrame[]) => {
    if (sourceFrames.length === 0) return null;

    const animationData: any = { bones: {}, slots: {} };

    for (const particleId of particleIds) {
      const boneName = `particle_${particleId}`;
      const slotName = `particle_slot_${particleId}`;

      const translateKeys: any[] = [];
      const rotateKeys: any[] = [];
      const scaleKeys: any[] = [];
      const attachmentKeys: any[] = [];
      const colorKeys: any[] = [];

      const allAngles: number[] = [];
      for (const frame of sourceFrames) {
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
      let prevColor: { r: number; g: number; b: number; a: number } | null = null;
      let wasVisible = false;
      let hasAppeared = false;
      let normalizedAngle = 0;

      for (let frameIdx = 0; frameIdx < sourceFrames.length; frameIdx++) {
        const frame = sourceFrames[frameIdx];
        const particle = frame.particles.get(particleId);
        const isVisible = particle && isParticleVisible(particle);
        const isFirstFrame = frameIdx === 0;
        const isLastFrame = frameIdx === sourceFrames.length - 1;

        const visibilityChanged = wasVisible !== isVisible;

        if (particle && isVisible) {
          // Add attachment key when particle becomes visible (first time or re-appearing)
          if (!hasAppeared || (visibilityChanged && !wasVisible)) {
            hasAppeared = true;
            const time = Math.round(frame.time * 1000) / 1000;
            attachmentKeys.push({ time, name: "particle" });
          }

          const currentPos = { x: particle.x, y: particle.y };
          const currentScale = { x: particle.scaleX, y: particle.scaleY };
          const currentColor = {
            r: particle.color.r / 255,
            g: particle.color.g / 255,
            b: particle.color.b / 255,
            a: particle.alpha
          };

          if (prevRotation !== null) {
            normalizedAngle = normalizeAngle(smoothedAngles[frameIdx], normalizedAngle);
          } else {
            normalizedAngle = smoothedAngles[frameIdx];
          }

          const movementVector = prevPos ? { x: currentPos.x - prevPos.x, y: currentPos.y - prevPos.y } : null;
          const movementDistance = movementVector ? Math.sqrt(movementVector.x * movementVector.x + movementVector.y * movementVector.y) : 0;
          const shouldWriteTranslate = settings.exportSettings.exportTranslate && (isFirstFrame || isLastFrame || visibilityChanged || prevPos === null ||
            movementDistance > POSITION_THRESHOLD);

          if (shouldWriteTranslate) {
            translateKeys.push({ time: Math.round(frame.time * 1000) / 1000, x: Math.round(currentPos.x * 100) / 100, y: Math.round(-currentPos.y * 100) / 100 });
            prevPos = currentPos;
          }

          const rotationDelta = prevRotation !== null ? normalizedAngle - prevRotation : 0;
          const shouldWriteRotate = settings.exportSettings.exportRotate && (
            isFirstFrame || isLastFrame || visibilityChanged || prevRotation === null ||
            Math.abs(rotationDelta) > ROTATION_THRESHOLD
          );

          if (shouldWriteRotate) {
            rotateKeys.push({ time: Math.round(frame.time * 1000) / 1000, angle: Math.round(normalizedAngle * 100) / 100 });
            prevRotation = normalizedAngle;
          }

          if (settings.exportSettings.exportScale && (isFirstFrame || isLastFrame || visibilityChanged || prevScale === null ||
              Math.abs(currentScale.x - prevScale.x) > SCALE_THRESHOLD || Math.abs(currentScale.y - prevScale.y) > SCALE_THRESHOLD)) {
            scaleKeys.push({
              time: Math.round(frame.time * 1000) / 1000,
              x: Math.round(currentScale.x * 1000) / 1000,
              y: Math.round(currentScale.y * 1000) / 1000
            });
            prevScale = currentScale;
          }

          // Add color keyframe if color changed significantly
          if (settings.exportSettings.exportColor) {
            const colorDeltaSum = prevColor === null ? Number.POSITIVE_INFINITY :
              Math.abs((currentColor.r - prevColor.r) * 255) +
              Math.abs((currentColor.g - prevColor.g) * 255) +
              Math.abs((currentColor.b - prevColor.b) * 255) +
              Math.abs((currentColor.a - prevColor.a) * 255);

            const colorChanged = prevColor === null || colorDeltaSum > COLOR_THRESHOLD;

            if (isFirstFrame || isLastFrame || visibilityChanged || colorChanged) {
              // Spine color format: hex string "rrggbbaa"
              const rHex = Math.round(currentColor.r * 255).toString(16).padStart(2, '0');
              const gHex = Math.round(currentColor.g * 255).toString(16).padStart(2, '0');
              const bHex = Math.round(currentColor.b * 255).toString(16).padStart(2, '0');
              const aHex = Math.round(currentColor.a * 255).toString(16).padStart(2, '0');
              const colorHex = `${rHex}${gHex}${bHex}${aHex}`;

              colorKeys.push({
                time: Math.round(frame.time * 1000) / 1000,
                color: colorHex
              });
              prevColor = currentColor;
            }
          }

          wasVisible = true;
        } else {
          if (wasVisible && visibilityChanged) {
            const time = Math.round(frame.time * 1000) / 1000;
            attachmentKeys.push({ time, name: null });
          }

          if (visibilityChanged && wasVisible) {
            const time = Math.round(frame.time * 1000) / 1000;
            if (settings.exportSettings.exportTranslate && prevPos) translateKeys.push({ time, x: Math.round(prevPos.x * 100) / 100, y: Math.round(-prevPos.y * 100) / 100 });
            if (settings.exportSettings.exportRotate && prevRotation !== null) rotateKeys.push({ time, angle: Math.round(prevRotation * 100) / 100 });
            if (settings.exportSettings.exportScale && prevScale !== null) scaleKeys.push({ time, x: 0, y: 0 });
          }

          wasVisible = false;
        }
      }

      if (hasAppeared) {
        const boneAnimation: any = {};
        if (settings.exportSettings.exportTranslate && translateKeys.length > 0) {
          boneAnimation.translate = translateKeys;
        }
        if (settings.exportSettings.exportRotate && rotateKeys.length > 0) {
          boneAnimation.rotate = rotateKeys;
        }
        if (settings.exportSettings.exportScale && scaleKeys.length > 0) {
          boneAnimation.scale = scaleKeys;
        }

        if (Object.keys(boneAnimation).length > 0) {
          animationData.bones[boneName] = boneAnimation;
        }

        const slotAnimation: any = {};
        if (attachmentKeys.length > 0) {
          slotAnimation.attachment = attachmentKeys;
        }
        if (settings.exportSettings.exportColor && colorKeys.length > 0) {
          slotAnimation.rgba = colorKeys;
        }

        if (Object.keys(slotAnimation).length > 0) {
          animationData.slots[slotName] = slotAnimation;
        }
      }
    }

    if (Object.keys(animationData.bones).length > 0 || Object.keys(animationData.slots).length > 0) {
      return animationData;
    }
    return null;
  };

  // Generate loop animation first
  const loopAnimation = addAnimation('particle_anim', frames);
  if (loopAnimation) {
    animations['particle_anim'] = loopAnimation;
  }

  // Generate prewarm animation
  const prewarmAnimation = addAnimation('prewarm', prewarmFrames);

  // If both animations exist and we have frames, copy last frame data from loop to prewarm
  if (prewarmAnimation && loopAnimation && frames.length > 0 && prewarmFrames.length > 0) {
    // Get last frame of loop animation
    const lastLoopFrame = frames[frames.length - 1];
    const prewarmDuration = prewarmFrames[prewarmFrames.length - 1].time;

    // Find all visible particles in the last loop frame
    const visibleParticleIds: number[] = [];
    for (const [particleId, particleData] of lastLoopFrame.particles) {
      if (isParticleVisible(particleData)) {
        visibleParticleIds.push(particleId);
      }
    }

    // For each visible particle, copy its animation keys from loop to end of prewarm
    // ONLY if the bone/slot already exists in prewarm (don't create new ones)
    for (const particleId of visibleParticleIds) {
      const boneName = `particle_${particleId}`;
      const slotName = `particle_slot_${particleId}`;

      // Copy bone animations (translate, rotate, scale) ONLY if bone already exists in prewarm
      if (loopAnimation.bones[boneName] && prewarmAnimation.bones[boneName]) {
        const loopBone = loopAnimation.bones[boneName];
        const prewarmBone = prewarmAnimation.bones[boneName];

        // Copy translate keys
        if (loopBone.translate && loopBone.translate.length > 0) {
          if (!prewarmBone.translate) {
            prewarmBone.translate = [];
          }
          // Add all translate keys from loop to end of prewarm
          for (const key of loopBone.translate) {
            prewarmBone.translate.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              x: key.x,
              y: key.y
            });
          }
        }

        // Copy rotate keys
        if (loopBone.rotate && loopBone.rotate.length > 0) {
          if (!prewarmBone.rotate) {
            prewarmBone.rotate = [];
          }
          for (const key of loopBone.rotate) {
            prewarmBone.rotate.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              angle: key.angle
            });
          }
        }

        // Copy scale keys
        if (loopBone.scale && loopBone.scale.length > 0) {
          if (!prewarmBone.scale) {
            prewarmBone.scale = [];
          }
          for (const key of loopBone.scale) {
            prewarmBone.scale.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              x: key.x,
              y: key.y
            });
          }
        }
      }

      // Copy slot animations (attachment, rgba) ONLY if slot already exists in prewarm
      if (loopAnimation.slots[slotName] && prewarmAnimation.slots[slotName]) {
        const loopSlot = loopAnimation.slots[slotName];
        const prewarmSlot = prewarmAnimation.slots[slotName];

        // Copy attachment keys
        if (loopSlot.attachment && loopSlot.attachment.length > 0) {
          if (!prewarmSlot.attachment) {
            prewarmSlot.attachment = [];
          }
          for (const key of loopSlot.attachment) {
            prewarmSlot.attachment.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              name: key.name
            });
          }
        }

        // Copy rgba/color keys
        if (loopSlot.rgba && loopSlot.rgba.length > 0) {
          if (!prewarmSlot.rgba) {
            prewarmSlot.rgba = [];
          }
          for (const key of loopSlot.rgba) {
            prewarmSlot.rgba.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              color: key.color
            });
          }
        }
      }
    }

    animations['prewarm'] = prewarmAnimation;
  } else if (prewarmAnimation) {
    animations['prewarm'] = prewarmAnimation;
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
  const [showGrid, setShowGrid] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [spriteStatus, setSpriteStatus] = useState<string | null>(null);
  const [liveParticleCount, setLiveParticleCount] = useState(0);
  const [zoom, setZoom] = useState(1.0);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [bgPosition, setBgPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [spriteCanvas, setSpriteCanvas] = useState<HTMLCanvasElement | null>(null);
  
  // Timeline state
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [bakedSimulation, setBakedSimulation] = useState<BakedFrame[] | null>(null);
  const [needsRebake, setNeedsRebake] = useState(true);
  
  const [emitterOpen, setEmitterOpen] = useState(true);
  const [particleOpen, setParticleOpen] = useState(true);
  const [forcesOpen, setForcesOpen] = useState(true);
  const [curvesOpen, setCurvesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemRef = useRef<ParticleSystem | null>(null);
  const animationRef = useRef<number>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const lastFrameTimeRef = useRef<number>(0);

  useEffect(() => {
    systemRef.current = new ParticleSystem(settings);
    updateSpriteCanvas(settings.particleSprite, settings.customSpriteData);
  }, []);

  const bakeSimulation = useCallback(() => {
    if (!systemRef.current) return [];
    
    const system = systemRef.current;
    system.reset();
    
    const dt = 1 / 60;
    const frameCount = Math.ceil(settings.duration / dt);
    const frames: BakedFrame[] = [];
    
    for (let i = 0; i <= frameCount; i++) {
      const time = i * dt;
      const particlesSnapshot = new Map<number, any>();
      
      for (const p of system.particles) {
        particlesSnapshot.set(p.id, {
          x: p.x,
          y: p.y,
          vx: p.vx,
          vy: p.vy,
          rotation: p.rotation,
          scale: p.scale,
          scaleX: p.scaleX,
          scaleY: p.scaleY,
          alpha: p.alpha,
          color: { ...p.color },
          life: p.life,
          maxLife: p.maxLife,
          baseSpeed: p.baseSpeed
        });
      }
      
      frames.push({ time, particles: particlesSnapshot });
      
      if (i < frameCount) {
        system.update(dt);
      }
    }
    
    return frames;
  }, [settings.duration]);

  const renderBakedFrame = useCallback((targetTime: number) => {
    if (!bakedSimulation || !canvasRef.current || !systemRef.current) return;
    
    const dt = 1 / 60;
    const frameIndex = Math.floor(targetTime / dt);
    const clampedIndex = Math.max(0, Math.min(frameIndex, bakedSimulation.length - 1));
    const frame = bakedSimulation[clampedIndex];
    
    if (!frame) return;
    
    // Restore particles from baked frame
    systemRef.current.particles = [];
    systemRef.current.time = targetTime;
    
    for (const [id, data] of frame.particles) {
      systemRef.current.particles.push({
        id,
        x: data.x,
        y: data.y,
        vx: data.vx,
        vy: data.vy,
        rotation: data.rotation,
        scale: data.scale,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        alpha: data.alpha,
        color: data.color,
        life: data.life,
        maxLife: data.maxLife,
        baseSpeed: data.baseSpeed
      });
    }
    
    const ctx = canvasRef.current.getContext('2d')!;
    systemRef.current.render(ctx, showEmitter, zoom, spriteCanvas, showGrid, backgroundImage, bgPosition);
    setLiveParticleCount(systemRef.current.particles.length);
  }, [bakedSimulation, showEmitter, zoom, spriteCanvas, showGrid, backgroundImage, bgPosition]);

  const handleTimelineTimeChange = useCallback((newTime: number) => {
    setCurrentTime(newTime);
    setIsPlaying(false);
    
    if (!bakedSimulation || needsRebake) {
      const newBake = bakeSimulation();
      setBakedSimulation(newBake);
      setNeedsRebake(false);
    }
    
    renderBakedFrame(newTime);
  }, [bakedSimulation, needsRebake, bakeSimulation, renderBakedFrame]);

  const handlePlayPause = useCallback(() => {
    if (!isPlaying && (needsRebake || !bakedSimulation)) {
      const newBake = bakeSimulation();
      setBakedSimulation(newBake);
      setNeedsRebake(false);
    }
    setIsPlaying(prev => !prev);
  }, [isPlaying, needsRebake, bakedSimulation, bakeSimulation]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  useEffect(() => {
    systemRef.current = new ParticleSystem(settings);
    updateSpriteCanvas(settings.particleSprite, settings.customSpriteData);
  }, []);

  const updateSpriteCanvas = (type: string, customData: string | null) => {
    if (type === 'custom') {
      if (customData) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, 64, 64);
          setSpriteCanvas(canvas);
          setSpriteStatus('Custom sprite loaded successfully');
        };
        img.onerror = () => setSpriteStatus('Unable to load the selected sprite image');
        img.src = customData;
      } else {
        setSpriteCanvas(null);
      }
    } else {
      const canvas = createParticleSprite(type as any, 64);
      setSpriteCanvas(canvas);
      setSpriteStatus(null);
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !systemRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const realDt = (time - lastTime) / 1000;
      lastTime = time;

      if (isPlaying && systemRef.current) {
        const dt = Math.min(realDt * playbackSpeed, 0.1);
        systemRef.current.update(dt);
        
        // Update timeline
        const newTime = systemRef.current.time;
        setCurrentTime(newTime);

        systemRef.current.render(ctx, showEmitter, zoom, spriteCanvas, showGrid, backgroundImage, bgPosition);
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
  }, [isPlaying, showEmitter, zoom, spriteCanvas, showGrid, backgroundImage, bgPosition, playbackSpeed]);

  const updateSettings = useCallback((newSettings: ParticleSettings) => {
    setSettings(newSettings);
    if (systemRef.current) {
      systemRef.current.settings = newSettings;
    }
    setNeedsRebake(true);
    setBakedSimulation(null);
  }, []);

  const handleRestart = () => {
    if (systemRef.current) {
      systemRef.current.reset();
      setCurrentTime(0);
      setNeedsRebake(true);
      setBakedSimulation(null);
      
      // Render initial state
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        systemRef.current.render(ctx, showEmitter, zoom, spriteCanvas, showGrid, backgroundImage, bgPosition);
        setLiveParticleCount(systemRef.current.particles.length);
      }
    }
  };

  const handleReset = () => {
    updateSettings(DEFAULT_SETTINGS);
    handleRestart();
    updateSpriteCanvas(DEFAULT_SETTINGS.particleSprite, null);
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

  const handleSpriteUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSpriteStatus(`Loading ${file.name}...`);
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          updateSettings({ ...settings, particleSprite: 'custom', customSpriteData: data });
          updateSpriteCanvas('custom', data);
        };
        img.onerror = () => setSpriteStatus('Failed to decode the selected sprite image.');
        img.src = data;
      };
      reader.onerror = () => setSpriteStatus('Failed to read the selected sprite file.');
      reader.readAsDataURL(file);
      e.target.value = '';
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
    setExportStatus('🔄 Baking...');
    setIsPlaying(false);
    
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const { frames, prewarmFrames } = bakeParticleAnimation(settings);
      const uniqueParticles = new Set<number>();
      for (const frame of frames) {
        for (const [id, _] of frame.particles) {
          uniqueParticles.add(id);
        }
      }
      setExportStatus(`✓ ${frames.length} frames, ${uniqueParticles.size} particles`);
      await new Promise(resolve => setTimeout(resolve, 50));

      const exportSprite = spriteCanvas || createParticleSprite('circle', 64);
      const { canvas: atlasCanvas, region } = createParticleAtlas(exportSprite);
      const atlasText = generateAtlasFile(atlasCanvas, region);
      const spineJSON = generateSpineJSON(frames, prewarmFrames, settings);
      const previewCanvas = renderBakedPreview(frames, settings);
      
      const zip = new SimpleZip();
      await zip.addCanvasFile('particle.png', atlasCanvas);
      await zip.addCanvasFile('preview.png', previewCanvas);
      zip.addFile('particle.atlas', atlasText);
      zip.addFile('particle_spine.json', spineJSON);
      
      const zipBlob = zip.generate();
      downloadBlob(zipBlob, 'particle_export.zip');

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
            Particle → Spine Exporter v88
          </h1>
          <p className="text-xs text-slate-400">Timeline is docked under the viewport • Forces/curves use random ranges with 0-1 multipliers</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr_320px] gap-4 items-start">
          <div className="space-y-3">
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-3 border border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">Preview</span>
                <div className="flex gap-1.5">
                  <select
                    value={zoom}
                    onChange={e => setZoom(parseFloat(e.target.value))}
                    className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                  >
                    <option value="0.25">25%</option>
                    <option value="0.5">50%</option>
                    <option value="1">100%</option>
                    <option value="2">200%</option>
                  </select>
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
                  <button onClick={() => setShowGrid(!showGrid)} className={`px-2 py-1 rounded text-xs ${showGrid ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-700 hover:bg-slate-600'}`} title="Toggle Grid">
                    #
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

              <input
                ref={spriteInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleSpriteUpload}
                style={{ display: 'none' }}
              />

              <div className="bg-black rounded overflow-hidden border border-slate-600 relative">
                <canvas
                  ref={canvasRef}
                  width={settings.frameSize}
                  height={settings.frameSize}
                  className="w-full h-[400px]"
                  style={{ imageRendering: 'pixelated', cursor: backgroundImage ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
                <div className="absolute top-1.5 left-1.5 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono">
                  Live: {liveParticleCount}
                </div>
                {settings.emitter.looping && (
                  <div className="absolute top-1.5 right-1.5 bg-green-600/70 px-2 py-0.5 rounded text-[10px] font-mono">
                    🔄 LOOP
                  </div>
                )}
                {settings.emitter.prewarm && (
                  <div className="absolute top-6 right-1.5 bg-blue-600/70 px-2 py-0.5 rounded text-[10px] font-mono">
                    ⚡ PREWARM
                  </div>
                )}
              </div>

              <div className="mt-3">
                <Timeline
                  currentTime={currentTime}
                  duration={settings.duration}
                  fps={settings.fps}
                  isPlaying={isPlaying}
                  playbackSpeed={playbackSpeed}
                  onTimeChange={handleTimelineTimeChange}
                  onPlayPause={handlePlayPause}
                  onRestart={handleRestart}
                  onSpeedChange={handleSpeedChange}
                  onDurationChange={d => updateSettings({ ...settings, duration: d })}
                  onFpsChange={f => updateSettings({ ...settings, fps: f })}
                />
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


            <CollapsibleSection title="🎯 Emitter Settings" isOpen={emitterOpen} onToggle={() => setEmitterOpen(!emitterOpen)}>
              <div className="space-y-2">
                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-blue-300 mb-2">🔄 Loop Settings</h4>

                  <label className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={settings.emitter.looping}
                      onChange={e => {
                        const newLooping = e.target.checked;
                        updateSettings({
                          ...settings,
                          emitter: {
                            ...settings.emitter,
                            looping: newLooping,
                            prewarm: newLooping ? settings.emitter.prewarm : false
                          }
                        });
                      }}
                      className="rounded"
                    />
                    <span className="text-xs text-slate-300">Looping</span>
                  </label>

                  {settings.emitter.looping && (
                    <>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={settings.emitter.prewarm}
                          onChange={e => {
                            updateSettings({
                              ...settings,
                              emitter: { ...settings.emitter, prewarm: e.target.checked }
                            });
                            if (e.target.checked) {
                              handleRestart();
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-xs text-slate-300">Prewarm</span>
                      </label>
                      <p className="text-[10px] text-slate-500 ml-5 mb-2">Fill system with particles on start</p>
                    </>
                  )}

                  <label className="block">
                    <span className="text-xs text-slate-300">Start Delay (sec)</span>
                    <input
                      type="number"
                     
                      max="5"
                      step="0.1"
                      value={settings.emitter.startDelay}
                      onChange={e => updateSettings({
                        ...settings,
                        emitter: { ...settings.emitter, startDelay: Number(e.target.value) }
                      })}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                </div>

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
                      <span className="text-xs text-slate-300">Burst Count</span>
                      <input
                        type="number"
                       
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
                      <span className="text-xs text-slate-300">Burst Cycles</span>
                      <input
                        type="number"
                       
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
                      <span className="text-xs text-slate-300">Burst Interval (sec)</span>
                      <input
                        type="number"
                       
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
                      <span className="text-xs text-slate-300">Rate (per sec)</span>
                      <input
                        type="number"
                       
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
                    <input type="number" max="400" value={settings.emitter.lineLength} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, lineLength: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                {settings.emitter.shape === 'circle' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Radius</span>
                    <input type="number" max="150" value={settings.emitter.shapeRadius} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeRadius: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                {(settings.emitter.shape === 'rectangle' || settings.emitter.shape === 'roundedRect') && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Width</span>
                      <input type="number" max="300" value={settings.emitter.shapeWidth} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeWidth: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-300">Height</span>
                      <input type="number" max="300" value={settings.emitter.shapeHeight} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, shapeHeight: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                  </div>
                )}

                {settings.emitter.shape === 'roundedRect' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Corner Radius</span>
                    <input type="number" max={Math.min(50, settings.emitter.shapeWidth / 2, settings.emitter.shapeHeight / 2)} value={settings.emitter.roundRadius} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, roundRadius: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Angle</span>
                    <input type="number" max="180" value={settings.emitter.angle} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, angle: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Spread</span>
                    <input type="number" max="360" value={settings.emitter.angleSpread} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, angleSpread: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                </div>

                {settings.emitter.emissionType === 'continuous' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Rate (per sec)</span>
                    <input type="number" max="200" value={settings.emitter.rate} onChange={e => updateSettings({ ...settings, emitter: { ...settings.emitter, rate: Number(e.target.value) }})} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}
              </div>
            </CollapsibleSection>

          </div>

          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
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

                <RangeInput
                  label="Start Speed Range"
                  helper="Initial emission velocity"
                  range={settings.initialSpeedRange}
                  onChange={range => updateSettings({ ...settings, initialSpeedRange: range })}
                />

                <label className="block">
                  <span className="text-xs text-slate-300">Particle Sprite</span>
                  <select 
                    value={settings.particleSprite} 
                    onChange={e => {
                      const newSprite = e.target.value as any;
                      updateSettings({ ...settings, particleSprite: newSprite });
                      if (newSprite !== 'custom') {
                        updateSpriteCanvas(newSprite, null);
                        setSpriteStatus(null);
                      }
                    }}
                    className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                  >
                    <option value="circle">⚪ Circle</option>
                    <option value="glow">✨ Glow</option>
                    <option value="star">⭐ Star</option>
                    <option value="polygon">⬡ Polygon</option>
                    <option value="custom">🖼️ Custom</option>
                  </select>
                </label>

                {settings.particleSprite === 'custom' && (
                  <button
                    onClick={() => spriteInputRef.current?.click()}
                    className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                  >
                    Upload Custom Sprite
                  </button>
                )}

                {spriteStatus && (
                  <p className="text-[10px] text-slate-400 mt-1">{spriteStatus}</p>
                )}

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-cyan-300 mb-2">🎯 Spawn Angle</h4>
                  <label className="block mb-2">
                    <span className="text-xs text-slate-300">Preset</span>
                    <select
                      value={settings.spawnAngleMode}
                      onChange={e => updateSettings({ ...settings, spawnAngleMode: e.target.value as ParticleSettings['spawnAngleMode'] })}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    >
                      <option value="alignMotion">Align to Motion</option>
                      <option value="specific">Specific Angle</option>
                      <option value="random">Random</option>
                      <option value="range">Random Between Angles</option>
                    </select>
                  </label>

                  {settings.spawnAngleMode === 'specific' && (
                    <label className="block">
                      <span className="text-xs text-slate-300">Angle (deg)</span>
                      <input
                        type="number"
                       
                        max="360"
                        value={settings.spawnAngle}
                        onChange={e => updateSettings({ ...settings, spawnAngle: Number(e.target.value) })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  )}

                  {settings.spawnAngleMode === 'range' && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Min (deg)</span>
                        <input
                          type="number"
                         
                          max="360"
                          value={settings.spawnAngleMin}
                          onChange={e => updateSettings({ ...settings, spawnAngleMin: Number(e.target.value) })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Max (deg)</span>
                        <input
                          type="number"
                         
                          max="360"
                          value={settings.spawnAngleMax}
                          onChange={e => updateSettings({ ...settings, spawnAngleMax: Number(e.target.value) })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                    </div>
                  )}

                  {settings.spawnAngleMode === 'alignMotion' && (
                    <p className="text-[10px] text-slate-500 mt-1">Faces the initial velocity direction.</p>
                  )}
                  {settings.spawnAngleMode === 'random' && (
                    <p className="text-[10px] text-slate-500 mt-1">Fully random 0–360° start angle.</p>
                  )}
                  {settings.spawnAngleMode === 'specific' && (
                    <p className="text-[10px] text-slate-500 mt-1">Spawns every particle at the defined angle.</p>
                  )}
                  {settings.spawnAngleMode === 'range' && (
                    <p className="text-[10px] text-slate-500 mt-1">Randomizes within the provided limits.</p>
                  )}
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="⚡ Forces & Fields" isOpen={forcesOpen} onToggle={() => setForcesOpen(!forcesOpen)}>
              <div className="space-y-3">
                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-green-300 mb-2">🌍 Gravity & Drag</h4>

                  <RangeInput
                    label="Gravity Base Range"
                    helper="Random between two numbers"
                    range={settings.gravityRange}
                    onChange={range => updateSettings({ ...settings, gravityRange: range })}
                  />
                  <CurveEditor
                    label="Gravity Multiplier (0-1)"
                    curve={settings.gravityOverLifetime}
                    onChange={curve => updateSettings({ ...settings, gravityOverLifetime: curve })}
                    onReset={() => updateSettings({ ...settings, gravityOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.gravity) })}
                    max={1}
                  />

                  <RangeInput
                    label="Drag Base Range"
                    helper="Random damping factor"
                    range={settings.dragRange}
                    onChange={range => updateSettings({ ...settings, dragRange: range })}
                  />
                  <div className="mt-2">
                    <CurveEditor
                      label="Drag Multiplier (0-1)"
                      curve={settings.dragOverLifetime}
                      onChange={curve => updateSettings({ ...settings, dragOverLifetime: curve })}
                      onReset={() => updateSettings({ ...settings, dragOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.drag) })}
                      max={1}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-purple-300 mb-2">🌪️ Noise Field</h4>

                  <RangeInput
                    label="Noise Strength Range"
                    helper="Base force (random)"
                    range={settings.noiseStrengthRange}
                    onChange={range => updateSettings({ ...settings, noiseStrengthRange: range })}
                  />
                  <CurveEditor
                    label="Noise Strength Multiplier (0-1)"
                    curve={settings.noiseStrengthOverLifetime}
                    onChange={curve => updateSettings({ ...settings, noiseStrengthOverLifetime: curve })}
                    onReset={() => updateSettings({ ...settings, noiseStrengthOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.noise) })}
                    max={1}
                  />

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <RangeInput
                      label="Frequency Range"
                      helper="Lower = bigger swirls"
                      range={settings.noiseFrequencyRange}
                      onChange={range => updateSettings({ ...settings, noiseFrequencyRange: range })}
                    />
                    <RangeInput
                      label="Speed Range"
                      helper="Flow animation speed"
                      range={settings.noiseSpeedRange}
                      onChange={range => updateSettings({ ...settings, noiseSpeedRange: range })}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-pink-300 mb-2">🌀 Vortex Force</h4>

                  <RangeInput
                    label="Vortex Strength Range"
                    helper="Random between two numbers"
                    range={settings.vortexStrengthRange}
                    onChange={range => updateSettings({ ...settings, vortexStrengthRange: range })}
                  />
                  <CurveEditor
                    label="Vortex Strength Multiplier (0-1)"
                    curve={settings.vortexStrengthOverLifetime}
                    onChange={curve => updateSettings({ ...settings, vortexStrengthOverLifetime: curve })}
                    onReset={() => updateSettings({ ...settings, vortexStrengthOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.vortex) })}
                    max={1}
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

                  <label className="flex items-center gap-2 mt-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={settings.showVortexVisualization}
                      onChange={e => updateSettings({ ...settings, showVortexVisualization: e.target.checked })}
                      className="h-4 w-4 text-pink-400 rounded border-slate-600 bg-slate-900"
                    />
                    <span>Show vortex direction arrows</span>
                  </label>
                </div>

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-cyan-300 mb-2">🔄 Spin</h4>

                  <RangeInput
                    label="Spin Speed Range (deg/sec)"
                    helper="Random between two numbers"
                    range={settings.angularVelocityRange}
                    onChange={range => updateSettings({ ...settings, angularVelocityRange: range })}
                  />
                  <CurveEditor
                    label="Spin Speed Multiplier (0-1)"
                    curve={settings.angularVelocityOverLifetime}
                    onChange={curve => updateSettings({ ...settings, angularVelocityOverLifetime: curve })}
                    onReset={() => updateSettings({ ...settings, angularVelocityOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.angularVelocity) })}
                    max={1}
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Continuous rotation over particle lifetime</p>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="📈 Curves Over Lifetime" isOpen={curvesOpen} onToggle={() => setCurvesOpen(!curvesOpen)}>
              <div className="space-y-2">
                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-amber-300 mb-2">🎨 Color Over Lifetime</h4>
                  <ColorGradientEditor
                    gradient={settings.colorOverLifetime}
                    onChange={gradient => updateSettings({ ...settings, colorOverLifetime: gradient })}
                  />
                </div>

                <RangeInput
                  label="Size X Base Range"
                  helper="Random between two numbers"
                  range={settings.sizeXRange}
                  onChange={range => updateSettings({ ...settings, sizeXRange: range })}
                />
                <CurveEditor
                  label="Size X Multiplier (0-1)"
                  curve={settings.sizeXOverLifetime}
                  onChange={curve => updateSettings({ ...settings, sizeXOverLifetime: curve })}
                  onReset={() => updateSettings({ ...settings, sizeXOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.sizeX) })}
                  max={1}
                />
                <RangeInput
                  label="Size Y Base Range"
                  helper="Random between two numbers"
                  range={settings.sizeYRange}
                  onChange={range => updateSettings({ ...settings, sizeYRange: range })}
                />
                <CurveEditor
                  label="Size Y Multiplier (0-1)"
                  curve={settings.sizeYOverLifetime}
                  onChange={curve => updateSettings({ ...settings, sizeYOverLifetime: curve })}
                  onReset={() => updateSettings({ ...settings, sizeYOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.sizeY) })}
                  max={1}
                />
                <RangeInput
                  label="Speed Base Range"
                  helper="Random between two numbers"
                  range={settings.speedRange}
                  onChange={range => updateSettings({ ...settings, speedRange: range })}
                />
                <CurveEditor
                  label="Speed Multiplier (0-1)"
                  curve={settings.speedOverLifetime}
                  onChange={curve => updateSettings({ ...settings, speedOverLifetime: curve })}
                  onReset={() => updateSettings({ ...settings, speedOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.speed) })}
                  max={1}
                />
                <RangeInput
                  label="Weight Base Range"
                  helper="Random between two numbers"
                  range={settings.weightRange}
                  onChange={range => updateSettings({ ...settings, weightRange: range })}
                />
                <CurveEditor
                  label="Weight Multiplier (0-1)"
                  curve={settings.weightOverLifetime}
                  onChange={curve => updateSettings({ ...settings, weightOverLifetime: curve })}
                  onReset={() => updateSettings({ ...settings, weightOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.weight) })}
                  max={1}
                />
                <RangeInput
                  label="Attraction Base Range"
                  helper="Random between two numbers"
                  range={settings.attractionRange}
                  onChange={range => updateSettings({ ...settings, attractionRange: range })}
                />
                <CurveEditor
                  label="Attraction Multiplier (0-1)"
                  curve={settings.attractionOverLifetime}
                  onChange={curve => updateSettings({ ...settings, attractionOverLifetime: curve })}
                  onReset={() => updateSettings({ ...settings, attractionOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.attraction) })}
                  max={1}
                />

                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <RangeInput
                    label="Spin Base Range (deg/sec)"
                    helper="Random between two numbers"
                    range={settings.spinRange}
                    onChange={range => updateSettings({ ...settings, spinRange: range })}
                  />
                  <CurveEditor
                    label="Spin Multiplier (0-1)"
                    curve={settings.spinOverLifetime}
                    onChange={curve => updateSettings({ ...settings, spinOverLifetime: curve })}
                    onReset={() => updateSettings({ ...settings, spinOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.spin) })}
                    max={1}
                  />
                </div>
              </div>
            </CollapsibleSection>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
            <CollapsibleSection title="💾 Export Settings" isOpen={exportOpen} onToggle={() => setExportOpen(!exportOpen)}>
              <div className="space-y-2">
                <div className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded space-y-1">
                  <div>Total Frames: {Math.ceil(settings.duration * settings.fps)}</div>
                  {settings.emitter.looping && (
                    <>
                      <div className="text-green-400">🔄 Loop Mode: Enabled</div>
                      {settings.emitter.prewarm && (
                        <div className="text-blue-400">⚡ Prewarm: Active</div>
                      )}
                      {settings.emitter.startDelay > 0 && (
                        <div className="text-yellow-400">⏱️ Start Delay: {settings.emitter.startDelay}s</div>
                      )}
                    </>
                  )}
                </div>

                <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">Timeline Export</div>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.exportSettings.exportTranslate}
                    onChange={(e) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, exportTranslate: e.target.checked } })}
                    className="rounded"
                  />
                  <span>Export Translate</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.exportSettings.exportRotate}
                    onChange={(e) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, exportRotate: e.target.checked } })}
                    className="rounded"
                  />
                  <span>Export Rotate</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.exportSettings.exportScale}
                    onChange={(e) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, exportScale: e.target.checked } })}
                    className="rounded"
                  />
                  <span>Export Scale</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.exportSettings.exportColor}
                    onChange={(e) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, exportColor: e.target.checked } })}
                    className="rounded"
                  />
                  <span>Export Color</span>
                </label>

                <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">Keyframe Thresholds</div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-slate-400">Position Threshold (px)</label>
                    <input
                      type="number"
                      value={settings.exportSettings.positionThreshold}
                      onChange={(e) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, positionThreshold: parseFloat(e.target.value) || 0 } })}
                      step="0.1"
                     
                      max="50"
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Rotation Threshold (°)</label>
                    <input
                      type="number"
                      value={settings.exportSettings.rotationThreshold}
                      onChange={(e) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, rotationThreshold: parseFloat(e.target.value) || 0 } })}
                      step="0.1"

                      max="180"
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Scale Threshold</label>
                    <input
                      type="number"
                      value={settings.exportSettings.scaleThreshold}
                      onChange={(e) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, scaleThreshold: parseFloat(e.target.value) || 0 } })}
                      step="0.01"
                     
                      max="2"
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Color Threshold (RGBA Sum)</label>
                    <input
                      type="number"
                      value={settings.exportSettings.colorThreshold}
                      onChange={(e) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, colorThreshold: parseFloat(e.target.value) || 0 } })}
                      step="1"
                     
                      max="1020"
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs"
                    />
                  </div>
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
