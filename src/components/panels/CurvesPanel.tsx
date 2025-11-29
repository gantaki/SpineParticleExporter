/**
 * CurvesPanel
 * Controls all curve-over-lifetime properties: color, size, speed, weight, attraction, spin
 */

import { memo } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { ColorGradientEditor } from "../ColorGradientEditor";
import { RangeCurveCombo, SettingsSection } from "../fields";
import { useSettings } from "../../context/SettingsContext";

// ============================================================
// COLOR OVER LIFETIME SECTION
// ============================================================

const ColorOverLifetimeSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <SettingsSection icon="🎨" title="Color Over Lifetime" color="amber">
      <ColorGradientEditor
        gradient={em.colorOverLifetime}
        onChange={(gradient) =>
          updateCurrentEmitter({ colorOverLifetime: gradient })
        }
      />
    </SettingsSection>
  );
});
ColorOverLifetimeSection.displayName = "ColorOverLifetimeSection";

// ============================================================
// SIZE CURVES SECTION
// ============================================================

const SizeCurvesSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <>
      <RangeCurveCombo
        rangeLabel="Size X Base Range"
        rangeHelper="Random between two numbers"
        rangeValue={em.sizeXRange}
        onRangeChange={(range) => updateCurrentEmitter({ sizeXRange: range })}
        curveLabel="Size X Multiplier (-1 to 1)"
        curveValue={em.sizeXOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ sizeXOverLifetime: curve })
        }
        curvePresetKey="sizeX"
      />
      <RangeCurveCombo
        rangeLabel="Size Y Base Range"
        rangeHelper="Random between two numbers"
        rangeValue={em.sizeYRange}
        onRangeChange={(range) => updateCurrentEmitter({ sizeYRange: range })}
        curveLabel="Size Y Multiplier (-1 to 1)"
        curveValue={em.sizeYOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ sizeYOverLifetime: curve })
        }
        curvePresetKey="sizeY"
      />
    </>
  );
});
SizeCurvesSection.displayName = "SizeCurvesSection";

// ============================================================
// MOTION CURVES SECTION
// ============================================================

const MotionCurvesSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <>
      <RangeCurveCombo
        rangeLabel="Speed Base Range"
        rangeHelper="Random between two numbers"
        rangeValue={em.speedRange}
        onRangeChange={(range) => updateCurrentEmitter({ speedRange: range })}
        curveLabel="Speed Multiplier (-1 to 1)"
        curveValue={em.speedOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ speedOverLifetime: curve })
        }
        curvePresetKey="speed"
      />
      <RangeCurveCombo
        rangeLabel="Weight Base Range"
        rangeHelper="Random between two numbers"
        rangeValue={em.weightRange}
        onRangeChange={(range) => updateCurrentEmitter({ weightRange: range })}
        curveLabel="Weight Multiplier (-1 to 1)"
        curveValue={em.weightOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ weightOverLifetime: curve })
        }
        curvePresetKey="weight"
      />
      <RangeCurveCombo
        rangeLabel="Attraction Base Range"
        rangeHelper="Random between two numbers"
        rangeValue={em.attractionRange}
        onRangeChange={(range) =>
          updateCurrentEmitter({ attractionRange: range })
        }
        curveLabel="Attraction Multiplier (-1 to 1)"
        curveValue={em.attractionOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ attractionOverLifetime: curve })
        }
        curvePresetKey="attraction"
      />
    </>
  );
});
MotionCurvesSection.displayName = "MotionCurvesSection";

// ============================================================
// SPIN CURVES SECTION
// ============================================================

const SpinCurvesSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <div className="space-y-2 pt-2 border-t border-slate-700">
      <RangeCurveCombo
        rangeLabel="Spin Base Range (deg/sec)"
        rangeHelper="Random between two numbers"
        rangeValue={em.spinRange}
        onRangeChange={(range) => updateCurrentEmitter({ spinRange: range })}
        curveLabel="Spin Multiplier (-1 to 1)"
        curveValue={em.spinOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ spinOverLifetime: curve })
        }
        curvePresetKey="spin"
      />
    </div>
  );
});
SpinCurvesSection.displayName = "SpinCurvesSection";

// ============================================================
// MAIN PANEL COMPONENT
// ============================================================

interface CurvesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const CurvesPanel = memo<CurvesPanelProps>(({ isOpen, onToggle }) => {
  return (
    <CollapsibleSection
      title="📈 Curves Over Lifetime"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        <ColorOverLifetimeSection />
        <SizeCurvesSection />
        <MotionCurvesSection />
        <SpinCurvesSection />
      </div>
    </CollapsibleSection>
  );
});
CurvesPanel.displayName = "CurvesPanel";
