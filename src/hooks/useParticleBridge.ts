/**
 * useParticleBridge - Controller Hook (Façade Pattern)
 *
 * This is the central Controller (GRASP pattern) for the particle system.
 * It orchestrates:
 * 1. ParticleEngine instance management
 * 2. Animation loop (requestAnimationFrame)
 * 3. FSM state coordination
 * 4. Baked simulation management
 * 5. High-frequency stats updates via Observer pattern
 *
 * Key Performance Optimizations:
 * - Uses refs for direct DOM manipulation of particle count/time displays
 * - Observer pattern for stats updates (bypasses React render cycle)
 * - Ephemeral UI data passed to render() without state updates
 */

import { useRef, useCallback, useEffect, useMemo } from "react";
import { ParticleEngine, RenderOptions } from "../engine/ParticleEngine";
import { useEditorMachine, EditorMachineAPI } from "../state/EditorMachine";
import { useSettings } from "../context/SettingsContext";
import { useViewport } from "../context/ViewportContext";
import type { ParticleStats } from "../types/editor";
import type { Color } from "../types";

// ============================================================
// INTERNAL BAKED FRAME TYPE (Extended for full particle restoration)
// ============================================================

interface InternalBakedParticle {
  emitterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  color: Color;
  life: number;
  maxLife: number;
  baseSpeed: number;
}

interface InternalBakedFrame {
  time: number;
  particles: Map<number, InternalBakedParticle>;
}

// ============================================================
// INTERNAL BAKED SIMULATION TYPE
// ============================================================

interface InternalBakedSimulation {
  frames: InternalBakedFrame[];
  prewarmFrames: InternalBakedFrame[];
}

// ============================================================
// TYPES
// ============================================================

export interface ParticleBridgeAPI {
  // Refs for direct DOM manipulation
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  particleCountRef: React.RefObject<HTMLSpanElement | null>;
  timeDisplayRef: React.RefObject<HTMLSpanElement | null>;

  // Engine access
  getEngine: () => ParticleEngine | null;

  // FSM API (delegated)
  machine: EditorMachineAPI;

  // Timeline actions
  handleTimelineTimeChange: (time: number) => void;
  handlePlayPause: () => void;
  handleRestart: () => void;
  handlePlaybackRestart: () => void;

  // Baking
  bakeSimulation: () => InternalBakedFrame[];
  getBakedSimulation: () => InternalBakedSimulation | null;

  // Stats
  getParticleCount: () => number;
  getCurrentTime: () => number;
}

// ============================================================
// HOOK
// ============================================================

