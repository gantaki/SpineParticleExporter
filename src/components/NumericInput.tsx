/**
 * NumericInput component for Particle Spine Exporter
 * Text input that handles numeric values with proper parsing and clamping
 */

import React, { useState, useEffect } from 'react';
import { parseDecimal } from './helpers';

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onValueChange: (value: number) => void;
};

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onValueChange,
  min,
  max,
  step,
  className,
  onBlur,
  ...rest
}) => {
  const [text, setText] = useState<string>(Number.isFinite(value) ? String(value) : '');

  const parsedMin = min !== undefined ? parseDecimal(String(min)) : undefined;
  const parsedMax = max !== undefined ? parseDecimal(String(max)) : undefined;

  const clampValue = (val: number) => {
    let next = val;
    if (!Number.isNaN(parsedMin as number) && parsedMin !== undefined) {
      next = Math.max(parsedMin, next);
    }
    if (!Number.isNaN(parsedMax as number) && parsedMax !== undefined) {
      next = Math.min(parsedMax, next);
    }
    return next;
  };

  useEffect(() => {
    const parsedDisplay = parseDecimal(text);
    if (Number.isNaN(parsedDisplay) || parsedDisplay !== value) {
      setText(Number.isFinite(value) ? String(value) : '');
    }
    // Only sync when the external value changes to avoid interrupting user input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    const parsed = parseDecimal(raw);
    if (!Number.isNaN(parsed)) {
      const clamped = clampValue(parsed);
      onValueChange(clamped);
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseDecimal(text);

    if (Number.isNaN(parsed)) {
      setText(Number.isFinite(value) ? String(value) : '');
    } else {
      const clamped = clampValue(parsed);
      setText(String(clamped));
      onValueChange(clamped);
    }

    onBlur?.(e);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      min={min as number | undefined}
      max={max as number | undefined}
      step={step}
      onChange={handleChange}
      onBlur={handleBlur}
      className={className}
      {...rest}
    />
  );
};
