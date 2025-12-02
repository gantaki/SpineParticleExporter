/**
 * Viewport Component - Canvas and Playback Controls
 *
 * This component is responsible for:
 * 1. Canvas rendering area
 * 2. Live particle count display (via ref for performance)
 * 3. Zoom controls
 * 4. Background image management
 * 5. Grid and emitter visibility toggles
 * 6. Timeline integration
 *
 * Performance Optimizations:
 * - particleCountRef and timeDisplayRef are updated directly by the controller
 * - Uses React.memo to prevent unnecessary re-renders from parent
 * - Viewport state is managed in ViewportContext, separate from settings
 */

import React, { useRef, useCallback, useState, memo, useEffect } from "react";
import { Download } from "lucide-react";
import { useParticleBridge } from "../hooks/useParticleBridge";
import { useSettings } from "../context/SettingsContext";
import { useViewport } from "../context/ViewportContext";
import { Timeline } from "./Timeline";

// ============================================================
// VIEWPORT CONTROLS (Memoized)
// ============================================================

interface ViewportControlsProps {
  zoom: number;
  showEmitter: boolean;
  showGrid: boolean;
  hasBackgroundImage: boolean;
  onZoomChange: (zoom: number) => void;
  onToggleEmitter: () => void;
  onToggleGrid: () => void;
  onUploadBackground: () => void;
  onRemoveBackground: () => void;
}

const ViewportControls = memo<ViewportControlsProps>(
  ({
    zoom,
    showEmitter,
    showGrid,
    hasBackgroundImage,
    onZoomChange,
    onToggleEmitter,
    onToggleGrid,
    onUploadBackground,
    onRemoveBackground,
  }) => (
    <div className="flex gap-1.5">
      <select
        value={zoom}
        onChange={(e) => onZoomChange(parseFloat(e.target.value))}
        className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
      >
        <option value="0.25">25%</option>
        <option value="0.5">50%</option>
        <option value="1">100%</option>
        <option value="2">200%</option>
      </select>
      <button
        onClick={onUploadBackground}
        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
        title="Upload background image"
      >
        📁
      </button>
      {hasBackgroundImage && (
        <button
          onClick={onRemoveBackground}
          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
          title="Remove background"
        >
          🗑️
        </button>
      )}
      <button
        onClick={onToggleEmitter}
        className={`px-2 py-1 rounded text-xs ${
          showEmitter
            ? "bg-green-600 hover:bg-green-700"
            : "bg-slate-700 hover:bg-slate-600"
        }`}
        title="Toggle emitter visualization"
      >
        {showEmitter ? "👁️" : "👁️‍🗨️"}
      </button>
      <button
        onClick={onToggleGrid}
        className={`px-2 py-1 rounded text-xs ${
          showGrid
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-slate-700 hover:bg-slate-600"
        }`}
        title="Toggle Grid"
      >
        #
      </button>
    </div>
  )
);

ViewportControls.displayName = "ViewportControls";

// ============================================================
// PARTICLE COUNT DISPLAY (Memoized)
// ============================================================

interface ParticleCountDisplayProps {
  particleCountRef: React.RefObject<HTMLSpanElement | null>;
}

const ParticleCountDisplay = memo<ParticleCountDisplayProps>(
  ({ particleCountRef }) => (
    <div className="absolute top-1.5 left-1.5 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono">
      Live:{" "}
      <span ref={particleCountRef as React.RefObject<HTMLSpanElement>}>0</span>
    </div>
  )
);

ParticleCountDisplay.displayName = "ParticleCountDisplay";

// ============================================================
// LOOP INDICATOR (Memoized)
// ============================================================

interface LoopIndicatorProps {
  isLooping: boolean;
  isPrewarm: boolean;
}

const LoopIndicator = memo<LoopIndicatorProps>(({ isLooping, isPrewarm }) => (
  <>
    {isLooping && (
      <div className="absolute top-1.5 right-1.5 bg-green-600/70 px-2 py-0.5 rounded text-[10px] font-mono">
        🔄 LOOP
      </div>
    )}
    {isPrewarm && (
      <div className="absolute top-6 right-1.5 bg-blue-600/70 px-2 py-0.5 rounded text-[10px] font-mono">
        ⚡ PREWARM
      </div>
    )}
  </>
));

LoopIndicator.displayName = "LoopIndicator";

// ============================================================
// EXPORT BUTTON (Memoized)
// ============================================================

interface ExportButtonProps {
  onExport: () => void;
  isExporting: boolean;
}

const ExportButton = memo<ExportButtonProps>(({ onExport, isExporting }) => (
  <button
    onClick={onExport}
    disabled={isExporting}
    className={`w-full mt-3 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded font-semibold text-sm transition-all ${
      isExporting ? "opacity-50 cursor-not-allowed" : ""
    }`}
  >
    <Download size={14} className="inline mr-1" />
    {isExporting ? "Exporting..." : "Export ZIP"}
  </button>
));

ExportButton.displayName = "ExportButton";

// ============================================================
// EXPORT STATUS (Memoized)
// ============================================================

interface ExportStatusProps {
  status: string | null;
}

const ExportStatus = memo<ExportStatusProps>(({ status }) => {
  if (!status) return null;

  return (
    <div className="mt-2 p-2 bg-slate-700/50 rounded border border-slate-600 text-[10px]">
      {status}
    </div>
  );
});

ExportStatus.displayName = "ExportStatus";

// ============================================================
// MAIN VIEWPORT COMPONENT
// ============================================================

