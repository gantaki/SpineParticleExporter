/**
 * ExportPanel
 * Controls export settings, thresholds, and handles the export action
 */

import { memo, useCallback } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { LabeledNumber, LabeledCheckbox } from "../fields";
import { useSettings } from "../../context/SettingsContext";
import { useParticleBridge } from "../../hooks/useParticleBridge";
import type { EmitterInstance } from "../../types";

// Export functionality
import {
  bakeParticleAnimation,
  generateSpineJSON,
  renderBakedPreview,
  SimpleZip,
  downloadBlob,
} from "../../export";

// ============================================================
// TIMELINE EXPORT CHECKBOXES
// ============================================================

const TimelineExportOptions = memo(() => {
  const { settings, updateExportSettings } = useSettings();

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">
        Timeline Export
      </div>
      <LabeledCheckbox
        label="Export Translate"
        checked={settings.exportSettings.exportTranslate}
        onChange={(checked) =>
          updateExportSettings({ exportTranslate: checked })
        }
      />
      <LabeledCheckbox
        label="Export Rotate"
        checked={settings.exportSettings.exportRotate}
        onChange={(checked) => updateExportSettings({ exportRotate: checked })}
      />
      <LabeledCheckbox
        label="Export Scale"
        checked={settings.exportSettings.exportScale}
        onChange={(checked) => updateExportSettings({ exportScale: checked })}
      />
      <LabeledCheckbox
        label="Export Color"
        checked={settings.exportSettings.exportColor}
        onChange={(checked) => updateExportSettings({ exportColor: checked })}
      />
    </div>
  );
});
TimelineExportOptions.displayName = "TimelineExportOptions";

// ============================================================
// EMITTER EXPORT CHECKBOXES
// ============================================================

const EmitterExportOptions = memo(() => {
  const { settings, toggleEmitterExport } = useSettings();

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">
        Emitters to Export
      </div>
      {settings.emitters.map((emitter) => (
        <label
          key={emitter.id}
          className="flex items-center gap-2 text-xs cursor-pointer"
        >
          <input
            type="checkbox"
            checked={emitter.enabled}
            onChange={() => toggleEmitterExport(emitter.id)}
            className="rounded"
          />
          <span>{emitter.name}</span>
          {!emitter.enabled && (
            <span className="text-slate-500 text-[10px]">(disabled)</span>
          )}
        </label>
      ))}
    </div>
  );
});
EmitterExportOptions.displayName = "EmitterExportOptions";

// ============================================================
// KEYFRAME THRESHOLDS
// ============================================================

const KeyframeThresholds = memo(() => {
  const { settings, updateExportSettings } = useSettings();

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">
        Keyframe Thresholds
      </div>
      <LabeledNumber
        label="Position Threshold (px)"
        value={settings.exportSettings.positionThreshold}
        onChange={(v) => updateExportSettings({ positionThreshold: v })}
        min={0}
        step={0.1}
        max={50}
      />
      <LabeledNumber
        label="Rotation Threshold (°)"
        value={settings.exportSettings.rotationThreshold}
        onChange={(v) => updateExportSettings({ rotationThreshold: v })}
        min={0}
        step={0.1}
        max={180}
      />
      <LabeledNumber
        label="Scale Threshold"
        value={settings.exportSettings.scaleThreshold}
        onChange={(v) => updateExportSettings({ scaleThreshold: v })}
        min={0}
        step={0.01}
        max={2}
      />
      <LabeledNumber
        label="Color Threshold (RGBA Sum)"
        value={settings.exportSettings.colorThreshold}
        onChange={(v) => updateExportSettings({ colorThreshold: v })}
        min={0}
        step={1}
        max={1020}
        integer={true}
      />
    </div>
  );
});
KeyframeThresholds.displayName = "KeyframeThresholds";

// ============================================================
// EXPORT PANEL PROPS & TYPES
// ============================================================

interface ExportPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  resolveEmitterSpriteCanvas: (
    emitter: EmitterInstance
  ) => Promise<HTMLCanvasElement>;
  exportStatus: string;
  setExportStatus: (status: string) => void;
}

// ============================================================
// MAIN EXPORT PANEL COMPONENT
// ============================================================

export const ExportPanel = memo<ExportPanelProps>(
  ({
    isOpen,
    onToggle,
    resolveEmitterSpriteCanvas,
    exportStatus,
    setExportStatus,
  }) => {
    const { settings } = useSettings();
    const bridge = useParticleBridge();

    const handleExport = useCallback(async () => {
      setExportStatus("🔄 Baking...");
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
        setExportStatus(
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

          const spriteCanvas = await resolveEmitterSpriteCanvas(emitter);
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
        for (const sprite of emitterSprites) {
          await zip.addCanvasFile(`${sprite.name}.png`, sprite.canvas);
        }
        await zip.addCanvasFile("preview.png", previewCanvas);
        zip.addFile("particle_spine.json", spineJSON);

        const zipBlob = zip.generate();
        downloadBlob(zipBlob, "particle_export.zip");

        setExportStatus(`✅ Exported!`);
        bridge.machine.completeExport();
        setTimeout(() => setExportStatus(""), 3000);
      } catch (error) {
        console.error("Export error:", error);
        setExportStatus(
          "❌ Error: " + (error instanceof Error ? error.message : "Unknown")
        );
        bridge.machine.errorExport(
          error instanceof Error ? error.message : "Unknown"
        );
        setTimeout(() => setExportStatus(""), 3000);
      }
    }, [settings, resolveEmitterSpriteCanvas, bridge.machine, setExportStatus]);

    return (
      <CollapsibleSection
        title="💾 Export Settings"
        isOpen={isOpen}
        onToggle={onToggle}
      >
        <div className="space-y-2">
          <div className="text-xs text-slate-400 bg-slate-900/50 p-2 rounded space-y-1">
            <div>
              Total Frames: {Math.ceil(settings.duration * settings.fps)}
            </div>
          </div>

          <TimelineExportOptions />
          <EmitterExportOptions />
          <KeyframeThresholds />

          {exportStatus && (
            <div className="text-xs text-center py-1 bg-slate-800 rounded">
              {exportStatus}
            </div>
          )}

          <button
            onClick={handleExport}
            className="w-full px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded transition-colors text-sm font-semibold"
          >
            📦 Export to Spine
          </button>
        </div>
      </CollapsibleSection>
    );
  }
);
ExportPanel.displayName = "ExportPanel";
