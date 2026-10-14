import { useEffect, useRef, useState } from 'react';

export interface KnobProps {
  norm: number;
  label: string;
  value: string;
  hint?: string;
  bipolar?: boolean;
  size?: number;
  disabled?: boolean;
  onChange: (norm: number) => void;
  onReset?: () => void;
  /** inserimento numerico preciso (doppio click) */
  onNumeric?: (text: string) => void;
  cap?: 'black' | 'silver' | 'orange';
  /** il parametro ha una motion sequence registrata */
  motion?: boolean;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Manopola: trascinamento verticale (Shift = fine), rotellina del mouse,
 * doppio click = valore numerico, Alt/Ctrl+click o tasto destro = valore iniziale.
 */
export function Knob({ norm, label, value, hint, bipolar, size = 58, disabled, onChange, onReset, onNumeric, cap = 'black', motion }: KnobProps) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; n: number } | null>(null);
  const normRef = useRef(norm);
  normRef.current = norm;
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const [editing, setEditing] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      const step = e.shiftKey ? 0.004 : 0.025;
      changeRef.current(clamp(normRef.current - Math.sign(e.deltaY) * step));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [disabled]);

  const angle = -135 + clamp(norm) * 270;
  const r = size / 2 + 7;
  const c = size / 2 + 10;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => {
      const rad = ((a - 90) * Math.PI) / 180;
      return `${c + r * Math.cos(rad)} ${c + r * Math.sin(rad)}`;
    };
    const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    return `M ${p(a0)} A ${r} ${r} 0 ${large} ${sweep} ${p(a1)}`;
  };
  const from = bipolar ? 0 : -135;

  return (
    <div className={`knob-wrap ${disabled ? 'disabled' : ''} ${active ? 'active' : ''} ${motion ? 'has-motion' : ''}`} title={hint ? `${hint}\n(trascina, rotellina, doppio click = valore, tasto destro = reset)` : undefined}>
      <div
        ref={ref}
        className="knob-hit"
        style={{ width: size + 20, height: size + 20 }}
        onPointerDown={(e) => {
          if (disabled || e.button !== 0) return;
          if ((e.altKey || e.ctrlKey) && onReset) { onReset(); return; }
          e.preventDefault();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { y: e.clientY, n: normRef.current };
          setActive(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dy = d.y - e.clientY;
          if (e.shiftKey) { d.y = e.clientY; d.n = clamp(d.n + dy / 1000); changeRef.current(d.n); return; }
          changeRef.current(clamp(d.n + dy / 200));
        }}
        onPointerUp={() => { drag.current = null; setActive(false); }}
        onPointerCancel={() => { drag.current = null; setActive(false); }}
        onDoubleClick={() => { if (!disabled && onNumeric) setEditing(true); }}
        onContextMenu={(e) => { e.preventDefault(); if (!disabled) onReset?.(); }}
      >
        <svg className="knob-scale" width={size + 20} height={size + 20}>
          {Array.from({ length: 11 }, (_, i) => {
            const a = ((-135 + i * 27 - 90) * Math.PI) / 180;
            const r1 = r + 3, r2 = r + (i % 5 === 0 ? 8 : 6);
            return <line key={i} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)} />;
          })}
          <path className="knob-track" d={arc(-135, 135)} />
          {!disabled && Math.abs(angle - from) > 0.5 && <path className="knob-arc" d={arc(Math.min(from, angle), Math.max(from, angle))} />}
        </svg>
        <div className={`knob cap-${cap}`} style={{ width: size, height: size }}>
          <div className="knob-cap" style={{ transform: `rotate(${angle}deg)` }}>
            <div className="knob-pointer" />
          </div>
        </div>
      </div>
      {motion && <span className="knob-motion" title="Motion sequence">M</span>}
      <div className="knob-label">{label}</div>
      <div className="knob-value">{disabled ? '--' : value}</div>
      {editing && (
        <input
          className="knob-input"
          autoFocus
          defaultValue={value}
          onBlur={() => setEditing(false)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') { onNumeric?.((e.target as HTMLInputElement).value); setEditing(false); }
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      )}
    </div>
  );
}
