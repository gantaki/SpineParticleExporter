/**
 * Emitter Management Panel - Control for managing multiple emitters
 *
 * This component handles:
 * - Adding/removing emitters
 * - Selecting active emitter
 * - Toggling visibility and export status
 * - Renaming emitters (double-click)
 * - Drag and drop reordering
 * - Duplicating emitters
 *
 * Uses React.memo for performance optimization
 */

import { memo, useState, useRef, useEffect } from "react";
import { Plus, Eye, EyeOff, Trash2, Copy, GripVertical } from "lucide-react";
import { useSettings } from "../../context/SettingsContext";

// ============================================================
// EMITTER LIST ITEM (Memoized)
// ============================================================

interface EmitterListItemProps {
  emitter: {
    id: string;
    name: string;
    visible: boolean;
    enabled: boolean;
  };
  index: number;
  isSelected: boolean;
  canRemove: boolean;
  onSelect: () => void;
  onToggleVisibility: () => void;
  onToggleEnabled: () => void;
  onRemove: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

const EmitterListItem = memo<EmitterListItemProps>(
  ({
    emitter,
    index,
    isSelected,
    canRemove,
    onSelect,
    onToggleVisibility,
    onToggleEnabled,
    onRemove,
    onRename,
    onDuplicate,
    onDragStart,
    onDragOver,
    onDrop,
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(emitter.name);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus and select text when editing starts
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const handleDoubleClick = () => {
      if (!isEditing) {
        setIsEditing(true);
        setEditName(emitter.name);
      }
    };

    const handleBlur = () => {
      setIsEditing(false);
      if (editName.trim() && editName !== emitter.name) {
        onRename(editName.trim());
      } else {
        setEditName(emitter.name);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleBlur();
      } else if (e.key === "Escape") {
        setIsEditing(false);
        setEditName(emitter.name);
      }
    };

    return (
      <div
        draggable={!isEditing}
        onDragStart={(e) => onDragStart(e, index)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop(e, index)}
        className={`flex items-center gap-2 rounded ${
          isSelected
            ? "bg-purple-600/30 border border-purple-500"
            : "bg-slate-700/30 hover:bg-slate-700/50 border border-transparent"
        } ${!emitter.enabled ? "opacity-50" : ""}`}
      >
        <button
          className={`p-2 text-slate-400 hover:text-slate-200 ${
            isEditing ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          }`}
          title={isEditing ? "" : "Drag to reorder"}
        >
          <GripVertical size={16} />
        </button>

        <input
          type="checkbox"
          checked={emitter.enabled}
          onChange={onToggleEnabled}
          className="w-4 h-4 cursor-pointer"
          title="Enable/disable emitter (affects simulation and export)"
        />

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="flex-1 px-2 py-1 text-xs font-medium bg-slate-900 border border-purple-500 rounded outline-none"
          />
        ) : (
          <button
            onClick={onSelect}
            onDoubleClick={handleDoubleClick}
            className="flex-1 p-2 text-left text-xs font-medium"
            title="Double-click to rename"
          >
            {emitter.name}
          </button>
        )}

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

        <button
          onClick={onDuplicate}
          className="p-1 bg-green-600 hover:bg-green-700 rounded"
          title="Duplicate emitter"
        >
          <Copy size={16} />
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
    );
  }
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
    toggleEmitterExport,
    renameEmitter,
    reorderEmitters,
    duplicateEmitter,
    emitterCount,
  } = useSettings();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const canAddEmitter = emitterCount < 5;
  const canRemoveEmitter = emitterCount > 1;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      reorderEmitters(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

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
            index={index}
            isSelected={settings.currentEmitterIndex === index}
            canRemove={canRemoveEmitter}
            onSelect={() => selectEmitter(index)}
            onToggleVisibility={() => toggleEmitterVisibility(emitter.id)}
            onToggleEnabled={() => toggleEmitterExport(emitter.id)}
            onRemove={() => removeEmitter(emitter.id)}
            onRename={(newName) => renameEmitter(emitter.id, newName)}
            onDuplicate={() => duplicateEmitter(emitter.id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
});

EmitterManagementPanel.displayName = "EmitterManagementPanel";
