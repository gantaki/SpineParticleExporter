/**
 * ParticleSettingsPanel
 * Controls particle lifetime, speed, sprite, and spawn angle settings
 */

import { memo } from "react";
import { CollapsibleSection } from "../CollapsibleSection";
import { RangeInput } from "../RangeInput";
import {
  LabeledNumber,
  LabeledSelect,
  SettingsSection,
  TwoColumn,
} from "../fields";
import { useSettings } from "../../context/SettingsContext";
import type { EmitterInstance } from "../../types";

// ============================================================
// SELECT OPTIONS
// ============================================================

const SPRITE_OPTIONS = [
  { value: "circle", label: "⚪ Circle" },
  { value: "glow", label: "✨ Glow" },
  { value: "star", label: "⭐ Star" },
  { value: "polygon", label: "⬡ Polygon" },
  { value: "needle", label: "📍 Needle" },
  { value: "raindrop", label: "💧 Raindrop" },
  { value: "snowflake", label: "❄️ Snowflake" },
  { value: "smoke", label: "🌫️ Smoke" },
  { value: "custom", label: "🖼️ Custom" },
];

const SPAWN_ANGLE_OPTIONS = [
  { value: "alignMotion", label: "🎯 Align to Motion" },
  { value: "random", label: "🎲 Random 360°" },
  { value: "specific", label: "📐 Specific Angle" },
  { value: "range", label: "↔️ Custom Range" },
];

// ============================================================
// LIFETIME SETTINGS SUB-COMPONENT
// ============================================================

const LifetimeSettings = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <TwoColumn>
      <LabeledNumber
        label="Life Min (s)"
        value={em.lifeTimeMin}
        onChange={(v) => updateCurrentEmitter({ lifeTimeMin: v })}
        step={0.1}
      />
      <LabeledNumber
        label="Life Max (s)"
        value={em.lifeTimeMax}
        onChange={(v) => updateCurrentEmitter({ lifeTimeMax: v })}
        step={0.1}
      />
    </TwoColumn>
  );
});
LifetimeSettings.displayName = "LifetimeSettings";

// ============================================================
// SPRITE SETTINGS SUB-COMPONENT
// ============================================================

interface SpriteSettingsProps {
  spriteStatus: string | null;
  onUploadClick: () => void;
}

export const SpriteSettings = memo<SpriteSettingsProps>(
  ({ spriteStatus, onUploadClick }) => {
    const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

    if (!em) return null;

    return (
      <div className="space-y-2">
        <LabeledSelect
          label="Particle Sprite"
          value={em.particleSprite}
          options={SPRITE_OPTIONS}
          onChange={(v) =>
            updateCurrentEmitter({
              particleSprite: v as typeof em.particleSprite,
            })
          }
        />

        {em.particleSprite === "custom" && (
          <button
            onClick={onUploadClick}
            className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
          >
            Upload Custom Sprite
          </button>
        )}

        {spriteStatus && (
          <p className="text-[10px] text-slate-400 mt-1">{spriteStatus}</p>
        )}
      </div>
    );
  }
);
SpriteSettings.displayName = "SpriteSettings";

// ============================================================
// SPAWN ANGLE SETTINGS SUB-COMPONENT
// ============================================================

const SpawnAngleSettings = memo(() => {
  const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

  if (!em) return null;

  return (
    <SettingsSection icon="🎯" title="Spawn Angle" color="cyan">
      <LabeledSelect
        label="Preset"
        value={em.spawnAngleMode}
        options={SPAWN_ANGLE_OPTIONS}
        onChange={(v) =>
          updateCurrentEmitter({
            spawnAngleMode: v as EmitterInstance["settings"]["spawnAngleMode"],
          })
        }
      />

      {em.spawnAngleMode === "specific" && (
        <LabeledNumber
          label="Spawn Angle (°)"
          value={em.spawnAngle}
          onChange={(v) => updateCurrentEmitter({ spawnAngle: v })}
          max={360}
          integer={true}
        />
      )}

      {em.spawnAngleMode === "range" && (
        <TwoColumn>
          <LabeledNumber
            label="Min (°)"
            value={em.spawnAngleMin}
            onChange={(v) => updateCurrentEmitter({ spawnAngleMin: v })}
            min={-180}
            max={180}
            integer={true}
          />
          <LabeledNumber
            label="Max (°)"
            value={em.spawnAngleMax}
            onChange={(v) => updateCurrentEmitter({ spawnAngleMax: v })}
            min={-180}
            max={180}
            integer={true}
          />
        </TwoColumn>
      )}
    </SettingsSection>
  );
});
SpawnAngleSettings.displayName = "SpawnAngleSettings";

// ============================================================
// MAIN PANEL COMPONENT
// ============================================================

interface ParticleSettingsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  spriteStatus: string | null;
  onSpriteUploadClick: () => void;
}

export const ParticleSettingsPanel = memo<ParticleSettingsPanelProps>(
  ({ isOpen, onToggle, spriteStatus, onSpriteUploadClick }) => {
    const { currentEmitterSettings: em, updateCurrentEmitter } = useSettings();

    if (!em) return null;

    return (
      <CollapsibleSection
        title="✨ Particle Settings"
        isOpen={isOpen}
        onToggle={onToggle}
      >
        <div className="space-y-2">
          <LifetimeSettings />

          <RangeInput
            label="Start Speed Range"
            helper="Initial emission velocity"
            range={em.initialSpeedRange}
            onChange={(range) =>
              updateCurrentEmitter({ initialSpeedRange: range })
            }
          />

          <SpriteSettings
            spriteStatus={spriteStatus}
            onUploadClick={onSpriteUploadClick}
          />

          <SpawnAngleSettings />
        </div>
      </CollapsibleSection>
    );
  }
);
ParticleSettingsPanel.displayName = "ParticleSettingsPanel";
