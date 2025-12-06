/**
 * ExportPanel
 * Controls export settings, thresholds, animation selection, and handles the export action
 */

import { memo, useCallback, useState } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { ChevronDown, ChevronRight } from "lucide-react";
import { LabeledNumber, LabeledCheckbox } from "../fields";
import { useSettings } from "../../context/SettingsContext";
import { useParticleBridge } from "../../hooks/useParticleBridge";
import { roundToDecimals } from "../../utils";
import type { EmitterInstance } from "../../types";

// ============================================================
// INLINE COLLAPSIBLE COMPONENT FOR SUB-SECTIONS
// ============================================================

interface InlineCollapsibleProps {
  title: string;
  icon?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const InlineCollapsible = memo<InlineCollapsibleProps>(
  ({ title, icon, isOpen, onToggle, children }) => {
    return (
      <div className="border border-slate-600 rounded bg-slate-800/20">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-700/30 transition-colors rounded"
        >
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
            {icon && <span>{icon}</span>}
            {title}
          </span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {isOpen && <div className="px-2 pb-2 space-y-2">{children}</div>}
      </div>
    );
  }
);
InlineCollapsible.displayName = "InlineCollapsible";

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
// ANIMATION EXPORT OPTIONS (FOR LOOPING EMITTERS)
// ============================================================

const AnimationExportOptions = memo(() => {
  const { settings, updateAnimationExportOptions } = useSettings();

  // Filter emitters that have BOTH looping AND prewarm enabled
  const loopingPrewarmEmitters = settings.emitters.filter(
    (em) => em.enabled && em.settings.looping && em.settings.prewarm
  );

  if (loopingPrewarmEmitters.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">
        Animations to Export
      </div>
      {loopingPrewarmEmitters.map((emitter) => {
        const options =
          settings.exportSettings.animationExportOptions[emitter.id] || {
            exportLoop: true,
            exportPrewarm: true,
          };

        return (
          <div key={emitter.id} className="space-y-1">
            <div className="text-[10px] text-slate-400 mt-2">{emitter.name}</div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={options.exportLoop}
                onChange={(e) =>
                  updateAnimationExportOptions(emitter.id, {
                    exportLoop: e.target.checked,
                  })
                }
                className="rounded"
              />
              <span>Loop Animation</span>
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={options.exportPrewarm}
                onChange={(e) =>
                  updateAnimationExportOptions(emitter.id, {
                    exportPrewarm: e.target.checked,
                  })
                }
                className="rounded"
              />
              <span>Prewarm Animation</span>
            </label>
          </div>
        );
      })}
    </div>
  );
});
AnimationExportOptions.displayName = "AnimationExportOptions";

// ============================================================
// EXPORT DETAILS (TIMELINE, EMITTERS, ANIMATIONS)
// ============================================================

const ExportDetails = memo(() => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <InlineCollapsible
      title="Export Details"
      icon="📋"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <TimelineExportOptions />
      <EmitterExportOptions />
      <AnimationExportOptions />
    </InlineCollapsible>
  );
});
ExportDetails.displayName = "ExportDetails";

// ============================================================
// OPTIMIZE EXPORT FILES (THRESHOLDS)
// ============================================================

const OptimizeExportFiles = memo(() => {
  const { settings, updateExportSettings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <InlineCollapsible
      title="Optimize Export Files"
      icon="⚙️"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <LabeledNumber
        label="Position Threshold (px)"
        value={roundToDecimals(settings.exportSettings.positionThreshold)}
        onChange={(v) =>
          updateExportSettings({ positionThreshold: roundToDecimals(v) })
        }
        min={0}
        step={0.1}
        max={50}
      />

      {/* Translate Decimation - reduces keyframes in high-density areas */}
      <div className="mt-2 pt-2 border-t border-slate-600">
        <LabeledCheckbox
          label="Translate Decimation (Reduce Dense Keys)"
          checked={settings.exportSettings.translateDecimationEnabled}
          onChange={(checked) =>
            updateExportSettings({ translateDecimationEnabled: checked })
          }
        />
        {settings.exportSettings.translateDecimationEnabled && (
          <LabeledNumber
            label="Removal % in Dense Regions"
            value={settings.exportSettings.translateDecimationPercentage}
            onChange={(v) =>
              updateExportSettings({
                translateDecimationPercentage: Math.round(v),
              })
            }
            min={0}
            step={5}
            max={95}
            integer={true}
          />
        )}
      </div>

      <LabeledNumber
        label="Rotation Threshold (°)"
        value={roundToDecimals(settings.exportSettings.rotationThreshold)}
        onChange={(v) =>
          updateExportSettings({ rotationThreshold: roundToDecimals(v) })
        }
        min={0}
        step={0.1}
        max={360}
      />
      <LabeledNumber
        label="Scale Threshold"
        value={roundToDecimals(settings.exportSettings.scaleThreshold)}
        onChange={(v) =>
          updateExportSettings({ scaleThreshold: roundToDecimals(v) })
        }
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
    </InlineCollapsible>
  );
});
OptimizeExportFiles.displayName = "OptimizeExportFiles";

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

    const handleExportJSON = useCallback(async () => {
      setExportStatus("🔄 Generating JSON...");
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

        setExportStatus(`✅ JSON Downloaded!`);
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
    }, [settings, bridge.machine, setExportStatus]);

    return (
      <CollapsibleSection
        title="💾 Export Settings"
        isOpen={isOpen}
        onToggle={onToggle}
      >
        <div className="space-y-2">
          <ExportDetails />
          <OptimizeExportFiles />

          {exportStatus && (
            <div className="text-xs text-center py-1 bg-slate-800 rounded">
              {exportStatus}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportJSON}
              className="px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded transition-colors text-sm font-semibold"
            >
              📄 Download JSON
            </button>
            <button
              onClick={handleExport}
              className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded transition-colors text-sm font-semibold"
            >
              📦 Download ZIP
            </button>
          </div>
        </div>
      </CollapsibleSection>
    );
  }
);
ExportPanel.displayName = "ExportPanel";
