/**
 * UI Components for Particle Spine Exporter v101
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Settings, ChevronDown, ChevronUp, Trash2, RefreshCw, Plus, Eye, EyeOff } from 'lucide-react';
import type { Color, ColorGradient, ColorPoint, Curve, CurvePoint, RangeValue } from '../types';
import { clamp01, evaluateCurve, evaluateColorGradient } from '../utils';

const parseDecimal = (raw: string) => parseFloat(raw.replace(/,/g, '.'));

// ============================================================
// UI COMPONENTS
// ============================================================

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
                <NumericInput
                  value={gradient.points[selectedPoint].color.r}
                  onValueChange={value => handleColorChange('r', Math.max(0, Math.min(255, Math.round(value))))}
                  max={255}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">G</label>
                <NumericInput
                  value={gradient.points[selectedPoint].color.g}
                  onValueChange={value => handleColorChange('g', Math.max(0, Math.min(255, Math.round(value))))}
                  max={255}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">B</label>
                <NumericInput
                  value={gradient.points[selectedPoint].color.b}
                  onValueChange={value => handleColorChange('b', Math.max(0, Math.min(255, Math.round(value))))}
                  max={255}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">A</label>
                <NumericInput
                  value={gradient.points[selectedPoint].color.a}
                  onValueChange={value => handleColorChange('a', Math.max(0, Math.min(255, Math.round(value))))}
                  max={255}
                  className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-400">Time</label>
              <NumericInput
                value={gradient.points[selectedPoint].time}
                onValueChange={value => {
                  const newPoints = [...gradient.points];
                  const clamped = selectedPoint === 0 ? 0 : selectedPoint === newPoints.length - 1 ? 1 : Math.min(1, Math.max(0, value));
                  newPoints[selectedPoint] = { ...newPoints[selectedPoint], time: clamped };
                  onChange({ points: newPoints.sort((a, b) => a.time - b.time) });
                }}
                max={1}
                min={0}
                step={0.01}
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
  const [timeInput, setTimeInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(260);
  const [viewMin, setViewMin] = useState(min);
  const [viewMax, setViewMax] = useState(max);

  const roundToTwo = (val: number) => Math.round(val * 100) / 100;

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

  useEffect(() => {
    if (selectedPoint === null) return;

    const point = curve.points[selectedPoint];
    if (!point) return;

    const formattedTime = Number.isFinite(point.time) ? roundToTwo(point.time).toString() : '';
    const formattedValue = Number.isFinite(point.value) ? roundToTwo(point.value).toString() : '';

    const parsedTime = parseDecimal(timeInput);
    const parsedValue = parseDecimal(valueInput);

    if (Number.isNaN(parsedTime) || parsedTime !== point.time) {
      setTimeInput(formattedTime);
    }
    if (Number.isNaN(parsedValue) || parsedValue !== point.value) {
      setValueInput(formattedValue);
    }
  }, [curve.points, selectedPoint]);

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

    const newTime = roundToTwo(xToTime(x));
    const newValue = roundToTwo(yToValue(y));

    const newPoint = { time: newTime, value: newValue };
    const newPoints = [...curve.points, newPoint]
      .sort((a, b) => a.time - b.time);

    onChange({ ...curve, points: newPoints });
    setSelectedPoint(newPoints.indexOf(newPoint));
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

    const newTime = roundToTwo(xToTime(x));
    const proposed = yToValue(y);
    const newValue = roundToTwo(autoScale ? proposed : Math.max(min, Math.min(max, proposed)));

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

          {[-1, 1].map(boundary => {
            if (boundary < viewMin || boundary > viewMax) return null;
            return (
              <line
                key={`limit-${boundary}`}
                x1={padding}
                y1={valueToY(boundary)}
                x2={width - padding}
                y2={valueToY(boundary)}
                stroke="rgba(148,163,184,0.4)"
                strokeWidth="1"
                strokeDasharray="4,2"
              />
            );
          })}

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
                  {point.value.toFixed(2)}
                </text>
              )}
            </g>
          ))}
        </svg>

          {selectedPoint !== null && (
            <div className="mt-1 grid grid-cols-2 gap-1">
              <input
                type="text"
                value={timeInput}
                onChange={e => {
                  const raw = e.target.value;
                  setTimeInput(raw);

                  const parsed = parseDecimal(raw);
                  if (Number.isNaN(parsed) || selectedPoint === null) return;

                  const newPoints = [...curve.points];
                  const clampedTime = roundToTwo(Math.max(0, Math.min(1, parsed)));
                  const nextTime = selectedPoint === 0 ? 0 : selectedPoint === newPoints.length - 1 ? 1 : clampedTime;

                  newPoints[selectedPoint] = { ...newPoints[selectedPoint], time: nextTime };
                  onChange({ ...curve, points: newPoints.sort((a, b) => a.time - b.time) });
                }}
                disabled={selectedPoint === 0 || selectedPoint === curve.points.length - 1}
                className="w-full px-1.5 py-0.5 bg-slate-800 border border-slate-600 rounded text-[10px]"
                placeholder="Time"
              />
              <input
                type="text"
                value={valueInput}
                onChange={e => {
                  const raw = e.target.value;
                  setValueInput(raw);

                  const parsed = parseDecimal(raw);
                  if (Number.isNaN(parsed) || selectedPoint === null) return;

                  const clampedValue = roundToTwo(autoScale ? parsed : Math.max(min, Math.min(max, parsed)));
                  const newPoints = [...curve.points];
                  newPoints[selectedPoint] = { ...newPoints[selectedPoint], value: clampedValue };
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

const Timeline: React.FC<{
  currentTime: number;
  duration: number;
  fps: number;
  isPlaying: boolean;
  playbackSpeed: number;
  onTimeChange: (time: number) => void;
  onPlayPause: () => void;
  onPlaybackRestart: () => void;
  onSpeedChange: (speed: number) => void;
  onDurationChange: (duration: number) => void;
  onFpsChange: (fps: number) => void;
}> = ({ currentTime, duration, fps, isPlaying, playbackSpeed, onTimeChange, onPlayPause, onPlaybackRestart, onSpeedChange, onDurationChange, onFpsChange }) => {
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
          onClick={onPlaybackRestart}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm font-semibold"
        >
          ⏯
        </button>
        
        <select
          value={playbackSpeed}
          onChange={e => onSpeedChange(parseDecimal(e.target.value))}
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
        
        <NumericInput
          value={duration}
          onValueChange={onDurationChange}
          max={10}
          step={0.1}
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

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onValueChange: (value: number) => void;
};

const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onValueChange,
  min,
  max,
  step,
  className,
  onBlur,
  ...rest
}) => {
  const [text, setText] = useState<string>(Number.isFinite(value) ? String(value) : '');

  const parsedMin = min !== undefined ? parseDecimal(String(min)) : undefined;
  const parsedMax = max !== undefined ? parseDecimal(String(max)) : undefined;

  const clampValue = (val: number) => {
    let next = val;
    if (!Number.isNaN(parsedMin as number) && parsedMin !== undefined) {
      next = Math.max(parsedMin, next);
    }
    if (!Number.isNaN(parsedMax as number) && parsedMax !== undefined) {
      next = Math.min(parsedMax, next);
    }
    return next;
  };

  useEffect(() => {
    const parsedDisplay = parseDecimal(text);
    if (Number.isNaN(parsedDisplay) || parsedDisplay !== value) {
      setText(Number.isFinite(value) ? String(value) : '');
    }
    // Only sync when the external value changes to avoid interrupting user input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    const parsed = parseDecimal(raw);
    if (!Number.isNaN(parsed)) {
      const clamped = clampValue(parsed);
      onValueChange(clamped);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseDecimal(text);

    if (Number.isNaN(parsed)) {
      setText(Number.isFinite(value) ? String(value) : '');
    } else {
      const clamped = clampValue(parsed);
      setText(String(clamped));
      onValueChange(clamped);
    }

    onBlur?.(e);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      min={min as number | undefined}
      max={max as number | undefined}
      step={step}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      {...rest}
    />
  );
};

const RangeInput: React.FC<{
  label: string;
  range: RangeValue;
  onChange: (range: RangeValue) => void;
  helper?: string;
}> = ({ label, range, onChange, helper }) => {
  const handleChange = (key: 'min' | 'max') => (value: number) => {
    onChange({ ...range, [key]: value });
  };

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        {helper && <span className="text-[10px] text-slate-500">{helper}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <NumericInput
          value={range.min}
          onValueChange={handleChange('min')}
          className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
          placeholder="Min"
        />
        <NumericInput
          value={range.max}
          onValueChange={handleChange('max')}
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


export {
  ColorPicker,
  ColorGradientEditor,
  NumericInput,
  CurveEditor,
  Timeline,
  RangeInput,
  CollapsibleSection,
};
