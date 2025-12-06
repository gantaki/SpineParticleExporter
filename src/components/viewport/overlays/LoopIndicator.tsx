import React, { memo } from "react";

interface LoopIndicatorProps {
  isLooping: boolean;
  isPrewarm: boolean;
}

export const LoopIndicator = memo(({ isLooping, isPrewarm }: LoopIndicatorProps) => (
  <>
    {isLooping && (
      <div className="absolute top-1.5 right-1.5 bg-green-600/70 px-2 py-0.5 rounded text-[10px] font-mono">
        🔄 LOOP
      </div>
    )}
    {isPrewarm && (
      <div className="absolute top-6 right-1.5 bg-blue-600/70 px-2 py-0.5 rounded text-[10px] font-mono">
        ⚡ PREWARM
      </div>
    )}
  </>
));

LoopIndicator.displayName = "LoopIndicator";
