// Illustrazioni del piazzale: mezzi (pala gommata, sollevatore telescopico, muletto),
// pallet, big bag, mucchi, camion con container. SVG disegnati a mano, con parti
// mobili (ruote, bracci, forche, lampeggiante) animate dal CSS.
import { h } from './ui.js';

const C = {
  y: '#F5B700', ys: '#D79A00', yl: '#FFD54A',
  o: '#E8622A', os: '#C24C1C', ol: '#F58A57',
  dk: '#2A2E33', dk2: '#3B4148', ty: '#16181A', rim: '#A3AAB1',
  gl: '#A8D2EC', skin: '#F1C7A0', wood: '#C79157', wood2: '#9E6A37',
  bag: '#F5F3EE', bag2: '#D8D3C6', strap: '#2F6EA8',
};

function wheel(cx, cy, r) {
  const s = [];
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    s.push(`<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * r * 0.5).toFixed(1)}" y2="${(cy + Math.sin(a) * r * 0.5).toFixed(1)}" stroke="${C.dk}" stroke-width="${(r * 0.12).toFixed(1)}" stroke-linecap="round"/>`);
  }
  return `<g class="wheel"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.ty}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="${C.rim}"/>${s.join('')}<circle cx="${cx}" cy="${cy}" r="${r * 0.18}" fill="${C.dk}"/></g>`;
}
function driver(x, y) {
  return `<g class="driver"><circle cx="${x}" cy="${y}" r="5" fill="${C.skin}"/><path d="M${x - 6} ${y - 1.5} Q${x} ${y - 10} ${x + 6} ${y - 1.5} Z" fill="${C.y}" stroke="${C.ys}" stroke-width=".8"/><rect x="${x - 7}" y="${y - 2.2}" width="14" height="1.8" rx=".9" fill="${C.ys}"/></g>`;
}
function beacon(x, y) {
  return `<g class="beacon"><rect x="${x - 2.5}" y="${y}" width="5" height="3" fill="${C.dk}"/><circle class="beacon-light" cx="${x}" cy="${y - 1}" r="3" fill="#FF9500"/></g>`;
}
function palletSvg(x, y, w) {
  const n = 3;
  const gap = (w - n * 5) / (n - 1);
  let blocks = '';
  for (let i = 0; i < n; i++) blocks += `<rect x="${x + i * (5 + gap)}" y="${y + 2.5}" width="5" height="3" fill="${C.wood2}"/>`;
  return `<g class="pallet"><rect x="${x}" y="${y}" width="${w}" height="2.5" rx=".5" fill="${C.wood}"/>${blocks}<rect x="${x}" y="${y + 5.5}" width="${w}" height="2" rx=".5" fill="${C.wood}"/></g>`;
}
function bagSvg(x, y, w, hgt, label = true) {
  return `<g class="bag"><path d="M${x + 2} ${y + 4} Q${x} ${y + hgt} ${x + 3} ${y + hgt} L${x + w - 3} ${y + hgt} Q${x + w} ${y + hgt} ${x + w - 2} ${y + 4} Z" fill="${C.bag}" stroke="${C.bag2}" stroke-width="1"/>
    <path d="M${x + 4} ${y + 4} q2 -5 4 0 M${x + w - 8} ${y + 4} q2 -5 4 0" stroke="${C.strap}" stroke-width="1.6" fill="none"/>
    ${label ? `<rect x="${x + w * 0.3}" y="${y + hgt * 0.42}" width="${w * 0.4}" height="${hgt * 0.22}" rx="1" fill="${C.bag2}"/>` : ''}</g>`;
}

/* Mezzi -------------------------------------------------------------- */

