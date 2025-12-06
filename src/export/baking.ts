/**
 * Animation Baking
 * Simulates particle system and captures frame-by-frame snapshots
 * Uses ParticleEngine for simulation
 */

import type { ParticleSettings, BakedFrame } from "../types";
import { ParticleEngine } from "../engine/ParticleEngine";

/**
 * Creates a unique key for a particle across emitters
 */
export const makeParticleKey = (emitterId: string, particleId: number) =>
  `${emitterId}__${particleId}`;

// ============================================================
// SNAPSHOT CAPTURE (SRP)
// ============================================================

/**
 * Captures current state of all particles as snapshot map
 * Extracts and transforms particle data for export
 */
function captureSnapshot(
  engine: ParticleEngine,
  settings: ParticleSettings
): Map<string, ParticleSnapshot> {
  const particlesSnapshot = new Map<string, ParticleSnapshot>();

  for (const p of engine.particles) {
    const emitter = settings.emitters.find((e) => e.id === p.emitterId);
    if (!emitter) continue;

    particlesSnapshot.set(makeParticleKey(p.emitterId, p.id), {
      emitterId: p.emitterId,
      localId: p.id,
      x: p.x - emitter.settings.position.x,
      y: p.y - emitter.settings.position.y,
      rotation: (p.rotation * 180) / Math.PI,
      scale: p.scale,
      scaleX: p.scaleX,
      scaleY: p.scaleY,
      alpha: p.alpha,
      color: { ...p.color },
      life: p.life,
      maxLife: p.maxLife,
    });
  }

  return particlesSnapshot;
}

// ============================================================
// PREWARM GENERATION (SRP)
// ============================================================

/**
 * Generates prewarm frames for looping animations
 * Returns both frame array and frame map for quick lookup
 */
function generatePrewarmFrames(
  engine: ParticleEngine,
  settings: ParticleSettings,
  dt: number
): {
  frames: BakedFrame[];
  frameMap: Map<number, Map<string, ParticleSnapshot>>;
} {
  const frames: BakedFrame[] = [];
  const frameMap: Map<number, Map<string, ParticleSnapshot>> = new Map();
  const prewarmSteps = Math.ceil(settings.duration * settings.fps);

  // Capture initial warm state
  const initialSnapshot = captureSnapshot(engine, settings);
  frameMap.set(0, initialSnapshot);
  frames.push({ time: 0, particles: initialSnapshot });

  // Simulate prewarm and capture every frame
  for (let i = 0; i < prewarmSteps; i++) {
    engine.update(dt, true); // skipTimeReset = true during prewarm

    const snapshot = captureSnapshot(engine, settings);
    const time = (i + 1) * dt;
    frameMap.set(i + 1, snapshot);
    frames.push({ time, particles: snapshot });
  }

  // Reset time but keep particles for main simulation
  engine.time = 0;

  return { frames, frameMap };
}

// ============================================================
// PARTICLE MERGING (DRY)
// ============================================================

/**
 * Merges particles from source snapshot into target if they don't exist
 * Used for adding prewarm and wrap-around particles
 */
function mergeParticles(
  target: Map<string, ParticleSnapshot>,
  source: Map<string, ParticleSnapshot>,
  transform?: (particle: ParticleSnapshot) => ParticleSnapshot
): void {
  for (const [id, particleData] of source) {
    if (!target.has(id)) {
      const particle = transform ? transform(particleData) : particleData;
      target.set(id, particle);
    }
  }
}

/**
 * Adds prewarm particles to current frame for seamless looping
 */
function addPrewarmParticles(
  currentSnapshot: Map<string, ParticleSnapshot>,
  prewarmFrameMap: Map<number, Map<string, ParticleSnapshot>>,
  frameIndex: number,
  frameCount: number
): void {
  // Add particles from matching prewarm frame
  const prewarmFrame = prewarmFrameMap.get(frameIndex);
  if (prewarmFrame) {
    mergeParticles(currentSnapshot, prewarmFrame);
  }

  // Add particles from end of prewarm (for loop wrap)
  const framesFromEnd = frameCount - frameIndex;
  if (framesFromEnd >= 0 && framesFromEnd < prewarmFrameMap.size) {
    const endPrewarmFrame = prewarmFrameMap.get(
      prewarmFrameMap.size - 1 - framesFromEnd
    );
    if (endPrewarmFrame) {
      mergeParticles(currentSnapshot, endPrewarmFrame);
    }
  }
}

