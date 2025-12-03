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

/**
 * Bakes particle animation into frame snapshots
 * Returns both main animation frames and prewarm frames (for looping)
 */
export function bakeParticleAnimation(settings: ParticleSettings): {
  frames: BakedFrame[];
  prewarmFrames: BakedFrame[];
} {
  const frames: BakedFrame[] = [];
  const prewarmBakedFrames: BakedFrame[] = [];
  const engine = new ParticleEngine(settings);

  const dt = 1 / settings.fps;

  // Store prewarm animation frames for loop
  const prewarmFrameMap: Map<number, Map<string, ParticleSnapshot>> = new Map();

  /**
   * Captures current particle state as a snapshot
   */
  const captureSnapshot = (): Map<string, ParticleSnapshot> => {
    const particlesSnapshot = new Map<string, ParticleSnapshot>();

    for (const p of engine.particles) {
      const emitter = settings.emitters.find((e) => e.id === p.emitterId);
      if (!emitter) continue;

      const rotationDegrees = (p.rotation * 180) / Math.PI;

      // Debug logging for rotation
      if (particlesSnapshot.size < 3) {
        console.log(`[Baking Debug] Particle ${p.id} - rotation(rad): ${p.rotation.toFixed(4)}, rotation(deg): ${rotationDegrees.toFixed(2)}`);
      }

      particlesSnapshot.set(makeParticleKey(p.emitterId, p.id), {
        emitterId: p.emitterId,
        localId: p.id,
        x: p.x - emitter.settings.position.x,
        y: p.y - emitter.settings.position.y,
        rotation: rotationDegrees,
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
  };

  // Check if any emitter has prewarm enabled
  const hasAnyPrewarm = settings.emitters.some(
    (e) => e.settings.prewarm && e.settings.looping
  );

  // Apply prewarm if enabled on any emitter
  if (hasAnyPrewarm) {
    const prewarmSteps = Math.ceil(settings.duration * settings.fps);

    // Capture initial warm state
    const initialSnapshot = captureSnapshot();
    prewarmFrameMap.set(0, initialSnapshot);
    prewarmBakedFrames.push({ time: 0, particles: initialSnapshot });

    // Simulate prewarm and capture every frame
    for (let i = 0; i < prewarmSteps; i++) {
      engine.update(dt, true); // skipTimeReset = true during prewarm

      const snapshot = captureSnapshot();
      const time = (i + 1) * dt;
      prewarmFrameMap.set(i + 1, snapshot);
      prewarmBakedFrames.push({ time, particles: snapshot });
    }

    // Reset time but keep particles for main simulation
    engine.time = 0;
  }

  const duration = settings.duration;
  const frameCount = Math.ceil(duration * settings.fps);

  // For looping: simulate extra time to capture wrap-around particles
  const hasAnyLooping = settings.emitters.some((e) => e.settings.looping);
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
  const initialSnapshot = captureSnapshot();
  allFrames.set(0, initialSnapshot);
  frames.push({ time: 0, particles: initialSnapshot });

  for (let i = 0; i < totalFrameCount; i++) {
    engine.update(dt);
    const frameIndex = i + 1;
    const snapshot = captureSnapshot();

    allFrames.set(frameIndex, snapshot);

    if (frameIndex <= frameCount) {
      const time = frameIndex * dt;
      const particlesSnapshot = new Map<string, ParticleSnapshot>(snapshot);

      // Add prewarm particles (for looping animations)
      if (hasAnyLooping && prewarmFrameMap.size > 0) {
        const prewarmFrame = prewarmFrameMap.get(frameIndex);

        if (prewarmFrame) {
          for (const [id, particleData] of prewarmFrame) {
            if (!snapshot.has(id)) {
              particlesSnapshot.set(id, particleData);
            }
          }
        }

        const framesFromEnd = frameCount - frameIndex;
        if (framesFromEnd >= 0 && framesFromEnd < prewarmFrameMap.size) {
          const endPrewarmFrame = prewarmFrameMap.get(
            prewarmFrameMap.size - 1 - framesFromEnd
          );

          if (endPrewarmFrame) {
            for (const [id, particleData] of endPrewarmFrame) {
              if (!particlesSnapshot.has(id)) {
                particlesSnapshot.set(id, particleData);
              }
            }
          }
        }
      }

      // If looping, add wrap-around particles from the end
      if (hasAnyLooping) {
        const wrapFrameIndex = frameCount + frameIndex;
        const wrapFrame = allFrames.get(wrapFrameIndex);

        if (wrapFrame) {
          for (const [id, particleData] of wrapFrame) {
            if (!snapshot.has(id)) {
              const timeIntoWrap = frameIndex * dt;
              const adjustedLife = particleData.life - timeIntoWrap;

              if (adjustedLife > 0) {
                particlesSnapshot.set(id, {
                  ...particleData,
                  life: adjustedLife,
                });
              }
            }
          }
        }
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
  canvas.width = settings.frameSize;
  canvas.height = settings.frameSize;
  const ctx = canvas.getContext("2d")!;

  const centerX = settings.frameSize / 2;
  const centerY = settings.frameSize / 2;

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
