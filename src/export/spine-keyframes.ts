/**
 * Spine Keyframe Building
 * Responsible for converting particle snapshots into Spine animation keyframes.
 * Single Responsibility: Transform particle state → keyframe data
 */

import type { BakedFrame } from "../types";
import type { ParticleSnapshot } from "./baking";
import type { ParticleSettings } from "../types";
import { normalizeAngle, smoothAngles, isParticleVisible } from "./spine-animation-utils";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export interface Keyframes {
  translateKeys: Array<{ time: number; x: number; y: number; curve?: string }>;
  rotateKeys: Array<{ time: number; value: number; curve?: string }>;
  scaleKeys: Array<{ time: number; x: number; y: number; curve?: string }>;
  attachmentKeys: Array<{ time: number; name: string | null }>;
  colorKeys: Array<{ time: number; color: string; curve?: string }>;
  hasAppeared: boolean;
}

export interface ParticleTrack {
  emitterId: string;
  particleId: number;
  boneName: string;
  slotName: string;
}

// ============================================================
// KEYFRAME BUILDING
// ============================================================

/**
 * Builds animation keyframes for a single particle track
 * Processes all frames and generates keyframes based on thresholds
 */
export function buildParticleKeyframes(
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
