/**
 * EmitterSettingsPanel
 * Controls emission type, shape, rate, looping, and emitter-level settings
 */

import { memo, useCallback } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { CurveEditor } from "../CurveEditor";
import { RangeInput } from "../RangeInput";
import {
  LabeledNumber,
  LabeledSelect,
  LabeledCheckbox,
  SettingsSection,
  TwoColumn,
} from "../fields";
import { useSettings } from "../../context/SettingsContext";
import { DEFAULT_CURVE_PRESETS } from "../../types";
import { copyCurve } from "../../utils";

// ============================================================
// SELECT OPTIONS
// ============================================================

const EMISSION_TYPE_OPTIONS = [
  { value: "continuous", label: "🌊 Continuous" },
  { value: "burst", label: "💥 Burst" },
  { value: "duration", label: "⏱️ Duration" },
];

const SHAPE_OPTIONS = [
  { value: "point", label: "📍 Point" },
  { value: "line", label: "➖ Line" },
  { value: "circle", label: "⭕ Circle" },
  { value: "rectangle", label: "⬜ Rectangle" },
  { value: "roundedRect", label: "▢ Rounded" },
];

const MODE_OPTIONS = [
  { value: "area", label: "🔲 Area (Fill)" },
  { value: "edge", label: "⬜ Edge (Outline)" },
];

// ============================================================
// LOOP SETTINGS SUB-COMPONENT
// ============================================================

const LoopSettings = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <SettingsSection icon="🔄" title="Loop Settings" color="blue">
      {em.emissionType === "continuous" && (
        <>
          <LabeledCheckbox
            label="Looping"
            checked={em.looping}
            onChange={(checked) =>
              updateCurrentEmitter({
                looping: checked,
                prewarm: checked ? em.prewarm : false,
              })
            }
            className="mb-2"
          />
          {em.looping && (
            <LabeledCheckbox
              label="Prewarm"
              checked={em.prewarm}
              onChange={(checked) => updateCurrentEmitter({ prewarm: checked })}
              indent
              className="mb-2"
            />
          )}
        </>
      )}
      <LabeledNumber
        label="Start Delay (sec)"
        value={em.startDelay}
        onChange={(v) => updateCurrentEmitter({ startDelay: v })}
        max={5}
        step={0.1}
      />
    </SettingsSection>
  );
});
LoopSettings.displayName = "LoopSettings";

// ============================================================
// EMISSION SETTINGS SUB-COMPONENT
// ============================================================

const EmissionSettings = memo(() => {
  const {
    settings,
    currentEmitterSettings: em,
    updateCurrentEmitter,
  } = useSettings();

  const handleEmissionTypeChange = useCallback(
    (type: string) => {
      const updates: Record<string, unknown> = { emissionType: type };
      if (type !== "continuous") {
        updates.looping = false;
        updates.prewarm = false;
      }
      updateCurrentEmitter(updates);
    },
    [updateCurrentEmitter]
  );

  if (!em) return null;

  return (
    <div className="space-y-2">
      <LabeledSelect
        label="Emission Type"
        value={em.emissionType}
        options={EMISSION_TYPE_OPTIONS}
        onChange={handleEmissionTypeChange}
      />

      {em.emissionType === "continuous" && (
        <RangeInput
          label="Rate (per sec)"
          range={em.rateRange}
          onChange={(range) => updateCurrentEmitter({ rateRange: range })}
        />
      )}

      {em.emissionType === "burst" && (
        <div className="space-y-2 pl-2 border-l-2 border-purple-500">
          <LabeledNumber
            label="Burst Count"
            value={em.burstCount}
            onChange={(v) => updateCurrentEmitter({ burstCount: v })}
            max={500}
          />
          <LabeledNumber
            label="Burst Cycles"
            value={em.burstCycles}
            onChange={(v) => updateCurrentEmitter({ burstCycles: v })}
            max={20}
          />
          <LabeledNumber
            label="Burst Interval (sec)"
            value={em.burstInterval}
            onChange={(v) => updateCurrentEmitter({ burstInterval: v })}
            max={5}
            step={0.1}
          />
        </div>
      )}

      {em.emissionType === "duration" && (
        <div className="space-y-2 pl-2 border-l-2 border-blue-500">
          <TwoColumn>
            <LabeledNumber
              label="Start (sec)"
              value={em.durationStart}
              onChange={(v) => updateCurrentEmitter({ durationStart: v })}
              max={settings.duration}
              step={0.1}
            />
            <LabeledNumber
              label="End (sec)"
              value={em.durationEnd}
              onChange={(v) => updateCurrentEmitter({ durationEnd: v })}
              max={settings.duration}
              step={0.1}
            />
          </TwoColumn>
          <RangeInput
            label="Rate (per sec)"
            range={em.rateRange}
            onChange={(range) => updateCurrentEmitter({ rateRange: range })}
          />
        </div>
      )}

      {em.emissionType !== "burst" && (
        <CurveEditor
          label="Rate Multiplier (-1 to 1)"
          curve={em.rateOverTime}
          onChange={(curve) => updateCurrentEmitter({ rateOverTime: curve })}
          onReset={() =>
            updateCurrentEmitter({
              rateOverTime: copyCurve(DEFAULT_CURVE_PRESETS.rate),
            })
          }
          min={-1}
          max={1}
          autoScale={false}
        />
      )}
    </div>
  );
});
EmissionSettings.displayName = "EmissionSettings";

