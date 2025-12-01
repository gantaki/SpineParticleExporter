/**
 * CurveEditorNew component for Particle Spine Exporter v104
 * Enhanced curve editor with bezier handles, additional presets, and zoom capability
 */

import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, Trash2, Maximize2, Minimize2, Copy, Clipboard } from 'lucide-react';
import type { Curve } from '../types';
import { evaluateCurve } from '../utils';
import { parseDecimal } from './helpers';

interface CurveEditorNewProps {
  label: string;
  curve: Curve;
  onChange: (curve: Curve) => void;
  onReset?: () => void;
  min?: number;
  max?: number;
  autoScale?: boolean;
  allowRangeToggle?: boolean; // Allow toggling between -1 to 1 and 0 to 1
}

interface BezierHandle {
  x: number;
  y: number;
}

interface PointWithHandles {
  inHandle?: BezierHandle;
  outHandle?: BezierHandle;
}

interface CurveClipboard {
  curve: Curve;
  handles: Map<number, PointWithHandles>;
  rangeMode: '0-1' | '-1-1';
}

// Global clipboard for curve data
let globalCurveClipboard: CurveClipboard | null = null;

export const CurveEditorNew: React.FC<CurveEditorNewProps> = ({
  label,
  curve,
  onChange,
  onReset,
  min: initialMin = -1,
  max: initialMax = 1,
  autoScale = true,
  allowRangeToggle = false
}) => {
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingHandle, setDraggingHandle] = useState<'in' | 'out' | null>(null);
  const [timeInput, setTimeInput] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [isZoomed, setIsZoomed] = useState(false);
  const [handles, setHandles] = useState<Map<number, PointWithHandles>>(new Map());
  const [rangeMode, setRangeMode] = useState<'0-1' | '-1-1'>(initialMin === 0 ? '0-1' : '-1-1');
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(260);
  const [viewMin, setViewMin] = useState(initialMin);
  const [viewMax, setViewMax] = useState(initialMax);

  // Calculate min/max based on range mode
  const min = rangeMode === '0-1' ? 0 : -1;
  const max = rangeMode === '0-1' ? 1 : 1;

  const roundToTwo = (val: number) => Math.round(val * 100) / 100;

  // Clamp value to current range mode
  const clampToRange = (value: number): number => {
    const currentMin = rangeMode === '0-1' ? 0 : -1;
    const currentMax = 1;
    return Math.max(currentMin, Math.min(currentMax, value));
  };

  // Handle range mode toggle with value clamping
  const handleRangeModeToggle = () => {
    const newMode = rangeMode === '0-1' ? '-1-1' : '0-1';
    const newMin = newMode === '0-1' ? 0 : -1;

    // Clamp all point values to new range
    const clampedPoints = curve.points.map(point => ({
      ...point,
      value: roundToTwo(Math.max(newMin, Math.min(1, point.value)))
    }));

    onChange({ ...curve, points: clampedPoints });
    setRangeMode(newMode);
  };

  // Copy curve to clipboard
  const handleCopyCurve = () => {
    globalCurveClipboard = {
      curve: { ...curve, points: curve.points.map(p => ({ ...p })) },
      handles: new Map(handles),
      rangeMode
    };
  };

  // Paste curve from clipboard
  const handlePasteCurve = () => {
    if (!globalCurveClipboard) return;

    onChange({ ...globalCurveClipboard.curve });
    setHandles(new Map(globalCurveClipboard.handles));
    setRangeMode(globalCurveClipboard.rangeMode);
  };

  useEffect(() => {
    const measureWidth = () => {
      if (containerRef.current) {
        const nextWidth = Math.max(260, containerRef.current.clientWidth);
        setWidth(nextWidth);
      }
    };

    measureWidth();
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

  // Auto-initialize handles for selected point in smooth mode
  useEffect(() => {
    if (selectedPoint === null || curve.interpolation !== 'smooth') return;

    const point = curve.points[selectedPoint];
    if (!point) return;

    // Check if handles already exist for this point
    if (handles.has(selectedPoint)) return;

    // Initialize default handles
    const newHandles = new Map(handles);
    const handleLength = 0.15; // Default handle length

    const pointHandles: PointWithHandles = {};

    // Add in-handle if not first point
    if (selectedPoint > 0) {
      pointHandles.inHandle = { x: -handleLength, y: 0 };
    }

    // Add out-handle if not last point
    if (selectedPoint < curve.points.length - 1) {
      pointHandles.outHandle = { x: handleLength, y: 0 };
    }

    if (pointHandles.inHandle || pointHandles.outHandle) {
      newHandles.set(selectedPoint, pointHandles);
      setHandles(newHandles);
    }
  }, [selectedPoint, curve.interpolation, curve.points.length, handles]);

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

  const baseHeight = 80;
  const height = isZoomed ? baseHeight * 3 : baseHeight;
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
    if (isDragging || draggingHandle) return;

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
  };

  const handleSvgDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging || draggingHandle) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if double-clicked on existing point
    const clickedPoint = curve.points.findIndex(p => {
      const px = timeToX(p.time);
      const py = valueToY(p.value);
      const distance = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
      return distance < 8;
    });

    // Don't add new point if clicked on existing point
    if (clickedPoint !== -1) return;

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

  const handleHandleMouseDown = (e: React.MouseEvent, index: number, type: 'in' | 'out') => {
    e.stopPropagation();
    setSelectedPoint(index);
    setDraggingHandle(type);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (selectedPoint === null && selectedPoint !== 0) return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (draggingHandle && curve.interpolation === 'smooth') {
      const point = curve.points[selectedPoint];
      const px = timeToX(point.time);
      const py = valueToY(point.value);

      const handleX = (x - px) / graphWidth;
      const handleY = (py - y) / graphHeight;

      const pointHandles = handles.get(selectedPoint) || {};

      if (draggingHandle === 'out') {
        pointHandles.outHandle = { x: Math.max(0, handleX), y: handleY };
      } else {
        pointHandles.inHandle = { x: Math.min(0, handleX), y: handleY };
      }

      const newHandles = new Map(handles);
      newHandles.set(selectedPoint, pointHandles);
      setHandles(newHandles);
      return;
    }

    if (isDragging) {
      let newTime = roundToTwo(xToTime(x));
      const proposed = yToValue(y);
      const newValue = roundToTwo(autoScale ? proposed : clampToRange(proposed));

      const newPoints = [...curve.points];

      if (selectedPoint === 0) {
        // First point always at time 0
        newPoints[selectedPoint] = { time: 0, value: newValue };
      } else if (selectedPoint === newPoints.length - 1) {
        // Last point always at time 1
        newPoints[selectedPoint] = { time: 1, value: newValue };
      } else {
        // Middle points: constrain time between neighbors to prevent curve inversion
        const prevPoint = newPoints[selectedPoint - 1];
        const nextPoint = newPoints[selectedPoint + 1];

        // Ensure time is between previous and next point with small margin
        const minTime = prevPoint.time + 0.01;
        const maxTime = nextPoint.time - 0.01;
        newTime = Math.max(minTime, Math.min(maxTime, newTime));

        newPoints[selectedPoint] = { time: newTime, value: newValue };
      }

      onChange({ ...curve, points: newPoints });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggingHandle(null);
  };

  const handleDeletePoint = () => {
    if (selectedPoint === null || curve.points.length <= 2) return;

    const newPoints = curve.points.filter((_, i) => i !== selectedPoint);
    onChange({ ...curve, points: newPoints });

    const newHandles = new Map(handles);
    newHandles.delete(selectedPoint);
    setHandles(newHandles);
    setSelectedPoint(null);
  };

  const generatePath = () => {
    if (curve.interpolation === 'linear' || handles.size === 0) {
      const pathPoints: string[] = [];
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const value = evaluateCurve(curve, t);
        const x = timeToX(t);
        const y = valueToY(value);
        pathPoints.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`);
      }
      return pathPoints.join(' ');
    }

    let pathData = '';
    for (let i = 0; i < curve.points.length - 1; i++) {
      const p1 = curve.points[i];
      const p2 = curve.points[i + 1];

      const x1 = timeToX(p1.time);
      const y1 = valueToY(p1.value);
      const x2 = timeToX(p2.time);
      const y2 = valueToY(p2.value);

      if (i === 0) {
        pathData += `M ${x1} ${y1} `;
      }

      const h1 = handles.get(i);
      const h2 = handles.get(i + 1);

      const cp1x = x1 + (h1?.outHandle ? h1.outHandle.x * graphWidth : (x2 - x1) * 0.33);
      const cp1y = y1 - (h1?.outHandle ? h1.outHandle.y * graphHeight : 0);
      const cp2x = x2 + (h2?.inHandle ? h2.inHandle.x * graphWidth : -(x2 - x1) * 0.33);
      const cp2y = y2 - (h2?.inHandle ? h2.inHandle.y * graphHeight : 0);

      pathData += `C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2} `;
    }

    return pathData || generatePathFallback();
  };

  const generatePathFallback = () => {
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
          <button
            onClick={handleCopyCurve}
            className="p-0.5 bg-slate-700 hover:bg-slate-600 rounded"
            title="Copy curve"
          >
            <Copy size={10} />
          </button>
          <button
            onClick={handlePasteCurve}
            className="p-0.5 bg-slate-700 hover:bg-slate-600 rounded"
            title="Paste curve"
            disabled={!globalCurveClipboard}
          >
            <Clipboard size={10} className={!globalCurveClipboard ? 'opacity-50' : ''} />
          </button>
          {allowRangeToggle && (
            <button
              onClick={handleRangeModeToggle}
              className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px]"
              title={`Switch to ${rangeMode === '0-1' ? '-1 to 1' : '0 to 1'} range`}
            >
              {rangeMode === '0-1' ? '0→1' : '-1→1'}
            </button>
          )}
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-0.5 bg-slate-700 hover:bg-slate-600 rounded"
            title={isZoomed ? "Zoom out" : "Zoom in (3x)"}
          >
            {isZoomed ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
          </button>
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

      {curve.interpolation === 'smooth' && selectedPoint !== null && (
        <div className="text-[10px] text-slate-400 px-1">
          💡 Drag the pink handles to adjust curve shape
        </div>
      )}

      {!selectedPoint && selectedPoint !== 0 && (
        <div className="text-[10px] text-slate-400 px-1">
          💡 Double-click to add a new point
        </div>
      )}

      <div className="bg-slate-900 rounded border border-slate-700 p-1">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="cursor-crosshair"
          onClick={handleSvgClick}
          onDoubleClick={handleSvgDoubleClick}
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

          {/* Render bezier handles for selected point */}
          {curve.interpolation === 'smooth' && selectedPoint !== null && (() => {
            const point = curve.points[selectedPoint];
            const px = timeToX(point.time);
            const py = valueToY(point.value);
            const pointHandles = handles.get(selectedPoint);

            if (!pointHandles) return null;

            return (
              <g key="handles">
                {pointHandles.inHandle && selectedPoint > 0 && (
                  <g>
                    <line
                      x1={px}
                      y1={py}
                      x2={px + pointHandles.inHandle.x * graphWidth}
                      y2={py - pointHandles.inHandle.y * graphHeight}
                      stroke="rgba(236, 72, 153, 0.6)"
                      strokeWidth="1.5"
                      strokeDasharray="3,2"
                    />
                    <circle
                      cx={px + pointHandles.inHandle.x * graphWidth}
                      cy={py - pointHandles.inHandle.y * graphHeight}
                      r={4}
                      fill="rgba(236, 72, 153, 0.9)"
                      stroke="white"
                      strokeWidth="1.5"
                      className="cursor-move"
                      onMouseDown={(e) => handleHandleMouseDown(e, selectedPoint, 'in')}
                    />
                  </g>
                )}
                {pointHandles.outHandle && selectedPoint < curve.points.length - 1 && (
                  <g>
                    <line
                      x1={px}
                      y1={py}
                      x2={px + pointHandles.outHandle.x * graphWidth}
                      y2={py - pointHandles.outHandle.y * graphHeight}
                      stroke="rgba(236, 72, 153, 0.6)"
                      strokeWidth="1.5"
                      strokeDasharray="3,2"
                    />
                    <circle
                      cx={px + pointHandles.outHandle.x * graphWidth}
                      cy={py - pointHandles.outHandle.y * graphHeight}
                      r={4}
                      fill="rgba(236, 72, 153, 0.9)"
                      stroke="white"
                      strokeWidth="1.5"
                      className="cursor-move"
                      onMouseDown={(e) => handleHandleMouseDown(e, selectedPoint, 'out')}
                    />
                  </g>
                )}
              </g>
            );
          })()}

          {/* Render curve points */}
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
