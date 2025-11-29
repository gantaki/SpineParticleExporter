/**
 * Settings Context - Centralized Particle Settings Management
 *
 * This context provides:
 * 1. Centralized state for ParticleSettings using useReducer
 * 2. Granular actions for deep updates without full object recreation
 * 3. Memoized selectors for frequently accessed values
 *
 * Following Single Responsibility Principle (SRP), this context only manages
 * the configuration/model state, not operational or ephemeral state.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import type {
  ParticleSettings,
  EmitterInstance,
  EmitterInstanceSettings,
  Curve,
  ColorGradient,
  RangeValue,
  ExportSettings,
} from "../types";
import { DEFAULT_SETTINGS, createEmitterInstance } from "../types";
import type { SettingsAction } from "../types/editor";

// ============================================================
// REDUCER
// ============================================================

function settingsReducer(
  state: ParticleSettings,
  action: SettingsAction
): ParticleSettings {
  switch (action.type) {
    // Global settings
    case "SET_DURATION":
      return { ...state, duration: action.duration };

    case "SET_FPS":
      return { ...state, fps: action.fps };

    case "SET_FRAME_SIZE":
      return { ...state, frameSize: action.frameSize };

    case "SET_EXPORT_SETTINGS":
      return {
        ...state,
        exportSettings: { ...state.exportSettings, ...action.exportSettings },
      };

    // Emitter management
    case "ADD_EMITTER":
      if (state.emitters.length >= 5) return state;
      return {
        ...state,
        emitters: [...state.emitters, action.emitter],
        currentEmitterIndex: state.emitters.length,
      };

    case "REMOVE_EMITTER":
      if (state.emitters.length <= 1) return state;
      const filteredEmitters = state.emitters.filter(
        (e) => e.id !== action.emitterId
      );
      return {
        ...state,
        emitters: filteredEmitters,
        currentEmitterIndex: Math.min(
          state.currentEmitterIndex,
          filteredEmitters.length - 1
        ),
      };

    case "SELECT_EMITTER":
      if (action.index < 0 || action.index >= state.emitters.length)
        return state;
      return { ...state, currentEmitterIndex: action.index };

    case "TOGGLE_EMITTER_VISIBILITY":
      return {
        ...state,
        emitters: state.emitters.map((e) =>
          e.id === action.emitterId ? { ...e, visible: !e.visible } : e
        ),
      };

    case "TOGGLE_EMITTER_EXPORT":
      return {
        ...state,
        emitters: state.emitters.map((e) =>
          e.id === action.emitterId ? { ...e, enabled: !e.enabled } : e
        ),
      };

    case "RENAME_EMITTER":
      return {
        ...state,
        emitters: state.emitters.map((e) =>
          e.id === action.emitterId ? { ...e, name: action.name } : e
        ),
      };

    // Current emitter settings update (most common operation)
    case "UPDATE_CURRENT_EMITTER": {
      const currentIndex = state.currentEmitterIndex;
      if (currentIndex < 0 || currentIndex >= state.emitters.length)
        return state;

      const updatedEmitters = [...state.emitters];
      updatedEmitters[currentIndex] = {
        ...updatedEmitters[currentIndex],
        settings: {
          ...updatedEmitters[currentIndex].settings,
          ...action.updates,
        },
      };

      return { ...state, emitters: updatedEmitters };
    }

    // Specific deep updates for curves
    case "SET_EMITTER_CURVE": {
      return {
        ...state,
        emitters: state.emitters.map((e) =>
          e.id === action.emitterId
            ? {
                ...e,
                settings: {
                  ...e.settings,
                  [action.curveKey]: action.curve,
                },
              }
            : e
        ),
      };
    }

    // Specific deep updates for gradient
    case "SET_EMITTER_GRADIENT": {
      return {
        ...state,
        emitters: state.emitters.map((e) =>
          e.id === action.emitterId
            ? {
                ...e,
                settings: {
                  ...e.settings,
                  colorOverLifetime: action.gradient,
                },
              }
            : e
        ),
      };
    }

    // Specific deep updates for ranges
    case "SET_EMITTER_RANGE": {
      return {
        ...state,
        emitters: state.emitters.map((e) =>
          e.id === action.emitterId
            ? {
                ...e,
                settings: {
                  ...e.settings,
                  [action.rangeKey]: action.range,
                },
              }
            : e
        ),
      };
    }

    // Position update
    case "SET_EMITTER_POSITION": {
      return {
        ...state,
        emitters: state.emitters.map((e) =>
          e.id === action.emitterId
            ? {
                ...e,
                settings: {
                  ...e.settings,
                  position: action.position,
                },
              }
            : e
        ),
      };
    }

    // Bulk operations
    case "RESET_SETTINGS":
      return DEFAULT_SETTINGS;

    case "LOAD_SETTINGS":
      return action.settings;

    default:
      return state;
  }
}

// ============================================================
// CONTEXT TYPES
// ============================================================

interface SettingsContextValue {
  settings: ParticleSettings;

  // Selectors (memoized access to frequently used values)
  currentEmitter: EmitterInstance | null;
  currentEmitterSettings: EmitterInstanceSettings | null;
  emitterCount: number;
  hasLoopingContinuousEmitter: boolean;

  // Actions - Global
  setDuration: (duration: number) => void;
  setFps: (fps: number) => void;
  setFrameSize: (frameSize: number) => void;
  updateExportSettings: (exportSettings: Partial<ExportSettings>) => void;

  // Actions - Emitter Management
  addEmitter: () => void;
  removeEmitter: (emitterId: string) => void;
  selectEmitter: (index: number) => void;
  toggleEmitterVisibility: (emitterId: string) => void;
  toggleEmitterExport: (emitterId: string) => void;
  renameEmitter: (emitterId: string, name: string) => void;

  // Actions - Current Emitter Settings
  updateCurrentEmitter: (updates: Partial<EmitterInstanceSettings>) => void;

  // Actions - Specific Deep Updates
  setEmitterCurve: (
    emitterId: string,
    curveKey: keyof EmitterInstanceSettings,
    curve: Curve
  ) => void;
  setEmitterGradient: (emitterId: string, gradient: ColorGradient) => void;
  setEmitterRange: (
    emitterId: string,
    rangeKey: keyof EmitterInstanceSettings,
    range: RangeValue
  ) => void;

  // Bulk Actions
  resetSettings: () => void;
  loadSettings: (settings: ParticleSettings) => void;

  // Raw dispatch for advanced use cases
  dispatch: React.Dispatch<SettingsAction>;
}

// ============================================================
// CONTEXT
// ============================================================

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ============================================================
// PROVIDER
// ============================================================

interface SettingsProviderProps {
  children: ReactNode;
  initialSettings?: ParticleSettings;
  onSettingsChange?: (settings: ParticleSettings) => void;
}

export function SettingsProvider({
  children,
  initialSettings = DEFAULT_SETTINGS,
  onSettingsChange,
}: SettingsProviderProps) {
  const [settings, dispatch] = useReducer(settingsReducer, initialSettings);

  // Notify parent of settings changes (for dirty tracking)
  React.useEffect(() => {
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  // ============================================================
  // SELECTORS (Memoized)
  // ============================================================

  const currentEmitter = useMemo(
    () => settings.emitters[settings.currentEmitterIndex] ?? null,
    [settings.emitters, settings.currentEmitterIndex]
  );

  const currentEmitterSettings = useMemo(
    () => currentEmitter?.settings ?? null,
    [currentEmitter]
  );

  const emitterCount = settings.emitters.length;

  const hasLoopingContinuousEmitter = useMemo(
    () =>
      settings.emitters.some(
        (em) => em.settings.emissionType === "continuous" && em.settings.looping
      ),
    [settings.emitters]
  );

  // ============================================================
  // ACTION CREATORS (Memoized)
  // ============================================================

  // Global settings
  const setDuration = useCallback(
    (duration: number) => dispatch({ type: "SET_DURATION", duration }),
    []
  );

  const setFps = useCallback(
    (fps: number) => dispatch({ type: "SET_FPS", fps }),
    []
  );

  const setFrameSize = useCallback(
    (frameSize: number) => dispatch({ type: "SET_FRAME_SIZE", frameSize }),
    []
  );

  const updateExportSettings = useCallback(
    (exportSettings: Partial<ExportSettings>) =>
      dispatch({ type: "SET_EXPORT_SETTINGS", exportSettings }),
    []
  );

  // Emitter management
  const addEmitter = useCallback(() => {
    if (settings.emitters.length >= 5) {
      console.warn("Maximum 5 emitters allowed");
      return;
    }
    const newIndex = settings.emitters.length + 1;
    const newEmitter = createEmitterInstance(
      `emitter_${newIndex}`,
      `Emitter ${newIndex}`
    );
    dispatch({ type: "ADD_EMITTER", emitter: newEmitter });
  }, [settings.emitters.length]);

  const removeEmitter = useCallback(
    (emitterId: string) => {
      if (settings.emitters.length <= 1) {
        console.warn("At least one emitter is required");
        return;
      }
      dispatch({ type: "REMOVE_EMITTER", emitterId });
    },
    [settings.emitters.length]
  );

  const selectEmitter = useCallback(
    (index: number) => dispatch({ type: "SELECT_EMITTER", index }),
    []
  );

  const toggleEmitterVisibility = useCallback(
    (emitterId: string) =>
      dispatch({ type: "TOGGLE_EMITTER_VISIBILITY", emitterId }),
    []
  );

  const toggleEmitterExport = useCallback(
    (emitterId: string) =>
      dispatch({ type: "TOGGLE_EMITTER_EXPORT", emitterId }),
    []
  );

  const renameEmitter = useCallback(
    (emitterId: string, name: string) =>
      dispatch({ type: "RENAME_EMITTER", emitterId, name }),
    []
  );

  // Current emitter settings
  const updateCurrentEmitter = useCallback(
    (updates: Partial<EmitterInstanceSettings>) =>
      dispatch({ type: "UPDATE_CURRENT_EMITTER", updates }),
    []
  );

  // Deep updates
  const setEmitterCurve = useCallback(
    (
      emitterId: string,
      curveKey: keyof EmitterInstanceSettings,
      curve: Curve
    ) => dispatch({ type: "SET_EMITTER_CURVE", emitterId, curveKey, curve }),
    []
  );

  const setEmitterGradient = useCallback(
    (emitterId: string, gradient: ColorGradient) =>
      dispatch({ type: "SET_EMITTER_GRADIENT", emitterId, gradient }),
    []
  );

  const setEmitterRange = useCallback(
    (
      emitterId: string,
      rangeKey: keyof EmitterInstanceSettings,
      range: RangeValue
    ) => dispatch({ type: "SET_EMITTER_RANGE", emitterId, rangeKey, range }),
    []
  );

  // Bulk operations
  const resetSettings = useCallback(
    () => dispatch({ type: "RESET_SETTINGS" }),
    []
  );

  const loadSettings = useCallback(
    (newSettings: ParticleSettings) =>
      dispatch({ type: "LOAD_SETTINGS", settings: newSettings }),
    []
  );

  // ============================================================
  // CONTEXT VALUE
  // ============================================================

  const contextValue = useMemo<SettingsContextValue>(
    () => ({
      settings,
      currentEmitter,
      currentEmitterSettings,
      emitterCount,
      hasLoopingContinuousEmitter,
      setDuration,
      setFps,
      setFrameSize,
      updateExportSettings,
      addEmitter,
      removeEmitter,
      selectEmitter,
      toggleEmitterVisibility,
      toggleEmitterExport,
      renameEmitter,
      updateCurrentEmitter,
      setEmitterCurve,
      setEmitterGradient,
      setEmitterRange,
      resetSettings,
      loadSettings,
      dispatch,
    }),
    [
      settings,
      currentEmitter,
      currentEmitterSettings,
      emitterCount,
      hasLoopingContinuousEmitter,
      setDuration,
      setFps,
      setFrameSize,
      updateExportSettings,
      addEmitter,
      removeEmitter,
      selectEmitter,
      toggleEmitterVisibility,
      toggleEmitterExport,
      renameEmitter,
      updateCurrentEmitter,
      setEmitterCurve,
      setEmitterGradient,
      setEmitterRange,
      resetSettings,
      loadSettings,
    ]
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}

// ============================================================
// SELECTOR HOOKS (for optimized component subscriptions)
// ============================================================

/**
 * Subscribe only to current emitter changes
 */
export function useCurrentEmitter(): EmitterInstance | null {
  const { currentEmitter } = useSettings();
  return currentEmitter;
}

/**
 * Subscribe only to current emitter settings
 */
export function useCurrentEmitterSettings(): EmitterInstanceSettings | null {
  const { currentEmitterSettings } = useSettings();
  return currentEmitterSettings;
}

/**
 * Subscribe only to global timeline settings
 */
export function useTimelineSettings() {
  const { settings, setDuration, setFps } = useSettings();
  return useMemo(
    () => ({
      duration: settings.duration,
      fps: settings.fps,
      setDuration,
      setFps,
    }),
    [settings.duration, settings.fps, setDuration, setFps]
  );
}

/**
 * Subscribe only to export settings
 */
export function useExportSettings() {
  const { settings, updateExportSettings } = useSettings();
  return useMemo(
    () => ({
      exportSettings: settings.exportSettings,
      updateExportSettings,
    }),
    [settings.exportSettings, updateExportSettings]
  );
}
