import React, { memo } from "react";

import { ZoomSelect } from "./ZoomSelect";
import { EmitterToggle } from "./EmitterToggle";
import { GridToggle } from "./GridToggle";
import { BackgroundButtons } from "./BackgroundButtons";
import { GridSettingsDropdown } from "./GridSettingsDropdown";
import type { GridSettings } from "../../../types/editor";

interface ViewportControlsProps {
  zoom: number;
  showEmitter: boolean;
  showGrid: boolean;
  hasBackgroundImage: boolean;
  gridSettings: GridSettings;
  onZoomChange: (zoom: number) => void;
  onToggleEmitter: () => void;
  onToggleGrid: () => void;
  onUploadBackground: () => void;
  onRemoveBackground: () => void;
  onGridSettingsChange: (settings: Partial<GridSettings>) => void;
}

export const ViewportControls = memo<ViewportControlsProps>(
  ({
    zoom,
    showEmitter,
    showGrid,
    hasBackgroundImage,
    gridSettings,
    onZoomChange,
    onToggleEmitter,
    onToggleGrid,
    onUploadBackground,
    onRemoveBackground,
    onGridSettingsChange,
  }) => (
    <div className="flex gap-1.5">
      <ZoomSelect value={zoom} onChange={onZoomChange} />
      <BackgroundButtons
        hasBackground={hasBackgroundImage}
        onUpload={onUploadBackground}
        onRemove={onRemoveBackground}
      />
      <EmitterToggle enabled={showEmitter} onToggle={onToggleEmitter} />
      <GridToggle enabled={showGrid} onToggle={onToggleGrid} />
      <GridSettingsDropdown settings={gridSettings} onChange={onGridSettingsChange} />
    </div>
  )
);

ViewportControls.displayName = "ViewportControls";
