/**
 * Reusable Form Field Components
 * DRY pattern for labeled inputs, selects, checkboxes, and curve+range combos
 */

import React, { memo, useCallback } from "react";
import type { Curve, RangeValue } from "../../types";
import { DEFAULT_CURVE_PRESETS } from "../../types";
import { copyCurve } from "../../utils";
import { NumericInput } from "../NumericInput";
import { RangeInput } from "../RangeInput";
import { CurveEditorNew } from "../CurveEditorNew";

// ============================================================
// COMMON STYLE CONSTANTS
// ============================================================

const INPUT_CLASS =
  "w-full mt-1 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs";
const LABEL_CLASS = "text-xs text-slate-300";
const SECTION_CLASS = "bg-slate-900/30 p-2 rounded border border-slate-700";

// ============================================================
// LABELED NUMERIC INPUT
// ============================================================

interface LabeledNumberProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  className?: string;
}

export const LabeledNumber = memo<LabeledNumberProps>(
  ({ label, value, onChange, min, max, step, integer, className }) => (
    <label className="block">
      <span className={LABEL_CLASS}>{label}</span>
      <NumericInput
        value={value}
        onValueChange={onChange}
        min={min}
        max={max}
        step={step}
        integer={integer}
        className={className || INPUT_CLASS}
      />
    </label>
  )
);
LabeledNumber.displayName = "LabeledNumber";

// ============================================================
// LABELED SELECT
// ============================================================

interface SelectOption {
  value: string;
  label: string;
}

interface LabeledSelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

export const LabeledSelect = memo<LabeledSelectProps>(
  ({ label, value, options, onChange, className }) => (
    <label className="block">
      <span className={LABEL_CLASS}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className || INPUT_CLASS}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
);
LabeledSelect.displayName = "LabeledSelect";

// ============================================================
// LABELED CHECKBOX
// ============================================================

interface LabeledCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  indent?: boolean;
}

export const LabeledCheckbox = memo<LabeledCheckboxProps>(
  ({ label, checked, onChange, className, indent }) => (
    <label
      className={`flex items-center gap-2 text-xs cursor-pointer ${
        indent ? "pl-4" : ""
      } ${className || ""}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded"
      />
      <span className="text-slate-300">{label}</span>
    </label>
  )
);
LabeledCheckbox.displayName = "LabeledCheckbox";

// ============================================================
// RANGE + CURVE COMBO (Very common pattern)
// ============================================================

interface RangeCurveComboProps {
  rangeLabel: string;
  rangeHelper?: string;
  rangeValue: RangeValue;
  onRangeChange: (range: RangeValue) => void;
  curveLabel: string;
  curveValue: Curve;
  onCurveChange: (curve: Curve) => void;
  curvePresetKey: keyof typeof DEFAULT_CURVE_PRESETS;
  allowRangeToggle?: boolean;
}

export const RangeCurveCombo = memo<RangeCurveComboProps>(
  ({
    rangeLabel,
    rangeHelper,
    rangeValue,
    onRangeChange,
    curveLabel,
    curveValue,
    onCurveChange,
    curvePresetKey,
    allowRangeToggle = false,
  }) => {
    const handleReset = useCallback(() => {
      onCurveChange(copyCurve(DEFAULT_CURVE_PRESETS[curvePresetKey]));
    }, [onCurveChange, curvePresetKey]);

    return (
      <>
        <RangeInput
          label={rangeLabel}
          helper={rangeHelper}
          range={rangeValue}
          onChange={onRangeChange}
        />
        <CurveEditorNew
          label={curveLabel}
          curve={curveValue}
          onChange={onCurveChange}
          onReset={handleReset}
          min={-1}
          max={1}
          autoScale={false}
          allowRangeToggle={allowRangeToggle}
        />
      </>
    );
  }
);
RangeCurveCombo.displayName = "RangeCurveCombo";

// ============================================================
// TWO COLUMN GRID
// ============================================================

interface TwoColumnProps {
  children: React.ReactNode;
}

export const TwoColumn = memo<TwoColumnProps>(({ children }) => (
  <div className="grid grid-cols-2 gap-2">{children}</div>
));
TwoColumn.displayName = "TwoColumn";

// ============================================================
// SETTINGS SECTION (Colored header box)
// ============================================================

interface SettingsSectionProps {
  icon: string;
  title: string;
  color: "blue" | "green" | "purple" | "pink" | "cyan" | "amber";
  children: React.ReactNode;
}

const colorMap = {
  blue: "text-blue-300",
  green: "text-green-300",
  purple: "text-purple-300",
  pink: "text-pink-300",
  cyan: "text-cyan-300",
  amber: "text-amber-300",
};

export const SettingsSection = memo<SettingsSectionProps>(
  ({ icon, title, color, children }) => (
    <div className={SECTION_CLASS}>
      <h4 className={`text-xs font-semibold ${colorMap[color]} mb-2`}>
        {icon} {title}
      </h4>
      {children}
    </div>
  )
);
SettingsSection.displayName = "SettingsSection";

// ============================================================
// VEC2 INPUT (X/Y pair)
// ============================================================

interface Vec2InputProps {
  labelX: string;
  labelY: string;
  x: number;
  y: number;
  onChange: (x: number, y: number) => void;
}

export const Vec2Input = memo<Vec2InputProps>(
  ({ labelX, labelY, x, y, onChange }) => (
    <TwoColumn>
      <LabeledNumber
        label={labelX}
        value={x}
        onChange={(v) => onChange(v, y)}
      />
      <LabeledNumber
        label={labelY}
        value={y}
        onChange={(v) => onChange(x, v)}
      />
    </TwoColumn>
  )
);
Vec2Input.displayName = "Vec2Input";

// Re-export for convenience
export { INPUT_CLASS, LABEL_CLASS, SECTION_CLASS };
