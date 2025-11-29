/**
 * Particle → Spine Exporter v101 (Alpha) - Main Component
 *
 * Version: 101
 * Date: 2025-11-28
 *
 * Changes in v101:
 * - Custom sprites now retain their original resolution instead of being downscaled on import
 * - Emitter settings live alongside the emitter list with clearer rate controls per emission mode
 * - Curve multipliers are clamped to -1..1 with flexible numeric inputs that allow negatives and decimals
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Download, Trash2, Plus, Eye, EyeOff } from 'lucide-react';

// Type imports
import type { ParticleSettings, EmitterInstance, BakedFrame } from './types';
import { DEFAULT_SETTINGS, createEmitterInstance, DEFAULT_CURVE_PRESETS } from './types';

// Component imports
import {
  ColorGradientEditor,
  NumericInput,
  CurveEditor,
  Timeline,
  RangeInput,
  CollapsibleSection,
} from './components';

// Core imports
import { ParticleSystem } from './core';

// Export imports
import { createParticleSprite, bakeParticleAnimation, renderBakedPreview, generateSpineJSON, SimpleZip, downloadBlob } from './export';
import { copyCurve } from './utils';

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
  const [spriteCanvases, setSpriteCanvases] = useState<Record<string, HTMLCanvasElement | null>>({});

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
  const spriteCacheRef = useRef<Record<string, HTMLCanvasElement | null>>({});
  const spriteSignatureRef = useRef<Record<string, string>>({});

  const hasLoopingContinuousEmitter = useMemo(
    () => settings.emitters.some(em => em.settings.emissionType === 'continuous' && em.settings.looping),
    [settings.emitters]
  );

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
          emitterId: p.emitterId,
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
          baseSpeed: p.baseSpeed,
          windStrengthMultiplier: p.windStrengthMultiplier,
          windDirectionOffset: p.windDirectionOffset,
          windTurbulenceOffset: p.windTurbulenceOffset,
        });
      }
      
      frames.push({ time, particles: particlesSnapshot });
      
      if (i < frameCount) {
        system.update(dt);
      }
    }
    
    return frames;
  }, [settings.duration]);

  const renderBakedFrame = useCallback((targetTime: number, frames: BakedFrame[] | null = bakedSimulation) => {
    if (!frames || !canvasRef.current || !systemRef.current) return;

    const dt = 1 / 60;
    const frameIndex = Math.floor(targetTime / dt);
    const clampedIndex = Math.max(0, Math.min(frameIndex, frames.length - 1));
    const frame = frames[clampedIndex];
    
    if (!frame) return;
    
    // Restore particles from baked frame
    systemRef.current.particles = [];
    systemRef.current.time = targetTime;
    
    for (const [id, data] of frame.particles) {
      const numericId = typeof id === 'number' ? id : Number(id);
      systemRef.current.particles.push({
        id: Number.isFinite(numericId) ? numericId : 0,
        emitterId: data.emitterId,
        x: data.x,
        y: data.y,
        vx: (data as any).vx ?? 0,
        vy: (data as any).vy ?? 0,
        rotation: data.rotation,
        scale: data.scale,
        scaleX: data.scaleX,
        scaleY: data.scaleY,
        alpha: data.alpha,
        color: { ...data.color },
        life: (data as any).life ?? 0,
        maxLife: (data as any).maxLife ?? 0,
        baseSpeed: (data as any).baseSpeed ?? 0,
        baseSpinRate: (data as any).baseSpinRate ?? 0,
        baseAngularVelocity: (data as any).baseAngularVelocity ?? 0,
        baseGravity: (data as any).baseGravity ?? 0,
        baseDrag: (data as any).baseDrag ?? 1,
        baseNoiseStrength: (data as any).baseNoiseStrength ?? 0,
        baseNoiseFrequency: (data as any).baseNoiseFrequency ?? 0,
        baseNoiseSpeed: (data as any).baseNoiseSpeed ?? 0,
        baseAttraction: (data as any).baseAttraction ?? 0,
        baseVortexStrength: (data as any).baseVortexStrength ?? 0,
        baseSpeedScale: (data as any).baseSpeedScale ?? 1,
        baseWeight: (data as any).baseWeight ?? 1,
        baseSizeX: (data as any).baseSizeX ?? 1,
        baseSizeY: (data as any).baseSizeY ?? 1,
        windStrengthMultiplier: (data as any).windStrengthMultiplier ?? 1,
        windDirectionOffset: (data as any).windDirectionOffset ?? 0,
        windTurbulenceOffset: (data as any).windTurbulenceOffset ?? { x: 0, y: 0 },
      });
    }
    
    const ctx = canvasRef.current.getContext('2d')!;
    systemRef.current.render(ctx, showEmitter, zoom, spriteCanvases, showGrid, backgroundImage, bgPosition);
    setLiveParticleCount(systemRef.current.particles.length);
  }, [bakedSimulation, showEmitter, zoom, spriteCanvases, showGrid, backgroundImage, bgPosition]);

  const handleTimelineTimeChange = useCallback((newTime: number) => {
    setCurrentTime(newTime);
    setIsPlaying(false);
    
    let frames = bakedSimulation;
    if (!frames || needsRebake) {
      frames = bakeSimulation();
      setBakedSimulation(frames);
      setNeedsRebake(false);
    }

    renderBakedFrame(newTime, frames);
  }, [bakedSimulation, needsRebake, bakeSimulation, renderBakedFrame]);

  const handlePlayPause = useCallback(() => {
    if (!isPlaying && (needsRebake || !bakedSimulation)) {
      const newBake = bakeSimulation();
      setBakedSimulation(newBake);
      setNeedsRebake(false);
    }

    // If playback reached the end, restart the simulation before playing again
    if (
      !isPlaying &&
      !hasLoopingContinuousEmitter &&
      settings.duration > 0 &&
      systemRef.current &&
      systemRef.current.time >= settings.duration
    ) {
      systemRef.current.reset();
      setCurrentTime(0);
      setLiveParticleCount(systemRef.current.particles.length);

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        systemRef.current.render(ctx, showEmitter, zoom, spriteCanvases, showGrid, backgroundImage, bgPosition);
      }
    }

    setIsPlaying(prev => !prev);
  }, [
    isPlaying,
    needsRebake,
    bakedSimulation,
    bakeSimulation,
    hasLoopingContinuousEmitter,
    settings.duration,
    showEmitter,
    zoom,
    spriteCanvases,
    showGrid,
    backgroundImage,
    bgPosition,
  ]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  useEffect(() => {
    systemRef.current = new ParticleSystem(settings);
  }, []);

  const setEmitterSprite = useCallback((emitterId: string, canvas: HTMLCanvasElement | null) => {
    spriteCacheRef.current[emitterId] = canvas;
    setSpriteCanvases(prev => ({ ...prev, [emitterId]: canvas }));
  }, []);

  const refreshEmitterSprite = useCallback((emitter: EmitterInstance) => {
    const signature = `${emitter.settings.particleSprite}:${emitter.settings.customSpriteData || ''}`;

    if (spriteSignatureRef.current[emitter.id] === signature && spriteCacheRef.current[emitter.id]) {
      return;
    }

    spriteSignatureRef.current[emitter.id] = signature;

    if (emitter.settings.particleSprite === 'custom') {
      if (!emitter.settings.customSpriteData) {
        setEmitterSprite(emitter.id, null);
        setSpriteStatus('Upload a sprite image to use the custom option');
        return;
      }

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        setEmitterSprite(emitter.id, canvas);
        setSpriteStatus(`Custom sprite loaded for ${emitter.name}`);
      };
      img.onerror = () => setSpriteStatus(`Unable to load the selected sprite image for ${emitter.name}`);
      img.src = emitter.settings.customSpriteData;
    } else {
      const canvas = createParticleSprite(emitter.settings.particleSprite as any, 64);
      setEmitterSprite(emitter.id, canvas);
      setSpriteStatus(null);
    }
  }, [setEmitterSprite]);

  useEffect(() => {
    const emitterIds = new Set(settings.emitters.map(e => e.id));

    setSpriteCanvases(prev => {
      const updated = { ...prev } as Record<string, HTMLCanvasElement | null>;
      for (const key of Object.keys(updated)) {
        if (!emitterIds.has(key)) {
          delete updated[key];
          delete spriteCacheRef.current[key];
          delete spriteSignatureRef.current[key];
        }
      }
      return updated;
    });

    for (const emitter of settings.emitters) {
      refreshEmitterSprite(emitter);
    }
  }, [settings.emitters, refreshEmitterSprite]);

  useEffect(() => {
    if (!canvasRef.current || !systemRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const realDt = (time - lastTime) / 1000;
      lastTime = time;

      if (isPlaying && systemRef.current) {
        if (!hasLoopingContinuousEmitter && settings.duration > 0 && systemRef.current.time >= settings.duration) {
          systemRef.current.time = settings.duration;
          systemRef.current.render(ctx, showEmitter, zoom, spriteCanvases, showGrid, backgroundImage, bgPosition);
          setLiveParticleCount(systemRef.current.particles.length);
          setCurrentTime(settings.duration);
          setIsPlaying(false);
          return;
        }

        const dt = Math.min(realDt * playbackSpeed, 0.1);
        let appliedDt = dt;

        if (!hasLoopingContinuousEmitter && settings.duration > 0) {
          const remaining = settings.duration - systemRef.current.time;
          appliedDt = Math.max(0, Math.min(dt, remaining));
        }

        systemRef.current.update(appliedDt);

        const newTime = systemRef.current.time;
        const clampedTime = !hasLoopingContinuousEmitter && settings.duration > 0
          ? Math.min(newTime, settings.duration)
          : newTime;

        systemRef.current.render(ctx, showEmitter, zoom, spriteCanvases, showGrid, backgroundImage, bgPosition);
        setLiveParticleCount(systemRef.current.particles.length);
        setCurrentTime(clampedTime);

        if (!hasLoopingContinuousEmitter && settings.duration > 0 && newTime >= settings.duration) {
          systemRef.current.time = settings.duration;
          setIsPlaying(false);
          return;
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, showEmitter, zoom, spriteCanvases, showGrid, backgroundImage, bgPosition, playbackSpeed, settings.duration, hasLoopingContinuousEmitter]);

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

  const handleEmissionTypeChange = useCallback((type: EmitterInstance['settings']['emissionType']) => {
    const updates: Partial<EmitterInstance['settings']> = { emissionType: type };

    if (type !== 'continuous') {
      updates.looping = false;
      updates.prewarm = false;
    }

    updateEmitter(updates);
  }, [updateEmitter]);

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
      setIsPlaying(false);

      // Render initial state
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')!;
        systemRef.current.render(ctx, showEmitter, zoom, spriteCanvases, showGrid, backgroundImage, bgPosition);
        setLiveParticleCount(systemRef.current.particles.length);
      }
    }
  };

  const handlePlaybackRestart = () => {
    if (!systemRef.current) return;

    systemRef.current.reset();
    setCurrentTime(0);
    setLiveParticleCount(systemRef.current.particles.length);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')!;
      systemRef.current.render(ctx, showEmitter, zoom, spriteCanvases, showGrid, backgroundImage, bgPosition);
    }

    if (!bakedSimulation || needsRebake) {
      const frames = bakeSimulation();
      setBakedSimulation(frames);
      setNeedsRebake(false);
    }

    setIsPlaying(true);
  };

  const handleReset = () => {
    spriteCacheRef.current = {};
    spriteSignatureRef.current = {};
    setSpriteCanvases({});
    setSpriteStatus(null);
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
          setSpriteStatus(`Custom sprite loaded for ${settings.emitters[settings.currentEmitterIndex]?.name || 'Emitter'}`);
        };
        img.onerror = () => setSpriteStatus('Failed to decode the selected sprite image.');
        img.src = data;
      };
      reader.onerror = () => setSpriteStatus('Failed to read the selected sprite file.');
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const resolveEmitterSpriteCanvas = useCallback(async (emitter: EmitterInstance) => {
    const cached = spriteCacheRef.current[emitter.id];
    if (cached) return cached;

    if (emitter.settings.particleSprite === 'custom' && emitter.settings.customSpriteData) {
      return await new Promise<HTMLCanvasElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, img.width, img.height);
          spriteCacheRef.current[emitter.id] = canvas;
          setSpriteCanvases(prev => ({ ...prev, [emitter.id]: canvas }));
          resolve(canvas);
        };
        img.onerror = () => reject(new Error(`Failed to load custom sprite for ${emitter.name}`));
        img.src = emitter.settings.customSpriteData!;
      });
    }

    const spriteType = emitter.settings.particleSprite === 'custom' ? 'circle' : emitter.settings.particleSprite;
    const canvas = createParticleSprite(spriteType as any, 64);
    spriteCacheRef.current[emitter.id] = canvas;
    setSpriteCanvases(prev => ({ ...prev, [emitter.id]: canvas }));
    return canvas;
  }, []);

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
          const numericId = typeof id === 'number' ? id : Number(id);
          if (Number.isFinite(numericId)) {
            uniqueParticles.add(numericId);
          }
        }
      }
      setExportStatus(`✓ ${frames.length} frames, ${uniqueParticles.size} particles`);
      await new Promise(resolve => setTimeout(resolve, 50));

      const spriteNameMap = new Map<string, string>();
      const emitterSprites: Array<{ emitterId: string; name: string; canvas: HTMLCanvasElement }> = [];

      for (let i = 0; i < settings.emitters.length; i++) {
        const emitter = settings.emitters[i];
        if (!emitter.enabled) continue;

        const spriteName = `sprite_${i + 1}`;
        spriteNameMap.set(emitter.id, spriteName);

        const spriteCanvas = await resolveEmitterSpriteCanvas(emitter);
        emitterSprites.push({ emitterId: emitter.id, name: spriteName, canvas: spriteCanvas });
      }

      const spineJSON = generateSpineJSON(frames, prewarmFrames, settings, spriteNameMap);
      const previewCanvas = renderBakedPreview(frames, settings);

      const zip = new SimpleZip();
      for (const sprite of emitterSprites) {
        await zip.addCanvasFile(`${sprite.name}.png`, sprite.canvas);
      }
      await zip.addCanvasFile('preview.png', previewCanvas);
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

  const updateWind = useCallback((partialWind: Partial<EmitterInstance['settings']['wind']>) => {
    if (!em) return;
    updateEmitter({ wind: { ...em.wind, ...partialWind } });
  }, [em, updateEmitter]);

  useEffect(() => {
    if (!em) return;
    if (em.emissionType !== 'continuous' && (em.looping || em.prewarm)) {
      updateEmitter({ looping: false, prewarm: false });
    }
  }, [em?.emissionType, em?.looping, em?.prewarm, updateEmitter]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-[1870px] mx-auto">
        <header className="mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Particle → Spine Exporter v101
          </h1>
          <p className="text-xs text-slate-400">Full-res custom sprites • Relocated emitter controls • Multiplier curves clamped to -1..1</p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-4 xl:[grid-template-columns:repeat(4,minmax(352px,1fr))] gap-6 items-start">
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
            <CollapsibleSection title="🎯 Emitter Settings" isOpen={emitterOpen} onToggle={() => setEmitterOpen(!emitterOpen)}>
              <div className="space-y-2">
                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-blue-300 mb-2">🔄 Loop Settings</h4>

                  {em.emissionType === 'continuous' && (
                    <>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={em.looping}
                          onChange={e => {
                            const newLooping = e.target.checked;
                            updateEmitter({
                              looping: newLooping,
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
                                updateEmitter({ prewarm: e.target.checked });
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
                    </>
                  )}

                  <label className="block">
                    <span className="text-xs text-slate-300">Start Delay (sec)</span>
                    <NumericInput
                      value={em.startDelay}
                      onValueChange={value => updateEmitter({ startDelay: value })}
                      max={5}
                      step={0.1}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs text-slate-300">Emission Type</span>
                  <select
                    value={em.emissionType}
                    onChange={e => handleEmissionTypeChange(e.target.value as any)}
                    className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                  >
                    <option value="continuous">🌊 Continuous</option>
                    <option value="burst">💥 Burst</option>
                    <option value="duration">⏱️ Duration</option>
                  </select>
                </label>

                {em.emissionType === 'continuous' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Rate (per sec)</span>
                    <NumericInput
                      value={em.rate}
                      onValueChange={value => updateEmitter({ rate: value })}
                      max={200}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                )}

                {em.emissionType === 'burst' && (
                  <div className="space-y-2 pl-2 border-l-2 border-purple-500">
                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Count</span>
                      <NumericInput
                        value={em.burstCount}
                        onValueChange={value => updateEmitter({ burstCount: value })}
                        max={500}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Cycles</span>
                      <NumericInput
                        value={em.burstCycles}
                        onValueChange={value => updateEmitter({ burstCycles: value })}
                        max={20}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-slate-300">Burst Interval (sec)</span>
                      <NumericInput
                        value={em.burstInterval}
                        onValueChange={value => updateEmitter({ burstInterval: value })}
                        max={5}
                        step={0.1}
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
                        <NumericInput
                          value={em.durationStart}
                          onValueChange={value => updateEmitter({ durationStart: value })}
                          max={em.durationEnd - 0.1}
                          step={0.1}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>

                      <label className="block">
                        <span className="text-xs text-slate-300">End (sec)</span>
                        <NumericInput
                          value={em.durationEnd}
                          onValueChange={value => updateEmitter({ durationEnd: value })}
                          max={settings.duration}
                          step={0.1}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs text-slate-300">Rate (per sec)</span>
                      <NumericInput
                        value={em.rate}
                        onValueChange={value => updateEmitter({ rate: value })}
                        max={200}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  </div>
                )}

                {em.emissionType !== 'burst' && (
                  <CurveEditor
                    label="Rate Multiplier (-1 to 1)"
                    curve={em.rateOverTime}
                    onChange={curve => updateEmitter({ rateOverTime: curve })}
                    onReset={() => updateEmitter({ rateOverTime: copyCurve(DEFAULT_CURVE_PRESETS.rate) })}
                    min={-1}
                    max={1}
                    autoScale={false}
                  />
                )}

                <label className="block">
                  <span className="text-xs text-slate-300">Shape</span>
                  <select value={em.shape} onChange={e => updateEmitter({ shape: e.target.value as any })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs">
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
                    <select value={em.emissionMode} onChange={e => updateEmitter({ emissionMode: e.target.value as any })} className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs">
                      <option value="area">🟢 Inside</option>
                      <option value="edge">🟠 Edge</option>
                    </select>
                  </label>
                )}

                {em.shape === 'line' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Length</span>
                    <NumericInput
                      value={em.lineLength}
                      onValueChange={value => updateEmitter({ lineLength: value })}
                      max={400}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                )}

                {em.shape === 'line' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Spread Cone Rotation (°)</span>
                    <NumericInput
                      value={em.lineSpreadRotation}
                      onValueChange={value => updateEmitter({ lineSpreadRotation: value })}
                      min={-180}
                      max={180}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Rotate the emission cone independently from the line itself.</p>
                  </label>
                )}

                {em.shape === 'circle' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Radius</span>
                    <NumericInput
                      value={em.shapeRadius}
                      onValueChange={value => updateEmitter({ shapeRadius: value })}
                      max={150}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                )}

                {(em.shape === 'rectangle' || em.shape === 'roundedRect') && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Width</span>
                      <NumericInput
                        value={em.shapeWidth}
                        onValueChange={value => updateEmitter({ shapeWidth: value })}
                        max={300}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-300">Height</span>
                      <NumericInput
                        value={em.shapeHeight}
                        onValueChange={value => updateEmitter({ shapeHeight: value })}
                        max={300}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  </div>
                )}

                {em.shape === 'roundedRect' && (
                  <label className="block">
                    <span className="text-xs text-slate-300">Corner Radius</span>
                    <NumericInput
                      value={em.roundRadius}
                      onValueChange={value => updateEmitter({ roundRadius: value })}
                      max={Math.min(50, em.shapeWidth / 2, em.shapeHeight / 2)}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Angle</span>
                    <NumericInput
                      value={em.angle}
                      onValueChange={value => updateEmitter({ angle: value })}
                      max={180}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Spread</span>
                    <NumericInput
                      value={em.angleSpread}
                      onValueChange={value => updateEmitter({ angleSpread: value })}
                      max={360}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                </div>
              </div>
            </CollapsibleSection>

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
                  onPlaybackRestart={handlePlaybackRestart}
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



          </div>

          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
            <CollapsibleSection title="✨ Particle Settings" isOpen={particleOpen} onToggle={() => setParticleOpen(!particleOpen)}>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs text-slate-300">Life Min (s)</span>
                    <NumericInput
                      value={em.lifeTimeMin}
                      onValueChange={value => updateEmitter({ lifeTimeMin: value })}
                      step={0.1}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-slate-300">Life Max (s)</span>
                    <NumericInput
                      value={em.lifeTimeMax}
                      onValueChange={value => updateEmitter({ lifeTimeMax: value })}
                      step={0.1}
                      className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                    />
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
                        setSpriteStatus(null);
                      }
                    }}
                    className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                  >
                    <option value="circle">⚪ Circle</option>
                    <option value="glow">✨ Glow</option>
                    <option value="star">⭐ Star</option>
                    <option value="polygon">⬡ Polygon</option>
                    <option value="needle">📍 Needle</option>
                    <option value="raindrop">💧 Raindrop</option>
                    <option value="snowflake">❄️ Snowflake</option>
                    <option value="smoke">🌫️ Smoke</option>
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
                      onChange={e => updateEmitter({ spawnAngleMode: e.target.value as EmitterInstance['settings']['spawnAngleMode'] })}
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
                      <NumericInput
                        value={em.spawnAngle}
                        onValueChange={value => updateEmitter({ spawnAngle: value })}
                        max={360}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  )}

                  {em.spawnAngleMode === 'range' && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Min (deg)</span>
                        <NumericInput
                          value={em.spawnAngleMin}
                          onValueChange={value => updateEmitter({ spawnAngleMin: value })}
                          max={360}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Max (deg)</span>
                        <NumericInput
                          value={em.spawnAngleMax}
                          onValueChange={value => updateEmitter({ spawnAngleMax: value })}
                          max={360}
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
                    label="Gravity Multiplier (-1 to 1)"
                    curve={em.gravityOverLifetime}
                    onChange={curve => updateEmitter({ gravityOverLifetime: curve })}
                    onReset={() => updateEmitter({ gravityOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.gravity) })}
                    min={-1}
                    max={1}
                    autoScale={false}
                  />

                  <RangeInput
                    label="Drag Base Range"
                    helper="Random damping factor"
                    range={em.dragRange}
                    onChange={range => updateEmitter({ dragRange: range })}
                  />
                  <div className="mt-2">
                    <CurveEditor
                      label="Drag Multiplier (-1 to 1)"
                      curve={em.dragOverLifetime}
                      onChange={curve => updateEmitter({ dragOverLifetime: curve })}
                      onReset={() => updateEmitter({ dragOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.drag) })}
                      min={-1}
                      max={1}
                      autoScale={false}
                    />
                  </div>
                </div>

                <div className="bg-slate-900/30 p-2 rounded border border-slate-700">
                  <h4 className="text-xs font-semibold text-amber-200 mb-2">🍃 Wind Field</h4>

                  <label className="flex items-center gap-2 mb-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={em.wind.enabled}
                      onChange={e => updateWind({ enabled: e.target.checked })}
                      className="h-4 w-4 text-amber-400 rounded border-slate-600 bg-slate-900"
                    />
                    <span>Enable wind acceleration</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Direction Mode</span>
                      <select
                        value={em.wind.directionMode}
                        onChange={e => updateWind({ directionMode: e.target.value as any })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      >
                        <option value="angle">Angle (deg)</option>
                        <option value="vector">Vector</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-300">Strength (accel)</span>
                      <NumericInput
                        value={em.wind.strength}
                        onValueChange={value => updateWind({ strength: value })}
                        min={0}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  </div>

                  {em.wind.directionMode === 'angle' && (
                    <label className="block mt-2">
                      <span className="text-xs text-slate-300">Direction (deg)</span>
                      <NumericInput
                        value={em.wind.directionAngle}
                        onValueChange={value => updateWind({ directionAngle: value })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  )}

                  {em.wind.directionMode === 'vector' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Dir X</span>
                        <NumericInput
                          value={em.wind.directionVector.x}
                          onValueChange={value => updateWind({ directionVector: { ...em.wind.directionVector, x: value } })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Dir Y</span>
                        <NumericInput
                          value={em.wind.directionVector.y}
                          onValueChange={value => updateWind({ directionVector: { ...em.wind.directionVector, y: value } })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Strength Rand (0-1)</span>
                      <NumericInput
                        value={em.wind.strengthRandomness}
                        onValueChange={value => updateWind({ strengthRandomness: value })}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-300">Direction Rand (deg)</span>
                      <NumericInput
                        value={em.wind.directionRandomness}
                        onValueChange={value => updateWind({ directionRandomness: value })}
                        min={0}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-slate-300">Falloff (0-1)</span>
                      <NumericInput
                        value={em.wind.falloff}
                        onValueChange={value => updateWind({ falloff: value })}
                        min={0}
                        max={1}
                        step={0.05}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Area Shape</span>
                      <select
                        value={em.wind.areaShape}
                        onChange={e => updateWind({ areaShape: e.target.value as any })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      >
                        <option value="global">Global</option>
                        <option value="rect">Rectangle</option>
                        <option value="circle">Circle</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-300 mt-4">
                      <input
                        type="checkbox"
                        checked={em.wind.turbulenceEnabled}
                        onChange={e => updateWind({ turbulenceEnabled: e.target.checked })}
                        className="h-4 w-4 text-amber-400 rounded border-slate-600 bg-slate-900"
                      />
                      <span>Enable turbulence gusts</span>
                    </label>
                  </div>

                  {em.wind.areaShape === 'rect' && (
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Center X</span>
                        <NumericInput
                          value={em.wind.areaRect.center.x}
                          onValueChange={value => updateWind({ areaRect: { ...em.wind.areaRect, center: { ...em.wind.areaRect.center, x: value } } })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Center Y</span>
                        <NumericInput
                          value={em.wind.areaRect.center.y}
                          onValueChange={value => updateWind({ areaRect: { ...em.wind.areaRect, center: { ...em.wind.areaRect.center, y: value } } })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Width</span>
                        <NumericInput
                          value={em.wind.areaRect.size.x}
                          onValueChange={value => updateWind({ areaRect: { ...em.wind.areaRect, size: { ...em.wind.areaRect.size, x: value } } })}
                          min={0}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Height</span>
                        <NumericInput
                          value={em.wind.areaRect.size.y}
                          onValueChange={value => updateWind({ areaRect: { ...em.wind.areaRect, size: { ...em.wind.areaRect.size, y: value } } })}
                          min={0}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                    </div>
                  )}

                  {em.wind.areaShape === 'circle' && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Center X</span>
                        <NumericInput
                          value={em.wind.areaCircle.center.x}
                          onValueChange={value => updateWind({ areaCircle: { ...em.wind.areaCircle, center: { ...em.wind.areaCircle.center, x: value } } })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Center Y</span>
                        <NumericInput
                          value={em.wind.areaCircle.center.y}
                          onValueChange={value => updateWind({ areaCircle: { ...em.wind.areaCircle, center: { ...em.wind.areaCircle.center, y: value } } })}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Radius</span>
                        <NumericInput
                          value={em.wind.areaCircle.radius}
                          onValueChange={value => updateWind({ areaCircle: { ...em.wind.areaCircle, radius: value } })}
                          min={0}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                    </div>
                  )}

                  {em.wind.turbulenceEnabled && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <label className="block">
                        <span className="text-xs text-slate-300">Turbulence Strength</span>
                        <NumericInput
                          value={em.wind.turbulenceStrength}
                          onValueChange={value => updateWind({ turbulenceStrength: value })}
                          min={0}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Frequency</span>
                        <NumericInput
                          value={em.wind.turbulenceFrequency}
                          onValueChange={value => updateWind({ turbulenceFrequency: value })}
                          min={0}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-300">Scale</span>
                        <NumericInput
                          value={em.wind.turbulenceScale}
                          onValueChange={value => updateWind({ turbulenceScale: value })}
                          min={0}
                          className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                        />
                      </label>
                    </div>
                  )}
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
                    label="Noise Strength Multiplier (-1 to 1)"
                    curve={em.noiseStrengthOverLifetime}
                    onChange={curve => updateEmitter({ noiseStrengthOverLifetime: curve })}
                    onReset={() => updateEmitter({ noiseStrengthOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.noise) })}
                    min={-1}
                    max={1}
                    autoScale={false}
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
                    label="Vortex Strength Multiplier (-1 to 1)"
                    curve={em.vortexStrengthOverLifetime}
                    onChange={curve => updateEmitter({ vortexStrengthOverLifetime: curve })}
                    onReset={() => updateEmitter({ vortexStrengthOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.vortex) })}
                    min={-1}
                    max={1}
                    autoScale={false}
                  />
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <label className="block">
                      <span className="text-xs text-slate-300">Center X</span>
                      <NumericInput
                        value={em.vortexPoint.x}
                        onValueChange={value => updateEmitter({
                          vortexPoint: { ...em.vortexPoint, x: value }
                        })}
                        className="w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs text-slate-300">Center Y</span>
                      <NumericInput
                        value={em.vortexPoint.y}
                        onValueChange={value => updateEmitter({
                          vortexPoint: { ...em.vortexPoint, y: value }
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
                    label="Spin Speed Multiplier (-1 to 1)"
                    curve={em.angularVelocityOverLifetime}
                    onChange={curve => updateEmitter({ angularVelocityOverLifetime: curve })}
                    onReset={() => updateEmitter({ angularVelocityOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.angularVelocity) })}
                    min={-1}
                    max={1}
                    autoScale={false}
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
                  label="Size X Multiplier (-1 to 1)"
                  curve={em.sizeXOverLifetime}
                  onChange={curve => updateEmitter({ sizeXOverLifetime: curve })}
                  onReset={() => updateEmitter({ sizeXOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.sizeX) })}
                  min={-1}
                  max={1}
                  autoScale={false}
                />
                <RangeInput
                  label="Size Y Base Range"
                  helper="Random between two numbers"
                  range={em.sizeYRange}
                  onChange={range => updateEmitter({ sizeYRange: range })}
                />
                <CurveEditor
                  label="Size Y Multiplier (-1 to 1)"
                  curve={em.sizeYOverLifetime}
                  onChange={curve => updateEmitter({ sizeYOverLifetime: curve })}
                  onReset={() => updateEmitter({ sizeYOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.sizeY) })}
                  min={-1}
                  max={1}
                  autoScale={false}
                />
                <RangeInput
                  label="Speed Base Range"
                  helper="Random between two numbers"
                  range={em.speedRange}
                  onChange={range => updateEmitter({ speedRange: range })}
                />
                <CurveEditor
                  label="Speed Multiplier (-1 to 1)"
                  curve={em.speedOverLifetime}
                  onChange={curve => updateEmitter({ speedOverLifetime: curve })}
                  onReset={() => updateEmitter({ speedOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.speed) })}
                  min={-1}
                  max={1}
                  autoScale={false}
                />
                <RangeInput
                  label="Weight Base Range"
                  helper="Random between two numbers"
                  range={em.weightRange}
                  onChange={range => updateEmitter({ weightRange: range })}
                />
                <CurveEditor
                  label="Weight Multiplier (-1 to 1)"
                  curve={em.weightOverLifetime}
                  onChange={curve => updateEmitter({ weightOverLifetime: curve })}
                  onReset={() => updateEmitter({ weightOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.weight) })}
                  min={-1}
                  max={1}
                  autoScale={false}
                />
                <RangeInput
                  label="Attraction Base Range"
                  helper="Random between two numbers"
                  range={em.attractionRange}
                  onChange={range => updateEmitter({ attractionRange: range })}
                />
                <CurveEditor
                  label="Attraction Multiplier (-1 to 1)"
                  curve={em.attractionOverLifetime}
                  onChange={curve => updateEmitter({ attractionOverLifetime: curve })}
                  onReset={() => updateEmitter({ attractionOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.attraction) })}
                  min={-1}
                  max={1}
                  autoScale={false}
                />

                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <RangeInput
                    label="Spin Base Range (deg/sec)"
                    helper="Random between two numbers"
                    range={em.spinRange}
                    onChange={range => updateEmitter({ spinRange: range })}
                  />
                <CurveEditor
                    label="Spin Multiplier (-1 to 1)"
                    curve={em.spinOverLifetime}
                    onChange={curve => updateEmitter({ spinOverLifetime: curve })}
                    onReset={() => updateEmitter({ spinOverLifetime: copyCurve(DEFAULT_CURVE_PRESETS.spin) })}
                    min={-1}
                    max={1}
                    autoScale={false}
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
                {settings.emitters.map((emitter) => (
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
                    <NumericInput
                      value={settings.exportSettings.positionThreshold}
                      onValueChange={(value) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, positionThreshold: value } })}
                      step={0.1}
                      max={50}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Rotation Threshold (°)</label>
                    <NumericInput
                      value={settings.exportSettings.rotationThreshold}
                      onValueChange={(value) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, rotationThreshold: value } })}
                      step={0.1}
                      max={180}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Scale Threshold</label>
                    <NumericInput
                      value={settings.exportSettings.scaleThreshold}
                      onValueChange={(value) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, scaleThreshold: value } })}
                      step={0.01}
                      max={2}
                      className="w-full px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Color Threshold (RGBA Sum)</label>
                    <NumericInput
                      value={settings.exportSettings.colorThreshold}
                      onValueChange={(value) => updateSettings({ ...settings, exportSettings: { ...settings.exportSettings, colorThreshold: value } })}
                      step={1}
                      max={1020}
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
