/**
 * RangeInput component for Particle Spine Exporter
 * Input for min/max range values
 */

import { memo, useCallback } from 'react';
import type { RangeValue } from '../types';
import { NumericInput } from './NumericInput';

// Constants
const RANGE_INPUT_CLASS = "w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs";

interface RangeInputProps {
  label: string;
  range: RangeValue;
  onChange: (range: RangeValue) => void;
  helper?: string;
}

export const RangeInput = memo<RangeInputProps>(({ label, range, onChange, helper }) => {
  const handleMinChange = useCallback((value: number) => {
    onChange({ ...range, min: value });
  }, [range, onChange]);

  const handleMaxChange = useCallback((value: number) => {
    onChange({ ...range, max: value });
  }, [range, onChange]);

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        {helper && <span className="text-[10px] text-slate-500">{helper}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <NumericInput
          value={range.min}
          onValueChange={handleMinChange}
          className={RANGE_INPUT_CLASS}
          placeholder="Min"
        />
        <NumericInput
          value={range.max}
          onValueChange={handleMaxChange}
          className={RANGE_INPUT_CLASS}
          placeholder="Max"
        />
      </div>
    </div>
  );
});
RangeInput.displayName = "RangeInput";
