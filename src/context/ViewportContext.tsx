/**
 * Viewport Context - Ephemeral UI State Management
 *
 * This context manages non-model UI state that doesn't affect the simulation:
 * - zoom level
 * - grid visibility
 * - emitter visualization toggle
 * - background image and position
 * - sprite canvases (cached)
 *
 * This state is separated from the main FSM to prevent unnecessary re-renders
 * when only visual preferences change.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
  useRef,
} from "react";
import type { GridSettings, ViewportState } from "../types/editor";
import { INITIAL_VIEWPORT_STATE } from "../types/editor";

// ============================================================
// CONTEXT TYPES
// ============================================================

interface ViewportContextValue {
  // State
  zoom: number;
  showEmitter: boolean;
  showGrid: boolean;
  backgroundImage: HTMLImageElement | null;
  bgPosition: { x: number; y: number };
  pan: { x: number; y: number };
  spriteCanvases: Record<string, HTMLCanvasElement | null>;
  gridSettings: GridSettings;

  // Actions
  setZoom: (zoom: number) => void;
  toggleEmitterVisibility: () => void;
  setShowEmitter: (show: boolean) => void;
  toggleGrid: () => void;
  setShowGrid: (show: boolean) => void;
  setBackgroundImage: (image: HTMLImageElement | null) => void;
  setBgPosition: (position: { x: number; y: number }) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setGridSettings: (settings: Partial<GridSettings>) => void;

  // Sprite cache management
  setSpriteCanvas: (
    emitterId: string,
    canvas: HTMLCanvasElement | null
  ) => void;
  clearSpriteCanvases: () => void;

  // Direct refs for high-frequency access (bypasses React)
  getViewportStateRef: () => ViewportState;
}

// ============================================================
// CONTEXT
// ============================================================

const ViewportContext = createContext<ViewportContextValue | null>(null);

// ============================================================
// PROVIDER
// ============================================================

interface ViewportProviderProps {
  children: ReactNode;
}

export function ViewportProvider({ children }: ViewportProviderProps) {
  // Core viewport state
  const [zoom, setZoomState] = useState(INITIAL_VIEWPORT_STATE.zoom);
  const [showEmitter, setShowEmitterState] = useState(
    INITIAL_VIEWPORT_STATE.showEmitter
  );
  const [showGrid, setShowGridState] = useState(
    INITIAL_VIEWPORT_STATE.showGrid
  );
  const [gridSettings, setGridSettingsState] = useState<GridSettings>(
    INITIAL_VIEWPORT_STATE.gridSettings
  );
  const [backgroundImage, setBackgroundImageState] =
    useState<HTMLImageElement | null>(null);
  const [bgPosition, setBgPositionState] = useState(
    INITIAL_VIEWPORT_STATE.bgPosition
  );
  const [pan, setPanState] = useState(INITIAL_VIEWPORT_STATE.pan);

  // Sprite canvas cache (using ref + state for hybrid access)
  const [spriteCanvases, setSpriteCanvasesState] = useState<
    Record<string, HTMLCanvasElement | null>
  >({});
  const spriteCanvasesRef = useRef<Record<string, HTMLCanvasElement | null>>(
    {}
  );

  // Ref for direct access to viewport state (bypasses React for high-frequency reads)
  const viewportStateRef = useRef<ViewportState>({
    zoom,
    showEmitter,
    showGrid,
    backgroundImage,
    bgPosition,
    pan,
    gridSettings,
  });

  // Keep ref in sync
  React.useEffect(() => {
    viewportStateRef.current = {
      zoom,
      showEmitter,
      showGrid,
      backgroundImage,
      bgPosition,
      pan,
      gridSettings,
    };
  }, [
    zoom,
    showEmitter,
    showGrid,
    backgroundImage,
    bgPosition,
    pan,
    gridSettings,
  ]);

  // ============================================================
  // ACTION CREATORS
  // ============================================================

  const setZoom = useCallback((newZoom: number) => {
    setZoomState(newZoom);
    viewportStateRef.current = {
      ...viewportStateRef.current,
      zoom: newZoom,
    };
  }, []);

  const toggleEmitterVisibility = useCallback(() => {
    setShowEmitterState((prev) => !prev);
  }, []);

  const setShowEmitter = useCallback((show: boolean) => {
    setShowEmitterState(show);
  }, []);

  const toggleGrid = useCallback(() => {
    setShowGridState((prev) => !prev);
  }, []);

  const setShowGrid = useCallback((show: boolean) => {
    setShowGridState(show);
  }, []);

  const setBackgroundImage = useCallback((image: HTMLImageElement | null) => {
    setBackgroundImageState(image);
    if (!image) {
      setBgPositionState({ x: 0, y: 0 });
    }
  }, []);

  const setBgPosition = useCallback((position: { x: number; y: number }) => {
    setBgPositionState(position);
    viewportStateRef.current = {
      ...viewportStateRef.current,
      bgPosition: position,
    };
  }, []);

  const setPan = useCallback((newPan: { x: number; y: number }) => {
    setPanState(newPan);
    viewportStateRef.current = {
      ...viewportStateRef.current,
      pan: newPan,
    };
  }, []);

  const setGridSettings = useCallback((settings: Partial<GridSettings>) => {
    setGridSettingsState((prev) => {
      const next = { ...prev, ...settings };
      viewportStateRef.current = {
        ...viewportStateRef.current,
        gridSettings: next,
      };
      return next;
    });
  }, []);

  // Sprite canvas management
  const setSpriteCanvas = useCallback(
    (emitterId: string, canvas: HTMLCanvasElement | null) => {
      spriteCanvasesRef.current[emitterId] = canvas;
      setSpriteCanvasesState((prev) => ({ ...prev, [emitterId]: canvas }));
    },
    []
  );

  const clearSpriteCanvases = useCallback(() => {
    spriteCanvasesRef.current = {};
    setSpriteCanvasesState({});
  }, []);

  // Direct ref access for controller hook
  const getViewportStateRef = useCallback(() => viewportStateRef.current, []);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const contextValue = useMemo<ViewportContextValue>(
    () => ({
      zoom,
      showEmitter,
      showGrid,
      backgroundImage,
      bgPosition,
      pan,
      gridSettings,
      spriteCanvases,
      setZoom,
      toggleEmitterVisibility,
      setShowEmitter,
      toggleGrid,
      setShowGrid,
      setBackgroundImage,
      setBgPosition,
      setPan,
      setGridSettings,
      setSpriteCanvas,
      clearSpriteCanvases,
      getViewportStateRef,
    }),
    [
      zoom,
      showEmitter,
      showGrid,
      backgroundImage,
      bgPosition,
      gridSettings,
      spriteCanvases,
      setZoom,
      toggleEmitterVisibility,
      setShowEmitter,
      toggleGrid,
      setShowGrid,
      setBackgroundImage,
      setBgPosition,
      setPan,
      setGridSettings,
      setSpriteCanvas,
      clearSpriteCanvases,
      getViewportStateRef,
    ]
  );

  return (
    <ViewportContext.Provider value={contextValue}>
      {children}
    </ViewportContext.Provider>
  );
}

// ============================================================
// HOOKS
// ============================================================

export function useViewport(): ViewportContextValue {
  const context = useContext(ViewportContext);
  if (!context) {
    throw new Error("useViewport must be used within a ViewportProvider");
  }
  return context;
}

/**
 * Hook for zoom controls only
 */
