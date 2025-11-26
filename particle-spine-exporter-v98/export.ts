/**
 * Export functionality: sprite generation, atlas packing, baking, Spine JSON generation
 */

import type { ParticleSettings, BakedFrame, AtlasRegion, Color } from './types';
import { ParticleSystem } from './core';

function createParticleSprite(type: 'circle' | 'star' | 'polygon' | 'glow', size: number = 64): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  const center = size / 2;
  
  ctx.clearRect(0, 0, size, size);
  
  if (type === 'circle') {
    const radius = size / 2 - 2;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'glow') {
    const radius = size / 2 - 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'star') {
    const outerRadius = size / 2 - 2;
    const innerRadius = outerRadius * 0.5;
    const spikes = 5;
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fill();
  } else if (type === 'polygon') {
    const radius = size / 2 - 2;
    const sides = 6;
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    
    for (let i = 0; i < sides; i++) {
      const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
      const x = center + Math.cos(angle) * radius;
      const y = center + Math.sin(angle) * radius;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fill();
  }
  
  return canvas;
}

function createParticleAtlas(spriteCanvas: HTMLCanvasElement): { canvas: HTMLCanvasElement; region: AtlasRegion } {
  const atlasSize = 128;
  const spriteSize = 64;
  
  const canvas = document.createElement('canvas');
  canvas.width = atlasSize;
  canvas.height = atlasSize;
  const ctx = canvas.getContext('2d')!;
  
  // Draw sprite centered in the atlas
  const offsetX = (atlasSize - spriteSize) / 2;
  const offsetY = (atlasSize - spriteSize) / 2;
  ctx.drawImage(spriteCanvas, offsetX, offsetY, spriteSize, spriteSize);
  
  const region: AtlasRegion = {
    name: 'particle',
    x: offsetX,
    y: offsetY,
    width: spriteSize,
    height: spriteSize,
    atlasIndex: 0
  };
  
  return { canvas, region };
}

