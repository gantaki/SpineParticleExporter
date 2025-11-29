/**
 * Editor Machine - Finite State Machine for Editor Lifecycle
 *
 * This module implements the FSM pattern using useReducer.
 * It manages state transitions for: IDLE, PLAYING, PAUSED, SCRUBBING, EXPORTING
 *
 * The FSM determines whether the animation loop should run, stop, or render baked frames.
 */

import { useReducer, useCallback, useMemo } from "react";
import type {
  EditorState,
  EditorAction,
  EditorMachineState,
} from "../types/editor";
import { INITIAL_EDITOR_STATE } from "../types/editor";

// ============================================================
// STATE TRANSITION TABLE
// ============================================================

/**
 * Valid state transitions
 * This provides a clear contract for what actions are valid in each state
 */
const STATE_TRANSITIONS: Record<
  EditorState,
  Partial<Record<EditorAction["type"], EditorState>>
> = {
  IDLE: {
    PLAY: "PLAYING",
    SCRUB_START: "SCRUBBING",
    EXPORT_START: "EXPORTING",
    RESET: "IDLE",
    SET_TIME: "IDLE",
    SET_SPEED: "IDLE",
  },
  PLAYING: {
    PAUSE: "PAUSED",
    STOP: "IDLE",
    SCRUB_START: "SCRUBBING",
    TICK: "PLAYING",
    SET_SPEED: "PLAYING",
  },
  PAUSED: {
    PLAY: "PLAYING",
    STOP: "IDLE",
    SCRUB_START: "SCRUBBING",
    EXPORT_START: "EXPORTING",
    SET_TIME: "PAUSED",
    SET_SPEED: "PAUSED",
    RESET: "IDLE",
  },
  SCRUBBING: {
    SCRUB_END: "PAUSED",
    SET_TIME: "SCRUBBING",
    STOP: "IDLE",
  },
  EXPORTING: {
    EXPORT_COMPLETE: "IDLE",
    EXPORT_ERROR: "IDLE",
  },
};

// ============================================================
// REDUCER
// ============================================================

function editorMachineReducer(
  state: EditorMachineState,
  action: EditorAction
): EditorMachineState {
  // Check if transition is valid
  const validNextState = STATE_TRANSITIONS[state.state][action.type];

  switch (action.type) {
    case "PLAY":
      if (validNextState) {
        return { ...state, state: validNextState };
      }
      return state;

    case "PAUSE":
      if (validNextState) {
        return { ...state, state: validNextState };
      }
      return state;

    case "STOP":
      if (validNextState) {
        return {
          ...state,
          state: validNextState,
          currentTime: 0,
          needsRebake: true,
        };
      }
      return state;

    case "SCRUB_START":
      if (validNextState) {
        return { ...state, state: validNextState };
      }
      return state;

    case "SCRUB_END":
      if (validNextState) {
        return { ...state, state: validNextState };
      }
      return state;

    case "EXPORT_START":
      if (validNextState) {
        return {
          ...state,
          state: validNextState,
          exportStatus: "🔄 Baking...",
        };
      }
      return state;

    case "EXPORT_COMPLETE":
      if (validNextState) {
        return {
          ...state,
          state: validNextState,
          exportStatus: "✅ Exported!",
          needsRebake: false,
        };
      }
      return state;

    case "EXPORT_ERROR":
      if (validNextState) {
        return {
          ...state,
          state: validNextState,
          exportStatus: `❌ Error: ${action.error}`,
        };
      }
      return state;

    case "SET_TIME":
      // SET_TIME is valid in multiple states
      if (STATE_TRANSITIONS[state.state].SET_TIME !== undefined) {
        return { ...state, currentTime: action.time };
      }
      return state;

    case "SET_SPEED":
      // SET_SPEED is valid in multiple states
      if (STATE_TRANSITIONS[state.state].SET_SPEED !== undefined) {
        return { ...state, playbackSpeed: action.speed };
      }
      return state;

    case "TICK":
      // Only process TICK in PLAYING state
      if (state.state === "PLAYING") {
        return {
          ...state,
          currentTime:
            state.currentTime + action.deltaTime * state.playbackSpeed,
        };
      }
      return state;

    case "RESET":
      if (validNextState) {
        return {
          ...INITIAL_EDITOR_STATE,
          playbackSpeed: state.playbackSpeed, // Preserve speed preference
        };
      }
      return state;

    case "MARK_DIRTY":
      return { ...state, needsRebake: true };

    case "CLEAR_DIRTY":
      return { ...state, needsRebake: false };

    default:
      return state;
  }
}

