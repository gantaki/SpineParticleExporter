import React, { memo } from "react";

interface EmitterToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export const EmitterToggle = memo(({ enabled, onToggle }: EmitterToggleProps) => (
  <button
    onClick={onToggle}
    className={`px-2 py-1 rounded text-xs ${
      enabled ? "bg-green-600 hover:bg-green-700" : "bg-slate-700 hover:bg-slate-600"
    }`}
    title="Toggle emitter visualization"
  >
    {enabled ? "👁️" : "👁️‍🗨️"}
  </button>
));

EmitterToggle.displayName = "EmitterToggle";
