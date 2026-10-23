import { useEffect, useId, useState } from 'react';
import { prettyNumber } from '../config.js';

export function NumericInput({ value, onChange, min, max, step = 1, label, ...props }) {
  const [draft, setDraft] = useState(prettyNumber(value));
  useEffect(() => { setDraft(prettyNumber(value)); }, [value]);
  function commit() {
    if (draft.trim() !== '' && Number.isFinite(Number(draft))) {
      const next = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, step === 1 ? Math.round(Number(draft)) : Number(draft)));
      onChange(next); setDraft(prettyNumber(next));
    } else setDraft(prettyNumber(value));
  }
  return <input type="number" inputMode="decimal" aria-label={label} value={draft} min={min} max={max} step={step}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.preventDefault(); setDraft(prettyNumber(value)); } }} {...props} />;
}

export function RangeControl({ label, value, onChange, min, max, step = 0.01, unit = '', hint }) {
  const id = useId();
  return <div className="range-control">
    <div className="control-heading"><label htmlFor={id}>{label}</label><span className="range-value"><NumericInput value={value} onChange={onChange} min={min} max={max} step={step} label={`${label}数值`} /><span>{unit}</span></span></div>
    <input id={id} aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` }} />
    {hint && <p className="hint">{hint}</p>}
  </div>;
}

export function Switch({ label, checked, onChange, hint }) {
  return <div className="switch-group"><label className="switch-row"><span>{label}</span><input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={event => onChange(event.target.checked)} /><span className="switch-track" aria-hidden="true" /></label>{hint && <p className="hint">{hint}</p>}</div>;
}

export function ColorControl({ label, value, onChange, disabled }) {
  return <label className="color-row"><span>{label}</span><span className="color-field"><input type="color" aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} /><span>{value.toUpperCase()}</span></span></label>;
}

export function Icon({ name, size = 16 }) {
  const paths = {
    reset: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" /></>,
    fit: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z" /></>,
    down: <><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    arrowDown: <path d="M12 4v16m-6-6 6 6 6-6" />,
    arrowUp: <path d="M12 20V4m-6 6 6-6 6 6" />,
    trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
