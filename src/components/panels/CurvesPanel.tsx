/**
 * CurvesPanel v106
 * Controls all curve-over-lifetime properties with collapsible subsections
 */

import { memo, useState } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { ColorGradientEditor } from "../ColorGradientEditor";
import { ChevronDown, ChevronRight } from "lucide-react";
import { RangeCurveCombo, LabeledCheckbox } from "../fields";
import { useSettings } from "../../context/SettingsContext";
import { copyCurve } from "../../utils";

// ============================================================
// INLINE COLLAPSIBLE COMPONENT FOR SUB-SECTIONS
// ============================================================

interface InlineCollapsibleProps {
  title: string;
  icon?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const InlineCollapsible = memo<InlineCollapsibleProps>(
  ({ title, icon, isOpen, onToggle, children }) => {
    return (
      <div className="border border-slate-600 rounded bg-slate-800/20">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-slate-700/30 transition-colors rounded"
        >
          <span className="text-xs font-medium text-slate-300 flex items-center gap-1">
            {icon && <span>{icon}</span>}
            {title}
          </span>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {isOpen && <div className="px-2 pb-2 space-y-2">{children}</div>}
      </div>
    );
  }
);
InlineCollapsible.displayName = "InlineCollapsible";

// ============================================================
// COLOR OVER LIFETIME SECTION
// ============================================================

const ColorOverLifetimeSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(true);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Color Over Lifetime"
      icon="🎨"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <ColorGradientEditor
        gradient={em.colorOverLifetime}
        onChange={(gradient) =>
          updateCurrentEmitter({ colorOverLifetime: gradient })
        }
      />
    </InlineCollapsible>
  );
});
ColorOverLifetimeSection.displayName = "ColorOverLifetimeSection";

// ============================================================
// SIZE CURVES SECTION
// ============================================================

const SizeCurvesSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(true);

  if (!em) return null;

  const handleSeparateSizeToggle = (checked: boolean) => {
    if (checked) {
      // Switching to separate mode - copy uniform values to both X and Y
      updateCurrentEmitter({
        separateSize: true,
        sizeXRange: { ...em.sizeRange },
        sizeYRange: { ...em.sizeRange },
        sizeXOverLifetime: copyCurve(em.sizeOverLifetime),
        sizeYOverLifetime: copyCurve(em.sizeOverLifetime),
      });
    } else {
      // Switching to uniform mode
      updateCurrentEmitter({
        separateSize: false,
      });
    }
  };

  return (
    <InlineCollapsible
      title="Size"
      icon="📏"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <LabeledCheckbox
        label="Separate Size (X/Y)"
        checked={em.separateSize}
        onChange={handleSeparateSizeToggle}
      />

      {em.separateSize ? (
        // Separate mode - show Size X and Size Y
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
            allowRangeToggle={true}
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
            allowRangeToggle={true}
          />
        </>
      ) : (
        // Uniform mode - show single Size
        <RangeCurveCombo
          rangeLabel="Size Base Range"
          rangeHelper="Random between two numbers"
          rangeValue={em.sizeRange}
          onRangeChange={(range) => updateCurrentEmitter({ sizeRange: range })}
          curveLabel="Size Multiplier (-1 to 1)"
          curveValue={em.sizeOverLifetime}
          onCurveChange={(curve) =>
            updateCurrentEmitter({ sizeOverLifetime: curve })
          }
          curvePresetKey="size"
          allowRangeToggle={true}
        />
      )}
    </InlineCollapsible>
  );
});
SizeCurvesSection.displayName = "SizeCurvesSection";

// ============================================================
// SPEED SECTION
// ============================================================

const SpeedSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Speed"
      icon="⚡"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
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
        allowRangeToggle={true}
      />
    </InlineCollapsible>
  );
});
SpeedSection.displayName = "SpeedSection";

// ============================================================
// WEIGHT SECTION
// ============================================================

const WeightSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Weight"
      icon="⚖️"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
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
        allowRangeToggle={true}
      />
    </InlineCollapsible>
  );
});
WeightSection.displayName = "WeightSection";

// ============================================================
// ATTRACTION SECTION
// ============================================================

const AttractionSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Attraction"
      icon="🧲"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
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
        allowRangeToggle={true}
      />
    </InlineCollapsible>
  );
});
AttractionSection.displayName = "AttractionSection";

// ============================================================
// SPIN SECTION
// ============================================================

const SpinSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Spin"
      icon="🔄"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
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
        allowRangeToggle={true}
      />
    </InlineCollapsible>
  );
});
SpinSection.displayName = "SpinSection";

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
        <SpeedSection />
        <WeightSection />
        <AttractionSection />
        <SpinSection />
      </div>
    </CollapsibleSection>
  );
});
CurvesPanel.displayName = "CurvesPanel";
