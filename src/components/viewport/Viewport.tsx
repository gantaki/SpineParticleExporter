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

const POSITION_LIMIT = 2500;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;

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
    pan,
    setPan,
    toggleEmitterVisibility,
    toggleGrid,
    setBackgroundImage,
    setBgPosition,
    gridSettings,
    setGridSettings,
  } = viewport;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragMode, setDragMode] = useState<"emitter" | "background" | "pan" | null>(null);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  const zoomAnimationRef = useRef<number | null>(null);
  const zoomStartRef = useRef({ zoom, pan });
  const zoomStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    panRef.current = pan;
  }, [pan]);

  useEffect(() => {
    return () => {
      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }
    };
  }, []);

  const isLooping = currentEmitterSettings?.looping ?? false;
  const isPrewarm = currentEmitterSettings?.prewarm ?? false;

  const frameWidth = settings.frame.width;
  const frameHeight = settings.frame.height;
  const clampZoomValue = useCallback(
    (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)),
    []
  );

  const canvasToWorld = useCallback(
    (
      canvasX: number,
      canvasY: number,
      zoomValue: number = zoomRef.current,
      panValue: { x: number; y: number } = panRef.current
    ) => {
      const halfWidth = frameWidth / 2;
      const halfHeight = frameHeight / 2;
      return {
        x: (canvasX - (halfWidth + panValue.x * zoomValue)) / zoomValue,
        y: (halfHeight + panValue.y * zoomValue - canvasY) / zoomValue,
      };
    },
    [frameHeight, frameWidth]
  );

  const applyZoomAtPoint = useCallback(
    (
      nextZoom: number,
      anchor: { canvasX: number; canvasY: number; world: { x: number; y: number } }
    ) => {
      const clampedZoom = clampZoomValue(nextZoom);
      const halfWidth = frameWidth / 2;
      const halfHeight = frameHeight / 2;

      const newPan = {
        x: (anchor.canvasX - halfWidth - anchor.world.x * clampedZoom) / clampedZoom,
        y: (anchor.world.y * clampedZoom + anchor.canvasY - halfHeight) / clampedZoom,
      };

      setPan(newPan);
      setZoom(clampedZoom);
      zoomRef.current = clampedZoom;
      panRef.current = newPan;
    },
    [clampZoomValue, frameHeight, frameWidth, setPan, setZoom]
  );

  const animateZoomTo = useCallback(
    (
      targetZoom: number,
      anchor: { canvasX: number; canvasY: number; world: { x: number; y: number } }
    ) => {
      const clampedTarget = clampZoomValue(targetZoom);
      zoomStartRef.current = { zoom: zoomRef.current, pan: panRef.current };
      zoomStartTimeRef.current = null;

      if (zoomAnimationRef.current) {
        cancelAnimationFrame(zoomAnimationRef.current);
      }

      const duration = 180;

      const step = (timestamp: number) => {
        if (zoomStartTimeRef.current === null) {
          zoomStartTimeRef.current = timestamp;
        }

        const elapsed = timestamp - zoomStartTimeRef.current;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const startZoom = zoomStartRef.current.zoom;
        const nextZoom = startZoom + (clampedTarget - startZoom) * eased;

        applyZoomAtPoint(nextZoom, anchor);

        if (progress < 1 - 1e-4) {
          zoomAnimationRef.current = requestAnimationFrame(step);
        } else {
          zoomAnimationRef.current = null;
          zoomStartTimeRef.current = null;
          zoomStartRef.current = { zoom: clampedTarget, pan: panRef.current };
        }
      };

      zoomAnimationRef.current = requestAnimationFrame(step);
    },
    [applyZoomAtPoint, clampZoomValue]
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

  const handleZoomChange = useCallback(
    (value: number) => {
      setZoom(clampZoomValue(value));
    },
    [clampZoomValue, setZoom]
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;

      if (e.button === 2) {
        setDragMode("pan");
        setPanStart(panRef.current);
        setDragStart({ x: e.clientX, y: e.clientY });
        setIsDragging(true);
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * (frameWidth / rect.width);
      const canvasY = (e.clientY - rect.top) * (frameHeight / rect.height);
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
      frameWidth,
      frameHeight,
      bgPosition,
      currentEmitterSettings,
      canvasToWorld,
    ]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDragging || !canvasRef.current || !dragMode) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * (frameWidth / rect.width);
      const canvasY = (e.clientY - rect.top) * (frameHeight / rect.height);
      const world = canvasToWorld(canvasX, canvasY);

      if (dragMode === "pan") {
        const currentZoom = zoomRef.current;
        const deltaX = (e.clientX - dragStart.x) / currentZoom;
        const deltaY = (e.clientY - dragStart.y) / currentZoom;
        setPan({ x: panStart.x + deltaX, y: panStart.y - deltaY });
      } else if (dragMode === "background") {
        setBgPosition({ x: world.x - dragStart.x, y: world.y - dragStart.y });
      } else if (dragMode === "emitter" && currentEmitterSettings) {
        const clampedX = Math.max(
          -POSITION_LIMIT,
          Math.min(POSITION_LIMIT, roundToDecimals(world.x - dragStart.x))
        );
        const clampedY = Math.max(
          -POSITION_LIMIT,
          Math.min(POSITION_LIMIT, roundToDecimals(world.y - dragStart.y))
        );
        updateCurrentEmitter({
          position: {
            x: clampedX,
            y: clampedY,
          },
        });
      }
    },
    [
      isDragging,
      dragMode,
      canvasRef,
      frameWidth,
      frameHeight,
      dragStart,
      panStart,
      setBgPosition,
      setPan,
      currentEmitterSettings,
      updateCurrentEmitter,
      canvasToWorld,
    ]
  );

  const handleCanvasWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      if (!canvasRef.current) return;

      e.preventDefault();

      const rect = canvasRef.current.getBoundingClientRect();
      const canvasX = (e.clientX - rect.left) * (frameWidth / rect.width);
      const canvasY = (e.clientY - rect.top) * (frameHeight / rect.height);

      const worldPoint = canvasToWorld(canvasX, canvasY, zoomRef.current, panRef.current);
      const zoomFactor = Math.exp(-e.deltaY * 0.0025);
      const targetZoom = clampZoomValue(zoomRef.current * zoomFactor);

      animateZoomTo(targetZoom, { canvasX, canvasY, world: worldPoint });
    },
    [
      animateZoomTo,
      canvasRef,
      canvasToWorld,
      clampZoomValue,
      frameHeight,
      frameWidth,
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
          onZoomChange={handleZoomChange}
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
          width={frameWidth}
          height={frameHeight}
          className="max-h-full max-w-full"
          style={{
            imageRendering: "pixelated",
            cursor:
              isDragging
                ? "grabbing"
                : currentEmitterSettings && !currentEmitterSettings.positionLocked
                ? "grab"
                : backgroundImage
                ? "grab"
                : "default",
            height: "100%",
            width: "100%",
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onContextMenu={(e) => e.preventDefault()}
          onWheel={handleCanvasWheel}
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
