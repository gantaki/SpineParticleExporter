/**
 * ForcesPanel v106
 * Controls gravity, drag, noise, and vortex forces with collapsible subsections
 */

import { memo, useState } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { RangeInput } from "../RangeInput";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  LabeledNumber,
  LabeledCheckbox,
  RangeCurveCombo,
  TwoColumn,
} from "../fields";
import { useSettings } from "../../context/SettingsContext";

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
// GRAVITY SECTION
// ============================================================

const GravitySection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(true);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Gravity"
      icon="🌍"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <RangeCurveCombo
        rangeLabel="Gravity Base Range"
        rangeHelper="Random between two numbers"
        rangeValue={em.gravityRange}
        onRangeChange={(range) => updateCurrentEmitter({ gravityRange: range })}
        curveLabel="Gravity Multiplier (-1 to 1)"
        curveValue={em.gravityOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ gravityOverLifetime: curve })
        }
        curvePresetKey="gravity"
        allowRangeToggle={true}
      />
    </InlineCollapsible>
  );
});
GravitySection.displayName = "GravitySection";

// ============================================================
// DRAG SECTION
// ============================================================

const DragSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(true);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Drag"
      icon="💨"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <RangeCurveCombo
        rangeLabel="Drag Base Range"
        rangeHelper="Random damping factor"
        rangeValue={em.dragRange}
        onRangeChange={(range) => updateCurrentEmitter({ dragRange: range })}
        curveLabel="Drag Multiplier (-1 to 1)"
        curveValue={em.dragOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ dragOverLifetime: curve })
        }
        curvePresetKey="drag"
        allowRangeToggle={true}
      />
    </InlineCollapsible>
  );
});
DragSection.displayName = "DragSection";

// ============================================================
// NOISE FIELD SECTION
// ============================================================

const NoiseFieldSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Noise Field"
      icon="🌪️"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <RangeCurveCombo
        rangeLabel="Noise Strength Range"
        rangeHelper="Base force (random)"
        rangeValue={em.noiseStrengthRange}
        onRangeChange={(range) =>
          updateCurrentEmitter({ noiseStrengthRange: range })
        }
        curveLabel="Noise Strength Multiplier (-1 to 1)"
        curveValue={em.noiseStrengthOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ noiseStrengthOverLifetime: curve })
        }
        curvePresetKey="noise"
        allowRangeToggle={true}
      />
      <TwoColumn>
        <RangeInput
          label="Frequency Range"
          helper="Lower = bigger swirls"
          range={em.noiseFrequencyRange}
          onChange={(range) =>
            updateCurrentEmitter({ noiseFrequencyRange: range })
          }
        />
        <RangeInput
          label="Speed Range"
          helper="Flow animation speed"
          range={em.noiseSpeedRange}
          onChange={(range) => updateCurrentEmitter({ noiseSpeedRange: range })}
        />
      </TwoColumn>
    </InlineCollapsible>
  );
});
NoiseFieldSection.displayName = "NoiseFieldSection";

// ============================================================
// VORTEX FORCE SECTION
// ============================================================

const VortexForceSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [isOpen, setIsOpen] = useState(false);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Vortex Force"
      icon="🌀"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <RangeCurveCombo
        rangeLabel="Vortex Strength Range"
        rangeHelper="Random between two numbers"
        rangeValue={em.vortexStrengthRange}
        onRangeChange={(range) =>
          updateCurrentEmitter({ vortexStrengthRange: range })
        }
        curveLabel="Vortex Strength Multiplier (-1 to 1)"
        curveValue={em.vortexStrengthOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ vortexStrengthOverLifetime: curve })
        }
        curvePresetKey="vortex"
        allowRangeToggle={true}
      />
      <TwoColumn>
        <LabeledNumber
          label="Vortex X"
          value={em.vortexPoint.x}
          onChange={(v) =>
            updateCurrentEmitter({
              vortexPoint: { ...em.vortexPoint, x: v },
            })
          }
          integer={true}
        />
        <LabeledNumber
          label="Vortex Y"
          value={em.vortexPoint.y}
          onChange={(v) =>
            updateCurrentEmitter({
              vortexPoint: { ...em.vortexPoint, y: v },
            })
          }
          integer={true}
        />
      </TwoColumn>
      <LabeledCheckbox
        label="Show vortex direction arrows"
        checked={em.showVortexVisualization}
        onChange={(checked) =>
          updateCurrentEmitter({ showVortexVisualization: checked })
        }
        className="mt-2"
      />
    </InlineCollapsible>
  );
});
VortexForceSection.displayName = "VortexForceSection";

// ============================================================
// MAIN PANEL COMPONENT
// ============================================================

interface ForcesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const ForcesPanel = memo<ForcesPanelProps>(({ isOpen, onToggle }) => {
  return (
    <CollapsibleSection
      title="⚡ Forces & Fields"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className="space-y-2">
        <GravitySection />
        <DragSection />
        <NoiseFieldSection />
        <VortexForceSection />
      </div>
    </CollapsibleSection>
  );
});
ForcesPanel.displayName = "ForcesPanel";
