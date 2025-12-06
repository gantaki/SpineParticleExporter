import React, { memo } from "react";

interface BackgroundButtonsProps {
  hasBackground: boolean;
  onUpload: () => void;
  onRemove: () => void;
}

export const BackgroundButtons = memo(
  ({ hasBackground, onUpload, onRemove }: BackgroundButtonsProps) => (
    <>
      <button
        onClick={onUpload}
        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
        title="Upload background image"
      >
        📁
      </button>
      {hasBackground && (
        <button
          onClick={onRemove}
          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
          title="Remove background"
        >
          🗑️
        </button>
      )}
    </>
  )
);

BackgroundButtons.displayName = "BackgroundButtons";
