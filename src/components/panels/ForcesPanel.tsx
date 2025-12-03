/**
 * ForcesPanel
 * Controls gravity, drag, noise, vortex, and angular velocity forces
 */

import { memo } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { RangeInput } from "../RangeInput";
import {
  LabeledNumber,
  LabeledCheckbox,
  RangeCurveCombo,
  SettingsSection,
  TwoColumn,
} from "../fields";
import { useSettings } from "../../context/SettingsContext";

// ============================================================
// GRAVITY & DRAG SECTION
// ============================================================

const GravityDragSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <SettingsSection icon="🌍" title="Gravity & Drag" color="green">
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
    </SettingsSection>
  );
});
GravityDragSection.displayName = "GravityDragSection";

// ============================================================
// NOISE FIELD SECTION
// ============================================================

const NoiseFieldSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <SettingsSection icon="🌪️" title="Noise Field" color="purple">
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
    </SettingsSection>
  );
});
NoiseFieldSection.displayName = "NoiseFieldSection";

// ============================================================
// VORTEX FORCE SECTION
// ============================================================

const VortexForceSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <SettingsSection icon="🌀" title="Vortex Force" color="pink">
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
    </SettingsSection>
  );
});
VortexForceSection.displayName = "VortexForceSection";

// ============================================================
// SPIN SECTION
// ============================================================

const SpinSection = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <SettingsSection icon="🔄" title="Spin" color="cyan">
      <RangeCurveCombo
        rangeLabel="Spin Speed Range (deg/sec)"
        rangeHelper="Random between two numbers"
        rangeValue={em.angularVelocityRange}
        onRangeChange={(range) =>
          updateCurrentEmitter({ angularVelocityRange: range })
        }
        curveLabel="Spin Speed Multiplier (-1 to 1)"
        curveValue={em.angularVelocityOverLifetime}
        onCurveChange={(curve) =>
          updateCurrentEmitter({ angularVelocityOverLifetime: curve })
        }
        curvePresetKey="angularVelocity"
        allowRangeToggle={true}
      />
    </SettingsSection>
  );
});
SpinSection.displayName = "SpinSection";

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
      <div className="space-y-3">
        <GravityDragSection />
        <NoiseFieldSection />
        <VortexForceSection />
        <SpinSection />
      </div>
    </CollapsibleSection>
  );
});
ForcesPanel.displayName = "ForcesPanel";
