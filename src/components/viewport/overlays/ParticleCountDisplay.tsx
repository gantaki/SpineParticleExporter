import React, { memo } from "react";

interface ParticleCountDisplayProps {
  particleCountRef: React.RefObject<HTMLSpanElement | null>;
}

export const ParticleCountDisplay = memo(({ particleCountRef }: ParticleCountDisplayProps) => (
  <div className="absolute top-1.5 left-1.5 bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono">
    Live: <span ref={particleCountRef as React.RefObject<HTMLSpanElement>}>0</span>
  </div>
));

ParticleCountDisplay.displayName = "ParticleCountDisplay";
