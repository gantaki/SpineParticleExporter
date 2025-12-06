import React, { memo } from "react";

import { ZoomSelect } from "./ZoomSelect";
import { EmitterToggle } from "./EmitterToggle";
import { GridToggle } from "./GridToggle";
import { BackgroundButtons } from "./BackgroundButtons";

interface ViewportControlsProps {
  zoom: number;
  showEmitter: boolean;
  showGrid: boolean;
  hasBackgroundImage: boolean;
  onZoomChange: (zoom: number) => void;
  onToggleEmitter: () => void;
  onToggleGrid: () => void;
  onUploadBackground: () => void;
  onRemoveBackground: () => void;
}

export const ViewportControls = memo<ViewportControlsProps>(
  ({
    zoom,
    showEmitter,
    showGrid,
    hasBackgroundImage,
    onZoomChange,
    onToggleEmitter,
    onToggleGrid,
    onUploadBackground,
    onRemoveBackground,
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
    </div>
  )
);

ViewportControls.displayName = "ViewportControls";