export function forkliftSvg({ load = false } = {}) {
  return `<svg viewBox="0 0 132 84" class="veh veh-forklift" aria-hidden="true">
  <ellipse class="shadow" cx="62" cy="81" rx="56" ry="3" fill="rgba(0,0,0,.18)"/>
  <g class="v-body">
    <path d="M12 68 Q6 68 6 61 L6 46 Q6 40 13 40 L60 40 L66 54 L93 54 L93 68 Z" fill="${C.y}"/>
    <path d="M6 61 L93 61 L93 68 L12 68 Q6 68 6 62 Z" fill="${C.ys}"/>
    <path d="M9 45 h12 M9 49 h12 M9 53 h12" stroke="${C.ys}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M40 40 L40 31 Q40 27 44 27 L51 27 L52 40 Z" fill="${C.dk}"/>
    ${driver(50, 22)}
    <path d="M61 40 L66 30" stroke="${C.dk}" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="66" cy="29.5" rx="4" ry="1.6" fill="${C.dk}"/>
    <rect x="35" y="7" width="3" height="34" rx="1" fill="${C.dk}"/>
    <path d="M73 54 L71 8" stroke="${C.dk}" stroke-width="3" stroke-linecap="round"/>
    <rect x="31" y="5" width="47" height="4" rx="2" fill="${C.dk}"/>
    ${beacon(56, 1)}
  </g>
  <rect x="95" y="3" width="5" height="67" rx="1" fill="${C.dk2}"/>
  <rect x="100" y="10" width="3" height="60" fill="${C.dk}"/>
  <g class="v-forks">
    <rect x="102" y="45" width="5" height="22" rx="1" fill="${C.dk}"/>
    <rect x="102" y="64" width="28" height="4" rx="1" fill="${C.dk2}"/>
    ${load ? `${palletSvg(104, 56.5, 26)}${bagSvg(104.5, 27, 25, 29)}` : ''}
  </g>
  ${wheel(28, 68, 12)}${wheel(80, 68, 13)}
</svg>`;
}

export function loaderSvg({ load = false } = {}) {
  return `<svg viewBox="0 0 182 106" class="veh veh-loader" aria-hidden="true">
  <ellipse class="shadow" cx="90" cy="102" rx="84" ry="4" fill="rgba(0,0,0,.18)"/>
  <g class="v-body">
    <rect x="24" y="28" width="4" height="17" rx="1" fill="${C.dk}"/>
    <path d="M10 80 L10 53 Q10 45 18 45 L75 45 L81 63 L94 63 L94 82 L15 82 Z" fill="${C.y}"/>
    <path d="M10 74 L94 74 L94 82 L15 82 Q10 82 10 76 Z" fill="${C.ys}"/>
    <path d="M15 51 v18 M20 51 v18 M25 51 v18 M30 51 v18" stroke="${C.ys}" stroke-width="2" stroke-linecap="round"/>
    <path d="M50 47 L50 14 Q50 10 54 10 L85 10 Q89 10 89 14 L91 47 Z" fill="${C.dk}"/>
    <path d="M55 16 L83 16 L85 41 L55 41 Z" fill="${C.gl}" opacity=".9"/>
    <path d="M58 18 L66 18 L60 39 L57 39 Z" fill="#fff" opacity=".35"/>
    ${driver(72, 30)}
    ${beacon(70, 5)}
    <circle cx="98" cy="72" r="6" fill="${C.dk}"/>
  </g>
  ${wheel(42, 82, 20)}
  ${wheel(122, 82, 20)}
  <g class="v-arm">
    <path d="M88 50 L148 72 L144 82 L86 61 Z" fill="${C.y}"/>
    <path d="M90 56 L146 77" stroke="${C.ys}" stroke-width="2"/>
    <path d="M100 74 L138 70" stroke="${C.dk2}" stroke-width="4" stroke-linecap="round"/>
    <g class="v-bucket">
      <path d="M138 56 Q160 51 171 59 L173 89 L142 91 Q133 76 138 56 Z" fill="${C.dk2}"/>
      <path d="M142 91 L173 89" stroke="${C.dk}" stroke-width="3"/>
      <path d="M145 92 v3 M152 92 v3 M159 91 v3 M166 91 v3" stroke="${C.dk}" stroke-width="2.4" stroke-linecap="round"/>
      ${load ? `<path class="bucket-load" d="M140 60 Q150 46 160 52 Q168 50 171 58 Z" fill="#6B6359"/>` : ''}
    </g>
    <circle cx="90" cy="54" r="4" fill="${C.dk}"/>
  </g>
</svg>`;
}