export function useParticleBridge(): ParticleBridgeAPI {
  // ============================================================
  // REFS
  // ============================================================

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCountRef = useRef<HTMLSpanElement | null>(null);
  const timeDisplayRef = useRef<HTMLSpanElement | null>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const bakedSimulationRef = useRef<InternalBakedSimulation | null>(null);

  // ============================================================
  // CONTEXT HOOKS
  // ============================================================

  const machine = useEditorMachine();
  const { settings, hasLoopingContinuousEmitter } = useSettings();
  const viewport = useViewport();

  // ============================================================
  // ENGINE INITIALIZATION
  // ============================================================

  // Initialize/update engine when settings change
  useEffect(() => {
    if (!engineRef.current) {
      engineRef.current = new ParticleEngine(settings);
    } else {
      engineRef.current.settings = settings;
      engineRef.current.initializeEmitterStates();
    }

    // Mark simulation as needing rebake
    bakedSimulationRef.current = null;
    machine.markDirty();
  }, [settings, machine]);

  // Subscribe to engine stats updates
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const unsubscribe = engine.onStatsUpdate((stats: ParticleStats) => {
      // Direct DOM manipulation - bypasses React render cycle
      if (particleCountRef.current) {
        particleCountRef.current.innerText = String(stats.particleCount);
      }
      if (timeDisplayRef.current) {
        timeDisplayRef.current.innerText = stats.time.toFixed(2);
      }
    });

    return unsubscribe;
  }, []);

  // ============================================================
  // RENDER OPTIONS (Computed from viewport context)
  // ============================================================

  const getRenderOptions = useCallback((): RenderOptions => {
    const viewportState = viewport.getViewportStateRef();
    return {
      showEmitter: viewportState.showEmitter,
      zoom: viewportState.zoom,
      spriteCanvases: viewport.spriteCanvases,
      showGrid: viewportState.showGrid,
      backgroundImage: viewportState.backgroundImage,
      bgPosition: viewportState.bgPosition,
    };
  }, [viewport]);

  // ============================================================
  // BAKING
  // ============================================================

  const bakeSimulation = useCallback((): InternalBakedFrame[] => {
    const engine = engineRef.current;
    if (!engine) return [];

    engine.reset();

    const dt = 1 / 60;
    const frameCount = Math.ceil(settings.duration / dt);
    const frames: InternalBakedFrame[] = [];

    for (let i = 0; i <= frameCount; i++) {
      const time = i * dt;
      const particlesSnapshot = new Map<number, InternalBakedParticle>();

      for (const p of engine.particles) {
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
        });
      }

      frames.push({ time, particles: particlesSnapshot });

      if (i < frameCount) {
        engine.update(dt);
      }
    }

    bakedSimulationRef.current = { frames, prewarmFrames: [] };
    return frames;
  }, [settings.duration]);

  const getBakedSimulation = useCallback((): InternalBakedSimulation | null => {
    return bakedSimulationRef.current;
  }, []);

  // ============================================================
  // FRAME RENDERING
  // ============================================================

  const renderBakedFrame = useCallback(
    (targetTime: number, frames: InternalBakedFrame[]) => {
      const engine = engineRef.current;
      const canvas = canvasRef.current;
      if (!engine || !canvas || !frames.length) return;

      const dt = 1 / 60;
      const frameIndex = Math.floor(targetTime / dt);
      const clampedIndex = Math.max(0, Math.min(frameIndex, frames.length - 1));
      const frame = frames[clampedIndex];

      if (!frame) return;

      // Restore particles from baked frame
      engine.particles = [];
      engine.time = targetTime;

      for (const [id, data] of frame.particles) {
        engine.particles.push({
          id,
          emitterId: data.emitterId,
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
          baseSpeed: data.baseSpeed,
          baseSpinRate: 0,
          baseAngularVelocity: 0,
          baseGravity: 0,
          baseDrag: 1,
          baseNoiseStrength: 0,
          baseNoiseFrequency: 0,
          baseNoiseSpeed: 0,
          baseAttraction: 0,
          baseVortexStrength: 0,
          baseSpeedScale: 1,
          baseWeight: 1,
          baseSizeX: 1,
          baseSizeY: 1,
        });
      }

      const ctx = canvas.getContext("2d");
      if (ctx) {
        engine.render(ctx, getRenderOptions());
      }

      // Update stats display directly
      if (particleCountRef.current) {
        particleCountRef.current.innerText = String(engine.particles.length);
      }
      if (timeDisplayRef.current) {
        timeDisplayRef.current.innerText = targetTime.toFixed(2);
      }
    },
    [getRenderOptions]
  );

  // ============================================================
  // ANIMATION LOOP
  // ============================================================

  useEffect(() => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    lastFrameTimeRef.current = performance.now();

    const animate = (time: number) => {
      const realDt = (time - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = time;

      if (machine.isPlaying && engine) {
        // Check if simulation reached end (non-looping)
        if (
          !hasLoopingContinuousEmitter &&
          settings.duration > 0 &&
          engine.time >= settings.duration
        ) {
          engine.time = settings.duration;
          engine.render(ctx, getRenderOptions());
          machine.pause();
          machine.setTime(settings.duration);
          return;
        }

        // Apply playback speed and clamp delta
        const dt = Math.min(realDt * machine.state.playbackSpeed, 0.1);
        let appliedDt = dt;

        // Clamp to remaining duration for non-looping
        if (!hasLoopingContinuousEmitter && settings.duration > 0) {
          const remaining = settings.duration - engine.time;
          appliedDt = Math.max(0, Math.min(dt, remaining));
        }

        engine.update(appliedDt);
        engine.render(ctx, getRenderOptions());

        // Update FSM time (for timeline sync)
        const newTime = engine.time;
        const clampedTime =
          !hasLoopingContinuousEmitter && settings.duration > 0
            ? Math.min(newTime, settings.duration)
            : newTime;

        machine.setTime(clampedTime);

        // Check if reached end after update
        if (
          !hasLoopingContinuousEmitter &&
          settings.duration > 0 &&
          newTime >= settings.duration
        ) {
          engine.time = settings.duration;
          machine.pause();
          return;
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Only run loop when playing
    if (machine.shouldRunLoop) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      // Render current state when not playing
      engine.render(ctx, getRenderOptions());
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    machine.isPlaying,
    machine.shouldRunLoop,
    machine.state.playbackSpeed,
    settings.duration,
    hasLoopingContinuousEmitter,
    getRenderOptions,
    machine,
  ]);

  // ============================================================
  // TIMELINE HANDLERS
  // ============================================================

  const handleTimelineTimeChange = useCallback(
    (newTime: number) => {
      machine.setTime(newTime);
      machine.startScrubbing();

      // Bake if needed
      let frames = bakedSimulationRef.current?.frames;
      if (!frames || frames.length === 0) {
        frames = bakeSimulation();
      }

      renderBakedFrame(newTime, frames);
      machine.endScrubbing();
    },
    [machine, bakeSimulation, renderBakedFrame]
  );

  const handlePlayPause = useCallback(() => {
    const engine = engineRef.current;

    if (!machine.isPlaying) {
      // Bake if needed before playing
      if (!bakedSimulationRef.current) {
        bakeSimulation();
      }

      // If at end, restart
      if (
        !hasLoopingContinuousEmitter &&
        settings.duration > 0 &&
        engine &&
        engine.time >= settings.duration
      ) {
        engine.reset();
        machine.setTime(0);

        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            engine.render(ctx, getRenderOptions());
          }
        }
      }
    }

    machine.togglePlayPause();
  }, [
    machine,
    hasLoopingContinuousEmitter,
    settings.duration,
    bakeSimulation,
    getRenderOptions,
  ]);

  const handleRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.reset();
    machine.setTime(0);
    machine.stop();
    bakedSimulationRef.current = null;

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        engine.render(ctx, getRenderOptions());
      }
    }
  }, [machine, getRenderOptions]);

  const handlePlaybackRestart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.reset();
    machine.setTime(0);

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        engine.render(ctx, getRenderOptions());
      }
    }

    // Bake if needed
    if (!bakedSimulationRef.current) {
      bakeSimulation();
    }

    machine.play();
  }, [machine, bakeSimulation, getRenderOptions]);

  // ============================================================
  // STATS ACCESSORS
  // ============================================================

  const getEngine = useCallback(() => engineRef.current, []);

  const getParticleCount = useCallback(() => {
    return engineRef.current?.getParticleCount() ?? 0;
  }, []);

  const getCurrentTime = useCallback(() => {
    return engineRef.current?.getTime() ?? 0;
  }, []);

  // ============================================================
  // API
  // ============================================================

  return useMemo<ParticleBridgeAPI>(
    () => ({
      canvasRef,
      particleCountRef,
      timeDisplayRef,
      getEngine,
      machine,
      handleTimelineTimeChange,
      handlePlayPause,
      handleRestart,
      handlePlaybackRestart,
      bakeSimulation,
      getBakedSimulation,
      getParticleCount,
      getCurrentTime,
    }),
    [
      getEngine,
      machine,
      handleTimelineTimeChange,
      handlePlayPause,
      handleRestart,
      handlePlaybackRestart,
      bakeSimulation,
      getBakedSimulation,
      getParticleCount,
      getCurrentTime,
    ]
  );
}
