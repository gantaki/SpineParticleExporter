import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";

// Panel IDs
export type PanelId =
  | "emitter-management"
  | "emitter-settings"
  | "viewport"
  | "particle-settings"
  | "forces"
  | "curves"
  | "export"
  | "reset";

// Column layout type - each column is an array of panel IDs
export type ColumnLayout = [PanelId[], PanelId[], PanelId[], PanelId[]];

interface DragState {
  panelId: PanelId | null;
  sourceColumn: number | null;
}

interface PanelLayoutContextType {
  columns: ColumnLayout;
  dragState: DragState;
  startDrag: (panelId: PanelId, sourceColumn: number) => void;
  endDrag: () => void;
  movePanel: (
    targetColumn: number,
    targetIndex?: number,
    panelId?: PanelId,
    sourceColumn?: number
  ) => void;
  resetLayout: () => void;
}

const defaultLayout: ColumnLayout = [
  ["emitter-management", "emitter-settings"],
  ["viewport"],
  ["particle-settings", "forces", "curves"],
  ["export", "reset"],
];

const PanelLayoutContext = createContext<PanelLayoutContextType | null>(null);

export const usePanelLayout = () => {
  const context = useContext(PanelLayoutContext);
  if (!context) {
    throw new Error("usePanelLayout must be used within PanelLayoutProvider");
  }
  return context;
};

interface PanelLayoutProviderProps {
  children: ReactNode;
}

export const PanelLayoutProvider: React.FC<PanelLayoutProviderProps> = ({
  children,
}) => {
  const [columns, setColumns] = useState<ColumnLayout>(() => {
    // Try to restore from localStorage
    const saved = localStorage.getItem("panelLayout");
    if (saved) {
      try {
        return JSON.parse(saved) as ColumnLayout;
      } catch {
        return defaultLayout;
      }
    }
    return defaultLayout;
  });

  const [dragState, setDragState] = useState<DragState>({
    panelId: null,
    sourceColumn: null,
  });

  // Use ref to track current drag state for stable callback access
  const dragStateRef = useRef<DragState>(dragState);

  const startDrag = useCallback((panelId: PanelId, sourceColumn: number) => {
    const newState = { panelId, sourceColumn };
    dragStateRef.current = newState;
    setDragState(newState);
  }, []);

  const endDrag = useCallback(() => {
    const newState = { panelId: null, sourceColumn: null };
    dragStateRef.current = newState;
    setDragState(newState);
  }, []);

  const movePanel = useCallback(
    (
      targetColumn: number,
      targetIndex?: number,
      explicitPanelId?: PanelId,
      explicitSourceColumn?: number
    ) => {
      const currentDrag = dragStateRef.current;

      // Use explicit values if provided (from dataTransfer), otherwise use ref
      const panelId = explicitPanelId ?? currentDrag.panelId;
      const sourceColumn = explicitSourceColumn ?? currentDrag.sourceColumn;

      console.log("movePanel called:", {
        panelId,
        sourceColumn,
        targetColumn,
        targetIndex,
        currentDrag,
      });

      if (panelId === null || sourceColumn === null) {
        console.log("movePanel aborted: missing panelId or sourceColumn");
        return;
      }

      setColumns((prev) => {
        const newColumns = prev.map((col) => [...col]) as ColumnLayout;

        // Remove from source column
        const sourceCol = newColumns[sourceColumn];
        const panelIndex = sourceCol.indexOf(panelId);
        if (panelIndex === -1) {
          console.log("Panel not found in source column");
          return prev;
        }
        sourceCol.splice(panelIndex, 1);

        // Adjust target index if moving within same column and target is after source
        let adjustedTargetIndex = targetIndex;
        if (
          sourceColumn === targetColumn &&
          targetIndex !== undefined &&
          panelIndex < targetIndex
        ) {
          adjustedTargetIndex = targetIndex - 1;
        }

        // Add to target column
        const targetCol = newColumns[targetColumn];
        if (adjustedTargetIndex !== undefined && adjustedTargetIndex >= 0) {
          targetCol.splice(adjustedTargetIndex, 0, panelId);
        } else {
          targetCol.push(panelId);
        }

        console.log("New columns:", newColumns);

        // Save to localStorage
        localStorage.setItem("panelLayout", JSON.stringify(newColumns));

        return newColumns;
      });

      endDrag();
    },
    [endDrag]
  );

  const resetLayout = useCallback(() => {
    setColumns(defaultLayout);
    localStorage.removeItem("panelLayout");
  }, []);

  return (
    <PanelLayoutContext.Provider
      value={{
        columns,
        dragState,
        startDrag,
        endDrag,
        movePanel,
        resetLayout,
      }}
    >
      {children}
    </PanelLayoutContext.Provider>
  );
};