// ============================================================
// SHAPE SETTINGS SUB-COMPONENT
// ============================================================

const ShapeSettings = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <div className="space-y-2">
      <LabeledSelect
        label="Shape"
        value={em.shape}
        options={SHAPE_OPTIONS}
        onChange={(v) => updateCurrentEmitter({ shape: v as typeof em.shape })}
      />

      {em.shape !== "point" && em.shape !== "line" && (
        <LabeledSelect
          label="Mode"
          value={em.emissionMode}
          options={MODE_OPTIONS}
          onChange={(v) =>
            updateCurrentEmitter({ emissionMode: v as typeof em.emissionMode })
          }
        />
      )}

      {em.shape === "line" && (
        <>
          <LabeledNumber
            label="Length"
            value={em.lineLength}
            onChange={(v) => updateCurrentEmitter({ lineLength: v })}
            max={2000}
          />
          <LabeledNumber
            label="Spread Cone Rotation (°)"
            value={em.lineSpreadRotation}
            onChange={(v) => updateCurrentEmitter({ lineSpreadRotation: v })}
            min={-180}
            max={180}
          />
        </>
      )}

      {em.shape === "circle" && (
        <LabeledNumber
          label="Radius"
          value={em.shapeRadius}
          onChange={(v) => updateCurrentEmitter({ shapeRadius: v })}
          max={2000}
        />
      )}

      {(em.shape === "rectangle" || em.shape === "roundedRect") && (
        <TwoColumn>
          <LabeledNumber
            label="Width"
            value={em.shapeWidth}
            onChange={(v) => updateCurrentEmitter({ shapeWidth: v })}
            max={2000}
          />
          <LabeledNumber
            label="Height"
            value={em.shapeHeight}
            onChange={(v) => updateCurrentEmitter({ shapeHeight: v })}
            max={2000}
          />
        </TwoColumn>
      )}

      {em.shape === "roundedRect" && (
        <LabeledNumber
          label="Corner Radius"
          value={em.roundRadius}
          onChange={(v) => updateCurrentEmitter({ roundRadius: v })}
          max={Math.min(60, em.shapeWidth / 2, em.shapeHeight / 2)}
        />
      )}

      {(em.shape === "rectangle" || em.shape === "roundedRect") && (
        <LabeledNumber
          label="Emitter Rotation (°)"
          value={em.emitterRotation}
          onChange={(v) => updateCurrentEmitter({ emitterRotation: v })}
          min={-180}
          max={180}
        />
      )}

      <TwoColumn>
        <LabeledNumber
          label="Angle"
          value={em.angle}
          onChange={(v) => updateCurrentEmitter({ angle: v })}
          max={180}
        />
        <LabeledNumber
          label="Spread"
          value={em.angleSpread}
          onChange={(v) => updateCurrentEmitter({ angleSpread: v })}
          max={360}
        />
      </TwoColumn>
    </div>
  );
});
ShapeSettings.displayName = "ShapeSettings";

// ============================================================
// MAIN PANEL COMPONENT
// ============================================================

interface EmitterSettingsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const EmitterSettingsPanel = memo<EmitterSettingsPanelProps>(
  ({ isOpen, onToggle }) => {
    return (
      <CollapsibleSection
        title="🎯 Emitter Settings"
        isOpen={isOpen}
        onToggle={onToggle}
      >
        <div className="space-y-2">
          <LoopSettings />
          <EmissionSettings />
          <ShapeSettings />
        </div>
      </CollapsibleSection>
    );
  }
);
EmitterSettingsPanel.displayName = "EmitterSettingsPanel";
