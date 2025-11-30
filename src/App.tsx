/**
 * Particle → Spine Exporter v103
 *
 * Version: 103
 * Date: 2025-11-29
 *
 * Architecture:
 * - SOLID/GRASP/DRY principles applied
 * - FSM for editor lifecycle
 * - Separated Model (Settings), Operational (FSM), and Ephemeral (Viewport) state
 * - Observer pattern in ParticleEngine for high-frequency stats
 * - Extracted panel components for each settings domain
 * - Reusable form field components (LabeledNumber, LabeledSelect, etc.)
 * - Custom hooks for sprite management and particle bridge
 * - Drag and drop panel layout
 */

import { useState, useCallback, useEffect } from "react";

// Context Providers
import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { ViewportProvider } from "./context/ViewportContext";
import {
  PanelLayoutProvider,
  usePanelLayout,
  PanelId,
} from "./context/PanelLayoutContext";

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
import { DraggablePanel, DroppableColumn } from "./components/DragDrop";

// Hooks
import { useParticleBridge, useSpriteManager } from "./hooks";

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
// PANEL RENDERER
// ============================================================

interface PanelRendererProps {
  panelId: PanelId;
  columnIndex: number;
  panels: ReturnType<typeof usePanelState>;
  sprite: ReturnType<typeof useSpriteManager>;
  exportStatus: string;
  setExportStatus: (status: string) => void;
  handleReset: () => void;
}

const PanelRenderer: React.FC<PanelRendererProps> = ({
  panelId,
  columnIndex,
  panels,
  sprite,
  exportStatus,
  setExportStatus,
  handleReset,
}) => {
  const renderPanel = () => {
    switch (panelId) {
      case "emitter-management":
        return <EmitterManagementPanel />;
      case "emitter-settings":
        return (
          <EmitterSettingsPanel
            isOpen={panels.emitter.isOpen}
            onToggle={panels.emitter.toggle}
          />
        );
      case "viewport":
        return (
          <>
            <Viewport />
            <input
              ref={sprite.spriteInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={sprite.handleSpriteUpload}
              style={{ display: "none" }}
            />
          </>
        );
      case "particle-settings":
        return (
          <ParticleSettingsPanel
            isOpen={panels.particle.isOpen}
            onToggle={panels.particle.toggle}
            spriteStatus={sprite.spriteStatus}
            onSpriteUploadClick={() => sprite.spriteInputRef.current?.click()}
          />
        );
      case "forces":
        return (
          <ForcesPanel
            isOpen={panels.forces.isOpen}
            onToggle={panels.forces.toggle}
          />
        );
      case "curves":
        return (
          <CurvesPanel
            isOpen={panels.curves.isOpen}
            onToggle={panels.curves.toggle}
          />
        );
      case "export":
        return (
          <ExportPanel
            isOpen={panels.export.isOpen}
            onToggle={panels.export.toggle}
            resolveEmitterSpriteCanvas={sprite.resolveEmitterSpriteCanvas}
            exportStatus={exportStatus}
            setExportStatus={setExportStatus}
          />
        );
      case "reset":
        return (
          <button
            onClick={handleReset}
            className="w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-xs"
          >
            Reset All Settings
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <DraggablePanel id={panelId} columnIndex={columnIndex}>
      {renderPanel()}
    </DraggablePanel>
  );
};

// ============================================================
// MAIN EDITOR COMPONENT
// ============================================================

const ParticleEditor: React.FC = () => {
  const [exportStatus, setExportStatus] = useState("");

  // Context hooks
  const {
    currentEmitter,
    currentEmitterSettings: em,
    resetSettings,
  } = useSettings();
  const { columns, resetLayout } = usePanelLayout();

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

  // Safety check for emission type consistency
  const { updateCurrentEmitter } = useSettings();
  useEffect(() => {
    if (!em) return;
    if (em.emissionType !== "continuous" && (em.looping || em.prewarm)) {
      updateCurrentEmitter({ looping: false, prewarm: false });
    }
  }, [em?.emissionType, em?.looping, em?.prewarm, updateCurrentEmitter]);

  // Guard for missing emitter settings
  if (!em || !currentEmitter) {
    return <div className="text-white p-4">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-[1870px] mx-auto">
        {/* Header */}
        <header className="mb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Particle → Spine Exporter v103
            </h1>
            <p className="text-xs text-slate-400">
              Refactored Architecture • FSM State Management • Drag & Drop
              Panels
            </p>
          </div>
          <button
            onClick={resetLayout}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors text-xs"
            title="Reset panel layout to default"
          >
            Reset Layout
          </button>
        </header>

        {/* Main Grid Layout - 4 Columns with Drag and Drop */}
        <div className="grid grid-cols-1 xl:[grid-template-columns:repeat(4,minmax(352px,1fr))] gap-6 items-start">
          {columns.map((columnPanels, columnIndex) => (
            <DroppableColumn key={columnIndex} columnIndex={columnIndex}>
              {columnPanels.map((panelId) => (
                <PanelRenderer
                  key={panelId}
                  panelId={panelId}
                  columnIndex={columnIndex}
                  panels={panels}
                  sprite={sprite}
                  exportStatus={exportStatus}
                  setExportStatus={setExportStatus}
                  handleReset={handleReset}
                />
              ))}
            </DroppableColumn>
          ))}
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
        <PanelLayoutProvider>
          <ParticleEditor />
        </PanelLayoutProvider>
      </ViewportProvider>
    </SettingsProvider>
  );
};

export default ParticleSpineExporter;