function bakeParticleAnimation(settings: ParticleSettings): { frames: BakedFrame[]; prewarmFrames: BakedFrame[] } {
  const frames: BakedFrame[] = [];
  const prewarmBakedFrames: BakedFrame[] = [];
  const system = new ParticleSystem(settings);

  const dt = 1 / settings.fps;

  // Store prewarm animation frames for loop
  const prewarmFrameMap: Map<number, Map<number, any>> = new Map();

  // Check if any emitter has prewarm enabled
  const hasAnyPrewarm = settings.emitters.some(e => e.settings.prewarm && e.settings.looping);

  // Apply prewarm if enabled on any emitter
  if (hasAnyPrewarm) {
    const prewarmSteps = Math.ceil(settings.duration * settings.fps);

    // Simulate prewarm and capture every frame
    for (let i = 0; i < prewarmSteps; i++) {
      system.update(dt, true); // skipTimeReset = true during prewarm

      const particlesSnapshot = new Map<number, any>();
      for (const p of system.particles) {
        const emitter = settings.emitters.find(e => e.id === p.emitterId);
        if (!emitter) continue;

        particlesSnapshot.set(p.id, {
          emitterId: p.emitterId, // Track which emitter this particle belongs to
          x: p.x - emitter.settings.position.x,
          y: p.y - emitter.settings.position.y,
          rotation: p.rotation * 180 / Math.PI,
          scale: p.scale,
          scaleX: p.scaleX,
          scaleY: p.scaleY,
          alpha: p.alpha,
          color: { ...p.color },
          life: p.life,
          maxLife: p.maxLife
        });
      }
      prewarmFrameMap.set(i, particlesSnapshot);
      prewarmBakedFrames.push({ time: i * dt, particles: particlesSnapshot });
    }

    // Reset time but keep particles for main simulation
    system.time = 0;
    for (const [, state] of system.emitterStates) {
      state.hasPrewarmed = true;
    }
  }

  const duration = settings.duration;
  const frameCount = Math.ceil(duration * settings.fps);

  // For looping: simulate extra time to capture wrap-around particles
  const hasAnyLooping = settings.emitters.some(e => e.settings.looping);
  const maxLifetime = settings.emitters.reduce((max, e) => Math.max(max, e.settings.lifeTimeMax), 0);
  const extraTime = hasAnyLooping ? maxLifetime : 0;
  const totalSimTime = duration + extraTime;
  const totalFrameCount = Math.ceil(totalSimTime * settings.fps);

  // Store all simulated frames including extra ones
  const allFrames: Map<number, Map<number, any>> = new Map();

  for (let i = 0; i < totalFrameCount; i++) {
    system.update(dt);
    const particlesSnapshot = new Map<number, any>();

    for (const p of system.particles) {
      const emitter = settings.emitters.find(e => e.id === p.emitterId);
      if (!emitter) continue;

      particlesSnapshot.set(p.id, {
        emitterId: p.emitterId, // Track which emitter this particle belongs to
        x: p.x - emitter.settings.position.x,
        y: p.y - emitter.settings.position.y,
        rotation: p.rotation * 180 / Math.PI,
        scale: p.scale,
        scaleX: p.scaleX,
        scaleY: p.scaleY,
        alpha: p.alpha,
        color: { ...p.color },
        life: p.life,
        maxLife: p.maxLife
      });
    }

    allFrames.set(i, particlesSnapshot);
  }
  
  // Build final frames
  for (let i = 0; i < frameCount; i++) {
    const time = i * dt;
    const currentFrame = allFrames.get(i) || new Map();
    const particlesSnapshot = new Map<number, any>(currentFrame);

    // Add prewarm particles (for looping animations)
    if (hasAnyLooping && prewarmFrameMap.size > 0) {
      // Get prewarm frame for current position
      const prewarmFrame = prewarmFrameMap.get(i);

      if (prewarmFrame) {
        for (const [id, particleData] of prewarmFrame) {
          // Add prewarm particle if not already present in simulation
          if (!currentFrame.has(id)) {
            particlesSnapshot.set(id, particleData);
          }
        }
      }

      // Also add prewarm particles at the END for smooth loop transition
      // Calculate which prewarm frame corresponds to the end of cycle
      const framesFromEnd = frameCount - i - 1;
      if (framesFromEnd >= 0 && framesFromEnd < prewarmFrameMap.size) {
        const endPrewarmFrame = prewarmFrameMap.get(prewarmFrameMap.size - 1 - framesFromEnd);

        if (endPrewarmFrame) {
          for (const [id, particleData] of endPrewarmFrame) {
            // Add prewarm particle at end if not already present
            if (!particlesSnapshot.has(id)) {
              particlesSnapshot.set(id, particleData);
            }
          }
        }
      }
    }

    // If looping, add wrap-around particles from the end
    if (hasAnyLooping) {
      const wrapFrameIndex = frameCount + i;
      const wrapFrame = allFrames.get(wrapFrameIndex);

      if (wrapFrame) {
        for (const [id, particleData] of wrapFrame) {
          // Check if this particle is from wrap-around (not present in current frame)
          if (!currentFrame.has(id)) {
            // Calculate how much life the particle should have lost
            const timeIntoWrap = i * dt;
            const adjustedLife = particleData.life - timeIntoWrap;

            // Only add if particle is still alive
            if (adjustedLife > 0) {
              particlesSnapshot.set(id, {
                ...particleData,
                life: adjustedLife
              });
            }
          }
        }
      }
    }

    frames.push({ time, particles: particlesSnapshot });
  }

  return { frames, prewarmFrames: prewarmBakedFrames };
}

