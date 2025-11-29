/**
 * Emitter Management Panel - Control for managing multiple emitters
 *
 * This component handles:
 * - Adding/removing emitters
 * - Selecting active emitter
 * - Toggling visibility and export status
 *
 * Uses React.memo for performance optimization
 */

import { memo } from "react";
import { Plus, Eye, EyeOff, Trash2 } from "lucide-react";
import { useSettings } from "../../context/SettingsContext";

// ============================================================
// EMITTER LIST ITEM (Memoized)
// ============================================================

interface EmitterListItemProps {
  emitter: {
    id: string;
    name: string;
    visible: boolean;
  };
  isSelected: boolean;
  canRemove: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onRemove: () => void;
}

const EmitterListItem = memo<EmitterListItemProps>(
  ({
    emitter,
    isSelected,
    canRemove,
    onSelect,
    onToggleVisibility,
    onRemove,
  }) => (
    <div
      className={`flex items-center gap-2 rounded ${
        isSelected
          ? "bg-purple-600/30 border border-purple-500"
          : "bg-slate-700/30 hover:bg-slate-700/50 border border-transparent"
      }`}
    >
      <button
        onClick={onSelect}
        className="flex-1 p-3 text-left text-xs font-medium"
      >
        {emitter.name}
      </button>
      <button
        onClick={onToggleVisibility}
        className={`p-1 rounded ${
          emitter.visible
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-slate-600 hover:bg-slate-500"
        }`}
        title={emitter.visible ? "Hide in viewport" : "Show in viewport"}
      >
        {emitter.visible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      {canRemove && (
        <button
          onClick={onRemove}
          className="p-1 mr-2 bg-red-600 hover:bg-red-700 rounded"
          title="Remove emitter"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
);

EmitterListItem.displayName = "EmitterListItem";

// ============================================================
// MAIN EMITTER PANEL COMPONENT
// ============================================================

export const EmitterManagementPanel = memo(() => {
  const {
    settings,
    addEmitter,
    removeEmitter,
    selectEmitter,
    toggleEmitterVisibility,
    emitterCount,
  } = useSettings();

  const canAddEmitter = emitterCount < 5;
  const canRemoveEmitter = emitterCount > 1;

  return (
    <div className="bg-slate-800/50 backdrop-blur rounded-lg p-3 border border-slate-700">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-semibold">
          Emitters ({emitterCount}/5)
        </span>
        <button
          onClick={addEmitter}
          disabled={!canAddEmitter}
          className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
            canAddEmitter
              ? "bg-green-600 hover:bg-green-700"
              : "bg-slate-700 text-slate-500 cursor-not-allowed"
          }`}
          title="Add new emitter (max 5)"
        >
          <Plus size={16} /> Add
        </button>
      </div>
      <div className="space-y-1">
        {settings.emitters.map((emitter, index) => (
          <EmitterListItem
            key={emitter.id}
            emitter={emitter}
            isSelected={settings.currentEmitterIndex === index}
            canRemove={canRemoveEmitter}
            onSelect={() => selectEmitter(index)}
            onToggleVisibility={() => toggleEmitterVisibility(emitter.id)}
            onRemove={() => removeEmitter(emitter.id)}
          />
        ))}
      </div>
    </div>
  );
});

EmitterManagementPanel.displayName = "EmitterManagementPanel";
