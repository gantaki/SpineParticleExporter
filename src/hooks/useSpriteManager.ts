/**
 * useSpriteManager Hook
 * Encapsulates all sprite management logic: loading, caching, resolving
 */

import { useCallback, useRef, useEffect, useState } from "react";
import type { EmitterInstance } from "../types";
import { createParticleSprite } from "../export";
import { useViewport } from "../context/ViewportContext";
import { useSettings } from "../context/SettingsContext";

export interface SpriteManager {
  /** Status message for sprite loading */
  spriteStatus: string | null;
  /** Reference to hidden file input */
  spriteInputRef: React.RefObject<HTMLInputElement>;
  /** Handle file upload from input */
  handleSpriteUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Resolve sprite canvas for an emitter (async, cached) */
  resolveEmitterSpriteCanvas: (
    emitter: EmitterInstance
  ) => Promise<HTMLCanvasElement>;
  /** Clear all sprite caches */
  clearAllSprites: () => void;
}

export function useSpriteManager(): SpriteManager {
  const [spriteStatus, setSpriteStatus] = useState<string | null>(null);
  const spriteInputRef = useRef<HTMLInputElement>(null);
  const spriteCacheRef = useRef<Record<string, HTMLCanvasElement | null>>({});
  const spriteSignatureRef = useRef<Record<string, string>>({});

  const { setSpriteCanvas, clearSpriteCanvases } = useViewport();
  const { settings, currentEmitter, updateCurrentEmitter } = useSettings();

  // Set sprite for an emitter
  const setEmitterSprite = useCallback(
    (emitterId: string, canvas: HTMLCanvasElement | null) => {
      spriteCacheRef.current[emitterId] = canvas;
      setSpriteCanvas(emitterId, canvas);
    },
    [setSpriteCanvas]
  );

  // Refresh sprite for a single emitter
  const refreshEmitterSprite = useCallback(
    (emitter: EmitterInstance) => {
      const signature = `${emitter.settings.particleSprite}:${
        emitter.settings.customSpriteData || ""
      }`;

      if (
        spriteSignatureRef.current[emitter.id] === signature &&
        spriteCacheRef.current[emitter.id]
      ) {
        return;
      }

      spriteSignatureRef.current[emitter.id] = signature;

      if (emitter.settings.particleSprite === "custom") {
        if (!emitter.settings.customSpriteData) {
          setEmitterSprite(emitter.id, null);
          setSpriteStatus("Upload a sprite image to use the custom option");
          return;
        }

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, img.width, img.height);
          setEmitterSprite(emitter.id, canvas);
          setSpriteStatus(`Custom sprite loaded for ${emitter.name}`);
        };
        img.onerror = () =>
          setSpriteStatus(
            `Unable to load the selected sprite image for ${emitter.name}`
          );
        img.src = emitter.settings.customSpriteData;
      } else {
        const canvas = createParticleSprite(
          emitter.settings.particleSprite as Parameters<
            typeof createParticleSprite
          >[0],
          64
        );
        setEmitterSprite(emitter.id, canvas);
        setSpriteStatus(null);
      }
    },
    [setEmitterSprite]
  );

  // Sync sprites when emitters change
  useEffect(() => {
    const emitterIds = new Set(settings.emitters.map((e) => e.id));

    // Cleanup removed emitters
    for (const key of Object.keys(spriteCacheRef.current)) {
      if (!emitterIds.has(key)) {
        delete spriteCacheRef.current[key];
        delete spriteSignatureRef.current[key];
      }
    }

    // Refresh sprites for all emitters
    for (const emitter of settings.emitters) {
      refreshEmitterSprite(emitter);
    }
  }, [settings.emitters, refreshEmitterSprite]);

  // Handle file upload
  const handleSpriteUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSpriteStatus(`Loading ${file.name}...`);
        const reader = new FileReader();
        reader.onload = (event) => {
          const data = event.target?.result as string;
          const img = new Image();
          img.onload = () => {
            updateCurrentEmitter({
              particleSprite: "custom",
              customSpriteData: data,
            });
            setSpriteStatus(
              `Custom sprite loaded for ${currentEmitter?.name || "Emitter"}`
            );
          };
          img.onerror = () =>
            setSpriteStatus("Failed to decode the selected sprite image.");
          img.src = data;
        };
        reader.onerror = () =>
          setSpriteStatus("Failed to read the selected sprite file.");
        reader.readAsDataURL(file);
        e.target.value = "";
      }
    },
    [updateCurrentEmitter, currentEmitter?.name]
  );

  // Resolve sprite canvas (async, with caching)
  const resolveEmitterSpriteCanvas = useCallback(
    async (emitter: EmitterInstance): Promise<HTMLCanvasElement> => {
      const cached = spriteCacheRef.current[emitter.id];
      if (cached) return cached;

      if (
        emitter.settings.particleSprite === "custom" &&
        emitter.settings.customSpriteData
      ) {
        return await new Promise<HTMLCanvasElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, 0, 0, img.width, img.height);
            spriteCacheRef.current[emitter.id] = canvas;
            setSpriteCanvas(emitter.id, canvas);
            resolve(canvas);
          };
          img.onerror = () =>
            reject(
              new Error(`Failed to load custom sprite for ${emitter.name}`)
            );
          img.src = emitter.settings.customSpriteData!;
        });
      }

      const spriteType =
        emitter.settings.particleSprite === "custom"
          ? "circle"
          : emitter.settings.particleSprite;
      const canvas = createParticleSprite(
        spriteType as Parameters<typeof createParticleSprite>[0],
        64
      );
      spriteCacheRef.current[emitter.id] = canvas;
      setSpriteCanvas(emitter.id, canvas);
      return canvas;
    },
    [setSpriteCanvas]
  );

  // Clear all sprites
  const clearAllSprites = useCallback(() => {
    spriteCacheRef.current = {};
    spriteSignatureRef.current = {};
    clearSpriteCanvases();
    setSpriteStatus(null);
  }, [clearSpriteCanvases]);

  return {
    spriteStatus,
    spriteInputRef,
    handleSpriteUpload,
    resolveEmitterSpriteCanvas,
    clearAllSprites,
  };
}
