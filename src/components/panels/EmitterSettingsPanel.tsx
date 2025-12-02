/**
 * EmitterSettingsPanel v104
 * Enhanced emitter settings with reorganized layout and new curve editor
 */

import { memo, useCallback, useState } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { CurveEditorNew } from "../CurveEditorNew";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  LabeledNumber,
  LabeledSelect,
  LabeledCheckbox,
  TwoColumn,
} from "../fields";
import { useSettings } from "../../context/SettingsContext";
import { DEFAULT_CURVE_PRESETS } from "../../types";
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
        {isOpen && (
          <div className="px-2 pb-2 space-y-2">
            {children}
          </div>
        )}
      </div>
    );
  }
);
InlineCollapsible.displayName = "InlineCollapsible";

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
  { value: "roundedRect", label: "🔲 Rounded Rectangle" },
];

const MODE_OPTIONS = [
  { value: "area", label: "🔲 Area (Fill)" },
  { value: "edge", label: "⬜ Edge (Outline)" },
];

// ============================================================
// EMISSION SETTINGS SUB-COMPONENT
// ============================================================

const EmissionSettings = memo(() => {
  const {
    settings,
    currentEmitterSettings: em,
    updateCurrentEmitter,
  } = useSettings();

  const [emissionRateOpen, setEmissionRateOpen] = useState(false);

  const handleEmissionTypeChange = useCallback(
    (type: string) => {
      const updates: Record<string, unknown> = { emissionType: type };
      // Don't automatically disable prewarm/looping when changing type
      if (type === "burst") {
        updates.looping = false;
      }
      updateCurrentEmitter(updates);
    },
    [updateCurrentEmitter]
  );

  if (!em) return null;

  return (
    <div className="space-y-2">
      {/* Looping and Prewarm at the top - only for continuous */}
      {em.emissionType === "continuous" && (
        <>
          <LabeledCheckbox
            label="Looping"
            checked={em.looping}
            onChange={(checked) => updateCurrentEmitter({ looping: checked })}
          />
          <LabeledCheckbox
            label="Prewarm"
            checked={em.prewarm}
            onChange={(checked) => updateCurrentEmitter({ prewarm: checked })}
          />
        </>
      )}

      {/* Prewarm for duration - independent control at top */}
      {em.emissionType === "duration" && (
        <LabeledCheckbox
          label="Prewarm"
          checked={em.prewarm}
          onChange={(checked) => updateCurrentEmitter({ prewarm: checked })}
        />
      )}

      {/* Start Delay */}
      <LabeledNumber
        label="Start Delay (sec)"
        value={em.startDelay}
        onChange={(v) => updateCurrentEmitter({ startDelay: v })}
        max={5}
        step={0.1}
      />

      <LabeledSelect
        label="Emission Type"
        value={em.emissionType}
        options={EMISSION_TYPE_OPTIONS}
        onChange={handleEmissionTypeChange}
      />

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
        </div>
      )}

      {/* Emission Rate Collapsible Section */}
      {em.emissionType !== "burst" && (
        <InlineCollapsible
          title="Emission Rate"
          icon="📊"
          isOpen={emissionRateOpen}
          onToggle={() => setEmissionRateOpen(!emissionRateOpen)}
        >
          <LabeledNumber
            label="Rate (per sec)"
            value={em.rate}
            onChange={(v) => updateCurrentEmitter({ rate: v })}
            max={200}
          />
          <CurveEditorNew
            label="Rate Multiplier"
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
            allowRangeToggle={true}
          />
        </InlineCollapsible>
      )}
    </div>
  );
});
EmissionSettings.displayName = "EmissionSettings";

// ============================================================
// SHAPE & EMISSION SETTINGS SUB-COMPONENT
// ============================================================