function renderBakedPreview(frames: BakedFrame[], settings: ParticleSettings): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = settings.frameSize;
  canvas.height = settings.frameSize;
  const ctx = canvas.getContext('2d')!;
  
  const centerX = settings.frameSize / 2;
  const centerY = settings.frameSize / 2;
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (const frame of frames) {
    for (const [id, p] of frame.particles) {
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

function generateAtlasFile(atlasCanvas: HTMLCanvasElement, region: AtlasRegion): string {
  let atlasText = '';
  
  atlasText += `particle.png\n`;
  atlasText += `size: ${atlasCanvas.width},${atlasCanvas.height}\n`;
  atlasText += `format: RGBA8888\n`;
  atlasText += `filter: Linear,Linear\n`;
  atlasText += `repeat: none\n`;
  atlasText += `${region.name}\n`;
  atlasText += `  rotate: false\n`;
  atlasText += `  xy: ${region.x}, ${region.y}\n`;
  atlasText += `  size: ${region.width}, ${region.height}\n`;
  atlasText += `  orig: ${region.width}, ${region.height}\n`;
  atlasText += `  offset: 0, 0\n`;
  atlasText += `  index: -1\n`;

  return atlasText;
}

function shouldCreateKey(prevValue: number | { x: number; y: number }, currentValue: number | { x: number; y: number }, threshold: number): boolean {
  if (typeof prevValue === 'number' && typeof currentValue === 'number') {
    return Math.abs(currentValue - prevValue) > threshold;
  }

  if (typeof prevValue === 'object' && typeof currentValue === 'object') {
    const dx = currentValue.x - prevValue.x;
    const dy = currentValue.y - prevValue.y;
    return Math.sqrt(dx * dx + dy * dy) > threshold;
  }

  return true;
}

function normalizeAngle(angle: number, prevAngle: number): number {
  while (angle - prevAngle > 180) angle -= 360;
  while (angle - prevAngle < -180) angle += 360;
  return angle;
}

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

function isParticleVisible(particle: any): boolean {
  // Particle is visible based only on alpha
  // Alpha >= 1/255 (0.00392 in normalized form, 1 out of 255 in Spine color range)
  const MIN_ALPHA = 1 / 255;
  return particle && particle.alpha >= MIN_ALPHA;
}

function generateSpineJSON(frames: BakedFrame[], prewarmFrames: BakedFrame[], settings: ParticleSettings): string {
  const emitterIndexMap = new Map<string, number>();
  settings.emitters.forEach((emitter, index) => emitterIndexMap.set(emitter.id, index));

  const getEmitterPrefix = (emitterId: string) => {
    const index = emitterIndexMap.get(emitterId);
    if (index !== undefined) {
      return `e${index + 1}`;
    }

    const match = emitterId.match(/emitter_(\d+)/);
    return match ? `e${match[1]}` : emitterId;
  };

  const getParticleBoneName = (emitterId: string, particleId: number) => `${getEmitterPrefix(emitterId)}_particle_${particleId}`;
  const getParticleSlotName = (emitterId: string, particleId: number) => `${getEmitterPrefix(emitterId)}_particle_slot_${particleId}`;

  // Group particle IDs by emitter
  const particlesByEmitter = new Map<string, Set<number>>();

  const collectParticleIds = (source: BakedFrame[]) => {
    for (const frame of source) {
      for (const [id, particleData] of frame.particles) {
        const emitterId = particleData.emitterId;
        if (!particlesByEmitter.has(emitterId)) {
          particlesByEmitter.set(emitterId, new Set());
        }
        particlesByEmitter.get(emitterId)!.add(id);
      }
    }
  };

  // Only collect particle IDs from loop animation (frames), not from prewarm
  collectParticleIds(frames);

  // Filter and limit particles per emitter based on settings
  for (const emitter of settings.emitters) {
    if (!emitter.enabled) {
      // Remove particles from disabled emitters
      particlesByEmitter.delete(emitter.id);
      continue;
    }

    const particleIds = particlesByEmitter.get(emitter.id);
    if (!particleIds) continue;

    // If both looping and prewarm are enabled, limit bones to rate × duration
    if (emitter.settings.looping && emitter.settings.prewarm) {
      const maxBoneCount = Math.floor(emitter.settings.rate * settings.duration);
      const sortedIds = Array.from(particleIds).sort((a, b) => a - b);
      const filteredIds = sortedIds.filter(id => id < maxBoneCount);
      particlesByEmitter.set(emitter.id, new Set(filteredIds));
    }
  }

  const skeleton = { hash: "particle_export", spine: "4.2.00", x: 0, y: 0, width: settings.frameSize, height: settings.frameSize };

  // Build bone hierarchy: root -> emitter_N -> particle_ID
  const bones: any[] = [{ name: "root" }];

  // Create emitter bones
  for (const emitter of settings.emitters) {
    if (!emitter.enabled || !particlesByEmitter.has(emitter.id)) continue;
    bones.push({ name: emitter.id, parent: "root" });
  }

  // Create particle bones under their respective emitters
  const slots: any[] = [];
  const skins: any = { default: {} };

  const particleTracks: Array<{ emitterId: string; particleId: number; boneName: string; slotName: string }> = [];

  for (const emitter of settings.emitters) {
    if (!emitter.enabled || !particlesByEmitter.has(emitter.id)) continue;

    const particleIds = Array.from(particlesByEmitter.get(emitter.id)!).sort((a, b) => a - b);

    for (const id of particleIds) {
      const boneName = getParticleBoneName(emitter.id, id);
      const slotName = getParticleSlotName(emitter.id, id);

      particleTracks.push({ emitterId: emitter.id, particleId: id, boneName, slotName });

      bones.push({ name: boneName, parent: emitter.id });
      slots.push({ name: slotName, bone: boneName, attachment: null });

      skins.default[slotName] = {
        particle: { type: "region", name: "particle", path: "particle", x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, width: 64, height: 64 }
      };
    }
  }

  const trackByBoneName = new Map<string, { emitterId: string; particleId: number; boneName: string; slotName: string }>();
  const trackBySlotName = new Map<string, { emitterId: string; particleId: number; boneName: string; slotName: string }>();

  for (const track of particleTracks) {
    trackByBoneName.set(track.boneName, track);
    trackBySlotName.set(track.slotName, track);
  }

  const animations: any = {};

  const POSITION_THRESHOLD = settings.exportSettings.positionThreshold;
  const ROTATION_THRESHOLD = settings.exportSettings.rotationThreshold;
  const SCALE_THRESHOLD = settings.exportSettings.scaleThreshold;
  const COLOR_THRESHOLD = settings.exportSettings.colorThreshold;

  const addAnimation = (animationName: string, sourceFrames: BakedFrame[]) => {
    if (sourceFrames.length === 0) return null;

    const animationData: any = { bones: {}, slots: {} };

    for (const track of particleTracks) {
      const { particleId, boneName, slotName } = track;

      const translateKeys: any[] = [];
      const rotateKeys: any[] = [];
      const scaleKeys: any[] = [];
      const attachmentKeys: any[] = [];
      const colorKeys: any[] = [];

      const allAngles: number[] = [];
      for (const frame of sourceFrames) {
        const particle = frame.particles.get(particleId);
        if (particle) {
          allAngles.push(particle.rotation);
        } else {
          allAngles.push(allAngles.length > 0 ? allAngles[allAngles.length - 1] : 0);
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

      for (let frameIdx = 0; frameIdx < sourceFrames.length; frameIdx++) {
        const frame = sourceFrames[frameIdx];
        const particle = frame.particles.get(particleId);
        const isVisible = particle && isParticleVisible(particle);
        const isFirstFrame = frameIdx === 0;
        const isLastFrame = frameIdx === sourceFrames.length - 1;

        const visibilityChanged = wasVisible !== isVisible;

        if (particle && isVisible) {
          // Add attachment key when particle becomes visible (first time or re-appearing)
          if (!hasAppeared || (visibilityChanged && !wasVisible)) {
            hasAppeared = true;
            const time = Math.round(frame.time * 1000) / 1000;
            attachmentKeys.push({ time, name: "particle" });
          }

          const currentPos = { x: particle.x, y: particle.y };
          const currentScale = { x: particle.scaleX, y: particle.scaleY };
          const currentColor = {
            r: particle.color.r / 255,
            g: particle.color.g / 255,
            b: particle.color.b / 255,
            a: particle.alpha
          };

          if (prevRotation !== null) {
            normalizedAngle = normalizeAngle(smoothedAngles[frameIdx], normalizedAngle);
          } else {
            normalizedAngle = smoothedAngles[frameIdx];
          }

          const movementVector = prevPos ? { x: currentPos.x - prevPos.x, y: currentPos.y - prevPos.y } : null;
          const movementDistance = movementVector ? Math.sqrt(movementVector.x * movementVector.x + movementVector.y * movementVector.y) : 0;
          const shouldWriteTranslate = settings.exportSettings.exportTranslate && (isFirstFrame || isLastFrame || visibilityChanged || prevPos === null ||
            movementDistance > POSITION_THRESHOLD);

          if (shouldWriteTranslate) {
            translateKeys.push({ time: Math.round(frame.time * 1000) / 1000, x: Math.round(currentPos.x * 100) / 100, y: Math.round(-currentPos.y * 100) / 100 });
            prevPos = currentPos;
          }

          const rotationDelta = prevRotation !== null ? normalizedAngle - prevRotation : 0;
          const shouldWriteRotate = settings.exportSettings.exportRotate && (
            isFirstFrame || isLastFrame || visibilityChanged || prevRotation === null ||
            Math.abs(rotationDelta) > ROTATION_THRESHOLD
          );

          if (shouldWriteRotate) {
            rotateKeys.push({ time: Math.round(frame.time * 1000) / 1000, angle: Math.round(normalizedAngle * 100) / 100 });
            prevRotation = normalizedAngle;
          }

          if (settings.exportSettings.exportScale && (isFirstFrame || isLastFrame || visibilityChanged || prevScale === null ||
              Math.abs(currentScale.x - prevScale.x) > SCALE_THRESHOLD || Math.abs(currentScale.y - prevScale.y) > SCALE_THRESHOLD)) {
            scaleKeys.push({
              time: Math.round(frame.time * 1000) / 1000,
              x: Math.round(currentScale.x * 1000) / 1000,
              y: Math.round(currentScale.y * 1000) / 1000
            });
            prevScale = currentScale;
          }

          // Add color keyframe if color changed significantly
          if (settings.exportSettings.exportColor) {
            const colorDeltaSum = prevColor === null ? Number.POSITIVE_INFINITY :
              Math.abs((currentColor.r - prevColor.r) * 255) +
              Math.abs((currentColor.g - prevColor.g) * 255) +
              Math.abs((currentColor.b - prevColor.b) * 255) +
              Math.abs((currentColor.a - prevColor.a) * 255);

            const colorChanged = prevColor === null || colorDeltaSum > COLOR_THRESHOLD;

            if (isFirstFrame || isLastFrame || visibilityChanged || colorChanged) {
              // Spine color format: hex string "rrggbbaa"
              const rHex = Math.round(currentColor.r * 255).toString(16).padStart(2, '0');
              const gHex = Math.round(currentColor.g * 255).toString(16).padStart(2, '0');
              const bHex = Math.round(currentColor.b * 255).toString(16).padStart(2, '0');
              const aHex = Math.round(currentColor.a * 255).toString(16).padStart(2, '0');
              const colorHex = `${rHex}${gHex}${bHex}${aHex}`;

              colorKeys.push({
                time: Math.round(frame.time * 1000) / 1000,
                color: colorHex
              });
              prevColor = currentColor;
            }
          }

          wasVisible = true;
        } else {
          if (wasVisible && visibilityChanged) {
            const time = Math.round(frame.time * 1000) / 1000;
            attachmentKeys.push({ time, name: null });
          }

          if (visibilityChanged && wasVisible) {
            const time = Math.round(frame.time * 1000) / 1000;
            if (settings.exportSettings.exportTranslate && prevPos) translateKeys.push({ time, x: Math.round(prevPos.x * 100) / 100, y: Math.round(-prevPos.y * 100) / 100 });
            if (settings.exportSettings.exportRotate && prevRotation !== null) rotateKeys.push({ time, angle: Math.round(prevRotation * 100) / 100 });
            if (settings.exportSettings.exportScale && prevScale !== null) scaleKeys.push({ time, x: 0, y: 0 });
          }

          wasVisible = false;
        }
      }

      if (hasAppeared) {
        const boneAnimation: any = {};
        if (settings.exportSettings.exportTranslate && translateKeys.length > 0) {
          boneAnimation.translate = translateKeys;
        }
        if (settings.exportSettings.exportRotate && rotateKeys.length > 0) {
          boneAnimation.rotate = rotateKeys;
        }
        if (settings.exportSettings.exportScale && scaleKeys.length > 0) {
          boneAnimation.scale = scaleKeys;
        }

        if (Object.keys(boneAnimation).length > 0) {
          animationData.bones[boneName] = boneAnimation;
        }

        const slotAnimation: any = {};
        if (attachmentKeys.length > 0) {
          slotAnimation.attachment = attachmentKeys;
        }
        if (settings.exportSettings.exportColor && colorKeys.length > 0) {
          slotAnimation.rgba = colorKeys;
        }

        if (Object.keys(slotAnimation).length > 0) {
          animationData.slots[slotName] = slotAnimation;
        }
      }
    }

    if (Object.keys(animationData.bones).length > 0 || Object.keys(animationData.slots).length > 0) {
      return animationData;
    }
    return null;
  };

  // Generate loop animation first
  const loopAnimation = addAnimation('particle_anim', frames);

  // Generate prewarm animation
  const prewarmAnimation = addAnimation('prewarm', prewarmFrames);

  const isLoopAndPrewarmMode = settings.emitters.some(e => e.settings.looping && e.settings.prewarm);

  // If both animations exist and we have frames, copy loop data to prewarm
  if (prewarmAnimation && loopAnimation && frames.length > 0 && prewarmFrames.length > 0) {
    // Get last frame of loop animation
    const lastLoopFrame = frames[frames.length - 1];
    const prewarmDuration = prewarmFrames[prewarmFrames.length - 1].time;

    // Find all visible particles in the last loop frame
    const visibleParticleIds: number[] = [];
    for (const [particleId, particleData] of lastLoopFrame.particles) {
      if (isParticleVisible(particleData)) {
        visibleParticleIds.push(particleId);
      }
    }

    // Track which bones received offset data from loop
    const bonesWithOffsetData = new Set<string>();

    // For each visible particle, copy its animation keys from loop to end of prewarm
    // ONLY if the bone/slot already exists in prewarm (don't create new ones)
    for (const particleId of visibleParticleIds) {
      const emitterId = lastLoopFrame.particles.get(particleId)?.emitterId;
      if (!emitterId) continue;

      const boneName = getParticleBoneName(emitterId, particleId);
      const slotName = getParticleSlotName(emitterId, particleId);

      let boneHasData = false;

      // Copy bone animations (translate, rotate, scale) ONLY if bone already exists in prewarm
      if (loopAnimation.bones[boneName] && prewarmAnimation.bones[boneName]) {
        const loopBone = loopAnimation.bones[boneName];
        const prewarmBone = prewarmAnimation.bones[boneName];

        // Copy translate keys
        if (loopBone.translate && loopBone.translate.length > 0) {
          if (!prewarmBone.translate) {
            prewarmBone.translate = [];
          }
          // Add all translate keys from loop to end of prewarm
          for (const key of loopBone.translate) {
            prewarmBone.translate.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              x: key.x,
              y: key.y
            });
          }
          boneHasData = true;
        }

        // Copy rotate keys
        if (loopBone.rotate && loopBone.rotate.length > 0) {
          if (!prewarmBone.rotate) {
            prewarmBone.rotate = [];
          }
          for (const key of loopBone.rotate) {
            prewarmBone.rotate.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              angle: key.angle
            });
          }
          boneHasData = true;
        }

        // Copy scale keys
        if (loopBone.scale && loopBone.scale.length > 0) {
          if (!prewarmBone.scale) {
            prewarmBone.scale = [];
          }
          for (const key of loopBone.scale) {
            prewarmBone.scale.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              x: key.x,
              y: key.y
            });
          }
          boneHasData = true;
        }

        if (boneHasData) {
          bonesWithOffsetData.add(boneName);
        }
      }

      // Copy slot animations (attachment, rgba) ONLY if slot already exists in prewarm
      if (loopAnimation.slots[slotName] && prewarmAnimation.slots[slotName]) {
        const loopSlot = loopAnimation.slots[slotName];
        const prewarmSlot = prewarmAnimation.slots[slotName];

        // Copy attachment keys
        if (loopSlot.attachment && loopSlot.attachment.length > 0) {
          if (!prewarmSlot.attachment) {
            prewarmSlot.attachment = [];
          }
          for (const key of loopSlot.attachment) {
            prewarmSlot.attachment.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              name: key.name
            });
          }
        }

        // Copy rgba/color keys
        if (loopSlot.rgba && loopSlot.rgba.length > 0) {
          if (!prewarmSlot.rgba) {
            prewarmSlot.rgba = [];
          }
          for (const key of loopSlot.rgba) {
            prewarmSlot.rgba.push({
              time: Math.round((prewarmDuration + key.time) * 1000) / 1000,
              color: key.color
            });
          }
        }
      }
    }

    // If Loop+Prewarm mode, clean up prewarm animation
    if (isLoopAndPrewarmMode) {
      // Remove bones that don't have offset data from loop
      const bonesToKeep: any = {};
      for (const boneName of bonesWithOffsetData) {
        if (prewarmAnimation.bones[boneName]) {
          bonesToKeep[boneName] = prewarmAnimation.bones[boneName];
        }
      }
      prewarmAnimation.bones = bonesToKeep;

      // Remove corresponding slots
      const slotsToKeep: any = {};
      for (const boneName of bonesWithOffsetData) {
        const slotName = boneName.replace('particle_', 'particle_slot_');
        if (prewarmAnimation.slots[slotName]) {
          slotsToKeep[slotName] = prewarmAnimation.slots[slotName];
        }
      }
      prewarmAnimation.slots = slotsToKeep;

      // Calculate new prewarm duration as max time across all keys
      let maxTime = 0;
      for (const boneName in prewarmAnimation.bones) {
        const bone = prewarmAnimation.bones[boneName];
        if (bone.translate) {
          for (const key of bone.translate) {
            maxTime = Math.max(maxTime, key.time);
          }
        }
        if (bone.rotate) {
          for (const key of bone.rotate) {
            maxTime = Math.max(maxTime, key.time);
          }
        }
        if (bone.scale) {
          for (const key of bone.scale) {
            maxTime = Math.max(maxTime, key.time);
          }
        }
      }
      for (const slotName in prewarmAnimation.slots) {
        const slot = prewarmAnimation.slots[slotName];
        if (slot.attachment) {
          for (const key of slot.attachment) {
            maxTime = Math.max(maxTime, key.time);
          }
        }
        if (slot.rgba) {
          for (const key of slot.rgba) {
            maxTime = Math.max(maxTime, key.time);
          }
        }
      }
      // Store the adjusted duration (will be used for renaming)
      (prewarmAnimation as any).__adjustedDuration = maxTime;
    }
  }

  // Add animations with appropriate names
  if (loopAnimation) {
    if (isLoopAndPrewarmMode) {
      // Add frame 0 copy to end of loop for seamless cycling
      const loopDuration = frames[frames.length - 1].time;
      const firstFrame = frames[0];

      // For each bone in loop, add frame 0 keys at the end
      for (const boneName in loopAnimation.bones) {
        const bone = loopAnimation.bones[boneName];
        const track = trackByBoneName.get(boneName);
        const firstParticle = track ? firstFrame.particles.get(track.particleId) : undefined;

        if (firstParticle && isParticleVisible(firstParticle)) {
          // Add translate key from frame 0
          if (bone.translate && bone.translate.length > 0) {
            const firstKey = bone.translate[0];
            bone.translate.push({
              time: Math.round(loopDuration * 1000) / 1000,
              x: firstKey.x,
              y: firstKey.y
            });
          }

          // Add rotate key from frame 0
          if (bone.rotate && bone.rotate.length > 0) {
            const firstKey = bone.rotate[0];
            bone.rotate.push({
              time: Math.round(loopDuration * 1000) / 1000,
              angle: firstKey.angle
            });
          }

          // Add scale key from frame 0
          if (bone.scale && bone.scale.length > 0) {
            const firstKey = bone.scale[0];
            bone.scale.push({
              time: Math.round(loopDuration * 1000) / 1000,
              x: firstKey.x,
              y: firstKey.y
            });
          }
        }
      }

      // For each slot in loop, add frame 0 keys at the end
      for (const slotName in loopAnimation.slots) {
        const slot = loopAnimation.slots[slotName];
        const track = trackBySlotName.get(slotName);
        const firstParticle = track ? firstFrame.particles.get(track.particleId) : undefined;

        if (firstParticle && isParticleVisible(firstParticle)) {
          // Add attachment key from frame 0
          if (slot.attachment && slot.attachment.length > 0) {
            const firstKey = slot.attachment[0];
            slot.attachment.push({
              time: Math.round(loopDuration * 1000) / 1000,
              name: firstKey.name
            });
          }

          // Add rgba key from frame 0
          if (slot.rgba && slot.rgba.length > 0) {
            const firstKey = slot.rgba[0];
            slot.rgba.push({
              time: Math.round(loopDuration * 1000) / 1000,
              color: firstKey.color
            });
          }
        }
      }

      animations['loop'] = loopAnimation;
    } else {
      animations['particle_anim'] = loopAnimation;
    }
  }

  if (prewarmAnimation) {
    animations['prewarm'] = prewarmAnimation;
  }

  return JSON.stringify({ skeleton, bones, slots, skins, animations });
}

