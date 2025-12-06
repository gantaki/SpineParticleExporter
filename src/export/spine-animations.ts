/**
 * Spine Animation Building
 * Responsible for building animations using Strategy pattern.
 * Each emission type (duration, burst, continuous) has its own builder strategy.
 * Open/Closed Principle: Easy to extend with new emission types without modifying existing code.
 */

import type { ParticleSettings, EmitterInstance, BakedFrame } from "../types";
import type { ParticleSnapshot } from "./baking";
import { makeParticleKey } from "./baking";
import type { ParticleTrack } from "./spine-keyframes";
import { buildParticleKeyframes } from "./spine-keyframes";
import { normalizeAnimationTimes, addLoopSeamKeys } from "./spine-animation-utils";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Context object for building emitter animations
 * Contains all shared data needed by emitter-specific builders
 */
export interface EmitterAnimationContext {
  frames: BakedFrame[];
  prewarmFrames: BakedFrame[];
  settings: ParticleSettings;
  emitter: EmitterInstance;
  emitterTracks: ParticleTrack[];
  getSpriteName: (emitterId: string) => string;
  getParticleFromFrame: (
    frame: BakedFrame,
    emitterId: string,
    particleId: number
  ) => ParticleSnapshot | undefined;
}

/**
 * Animation result with track lookup maps
 */
export interface AnimationResult {
  animation: {
    bones: Record<string, unknown>;
    slots: Record<string, unknown>;
  };
  trackByBoneName: Map<string, ParticleTrack>;
  trackBySlotName: Map<string, ParticleTrack>;
}

// ============================================================
// TRACK GROUPING
// ============================================================

/**
 * Groups particle tracks by emitter ID
 */
export function groupTracksByEmitter(
  particleTracks: ParticleTrack[]
): Map<string, ParticleTrack[]> {
  const tracksByEmitter = new Map<string, ParticleTrack[]>();
  for (const track of particleTracks) {
    if (!tracksByEmitter.has(track.emitterId)) {
      tracksByEmitter.set(track.emitterId, []);
    }
    tracksByEmitter.get(track.emitterId)!.push(track);
  }
  return tracksByEmitter;
}

// ============================================================
// ANIMATION DATA BUILDING
// ============================================================

/**
 * Builds animation data from source frames and particle tracks
 * Core function that converts particle snapshots into Spine animation keyframes
 */
export function buildAnimationData(
  sourceFrames: BakedFrame[],
  tracks: ParticleTrack[],
  settings: ParticleSettings,
  getSpriteName: (emitterId: string) => string,
  getParticleFromFrame: (
    frame: BakedFrame,
    emitterId: string,
    particleId: number
  ) => ParticleSnapshot | undefined,
  normalizeStart: boolean
): AnimationResult | null {
  if (sourceFrames.length === 0 || tracks.length === 0) return null;

  const animationData: {
    bones: Record<string, unknown>;
    slots: Record<string, unknown>;
  } = { bones: {}, slots: {} };

  const trackByBoneName = new Map<string, ParticleTrack>();
  const trackBySlotName = new Map<string, ParticleTrack>();

  for (const track of tracks) {
    trackByBoneName.set(track.boneName, track);
    trackBySlotName.set(track.slotName, track);
  }

  for (const track of tracks) {
    const { boneName, slotName } = track;
    const spriteName = getSpriteName(track.emitterId);

    // Get per-emitter export settings
    const emitter = settings.emitters.find((e) => e.id === track.emitterId);
    if (!emitter) continue;

    const exportSettings = emitter.exportSettings;

    const keyframes = buildParticleKeyframes(
      sourceFrames,
      track,
      spriteName,
      getParticleFromFrame,
      exportSettings.positionThreshold,
      exportSettings.rotationThreshold,
      exportSettings.scaleThreshold,
      exportSettings.colorThreshold,
      exportSettings
    );

    if (keyframes.hasAppeared) {
      const boneAnimation: Record<string, unknown> = {};
      if (
        exportSettings.exportTranslate &&
        keyframes.translateKeys.length > 0
      ) {
        boneAnimation.translate = keyframes.translateKeys;
      }
      if (
        exportSettings.exportRotate &&
        keyframes.rotateKeys.length > 0
      ) {
        boneAnimation.rotate = keyframes.rotateKeys;
      }
      if (
        exportSettings.exportScale &&
        keyframes.scaleKeys.length > 0
      ) {
        boneAnimation.scale = keyframes.scaleKeys;
      }

      if (Object.keys(boneAnimation).length > 0) {
        animationData.bones[boneName] = boneAnimation;
      }

      const slotAnimation: Record<string, unknown> = {};
      if (keyframes.attachmentKeys.length > 0) {
        slotAnimation.attachment = keyframes.attachmentKeys;
      }
      if (
        exportSettings.exportColor &&
        keyframes.colorKeys.length > 0
      ) {
        slotAnimation.rgba = keyframes.colorKeys;
      }

      if (Object.keys(slotAnimation).length > 0) {
        animationData.slots[slotName] = slotAnimation;
      }
    }
  }

  if (
    Object.keys(animationData.bones).length === 0 &&
    Object.keys(animationData.slots).length === 0
  ) {
    return null;
  }

  if (normalizeStart) {
    normalizeAnimationTimes(animationData);
  }

  return { animation: animationData, trackByBoneName, trackBySlotName };
}

// ============================================================
// EMISSION TYPE STRATEGIES (Strategy Pattern)
// ============================================================

/**
 * Builds animations for Duration-type emitters
 * Duration emitters always export with 'duration_' prefix and preserve timing
 */
