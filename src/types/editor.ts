/**
 * Editor State Machine Types
 *
 * This module defines the Finite State Machine (FSM) types for the editor lifecycle.
 * Following the State pattern from GRASP, this separates state management logic
 * from UI rendering concerns.
 */

// ============================================================
// EDITOR FSM STATE TYPES
// ============================================================

/**
 * Editor lifecycle states
 * - IDLE: Stopped/Ready state, no animation running
 * - PLAYING: Active playback, rAF loop running
 * - PAUSED: Playback paused, preserving current frame
 * - SCRUBBING: Timeline drag in progress, rendering baked frames
 * - EXPORTING: Export in progress, UI locked
 */
export type EditorState =
  | "IDLE"
  | "PLAYING"
  | "PAUSED"
  | "SCRUBBING"
  | "EXPORTING";

/**
 * FSM Action types for state transitions
 */
export type EditorAction =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "STOP" }
  | { type: "SCRUB_START" }
  | { type: "SCRUB_END" }
  | { type: "EXPORT_START" }
  | { type: "EXPORT_COMPLETE" }
  | { type: "EXPORT_ERROR"; error: string }
  | { type: "SET_TIME"; time: number }
  | { type: "SET_SPEED"; speed: number }
  | { type: "TICK"; deltaTime: number }
  | { type: "RESET" }
  | { type: "MARK_DIRTY" }
  | { type: "CLEAR_DIRTY" };

/**
 * Full editor machine state
 */
export interface EditorMachineState {
  /** Current FSM state */
  state: EditorState;
  /** Current playback time in seconds */
  currentTime: number;
  /** Playback speed multiplier (0.25 - 4x) */
  playbackSpeed: number;
  /** Export status message */
  exportStatus: string | null;
  /** Whether simulation needs re-baking after settings change */
  needsRebake: boolean;
}

/**
 * Initial editor state
 */
export const INITIAL_EDITOR_STATE: EditorMachineState = {
  state: "IDLE",
  currentTime: 0,
  playbackSpeed: 1,
  exportStatus: null,
  needsRebake: true,
};

// ============================================================
// VIEWPORT STATE TYPES (Ephemeral UI State)
// ============================================================

/**
 * Viewport-specific state that doesn't affect simulation
 * This state is managed outside the main FSM to prevent re-renders
 */
export interface ViewportState {
  zoom: number;
  showEmitter: boolean;
  showGrid: boolean;
  backgroundImage: HTMLImageElement | null;
  bgPosition: { x: number; y: number };
}

export const INITIAL_VIEWPORT_STATE: ViewportState = {
  zoom: 1.0,
  showEmitter: true,
  showGrid: false,
  backgroundImage: null,
  bgPosition: { x: 0, y: 0 },
};

// ============================================================
// PARTICLE SYSTEM OBSERVER TYPES
// ============================================================

/**
 * Stats callback for observer pattern
 * Used to push high-frequency updates without React re-renders
 */
export interface ParticleStats {
  particleCount: number;
  time: number;
}

export type ParticleStatsCallback = (stats: ParticleStats) => void;

// ============================================================
// SETTINGS REDUCER ACTION TYPES
// ============================================================

import type {
  ParticleSettings,
  EmitterInstance,
  EmitterInstanceSettings,
  Curve,
  ColorGradient,
  RangeValue,
  Vec2,
  ExportSettings,
} from "./index";

/**
 * Granular settings actions for deep updates without full object recreation
 */
export type SettingsAction =
  // Global settings
  | { type: "SET_DURATION"; duration: number }
  | { type: "SET_FPS"; fps: number }
  | { type: "SET_FRAME_SIZE"; frameSize: number }
  | { type: "SET_EXPORT_SETTINGS"; exportSettings: Partial<ExportSettings> }

  // Emitter management
  | { type: "ADD_EMITTER"; emitter: EmitterInstance }
  | { type: "REMOVE_EMITTER"; emitterId: string }
  | { type: "SELECT_EMITTER"; index: number }
  | { type: "TOGGLE_EMITTER_VISIBILITY"; emitterId: string }
  | { type: "TOGGLE_EMITTER_EXPORT"; emitterId: string }
  | { type: "RENAME_EMITTER"; emitterId: string; name: string }
  | { type: "REORDER_EMITTERS"; fromIndex: number; toIndex: number }
  | { type: "DUPLICATE_EMITTER"; emitterId: string }

  // Current emitter settings (granular updates)
  | {
      type: "UPDATE_CURRENT_EMITTER";
      updates: Partial<EmitterInstanceSettings>;
    }

  // Specific deep updates for curves and gradients
  | {
      type: "SET_EMITTER_CURVE";
      emitterId: string;
      curveKey: keyof EmitterInstanceSettings;
      curve: Curve;
    }
  | { type: "SET_EMITTER_GRADIENT"; emitterId: string; gradient: ColorGradient }
  | {
      type: "SET_EMITTER_RANGE";
      emitterId: string;
      rangeKey: keyof EmitterInstanceSettings;
      range: RangeValue;
    }
  | { type: "SET_EMITTER_POSITION"; emitterId: string; position: Vec2 }

  // Bulk operations
  | { type: "RESET_SETTINGS" }
  | { type: "LOAD_SETTINGS"; settings: ParticleSettings };

// ============================================================
// BAKED SIMULATION TYPES
// ============================================================

import type { BakedFrame } from "./index";

export interface BakedSimulation {
  frames: BakedFrame[];
  prewarmFrames: BakedFrame[];
}
