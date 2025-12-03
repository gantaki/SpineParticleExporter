/**
 * NumericInput component for Particle Spine Exporter
 * Text input that handles numeric values with proper parsing and clamping
 * Features Value Scrubbing: drag left/right to decrease/increase value
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { parseDecimal } from './helpers';

// Constants
const SCRUB_THRESHOLD = 5; // px
const DEFAULT_STEP_SIZE = 1;

type NumericInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onValueChange: (value: number) => void;
  integer?: boolean; // If true, rounds values to integers
};

export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onValueChange,
  min,
  max,
  step,
  integer = false,
  className,
  onBlur,
  ...rest
}) => {
  const [text, setText] = useState<string>(Number.isFinite(value) ? String(value) : '');
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isDragStarted, setIsDragStarted] = useState(false);
  const scrubStartXRef = useRef<number>(0);
  const scrubStartYRef = useRef<number>(0);
  const scrubStartValueRef = useRef<number>(0);

  // Memoize parsed min/max to avoid recalculation
  const parsedMin = useMemo(() =>
    min !== undefined ? parseDecimal(String(min)) : undefined,
    [min]
  );
  const parsedMax = useMemo(() =>
    max !== undefined ? parseDecimal(String(max)) : undefined,
    [max]
  );

  // Memoize step size
  const stepSize = useMemo(() =>
    step !== undefined ? parseDecimal(String(step)) : DEFAULT_STEP_SIZE,
    [step]
  );

  // Round value if integer mode is enabled
  const applyRounding = useCallback((val: number) => {
    return integer ? Math.round(val) : val;
  }, [integer]);

  const clampValue = useCallback((val: number) => {
    let next = val;
    if (!Number.isNaN(parsedMin as number) && parsedMin !== undefined) {
      next = Math.max(parsedMin, next);
    }
    if (!Number.isNaN(parsedMax as number) && parsedMax !== undefined) {
      next = Math.min(parsedMax, next);
    }
    return applyRounding(next);
  }, [parsedMin, parsedMax, applyRounding]);

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

    // Start tracking drag, but don't enable scrubbing yet
    setIsDragStarted(true);
    scrubStartXRef.current = e.clientX;
    scrubStartYRef.current = e.clientY;
    scrubStartValueRef.current = value;
  }, [value]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    // If drag started but scrubbing not yet enabled, check threshold
    if (isDragStarted && !isScrubbing) {
      const deltaX = Math.abs(e.clientX - scrubStartXRef.current);
      const deltaY = Math.abs(e.clientY - scrubStartYRef.current);

      // Enable scrubbing only if horizontal movement exceeds threshold
      if (deltaX > SCRUB_THRESHOLD && deltaX > deltaY) {
        setIsScrubbing(true);
        // Prevent text selection when scrubbing starts
        e.preventDefault();
      }

      // If vertical movement or within threshold, allow normal selection
      return;
    }

    if (!isScrubbing) return;

    const deltaX = e.clientX - scrubStartXRef.current;
    const delta = deltaX * (Number.isNaN(stepSize) ? DEFAULT_STEP_SIZE : stepSize);
    const newValue = clampValue(scrubStartValueRef.current + delta);

    onValueChange(newValue);
  }, [isDragStarted, isScrubbing, stepSize, clampValue, onValueChange]);

  const handleMouseUp = useCallback(() => {
    setIsScrubbing(false);
    setIsDragStarted(false);
  }, []);

  // Set up global mouse tracking for drag/scrubbing
  useEffect(() => {
    if (!isDragStarted && !isScrubbing) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection only during active scrubbing
    if (isScrubbing) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragStarted, isScrubbing, handleMouseMove, handleMouseUp]);

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
      onMouseDown={handleMouseDown}
      className={className}
      style={{ cursor: isScrubbing ? 'ew-resize' : 'text' }}
      {...rest}
    />
  );
};
