import type { ReactNode } from 'react';
import { Knob } from './Knob';
import { formatParam, fromNorm, paramDef, toNorm, clampParam } from '../state/params';
import { actions, curPattern, flash, useStore } from '../state/store';

export type LedColor = 'red' | 'orange' | 'green' | 'off';

export function Led({ color, on, blink, small }: { color: LedColor; on: boolean; blink?: boolean; small?: boolean }) {
  return <span className={`led led-${color} ${on ? 'on' : ''} ${blink ? 'blink' : ''} ${small ? 'small' : ''}`} />;
}

export interface HwButtonProps {
  label?: ReactNode;
  sub?: ReactNode;
  led?: LedColor;
  ledOn?: boolean;
  ledBlink?: boolean;
  onPress?: (e: React.PointerEvent) => void;
  onRelease?: (e: React.PointerEvent) => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'wide';
  pressed?: boolean;
  tone?: 'grey' | 'black' | 'red' | 'orange';
  className?: string;
  children?: ReactNode;
}

/** Pulsante in gomma con LED. Non prende mai il focus: la tastiera resta allo strumento. */
export function HwButton({ label, sub, led, ledOn, ledBlink, onPress, onRelease, title, size = 'md', pressed, tone = 'grey', className, children }: HwButtonProps) {
  return (
    <div className={`hwb-wrap ${className ?? ''}`}>
      {label !== undefined && <div className="hwb-label">{label}</div>}
      <button
        tabIndex={-1}
        title={title}
        className={`hwb hwb-${size} hwb-${tone} ${pressed ? 'pressed' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
        onPointerDown={(e) => { if (e.button === 0) onPress?.(e); }}
        onPointerUp={(e) => onRelease?.(e)}
        onPointerLeave={(e) => { if (e.buttons) onRelease?.(e); }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {led && <Led color={led} on={!!ledOn} blink={ledBlink} />}
        {children}
      </button>
      {sub !== undefined && <div className="hwb-sub">{sub}</div>}
    </div>
  );
}

function parseNumber(text: string): number {
  const t = text.trim().toLowerCase().replace(',', '.');
  const m = /^(-?[\d.]+)\s*(k)?/.exec(t);
  if (!m) return NaN;
  return parseFloat(m[1]) * (m[2] ? 1000 : 1);
}

/** Manopola legata a un parametro della parte selezionata */
export function ParamKnob({ id, label }: { id: string | null; label?: string }) {
  const part = useStore((s) => curPattern(s).parts[s.selectedPart]);
  const pi = useStore((s) => s.selectedPart);
  const d = id ? paramDef(part.type, id) : undefined;
  if (!d) return <Knob norm={0} label="—" value="" disabled onChange={() => {}} />;
  const v = part.params[d.id];
  const set = (nv: number) => {
    actions.setParam(pi, d.id, nv);
    flash(`${part.name} ${d.label} ${formatParam(d, clampParam(d, nv))}`, 900);
  };
  return (
    <Knob
      norm={toNorm(d, v)}
      label={label ?? d.label}
      value={formatParam(d, v)}
      hint={d.hint}
      bipolar={d.min < 0 && d.max > 0}
      onChange={(n) => set(fromNorm(d, n))}
      onReset={() => set(d.def)}
      onNumeric={(t) => {
        if (d.options) {
          const i = d.options.findIndex((o) => o.toLowerCase() === t.trim().toLowerCase());
          if (i >= 0) return set(i);
        }
        const n = d.id === 'pan' || (!d.unit && d.max <= 1) ? parseNumber(t) / 100 : parseNumber(t);
        if (Number.isFinite(n)) set(n);
      }}
    />
  );
}

/** Manopola generica con range lineare */
export function RangeKnob(props: {
  label: string; value: number; min: number; max: number; def: number; fmt: (v: number) => string;
  onSet: (v: number) => void; hint?: string; bipolar?: boolean; step?: number; cap?: 'black' | 'silver' | 'orange'; size?: number;
}) {
  const { label, value, min, max, def, fmt, onSet, hint, bipolar, step, cap, size } = props;
  const set = (v: number) => {
    let nv = Math.min(max, Math.max(min, v));
    if (step) nv = Math.round(nv / step) * step;
    onSet(nv);
    flash(`${label} ${fmt(nv)}`, 900);
  };
  return (
    <Knob
      norm={(value - min) / (max - min)}
      label={label}
      value={fmt(value)}
      hint={hint}
      bipolar={bipolar}
      cap={cap}
      size={size}
      onChange={(n) => set(min + n * (max - min))}
      onReset={() => set(def)}
      onNumeric={(t) => { const n = parseNumber(t); if (Number.isFinite(n)) set(n); }}
    />
  );
}