export function useZoom() {
  const { zoom, setZoom } = useViewport();
  return useMemo(() => ({ zoom, setZoom }), [zoom, setZoom]);
}

/**
 * Hook for grid visibility only
 */
export function useGridVisibility() {
  const { showGrid, toggleGrid, setShowGrid } = useViewport();
  return useMemo(
    () => ({ showGrid, toggleGrid, setShowGrid }),
    [showGrid, toggleGrid, setShowGrid]
  );
}

/**
 * Hook for emitter visibility toggle only
 */
export function useEmitterVisibility() {
  const { showEmitter, toggleEmitterVisibility, setShowEmitter } =
    useViewport();
  return useMemo(
    () => ({
      showEmitter,
      toggleEmitterVisibility,
      setShowEmitter,
    }),
    [showEmitter, toggleEmitterVisibility, setShowEmitter]
  );
}

/**
 * Hook for background image management
 */
export function useBackgroundImage() {
  const { backgroundImage, bgPosition, setBackgroundImage, setBgPosition } =
    useViewport();
  return useMemo(
    () => ({
      backgroundImage,
      bgPosition,
      setBackgroundImage,
      setBgPosition,
    }),
    [backgroundImage, bgPosition, setBackgroundImage, setBgPosition]
  );
}

/**
 * Hook for sprite canvas cache
 */
export function useSpriteCanvases() {
  const { spriteCanvases, setSpriteCanvas, clearSpriteCanvases } =
    useViewport();
  return useMemo(
    () => ({
      spriteCanvases,
      setSpriteCanvas,
      clearSpriteCanvases,
    }),
    [spriteCanvases, setSpriteCanvas, clearSpriteCanvases]
  );
}
