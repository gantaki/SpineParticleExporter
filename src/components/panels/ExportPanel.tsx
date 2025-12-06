/**
 * ExportPanel
 * Controls per-emitter export settings and handles export actions
 *
 * Architecture:
 * - Each emitter now has isolated export settings
 * - Shows settings for currently selected emitter
 * - Supports single-emitter and multi-emitter export
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
// TIMELINE EXPORT CHECKBOXES (PER-EMITTER)
// ============================================================

const TimelineExportOptions = memo(() => {
  const { currentEmitter, updateCurrentEmitterExportSettings } = useSettings();

  if (!currentEmitter) return null;

  const exportSettings = currentEmitter.exportSettings;

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">
        Timeline Export
      </div>
      <LabeledCheckbox
        label="Export Translate"
        checked={exportSettings.exportTranslate}
        onChange={(checked) =>
          updateCurrentEmitterExportSettings({ exportTranslate: checked })
        }
      />
      <LabeledCheckbox
        label="Export Rotate"
        checked={exportSettings.exportRotate}
        onChange={(checked) =>
          updateCurrentEmitterExportSettings({ exportRotate: checked })
        }
      />
      <LabeledCheckbox
        label="Export Scale"
        checked={exportSettings.exportScale}
        onChange={(checked) =>
          updateCurrentEmitterExportSettings({ exportScale: checked })
        }
      />
      <LabeledCheckbox
        label="Export Color"
        checked={exportSettings.exportColor}
        onChange={(checked) =>
          updateCurrentEmitterExportSettings({ exportColor: checked })
        }
      />
    </div>
  );
});
TimelineExportOptions.displayName = "TimelineExportOptions";

// ============================================================
// ANIMATION EXPORT OPTIONS (FOR LOOPING EMITTERS)
// ============================================================

const AnimationExportOptions = memo(() => {
  const { settings, currentEmitter, updateAnimationExportOptions } =
    useSettings();

  if (!currentEmitter) return null;

  const em = currentEmitter.settings;

  // Only show if current emitter has BOTH looping AND prewarm enabled
  if (!currentEmitter.enabled || !em.looping || !em.prewarm) return null;

  const options =
    settings.exportSettings.animationExportOptions[currentEmitter.id] || {
      exportLoop: true,
      exportPrewarm: true,
    };

  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-slate-300 mt-3 mb-1">
        Animations to Export
      </div>
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={options.exportLoop}
          onChange={(e) =>
            updateAnimationExportOptions(currentEmitter.id, {
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
            updateAnimationExportOptions(currentEmitter.id, {
              exportPrewarm: e.target.checked,
            })
          }
          className="rounded"
        />
        <span>Prewarm Animation</span>
      </label>
    </div>
  );
});
AnimationExportOptions.displayName = "AnimationExportOptions";

// ============================================================
// EXPORT DETAILS (TIMELINE, ANIMATIONS)
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
      <AnimationExportOptions />
    </InlineCollapsible>
  );
});
ExportDetails.displayName = "ExportDetails";

// ============================================================
// OPTIMIZE EXPORT FILES (THRESHOLDS - PER-EMITTER)
// ============================================================

const OptimizeExportFiles = memo(() => {
  const { currentEmitter, updateCurrentEmitterExportSettings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentEmitter) return null;

  const exportSettings = currentEmitter.exportSettings;

  return (
    <InlineCollapsible
      title="Optimize Export Files"
      icon="⚙️"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <LabeledNumber
        label="Position Threshold (px)"
        value={roundToDecimals(exportSettings.positionThreshold)}
        onChange={(v) =>
          updateCurrentEmitterExportSettings({
            positionThreshold: roundToDecimals(v),
          })
        }
        min={0}
        step={0.1}
        max={50}
      />

      {/* Translate Decimation - reduces keyframes in high-density areas */}
      <div className="mt-2 pt-2 border-t border-slate-600">
        <LabeledCheckbox
          label="Translate Decimation (Reduce Dense Keys)"
          checked={exportSettings.translateDecimationEnabled}
          onChange={(checked) =>
            updateCurrentEmitterExportSettings({
              translateDecimationEnabled: checked,
            })
          }
        />
        {exportSettings.translateDecimationEnabled && (
          <LabeledNumber
            label="Removal % in Dense Regions"
            value={exportSettings.translateDecimationPercentage}
            onChange={(v) =>
              updateCurrentEmitterExportSettings({
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
        value={roundToDecimals(exportSettings.rotationThreshold)}
        onChange={(v) =>
          updateCurrentEmitterExportSettings({
            rotationThreshold: roundToDecimals(v),
          })
        }
        min={0}
        step={0.1}
        max={360}
      />
      <LabeledNumber
        label="Scale Threshold"
        value={roundToDecimals(exportSettings.scaleThreshold)}
        onChange={(v) =>
          updateCurrentEmitterExportSettings({
            scaleThreshold: roundToDecimals(v),
          })
        }
        min={0}
        step={0.01}
        max={2}
      />
      <LabeledNumber
        label="Color Threshold (RGBA Sum)"
        value={exportSettings.colorThreshold}
        onChange={(v) =>
          updateCurrentEmitterExportSettings({ colorThreshold: v })
        }
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
    const { settings, currentEmitter, toggleEmitterExport } = useSettings();
    const bridge = useParticleBridge();

    // ============================================================
    // SINGLE EMITTER EXPORT HANDLERS
    // ============================================================

    const handleExportCurrentEmitterJSON = useCallback(async () => {
      if (!currentEmitter) return;

      setExportStatus("🔄 Generating JSON for current emitter...");
      bridge.machine.startExport();

      await new Promise((resolve) => setTimeout(resolve, 50));

      try {
        // Create a temporary settings object with only the current emitter
        const singleEmitterSettings = {
          ...settings,
          emitters: [currentEmitter],
        };

        const { frames, prewarmFrames } =
          bakeParticleAnimation(singleEmitterSettings);

        const spriteNameMap = new Map<string, string>();
        spriteNameMap.set(currentEmitter.id, "sprite_1");

        const spineJSON = generateSpineJSON(
          frames,
          prewarmFrames,
          singleEmitterSettings,
          spriteNameMap
        );

        const jsonBlob = new Blob([spineJSON], {
          type: "application/json",
        });
        downloadBlob(jsonBlob, `${currentEmitter.name}_spine.json`);

        setExportStatus(`✅ ${currentEmitter.name} JSON Downloaded!`);
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
    }, [settings, currentEmitter, bridge.machine, setExportStatus]);

    const handleExportCurrentEmitterZIP = useCallback(async () => {
      if (!currentEmitter) return;

      setExportStatus("🔄 Baking current emitter...");
      bridge.machine.startExport();

      await new Promise((resolve) => setTimeout(resolve, 50));

      try {
        // Create a temporary settings object with only the current emitter
        const singleEmitterSettings = {
          ...settings,
          emitters: [currentEmitter],
        };

        const { frames, prewarmFrames } =
          bakeParticleAnimation(singleEmitterSettings);

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
        spriteNameMap.set(currentEmitter.id, "sprite_1");

        const spriteCanvas = await resolveEmitterSpriteCanvas(currentEmitter);

        const spineJSON = generateSpineJSON(
          frames,
          prewarmFrames,
          singleEmitterSettings,
          spriteNameMap
        );
        const previewCanvas = renderBakedPreview(frames, singleEmitterSettings);

        const zip = new SimpleZip();
        await zip.addCanvasFile("sprite_1.png", spriteCanvas);
        await zip.addCanvasFile("preview.png", previewCanvas);
        zip.addFile("particle_spine.json", spineJSON);

        const zipBlob = zip.generate();
        downloadBlob(zipBlob, `${currentEmitter.name}_export.zip`);

        setExportStatus(`✅ ${currentEmitter.name} Exported!`);
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
    }, [
      settings,
      currentEmitter,
      resolveEmitterSpriteCanvas,
      bridge.machine,
      setExportStatus,
    ]);

    if (!currentEmitter) {
      return (
        <CollapsibleSection
          title="💾 Export Settings"
          isOpen={isOpen}
          onToggle={onToggle}
        >
          <div className="text-xs text-slate-400">No emitter selected</div>
        </CollapsibleSection>
      );
    }

    return (
      <CollapsibleSection
        title="💾 Export Settings"
        isOpen={isOpen}
        onToggle={onToggle}
      >
        <div className="space-y-2">
          {/* Include/Exclude from Export - AT THE TOP */}
          <div className="border border-slate-600 rounded bg-slate-800/30 p-2">
            <LabeledCheckbox
              label={`Include "${currentEmitter.name}" in Multi-Emitter Export`}
              checked={currentEmitter.enabled}
              onChange={() => toggleEmitterExport(currentEmitter.id)}
            />
          </div>

          <ExportDetails />
          <OptimizeExportFiles />

          {exportStatus && (
            <div className="text-xs text-center py-1 bg-slate-800 rounded">
              {exportStatus}
            </div>
          )}

          {/* Single Emitter Export Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExportCurrentEmitterJSON}
              className="px-3 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded transition-colors text-xs font-semibold"
            >
              📄 Download Selected<br/>Emitter (JSON)
            </button>
            <button
              onClick={handleExportCurrentEmitterZIP}
              className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded transition-colors text-xs font-semibold"
            >
              📦 Download Selected<br/>Emitter (ZIP)
            </button>
          </div>
        </div>
      </CollapsibleSection>
    );
  }
);
ExportPanel.displayName = "ExportPanel";