export function telehandlerSvg({ load = false } = {}) {
  return `<svg viewBox="0 0 196 98" class="veh veh-tele" aria-hidden="true">
  <ellipse class="shadow" cx="88" cy="94" rx="80" ry="3.5" fill="rgba(0,0,0,.18)"/>
  <g class="v-body">
    <rect x="14" y="40" width="34" height="16" rx="5" fill="${C.o}"/>
    <path d="M14 76 L14 60 Q14 53 21 53 L150 53 Q157 53 157 60 L157 76 Z" fill="${C.o}"/>
    <path d="M14 70 L157 70 L157 76 L14 76 Z" fill="${C.os}"/>
  </g>
  <g class="v-boom">
    <path d="M22 40 L122 31 L124 43 L26 51 Z" fill="${C.o}"/>
    <path d="M26 46 L122 37" stroke="${C.os}" stroke-width="2"/>
    <g class="v-tele">
      <path d="M112 33 L160 28.5 L161 38.5 L114 42 Z" fill="${C.dk2}"/>
      <rect x="158" y="22" width="6" height="28" rx="1" fill="${C.dk}"/>
      <rect x="163" y="46" width="24" height="3.5" rx="1" fill="${C.dk2}"/>
      ${load ? `${palletSvg(165, 38.5, 21)}${bagSvg(166, 18, 19, 20)}` : ''}
    </g>
    <circle cx="28" cy="45" r="4.5" fill="${C.dk}"/>
  </g>
  <g class="v-cab">
    <path d="M60 55 L60 22 Q60 18 64 18 L90 18 Q94 18 94 22 L96 55 Z" fill="${C.dk}"/>
    <path d="M65 24 L89 24 L90 48 L65 48 Z" fill="${C.gl}" opacity=".9"/>
    <path d="M68 26 L74 26 L69 46 L66 46 Z" fill="#fff" opacity=".35"/>
    ${driver(80, 37)}
    ${beacon(77, 13)}
  </g>
  ${wheel(44, 76, 16)}${wheel(132, 76, 16)}
</svg>`;
}

export function truckSvg() {
  let ribs = '';
  for (let x = 18; x < 156; x += 6) ribs += `<rect x="${x}" y="22" width="2.2" height="36" fill="rgba(0,0,0,.14)"/>`;
  return `<svg viewBox="0 0 232 92" class="veh veh-truck" aria-hidden="true">
  <ellipse class="shadow" cx="116" cy="88" rx="108" ry="3.5" fill="rgba(0,0,0,.18)"/>
  <g class="v-body">
    <rect x="12" y="18" width="148" height="44" rx="2" fill="#2F6E9E"/>${ribs}
    <rect x="12" y="18" width="148" height="4" fill="#3E86BD"/>
    <text x="86" y="45" text-anchor="middle" font-family="Big Shoulders Stencil Display, sans-serif" font-size="13" font-weight="800" fill="rgba(255,255,255,.75)" letter-spacing="2">DEMO 40'</text>
    <rect x="8" y="62" width="158" height="6" fill="${C.dk}"/>
    <path d="M168 68 L168 34 Q168 26 176 26 L200 26 L214 44 L218 46 L218 68 Z" fill="#F4F4F2"/>
    <path d="M176 32 L198 32 L209 45 L176 45 Z" fill="${C.gl}"/>
    ${driver(188, 39)}
    <rect x="166" y="60" width="54" height="8" fill="${C.dk2}"/>
    <rect x="212" y="52" width="6" height="4" rx="1" fill="#FFD54A"/>
  </g>
  ${wheel(36, 72, 10)}${wheel(60, 72, 10)}${wheel(140, 72, 10)}${wheel(196, 72, 10)}
</svg>`;
}

/* Oggetti ------------------------------------------------------------ */

const MATERIAL_TONES = ['#5E646B', '#7B6B59', '#4B5058', '#8D8678', '#6F5D4F', '#3F444B', '#857360', '#5A5F55'];
export function materialTone(name = '') {
  let hsh = 0;
  for (const ch of name) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
  return MATERIAL_TONES[hsh % MATERIAL_TONES.length];
}

