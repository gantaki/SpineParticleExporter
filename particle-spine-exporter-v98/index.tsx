/**
 * Particle → Spine Exporter v98 (Alpha) - Main Component
 *
 * Version: 98
 * Date: 2025-11-26
 *
 * Changes in v98:
 * - Multi-emitter support (up to 5 emitters)
 * - Each emitter has independent settings for particles and emission
 * - Export creates parent bones (emitter_1, emitter_2, etc.) in Spine
 * - Individual emitter enable/disable for export
 * - Individual emitter visibility toggle in viewport
 * - All emitters rendered simultaneously
 * - Current emitter highlighted in viewport
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Download, Play, RotateCcw, Settings, ChevronDown, ChevronUp, Trash2, RefreshCw, Plus, Eye, EyeOff } from 'lucide-react';

// Type imports
import type { ParticleSettings, Curve, RangeValue, Vec2, EmitterInstance } from './types';
import { DEFAULT_SETTINGS, createEmitterInstance } from './types';

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
    updateSpriteCanvas(em.particleSprite, em.customSpriteData);
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
    updateSpriteCanvas(em.particleSprite, em.customSpriteData);
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
      systemRef.current.initializeEmitterStates();
    }
    setNeedsRebake(true);
    setBakedSimulation(null);
  }, []);

  // Helper function to update current emitter settings (accepts partial update)
  const updateEmitter = useCallback((partial: Partial<EmitterInstance['settings']>) => {
    const newEmitters = [...settings.emitters];
    const currentIndex = settings.currentEmitterIndex;
    if (currentIndex >= 0 && currentIndex < newEmitters.length) {
      newEmitters[currentIndex] = {
        ...newEmitters[currentIndex],
        settings: {
          ...newEmitters[currentIndex].settings,
          ...partial
        }
      };
      updateSettings({ ...settings, emitters: newEmitters });
    }
  }, [settings, updateSettings]);

  // Add new emitter
  const handleAddEmitter = useCallback(() => {
    if (settings.emitters.length >= 5) {
      alert('Maximum 5 emitters allowed');
      return;
    }
    const newIndex = settings.emitters.length + 1;
    const newEmitter = createEmitterInstance(`emitter_${newIndex}`, `Emitter ${newIndex}`);
    updateSettings({
      ...settings,
      emitters: [...settings.emitters, newEmitter],
      currentEmitterIndex: settings.emitters.length
    });
  }, [settings, updateSettings]);

  // Remove emitter
  const handleRemoveEmitter = useCallback((emitterId: string) => {
    if (settings.emitters.length <= 1) {
      alert('At least one emitter is required');
      return;
    }
    const newEmitters = settings.emitters.filter(e => e.id !== emitterId);
    const newIndex = Math.min(settings.currentEmitterIndex, newEmitters.length - 1);
    updateSettings({
      ...settings,
      emitters: newEmitters,
      currentEmitterIndex: newIndex
    });
  }, [settings, updateSettings]);

  // Select emitter
  const handleSelectEmitter = useCallback((index: number) => {
    updateSettings({ ...settings, currentEmitterIndex: index });
  }, [settings, updateSettings]);

  // Toggle emitter visibility
  const handleToggleEmitterVisibility = useCallback((emitterId: string) => {
    const newEmitters = settings.emitters.map(e =>
      e.id === emitterId ? { ...e, visible: !e.visible } : e
    );
    updateSettings({ ...settings, emitters: newEmitters });
  }, [settings, updateSettings]);

  // Toggle emitter export
  const handleToggleEmitterExport = useCallback((emitterId: string) => {
    const newEmitters = settings.emitters.map(e =>
      e.id === emitterId ? { ...e, enabled: !e.enabled } : e
    );
    updateSettings({ ...settings, emitters: newEmitters });
  }, [settings, updateSettings]);

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
          updateEmitter({ particleSprite: 'custom', customSpriteData: data });
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

  // Helper to access current emitter settings
  const currentEmitter = settings.emitters[settings.currentEmitterIndex];
  const em = currentEmitter?.settings || settings.emitters[0]?.settings;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Particle → Spine Exporter v98
          </h1>
          <p className="text-xs text-slate-400">Multi-emitter support • Up to 5 independent emitters • Separate bone hierarchy per emitter</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[240px_420px_1fr_320px] gap-4 items-start">
          <div className="space-y-3">
            {/* Emitter Management Panel */}
            <div className="bg-slate-800/50 backdrop-blur rounded-lg p-3 border border-slate-700">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold">Emitters ({settings.emitters.length}/5)</span>
                <button
                  onClick={handleAddEmitter}
                  disabled={settings.emitters.length >= 5}
                  className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                    settings.emitters.length >= 5
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                  title="Add new emitter (max 5)"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
              <div className="space-y-1">
                {settings.emitters.map((emitter, index) => (
                  <div
                    key={emitter.id}
                    className={`flex items-center gap-2 p-2 rounded ${
                      settings.currentEmitterIndex === index
                        ? 'bg-purple-600/30 border border-purple-500'
                        : 'bg-slate-700/30 hover:bg-slate-700/50 border border-transparent'
                    }`}
                  >
                    <button
                      onClick={() => handleSelectEmitter(index)}
                      className="flex-1 text-left text-xs font-medium"
                    >
                      {emitter.name}
                    </button>
                    <button
                      onClick={() => handleToggleEmitterVisibility(emitter.id)}
                      className={`p-1 rounded ${
                        emitter.visible
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-slate-600 hover:bg-slate-500'
                      }`}
                      title={emitter.visible ? 'Hide in viewport' : 'Show in viewport'}
                    >
                      {emitter.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    {settings.emitters.length > 1 && (
                      <button
                        onClick={() => handleRemoveEmitter(emitter.id)}
                        className="p-1 bg-red-600 hover:bg-red-700 rounded"
                        title="Remove emitter"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

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
                {em.looping && (
                  <div className="absolute top-1.5 right-1.5 bg-green-600/70 px-2 py-0.5 rounded text-[10px] font-mono">
                    🔄 LOOP
                  </div>
                )}
                {em.prewarm && (
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
                      checked={em.looping}
                      onChange={e => {
                        const newLooping = e.target.checked;
                        updateEmitter({ looping: newLooping,
                            prewarm: newLooping ? em.prewarm : false
                           });
                      }}
                      className="rounded"
                    />
                    <span className="text-xs text-slate-300">Looping</span>
                  </label>

                  {em.looping && (
                    <>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={em.prewarm}
                          onChange={e => {
                            updateEmitter({ prewarm: e.target.checked  });
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
                      value={em.startDelay}
                      onChange={e => updateEmitter({ startDelay: Number(e.target.value)  })}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs text-slate-300">Emission Type</span>
                  <select
                    value={em.emissionType}
                    onChange={e => updateEmitter({ emissionType: e.target.value as any  })}
                    className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                  >
                    <option value="continuous">🌊 Continuous</option>
                    <option value="burst">💥 Burst</option>
                    <option value="duration">⏱️ Duration</option>
                  </select>
                </label>

                {em.emissionType === 'burst' && (
                  <div className="space-y-2 pl-2 border-l-2 border-purple-500">
                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Count</span>
                      <input
                        type="number"
                       
                        max="500"
                        value={em.burstCount}
                        onChange={e => updateEmitter({ burstCount: Number(e.target.value)  })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Cycles</span>
                      <input
                        type="number"
                       
                        max="20"
                        value={em.burstCycles}
                        onChange={e => updateEmitter({ burstCycles: Number(e.target.value)  })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Interval (sec)</span>
                      <input
                        type="number"
                       
                        max="5"
                        step="0.1"
                        value={em.burstInterval}
                        onChange={e => updateEmitter({ burstInterval: Number(e.target.value)  })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  </div>
                )}

                {em.emissionType === 'duration' && (
                  <div className="space-y-2 pl-2 border-l-2 border-blue-500">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Start (sec)</span>
                        <input
                          type="number"
                         
                          max={em.durationEnd - 0.1}
                          step="0.1"
                          value={em.durationStart}
                          onChange={e => updateEmitter({ durationStart: Number(e.target.value)  })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs text-slate-300">End (sec)</span>
                        <input
                          type="number"
                          max={settings.duration}
                          step="0.1"
                          value={em.durationEnd}
                          onChange={e => updateEmitter({ durationEnd: Number(e.target.value)  })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs text-slate-300">Rate (per sec)</span>
                      <input
                        type="number"
                       
                        max="200"
                        value={em.rate}
                        onChange={e => updateEmitter({ rate: Number(e.target.value)  })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs text-slate-300">Shape</span>
                  <select value={em.shape} onChange={e => updateEmitter({ shape: e.target.value as any  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs">
                    <option value="point">📍 Point</option>
                    <option value="line">➖ Line</option>
                    <option value="circle">⭕ Circle</option>
                    <option value="rectangle">⬜ Rectangle</option>
                    <option value="roundedRect">▢ Rounded</option>
                  </select>
                </label>

                {em.shape !== 'point' && em.shape !== 'line' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Mode</span>
                    <select value={em.emissionMode} onChange={e => updateEmitter({ emissionMode: e.target.value as any  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs">
                      <option value="area">🟢 Inside</option>
                      <option value="edge">🟠 Edge</option>
                    </select>
                  </label>
                )}

                {em.shape === 'line' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Length</span>
                    <input type="number" max="400" value={em.lineLength} onChange={e => updateEmitter({ lineLength: Number(e.target.value)  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                {em.shape === 'circle' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Radius</span>
                    <input type="number" max="150" value={em.shapeRadius} onChange={e => updateEmitter({ shapeRadius: Number(e.target.value)  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                {(em.shape === 'rectangle' || em.shape === 'roundedRect') && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Width</span>
                      <input type="number" max="300" value={em.shapeWidth} onChange={e => updateEmitter({ shapeWidth: Number(e.target.value)  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-300">Height</span>
                      <input type="number" max="300" value={em.shapeHeight} onChange={e => updateEmitter({ shapeHeight: Number(e.target.value)  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                    </label>
                  </div>
                )}

                {em.shape === 'roundedRect' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Corner Radius</span>
                    <input type="number" max={Math.min(50, em.shapeWidth / 2, em.shapeHeight / 2)} value={em.roundRadius} onChange={e => updateEmitter({ roundRadius: Number(e.target.value)  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Angle</span>
                    <input type="number" max="180" value={em.angle} onChange={e => updateEmitter({ angle: Number(e.target.value)  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Spread</span>
                    <input type="number" max="360" value={em.angleSpread} onChange={e => updateEmitter({ angleSpread: Number(e.target.value)  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                </div>

                {em.emissionType === 'continuous' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Rate (per sec)</span>
                    <input type="number" max="200" value={em.rate} onChange={e => updateEmitter({ rate: Number(e.target.value)  })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
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
                    <input type="number" step="0.1" value={em.lifeTimeMin} onChange={e => updateEmitter({ lifeTimeMin: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Life Max (s)</span>
                    <input type="number" step="0.1" value={em.lifeTimeMax} onChange={e => updateEmitter({ lifeTimeMax: Number(e.target.value) })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs" />
                  </label>
                </div>

                <RangeInput
                  label="Start Speed Range"
                  helper="Initial emission velocity"
                  range={em.initialSpeedRange}
                  onChange={range => updateEmitter({ initialSpeedRange: range })}
                />

                <label className="block">
                  <span className="text-xs text-slate-300">Particle Sprite</span>
                  <select 
                    value={em.particleSprite} 
                    onChange={e => {
                      const newSprite = e.target.value as any;
                      updateEmitter({ particleSprite: newSprite });
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

                {em.particleSprite === 'custom' && (
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
                      value={em.spawnAngleMode}
                      onChange={e => updateEmitter({ spawnAngleMode: e.target.value as ParticleSettings['spawnAngleMode'] })}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    >
                      <option value="alignMotion">Align to Motion</option>
                      <option value="specific">Specific Angle</option>
                      <option value="random">Random</option>
                      <option value="range">Random Between Angles</option>
                    </select>
                  </label>

                  {em.spawnAngleMode === 'specific' && (
                    <label className="block">
                      <span className="text-xs text-slate-300">Angle (deg)</span>
                      <input
                        type="number"
                       
                        max="360"
                        value={em.spawnAngle}
                        onChange={e => updateEmitter({ spawnAngle: Number(e.target.value) })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  )}

                  {em.spawnAngleMode === 'range' && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Min (deg)</span>
                        <input
                          type="number"
                         
                          max="360"
                          value={em.spawnAngleMin}
                          onChange={e => updateEmitter({ spawnAngleMin: Number(e.target.value) })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Max (deg)</span>
                        <input
                          type="number"
                         
                          max="360"
                          value={em.spawnAngleMax}
                          onChange={e => updateEmitter({ spawnAngleMax: Number(e.target.value) })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                    </div>
                  )}

                  {em.spawnAngleMode === 'alignMotion' && (
                    <p className="text-[10px] text-slate-500 mt-1">Faces the initial velocity direction.</p>
                  )}
                  {em.spawnAngleMode === 'random' && (
                    <p className="text-[10px] text-slate-500 mt-1">Fully random 0–360° start angle.</p>
                  )}
                  {em.spawnAngleMode === 'specific' && (
                    <p className="text-[10px] text-slate-500 mt-1">Spawns every particle at the defined angle.</p>
                  )}
                  {em.spawnAngleMode === 'range' && (
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
                    range={em.gravityRange}
                    onChange={range => updateEmitter({ gravityRange: range })}
                  />
                  <CurveEditor
                    label="Gravity Multiplier (0-1)"
                    curve={em.gravityOverLifetime}
                    onChange={curve => updateEmitter({ gravityOverLifetime: curve })}
                    onReset={() => updateEmitter({ gravityOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.gravity) })}
                    max={1}
                  />

                  <RangeInput
                    label="Drag Base Range"
                    helper="Random damping factor"
                    range={em.dragRange}
                    onChange={range => updateEmitter({ dragRange: range })}
                  />
                  <div className="mt-2">
                    <CurveEditor
                      label="Drag Multiplier (0-1)"
                      curve={em.dragOverLifetime}
                      onChange={curve => updateEmitter({ dragOverLifetime: curve })}
                      onReset={() => updateEmitter({ dragOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.drag) })}
                      max={1}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-purple-300 mb-2">🌪️ Noise Field</h4>

                  <RangeInput
                    label="Noise Strength Range"
                    helper="Base force (random)"
                    range={em.noiseStrengthRange}
                    onChange={range => updateEmitter({ noiseStrengthRange: range })}
                  />
                  <CurveEditor
                    label="Noise Strength Multiplier (0-1)"
                    curve={em.noiseStrengthOverLifetime}
                    onChange={curve => updateEmitter({ noiseStrengthOverLifetime: curve })}
                    onReset={() => updateEmitter({ noiseStrengthOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.noise) })}
                    max={1}
                  />

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <RangeInput
                      label="Frequency Range"
                      helper="Lower = bigger swirls"
                      range={em.noiseFrequencyRange}
                      onChange={range => updateEmitter({ noiseFrequencyRange: range })}
                    />
                    <RangeInput
                      label="Speed Range"
                      helper="Flow animation speed"
                      range={em.noiseSpeedRange}
                      onChange={range => updateEmitter({ noiseSpeedRange: range })}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-pink-300 mb-2">🌀 Vortex Force</h4>

                  <RangeInput
                    label="Vortex Strength Range"
                    helper="Random between two numbers"
                    range={em.vortexStrengthRange}
                    onChange={range => updateEmitter({ vortexStrengthRange: range })}
                  />
                  <CurveEditor
                    label="Vortex Strength Multiplier (0-1)"
                    curve={em.vortexStrengthOverLifetime}
                    onChange={curve => updateEmitter({ vortexStrengthOverLifetime: curve })}
                    onReset={() => updateEmitter({ vortexStrengthOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.vortex) })}
                    max={1}
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Center X</span>
                      <input
                        type="number"
                        value={em.vortexPoint.x} 
                        onChange={e => updateSettings({ 
                          ...settings, 
                          vortexPoint: { ...em.vortexPoint, x: Number(e.target.value) }
                        })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-slate-300">Center Y</span>
                      <input 
                        type="number" 
                        value={em.vortexPoint.y} 
                        onChange={e => updateSettings({ 
                          ...settings, 
                          vortexPoint: { ...em.vortexPoint, y: Number(e.target.value) }
                        })} 
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 mt-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={em.showVortexVisualization}
                      onChange={e => updateEmitter({ showVortexVisualization: e.target.checked })}
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
                    range={em.angularVelocityRange}
                    onChange={range => updateEmitter({ angularVelocityRange: range })}
                  />
                  <CurveEditor
                    label="Spin Speed Multiplier (0-1)"
                    curve={em.angularVelocityOverLifetime}
                    onChange={curve => updateEmitter({ angularVelocityOverLifetime: curve })}
                    onReset={() => updateEmitter({ angularVelocityOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.angularVelocity) })}
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
                    gradient={em.colorOverLifetime}
                    onChange={gradient => updateEmitter({ colorOverLifetime: gradient })}
                  />
                </div>

                <RangeInput
                  label="Size X Base Range"
                  helper="Random between two numbers"
                  range={em.sizeXRange}
                  onChange={range => updateEmitter({ sizeXRange: range })}
                />
                <CurveEditor
                  label="Size X Multiplier (0-1)"
                  curve={em.sizeXOverLifetime}
                  onChange={curve => updateEmitter({ sizeXOverLifetime: curve })}
                  onReset={() => updateEmitter({ sizeXOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.sizeX) })}
                  max={1}
                />
                <RangeInput
                  label="Size Y Base Range"
                  helper="Random between two numbers"
                  range={em.sizeYRange}
                  onChange={range => updateEmitter({ sizeYRange: range })}
                />
                <CurveEditor
                  label="Size Y Multiplier (0-1)"
                  curve={em.sizeYOverLifetime}
                  onChange={curve => updateEmitter({ sizeYOverLifetime: curve })}
                  onReset={() => updateEmitter({ sizeYOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.sizeY) })}
                  max={1}
                />
                <RangeInput
                  label="Speed Base Range"
                  helper="Random between two numbers"
                  range={em.speedRange}
                  onChange={range => updateEmitter({ speedRange: range })}
                />
                <CurveEditor
                  label="Speed Multiplier (0-1)"
                  curve={em.speedOverLifetime}
                  onChange={curve => updateEmitter({ speedOverLifetime: curve })}
                  onReset={() => updateEmitter({ speedOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.speed) })}
                  max={1}
                />
                <RangeInput
                  label="Weight Base Range"
                  helper="Random between two numbers"
                  range={em.weightRange}
                  onChange={range => updateEmitter({ weightRange: range })}
                />
                <CurveEditor
                  label="Weight Multiplier (0-1)"
                  curve={em.weightOverLifetime}
                  onChange={curve => updateEmitter({ weightOverLifetime: curve })}
                  onReset={() => updateEmitter({ weightOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.weight) })}
                  max={1}
                />
                <RangeInput
                  label="Attraction Base Range"
                  helper="Random between two numbers"
                  range={em.attractionRange}
                  onChange={range => updateEmitter({ attractionRange: range })}
                />
                <CurveEditor
                  label="Attraction Multiplier (0-1)"
                  curve={em.attractionOverLifetime}
                  onChange={curve => updateEmitter({ attractionOverLifetime: curve })}
                  onReset={() => updateEmitter({ attractionOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.attraction) })}
                  max={1}
                />

                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <RangeInput
                    label="Spin Base Range (deg/sec)"
                    helper="Random between two numbers"
                    range={em.spinRange}
                    onChange={range => updateEmitter({ spinRange: range })}
                  />
                  <CurveEditor
                    label="Spin Multiplier (0-1)"
                    curve={em.spinOverLifetime}
                    onChange={curve => updateEmitter({ spinOverLifetime: curve })}
                    onReset={() => updateEmitter({ spinOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.spin) })}
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
                  {em.looping && (
                    <>
                      <div className="text-green-400">🔄 Loop Mode: Enabled</div>
                      {em.prewarm && (
                        <div className="text-blue-400">⚡ Prewarm: Active</div>
                      )}
                      {em.startDelay > 0 && (
                        <div className="text-yellow-400">⏱️ Start Delay: {em.startDelay}s</div>
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

                <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">Emitters to Export</div>
                {settings.emitters.map((emitter, index) => (
                  <label key={emitter.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emitter.enabled}
                      onChange={() => handleToggleEmitterExport(emitter.id)}
                      className="rounded"
                    />
                    <span>{emitter.name}</span>
                    {!emitter.enabled && <span className="text-slate-500 text-[10px]">(disabled)</span>}
                  </label>
                ))}

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
