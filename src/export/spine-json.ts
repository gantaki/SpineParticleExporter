/**
 * Spine JSON Generation
 * Converts baked particle animation frames into Spine skeleton JSON format
 */

import type { ParticleSettings, BakedFrame, EmitterInstance } from "../types";
import { makeParticleKey, type ParticleSnapshot } from "./baking";

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalizes angle to prevent large jumps (keeps within 180 degrees of previous)
 */
function normalizeAngle(angle: number, prevAngle: number): number {
  while (angle - prevAngle > 180) angle -= 360;
  while (angle - prevAngle < -180) angle += 360;
  return angle;
}

/**
 * Applies median smoothing to angle array to reduce jitter
 */
function smoothAngles(angles: number[], windowSize: number = 3): number[] {
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

/**
 * Checks if particle is visible (alpha >= 1/255)
 */
function isParticleVisible(particle: ParticleSnapshot | undefined): boolean {
  const MIN_ALPHA = 1 / 255;
  return particle !== undefined && particle.alpha >= MIN_ALPHA;
}

// ============================================================
// MAIN EXPORT FUNCTION
// ============================================================

/**
 * Generates a complete Spine JSON file from baked animation frames
 */
export function generateSpineJSON(
  frames: BakedFrame[],
  prewarmFrames: BakedFrame[],
  settings: ParticleSettings,
  spriteNameMap: Map<string, string> = new Map()
): string {
  // Build emitter index map for naming
  const emitterIndexMap = new Map<string, number>();
  settings.emitters.forEach((emitter, index) =>
    emitterIndexMap.set(emitter.id, index)
  );

  const getEmitterPrefix = (emitterId: string) => {
    const index = emitterIndexMap.get(emitterId);
    if (index !== undefined) {
      return `e${index + 1}`;
    }
    const match = emitterId.match(/emitter_(\d+)/);
    return match ? `e${match[1]}` : emitterId;
  };

  const getParticleBoneName = (emitterId: string, particleId: number) =>
    `${getEmitterPrefix(emitterId)}_particle_${particleId}`;

  const getParticleSlotName = (emitterId: string, particleId: number) =>
    `${getEmitterPrefix(emitterId)}_particle_slot_${particleId}`;

  const getSpriteName = (emitterId: string) => {
    if (spriteNameMap.has(emitterId)) return spriteNameMap.get(emitterId)!;
    const index = emitterIndexMap.get(emitterId);
    return index !== undefined ? `sprite_${index + 1}` : "particle";
  };

  // Collect particle IDs by emitter from frames
  const particlesByEmitter = collectParticlesByEmitter(frames, settings);

  // Build skeleton structure
  const skeleton = {
    hash: "particle_export",
    spine: "4.2.00",
    x: 0,
    y: 0,
    width: settings.frameSize,
    height: settings.frameSize,
  };

  // Build bone hierarchy (root + emitters)
  const hierarchyBones = buildBoneHierarchy(settings, particlesByEmitter);

  // Build slots and skins (also creates particle bones)
  const {
    slots,
    skins,
    particleTracks,
    bones: particleBones,
  } = buildSlotsAndSkins(
    settings,
    particlesByEmitter,
    getParticleBoneName,
    getParticleSlotName,
    getSpriteName
  );

  // Combine hierarchy bones with particle bones
  const bones = [...hierarchyBones, ...particleBones];

  // Build animations
  const animations = buildAnimations(
    frames,
    prewarmFrames,
    settings,
    particleTracks,
    getSpriteName
  );

  return JSON.stringify({ skeleton, bones, slots, skins, animations });
}

// ============================================================
// STRUCTURE BUILDERS
// ============================================================

function collectParticlesByEmitter(
  frames: BakedFrame[],
  settings: ParticleSettings
): Map<string, Set<number>> {
  const particlesByEmitter = new Map<string, Set<number>>();

  for (const frame of frames) {
    for (const [key, particleData] of frame.particles) {
      const emitterId = particleData.emitterId;
      const localId =
        typeof particleData.localId === "number"
          ? particleData.localId
          : typeof key === "string"
          ? Number(key.split("__").pop())
          : Number(key);

      if (!particlesByEmitter.has(emitterId)) {
        particlesByEmitter.set(emitterId, new Set());
      }

      if (!Number.isNaN(localId)) {
        particlesByEmitter.get(emitterId)!.add(localId);
      }
    }
  }

  // Filter and limit particles per emitter based on settings
  for (const emitter of settings.emitters) {
    if (!emitter.enabled) {
      particlesByEmitter.delete(emitter.id);
      continue;
    }

    const particleIds = particlesByEmitter.get(emitter.id);
    if (!particleIds) continue;

    // If both looping and prewarm are enabled, limit bones to rate × duration
    if (emitter.settings.looping && emitter.settings.prewarm) {
      const maxBoneCount = Math.floor(
        emitter.settings.rate * settings.duration
      );
      const sortedIds = Array.from(particleIds).sort((a, b) => a - b);
      const filteredIds = sortedIds.filter((id) => id < maxBoneCount);
      particlesByEmitter.set(emitter.id, new Set(filteredIds));
    }
  }

  return particlesByEmitter;
}

function buildBoneHierarchy(
  settings: ParticleSettings,
  particlesByEmitter: Map<string, Set<number>>
): Array<{ name: string; parent?: string; x?: number; y?: number }> {
  const bones: Array<{ name: string; parent?: string; x?: number; y?: number }> = [{ name: "root" }];

  // Create emitter bones with position offset
  for (const emitter of settings.emitters) {
    if (!emitter.enabled || !particlesByEmitter.has(emitter.id)) continue;

    const emitterBone: { name: string; parent: string; x?: number; y?: number } = {
      name: emitter.name,
      parent: "root"
    };

    // Apply emitter position offset
    const posX = emitter.settings.position.x;
    const posY = emitter.settings.position.y;

    if (posX !== 0) {
      emitterBone.x = Math.round(posX * 100) / 100;
    }
    if (posY !== 0) {
      emitterBone.y = Math.round(posY * 100) / 100;
    }

    bones.push(emitterBone);
  }

  return bones;
}

interface ParticleTrack {
  emitterId: string;
  particleId: number;
  boneName: string;
  slotName: string;
}

function buildSlotsAndSkins(
  settings: ParticleSettings,
  particlesByEmitter: Map<string, Set<number>>,
  getParticleBoneName: (emitterId: string, particleId: number) => string,
  getParticleSlotName: (emitterId: string, particleId: number) => string,
  getSpriteName: (emitterId: string) => string
): {
  slots: Array<{ name: string; bone: string; attachment: null }>;
  skins: { default: Record<string, Record<string, unknown>> };
  particleTracks: ParticleTrack[];
  bones: Array<{ name: string; parent: string }>;
} {
  const slots: Array<{ name: string; bone: string; attachment: null }> = [];
  const skins: { default: Record<string, Record<string, unknown>> } = {
    default: {},
  };
  const particleTracks: ParticleTrack[] = [];
  const bones: Array<{ name: string; parent: string }> = [];

  for (const emitter of settings.emitters) {
    if (!emitter.enabled || !particlesByEmitter.has(emitter.id)) continue;

    const particleIds = Array.from(particlesByEmitter.get(emitter.id)!).sort(
      (a, b) => a - b
    );
    const spriteName = getSpriteName(emitter.id);

    for (const id of particleIds) {
      const boneName = getParticleBoneName(emitter.id, id);
      const slotName = getParticleSlotName(emitter.id, id);

      particleTracks.push({
        emitterId: emitter.id,
        particleId: id,
        boneName,
        slotName,
      });

      bones.push({ name: boneName, parent: emitter.name });
      slots.push({ name: slotName, bone: boneName, attachment: null });

      skins.default[slotName] = {
        [spriteName]: {
          type: "region",
          name: spriteName,
          path: spriteName,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          width: 64,
          height: 64,
        },
      };
    }
  }

  return { slots, skins, particleTracks, bones };
}

// ============================================================
// ANIMATION BUILDERS
// ============================================================

/**
 * Context object for building emitter animations
 * Contains all shared data needed by emitter-specific builders
 */
interface EmitterAnimationContext {
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
 * Groups particle tracks by emitter ID
 */
function groupTracksByEmitter(
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

/**
 * Builds animations for Duration-type emitters
 * Duration emitters always export with 'duration_' prefix and preserve timing
 */
function buildDurationEmitterAnimation(
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
function buildBurstEmitterAnimation(
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
function buildContinuousEmitterAnimation(
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

/**
 * Builds all animations for all enabled emitters
 * Delegates to type-specific builder functions based on emission type
 */
function buildAnimations(
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

interface AnimationResult {
  animation: {
    bones: Record<string, unknown>;
    slots: Record<string, unknown>;
  };
  trackByBoneName: Map<string, ParticleTrack>;
  trackBySlotName: Map<string, ParticleTrack>;
}

function buildAnimationData(
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

  const POSITION_THRESHOLD = settings.exportSettings.positionThreshold;
  const ROTATION_THRESHOLD = settings.exportSettings.rotationThreshold;
  const SCALE_THRESHOLD = settings.exportSettings.scaleThreshold;
  const COLOR_THRESHOLD = settings.exportSettings.colorThreshold;

  for (const track of tracks) {
    const { boneName, slotName } = track;
    const spriteName = getSpriteName(track.emitterId);

    const keyframes = buildParticleKeyframes(
      sourceFrames,
      track,
      settings,
      spriteName,
      getParticleFromFrame,
      POSITION_THRESHOLD,
      ROTATION_THRESHOLD,
      SCALE_THRESHOLD,
      COLOR_THRESHOLD
    );

    if (keyframes.hasAppeared) {
      const boneAnimation: Record<string, unknown> = {};
      if (
        settings.exportSettings.exportTranslate &&
        keyframes.translateKeys.length > 0
      ) {
        boneAnimation.translate = keyframes.translateKeys;
      }
      if (
        settings.exportSettings.exportRotate &&
        keyframes.rotateKeys.length > 0
      ) {
        boneAnimation.rotate = keyframes.rotateKeys;
      }
      if (
        settings.exportSettings.exportScale &&
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
        settings.exportSettings.exportColor &&
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

interface Keyframes {
  translateKeys: Array<{ time: number; x: number; y: number; curve?: string }>;
  rotateKeys: Array<{ time: number; value: number; curve?: string }>;
  scaleKeys: Array<{ time: number; x: number; y: number; curve?: string }>;
  attachmentKeys: Array<{ time: number; name: string | null }>;
  colorKeys: Array<{ time: number; color: string; curve?: string }>;
  hasAppeared: boolean;
}

function buildParticleKeyframes(
  sourceFrames: BakedFrame[],
  track: ParticleTrack,
  settings: ParticleSettings,
  spriteName: string,
  getParticleFromFrame: (
    frame: BakedFrame,
    emitterId: string,
    particleId: number
  ) => ParticleSnapshot | undefined,
  POSITION_THRESHOLD: number,
  ROTATION_THRESHOLD: number,
  SCALE_THRESHOLD: number,
  COLOR_THRESHOLD: number
): Keyframes {
  const translateKeys: Keyframes["translateKeys"] = [];
  const rotateKeys: Keyframes["rotateKeys"] = [];
  const scaleKeys: Keyframes["scaleKeys"] = [];
  const attachmentKeys: Keyframes["attachmentKeys"] = [];
  const colorKeys: Keyframes["colorKeys"] = [];

  // Collect all angles for smoothing
  const allAngles: number[] = [];
  for (const frame of sourceFrames) {
    const particle = getParticleFromFrame(
      frame,
      track.emitterId,
      track.particleId
    );
    if (particle) {
      allAngles.push(particle.rotation);
    } else {
      allAngles.push(
        allAngles.length > 0 ? allAngles[allAngles.length - 1] : 0
      );
    }
  }

  const smoothedAngles = smoothAngles(allAngles, 3);

  let prevPos: { x: number; y: number } | null = null;
  let prevRotation: number | null = null;
  let prevScale: { x: number; y: number } | null = null;
  let prevColor: { r: number; g: number; b: number; a: number } | null = null;
  let wasVisible = false;
  let hasAppeared = false;
  let normalizedAngle = 0;
  let forceSteppedInterpolation = false;

  const pushKeyWithCurve = <T extends { time: number }>(
    list: Array<T & { curve?: string }>,
    key: T
  ) => {
    if (forceSteppedInterpolation) {
      list.push({ ...key, curve: "stepped" });
    } else {
      list.push(key);
    }
  };

  for (let frameIdx = 0; frameIdx < sourceFrames.length; frameIdx++) {
    const frame = sourceFrames[frameIdx];
    const particle = getParticleFromFrame(
      frame,
      track.emitterId,
      track.particleId
    );
    const isVisible = isParticleVisible(particle);
    const isFirstFrame = frameIdx === 0;
    const isLastFrame = frameIdx === sourceFrames.length - 1;
    const visibilityChanged = wasVisible !== isVisible;

    if (particle && isVisible) {
      // Add attachment key when particle becomes visible
      if (!hasAppeared || (visibilityChanged && !wasVisible)) {
        hasAppeared = true;
        const time = Math.round(frame.time * 1000) / 1000;
        attachmentKeys.push({ time, name: spriteName });
        forceSteppedInterpolation = false;
      }

      const currentPos = { x: particle.x, y: particle.y };
      const currentScale = { x: particle.scaleX, y: particle.scaleY };
      const currentColor = {
        r: particle.color.r / 255,
        g: particle.color.g / 255,
        b: particle.color.b / 255,
        a: particle.alpha,
      };

      if (prevRotation !== null) {
        normalizedAngle = normalizeAngle(
          smoothedAngles[frameIdx],
          normalizedAngle
        );
      } else {
        normalizedAngle = smoothedAngles[frameIdx];
      }

      // Position keyframe
      const movementDistance = prevPos
        ? Math.sqrt(
            Math.pow(currentPos.x - prevPos.x, 2) +
              Math.pow(currentPos.y - prevPos.y, 2)
          )
        : 0;
      const shouldWriteTranslate =
        settings.exportSettings.exportTranslate &&
        (isFirstFrame ||
          isLastFrame ||
          visibilityChanged ||
          prevPos === null ||
          movementDistance > POSITION_THRESHOLD);

      if (shouldWriteTranslate) {
        pushKeyWithCurve(translateKeys, {
          time: Math.round(frame.time * 1000) / 1000,
          x: Math.round(currentPos.x * 100) / 100,
          y: Math.round(currentPos.y * 100) / 100,
        });
        prevPos = currentPos;
      }

      // Rotation keyframe
      const rotationDelta =
        prevRotation !== null ? normalizedAngle - prevRotation : 0;
      const shouldWriteRotate =
        settings.exportSettings.exportRotate &&
        (isFirstFrame ||
          isLastFrame ||
          visibilityChanged ||
          prevRotation === null ||
          Math.abs(rotationDelta) > ROTATION_THRESHOLD);

      if (shouldWriteRotate) {
        const angleValue = Math.round(normalizedAngle * 100) / 100;

        pushKeyWithCurve(rotateKeys, {
          time: Math.round(frame.time * 1000) / 1000,
          value: angleValue,
        });
        prevRotation = normalizedAngle;
      }

      // Scale keyframe
      if (
        settings.exportSettings.exportScale &&
        (isFirstFrame ||
          isLastFrame ||
          visibilityChanged ||
          prevScale === null ||
          Math.abs(currentScale.x - prevScale.x) > SCALE_THRESHOLD ||
          Math.abs(currentScale.y - prevScale.y) > SCALE_THRESHOLD)
      ) {
        pushKeyWithCurve(scaleKeys, {
          time: Math.round(frame.time * 1000) / 1000,
          x: Math.round(currentScale.x * 1000) / 1000,
          y: Math.round(currentScale.y * 1000) / 1000,
        });
        prevScale = currentScale;
      }

      // Color keyframe
      if (settings.exportSettings.exportColor) {
        const colorDeltaSum =
          prevColor === null
            ? Number.POSITIVE_INFINITY
            : Math.abs((currentColor.r - prevColor.r) * 255) +
              Math.abs((currentColor.g - prevColor.g) * 255) +
              Math.abs((currentColor.b - prevColor.b) * 255) +
              Math.abs((currentColor.a - prevColor.a) * 255);

        const colorChanged =
          prevColor === null || colorDeltaSum > COLOR_THRESHOLD;

        if (isFirstFrame || isLastFrame || visibilityChanged || colorChanged) {
          const rHex = Math.round(currentColor.r * 255)
            .toString(16)
            .padStart(2, "0");
          const gHex = Math.round(currentColor.g * 255)
            .toString(16)
            .padStart(2, "0");
          const bHex = Math.round(currentColor.b * 255)
            .toString(16)
            .padStart(2, "0");
          const aHex = Math.round(currentColor.a * 255)
            .toString(16)
            .padStart(2, "0");
          const colorHex = `${rHex}${gHex}${bHex}${aHex}`;

          pushKeyWithCurve(colorKeys, {
            time: Math.round(frame.time * 1000) / 1000,
            color: colorHex,
          });
          prevColor = currentColor;
        }
      }

      wasVisible = true;
    } else {
      if (wasVisible && visibilityChanged) {
        const time = Math.round(frame.time * 1000) / 1000;
        attachmentKeys.push({ time, name: null });
        forceSteppedInterpolation = true;
      }

      if (visibilityChanged && wasVisible) {
        const time = Math.round(frame.time * 1000) / 1000;
        if (settings.exportSettings.exportTranslate && prevPos) {
          pushKeyWithCurve(translateKeys, {
            time,
            x: Math.round(prevPos.x * 100) / 100,
            y: Math.round(prevPos.y * 100) / 100,
          });
        }
        if (settings.exportSettings.exportRotate && prevRotation !== null) {
          pushKeyWithCurve(rotateKeys, {
            time,
            value: Math.round(prevRotation * 100) / 100,
          });
        }
        if (settings.exportSettings.exportScale && prevScale !== null) {
          pushKeyWithCurve(scaleKeys, { time, x: 0, y: 0 });
        }
      }

      wasVisible = false;
    }
  }

  return {
    translateKeys,
    rotateKeys,
    scaleKeys,
    attachmentKeys,
    colorKeys,
    hasAppeared,
  };
}

// ============================================================
// ANIMATION TRACK UTILITIES (DRY)
// ============================================================

/**
 * Type definitions for animation data structure
 */
type BoneTrackName = "translate" | "rotate" | "scale";
type SlotTrackName = "attachment" | "rgba";

type BoneAnimationData = Record<
  string,
  Array<{ time: number; x?: number; y?: number; value?: number }>
>;

type SlotAnimationData = Record<
  string,
  Array<{ time: number; name?: string | null; color?: string }>
>;

/**
 * Iterates over all bone tracks in animation data
 * Applies callback to each track (translate, rotate, scale)
 */
function forEachBoneTrack(
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
function forEachSlotTrack(
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
function normalizeAnimationTimes(animationData: {
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
function addLoopSeamKeys(
  emitterId: string,
  loopData: AnimationResult,
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