// ============================================================
// HOOK
// ============================================================

export interface EditorMachineAPI {
  /** Current FSM state */
  state: EditorMachineState;

  /** State queries */
  isPlaying: boolean;
  isPaused: boolean;
  isIdle: boolean;
  isScrubbing: boolean;
  isExporting: boolean;
  shouldRunLoop: boolean;

  /** Actions */
  play: () => void;
  pause: () => void;
  stop: () => void;
  togglePlayPause: () => void;
  startScrubbing: () => void;
  endScrubbing: () => void;
  startExport: () => void;
  completeExport: () => void;
  errorExport: (error: string) => void;
  setTime: (time: number) => void;
  setSpeed: (speed: number) => void;
  tick: (deltaTime: number) => void;
  reset: () => void;

  /** Mark settings as changed (needs rebake) */
  markDirty: () => void;
  clearDirty: () => void;
}

export function useEditorMachine(): EditorMachineAPI {
  const [machineState, dispatch] = useReducer(
    editorMachineReducer,
    INITIAL_EDITOR_STATE
  );

  // Memoized state queries
  const isPlaying = machineState.state === "PLAYING";
  const isPaused = machineState.state === "PAUSED";
  const isIdle = machineState.state === "IDLE";
  const isScrubbing = machineState.state === "SCRUBBING";
  const isExporting = machineState.state === "EXPORTING";

  // Animation loop should run only when PLAYING
  const shouldRunLoop = isPlaying;

  // Memoized action dispatchers
  const play = useCallback(() => dispatch({ type: "PLAY" }), []);
  const pause = useCallback(() => dispatch({ type: "PAUSE" }), []);
  const stop = useCallback(() => dispatch({ type: "STOP" }), []);
  const startScrubbing = useCallback(
    () => dispatch({ type: "SCRUB_START" }),
    []
  );
  const endScrubbing = useCallback(() => dispatch({ type: "SCRUB_END" }), []);
  const startExport = useCallback(() => dispatch({ type: "EXPORT_START" }), []);
  const completeExport = useCallback(
    () => dispatch({ type: "EXPORT_COMPLETE" }),
    []
  );
  const errorExport = useCallback(
    (error: string) => dispatch({ type: "EXPORT_ERROR", error }),
    []
  );
  const setTime = useCallback(
    (time: number) => dispatch({ type: "SET_TIME", time }),
    []
  );
  const setSpeed = useCallback(
    (speed: number) => dispatch({ type: "SET_SPEED", speed }),
    []
  );
  const tick = useCallback(
    (deltaTime: number) => dispatch({ type: "TICK", deltaTime }),
    []
  );
  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  // Mark simulation as needing rebake (settings changed)
  const markDirty = useCallback(() => dispatch({ type: "MARK_DIRTY" }), []);

  // Clear the dirty flag after rebaking
  const clearDirty = useCallback(() => dispatch({ type: "CLEAR_DIRTY" }), []);

  return useMemo(
    () => ({
      state: machineState,
      isPlaying,
      isPaused,
      isIdle,
      isScrubbing,
      isExporting,
      shouldRunLoop,
      play,
      pause,
      stop,
      togglePlayPause,
      startScrubbing,
      endScrubbing,
      startExport,
      completeExport,
      errorExport,
      setTime,
      setSpeed,
      tick,
      reset,
      markDirty,
      clearDirty,
    }),
    [
      machineState,
      isPlaying,
      isPaused,
      isIdle,
      isScrubbing,
      isExporting,
      shouldRunLoop,
      play,
      pause,
      stop,
      togglePlayPause,
      startScrubbing,
      endScrubbing,
      startExport,
      completeExport,
      errorExport,
      setTime,
      setSpeed,
      tick,
      reset,
      markDirty,
      clearDirty,
    ]
  );
}

export { editorMachineReducer, INITIAL_EDITOR_STATE };
