import React, { useCallback, useState, ReactNode, DragEvent } from "react";
import { usePanelLayout, PanelId } from "../context/PanelLayoutContext";
import { GripVertical } from "lucide-react";

interface DraggablePanelProps {
  id: PanelId;
  columnIndex: number;
  children: ReactNode;
}

export const DraggablePanel: React.FC<DraggablePanelProps> = ({
  id,
  columnIndex,
  children,
}) => {
  const { startDrag, endDrag, dragState } = usePanelLayout();

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      // Set drag data
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/panel-id", id);
      e.dataTransfer.setData("application/source-column", String(columnIndex));

      // Use setTimeout to ensure state is set after drag image is captured
      setTimeout(() => {
        startDrag(id, columnIndex);
      }, 0);
    },
    [id, columnIndex, startDrag]
  );

  const handleDragEnd = useCallback(() => {
    endDrag();
  }, [endDrag]);

  const isBeingDragged = dragState.panelId === id;

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`relative group transition-opacity duration-200 ${
        isBeingDragged ? "opacity-50 scale-95" : "opacity-100"
      }`}
    >
      {/* Drag Handle */}
      <div
        className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 
                   transition-opacity cursor-grab active:cursor-grabbing z-10
                   text-slate-500 hover:text-slate-300"
      >
        <GripVertical size={16} />
      </div>
      {children}
    </div>
  );
};

interface DropZoneProps {
  columnIndex: number;
  dropIndex: number;
  isLast?: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  columnIndex,
  dropIndex,
  isLast = false,
}) => {
  const { movePanel, dragState } = usePanelLayout();
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsOver(false);

      // Get data from dataTransfer as fallback
      const panelId = e.dataTransfer.getData("application/panel-id") as PanelId;
      const sourceColumn = parseInt(
        e.dataTransfer.getData("application/source-column"),
        10
      );

      console.log("Drop event:", {
        panelId,
        sourceColumn,
        columnIndex,
        dropIndex,
      });

      // Pass explicit values from dataTransfer
      if (panelId && !isNaN(sourceColumn)) {
        movePanel(columnIndex, dropIndex, panelId, sourceColumn);
      } else {
        movePanel(columnIndex, dropIndex);
      }
    },
    [columnIndex, dropIndex, movePanel]
  );

  const isDragging = dragState.panelId !== null;

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`transition-all duration-200 rounded ${
        isDragging
          ? isLast
            ? "flex-1 min-h-16 py-4"
            : "h-8 my-1"
          : isLast
          ? "flex-1 min-h-4"
          : "h-1"
      } ${
        isOver
          ? "bg-purple-500/50 ring-2 ring-purple-400 scale-105"
          : isDragging
          ? "bg-slate-600/40 border-2 border-dashed border-slate-500"
          : ""
      }`}
    />
  );
};

interface DroppableColumnProps {
  columnIndex: number;
  children: ReactNode[];
}

export const DroppableColumn: React.FC<DroppableColumnProps> = ({
  columnIndex,
  children,
}) => {
  const { dragState } = usePanelLayout();
  const isDragging = dragState.panelId !== null;

  return (
    <div
      className={`min-h-[200px] flex flex-col pl-6 transition-all duration-200 ${
        isDragging
          ? "ring-2 ring-slate-500/50 rounded-lg p-3 -ml-2 bg-slate-800/30"
          : ""
      }`}
    >
      {children.map((child, index) => (
        <React.Fragment key={index}>
          <DropZone columnIndex={columnIndex} dropIndex={index} />
          {child}
        </React.Fragment>
      ))}
      <DropZone columnIndex={columnIndex} dropIndex={children.length} isLast />
    </div>
  );
};