const ShapeSettings = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [shapeOpen, setShapeOpen] = useState(false);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Shape & Emission Direction"
      icon="🔷"
      isOpen={shapeOpen}
      onToggle={() => setShapeOpen(!shapeOpen)}
    >
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
        <>
          <LabeledNumber
            label="Radius"
            value={em.shapeRadius}
            onChange={(v) => updateCurrentEmitter({ shapeRadius: v })}
            max={1000}
          />
          <TwoColumn>
            <LabeledNumber
              label="Arc (°)"
              value={em.circleArc}
              onChange={(v) => updateCurrentEmitter({ circleArc: v })}
              min={0}
              max={360}
            />
            <LabeledNumber
              label="Emitter Rotation (°)"
              value={em.shapeRotation}
              onChange={(v) => updateCurrentEmitter({ shapeRotation: v })}
              min={-180}
              max={180}
            />
          </TwoColumn>
          {em.emissionMode === "edge" && (
            <LabeledNumber
              label="Thickness"
              value={em.circleThickness}
              onChange={(v) => updateCurrentEmitter({ circleThickness: v })}
              min={0}
              max={em.shapeRadius}
            />
          )}
        </>
      )}

      {(em.shape === "rectangle" || em.shape === "roundedRect") && (
        <>
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
          <TwoColumn>
            <LabeledNumber
              label="Emitter Rotation (°)"
              value={em.shapeRotation}
              onChange={(v) => updateCurrentEmitter({ shapeRotation: v })}
              min={-180}
              max={180}
            />
            {em.emissionMode === "edge" && (
              <LabeledNumber
                label="Crop (°)"
                value={em.rectangleArc}
                onChange={(v) => updateCurrentEmitter({ rectangleArc: v })}
                min={0}
                max={360}
              />
            )}
          </TwoColumn>
          {em.emissionMode === "edge" && (
            <LabeledNumber
              label="Thickness"
              value={em.rectangleThickness}
              onChange={(v) => updateCurrentEmitter({ rectangleThickness: v })}
              min={0}
              max={Math.min(em.shapeWidth, em.shapeHeight) / 2}
            />
          )}
        </>
      )}

      {em.shape === "roundedRect" && (
        <LabeledNumber
          label="Corner Radius"
          value={em.roundRadius}
          onChange={(v) => updateCurrentEmitter({ roundRadius: v })}
          max={Math.min(90, em.shapeWidth / 2, em.shapeHeight / 2)}
        />
      )}

      <TwoColumn>
        <LabeledNumber
          label="Emission Angle"
          value={em.angle}
          onChange={(v) => updateCurrentEmitter({ angle: v })}
          max={180}
        />
        <LabeledNumber
          label="Emission Spread"
          value={em.angleSpread}
          onChange={(v) => updateCurrentEmitter({ angleSpread: v })}
          max={360}
        />
      </TwoColumn>
    </InlineCollapsible>
  );
});
ShapeSettings.displayName = "ShapeSettings";

// ============================================================
// POSITION SETTINGS SUB-COMPONENT (moved to bottom as collapsible)
// ============================================================

const PositionSettings = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();
  const [positionOpen, setPositionOpen] = useState(false);

  if (!em) return null;

  return (
    <InlineCollapsible
      title="Emitter Position"
      icon="📍"
      isOpen={positionOpen}
      onToggle={() => setPositionOpen(!positionOpen)}
    >
      <LabeledCheckbox
        label="🔒 Lock Position"
        checked={em.positionLocked}
        onChange={(checked) => updateCurrentEmitter({ positionLocked: checked })}
      />
      <TwoColumn>
        <LabeledNumber
          label="Position X (px)"
          value={em.position.x}
          onChange={(v) =>
            updateCurrentEmitter({ position: { x: v, y: em.position.y } })
          }
          min={-1000}
          max={1000}
        />
        <LabeledNumber
          label="Position Y (px)"
          value={em.position.y}
          onChange={(v) =>
            updateCurrentEmitter({ position: { x: em.position.x, y: v } })
          }
          min={-1000}
          max={1000}
        />
      </TwoColumn>
    </InlineCollapsible>
  );
});
PositionSettings.displayName = "PositionSettings";

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
          <EmissionSettings />
          <ShapeSettings />
          <PositionSettings />
        </div>
      </CollapsibleSection>
    );
  }
);
EmitterSettingsPanel.displayName = "EmitterSettingsPanel";
