/**
 * NumericInput component for Particle Spine Exporter
 * Text input that handles numeric values with proper parsing and clamping
 * Features Value Scrubbing: drag left/right to decrease/increase value
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  const [isScrubbing, setIsScrubbing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrubStartXRef = useRef<number>(0);
  const scrubStartValueRef = useRef<number>(0);

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

  // Value Scrubbing: drag left/right to change value
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    // Only start scrubbing on left mouse button
    if (e.button !== 0) return;

    // Don't scrub if input is focused (user is typing)
    if (document.activeElement === inputRef.current) return;

    e.preventDefault();
    setIsScrubbing(true);
    scrubStartXRef.current = e.clientX;
    scrubStartValueRef.current = value;
  }, [value]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isScrubbing) return;

    const deltaX = e.clientX - scrubStartXRef.current;

    // Calculate step size based on step prop or intelligent default
    const stepSize = step !== undefined ? parseDecimal(String(step)) :
                     Math.abs(scrubStartValueRef.current) < 1 ? 0.01 : 0.1;

    const delta = deltaX * (Number.isNaN(stepSize) ? 0.1 : stepSize);
    const newValue = clampValue(scrubStartValueRef.current + delta);

    onValueChange(newValue);
  }, [isScrubbing, step, clampValue, onValueChange]);

  const handleMouseUp = useCallback(() => {
    if (isScrubbing) {
      setIsScrubbing(false);
    }
  }, [isScrubbing]);

  // Set up global mouse tracking for scrubbing
  useEffect(() => {
    if (!isScrubbing) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during scrubbing
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isScrubbing, handleMouseMove, handleMouseUp]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={text}
      min={min as number | undefined}
      max={max as number | undefined}
      step={step}
      onChange={handleChange}
      onBlur={handleBlur}
      onMouseDown={handleMouseDown}
      className={className}
      style={{ cursor: isScrubbing ? 'ew-resize' : 'text' }}
      {...rest}
    />
  );
};
