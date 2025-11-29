/**
 * State Index
 *
 * Central export file for state management (FSM).
 */

export {
  useEditorMachine,
  editorMachineReducer,
  INITIAL_EDITOR_STATE,
} from "./EditorMachine";
export type { EditorMachineAPI } from "./EditorMachine";
