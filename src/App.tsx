/**
 * Particle → Spine Exporter v104
 *
 * Version: 104
 * Date: 2025-12-01
 *
 * Architecture:
 * - SOLID/GRASP/DRY principles applied
 * - FSM for editor lifecycle
 * - Separated Model (Settings), Operational (FSM), and Ephemeral (Viewport) state
 * - Observer pattern in ParticleEngine for high-frequency stats
 * - Extracted panel components for each settings domain
 * - Reusable form field components (LabeledNumber, LabeledSelect, etc.)
 * - Custom hooks for sprite management and particle bridge
 */

import { useState, useCallback, useEffect } from "react";

// Context Providers
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { ViewportProvider } from "./context/ViewportContext";

// Components
import { Viewport } from "./components/Viewport";
import {
  EmitterManagementPanel,
  EmitterSettingsPanel,
  ParticleSettingsPanel,
  ForcesPanel,
  CurvesPanel,
  ExportPanel,
} from "./components/panels";

// Hooks
import { useParticleBridge, useSpriteManager } from "./hooks";

// Export functionality for multi-emitter export
import {
  bakeParticleAnimation,
  generateSpineJSON,
  renderBakedPreview,
  SimpleZip,
  downloadBlob,
} from "./export";

// ============================================================
// PANEL STATE HOOK
// ============================================================

