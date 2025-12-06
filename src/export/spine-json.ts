/**
 * Spine JSON Generation (Orchestrator)
 * Converts baked particle animation frames into Spine skeleton JSON format.
 *
 * Architecture: Orchestrator Pattern (DIP - Dependency Inversion Principle)
 * This module depends on abstractions (imported functions) and coordinates their execution.
 * All complex logic has been delegated to specialized modules following SRP.
 *
 * Module Structure:
 * - spine-structure.ts: Skeleton structure (bones, slots, skins)
 * - spine-animations.ts: Animation building with Strategy pattern
 * - spine-keyframes.ts: Keyframe generation from snapshots
 * - spine-animation-utils.ts: Low-level utilities (angles, tracks, time)
 */

import type { ParticleSettings, BakedFrame } from "../types";
import { collectParticlesByEmitter, buildBoneHierarchy, buildSlotsAndSkins } from "./spine-structure";
import { buildAnimations } from "./spine-animations";

// ============================================================
// MAIN EXPORT FUNCTION (ORCHESTRATOR)
// ============================================================

/**
 * Generates a complete Spine JSON file from baked animation frames
 *
 * This function orchestrates the entire JSON generation process:
 * 1. Build emitter naming utilities
 * 2. Collect particles by emitter
 * 3. Build skeleton structure (bones, slots, skins)
 * 4. Build animations for all emitters
 * 5. Serialize to JSON
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

  // Naming utilities (local scope, injected into structure builders)
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

  // Step 1: Collect particle IDs by emitter from frames
  const particlesByEmitter = collectParticlesByEmitter(frames, settings);

  // Step 2: Build skeleton metadata
  const skeleton = {
    hash: "particle_export",
    spine: "4.2.00",
    x: 0,
    y: 0,
    width: settings.frame.width,
    height: settings.frame.height,
  };

  // Step 3: Build bone hierarchy (root + emitters)
  const hierarchyBones = buildBoneHierarchy(settings, particlesByEmitter);

  // Step 4: Build slots and skins (also creates particle bones)
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

  // Step 5: Build animations (delegates to strategy pattern)
  const animations = buildAnimations(
    frames,
    prewarmFrames,
    settings,
    particleTracks,
    getSpriteName
  );

  // Step 6: Serialize to JSON
  return JSON.stringify({ skeleton, bones, slots, skins, animations });
}