export function buildDurationEmitterAnimation(
  ctx: EmitterAnimationContext,
  animations: Record<string, unknown>
): void {
  const { frames, settings, emitter, emitterTracks, getSpriteName, getParticleFromFrame } = ctx;

  // Duration emitters preserve timing (don't normalize to zero)
  // to keep durationStart delay in the exported animation
  const loopData = buildAnimationData(
    frames,
    emitterTracks,
    settings,
    getSpriteName,
    getParticleFromFrame,
    false // Never normalize start time for duration emitters
  );

  if (loopData) {
    animations[`duration_${emitter.name}`] = loopData.animation;
  }
}

/**
 * Builds animations for Burst-type emitters
 * Burst emitters always export with 'burst_' prefix
 */
export function buildBurstEmitterAnimation(
  ctx: EmitterAnimationContext,
  animations: Record<string, unknown>
): void {
  const { frames, settings, emitter, emitterTracks, getSpriteName, getParticleFromFrame } = ctx;

  // Burst emitters normalize start time for non-looping
  const shouldNormalizeStart = !emitter.settings.looping;

  const loopData = buildAnimationData(
    frames,
    emitterTracks,
    settings,
    getSpriteName,
    getParticleFromFrame,
    shouldNormalizeStart
  );

  if (loopData) {
    animations[`burst_${emitter.name}`] = loopData.animation;
  }
}

/**
 * Builds animations for Continuous-type emitters
 * Handles both looping and non-looping continuous emitters, including prewarm
 */
export function buildContinuousEmitterAnimation(
  ctx: EmitterAnimationContext,
  animations: Record<string, unknown>
): void {
  const {
    frames,
    prewarmFrames,
    settings,
    emitter,
    emitterTracks,
    getSpriteName,
    getParticleFromFrame
  } = ctx;

  // Continuous emitters normalize start time for non-looping
  const shouldNormalizeStart = !emitter.settings.looping;

  const loopData = buildAnimationData(
    frames,
    emitterTracks,
    settings,
    getSpriteName,
    getParticleFromFrame,
    shouldNormalizeStart
  );

  // Get animation export options for this emitter
  const animOptions = settings.exportSettings.animationExportOptions[emitter.id];

  // For looping continuous emitters only, build prewarm data
  const prewarmData =
    emitter.settings.looping && prewarmFrames.length > 0
      ? buildAnimationData(
          prewarmFrames,
          emitterTracks,
          settings,
          getSpriteName,
          getParticleFromFrame,
          true
        )
      : null;

  // Add loop seam keys for looping emitters
  if (emitter.settings.looping && loopData && prewarmData) {
    addLoopSeamKeys(emitter.id, loopData, frames, getParticleFromFrame);
  }

  // Export main animation
  if (loopData) {
    if (emitter.settings.looping) {
      // Looping continuous emitters use loop_ prefix
      const shouldExportLoop = !animOptions || animOptions.exportLoop;
      if (shouldExportLoop) {
        animations[`loop_${emitter.name}`] = loopData.animation;
      }
    } else {
      // Non-looping continuous emitters use animation_ prefix
      animations[`animation_${emitter.name}`] = loopData.animation;
    }
  }

  // Export prewarm animation (only for looping continuous emitters)
  if (prewarmData) {
    const shouldExportPrewarm = !animOptions || animOptions.exportPrewarm;
    if (shouldExportPrewarm) {
      animations[`prewarm_${emitter.name}`] = prewarmData.animation;
    }
  }
}

// ============================================================
// MAIN ANIMATION BUILDER
// ============================================================

/**
 * Builds all animations for all enabled emitters
 * Delegates to type-specific builder functions based on emission type (Strategy Pattern)
 */
export function buildAnimations(
  frames: BakedFrame[],
  prewarmFrames: BakedFrame[],
  settings: ParticleSettings,
  particleTracks: ParticleTrack[],
  getSpriteName: (emitterId: string) => string
): Record<string, unknown> {
  const animations: Record<string, unknown> = {};

  // Group tracks by emitter
  const tracksByEmitter = groupTracksByEmitter(particleTracks);

  // Helper to get particle from frame
  const getParticleFromFrame = (
    frame: BakedFrame,
    emitterId: string,
    particleId: number
  ): ParticleSnapshot | undefined =>
    frame.particles.get(makeParticleKey(emitterId, particleId)) as
      | ParticleSnapshot
      | undefined;

  // Process each enabled emitter
  for (const emitter of settings.emitters) {
    if (!emitter.enabled) continue;

    const emitterTracks = tracksByEmitter.get(emitter.id) || [];
    if (emitterTracks.length === 0) continue;

    // Create context for emitter-specific builders
    const ctx: EmitterAnimationContext = {
      frames,
      prewarmFrames,
      settings,
      emitter,
      emitterTracks,
      getSpriteName,
      getParticleFromFrame,
    };

    // Delegate to type-specific builder (Strategy pattern)
    const emissionType = emitter.settings.emissionType;
    switch (emissionType) {
      case "duration":
        buildDurationEmitterAnimation(ctx, animations);
        break;
      case "burst":
        buildBurstEmitterAnimation(ctx, animations);
        break;
      case "continuous":
        buildContinuousEmitterAnimation(ctx, animations);
        break;
      default:
        // Exhaustive check - TypeScript will error if a new type is added
        const _exhaustive: never = emissionType;
        console.warn(`Unknown emission type: ${_exhaustive}`);
    }
  }

  return animations;
}
