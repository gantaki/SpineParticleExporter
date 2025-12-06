import React, { memo, useMemo, useState } from "react";

import type { GridSettings } from "../../../types/editor";

interface GridSettingsDropdownProps {
  settings: GridSettings;
  onChange: (settings: Partial<GridSettings>) => void;
}

export const GridSettingsDropdown = memo(
  ({ settings, onChange }: GridSettingsDropdownProps) => {
    const [open, setOpen] = useState(false);

    const fields = useMemo(
      () => [
        { key: "backgroundA", label: "Cell A" },
        { key: "backgroundB", label: "Cell B" },
      ] as const,
      []
    );

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`px-2 py-1 rounded text-xs ${
            open ? "bg-blue-600" : "bg-slate-700 hover:bg-slate-600"
          }`}
        >
          Grid ▼
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-64 rounded border border-slate-700 bg-slate-900/95 shadow-lg z-10 p-3">
            <div className="flex gap-2 mb-2">
              {fields.map((field) => (
                <label key={field.key} className="flex flex-col gap-1 text-[11px] text-slate-200">
                  {field.label}
                  <input
                    type="color"
                    value={settings[field.key]}
                    onChange={(e) => onChange({ [field.key]: e.target.value } as Partial<GridSettings>)}
                    className="h-8 w-full rounded border border-slate-600 bg-slate-800"
                  />
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-200">
              <label className="flex flex-col gap-1">
                Step (px)
                <input
                  type="number"
                  min={4}
                  value={settings.step}
                  onChange={(e) => onChange({ step: Number(e.target.value) || 0 })}
                  className="px-2 py-1 rounded border border-slate-600 bg-slate-800 text-xs"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    );
  }
);

GridSettingsDropdown.displayName = "GridSettingsDropdown";
