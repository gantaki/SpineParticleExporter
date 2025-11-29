/**
 * RangeInput component for Particle Spine Exporter
 * Input for min/max range values
 */

import React from 'react';
import type { RangeValue } from '../types';
import { NumericInput } from './NumericInput';

interface RangeInputProps {
  label: string;
  range: RangeValue;
  onChange: (range: RangeValue) => void;
  helper?: string;
}

export const RangeInput: React.FC<RangeInputProps> = ({ label, range, onChange, helper }) => {
  const handleChange = (key: 'min' | 'max') => (value: number) => {
    onChange({ ...range, [key]: value });
  };

  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        {helper && <span className="text-[10px] text-slate-500">{helper}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-1">
        <NumericInput
          value={range.min}
          onValueChange={handleChange('min')}
          className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
          placeholder="Min"
        />
        <NumericInput
          value={range.max}
          onValueChange={handleChange('max')}
          className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
          placeholder="Max"
        />
      </div>
    </div>
  );
};
