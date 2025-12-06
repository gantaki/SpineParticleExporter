import React, {
  useRef,
  useCallback,
  useState,
  memo,
  useEffect,
} from "react";
import { Download } from "lucide-react";

import { useParticleBridge } from "../../hooks/useParticleBridge";
import { useSettings } from "../../context/SettingsContext";
import { useViewport } from "../../context/ViewportContext";
import { Timeline } from "../Timeline";
import { roundToDecimals } from "../../utils";
import { ViewportControls } from "./controls/ViewportControls";
import { ParticleCountDisplay } from "./overlays/ParticleCountDisplay";
import { LoopIndicator } from "./overlays/LoopIndicator";

export const Viewport = memo(() => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

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

  const { settings, currentEmitterSettings, updateCurrentEmitter, setDuration, setFps } =
    useSettings();

  useEffect(() => {
    const engine = getEngine();
    if (!engine) return;

    const unsubscribe = engine.onStatsUpdate((stats) => setCurrentTime(stats.time));
    return unsubscribe;
  }, [getEngine]);

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
    gridSettings,
    setGridSettings,
  } = viewport;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<"emitter" | "background" | null>(null);

  const isLooping = currentEmitterSettings?.looping ?? false;
  const isPrewarm = currentEmitterSettings?.prewarm ?? false;

  const canvasToWorld = useCallback(
    (canvasX: number, canvasY: number) => {
      const halfSize = settings.frameSize / 2;
      return {
        x: canvasX - halfSize,
        y: halfSize - canvasY,
      };
    },
    [settings.frameSize]
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setBackgroundImage(img);
          setBgPosition({ x: -img.width / 2, y: -img.height / 2 });
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [setBackgroundImage, setBgPosition]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * (settings.frameSize / rect.width);
      const canvasY = (e.clientY - rect.top) * (settings.frameSize / rect.height);
      const world = canvasToWorld(canvasX, canvasY);

      if (e.shiftKey && backgroundImage) {
        setDragMode("background");
        setDragStart({ x: world.x - bgPosition.x, y: world.y - bgPosition.y });
      } else if (currentEmitterSettings && !currentEmitterSettings.positionLocked) {
        setDragMode("emitter");
        setDragStart({
          x: world.x - currentEmitterSettings.position.x,
          y: world.y - currentEmitterSettings.position.y,
        });
      } else {
        return;
      }

      setIsDragging(true);
    },
    [
      backgroundImage,
      canvasRef,
      settings.frameSize,
      bgPosition,
      currentEmitterSettings,
      canvasToWorld,
    ]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !canvasRef.current || !dragMode) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * (settings.frameSize / rect.width);
      const canvasY = (e.clientY - rect.top) * (settings.frameSize / rect.height);
      const world = canvasToWorld(canvasX, canvasY);

      if (dragMode === "background") {
        setBgPosition({ x: world.x - dragStart.x, y: world.y - dragStart.y });
      } else if (dragMode === "emitter" && currentEmitterSettings) {
        updateCurrentEmitter({
          position: {
            x: roundToDecimals(world.x - dragStart.x),
            y: roundToDecimals(world.y - dragStart.y),
          },
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
      canvasToWorld,
    ]
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragMode(null);
  }, []);

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-lg p-3 border border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">Preview</span>
        <ViewportControls
          zoom={zoom}
          showEmitter={showEmitter}
          showGrid={showGrid}
          hasBackgroundImage={!!backgroundImage}
          gridSettings={gridSettings}
          onZoomChange={setZoom}
          onToggleEmitter={toggleEmitterVisibility}
          onToggleGrid={toggleGrid}
          onUploadBackground={() => fileInputRef.current?.click()}
          onRemoveBackground={() => setBackgroundImage(null)}
          onGridSettingsChange={setGridSettings}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleImageUpload}
        style={{ display: "none" }}
      />

      <div className="bg-black rounded overflow-hidden border border-slate-600 relative aspect-video flex items-center justify-center">
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          width={settings.frameSize}
          height={settings.frameSize}
          className="max-h-full max-w-full aspect-square"
          style={{
            imageRendering: "pixelated",
            cursor: isDragging
              ? "grabbing"
              : currentEmitterSettings && !currentEmitterSettings.positionLocked
              ? "grab"
              : backgroundImage
              ? "grab"
              : "default",
            height: "100%",
            width: "auto",
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

export const ExportButton = memo(({ onExport, isExporting }: { onExport: () => void; isExporting: boolean }) => (
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

export const ExportStatus = memo(({ status }: { status: string | null }) => {
  if (!status) return null;
  return <div className="mt-2 p-2 bg-slate-700/50 rounded border border-slate-600 text-[10px]">{status}</div>;
});
ExportStatus.displayName = "ExportStatus";
