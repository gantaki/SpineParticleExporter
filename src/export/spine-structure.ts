/**
 * Spine Skeleton Structure Building
 * Responsible for building the bone hierarchy, slots, and skins.
 * Single Responsibility: Construct skeleton structure from settings
 */

import type { ParticleSettings, BakedFrame } from "../types";
import type { ParticleTrack } from "./spine-keyframes";

// ============================================================
// PARTICLE COLLECTION
// ============================================================

/**
 * Collects all particle IDs grouped by emitter from baked frames
 * Filters disabled emitters and applies bone count limits for looping+prewarm
 */
export function collectParticlesByEmitter(
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

// ============================================================
// BONE HIERARCHY
// ============================================================

/**
 * Builds the bone hierarchy: root bone + emitter bones with position offsets
 */
export function buildBoneHierarchy(
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

// ============================================================
// SLOTS AND SKINS
// ============================================================

/**
 * Builds slots, skins, and particle bones
 * Returns all components needed for skeleton structure
 */
export function buildSlotsAndSkins(
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