function usePanelState() {
  const [emitterOpen, setEmitterOpen] = useState(true);
  const [particleOpen, setParticleOpen] = useState(true);
  const [forcesOpen, setForcesOpen] = useState(true);
  const [curvesOpen, setCurvesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(true);

  return {
    emitter: { isOpen: emitterOpen, toggle: () => setEmitterOpen((o) => !o) },
    particle: {
      isOpen: particleOpen,
      toggle: () => setParticleOpen((o) => !o),
    },
    forces: { isOpen: forcesOpen, toggle: () => setForcesOpen((o) => !o) },
    curves: { isOpen: curvesOpen, toggle: () => setCurvesOpen((o) => !o) },
    export: { isOpen: exportOpen, toggle: () => setExportOpen((o) => !o) },
  };
}

// ============================================================
// MAIN EDITOR COMPONENT
// ============================================================

const ParticleEditor: React.FC = () => {
  const [exportStatus, setExportStatus] = useState("");
  const [multiExportStatus, setMultiExportStatus] = useState("");

  // Context hooks
  const {
    settings,
    currentEmitter,
    currentEmitterSettings: em,
    resetSettings,
  } = useSettings();

  // Custom hooks
  const bridge = useParticleBridge();
  const sprite = useSpriteManager();
  const panels = usePanelState();

  // Reset handler
  const handleReset = useCallback(() => {
    sprite.clearAllSprites();
    resetSettings();
    bridge.handleRestart();
  }, [sprite, resetSettings, bridge]);

  // Multi-emitter export handlers
  const handleMultiExportJSON = useCallback(async () => {
    setMultiExportStatus("🔄 Generating JSON for all enabled emitters...");
    bridge.machine.startExport();

    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const { frames, prewarmFrames } = bakeParticleAnimation(settings);

      const spriteNameMap = new Map<string, string>();
      for (let i = 0; i < settings.emitters.length; i++) {
        const emitter = settings.emitters[i];
        if (!emitter.enabled) continue;
        const spriteName = `sprite_${i + 1}`;
        spriteNameMap.set(emitter.id, spriteName);
      }

      const spineJSON = generateSpineJSON(
        frames,
        prewarmFrames,
        settings,
        spriteNameMap
      );

      const jsonBlob = new Blob([spineJSON], {
        type: "application/json",
      });
      downloadBlob(jsonBlob, "particle_spine.json");

      setMultiExportStatus(`✅ All Emitters JSON Downloaded!`);
      bridge.machine.completeExport();
      setTimeout(() => setMultiExportStatus(""), 3000);
    } catch (error) {
      console.error("Export error:", error);
      setMultiExportStatus(
        "❌ Error: " + (error instanceof Error ? error.message : "Unknown")
      );
      bridge.machine.errorExport(
        error instanceof Error ? error.message : "Unknown"
      );
      setTimeout(() => setMultiExportStatus(""), 3000);
    }
  }, [settings, bridge.machine]);

  const handleMultiExportZIP = useCallback(async () => {
    setMultiExportStatus("🔄 Baking all enabled emitters...");
    bridge.machine.startExport();

    await new Promise((resolve) => setTimeout(resolve, 50));

    try {
      const { frames, prewarmFrames } = bakeParticleAnimation(settings);
      const uniqueParticles = new Set<number>();
      for (const frame of frames) {
        for (const [id] of frame.particles) {
          uniqueParticles.add(id as number);
        }
      }
      setMultiExportStatus(
        `✓ ${frames.length} frames, ${uniqueParticles.size} particles`
      );
      await new Promise((resolve) => setTimeout(resolve, 50));

      const spriteNameMap = new Map<string, string>();
      const emitterSprites: Array<{
        emitterId: string;
        name: string;
        canvas: HTMLCanvasElement;
      }> = [];

      for (let i = 0; i < settings.emitters.length; i++) {
        const emitter = settings.emitters[i];
        if (!emitter.enabled) continue;

        const spriteName = `sprite_${i + 1}`;
        spriteNameMap.set(emitter.id, spriteName);

        const spriteCanvas = await sprite.resolveEmitterSpriteCanvas(emitter);
        emitterSprites.push({
          emitterId: emitter.id,
          name: spriteName,
          canvas: spriteCanvas,
        });
      }

      const spineJSON = generateSpineJSON(
        frames,
        prewarmFrames,
        settings,
        spriteNameMap
      );
      const previewCanvas = renderBakedPreview(frames, settings);

      const zip = new SimpleZip();
      for (const spr of emitterSprites) {
        await zip.addCanvasFile(`${spr.name}.png`, spr.canvas);
      }
      await zip.addCanvasFile("preview.png", previewCanvas);
      zip.addFile("particle_spine.json", spineJSON);

      const zipBlob = zip.generate();
      downloadBlob(zipBlob, "particle_export.zip");

      setMultiExportStatus(`✅ All Emitters Exported!`);
      bridge.machine.completeExport();
      setTimeout(() => setMultiExportStatus(""), 3000);
    } catch (error) {
      console.error("Export error:", error);
      setMultiExportStatus(
        "❌ Error: " + (error instanceof Error ? error.message : "Unknown")
      );
      bridge.machine.errorExport(
        error instanceof Error ? error.message : "Unknown"
      );
      setTimeout(() => setMultiExportStatus(""), 3000);
    }
  }, [settings, sprite, bridge.machine]);

  // Safety check for emission type consistency
  const { updateCurrentEmitter } = useSettings();
  useEffect(() => {
    if (!em) return;
    // Only disable looping for non-continuous modes
    // Prewarm is now available for both continuous and duration modes
    if (em.emissionType === "burst" && (em.looping || em.prewarm)) {
      updateCurrentEmitter({ looping: false, prewarm: false });
    }
  }, [em?.emissionType, em?.looping, em?.prewarm, updateCurrentEmitter]);

  // Guard for missing emitter settings
  if (!em || !currentEmitter) {
    return <div className="text-white p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="mx-auto max-w-[min(1870px,100vw-2rem)]">
        {/* Header */}
        <header className="mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
           BoneGyre
          </h1>
          <p className="text-xs text-slate-400">
            (alpha_v106)
          </p>
        </header>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {/* Columns 1-2: Wide Preview + Timeline */}
          <div className="space-y-3 xl:col-span-2">
            <Viewport />
            {/* Hidden file input for sprite upload */}
            <input
              ref={sprite.spriteInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={sprite.handleSpriteUpload}
              style={{ display: "none" }}
            />
          </div>

          {/* Column 3: Particle Settings & Forces */}
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
            <ParticleSettingsPanel
              isOpen={panels.particle.isOpen}
              onToggle={panels.particle.toggle}
              spriteStatus={sprite.spriteStatus}
              onSpriteUploadClick={() => sprite.spriteInputRef.current?.click()}
            />
            <ForcesPanel
              isOpen={panels.forces.isOpen}
              onToggle={panels.forces.toggle}
            />
            <CurvesPanel
              isOpen={panels.curves.isOpen}
              onToggle={panels.curves.toggle}
            />
          </div>

          {/* Column 4: Export Settings */}
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-8rem)] pr-1">
            <ExportPanel
              isOpen={panels.export.isOpen}
              onToggle={panels.export.toggle}
              resolveEmitterSpriteCanvas={sprite.resolveEmitterSpriteCanvas}
              exportStatus={exportStatus}
              setExportStatus={setExportStatus}
            />

            {/* Multi-Emitter Export Section */}
            <div className="border border-slate-600 rounded bg-slate-800/30 p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Export All Enabled Emitters
              </div>

              {multiExportStatus && (
                <div className="text-xs text-center py-1 bg-slate-800 rounded mb-2">
                  {multiExportStatus}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleMultiExportJSON}
                  className="px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded transition-colors text-sm font-semibold"
                >
                  📄 Download JSON<br/>(All Emitters)
                </button>
                <button
                  onClick={handleMultiExportZIP}
                  className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded transition-colors text-sm font-semibold"
                >
                  📦 Download ZIP<br/>(All Emitters)
                </button>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-xs"
            >
              Reset All Settings
            </button>
          </div>

          {/* Row below timeline: Emitters & Emitter Settings */}
          <div className="space-y-3 xl:col-span-1">
            <EmitterManagementPanel />
          </div>
          <div className="space-y-3 xl:col-span-1">
            <EmitterSettingsPanel
              isOpen={panels.emitter.isOpen}
              onToggle={panels.emitter.toggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ROOT APP COMPONENT (Provider Wrapper)
// ============================================================

const ParticleSpineExporter: React.FC = () => {
  return (
    <SettingsProvider>
      <ViewportProvider>
        <ParticleEditor />
      </ViewportProvider>
    </SettingsProvider>
  );
};

export default ParticleSpineExporter;
