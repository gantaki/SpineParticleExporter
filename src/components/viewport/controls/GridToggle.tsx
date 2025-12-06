import React, { memo } from "react";

interface GridToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export const GridToggle = memo(({ enabled, onToggle }: GridToggleProps) => (
  <button
    onClick={onToggle}
    className={`px-2 py-1 rounded text-xs ${
      enabled ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-700 hover:bg-slate-600"
    }`}
    title="Toggle Grid"
  >
    #
  </button>
));

GridToggle.displayName = "GridToggle";
