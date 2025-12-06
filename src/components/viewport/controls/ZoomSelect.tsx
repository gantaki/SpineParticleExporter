import React, { memo } from "react";

interface ZoomSelectProps {
  value: number;
  onChange: (zoom: number) => void;
}

export const ZoomSelect = memo(({ value, onChange }: ZoomSelectProps) => (
  <select
    value={value}
    onChange={(e) => onChange(parseFloat(e.target.value))}
    className="px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
  >
    <option value="0.25">25%</option>
    <option value="0.5">50%</option>
    <option value="1">100%</option>
    <option value="2">200%</option>
  </select>
));

ZoomSelect.displayName = "ZoomSelect";
