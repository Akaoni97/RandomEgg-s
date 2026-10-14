import { useEffect, useRef } from 'react';
import { buildPage, lcdNudge, type LcdItem } from '../lcd/menu';
import { curPattern, useStore } from '../state/store';
import { TYPE_LABEL } from '../state/params';

function Bar({ item, segs = 20 }: { item: LcdItem; segs?: number }) {
  if (item.norm === undefined) return <span className="lcd-bar empty" />;
  const n = Math.min(1, Math.max(0, item.norm));
  const lit = Math.round(n * segs);
  const mid = segs / 2;
  return (
    <span className="lcd-bar">
      {Array.from({ length: segs }, (_, i) => {
        const on = item.bipolar ? (n >= 0.5 ? i >= mid && i < lit : i < mid && i >= lit) : i < lit;
        return <i key={i} className={on ? 'on' : ''} />;
      })}
    </span>
  );
}

const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));

export function Lcd() {
  const s = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      lcdNudge(e.deltaY < 0 ? 1 : -1, e.shiftKey);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  if (!s.powered) {
    return <div className="lcd off" ref={ref}><div className="lcd-glass" /></div>;
  }
  const pt = curPattern(s);
  const part = pt.parts[s.selectedPart];
  const page = buildPage(s);
  const cur = Math.min(s.cursor, page.items.length - 1);
  const item = page.items[cur];
  const transport = s.playing ? '▶' : '■';
  const pat = 'P' + String(s.project.current + 1).padStart(2, '0');
  const queued = s.songMode ? 'S' + String(s.songPos + 1).padStart(2, '0') : s.queuedPattern !== null ? '>' + String(s.queuedPattern + 1).padStart(2, '0') : '   ';

  return (
    <div className="lcd" ref={ref} title="Display: rotellina del mouse = VALUE, F2 = zoom">
      <div className="lcd-screen">
        <div className="lcd-line">
          <span>{pat}</span>
          <span className="lcd-dim">{queued}</span>
          <span>{' ' + pad(pt.name, 15)}</span>
          <span className={s.recording ? 'lcd-blink' : ''}>{s.recording ? '●' : ' '}</span>
          <span>{transport}</span>
        </div>
        <div className="lcd-line">
          <span>{pt.bpm.toFixed(1).padStart(5, ' ')}</span>
          <span className="lcd-dim">BPM </span>
          <span>{'P' + (s.selectedPart + 1) + ' ' + pad(part.name, 6)}</span>
          <span className="lcd-inv">{s.kbdMode === 'step' ? 'STEP' : 'LIVE'}</span>
          <span>{part.mute ? ' M' : part.solo ? ' S' : '  '}</span>
        </div>
        {s.message ? (
          <>
            <div className="lcd-line lcd-msg">{pad(s.message.text, 24)}</div>
            <div className="lcd-line lcd-msg-bar" />
          </>
        ) : (
          <>
            <div className="lcd-line">
              <span className="lcd-inv">{pad(page.title, 12)}</span>
              <span>{(' ' + TYPE_LABEL[part.type]).padEnd(7, ' ')}</span>
              <span className="lcd-dim">{String(cur + 1).padStart(2, ' ') + '/' + page.items.length}</span>
            </div>
            <div className="lcd-line">
              <span>{pad(item?.label ?? '', 9)}</span>
              {item && <Bar item={item} segs={7} />}
              <span className="lcd-val">{(item?.value ?? '').slice(0, 15).padStart(8, ' ')}</span>
            </div>
          </>
        )}
      </div>
      <div className="lcd-glass" />
    </div>
  );
}

/** Display ingrandito: tutte le voci della pagina, cliccabili */
export function LcdZoom() {
  const s = useStore();
  if (!s.lcdZoom || !s.powered) return null;
  const page = buildPage(s);
  const cur = Math.min(s.cursor, page.items.length - 1);
  return (
    <div className="lcd-zoom" onClick={() => useStore.setState({ lcdZoom: false })}>
      <div className="lcd big" onClick={(e) => e.stopPropagation()} onWheel={(e) => lcdNudge(e.deltaY < 0 ? 1 : -1, e.shiftKey)}>
        <div className="lcd-screen">
          <div className="lcd-line lcd-title">
            <span className="lcd-inv">{' ' + page.title + ' '}</span>
            <span className="lcd-dim">{'  P' + (s.selectedPart + 1) + ' ' + curPattern(s).parts[s.selectedPart].name}</span>
          </div>
          {page.items.map((it, i) => (
            <div key={i} className={`lcd-line zoom-item ${i === cur ? 'sel' : ''}`} onClick={() => useStore.setState({ cursor: i })} title={it.hint}>
              <span>{i === cur ? '▶' : ' '}</span>
              <span>{pad(it.label, 12)}</span>
              <Bar item={it} segs={16} />
              <span className="lcd-val">{it.value}</span>
            </div>
          ))}
          <div className="lcd-line lcd-dim zoom-help">←/→ VOCE · +/− O ROTELLA VALORE · ENTER · F2 CHIUDI</div>
          {page.items[cur]?.hint && <div className="lcd-line lcd-dim zoom-hint">{page.items[cur].hint}</div>}
          {s.message && <div className="lcd-line lcd-msg">{s.message.text}</div>}
        </div>
        <div className="lcd-glass" />
      </div>
    </div>
  );
}