/**
 * Adds wrap-around particles from future frames for seamless looping
 */
function addWrapAroundParticles(
  currentSnapshot: Map<string, ParticleSnapshot>,
  allFrames: Map<number, Map<string, ParticleSnapshot>>,
  frameIndex: number,
  frameCount: number,
  timeIntoFrame: number
): void {
  const wrapFrameIndex = frameCount + frameIndex;
  const wrapFrame = allFrames.get(wrapFrameIndex);

  if (wrapFrame) {
    // Adjust life for wrap-around particles
    mergeParticles(currentSnapshot, wrapFrame, (particle) => {
      const adjustedLife = particle.life - timeIntoFrame;
      return adjustedLife > 0 ? { ...particle, life: adjustedLife } : null!;
    });
  }
}

// ============================================================
// MAIN BAKING FUNCTION
// ============================================================

/**
 * Bakes particle animation into frame snapshots
 * Returns both main animation frames and prewarm frames (for looping)
 */
export function bakeParticleAnimation(settings: ParticleSettings): {
  frames: BakedFrame[];
  prewarmFrames: BakedFrame[];
} {
  const frames: BakedFrame[] = [];
  const engine = new ParticleEngine(settings);
  const dt = 1 / settings.fps;

  // Check if any emitter has looping enabled
  const hasAnyLooping = settings.emitters.some((e) => e.settings.looping);

  // Generate prewarm data if any emitter has looping enabled
  const prewarmResult = hasAnyLooping
    ? generatePrewarmFrames(engine, settings, dt)
    : { frames: [], frameMap: new Map() };

  const { frames: prewarmBakedFrames, frameMap: prewarmFrameMap } =
    prewarmResult;

  // Calculate frame counts
  const duration = settings.duration;
  const frameCount = Math.ceil(duration * settings.fps);

  // For looping: simulate extra time to capture wrap-around particles
  const maxLifetime = settings.emitters.reduce(
    (max, e) => Math.max(max, e.settings.lifeTimeMax),
    0
  );
  const extraTime = hasAnyLooping ? maxLifetime : 0;
  const totalSimTime = duration + extraTime;
  const totalFrameCount = Math.ceil(totalSimTime * settings.fps);

  // Store all simulated frames including extra ones
  const allFrames: Map<number, Map<string, ParticleSnapshot>> = new Map();

  // Capture initial frame
  const initialSnapshot = captureSnapshot(engine, settings);
  allFrames.set(0, initialSnapshot);
  frames.push({ time: 0, particles: initialSnapshot });

  // Simulate and capture frames
  for (let i = 0; i < totalFrameCount; i++) {
    engine.update(dt);
    const frameIndex = i + 1;
    const snapshot = captureSnapshot(engine, settings);

    allFrames.set(frameIndex, snapshot);

    // Only save frames within duration (extras are for wrap-around)
    if (frameIndex <= frameCount) {
      const time = frameIndex * dt;
      const particlesSnapshot = new Map<string, ParticleSnapshot>(snapshot);

      // Add prewarm particles for looping animations
      if (hasAnyLooping && prewarmFrameMap.size > 0) {
        addPrewarmParticles(
          particlesSnapshot,
          prewarmFrameMap,
          frameIndex,
          frameCount
        );
      }

      // Add wrap-around particles for looping
      if (hasAnyLooping) {
        addWrapAroundParticles(
          particlesSnapshot,
          allFrames,
          frameIndex,
          frameCount,
          frameIndex * dt
        );
      }

      frames.push({ time, particles: particlesSnapshot });
    }
  }

  return { frames, prewarmFrames: prewarmBakedFrames };
}

/**
 * Renders a preview of baked animation (all frames overlaid)
 */
export function renderBakedPreview(
  frames: BakedFrame[],
  settings: ParticleSettings
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = settings.frame.width;
  canvas.height = settings.frame.height;
  const ctx = canvas.getContext("2d")!;

  const centerX = settings.frame.width / 2;
  const centerY = settings.frame.height / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const frame of frames) {
    for (const [, p] of frame.particles) {
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

// ============================================================
// TYPES
// ============================================================

export interface ParticleSnapshot {
  emitterId: string;
  localId: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  color: { r: number; g: number; b: number; a: number };
  life: number;
  maxLife: number;
}
