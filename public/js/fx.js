// Effetti: scintille di conferma, fucina animata nell'accesso, numeri che scorrono.
// Tutto si disattiva con "riduci movimento".
import { reducedMotion } from './ui.js';
import { fmtNum } from './core.js';

/* Scintille ---------------------------------------------------------- */

let canvas, ctx, sparks = [], raf = 0;
function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.id = 'fx';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
}

/** Esplosione di scintille dal punto (x, y) o dal centro di un elemento. */
export function burst(target, { count = 34, power = 1, hue = 'molten' } = {}) {
  if (reducedMotion()) return;
  ensureCanvas();
  let x = innerWidth / 2, y = innerHeight / 2;
  if (target?.getBoundingClientRect) {
    const r = target.getBoundingClientRect();
    if (r.width) { x = r.left + r.width / 2; y = r.top + r.height / 2; }
  } else if (target && typeof target.x === 'number') ({ x, y } = target);
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
    const v = (2.5 + Math.random() * 6.5) * power;
    sparks.push({
      x, y, px: x, py: y,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: 1, decay: 0.012 + Math.random() * 0.02,
      w: 1 + Math.random() * 1.8,
      c: hue === 'cool' ? `hsl(${190 + Math.random() * 30}, 100%, ${60 + Math.random() * 25}%)` : `hsl(${18 + Math.random() * 30}, 100%, ${55 + Math.random() * 30}%)`,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalCompositeOperation = 'lighter';
  sparks = sparks.filter((s) => s.life > 0);
  for (const s of sparks) {
    s.px = s.x; s.py = s.y;
    s.vy += 0.22; s.vx *= 0.985; s.vy *= 0.985;
    s.x += s.vx; s.y += s.vy;
    s.life -= s.decay;
    ctx.strokeStyle = s.c;
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(s.px, s.py);
    ctx.lineTo(s.x - s.vx * 1.6, s.y - s.vy * 1.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  raf = sparks.length ? requestAnimationFrame(tick) : 0;
  if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
}

/* Fucina: braci che salgono, per la schermata di accesso ------------- */

export function forge(canvasEl) {
  const c = canvasEl.getContext('2d');
  let w = 0, h = 0, embers = [], alive = true, frame = 0;
  const still = reducedMotion();
  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    w = canvasEl.clientWidth; h = canvasEl.clientHeight;
    canvasEl.width = w * dpr; canvasEl.height = h * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(initial) {
    return {
      x: Math.random() * w,
      y: initial ? Math.random() * h : h + 10,
      r: 0.6 + Math.random() * 2.2,
      vy: 0.3 + Math.random() * 1.1,
      sway: Math.random() * Math.PI * 2,
      life: 0.4 + Math.random() * 0.6,
      hue: 15 + Math.random() * 35,
    };
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvasEl);
  const N = Math.round(Math.min(140, (w * h) / 6000));
  for (let i = 0; i < N; i++) embers.push(spawn(true));
  function draw() {
    if (!alive) return;
    frame++;
    c.clearRect(0, 0, w, h);
    // griglia del piazzale in prospettiva
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.lineWidth = 1;
    const hz = h * 0.55;
    for (let i = -12; i <= 12; i++) {
      c.beginPath(); c.moveTo(w / 2 + i * 18, hz); c.lineTo(w / 2 + i * w * 0.16, h); c.stroke();
    }
    for (let j = 0; j < 10; j++) {
      const t = ((j + (still ? 0 : (frame % 120) / 120)) / 10) ** 2;
      const y = hz + (h - hz) * t;
      c.globalAlpha = t;
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      if (!still) {
        e.y -= e.vy; e.sway += 0.02; e.x += Math.sin(e.sway) * 0.4;
        if (e.y < -10) Object.assign(e, spawn(false));
      }
      const a = Math.min(1, (e.y / h) * 1.4) * e.life;
      const g = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
      g.addColorStop(0, `hsla(${e.hue},100%,70%,${a})`);
      g.addColorStop(1, `hsla(${e.hue},100%,50%,0)`);
      c.fillStyle = g;
      c.beginPath(); c.arc(e.x, e.y, e.r * 4, 0, Math.PI * 2); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    if (!still) requestAnimationFrame(draw);
  }
  draw();
  return () => { alive = false; ro.disconnect(); };
}

/* Numeri che scorrono -------------------------------------------------- */

const lastValues = new Map();

/** Anima il numero dal valore mostrato l'ultima volta (per chiave) al nuovo. */
export function countUp(el, value, key, { format = (v) => fmtNum(v), duration = 900 } = {}) {
  const from = lastValues.has(key) ? lastValues.get(key) : 0;
  lastValues.set(key, value);
  if (reducedMotion() || from === value) { el.textContent = format(value); return; }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / duration);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = format(from + (value - from) * e);
    if (p < 1 && el.isConnected) requestAnimationFrame(step);
    else el.textContent = format(value);
  };
  el.textContent = format(from);
  requestAnimationFrame(step);
}

/** Restituisce la larghezza mostrata in precedenza, per animare le barre dopo un nuovo rendering. */
export function previousWidth(key, next) {
  const prev = lastValues.has('w:' + key) ? lastValues.get('w:' + key) : 0;
  lastValues.set('w:' + key, next);
  return reducedMotion() ? next : prev;
}