class SimpleZip {
  private files: Array<{ name: string; data: Uint8Array }> = [];

  addFile(name: string, data: string | Uint8Array) {
    const uint8Data = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.files.push({ name, data: uint8Data });
  }

  async addCanvasFile(name: string, canvas: HTMLCanvasElement) {
    return new Promise<void>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Failed to convert canvas to blob'));
          return;
        }
        blob.arrayBuffer().then(buffer => {
          this.addFile(name, new Uint8Array(buffer));
          resolve();
        }).catch(reject);
      }, 'image/png');
    });
  }

  generate(): Blob {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let offset = 0;
    const centralDirectory: Uint8Array[] = [];

    for (const file of this.files) {
      const nameBytes = encoder.encode(file.name);
      const crc = this.crc32(file.data);
      
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);
      
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, 0, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, file.data.length, true);
      view.setUint32(22, file.data.length, true);
      view.setUint16(26, nameBytes.length, true);
      view.setUint16(28, 0, true);
      
      localHeader.set(nameBytes, 30);
      chunks.push(localHeader);
      chunks.push(file.data);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(centralHeader.buffer);
      
      cdView.setUint32(0, 0x02014b50, true);
      cdView.setUint16(4, 20, true);
      cdView.setUint16(6, 20, true);
      cdView.setUint16(8, 0, true);
      cdView.setUint16(10, 0, true);
      cdView.setUint16(12, 0, true);
      cdView.setUint16(14, 0, true);
      cdView.setUint32(16, crc, true);
      cdView.setUint32(20, file.data.length, true);
      cdView.setUint32(24, file.data.length, true);
      cdView.setUint16(28, nameBytes.length, true);
      cdView.setUint16(30, 0, true);
      cdView.setUint16(32, 0, true);
      cdView.setUint16(34, 0, true);
      cdView.setUint16(36, 0, true);
      cdView.setUint32(38, 0, true);
      cdView.setUint32(42, offset, true);
      
      centralHeader.set(nameBytes, 46);
      centralDirectory.push(centralHeader);

      offset += localHeader.length + file.data.length;
    }

    const centralDirData = new Uint8Array(centralDirectory.reduce((sum, cd) => sum + cd.length, 0));
    let cdOffset = 0;
    for (const cd of centralDirectory) {
      centralDirData.set(cd, cdOffset);
      cdOffset += cd.length;
    }

    const endOfCentralDir = new Uint8Array(22);
    const eocdView = new DataView(endOfCentralDir.buffer);
    
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, this.files.length, true);
    eocdView.setUint16(10, this.files.length, true);
    eocdView.setUint32(12, centralDirData.length, true);
    eocdView.setUint32(16, offset, true);
    eocdView.setUint16(20, 0, true);

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0) + centralDirData.length + endOfCentralDir.length;
    const result = new Uint8Array(totalSize);
    
    let resultOffset = 0;
    for (const chunk of chunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }
    result.set(centralDirData, resultOffset);
    resultOffset += centralDirData.length;
    result.set(endOfCentralDir, resultOffset);

    return new Blob([result], { type: 'application/zip' });
  }

  private crc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}


export {
  createParticleSprite,
  createParticleAtlas,
  bakeParticleAnimation,
  renderBakedPreview,
  generateAtlasFile,
  generateSpineJSON,
  SimpleZip,
  downloadBlob,
};