export function heapSvg({ color = '#6B6359', scale = 1 } = {}) {
  const hgt = 18 + 34 * scale;
  return `<svg viewBox="0 0 120 60" class="obj obj-heap" aria-hidden="true">
    <ellipse cx="60" cy="57" rx="56" ry="3" fill="rgba(0,0,0,.16)"/>
    <path class="heap-body" d="M4 57 Q22 ${57 - hgt * 0.75} 44 ${57 - hgt} Q60 ${57 - hgt - 6} 74 ${57 - hgt + 2} Q98 ${57 - hgt * 0.6} 116 57 Z" fill="${color}"/>
    <path d="M30 ${57 - hgt * 0.55} Q48 ${57 - hgt - 2} 66 ${57 - hgt + 1}" stroke="rgba(255,255,255,.22)" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="26" cy="54" r="1.6" fill="rgba(0,0,0,.25)"/><circle cx="92" cy="53" r="2" fill="rgba(0,0,0,.2)"/><circle cx="64" cy="50" r="1.3" fill="rgba(255,255,255,.2)"/>
  </svg>`;
}

/** Big bag su pallet: n sacchi (max 9) impilati a piramide. */
export function bagsSvg(n = 3) {
  n = Math.max(1, Math.min(9, n));
  const rows = n <= 3 ? [n] : n <= 5 ? [3, n - 3] : [Math.ceil(n / 2), Math.floor(n / 2)].sort((a, b) => b - a);
  let out = '';
  const bw = 26, bh = 24;
  rows.forEach((count, r) => {
    const total = count * bw + (count - 1) * 2;
    const x0 = (110 - total) / 2;
    for (let i = 0; i < count; i++) out += bagSvg(x0 + i * (bw + 2), 59 - (r + 1) * bh - r * 1, bw, bh, r === 0);
  });
  return `<svg viewBox="0 0 110 72" class="obj obj-bags" aria-hidden="true">
    <ellipse cx="55" cy="69" rx="50" ry="2.5" fill="rgba(0,0,0,.16)"/>${out}${palletSvg(8, 60, 94)}</svg>`;
}

export function shedSvg() {
  let stacks = '';
  [[18, 2], [52, 1], [86, 2], [120, 1]].forEach(([x, levels]) => {
    for (let l = 0; l < levels; l++) {
      stacks += palletSvg(x, 104 - l * 25, 30);
      stacks += bagSvg(x + 3, 84 - l * 25, 24, 20, false);
    }
  });
  return `<svg viewBox="0 0 170 116" class="obj obj-shed" aria-hidden="true">
    <path d="M2 22 L84 4 L168 22 L168 28 L2 28 Z" fill="#4A535C"/>
    <path d="M2 22 L84 4 L168 22" stroke="#6C7680" stroke-width="2" fill="none"/>
    <rect x="8" y="28" width="4" height="86" fill="#59626B"/><rect x="158" y="28" width="4" height="86" fill="#59626B"/><rect x="83" y="28" width="4" height="86" fill="#59626B" opacity=".6"/>
    <rect x="56" y="32" width="58" height="12" rx="1.5" fill="${C.y}"/>
    <text x="85" y="41.5" text-anchor="middle" font-family="Big Shoulders Stencil Display, sans-serif" font-size="10" font-weight="800" fill="#1A1A1A" letter-spacing="1.6">TETTOIA</text>
    ${stacks}
  </svg>`;
}

export function containerStackSvg() {
  const box = (x, y, color, light) => {
    let ribs = '';
    for (let i = x + 5; i < x + 70; i += 5) ribs += `<rect x="${i}" y="${y + 3}" width="1.8" height="22" fill="rgba(0,0,0,.15)"/>`;
    return `<rect x="${x}" y="${y}" width="74" height="28" rx="1.5" fill="${color}"/><rect x="${x}" y="${y}" width="74" height="3" fill="${light}"/>${ribs}`;
  };
  return `<svg viewBox="0 0 160 64" class="obj obj-containers" aria-hidden="true">
    ${box(4, 34, '#B4532A', '#CF6A3D')}${box(80, 34, '#2F6E9E', '#3E86BD')}${box(42, 4, '#5B7F4A', '#709A5D')}</svg>`;
}

/* Componenti DOM ---------------------------------------------------- */

