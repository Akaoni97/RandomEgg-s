// Utilità di interfaccia: creazione DOM, icone, dialoghi accessibili, menu, toast.
import { LOCATIONS, suggestLocations, getLocation, fmtTons, TZ } from './core.js';

export const App = { store: null, navigate: null, route: null, render: null, fx: null };

/* DOM ---------------------------------------------------------------- */

export function h(tag, props, ...children) {
  const m = /^([a-z0-9-]+)?((?:[.#][\w-]+)*)$/i.exec(tag);
  const el = document.createElement(m[1] || 'div');
  for (const part of m[2].match(/[.#][\w-]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
    props = null;
  }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'style') el.setAttribute('style', v);
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'hidden') el[k] = !!v;
    else if (k.startsWith('--')) el.style.setProperty(k, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children) {
    if (c == null || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export function clear(el) {
  while (el.firstChild) el.firstChild.remove();
  return el;
}
/** Svuota e riempie, ignorando null/false come h(). */
export function fill(el, ...children) {
  clear(el);
  append(el, children);
  return el;
}

/* Icone (tratto 1.8, 24×24) ----------------------------------------- */

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  orders: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 3.5V2h6v1.5M9 9h6M9 13h6M9 17h3"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  moves: '<path d="M7 4v14m0 0-3-3m3 3 3-3M17 20V6m0 0-3 3m3-3 3 3"/>',
  note: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8.5 12h7M8.5 16h5"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3 4v4h4M12 8v4.5l3 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  truck: '<path d="M3 6h11v10H3zM14 9h4l3 3.5V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  container: '<rect x="3" y="6" width="18" height="12" rx="1.5"/><path d="M7.5 9v6M12 9v6M16.5 9v6"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
  play: '<path d="M7 5v14l11-7z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  upload: '<path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3"/>',
  download: '<path d="M12 4v12m0 0-4.5-4.5M12 16l4.5-4.5M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  alert: '<path d="M12 3.5 2.5 20h19L12 3.5Z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  map: '<path d="m3 6 6-2.5 6 2.5 6-2.5v14.5L15 21l-6-2.5L3 21z"/><path d="M9 3.5v15M15 6v15"/>',
  transfer: '<path d="M4 8h13m0 0-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0 3.5-3.5M7 16l3.5 3.5"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  chevL: '<path d="m15 5-7 7 7 7"/>',
  chevR: '<path d="m9 5 7 7-7 7"/>',
  arrowL: '<path d="M19 12H5m0 0 6-6m-6 6 6 6"/>',
  arrowUp: '<path d="M12 19V5m0 0-6 6m6-6 6 6"/>',
  arrowDown: '<path d="M12 5v14m0 0 6-6m-6 6-6-6"/>',
  pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  wifiOff: '<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.3-2.4M19 12.5a10 10 0 0 0-3-2M2 8.5a15 15 0 0 1 5-3M22 8.5A15 15 0 0 0 12 4.5"/><circle cx="12" cy="19.5" r=".8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  spark: '<path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  flask: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3"/><path d="M7.5 15h9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
  database: '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  ingot: '<path d="M3 17 6 9h12l3 8z"/><path d="M6 9l2-4h8l2 4"/>',
};

export function icon(name, size = 20, extra = '') {
  const span = document.createElement('span');
  span.style.display = 'inline-flex';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${P[name] || ''}</svg>`;
  return span;
}

export function brandMark(size = 42) {
  const span = document.createElement('span');
  span.className = 'brand-mark';
  span.style.width = span.style.height = `${size}px`;
  span.setAttribute('aria-hidden', 'true');
  const gid = 'g' + Math.random().toString(36).slice(2, 7);
  span.innerHTML = `<svg viewBox="0 0 48 48" width="${size}" height="${size}">
    <defs><linearGradient id="${gid}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#c93d06"/><stop offset=".45" stop-color="#ff6a1a"/><stop offset="1" stop-color="#ffd27a"/></linearGradient></defs>
    <rect x="1" y="1" width="46" height="46" rx="12" fill="#0b1118" stroke="rgba(255,255,255,.12)"/>
    <path d="M9 35 13 27h22l4 8z" fill="url(#${gid})"/>
    <path d="M13 27l3-6h16l3 6z" fill="url(#${gid})" opacity=".75"/>
    <path d="M17 21l2.5-5h9l2.5 5z" fill="url(#${gid})" opacity=".5"/>
    <path d="M9 35h30" stroke="#ffe3a3" stroke-width="1.2" opacity=".7"/>
  </svg>`;
  return span;
}

/* Date --------------------------------------------------------------- */

const dShort = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const dLong = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const dDay = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const tFmt = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const dtFmt = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ });
const isoD = (iso) => new Date(`${iso}T00:00:00Z`);
export const fmtDayShort = (iso) => dShort.format(isoD(iso));
export const fmtDayLong = (iso) => dLong.format(isoD(iso));
export const fmtDayMonth = (iso) => dDay.format(isoD(iso));
export const fmtTime = (ms) => tFmt.format(new Date(ms));
export const fmtDateTime = (ms) => dtFmt.format(new Date(ms));

/* Movimento ridotto -------------------------------------------------- */

export function reducedMotion() {
  return document.documentElement.dataset.motion === 'reduced' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/* Toast -------------------------------------------------------------- */

let toastHost;
export function toast(message, { kind = 'ok', action, duration, art } = {}) {
  if (!toastHost) {
    toastHost = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
    document.body.append(toastHost);
  }
  const ms = duration ?? (kind === 'error' ? 0 : 4800);
  const el = h(`div.toast.${kind}`,
    art ? h('div.t-icon.art', art) : h('div.t-icon', icon(kind === 'error' ? 'alert' : kind === 'warn' ? 'info' : 'check', 18)),
    h('div.t-msg', message),
    h('div.t-actions',
      action && h('button', { type: 'button', on: { click: () => { close(); action.run(); } } }, action.label),
      h('button', { type: 'button', 'aria-label': 'Chiudi notifica', on: { click: () => close() } }, icon('x', 14))),
    ms ? h('div.t-progress', { style: { animationDuration: `${ms}ms` } }) : null);
  let timer;
  function close() {
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  }
  toastHost.append(el);
  while (toastHost.children.length > 4) toastHost.firstChild.remove();
  if (ms) timer = setTimeout(close, ms);
  return close;
}

/* Dialoghi ------------------------------------------------------------ */

const openLayers = [];
export function dialogOpen() {
  return openLayers.length > 0;
}

/**
 * Apre un dialogo modale. Su telefono diventa un pannello dal basso.
 * Gestisce focus iniziale, trappola del focus, Esc e ritorno del focus.
 */
export function openDialog({ title, subtitle, body, foot, wide = false, className = '', onClose, labelledBy }) {
  const opener = document.activeElement;
  const id = 'dlg-' + Math.random().toString(36).slice(2, 8);
  const layer = h('div.dialog-layer');
  const backdrop = h('div.dialog-backdrop');
  const dlg = h(`div.dialog${wide ? '.wide' : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': labelledBy || `${id}-t`, class: className });
  let closed = false;
  const api = {
    el: dlg,
    close(result) {
      if (closed) return;
      closed = true;
      layer.classList.add('closing');
      openLayers.splice(openLayers.indexOf(api), 1);
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => {
        layer.remove();
        if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        onClose?.(result);
        App.render?.({ deferred: true });
      }, reducedMotion() ? 0 : 200);
    },
  };
  if (title) {
    dlg.append(h('div.grabber'), h('div.dialog-head',
      h('div', h('h2', { id: `${id}-t` }, title), subtitle ? h('p', subtitle) : null),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Chiudi', on: { click: () => api.close() } }, icon('x'))));
  }
  const bodyEl = h('div.dialog-body');
  const content = typeof body === 'function' ? body(api) : body;
  if (content) bodyEl.append(content);
  dlg.append(bodyEl);
  const footEl = typeof foot === 'function' ? foot(api) : foot;
  if (footEl) dlg.append(h('div.dialog-foot', footEl));
  backdrop.addEventListener('click', () => api.close());
  layer.append(backdrop, dlg);
  document.body.append(layer);
  openLayers.push(api);

  function focusables() {
    return [...dlg.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((e) => !e.disabled && e.offsetParent !== null);
  }
  function onKey(e) {
    if (openLayers[openLayers.length - 1] !== api) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); api.close(); }
    if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  }
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => {
    const auto = dlg.querySelector('[autofocus]') || focusables().find((e) => e.matches('input, select, textarea')) || focusables()[0];
    auto?.focus({ preventScroll: true });
    if (auto?.select && auto.matches('input')) auto.select();
  });
  return api;
}

/** Conferma dentro la pagina (window.confirm non è affidabile). */
export function confirmDialog({ title, message, confirmLabel = 'Conferma', danger = false, details }) {
  return new Promise((resolve) => {
    let ok = false;
    openDialog({
      title,
      body: h('div', { style: 'display:grid;gap:12px' }, h('p', { style: 'color:var(--ink-2)' }, message), details || null),
      foot: (d) => [
        h('button.btn.ghost', { type: 'button', on: { click: () => d.close() } }, 'Annulla'),
        h(`button.btn${danger ? '.danger.solid' : '.primary'}`, { type: 'button', autofocus: true, on: { click: () => { ok = true; d.close(); } } }, confirmLabel),
      ],
      onClose: () => resolve(ok),
    });
  });
}

/* Menu contestuale ---------------------------------------------------- */

export function openMenu(anchor, items) {
  document.querySelector('.menu-pop')?.remove();
  const pop = h('div.menu-pop', { role: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it === '-') { pop.append(h('hr')); continue; }
    pop.append(h(`button${it.danger ? '.danger' : ''}`, { type: 'button', role: 'menuitem', disabled: it.disabled,
      on: { click: () => { close(); it.run(); } } }, icon(it.icon || 'chevR', 18), it.label));
  }
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = Math.min(window.innerWidth - pw - 12, Math.max(12, r.right - pw));
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 6);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  const btns = [...pop.querySelectorAll('button:not(:disabled)')];
  btns[0]?.focus();
  function close() {
    pop.remove();
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', key, true);
    anchor.focus?.({ preventScroll: true });
  }
  function outside(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', key, true); } }
  function key(e) {
    const i = btns.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); btns[(i + 1) % btns.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); btns[(i - 1 + btns.length) % btns.length]?.focus(); }
    else if (e.key === 'Tab') close();
  }
  setTimeout(() => {
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', key, true);
  });
}

/* Campi dei moduli ---------------------------------------------------- */

let fieldSeq = 0;
export function field(label, control, { hint, id } = {}) {
  // Se il controllo è avvolto (es. numero con unità), l'etichetta punta al campo interno.
  const target = control.matches('input, select, textarea') ? control : control.querySelector('input, select, textarea') || control;
  const fid = target.id || id || `f-${++fieldSeq}`;
  target.id = fid;
  const hintEl = hint ? h('div.hint', { id: `${fid}-h` }, hint) : null;
  if (hintEl) target.setAttribute('aria-describedby', `${fid}-h`);
  return h('div.field', h('label', { for: fid }, label), control, hintEl);
}

export function input(props = {}) {
  return h('input.input', { type: 'text', autocomplete: 'off', ...props });
}
export function select(options, value, props = {}) {
  const el = h('select.input.select', props);
  for (const o of options) {
    const [v, l] = Array.isArray(o) ? o : [o, o];
    el.append(h('option', { value: v, selected: v === value }, l));
  }
  return el;
}
export function textarea(props = {}) {
  return h('textarea.input', props);
}
export function switchControl(label, checked, props = {}) {
  const inp = h('input', { type: 'checkbox', checked, ...props });
  return { el: h('label.switch', inp, h('span.track-sw'), h('span', label)), input: inp };
}

/** Elenco di opzioni per suggerimenti (materiali, clienti). */
export function datalist(id, values) {
  return h('datalist', { id }, [...new Set(values.filter(Boolean))].sort().map((v) => h('option', { value: v })));
}

/**
 * Selettore di posizione: si scrive "18", "A", "tett" e si sceglie dall'elenco.
 * Restituisce { el, input, get value(), set value() }.
 */
export function locationPicker({ value, id, statsFor, exclude, required = true, allowGeneral = false } = {}) {
  let current = value || null;
  const listId = `${id || 'loc'}-list`;
  const inp = input({ id, role: 'combobox', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-autocomplete': 'list',
    placeholder: allowGeneral ? 'Generale — oppure scrivi 18, A, Tettoia…' : 'Scrivi 18, A, Tettoia…', value: current ? getLocation(current)?.name : '' });
  const list = h('div.combo-list', { id: listId, role: 'listbox', hidden: true });
  const wrap = h('div.combo', inp, list);
  let opts = [];
  let active = -1;
  function render() {
    const q = inp.value.trim();
    opts = q ? suggestLocations(q, 10) : LOCATIONS.slice(0, 10);
    if (exclude) opts = opts.filter((l) => l.id !== exclude);
    clear(list);
    if (allowGeneral && !q) list.append(h('div', { role: 'option', id: `${listId}-g`, 'aria-selected': 'false', on: { pointerdown: (e) => { e.preventDefault(); choose(null); } } }, 'Generale (nessuna posizione)'));
    opts.forEach((l, i) => {
      list.append(h('div', { role: 'option', id: `${listId}-${i}`, 'aria-selected': String(i === active), on: { pointerdown: (e) => { e.preventDefault(); choose(l.id); } } },
        h('span', l.name), statsFor ? h('small', statsFor(l.id)) : null));
    });
    list.hidden = !opts.length && !allowGeneral;
    inp.setAttribute('aria-expanded', String(!list.hidden));
  }
  function choose(idv) {
    current = idv;
    inp.value = idv ? getLocation(idv).name : '';
    list.hidden = true;
    inp.setAttribute('aria-expanded', 'false');
    inp.removeAttribute('aria-invalid');
    inp.dispatchEvent(new CustomEvent('locchange', { bubbles: true }));
  }
  inp.addEventListener('focus', () => { active = -1; render(); });
  inp.addEventListener('input', () => {
    active = 0;
    const exact = LOCATIONS.find((l) => l.name.toLowerCase() === inp.value.trim().toLowerCase());
    current = exact ? exact.id : null;
    render();
  });
  inp.addEventListener('blur', () => {
    setTimeout(() => { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); }, 120);
    if (!current && inp.value.trim() && opts[0] && suggestLocations(inp.value, 1)[0]?.code.toLowerCase() === inp.value.trim().toLowerCase().replace(/^(baia|mucchio)\s*/, '')) choose(opts[0].id);
  });
  inp.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(opts.length - 1, active + 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); }
    else if (e.key === 'Enter' && opts[active]) { e.preventDefault(); choose(opts[active].id); }
    else if (e.key === 'Escape') { list.hidden = true; e.stopPropagation(); }
  });
  return {
    el: wrap,
    input: inp,
    get value() { return current; },
    set value(v) { choose(v); },
    validate() {
      if (!current && (required || inp.value.trim())) { inp.setAttribute('aria-invalid', 'true'); return false; }
      return true;
    },
  };
}

export function locStat(state, id, positionStats) {
  const st = positionStats(state, id);
  return st.present ? fmtTons(st.present) : 'vuota';
}

/** Copia negli appunti con ripiego sulla selezione del testo. */
export async function copyText(text, fallbackEl) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copiato negli appunti');
  } catch {
    if (fallbackEl) {
      fallbackEl.focus();
      fallbackEl.select?.();
      toast('Testo selezionato: copialo con Ctrl+C o tieni premuto', { kind: 'warn' });
    }
  }
}

export function initials(name) {
  return String(name || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
