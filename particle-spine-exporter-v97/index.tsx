/**
 * Particle → Spine Exporter v97 (Alpha) - Main Component
 *
 * Version: 97
 * Date: 2025-11-25
 *
 * Changes in v97:
 * - Refactored into modular structure for better maintainability
 * - Split into 6 modules: types, utils, components, core, export, index
 * - Added build script to generate standalone version
 * - All functionality preserved from v96
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings, ChevronDown, ChevronUp, Trash2, RefreshCw } from 'lucide-react';

// Type imports
import type { ParticleSettings, Curve, RangeValue, Vec2 } from './types';
import { DEFAULT_SETTINGS } from './types';

// Component imports
import {
  ColorPicker,
  ColorGradientEditor,
  CurveEditor,
  Timeline,
  RangeInput,
  CollapsibleSection,
} from './components';

// Core imports
import { ParticleSystem } from './core';

// Export imports
import {
  createParticleSprite,
  createParticleAtlas,
  bakeParticleAnimation,
  renderBakedPreview,
  generateAtlasFile,
  generateSpineJSON,
  SimpleZip,
  downloadBlob,
} from './export';

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
            Particle → Spine Exporter v96
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