const MAKERS = { forklift: forkliftSvg, loader: loaderSvg, telehandler: telehandlerSvg, truck: truckSvg };

/** Elemento con l'illustrazione di un mezzo. */
export function vehicle(kind, { load = false, cls = '', width } = {}) {
  const el = h(`span.vehicle.k-${kind}${cls ? '.' + cls.split(' ').join('.') : ''}`, { 'aria-hidden': 'true' });
  el.innerHTML = (MAKERS[kind] || forkliftSvg)({ load });
  if (width) el.style.width = typeof width === 'number' ? `${width}px` : width;
  return el;
}

export function svgEl(markup, cls = '') {
  const el = h(`span.art${cls ? '.' + cls : ''}`, { 'aria-hidden': 'true' });
  el.innerHTML = markup;
  return el;
}

/** Illustrazione del lotto: mucchio per lo sfuso, big bag per i sacconi. */
export function lotArt(lot) {
  if (lot.format === 'Sacconi') return svgEl(bagsSvg(lot.bags || Math.ceil(lot.tons)), 'lot-art');
  const scale = Math.max(0.15, Math.min(1, Math.log10(lot.tons + 1) / 3.1));
  if (lot.format === 'Altro') return svgEl(bagsSvg(2), 'lot-art');
  return svgEl(heapSvg({ color: materialTone(lot.material), scale }), 'lot-art');
}

/* Scena del piazzale: i mezzi seguono il loro stato (in uso, disponibile, manutenzione, fermo). */
const SCENE_IDS = { pala: 'loader', merlo: 'telehandler', 'muletto-1': 'forklift', 'muletto-2': 'forklift' };

export function scene(fleet = [], { caption = null, wrenchIcon = null } = {}) {
  const sky = h('div.scene-sky', h('span.sun'), h('span.moon'),
    [[8, 18], [22, 9], [37, 24], [55, 12], [68, 28], [81, 8], [93, 20]].map(([x, y], i) => h('span.star', { style: { left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.4}s` } })),
    h('span.cloud', { style: { width: '70px', top: '18%', animationDelay: '-12s' } }),
    h('span.cloud', { style: { width: '50px', top: '32%', animationDelay: '-41s', animationDuration: '80s' } }));
  const props = [
    h('span.prop.p-lamp', { style: { left: '48cqw' } }),
    h('span.prop.p-lamp', { style: { left: '91cqw' } }),
    svgEl(containerStackSvg(), 'prop.p-containers'),
    svgEl(heapSvg({ color: '#6E655A', scale: 0.55 }), 'prop.p-heap2'),
    svgEl(shedSvg(), 'prop.p-shed'),
    svgEl(heapSvg({ color: '#5E646B', scale: 0.95 }), 'prop.p-heap1'),
  ];
  const vehicles = [];
  let palaRuns = false;
  for (const v of fleet) {
    const kind = SCENE_IDS[v.id];
    if (!kind) continue;
    const running = v.status === 'Disponibile' || v.status === 'In uso';
    if (v.id === 'pala' && running) palaRuns = true;
    const load = v.id === 'pala' ? true : v.status === 'In uso';
    vehicles.push(h(`div.sv.sv-${v.id}.${running ? 'run' : 'parked'}${v.status === 'Fermo' ? '.fermo' : ''}`,
      vehicle(kind, { load }),
      h('span.sv-tag', `${v.name} · ${v.status}`),
      !running ? h('span.cone') : null,
      !running && v.status === 'Manutenzione' && wrenchIcon ? h('span.wrench', wrenchIcon()) : null));
  }
  return h('div.scene', { 'aria-hidden': 'true' },
    sky, h('div.scene-ground'), props,
    palaRuns ? h('div.dust', h('i'), h('i'), h('i')) : null,
    vehicles,
    caption ? h('div.scene-caption', h('span.live'), caption) : null);
}

/** Muletto che sonnecchia, per gli stati vuoti. */
export function idleLift() {
  const el = h('div.idle-lift', { 'aria-hidden': 'true' }, h('span.zz', h('span', 'z'), h('span', 'z'), h('span', 'Z')));
  el.insertAdjacentHTML('afterbegin', forkliftSvg({ load: false }));
  return el;
}
