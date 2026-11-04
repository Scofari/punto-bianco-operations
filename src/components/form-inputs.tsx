'use client';

import { useEffect, useId, useRef, useState } from 'react';

export function IntegerInput({
  name,
  defaultValue,
  min,
  max,
}: {
  name: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  const [value, setValue] = useState(String(defaultValue));
  const ref = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const error =
    value && (Number(value) < min || Number(value) > max)
      ? max < min
        ? 'Sejurul nu include nicio noapte. Verificați perioada sau dezactivați cazarea gratuită.'
        : `Introduceți un număr întreg între ${min} și ${max}.`
      : '';
  useEffect(() => {
    ref.current?.setCustomValidity(error);
  }, [error]);
  return (
    <>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]+"
        required
        name={name}
        value={value}
        maxLength={3}
        aria-describedby={hintId}
        aria-invalid={!!error}
        onKeyDown={(event) => {
          if (
            !event.ctrlKey &&
            !event.metaKey &&
            ['-', '+', '.', ',', 'e', 'E'].includes(event.key)
          )
            event.preventDefault();
        }}
        onPaste={(event) => {
          if (!/^[0-9]+$/.test(event.clipboardData.getData('text'))) event.preventDefault();
        }}
        onChange={(event) => {
          if (/^[0-9]*$/.test(event.target.value)) setValue(event.target.value);
        }}
      />
      <span id={hintId} className={error ? 'field-error' : 'field-hint'} aria-live="polite">
        {error || `Număr întreg pozitiv, maximum ${max} nopți, în limita sejurului.`}
      </span>
    </>
  );
}

export function DateTimeInput({
  name,
  value,
  onChange,
  after,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  after?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.setCustomValidity(
      value && after && value <= after ? 'Plecarea trebuie să fie după sosire.' : '',
    );
  }, [value, after]);
  return (
    <input
      ref={ref}
      className="date-time-field"
      type="datetime-local"
      required
      name={name}
      value={value}
      min={after || undefined}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => {
        // Native pickers remain available by keyboard and on browsers without showPicker.
        try {
          event.currentTarget.showPicker?.();
        } catch {
          /* Unsupported or unavailable native picker. */
        }
      }}
    />
  );
}
