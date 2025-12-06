/**
 * Spine Animation Utilities
 * Low-level utilities for animation processing: angle normalization,
 * track iteration, and time manipulation.
 */

import type { BakedFrame } from "../types";
import type { ParticleSnapshot } from "./baking";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type BoneTrackName = "translate" | "rotate" | "scale";
export type SlotTrackName = "attachment" | "rgba";

export type BoneAnimationData = Record<
  string,
  Array<{ time: number; x?: number; y?: number; value?: number }>
>;

export type SlotAnimationData = Record<
  string,
  Array<{ time: number; name?: string | null; color?: string }>
>;

// ============================================================
// ANGLE UTILITIES
// ============================================================

/**
 * Normalizes angle to prevent large jumps (keeps within 180 degrees of previous)
 */
export function normalizeAngle(angle: number, prevAngle: number): number {
  while (angle - prevAngle > 180) angle -= 360;
  while (angle - prevAngle < -180) angle += 360;
  return angle;
}

/**
 * Applies median smoothing to angle array to reduce jitter
 */
export function smoothAngles(angles: number[], windowSize: number = 3): number[] {
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

// ============================================================
// PARTICLE VISIBILITY
// ============================================================

/**
 * Checks if particle is visible (alpha >= 1/255)
 */
export function isParticleVisible(particle: ParticleSnapshot | undefined): boolean {
  const MIN_ALPHA = 1 / 255;
  return particle !== undefined && particle.alpha >= MIN_ALPHA;
}

// ============================================================
// ANIMATION TRACK ITERATORS (DRY)
// ============================================================

/**
 * Iterates over all bone tracks in animation data
 * Applies callback to each track (translate, rotate, scale)
 */
export function forEachBoneTrack(
  animationData: { bones: Record<string, unknown> },
  callback: (
    boneName: string,
    trackName: BoneTrackName,
    track: Array<{ time: number; x?: number; y?: number; value?: number }>
  ) => void
): void {
  const trackNames: BoneTrackName[] = ["translate", "rotate", "scale"];

  for (const boneName in animationData.bones) {
    const bone = animationData.bones[boneName] as BoneAnimationData;

    for (const trackName of trackNames) {
      const track = bone[trackName];
      if (track && Array.isArray(track)) {
        callback(boneName, trackName, track);
      }
    }
  }
}

/**
 * Iterates over all slot tracks in animation data
 * Applies callback to each track (attachment, rgba)
 */
export function forEachSlotTrack(
  animationData: { slots: Record<string, unknown> },
  callback: (
    slotName: string,
    trackName: SlotTrackName,
    track: Array<{ time: number; name?: string | null; color?: string }>
  ) => void
): void {
  const trackNames: SlotTrackName[] = ["attachment", "rgba"];

  for (const slotName in animationData.slots) {
    const slot = animationData.slots[slotName] as SlotAnimationData;

    for (const trackName of trackNames) {
      const track = slot[trackName];
      if (track && Array.isArray(track)) {
        callback(slotName, trackName, track);
      }
    }
  }
}

// ============================================================
// ANIMATION TIME MANIPULATION
// ============================================================

/**
 * Normalizes animation times by shifting all keyframes to start at time 0
 * Finds minimum time across all tracks and subtracts it from all keyframes
 */
export function normalizeAnimationTimes(animationData: {
  bones: Record<string, unknown>;
  slots: Record<string, unknown>;
}): void {
  let minTime = Infinity;

  // Find minimum time across all bone tracks
  forEachBoneTrack(animationData, (_boneName, _trackName, track) => {
    for (const key of track) {
      if (typeof key.time === "number") {
        minTime = Math.min(minTime, key.time);
      }
    }
  });

  // Find minimum time across all slot tracks
  forEachSlotTrack(animationData, (_slotName, _trackName, track) => {
    for (const key of track) {
      if (typeof key.time === "number") {
        minTime = Math.min(minTime, key.time);
      }
    }
  });

  // Shift all keyframes if minimum time is greater than 0
  if (isFinite(minTime) && minTime > 0) {
    // Shift bone track times
    forEachBoneTrack(animationData, (_boneName, _trackName, track) => {
      for (const key of track) {
        key.time = Math.round((key.time - minTime) * 1000) / 1000;
      }
    });

    // Shift slot track times
    forEachSlotTrack(animationData, (_slotName, _trackName, track) => {
      for (const key of track) {
        key.time = Math.round((key.time - minTime) * 1000) / 1000;
      }
    });
  }
}

/**
 * Adds loop seam keys to animation for seamless looping
 * Duplicates first keyframe at loop end time for all visible particles
 */
export function addLoopSeamKeys(
  emitterId: string,
  loopData: {
    animation: { bones: Record<string, unknown>; slots: Record<string, unknown> };
    trackByBoneName: Map<string, { emitterId: string; particleId: number }>;
    trackBySlotName: Map<string, { emitterId: string; particleId: number }>;
  },
  frames: BakedFrame[],
  getParticleFromFrame: (
    frame: BakedFrame,
    emitterId: string,
    particleId: number
  ) => ParticleSnapshot | undefined
): void {
  if (frames.length === 0) return;

  const loopAnimation = loopData.animation;
  const loopDuration = frames[frames.length - 1].time;
  const firstFrame = frames[0];

  // Add seam keys to bone tracks
  forEachBoneTrack(loopAnimation, (boneName, _trackName, track) => {
    if (track.length === 0) return;

    // Check if particle is visible in first frame
    const particleTrack = loopData.trackByBoneName.get(boneName);
    const firstParticle = particleTrack
      ? getParticleFromFrame(firstFrame, emitterId, particleTrack.particleId)
      : undefined;

    if (firstParticle && isParticleVisible(firstParticle)) {
      const firstKey = track[0];
      // Create seam key with same properties but at loop end time
      const seamTime = Math.round(loopDuration * 1000) / 1000;
      const seamKey = { ...firstKey, time: seamTime };
      track.push(seamKey);
    }
  });

  // Add seam keys to slot tracks
  forEachSlotTrack(loopAnimation, (slotName, _trackName, track) => {
    if (track.length === 0) return;

    // Check if particle is visible in first frame
    const particleTrack = loopData.trackBySlotName.get(slotName);
    const firstParticle = particleTrack
      ? getParticleFromFrame(firstFrame, emitterId, particleTrack.particleId)
      : undefined;

    if (firstParticle && isParticleVisible(firstParticle)) {
      const firstKey = track[0];
      // Create seam key with same properties but at loop end time
      const seamTime = Math.round(loopDuration * 1000) / 1000;
      const seamKey = { ...firstKey, time: seamTime };
      track.push(seamKey);
    }
  });
}