export const Viewport = memo(() => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Bridge hook provides refs and handlers
  const bridge = useParticleBridge();
  const {
    canvasRef,
    particleCountRef,
    machine,
    handleTimelineTimeChange,
    handlePlayPause,
    handlePlaybackRestart,
    getEngine,
  } = bridge;

  // Settings context (for duration, fps, current emitter state)
  const { settings, currentEmitterSettings, updateCurrentEmitter, setDuration, setFps } =
    useSettings();

  // Subscribe to engine time updates for Timeline
  useEffect(() => {
    const engine = getEngine();
    if (!engine) return;

    const unsubscribe = engine.onStatsUpdate((stats) => {
      setCurrentTime(stats.time);
    });

    return unsubscribe;
  }, [getEngine]);

  // Viewport context (for visual state)
  const viewport = useViewport();
  const {
    zoom,
    showEmitter,
    showGrid,
    backgroundImage,
    bgPosition,
    setZoom,
    toggleEmitterVisibility,
    toggleGrid,
    setBackgroundImage,
    setBgPosition,
  } = viewport;

  // Local state for dragging
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<"emitter" | "background" | null>(
    null
  );

  // Derived state
  const isLooping = currentEmitterSettings?.looping ?? false;
  const isPrewarm = currentEmitterSettings?.prewarm ?? false;

  // ============================================================
  // DRAG & DROP HANDLERS (Emitter + Background)
  // ============================================================

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            setBackgroundImage(img);
            // Center the image at world origin (0, 0)
            setBgPosition({ x: -img.width / 2, y: -img.height / 2 });
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      }
    },
    [setBackgroundImage, setBgPosition]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (settings.frameSize / rect.width);
      const y = (e.clientY - rect.top) * (settings.frameSize / rect.height);

      // Convert to world coordinates (canvas center is 0,0, Y inverted)
      const worldX = x - settings.frameSize / 2;
      const worldY = settings.frameSize / 2 - y; // Invert Y axis

      // Determine drag mode:
      // Shift + LMB = drag background (if available)
      // LMB = drag emitter (if not locked)
      if (e.shiftKey && backgroundImage) {
        setDragMode("background");
        setDragStart({
          x: worldX - bgPosition.x,
          y: worldY - bgPosition.y
        });
      } else if (currentEmitterSettings && !currentEmitterSettings.positionLocked) {
        setDragMode("emitter");
        setDragStart({
          x: worldX - currentEmitterSettings.position.x,
          y: worldY - currentEmitterSettings.position.y
        });
      } else {
        return; // No drag action
      }

      setIsDragging(true);
    },
    [
      backgroundImage,
      canvasRef,
      settings.frameSize,
      bgPosition,
      currentEmitterSettings,
    ]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !canvasRef.current || !dragMode) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (settings.frameSize / rect.width);
      const y = (e.clientY - rect.top) * (settings.frameSize / rect.height);

      // Convert to world coordinates (Y inverted)
      const worldX = x - settings.frameSize / 2;
      const worldY = settings.frameSize / 2 - y; // Invert Y axis

      if (dragMode === "background") {
        setBgPosition({
          x: worldX - dragStart.x,
          y: worldY - dragStart.y
        });
      } else if (dragMode === "emitter" && currentEmitterSettings) {
        const newX = Math.round((worldX - dragStart.x) * 100) / 100;
        const newY = Math.round((worldY - dragStart.y) * 100) / 100;

        updateCurrentEmitter({
          position: { x: newX, y: newY }
        });
      }
    },
    [
      isDragging,
      dragMode,
      canvasRef,
      settings.frameSize,
      dragStart,
      setBgPosition,
      currentEmitterSettings,
      updateCurrentEmitter,
    ]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragMode(null);
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-lg p-3 border border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">Preview</span>
        <ViewportControls
          zoom={zoom}
          showEmitter={showEmitter}
          showGrid={showGrid}
          hasBackgroundImage={!!backgroundImage}
          onZoomChange={setZoom}
          onToggleEmitter={toggleEmitterVisibility}
          onToggleGrid={toggleGrid}
          onUploadBackground={() => fileInputRef.current?.click()}
          onRemoveBackground={() => setBackgroundImage(null)}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleImageUpload}
        style={{ display: "none" }}
      />

      <div className="bg-black rounded overflow-hidden border border-slate-600 relative">
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          width={settings.frameSize}
          height={settings.frameSize}
          className="w-full h-[400px]"
          style={{
            imageRendering: "pixelated",
            cursor: isDragging
              ? "grabbing"
              : currentEmitterSettings && !currentEmitterSettings.positionLocked
              ? "grab"
              : backgroundImage
              ? "grab"
              : "default",
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />

        <ParticleCountDisplay particleCountRef={particleCountRef} />
        <LoopIndicator isLooping={isLooping} isPrewarm={isPrewarm} />
      </div>

      <div className="mt-3">
        <Timeline
          currentTime={currentTime}
          duration={settings.duration}
          fps={settings.fps}
          isPlaying={machine.isPlaying}
          playbackSpeed={machine.state.playbackSpeed}
          onTimeChange={handleTimelineTimeChange}
          onPlayPause={handlePlayPause}
          onPlaybackRestart={handlePlaybackRestart}
          onSpeedChange={machine.setSpeed}
          onDurationChange={setDuration}
          onFpsChange={setFps}
        />
      </div>
    </div>
  );
});

Viewport.displayName = "Viewport";
