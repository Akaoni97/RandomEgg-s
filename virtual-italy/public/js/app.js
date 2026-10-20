// Interfaccia di Virtual-Italy: mappa a tutto schermo, schede dal basso, iscrizione, scelta del lotto,
// costruzione della casa, amicizie, giornale e redazione.
import {
  CITY, PAPER, ROOFS, DOORS, GARDENS, DECOS, PLAN, FOUNDERS, RESERVE_MS, UNLOCK_RATIO,
  districtAt, districtById, parseKey, makeStyle, residentHouse, builtCount, isFounder, areFriends, friendsOf,
  formatNews, nextGoal, goalProgress, lotsOpen, DomainError, frontOf, spawnPoint, LOOK, cleanLook, SAY_PRESETS, SAY_MAX,
  FURNI, FLOORS, WALLS, ACCESS, ROOM_DOOR, furniById, roomOf, canVisit,
  SHOPS, COMUNE, shopById, isShopRoom, SOLDO, soldi, INCOME, dailyReward, walletOf, JOBS, workOf, jobLevel, shiftsLeft, FURNI_CATS, WEAR, WEAR_SLOTS, wearById, invOf, ownsWear, SHOP_KEEPER_AT, MANNEQUINS,
  seatAt, PIAZZA_DECOR, footprint, missionStatus, progressOf, dayKey, weekKey, heartsThisWeek, weekRanking, WELCOME_PRIZE,
  RIDES, rideById, walkable, W, SEA_Y, BENCHES, WALK_SPEED,
} from './core.js';
import { CityMap, drawPreview, renderPoster, drawAvatarPreview, avatarLook, drawFurniIcon, drawAvatarIcon, drawAvatarBust, drawRideIcon } from './render.js';
import { RemoteStore, LocalStore } from './store.js';

const DEMO = window.__VI_MODE === 'demo' || new URLSearchParams(location.search).has('demo');
const store = DEMO ? new LocalStore() : new RemoteStore();
const $ = (sel, root = document) => root.querySelector(sel);

/* Piccoli attrezzi --------------------------------------------------------- */

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

const ICONS = {
  paper: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2h-1M7 9h7M7 12h7M7 15h4"/>',
  mail: '<path d="M4 7h16v11H4zM4 7l8 6 8-6"/>',
  user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5"/>',
  home: '<path d="M4 11 12 4l8 7M6.5 9.5V19h11V9.5M10 19v-5h4v5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  desk: '<path d="M4 6h16v10H4zM9 20h6M12 16v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  walk: '<circle cx="13" cy="4.5" r="2"/><path d="M11 21l2-6-2.5-3 1-5 3.5 3 3 1M10.5 7 7 9.5 6 13M13 15l3 6"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
  turnL: '<path d="M8 4 4 8l4 4"/><path d="M4 8h9a6 6 0 0 1 0 12H9"/>',
  turnR: '<path d="m16 4 4 4-4 4"/><path d="M20 8h-9a6 6 0 0 0 0 12h4"/>',
  fountain: '<path d="M4 15h16M6 15c0 3 2.7 5 6 5s6-2 6-5M12 15V8M12 8c-2 0-3.5 1.2-4 3M12 8c2 0 3.5 1.2 4 3M12 5v1"/>',
  flask: '<path d="M10 3h4M10.5 3v5.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5.5-9.5V3M7.5 14h9"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c.9 1.4 2.1 2 3.5 2s2.6-.6 3.5-2M9 9.5v.5M15 9.5v.5"/>',
};
// Il Soldo: moneta d'oro con la S e la stella d'Italia, bordo zigrinato.
function coinSvg(size = 22) {
  return `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="16" cy="16" r="15" fill="#b8862a"/>
    <circle cx="16" cy="16" r="15" fill="none" stroke="#8a5f14" stroke-width="1" stroke-dasharray="1.6 1.2"/>
    <circle cx="16" cy="16" r="12.2" fill="#f2c94c"/>
    <circle cx="16" cy="16" r="12.2" fill="none" stroke="#c9952e" stroke-width="1.2"/>
    <path d="M10 10.5a8 8 0 0 1 10.5-2.3" fill="none" stroke="#fff3c4" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>
    <path d="M16 6.4l.75 1.6 1.7.2-1.27 1.15.34 1.7-1.52-.87-1.52.87.34-1.7-1.27-1.15 1.7-.2z" fill="#9a6a12"/>
    <text x="16" y="24.2" text-anchor="middle" font-family="Georgia, 'Abril Fatface', serif" font-weight="700" font-size="13" fill="#8a5f14">S</text>
  </svg>`;
}
const coin = (size) => h('span', { class: 'coin', 'aria-hidden': 'true', html: coinSvg(size) });
const icon = (name) => h('span', { class: 'ico', 'aria-hidden': 'true', html: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>` });

function toast(text, kind = 'ok') {
  const el = h('div', { class: `toast ${kind}`, role: 'status' }, text);
  const box = $('#toasts');
  box.append(el);
  while (box.children.length > 2) box.firstElementChild.remove();
  setTimeout(() => el.classList.add('out'), kind === 'err' ? 4200 : 2800);
  setTimeout(() => el.remove(), kind === 'err' ? 4700 : 3300);
}
const errText = (e) => (e instanceof DomainError || e?.message ? e.message : 'Qualcosa non ha funzionato. Riprova.');

async function run(btn, fn) {
  if (btn) btn.disabled = true;
  try { return await fn(); } catch (e) { toast(errText(e), 'err'); return undefined; } finally { if (btn) btn.disabled = false; }
}
const fmtDate = (t) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDay = (t) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* niente */ } } };
const ss = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* niente */ } } };

/* Stato dell'interfaccia ------------------------------------------------- */

const ui = { mode: 'browse', sheet: null, nightOverride: ls.get('vi-night'), welcomeSeen: ls.get('vi-welcome') === '1' };
let map;

const me = () => store.me;
const myResident = () => me() && store.city.residents[me().id];
const myHouse = () => me() && residentHouse(store.city, me().id);
const isNight = () => (ui.nightOverride ? ui.nightOverride === 'night' : (() => { const hr = new Date().getHours(); return hr >= 20 || hr < 7; })());

/* Guscio ----------------------------------------------------------------- */

function shell() {
  const app = $('#app');
  app.replaceChildren(
    h('canvas', { id: 'map', 'aria-label': `Mappa di ${CITY}` }),
    h('div', { class: 'haze', 'aria-hidden': 'true' }),
    h('div', { class: 'hud-top' },
      h('header', { class: 'top' },
        h('button', { class: 'brand', onclick: () => { closeSheet(); if (ui.tps) toggleTPS(false); map.fitCentro(); }, 'aria-label': 'Torna al centro della città' },
          h('span', { class: 'brand-mark', 'aria-hidden': 'true', html: BRAND_MARK }),
          h('span', { class: 'brand-text' },
            h('span', { class: 'brand-name' }, 'Virtual', h('span', { class: 'brand-dash' }, '-'), 'Italy'),
            h('span', { class: 'brand-count', id: 'count' }))),
        DEMO ? h('button', { class: 'demo-chip', id: 'demo-chip', 'aria-expanded': 'false', onclick: toggleDemoMenu }, icon('flask'), h('span', { class: 'demo-label' }, 'Demo')) : null,
        h('nav', { class: 'top-actions', 'aria-label': 'Comandi' },
          h('button', { class: 'tab wallet', id: 'btn-wallet', onclick: () => openWallet(), 'aria-label': 'Il mio borsellino', hidden: true }, coin(20), h('span', { id: 'wallet-n' })),
          h('button', { class: 'tab', id: 'btn-night', onclick: toggleNight, 'aria-label': 'Giorno o notte' }),
          h('button', { class: 'tab', onclick: () => openGiornale(), 'aria-label': 'Il giornale' }, icon('paper')),
          h('button', { class: 'tab', id: 'btn-missions', onclick: () => openMissions(), 'aria-label': 'Missioni' }, icon('star'), h('span', { class: 'badge', id: 'missions-badge', hidden: true })),
          h('button', { class: 'tab', id: 'btn-mail', onclick: () => openMailbox(), 'aria-label': 'Cassetta delle lettere' }, icon('mail'), h('span', { class: 'badge', id: 'mail-badge', hidden: true })),
          h('button', { class: 'tab', id: 'btn-me', onclick: () => (me() ? openProfile() : openLogin()), 'aria-label': 'Il mio profilo' }, icon('user')))),
      DEMO ? demoMenu() : null,
      h('button', { class: 'ticker', id: 'ticker', onclick: () => openGiornale(), 'aria-label': 'Ultime notizie: apri il giornale' },
        h('span', { class: 'ticker-tag' }, 'Ultim\'ora'),
        h('span', { class: 'ticker-text', id: 'ticker-text' })),
      h('div', { class: 'notice', id: 'notice', hidden: true })),
    h('div', { class: 'zoom' },
      h('button', { class: 'tab tps-toggle', id: 'btn-tps', onclick: () => toggleTPS(true), 'aria-label': 'Cammina in terza persona', hidden: true }, icon('walk')),
      h('button', { class: 'tab', onclick: () => map.zoomStep(1), 'aria-label': 'Ingrandisci' }, icon('plus')),
      h('button', { class: 'tab', onclick: () => map.zoomStep(-1), 'aria-label': 'Rimpicciolisci' }, icon('minus')),
      h('button', { class: 'tab turn', onclick: () => map.rotate(-1), 'aria-label': 'Gira la città a sinistra' }, icon('turnL')),
      h('button', { class: 'tab turn', onclick: () => map.rotate(1), 'aria-label': 'Gira la città a destra' }, icon('turnR'))),
    h('footer', { class: 'bottom', id: 'bottom' }),
    tpsUI(),
    h('div', { class: 'scrim', id: 'scrim', hidden: true, onclick: closeSheet }),
    h('section', { class: 'sheet', id: 'sheet', hidden: true, role: 'dialog', 'aria-modal': 'true' }),
    h('div', { class: 'toasts', id: 'toasts' }),
  );
  map = new CityMap($('#map'), { onTap, onMove: (x, y) => store.move(x, y) });
  if (!map.t3) for (const b of document.querySelectorAll('.zoom .turn')) b.hidden = true;
  window.__virtualItaly = { store, map, preview: drawAvatarPreview, look: avatarLook, icon: drawAvatarIcon }; // comodo per il debug dalla console
}

const BRAND_MARK = '<svg viewBox="0 0 64 64" width="30" height="30"><rect width="64" height="64" rx="16" fill="#f2b632"/><path d="M15 44V28h34v16z" fill="#fbf3dc"/><path d="M11 29 32 12l21 17z" fill="#b5523b"/><path d="M28 44v-9h8v9z" fill="#2f5d50"/><path d="M19 31h6v5h-6zM39 31h6v5h-6z" fill="#2f5d50"/><path d="M6 48h52" stroke="#2f5d50" stroke-width="4" stroke-linecap="round"/></svg>';

function toggleDemoMenu(force) {
  const menu = $('#demo-menu');
  const open = typeof force === 'boolean' ? force : menu.hidden;
  menu.hidden = !open;
  $('#demo-chip').setAttribute('aria-expanded', String(open));
}
function demoMenu() {
  const act = (fn) => () => { toggleDemoMenu(false); fn(); };
  return h('div', { class: 'demo-menu', id: 'demo-menu', hidden: true },
    h('p', { class: 'small' }, 'La città vive solo in questo browser: gli altri abitanti sono finti e le email non partono davvero.'),
    h('span', { class: 'demo-actions' },
      h('button', { class: 'btn small', onclick: act(() => { store.addResidents(5); toast('Sono arrivati 5 nuovi abitanti'); }) }, '+5 abitanti'),
      h('button', { class: 'btn small', onclick: act(() => { if (!me()) return toast('Prima iscriviti: poi un vicino busserà alla tua porta.', 'err'); toast(store.knock() ? 'Qualcuno ha bussato: guarda la cassetta' : 'Hai già conosciuto tutti i vicini'); }) }, 'Fai bussare un vicino'),
      h('button', { class: 'btn small', onclick: act(openDemoInbox) }, 'Email finte'),
      h('button', { class: 'btn small', onclick: act(() => { store.reset(); ui.mode = 'browse'; closeSheet(); toast('Demo ripartita'); }) }, 'Ricomincia')));
}

// Banner del giornale: fa girare i titoli più recenti.
function renderTicker() {
  const city = store.city;
  const el = $('#ticker-text');
  if (!city || !el) return;
  const items = city.news.slice(0, 5);
  if (!items.length) return;
  ui.tick = ((ui.tick ?? -1) + 1) % items.length;
  const f = formatNews(items[ui.tick], city);
  el.classList.remove('in');
  void el.offsetWidth;
  el.textContent = f.title;
  el.classList.add('in');
}

function toggleNight() {
  ui.nightOverride = isNight() ? 'day' : 'night';
  ls.set('vi-night', ui.nightOverride);
  update();
}

// Ridisegna le parti fisse: contatore, barra in basso, avvisi.
function update() {
  const city = store.city;
  if (!city) return;
  const built = builtCount(city);
  $('#count').textContent = `${built} ${built === 1 ? 'abitante' : 'abitanti'} · ${city.openDistricts} ${city.openDistricts === 1 ? 'quartiere' : 'quartieri'}`;
  if (ui.newsTop !== city.news[0]?.id) { ui.newsTop = city.news[0]?.id; ui.tick = -1; renderTicker(); }
  const night = isNight();
  $('#btn-night').replaceChildren(icon(night ? 'sun' : 'moon'));
  $('#btn-night').setAttribute('aria-label', night ? 'Passa al giorno' : 'Passa alla notte');
  const mine = me();
  const incoming = mine ? city.requests.filter((q) => q.to === mine.id).length : 0;
  const badge = $('#mail-badge');
  badge.hidden = !incoming;
  badge.textContent = incoming;
  $('#btn-mail').hidden = !mine;
  $('#btn-tps').hidden = !(mine && map.t3 && !ui.room);
  // Borsellino: il saldo in alto, con un saltello quando entrano soldi
  const wallet = mine && city.residents[mine.id]?.anagrafe ? walletOf(city, mine.id) : null;
  $('#btn-wallet').hidden = wallet === null;
  document.body.classList.toggle('has-wallet', wallet !== null);
  if (wallet !== null) {
    $('#wallet-n').textContent = wallet;
    $('#btn-wallet').setAttribute('aria-label', `Il mio borsellino: ${soldi(wallet)}`);
    if (ui.wallet !== undefined && wallet > ui.wallet) { const b = $('#btn-wallet'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
    ui.wallet = wallet;
  }
  $('#btn-missions').hidden = !mine;
  if (mine && city.residents[mine.id]) watchProgress(city, mine.id);

  map.set({
    mode: ui.mode, meId: mine?.id || null, night, online: store.online,
    friends: new Set(mine ? friendsOf(city, mine.id) : []),
  });

  // Avviso email da confermare.
  const notice = $('#notice');
  const house = myHouse();
  if (mine && !mine.emailConfirmed) {
    const left = house ? Math.max(0, Math.ceil((house.reservedAt + RESERVE_MS - Date.now()) / 3600000)) : null;
    notice.hidden = false;
    notice.replaceChildren(
      h('span', { class: 'notice-ico' }, icon('mail')),
      h('div', { class: 'notice-text' }, h('strong', {}, 'Conferma la tua email'),
        h('span', {}, house ? ` per finire la casa: il cantiere resta tuo per altre ${left} ore.` : ` per diventare abitante a tutti gli effetti. L'abbiamo mandata a ${mine.email}.`)),
      h('div', { class: 'notice-actions' },
        DEMO ? h('button', { class: 'btn small primary', onclick: openDemoInbox }, 'Apri l\'email') : null,
        h('button', { class: 'btn small', onclick: (e) => run(e.currentTarget, async () => { const r = await store.resend(); devLinkToast(r); toast('Ti abbiamo mandato un nuovo link.'); }) }, 'Invia di nuovo')));
  } else notice.hidden = true;

  // Barra in basso (non si tocca mentre si sta scrivendo un messaggio).
  document.body.classList.toggle('in-room', !!ui.room);
  const bottom = $('#bottom');
  if (document.activeElement?.id === 'chat-input') return;
  if (ui.room) { bottom.replaceChildren(roomBar()); return; }
  if (ui.mode === 'choose') {
    bottom.replaceChildren(h('div', { class: 'bar choose' },
      h('span', { class: 'goal-ico' }, icon('pin')),
      h('div', { class: 'goal-body' }, h('strong', {}, 'Tocca un lotto libero'), h('span', { class: 'small' }, 'Quelli con il cartello "Libero" sono disponibili.')),
      h('button', { class: 'btn', onclick: () => { ui.mode = 'browse'; map.set({ selected: null }); update(); } }, 'Annulla')));
    return;
  }
  const g = goalProgress(built);
  const goal = h('button', { class: 'goal', onclick: () => openMuro(), 'aria-label': `${nextGoal(city, built)} Apri il Muro dei Fondatori` },
    h('span', { class: 'goal-ico' }, icon('fountain')),
    h('span', { class: 'goal-body' },
      h('span', { class: 'goal-head' }, h('span', { class: 'eyebrow' }, 'Prossimo traguardo'), h('span', { class: 'goal-num' }, `${built}/${g.target}`)),
      h('span', { class: 'goal-text' }, goalText(built, g.target)),
      h('span', { class: 'goal-track' }, h('span', { class: 'goal-fill', style: `width:${Math.round(g.ratio * 100)}%` }))));
  let cta;
  if (!mine) cta = h('button', { class: 'btn primary big', onclick: openRegister }, 'Vieni ad abitare qui');
  else if (!house && !registered()) cta = h('button', { class: 'btn primary big', onclick: goToComune }, icon('home'), 'Vai in Municipio');
  else if (!house) cta = h('button', { class: 'btn primary big', onclick: startChoosing }, 'Scegli il tuo lotto');
  else if (house.status === 'casa') cta = h('button', { class: 'btn primary big', onclick: () => enterHouse(mine.id) }, icon('home'), 'Entra in casa');
  else cta = h('button', { class: 'btn big', onclick: () => { map.focus(house.slot, 2); openHouse(house.slot); } }, icon('home'), 'La mia casa');
  const talk = mine && map.avatarOf(mine.id) ? chatBar() : null;
  bottom.replaceChildren(h('div', { class: 'bar' }, talk, goal, cta));
}

/* Terza persona: joystick e tasto azione ------------------------------------- */

// Il joystick sta in basso a sinistra, il tasto azione in basso a destra: il tasto cambia
// scritta secondo quello che c'è vicino (entrare, sedersi, salutare, leggere il giornale...).
function tpsUI() {
  const knob = h('span', { class: 'joy-knob' });
  const base = h('div', { class: 'joy', role: 'application', 'aria-label': 'Joystick: trascina per camminare' }, knob);
  let id = null, cx = 0, cy = 0;
  const R = 46;
  const move = (e) => {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    map.tpsInput(dx / R, dy / R);
  };
  const stop = () => { id = null; knob.style.transform = ''; map.tpsInput(0, 0); };
  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2; id = e.pointerId;
    base.setPointerCapture(id); move(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  base.addEventListener('pointerup', stop);
  base.addEventListener('pointercancel', stop);
  const act = h('button', { class: 'tps-act', id: 'tps-act', disabled: true, onclick: () => tpsDo() },
    h('span', { class: 'tps-act-ico', id: 'tps-act-ico' }, '✋'), h('span', { class: 'tps-act-label', id: 'tps-act-label' }, 'Avvicinati'));
  return h('div', { class: 'tps', id: 'tps', hidden: true },
    h('div', { class: 'tps-top' },
      h('button', { class: 'btn small tps-chip', onclick: () => openSheet('Parla e gesti', h('div', { class: 'stack' }, actionsRow(), chatBar())) }, icon('smile'), 'Parla'),
      h('button', { class: 'btn small tps-chip', onclick: () => toggleTPS(false) }, icon('map'), 'Vista dall\'alto')),
    base, act,
    h('p', { class: 'tps-hint small' }, 'Trascina lo schermo per girarti'));
}
function toggleTPS(on) {
  if (on) {
    if (!me()) return openRegister();
    if (ui.room) return toast('Esci prima dalla stanza.');
    if (!map.avatarOf(me().id)) syncAvatars();
    closeSheet();
    if (!map.setTPS(true)) return toast('Il tuo omino non è in città.', 'err');
  } else map.setTPS(false);
  ui.tps = !!on;
  document.body.classList.toggle('in-tps', ui.tps);
  $('#tps').hidden = !ui.tps;
  ls.set('vi-tps', ui.tps ? '1' : '');
  if (ui.tps) toast('Terza persona: joystick per camminare, tasto per interagire');
  update();
}
// La cosa più vicina con cui si può fare qualcosa
function tpsTarget() {
  const mine = me();
  const a = mine && map.avatarOf(mine.id);
  if (!a || ui.room) return null;
  const city = store.city;
  const px = a.x, py = a.y;
  const out = [];
  const add = (x, y, r, label, ico, run) => { const d = Math.hypot(x - px, y - py); if (d <= r) out.push({ d, label, ico, run }); };
  for (const o of map.visibleAvatars()) {
    if (o.me) continue;
    if (o.id.startsWith('npc:')) add(o.x, o.y, 1.6, o.name ? `Parla con ${o.name}` : 'Saluta', '👋', () => onNpcTap(o.id));
    else add(o.x, o.y, 1.6, `Saluta ${o.name}`, '👋', () => { doAct('saluta'); openSay(o.id); });
  }
  for (const sh of SHOPS) {
    const label = sh.kind === 'bar' ? 'Entra al bar' : sh.kind === 'comune' ? 'Entra in Municipio' : `Entra: ${sh.name.split(' ')[0]}`;
    add(sh.front[0], sh.front[1], 1.4, label, sh.kind === 'bar' ? '☕' : sh.kind === 'comune' ? '🏛️' : '🛍️', () => enterHouse(sh.room));
  }
  for (const hh of Object.values(city.houses)) {
    const [fx, fy] = frontOf(city, hh.slot);
    const own = hh.residentId === mine.id;
    const name = city.residents[hh.residentId]?.username || '';
    add(fx, fy, 1.3, own ? (hh.status === 'casa' ? 'Entra in casa' : 'Il tuo cantiere') : `Casa di ${name}`, '🏠', () => (own && hh.status === 'casa' ? enterHouse(mine.id) : openHouse(hh.slot)));
  }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = Math.round(px) + dx, y = Math.round(py) + dy;
    if (seatAt(city, null, x, y)) add(x, y, 1.2, 'Siediti', '🪑', () => sitOn(x, y));
  }
  const [ex, ey] = PIAZZA_DECOR.edicola;
  add(ex, ey + 1, 1.5, 'Leggi il giornale', '📰', () => openGiornale());
  if (!myHouse() && registered()) for (const k of PLAN.lots) {
    if (city.houses[k]) continue;
    const [lx, ly] = parseKey(k);
    if (Math.abs(lx - px) > 2 || Math.abs(ly - py) > 2 || districtAt(lx, ly) > city.openDistricts) continue;
    add(lx, ly, 1.6, 'Guarda questo lotto', '🪧', () => openLot(k));
  }
  out.sort((p, q) => p.d - q.d);
  return out[0] || null;
}
function tpsDo() { const t = tpsTarget(); if (t) t.run(); }
setInterval(() => {
  if (!ui.tps) return;
  const t = tpsTarget();
  const btn = $('#tps-act');
  if (!btn) return;
  btn.disabled = !t;
  $('#tps-act-ico').textContent = t ? t.ico : '✋';
  $('#tps-act-label').textContent = t ? t.label : 'Avvicinati';
}, 220);
// Da tastiera: WASD o frecce per camminare, E o spazio per interagire
{
  const keys = new Set();
  const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  const apply = () => {
    const jx = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0);
    const jy = (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - (keys.has('w') || keys.has('arrowup') ? 1 : 0);
    map?.tpsInput(jx, jy);
  };
  addEventListener('keydown', (e) => {
    if (!ui.tps || typing() || !$('#sheet').hidden) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { keys.add(k); apply(); e.preventDefault(); }
    else if (k === 'e' || k === ' ' || k === 'enter') { tpsDo(); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); if (ui.tps) apply(); });
}

/* Missioni, gesti, libro degli ospiti --------------------------------------- */

// Ad ogni aggiornamento: badge delle missioni, missioni appena completate, nuove firme in casa.
function watchProgress(city, id) {
  const st = missionStatus(city, id, Date.now());
  const ready = (st.welcomeReady ? 1 : 0) + (st.daily.done && !st.daily.claimed ? 1 : 0);
  const mb = $('#missions-badge');
  mb.hidden = !ready; mb.textContent = ready ? '!' : '';
  const done = new Set([...st.welcome.filter((m) => m.done).map((m) => 'w:' + m.id), ...(st.daily.done ? ['d:' + dayKey(Date.now())] : [])]);
  if (ui.missionsSeen && ui.missionsFor === id) {
    for (const k of done) {
      if (ui.missionsSeen.has(k)) continue;
      const label = k.startsWith('w:') ? st.welcome.find((m) => 'w:' + m.id === k).label : st.daily.label;
      toast(`Missione completata: ${label} ✓`);
    }
  }
  ui.missionsSeen = done; ui.missionsFor = id;
  const gb = city.guestbook?.[id] || [];
  const last = gb[gb.length - 1];
  if (ui.gbLast && last && last.at > ui.gbLast && ui.room !== id) toast(`${city.residents[last.by]?.username || 'Un vicino'} ha firmato il tuo libro degli ospiti${last.text ? `: “${last.text}”` : ''}`);
  ui.gbLast = last?.at || ui.gbLast || 1;
}
// Segna una volta al giorno una cosa fatta con l'omino (serve alle missioni).
function markOnce(what) {
  const mine = me();
  if (!mine || !store.city.residents[mine.id]) return;
  const t = progressOf(store.city, mine.id).marks[what];
  if (t && dayKey(t) === dayKey(Date.now())) return;
  store.op({ type: 'mark', what }).catch(() => {});
}
function openWallet() {
  const r = myResident();
  if (!r) return openLogin();
  const n = walletOf(store.city, r.id);
  const shopBtn = (id, label) => h('button', { class: 'btn small', onclick: () => { closeSheet(); goToShop(id); } }, label);
  openSheet('Il mio borsellino', h('div', { class: 'stack' },
    h('div', { class: 'purse' }, h('span', { class: 'purse-coin', html: coinSvg(72) }),
      h('div', {}, h('p', { class: 'eyebrow' }, `La moneta di ${CITY}`), h('p', { class: 'purse-n' }, soldi(n)))),
    h('p', { class: 'small' }, 'Il Soldo era una moneta dell\'Italia di una volta: da lui viene la parola "soldi".'),
    h('h3', {}, 'Come si guadagnano'),
    h('ul', { class: 'earn' },
      h('li', {}, coin(16), h('span', {}, h('strong', {}, `${INCOME.anagrafe}`), ' regalo del Comune, all\'iscrizione all\'anagrafe')),
      h('li', {}, coin(16), h('span', {}, h('strong', {}, `${INCOME.daily}–${dailyReward(99)}`), ' la missione del giorno (di più se la fai tanti giorni di fila)')),
      h('li', {}, coin(16), h('span', {}, h('strong', {}, `${INCOME.welcome}`), ' le missioni di benvenuto, tutte completate')),
      h('li', {}, coin(16), h('span', {}, h('strong', {}, `${INCOME.casaSettimana}`), ' la Casa della settimana, la più amata dai vicini')),
      h('li', {}, coin(16), h('span', {}, h('strong', {}, `fino a ${JOBS.bar.cap}`), ` a turno come barista al Bar Centrale (${JOBS.bar.shifts} turni al giorno)`)),
      h('li', { class: 'soon' }, '🛠️', h('span', {}, 'In arrivo: altri lavori in città (postino, giardiniere...)'))),
    h('button', { class: 'btn primary', onclick: () => { closeSheet(); goToShop('bar'); } }, '☕ Vai a lavorare al bar'),
    h('h3', {}, 'Dove si spendono'),
    h('div', { class: 'row-wrap' }, shopBtn('mobili', 'Mobilificio'), shopBtn('moda', 'Sartoria Moda'), shopBtn('bici', 'Ciclofficina'))));
}

function openMissions() {
  const mine = me();
  if (!mine) return openLogin();
  const city = store.city;
  const st = missionStatus(city, mine.id, Date.now());
  const claim = (what) => (e) => run(e.currentTarget, async () => {
    const r = await store.op({ type: 'claim', what });
    if (r.prize) toast(`Premio: ${furniById(r.prize).label} e ${soldi(r.soldi)}! La targa la trovi in casa, nel pannello Arreda.`);
    else toast(r.streak > 1 ? `+${soldi(r.soldi)}! Sono ${r.streak} giorni di fila 🔥` : `+${soldi(r.soldi)}! Torna domani per la prossima missione 🔥`);
    openMissions(); update();
  });
  const n = st.welcome.filter((m) => m.done).length;
  const welcome = st.welcomeClaimed ? null : h('section', { class: 'missions' },
    h('div', { class: 'missions-head' }, h('h3', {}, 'Benvenuto in città'), h('span', { class: 'tag' }, `${n}/${st.welcome.length}`)),
    h('ul', { class: 'mission-list' }, st.welcome.map((m) => h('li', { class: 'mission' + (m.done ? ' done' : '') },
      h('span', { class: 'mission-tick', 'aria-hidden': 'true' }, m.done ? '✓' : ''),
      h('span', { class: 'mission-body' }, h('strong', {}, m.label), m.done ? null : h('span', { class: 'small' }, m.hint))))),
    h('p', { class: 'small' }, `Premio finale: ${soldi(INCOME.welcome)} e la ${furniById(WELCOME_PRIZE).label.toLowerCase()} da mettere in casa, solo per chi le completa tutte.`),
    st.welcomeReady ? h('button', { class: 'btn primary big', onclick: claim('welcome') }, 'Ritira il premio') : null);
  const daily = h('section', { class: 'missions daily' },
    h('div', { class: 'missions-head' }, h('h3', {}, 'Missione del giorno'), h('span', { class: 'tag gold' }, `🔥 ${st.streak} ${st.streak === 1 ? 'giorno' : 'giorni'} di fila`)),
    h('div', { class: 'mission' + (st.daily.done ? ' done' : '') }, h('span', { class: 'mission-tick', 'aria-hidden': 'true' }, st.daily.done ? '✓' : ''), h('span', { class: 'mission-body' }, h('strong', {}, st.daily.label))),
    st.daily.claimed ? h('p', { class: 'small' }, 'Fatta! Domani ne arriva un\'altra: non perdere la serie.')
      : st.daily.done ? h('button', { class: 'btn primary', onclick: claim('daily') }, coin(18), `Ritira ${soldi(dailyReward(st.streak + 1))}`)
        : h('p', { class: 'small' }, `Premio: ${soldi(dailyReward(st.streak + 1))}. Ogni giorno una missione nuova, uguale per tutti: più giorni di fila, più soldi.`));
  openSheet('Missioni', h('div', { class: 'stack' }, welcome, daily, st.welcomeClaimed ? h('p', { class: 'small' }, 'Missioni di benvenuto completate: sei un abitante a tutti gli effetti!') : null));
}

// Gesti del proprio omino: li vedono tutti quelli che sono nello stesso posto.
function doAct(kind) {
  const mine = me();
  if (!mine || !map.avatarOf(mine.id)) return;
  map.act(mine.id, kind);
  store.act(kind);
  if (kind === 'saluta') markOnce('saluta');
  if (kind === 'balla') markOnce('balla');
}
function actionsRow() {
  const emoji = ['😄', '😂', '❤️', '👍', '😮', '🎉'];
  // Con un mezzo della Ciclofficina: si sale e si scende da qui (solo in città).
  const r = myResident();
  const rides = r && !ui.room ? invOf(store.city, r.id).rides || [] : [];
  const icons = { skate: '🛹', bici: '🚲', monopattino: '🛴' };
  const rideChips = rides.length ? [
    h('button', { class: 'chip' + (!r.ride ? ' on' : ''), onclick: () => setRide(null) }, '🚶 A piedi'),
    ...rides.map((id) => h('button', { class: 'chip' + (r.ride === id ? ' on' : ''), onclick: () => setRide(id) }, `${icons[id]} ${rideById(id).label.split(' ')[0]}`)),
  ] : [];
  return h('div', { class: 'acts', role: 'group', 'aria-label': 'Gesti e faccine' },
    rideChips,
    [['saluta', '👋 Saluta'], ['balla', '💃 Balla'], ['salta', '⤴️ Salta']].map(([k, label]) => h('button', { class: 'chip', onclick: () => doAct(k) }, label)),
    emoji.map((e) => h('button', { class: 'chip emoji', 'aria-label': `Faccina ${e}`, onclick: () => sayIt(e) }, e)));
}
async function setRide(id) {
  const ok = await run(null, async () => { await store.op({ type: 'ride', id }); return true; });
  if (ok) { syncAvatars(); update(); }
}
// Sedersi: si cammina fino alla seduta, poi ci si siede.
function sitOn(x, y, room = null) {
  const mine = me();
  if (!mine || !map.avatarOf(mine.id)) return false;
  if (!map.walk(mine.id, x, y, room)) return false;
  store.move(x, y, room);
  map.act(mine.id, 'siedi');
  store.act('siedi');
  if (!room) markOnce('panchina');
  return true;
}

function openGuestbook(ownerId) {
  const city = store.city;
  const owner = city.residents[ownerId];
  const mine = me();
  const mineHouse = mine && mine.id === ownerId;
  const list = [...(city.guestbook?.[ownerId] || [])].reverse();
  if (mineHouse) ls.set('vi-gb-seen', String(Date.now()));
  const today = dayKey(Date.now());
  const signed = mine && list.some((g) => g.by === mine.id && dayKey(g.at) === today);
  let text = '';
  const input = h('input', { class: 'chat-input', maxlength: SAY_MAX, placeholder: 'Un pensiero (facoltativo)', 'aria-label': 'Messaggio per il libro degli ospiti', oninput: (e) => { text = e.target.value; } });
  const form = !mine || mineHouse ? null : signed ? h('p', { class: 'small' }, 'Oggi hai già firmato. Ripassa domani!')
    : h('div', { class: 'stack' },
      h('div', { class: 'chips' }, ['Bella casa!', 'Che bel salotto', 'Torno presto!', 'Grazie dell\'ospitalità'].map((t) => h('button', { class: 'chip', onclick: () => { input.value = t; text = t; } }, t))),
      input,
      h('button', { class: 'btn primary', onclick: (e) => run(e.currentTarget, async () => { await store.op({ type: 'sign', owner: ownerId, text }); toast('Firma lasciata ✍️'); openGuestbook(ownerId); update(); }) }, '✍️ Firma il libro'));
  openSheet(`Libro degli ospiti${mineHouse ? '' : ` di ${owner?.username || ''}`}`, h('div', { class: 'stack' },
    form,
    list.length ? h('ol', { class: 'guestbook' }, list.map((g) => h('li', {},
      h('div', { class: 'gb-head' }, h('strong', {}, city.residents[g.by]?.username || 'Un ex abitante'), h('span', { class: 'small' }, fmtDay(g.at))),
      g.text ? h('p', {}, g.text) : null)))
      : h('p', { class: 'small' }, mineHouse ? 'Ancora nessuna firma: invita i vicini a passare!' : 'Nessuno ha ancora firmato: sii il primo!')));
}
async function toggleHeart(ownerId) {
  const r = await run(null, () => store.op({ type: 'heart', owner: ownerId }));
  if (r) toast(r.on ? `❤️ Cuore lasciato: questa casa ne ha ${r.n} questa settimana` : 'Cuore tolto');
  update();
}
// Le case con più cuori nella settimana (la prima diventa la Casa della settimana sul giornale).
function rankingBox(city) {
  const top = weekRanking(city, weekKey(Date.now())).slice(0, 5);
  if (!top.length) return h('section', { class: 'ranking' }, h('h3', {}, 'Casa della settimana'), h('p', { class: 'small' }, 'Ancora nessun cuore questa settimana. Entra nelle case dei vicini e lascia un ❤️ a quella che ti piace di più: lunedì il giornale annuncia la vincitrice.'));
  return h('section', { class: 'ranking' },
    h('h3', {}, 'Corsa alla Casa della settimana'),
    h('ol', {}, top.map((e, i) => {
      const house = residentHouse(city, e.id);
      return h('li', {}, h('button', { class: 'link-btn', onclick: () => { closeSheet(); map.focus(house.slot); openHouse(house.slot); } }, `${i + 1}. ${city.residents[e.id].username}`), h('span', {}, `❤️ ${e.n}`));
    })),
    h('p', { class: 'small' }, 'Lunedì il giornale annuncia la vincitrice.'));
}

// Cosa arriva al prossimo traguardo, detto in breve per la barra in basso.
function goalText(built, target) {
  const what = target === 25 ? 'l\'acqua nella fontana' : `quota ${target} abitanti`;
  const left = Math.max(0, target - built);
  return left ? `Ancora ${left} ${left === 1 ? 'abitante' : 'abitanti'} per ${what}` : 'Traguardo raggiunto!';
}

// Barra per parlare, come in Habbo: quello che scrivi compare in una nuvoletta sopra il tuo omino.
function chatBar() {
  const input = h('input', { id: 'chat-input', class: 'chat-input', maxlength: SAY_MAX, placeholder: 'Scrivi qualcosa…', autocomplete: 'off', enterkeyhint: 'send', 'aria-label': 'Messaggio da dire' });
  const toggle = h('button', { class: 'btn small icon-btn' + (ui.actsOpen ? ' on' : ''), type: 'button', 'aria-expanded': String(!!ui.actsOpen), 'aria-label': 'Gesti e faccine', onclick: () => { ui.actsOpen = !ui.actsOpen; update(); } }, icon('smile'));
  const form = h('form', { class: 'chat', onsubmit: (e) => { e.preventDefault(); sayIt(input.value).then((ok) => { if (ok) input.value = ''; }); } },
    toggle, input, h('button', { class: 'btn small primary', type: 'submit' }, 'Di\''));
  if (ui.chatDraft) input.value = ui.chatDraft;
  input.addEventListener('input', () => { ui.chatDraft = input.value; });
  return ui.actsOpen ? h('div', { class: 'chat-wrap' }, actionsRow(), form) : form;
}
async function sayIt(text) {
  const ok = await run(null, async () => { await store.say(text); return true; });
  if (ok) { ui.chatDraft = ''; map.say(me().id, String(text).replace(/\s+/g, ' ').trim()); markOnce('saluta'); }
  return !!ok;
}
// Toccando un omino: salutalo con una frase pronta, o vai a casa sua.
function openSay(id) {
  const city = store.city;
  const r = city.residents[id];
  if (!r) return;
  const mine = me();
  const self = mine && mine.id === id;
  const house = residentHouse(city, id);
  const canTalk = mine && map.avatarOf(mine.id);
  openSheet(self ? 'Di\' qualcosa' : r.username, h('div', { class: 'stack' },
    self ? h('p', { class: 'small' }, 'Tocca una frase: comparirà in una nuvoletta sopra la tua testa, la vedono tutti quelli in città.')
      : h('p', { class: 'small' }, `${r.username} è in città adesso.${r.bio ? ` “${r.bio}”` : ''}`),
    canTalk ? h('div', { class: 'chips' }, SAY_PRESETS.map((t) => h('button', { class: 'chip', onclick: async () => { if (await sayIt(t)) closeSheet(); } }, t))) : h('button', { class: 'btn primary', onclick: openRegister }, 'Iscriviti per salutare'),
    !self && house ? h('button', { class: 'btn', onclick: () => { closeSheet(); map.focus(house.slot); openHouse(house.slot); } }, icon('home'), 'Vedi la sua casa') : null));
}

function devLinkToast(r) {
  if (r?.devLink) console.info('Link email (sviluppo):', r.devLink);
}

/* Schede ----------------------------------------------------------------- */

function openSheet(title, body, { wide = false, onClose } = {}) {
  const sheet = $('#sheet');
  ui.sheet = { onClose };
  sheet.className = 'sheet' + (wide ? ' wide' : '');
  sheet.replaceChildren(
    h('div', { class: 'sheet-grab', 'aria-hidden': 'true' }),
    h('div', { class: 'sheet-head' },
      h('h2', { id: 'sheet-title' }, title),
      h('button', { class: 'round small ghost', onclick: closeSheet, 'aria-label': 'Chiudi' }, icon('x'))),
    h('div', { class: 'sheet-body' }, body));
  sheet.setAttribute('aria-labelledby', 'sheet-title');
  sheet.hidden = false;
  $('#scrim').hidden = false;
  sheet.scrollTop = 0;
  const first = sheet.querySelector('input, textarea');
  if (first && matchMedia('(pointer: fine)').matches) first.focus();
}
function closeSheet() {
  const s = ui.sheet;
  ui.sheet = null;
  $('#sheet').hidden = true;
  $('#scrim').hidden = true;
  if (ui.mode !== 'choose') map?.set({ selected: null });
  s?.onClose?.();
}
addEventListener('keydown', (e) => { if (e.key === 'Escape' && ui.sheet) closeSheet(); });

const field = (label, input, hint) => h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), input, hint ? h('span', { class: 'field-hint' }, hint) : null);
const formError = () => h('p', { class: 'form-error', role: 'alert', hidden: true });
function showError(el, e) { el.textContent = errText(e); el.hidden = false; }

/* Benvenuto e iscrizione -------------------------------------------------- */

function openWelcome() {
  const built = builtCount(store.city);
  openSheet('', h('div', { class: 'welcome' },
    h('p', { class: 'eyebrow' }, `${PAPER} presenta`),
    h('h1', { class: 'welcome-title' }, 'Benvenuto a ', h('span', {}, CITY)),
    h('p', { class: 'lead' }, 'Una città che cresce con chi ci abita. Scegli un lotto, costruisci la tua casa e bussa alla porta dei vicini.'),
    DEMO ? h('p', { class: 'small' }, 'Questa è una demo: la città vive solo in questo browser, gli altri abitanti sono finti e le email non partono davvero.') : null,
    h('ul', { class: 'facts' },
      h('li', {}, h('strong', {}, built), built === 1 ? ' abitante' : ' abitanti'),
      h('li', {}, h('strong', {}, Math.max(0, FOUNDERS - built)), ' posti da Fondatore'),
      h('li', {}, h('strong', {}, lotsOpen(store.city.openDistricts) - Object.keys(store.city.houses).length), ' lotti liberi')),
    h('div', { class: 'stack' },
      h('button', { class: 'btn primary big', onclick: openRegister }, 'Vieni ad abitare qui'),
      h('button', { class: 'btn', onclick: openLogin }, 'Ho già una casa: accedi'),
      h('button', { class: 'btn ghost', onclick: closeSheet }, 'Prima voglio guardare la città'))),
    { onClose: () => { ui.welcomeSeen = true; ls.set('vi-welcome', '1'); } });
}

function openRegister() {
  const started = Date.now();
  const err = formError();
  const userHint = h('span', { class: 'field-hint' }, 'Da 3 a 20 caratteri: lettere, numeri, punto o trattino basso. Sarà scritto davanti alla tua casa.');
  const form = h('form', { class: 'form', novalidate: true },
    field('Email', h('input', { id: 'reg-email', name: 'email', type: 'email', autocomplete: 'email', required: true, inputmode: 'email' }), 'Serve per confermare la casa e recuperare la password. Nessuno la vedrà.'),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Nome utente'),
      h('input', { id: 'reg-user', name: 'username', autocomplete: 'username', required: true, maxlength: 20, autocapitalize: 'off', spellcheck: 'false' }), userHint),
    field('Password', h('input', { id: 'reg-pass', name: 'password', type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }), 'Almeno 8 caratteri.'),
    h('input', { class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' }),
    h('label', { class: 'check' }, h('input', { id: 'reg-accept', type: 'checkbox', name: 'accept' }),
      h('span', {}, 'Accetto il ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); openRules(openRegister); } }, 'regolamento e l\'informativa privacy'), '.')),
    h('label', { class: 'check' }, h('input', { id: 'reg-adult', type: 'checkbox', name: 'adult' }), h('span', {}, 'Ho almeno 14 anni.')),
    err,
    h('button', { class: 'btn primary big', type: 'submit' }, 'Crea il mio account'),
    h('p', { class: 'small center' }, 'Hai già una casa? ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); openLogin(); } }, 'Accedi')));
  form.username.addEventListener('input', () => {
    userHint.classList.remove('bad');
    const v = form.username.value.trim();
    if (!v) return;
    const taken = Object.values(store.city.residents).some((r) => r.username.toLowerCase() === v.toLowerCase());
    if (taken) { userHint.textContent = 'Questo nome utente è già preso.'; userHint.classList.add('bad'); } else userHint.textContent = `Davanti alla tua casa ci sarà scritto “${v}”.`;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    err.hidden = true;
    const btn = form.querySelector('[type=submit]');
    run(btn, async () => {
      try {
        const r = await store.register({
          email: form.email.value, username: form.username.value.trim(), password: form.password.value,
          accept: form.accept.checked, adult: form.adult.checked, website: form.website.value,
          elapsed: Date.now() - started, source: ss.get('vi-source') || 'diretto',
        });
        devLinkToast(r);
        closeSheet();
        toast(`Account creato. Prima tappa: il Municipio, per l'iscrizione all'anagrafe.`);
        goToComune();
      } catch (ex) { showError(err, ex); }
    });
  });
  openSheet('Vieni ad abitare qui', form);
}

function openLogin() {
  const err = formError();
  const form = h('form', { class: 'form', novalidate: true },
    field('Email o nome utente', h('input', { id: 'login-id', name: 'login', autocomplete: 'username', required: true, autocapitalize: 'off' })),
    field('Password', h('input', { id: 'login-pass', name: 'password', type: 'password', autocomplete: 'current-password', required: true })),
    err,
    h('button', { class: 'btn primary big', type: 'submit' }, 'Entra'),
    h('p', { class: 'small center' },
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); openResetRequest(); } }, 'Password dimenticata?'), ' · ',
      h('a', { href: '#', onclick: (e) => { e.preventDefault(); openRegister(); } }, 'Non hai ancora una casa?')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    err.hidden = true;
    run(form.querySelector('[type=submit]'), async () => {
      try {
        await store.login(form.login.value, form.password.value);
        closeSheet();
        toast(`Bentornato, ${me().username}`);
        const house = myHouse();
        if (house) map.focus(house.slot, 1.8);
      } catch (ex) { showError(err, ex); }
    });
  });
  openSheet('Accedi', form);
}

function openResetRequest() {
  const err = formError();
  const form = h('form', { class: 'form', novalidate: true },
    h('p', {}, 'Scrivi l\'email con cui ti sei iscritto: ti mandiamo un link per scegliere una nuova password.'),
    field('Email', h('input', { id: 'reset-email', name: 'email', type: 'email', autocomplete: 'email', required: true })),
    err,
    h('button', { class: 'btn primary big', type: 'submit' }, 'Mandami il link'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    run(form.querySelector('[type=submit]'), async () => {
      try {
        const r = await store.requestReset(form.email.value);
        devLinkToast(r);
        closeSheet();
        toast('Se l\'email è registrata, ti è arrivato il link (controlla anche lo spam).');
        if (DEMO && r.devToken) openDemoInbox();
      } catch (ex) { showError(err, ex); }
    });
  });
  openSheet('Nuova password', form);
}

function openResetForm(token) {
  const err = formError();
  const form = h('form', { class: 'form', novalidate: true },
    field('Nuova password', h('input', { id: 'reset-pass', name: 'password', type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }), 'Almeno 8 caratteri.'),
    err,
    h('button', { class: 'btn primary big', type: 'submit' }, 'Salva la password'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    run(form.querySelector('[type=submit]'), async () => {
      try { await store.resetPassword(token, form.password.value); closeSheet(); toast('Password cambiata: sei dentro.'); } catch (ex) { showError(err, ex); }
    });
  });
  openSheet('Scegli una nuova password', form);
}

async function confirmEmail(token) {
  const r = await run(null, () => store.confirm(token));
  if (!r) return;
  closeSheet();
  const house = myHouse();
  if (house) { map.focus(house.slot, 2); toast(`Email confermata: sei l'abitante n°${r.number}. La tua casa è finita!`); }
  else { toast(`Email confermata: sei l'abitante n°${r.number}. Ora scegli il tuo lotto.`); startChoosing(); }
}

/* Lotti e costruzione -------------------------------------------------------- */

function startChoosing() {
  if (!me()) return openRegister();
  if (myHouse()) return toast('Hai già una casa a Virtual-Italy.');
  if (!registered()) { toast('Prima passa in Municipio per l\'iscrizione all\'anagrafe.'); return goToComune(); }
  closeSheet();
  ui.mode = 'choose';
  map.fitCentro({ wide: true });
  update();
}

function neighbours(slot, radius = 3) {
  const [x, y] = parseKey(slot);
  return Object.values(store.city.houses).filter((hh) => {
    const [hx, hy] = parseKey(hh.slot);
    return hh.slot !== slot && Math.abs(hx - x) <= radius && Math.abs(hy - y) <= radius;
  }).map((hh) => store.city.residents[hh.residentId]).filter(Boolean);
}

function openLot(slot) {
  map.set({ selected: slot });
  const d = districtById(districtAt(...parseKey(slot)));
  const near = neighbours(slot);
  const canBuild = me() && !myHouse();
  openSheet(`Lotto libero · ${d.name}`, h('div', { class: 'stack' },
    h('p', {}, near.length ? 'I tuoi vicini sarebbero:' : 'Qui intorno non abita ancora nessuno: saresti il primo della via.'),
    near.length ? h('ul', { class: 'chips' }, near.slice(0, 12).map((r) => h('li', { class: 'chip' }, r.username))) : null,
    canBuild ? h('button', { class: 'btn primary big', onclick: () => openBuild(slot) }, 'Costruisci qui')
      : !me() ? h('button', { class: 'btn primary big', onclick: openRegister }, 'Iscriviti per costruire qui')
        : h('p', { class: 'small' }, 'Hai già una casa: questo lotto resta per un nuovo abitante.')),
    { onClose: () => { if (ui.mode !== 'choose') map.set({ selected: null }); } });
}

function swatches(name, list, value, onPick, colorOf) {
  return h('div', { class: 'swatches', role: 'radiogroup' }, list.map((o) => h('button', {
    type: 'button', class: 'swatch' + (o.id === value ? ' on' : '') + (colorOf ? ' color' : ''), role: 'radio', 'aria-checked': String(o.id === value),
    'aria-label': o.label, title: o.label, style: colorOf ? `--sw:${o.color}` : null,
    onclick: () => onPick(o.id),
  }, colorOf ? null : o.label)));
}

function openBuild(slot, { restyle = false } = {}) {
  const current = restyle ? myHouse().style : makeStyle(slot);
  const choice = { roof: current.roof, door: current.door, garden: current.garden, deco: current.deco };
  const preview = h('canvas', { class: 'preview', width: 640, height: 480, 'aria-label': 'Anteprima della casa' });
  const groups = h('div', { class: 'stack' });
  const paint = () => {
    drawPreview(preview, makeStyle(slot, choice));
    groups.replaceChildren(
      h('div', {}, h('p', { class: 'field-label' }, 'Tetto'), swatches('roof', ROOFS, choice.roof, (v) => { choice.roof = v; paint(); }, true)),
      h('div', {}, h('p', { class: 'field-label' }, 'Porta'), swatches('door', DOORS, choice.door, (v) => { choice.door = v; paint(); }, true)),
      h('div', {}, h('p', { class: 'field-label' }, 'Giardino'), swatches('garden', GARDENS, choice.garden, (v) => { choice.garden = v; paint(); })),
      h('div', {}, h('p', { class: 'field-label' }, 'Davanti casa'), swatches('deco', DECOS, choice.deco, (v) => { choice.deco = v; paint(); })));
  };
  paint();
  const d = districtById(districtAt(...parseKey(slot)));
  const btn = h('button', { class: 'btn primary big', onclick: (e) => run(e.currentTarget, async () => {
    if (restyle) {
      await store.op({ type: 'restyle', style: choice });
      closeSheet();
      toast('Casa rinnovata');
      return;
    }
    const r = await store.op({ type: 'chooseSlot', slot, style: choice });
    ui.mode = 'browse';
    closeSheet();
    map.focus(slot, 2);
    if (map.avatarOf(me().id)) walkTo(...frontOf(store.city, slot));
    if (r.status === 'casa') toast(`Benvenuto a ${CITY}, abitante n°${myResident().number}!`);
    else toast('Cantiere aperto! Conferma l\'email per finire la casa.');
    update();
  }) }, restyle ? 'Salva le modifiche' : 'Costruisci la casa');
  openSheet(restyle ? 'Rinnova la casa' : 'La tua casa', h('div', { class: 'build' },
    h('div', { class: 'build-preview' }, preview, h('p', { class: 'small' }, `Le forme e i muri seguono lo stile del quartiere ${d.name}.`)),
    h('div', { class: 'stack' }, groups, btn)), { wide: true });
}

/* Editor del personaggio ------------------------------------------------- */

const registered = () => !!myResident()?.anagrafe;
// Cosa cambia passando da uomo a donna (e viceversa): pettinatura, barba, rossetto, vestito.
function switchGender(look, g) {
  if (look.gender === g) return;
  look.gender = g;
  const st = LOOK.style.find((o) => o.id === look.style);
  if (st && st.g !== g && st.g !== 'tutti') look.style = LOOK.style.find((o) => o.g === g).id;
  if (g === 'donna') look.beard = 'nessuno';
  else { look.lips = 'naturale'; if (look.top === 'vestito') look.top = 'maglietta'; if (look.bottom === 'gonna') look.bottom = 'pantaloni'; }
}
// Editor a schede con il palco 3D in alto: si gira col dito, l'omino saluta a ogni cambio.
// mode: 'look' (dal profilo) o 'anagrafe' (in Municipio, la prima volta).
function openCharacter({ first = false, anagrafe = false, onDone = null } = {}) {
  const r = myResident();
  if (!r) return openLogin();
  const look = cleanLook(r.look, r.username);
  const preview = h('canvas', { class: 'avatar-stage', width: 360, height: 420, 'aria-label': 'Il tuo personaggio: trascina per girarlo' });
  const groups = h('div', { class: 'stack' });
  let tab = ui.charTab || 'corpo';
  const owned = (slot) => WEAR.filter((w) => w.slot === slot && ownsWear(store.city, r.id, w.id) && (w.id !== 'vestito' || look.gender === 'donna' || look.top === 'vestito'));
  const colorRow = (label, key, list) => h('div', {}, h('p', { class: 'field-label' }, label),
    h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': label }, list.map((c, i) => h('button', {
      type: 'button', class: 'swatch color' + (look[key] === i ? ' on' : ''), style: `--sw:${c}`, role: 'radio',
      'aria-checked': String(look[key] === i), 'aria-label': `${label} ${i + 1}`, onclick: () => { look[key] = i; paint(); },
    }))));
  const idRow = (label, key, list) => h('div', {}, h('p', { class: 'field-label' }, label),
    h('div', { class: 'swatches', role: 'radiogroup', 'aria-label': label }, list.map((o) => h('button', {
      type: 'button', class: 'swatch' + (look[key] === o.id ? ' on' : ''), role: 'radio', 'aria-checked': String(look[key] === o.id),
      onclick: () => { look[key] = o.id; paint(); },
    }, o.label))));
  const genderRow = () => h('div', { class: 'gender-pick', role: 'radiogroup', 'aria-label': 'Uomo o donna' }, LOOK.gender.map((o) => h('button', {
    type: 'button', class: 'gender' + (look.gender === o.id ? ' on' : ''), role: 'radio', 'aria-checked': String(look.gender === o.id),
    onclick: () => { switchGender(look, o.id); paint(); },
  }, h('span', { class: 'gender-ico', 'aria-hidden': 'true' }, o.id === 'uomo' ? '♂' : '♀'), o.label)));
  const TABS = [{ id: 'corpo', label: 'Corpo' }, { id: 'capelli', label: 'Capelli e viso' }, { id: 'vestiti', label: 'Vestiti' }, { id: 'accessori', label: 'Accessori' }];
  const paint = () => {
    drawAvatarPreview(preview, avatarLook(r.username, look));
    const tabs = h('div', { class: 'seg', role: 'tablist' }, TABS.map((o) => h('button', { class: 'seg-btn' + (tab === o.id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === o.id), onclick: () => { tab = ui.charTab = o.id; paint(); } }, o.label)));
    let body;
    if (tab === 'corpo') body = [genderRow(), colorRow('Carnagione', 'skin', LOOK.skin), colorRow('Colore degli occhi', 'eyes', LOOK.eyes)];
    else if (tab === 'capelli') {
      const mineFirst = [...LOOK.style.filter((o) => o.g === look.gender || o.g === 'tutti'), ...LOOK.style.filter((o) => o.g !== look.gender && o.g !== 'tutti')];
      body = [idRow('Pettinatura', 'style', mineFirst), colorRow('Colore dei capelli', 'hair', LOOK.hair),
        look.gender === 'uomo' ? idRow('Barba e baffi', 'beard', LOOK.beard) : idRow('Rossetto', 'lips', LOOK.lips)];
    } else if (tab === 'vestiti') {
      body = [idRow('Maglia', 'top', owned('top')), colorRow(look.top === 'vestito' ? 'Colore del vestito' : 'Colore della maglia', 'shirt', LOOK.shirt),
        look.top === 'vestito' ? null : idRow('Sotto', 'bottom', owned('bottom')),
        look.top === 'vestito' ? null : colorRow('Colore di pantaloni e gonne', 'pants', LOOK.pants),
        colorRow('Scarpe', 'shoes', LOOK.shoes)];
    } else {
      body = [idRow('Accessorio', 'extra', owned('extra')),
        WEAR.some((w) => !ownsWear(store.city, r.id, w.id)) ? h('p', { class: 'small' }, 'Cappelli, cuffie, sciarpe e altri capi ti aspettano alla Sartoria Moda, accanto alla piazza.') : null];
    }
    groups.replaceChildren(tabs, ...body.filter(Boolean));
  };
  const shuffle = () => {
    const pick = (n) => Math.floor(Math.random() * n);
    const any = (list) => list[pick(list.length)].id;
    const styles = LOOK.style.filter((o) => o.g === look.gender || o.g === 'tutti');
    Object.assign(look, { skin: pick(LOOK.skin.length), eyes: pick(LOOK.eyes.length), hair: pick(LOOK.hair.length), style: any(styles),
      shirt: pick(LOOK.shirt.length), pants: pick(LOOK.pants.length), shoes: pick(LOOK.shoes.length), extra: any(owned('extra')), top: any(owned('top')), bottom: any(owned('bottom')),
      beard: look.gender === 'uomo' ? any(LOOK.beard) : 'nessuno', lips: look.gender === 'donna' ? any(LOOK.lips) : 'naturale' });
    paint();
  };
  paint();
  const label = anagrafe ? 'Avanti: la carta d\'identità' : first ? 'Avanti: scegli il lotto' : 'Salva il personaggio';
  const save = h('button', { class: 'btn primary big', onclick: (e) => run(e.currentTarget, async () => {
    await store.op({ type: anagrafe ? 'anagrafe' : 'look', look });
    if (onDone) return onDone();
    if (first) { toast('Che stile! Ora scegli dove costruire casa.'); startChoosing(); }
    else { closeSheet(); toast('Personaggio aggiornato'); }
  }) }, label);
  openSheet(anagrafe ? 'Ufficio anagrafe · Come sei?' : first ? 'Come sei?' : 'Il mio personaggio', h('div', { class: 'char-editor' },
    h('div', { class: 'char-stage' }, preview,
      h('div', { class: 'char-stage-bar' },
        h('span', { class: 'small' }, anagrafe ? `${r.username}, così ti vedranno in città.` : 'Trascina per girarlo.'),
        h('button', { class: 'btn small', onclick: shuffle }, '🎲 A caso'))),
    h('div', { class: 'stack' }, groups, save)), { wide: true });
}

/* Municipio: ufficio anagrafe ---------------------------------------------- */

// La prima volta in città: si va in Municipio, ci si iscrive all'anagrafe (scegliendo il proprio
// aspetto) e si ritira la carta d'identità. Solo dopo si può scegliere il lotto.
function goToComune() {
  const sh = shopById(COMUNE);
  if (ui.room === sh.room) return openAnagrafe();
  if (ui.room) exitHouse();
  closeSheet();
  map.focus([sh.x0 + 2, sh.y0 + 2]);
  if (me() && map.avatarOf(me().id)) walkTo(...sh.front);
  setTimeout(() => enterHouse(sh.room), me() && map.avatarOf(me().id) ? 1400 : 0);
}
function openAnagrafe() {
  const r = myResident();
  if (!r) return openRegister();
  if (r.anagrafe) return openCarta();
  openSheet('Ufficio anagrafe', h('div', { class: 'stack' },
    h('p', { class: 'eyebrow' }, `Comune di ${CITY}`),
    h('p', { class: 'lead' }, `Benvenuto, ${r.username}! Per diventare cittadino di ${CITY} serve l'iscrizione all'anagrafe.`),
    h('ol', { class: 'steps' },
      h('li', {}, h('strong', {}, 'Come sei: '), 'uomo o donna, viso, capelli e vestiti.'),
      h('li', {}, h('strong', {}, 'La carta d\'identità: '), 'con la tua foto e il numero di cittadino.'),
      h('li', {}, h('strong', {}, 'Il lotto: '), 'poi scegli dove costruire casa.')),
    h('button', { class: 'btn primary big', onclick: () => openCharacter({ anagrafe: true, onDone: () => openCarta({ fresh: true }) }) }, 'Inizia l\'iscrizione')));
}
// La carta d'identità con il ritratto 3D.
function openCarta({ fresh = false } = {}) {
  const r = myResident();
  if (!r) return;
  const photo = h('canvas', { class: 'id-photo', width: 180, height: 220, 'aria-label': `Foto di ${r.username}` });
  try { drawAvatarBust(photo, avatarLook(r.username, r.look)); } catch { /* senza foto */ }
  const look = cleanLook(r.look, r.username);
  const date = new Date(r.anagrafe || Date.now()).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const house = myHouse();
  openSheet('Carta d\'identità', h('div', { class: 'stack' },
    h('div', { class: 'id-card' },
      h('div', { class: 'id-top' }, h('span', {}, 'REPUBBLICA DI'), h('strong', {}, CITY.toUpperCase()), h('span', {}, 'Carta d\'identità')),
      h('div', { class: 'id-body' }, photo,
        h('dl', { class: 'id-data' },
          h('dt', {}, 'Nome'), h('dd', {}, r.username),
          h('dt', {}, 'Cittadino n°'), h('dd', {}, r.number ? String(r.number) : 'dopo la conferma email'),
          h('dt', {}, 'Sesso'), h('dd', {}, look.gender === 'donna' ? 'F' : 'M'),
          h('dt', {}, 'Iscritto il'), h('dd', {}, date),
          h('dt', {}, 'Residenza'), h('dd', {}, house ? `${districtById(districtAt(...parseKey(house.slot))).name}` : 'da scegliere'))),
      h('div', { class: 'id-sign' }, h('span', {}, 'Firma'), h('em', {}, r.username))),
    fresh ? h('div', { class: 'gift' }, coin(34), h('p', {}, h('strong', {}, `Il Comune ti regala ${soldi(INCOME.anagrafe)}!`), ' Sono nel tuo borsellino, in alto. Ora scegli il lotto dove costruire la tua casa.')) : null,
    !house ? h('button', { class: 'btn primary big', onclick: () => { if (ui.room) exitHouse(); startChoosing(); } }, 'Scegli il tuo lotto')
      : h('button', { class: 'btn', onclick: () => openCharacter() }, 'Cambia aspetto')));
}

/* Case e abitanti -------------------------------------------------------- */

function openHouse(slot) {
  const city = store.city;
  const house = city.houses[slot];
  const r = house && city.residents[house.residentId];
  if (!r) return;
  map.set({ selected: slot });
  const mine = me();
  const isMe = mine && mine.id === r.id;
  const d = districtById(districtAt(...parseKey(slot)));
  const badges = h('div', { class: 'badges' },
    r.number ? h('span', { class: 'tag' }, `Abitante n°${r.number}`) : null,
    isFounder(r) ? h('span', { class: 'tag gold' }, 'Fondatore') : null,
    house.status === 'cantiere' ? h('span', { class: 'tag warn' }, 'Cantiere') : null,
    store.online.has(r.id) ? h('span', { class: 'tag live' }, 'In città ora') : null,
    city.news.some((n) => n.kind === 'casaSettimana' && n.residentId === r.id && weekKey(n.at) === weekKey(Date.now())) ? h('span', { class: 'tag gold' }, '🏆 Casa della settimana') : null,
    heartsThisWeek(city, r.id, Date.now()) ? h('span', { class: 'tag' }, `❤️ ${heartsThisWeek(city, r.id, Date.now())} questa settimana`) : null,
    (() => { const st = missionStatus(city, r.id, Date.now()).streak; return st > 1 ? h('span', { class: 'tag' }, `🔥 ${st} giorni di fila`) : null; })(),
    r.suspended ? h('span', { class: 'tag warn' }, 'Sospeso') : null);
  const facts = h('dl', { class: 'facts-list' },
    h('div', {}, h('dt', {}, 'Quartiere'), h('dd', {}, d.name)),
    h('div', {}, h('dt', {}, 'Arrivato il'), h('dd', {}, fmtDate(house.builtAt || house.reservedAt))),
    r.instagram ? h('div', {}, h('dt', {}, 'Instagram'), h('dd', {}, h('a', { href: `https://instagram.com/${r.instagram}`, target: '_blank', rel: 'noopener noreferrer' }, '@' + r.instagram))) : null);
  const actions = h('div', { class: 'stack' });
  if (house.status === 'casa' && mine && (isMe || canVisit(city, mine.id, r.id))) {
    actions.append(h('button', { class: 'btn primary', onclick: () => enterHouse(r.id) }, icon('home'), isMe ? 'Entra in casa' : `Entra da ${r.username}`));
  } else if (house.status === 'casa' && mine && !isMe) {
    actions.append(h('p', { class: 'small' }, roomOf(city, r.id).access === 'amici' ? 'Fa entrare solo gli amici.' : 'In questo momento non fa entrare visite.'));
  }
  if (isMe) {
    actions.append(
      h('button', { class: 'btn', onclick: () => openBuild(slot, { restyle: true }) }, 'Rinnova la casa'),
      h('button', { class: 'btn', onclick: openProfile }, 'Modifica il profilo'));
  } else if (!mine) {
    actions.append(h('button', { class: 'btn primary', onclick: openRegister }, 'Iscriviti per bussare alla porta'));
  } else {
    const out = city.requests.find((q) => q.from === mine.id && q.to === r.id);
    const inc = city.requests.find((q) => q.to === mine.id && q.from === r.id);
    if (areFriends(city, mine.id, r.id)) {
      actions.append(h('p', { class: 'friends-line' }, `Tu e ${r.username} siete amici.`),
        h('button', { class: 'btn ghost small', onclick: (e) => run(e.currentTarget, async () => { await store.op({ type: 'unfriend', id: r.id }); openHouse(slot); }) }, 'Rimuovi amicizia'));
    } else if (inc) {
      actions.append(h('button', { class: 'btn primary', onclick: (e) => run(e.currentTarget, async () => { await store.op({ type: 'friendRespond', id: inc.id, accept: true }); toast(`Ora tu e ${r.username} siete amici`); openHouse(slot); }) }, `${r.username} ha bussato: apri la porta`));
    } else if (out) {
      actions.append(h('button', { class: 'btn', disabled: true }, 'Hai bussato: aspetta la risposta'));
    } else {
      actions.append(h('button', { class: 'btn primary', onclick: (e) => run(e.currentTarget, async () => {
        const res = await store.op({ type: 'friendRequest', to: r.id });
        toast(res.friends ? `Avevate bussato entrambi: ora siete amici!` : `Hai bussato alla porta di ${r.username}`);
        openHouse(slot);
      }) }, 'Bussa alla porta'));
    }
    actions.append(h('button', { class: 'link-btn', onclick: () => openReport(r) }, 'Segnala questo abitante'));
  }
  openSheet(r.username, h('div', { class: 'stack' },
    badges,
    r.bio ? h('p', { class: 'bio' }, `“${r.bio}”`) : isMe ? h('p', { class: 'small' }, 'Aggiungi una frase di presentazione dal tuo profilo.') : null,
    facts, actions));
}

function openReport(r) {
  const err = formError();
  const form = h('form', { class: 'form', novalidate: true },
    h('p', {}, `La redazione leggerà la segnalazione su ${r.username}. Chi viene segnalato non saprà chi l'ha fatto.`),
    field('Motivo', h('textarea', { id: 'report-reason', name: 'reason', rows: 3, maxlength: 300, required: true })),
    err,
    h('button', { class: 'btn primary', type: 'submit' }, 'Invia la segnalazione'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    run(form.querySelector('[type=submit]'), async () => {
      try { await store.op({ type: 'report', target: r.id, reason: form.reason.value }); closeSheet(); toast('Segnalazione inviata alla redazione'); } catch (ex) { showError(err, ex); }
    });
  });
  openSheet('Segnala', form);
}

function openMailbox() {
  const city = store.city;
  const mine = me();
  if (!mine) return openLogin();
  const name = (id) => city.residents[id]?.username || 'ex abitante';
  const goTo = (id) => { const hs = residentHouse(city, id); if (hs) { closeSheet(); map.focus(hs.slot, 2); openHouse(hs.slot); } };
  const incoming = city.requests.filter((q) => q.to === mine.id);
  const outgoing = city.requests.filter((q) => q.from === mine.id);
  const friends = friendsOf(city, mine.id);
  const respond = (q, accept) => async (e) => {
    await run(e.currentTarget, async () => { await store.op({ type: 'friendRespond', id: q.id, accept }); toast(accept ? `Ora tu e ${name(q.from)} siete amici` : 'Richiesta rifiutata'); openMailbox(); });
  };
  openSheet('Cassetta delle lettere', h('div', { class: 'stack' },
    h('h3', {}, 'Hanno bussato alla tua porta'),
    incoming.length ? h('ul', { class: 'rows' }, incoming.map((q) => h('li', { class: 'row' },
      h('button', { class: 'link-btn strong', onclick: () => goTo(q.from) }, name(q.from)),
      h('span', { class: 'row-actions' },
        h('button', { class: 'btn small primary', onclick: respond(q, true) }, 'Accetta'),
        h('button', { class: 'btn small', onclick: respond(q, false) }, 'Rifiuta'))))) : h('p', { class: 'small' }, 'Nessuna richiesta per ora.'),
    h('h3', {}, `I tuoi amici (${friends.length})`),
    friends.length ? h('ul', { class: 'chips' }, friends.map((id) => h('li', {}, h('button', { class: 'chip', onclick: () => goTo(id) }, name(id)))))
      : h('p', { class: 'small' }, 'Tocca una casa sulla mappa e bussa alla porta per fare amicizia.'),
    outgoing.length ? h('h3', {}, 'In attesa di risposta') : null,
    outgoing.length ? h('ul', { class: 'chips' }, outgoing.map((q) => h('li', { class: 'chip muted' }, name(q.to)))) : null));
}

function openProfile() {
  const mine = me();
  if (!mine) return openLogin();
  const r = myResident();
  const err = formError();
  const form = h('form', { class: 'form', novalidate: true },
    field('Frase di presentazione', h('textarea', { id: 'prof-bio', name: 'bio', rows: 2, maxlength: 120 }), 'Al massimo 120 caratteri, la vede chi visita la tua casa.'),
    field('Il mio Instagram (facoltativo)', h('input', { id: 'prof-ig', name: 'instagram', autocapitalize: 'off', placeholder: 'nomeutente' }), 'Lo mostriamo sulla tua casa solo se lo scrivi qui.'),
    err,
    h('button', { class: 'btn primary', type: 'submit' }, 'Salva il profilo'));
  form.bio.value = r?.bio || '';
  form.instagram.value = r?.instagram || '';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    run(form.querySelector('[type=submit]'), async () => {
      try { await store.op({ type: 'profile', bio: form.bio.value, instagram: form.instagram.value }); toast('Profilo salvato'); } catch (ex) { showError(err, ex); }
    });
  });
  const delErr = formError();
  const del = h('form', { class: 'form danger-zone', novalidate: true, hidden: true },
    h('p', {}, 'La tua casa verrà demolita e il lotto tornerà libero. Amicizie e richieste vengono cancellate. Non si può annullare.'),
    field('Scrivi la password per confermare', h('input', { id: 'del-pass', name: 'password', type: 'password', autocomplete: 'current-password' })),
    delErr,
    h('button', { class: 'btn danger', type: 'submit' }, 'Cancella definitivamente il mio account'));
  del.addEventListener('submit', (e) => {
    e.preventDefault();
    run(del.querySelector('[type=submit]'), async () => {
      try { await store.deleteAccount(del.password.value); closeSheet(); toast('Account cancellato. Grazie di essere passato da qui.'); } catch (ex) { showError(delErr, ex); }
    });
  });
  openSheet(mine.username || 'Il mio profilo', h('div', { class: 'stack' },
    h('div', { class: 'badges' },
      r?.number ? h('span', { class: 'tag' }, `Abitante n°${r.number}`) : h('span', { class: 'tag warn' }, 'Email da confermare'),
      isFounder(r) ? h('span', { class: 'tag gold' }, 'Fondatore') : null),
    form,
    h('h3', {}, 'Account'),
    h('p', { class: 'small' }, `Email: ${mine.email}`),
    h('div', { class: 'row-wrap' },
      h('button', { class: 'btn', onclick: () => openCharacter() }, icon('user'), 'Il mio personaggio'),
      mine.admin ? h('button', { class: 'btn', onclick: openRedazione }, icon('desk'), 'Redazione') : null,
      h('button', { class: 'btn', onclick: (e) => run(e.currentTarget, async () => showExport(await store.exportData())) }, 'Scarica i miei dati'),
      h('button', { class: 'btn', onclick: (e) => run(e.currentTarget, async () => { await store.logout(); closeSheet(); toast('Sei uscito. A presto!'); }) }, 'Esci'),
      h('button', { class: 'btn ghost danger-text', onclick: () => { del.hidden = !del.hidden; } }, 'Cancella account')),
    del,
    h('p', { class: 'small' }, h('a', { href: '#', onclick: (e) => { e.preventDefault(); openRules(openProfile); } }, 'Regolamento e privacy'))));
}

function showExport(data) {
  const text = JSON.stringify(data, null, 2);
  const pre = h('pre', { class: 'code' }, text);
  openSheet('I miei dati', h('div', { class: 'stack' },
    h('p', { class: 'small' }, 'Questi sono tutti i dati che la città conserva su di te.'),
    pre,
    h('div', { class: 'row-wrap' },
      h('button', { class: 'btn', onclick: () => navigator.clipboard?.writeText(text).then(() => toast('Copiato'), () => selectText(pre)) }, 'Copia'),
      DEMO ? null : h('a', { class: 'btn', href: '/api/me/export', download: 'virtual-italy-i-miei-dati.json' }, 'Scarica il file'))));
}
function selectText(el) { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); }

/* Piazza, quartieri, giornale -------------------------------------------------- */

function openMuro() {
  const city = store.city;
  const founders = Object.values(city.residents).filter((r) => isFounder(r)).sort((a, b) => a.number - b.number);
  const built = builtCount(city);
  const g = goalProgress(built);
  openSheet('Muro dei Fondatori', h('div', { class: 'stack' },
    h('div', { class: 'goal-card' },
      h('p', {}, h('strong', {}, nextGoal(city, built))),
      h('span', { class: 'goal-track big' }, h('span', { class: 'goal-fill', style: `width:${Math.round(g.ratio * 100)}%` })),
      h('p', { class: 'small' }, 'A 25 abitanti arriva la fontana in piazza. Ogni nuovo abitante migliora la città per tutti.')),
    h('p', {}, `I primi ${FOUNDERS} abitanti hanno una targa d'oro sulla casa e il nome inciso qui.`),
    founders.length ? h('ol', { class: 'wall' }, founders.map((r) => h('li', {}, h('span', { class: 'num' }, r.number), r.username)))
      : h('p', { class: 'small' }, 'Il muro è ancora vuoto: il primo nome potrebbe essere il tuo.'),
    h('p', { class: 'small' }, `Posti da Fondatore ancora liberi: ${Math.max(0, FOUNDERS - founders.length)}.`)));
}

function openLocked(id) {
  const d = districtById(id);
  const open = store.city.openDistricts;
  const total = lotsOpen(open);
  const taken = Object.keys(store.city.houses).filter((k) => districtAt(...parseKey(k)) <= open).length;
  const need = Math.max(0, Math.ceil(total * UNLOCK_RATIO) - taken);
  openSheet(d.name, h('div', { class: 'stack' },
    id === open + 1
      ? h('p', {}, `È il prossimo quartiere ad aprire: mancano ${need} ${need === 1 ? 'casa' : 'case'} nei quartieri aperti. Avrà ${PLAN.lotsByDistrict.get(id).length} lotti e una nuova strada principale.`)
      : h('p', {}, `Per ora è campagna. Aprirà dopo gli altri quartieri, con ${PLAN.lotsByDistrict.get(id).length} lotti.`),
    h('p', { class: 'small' }, 'Le linee tratteggiate bianche sono le strade principali già previste dal piano regolatore.')));
}

function openGiornale() {
  const city = store.city;
  const admin = me()?.admin;
  markOnce('giornale');
  const list = h('ol', { class: 'news' }, city.news.map((n) => {
    const f = formatNews(n, city);
    return h('li', { class: 'news-item' },
      h('p', { class: 'news-date' }, fmtDay(n.at)),
      h('h3', { class: 'news-title' }, f.title),
      h('p', {}, f.text),
      h('div', { class: 'row-wrap' },
        n.slot && city.houses[n.slot] ? h('button', { class: 'link-btn', onclick: () => { closeSheet(); map.focus(n.slot, 2.2); } }, 'Vedi sulla mappa') : null,
        admin ? h('button', { class: 'link-btn', onclick: () => openPoster(n, 'post') }, 'Cartolina post') : null,
        admin ? h('button', { class: 'link-btn', onclick: () => openPoster(n, 'story') }, 'Storia') : null));
  }));
  openSheet('', h('div', { class: 'paper' },
    h('div', { class: 'masthead' }, h('p', { class: 'mast-name' }, CITY), h('p', { class: 'mast-sub' }, `${PAPER} · il giornale della città`)),
    admin ? h('button', { class: 'btn small', onclick: openRedazione }, icon('desk'), 'Redazione') : null,
    rankingBox(city),
    list), { wide: true });
}

async function openPoster(n, format) {
  openSheet(format === 'story' ? 'Storia per Instagram' : 'Post per Instagram', h('p', { class: 'small' }, 'Preparo l\'immagine…'), { wide: true });
  const cv = await renderPoster(store.city, n, format);
  const url = cv.toDataURL('image/png');
  const name = `virtual-italy-${format}-${new Date(n.at).toISOString().slice(0, 10)}.png`;
  openSheet(format === 'story' ? 'Storia per Instagram' : 'Post per Instagram', h('div', { class: 'stack' },
    h('img', { class: 'poster', src: url, alt: formatNews(n, store.city).title }),
    DEMO ? h('p', { class: 'small' }, 'Nella demo il download è bloccato: tieni premuta l\'immagine (o clic destro) per salvarla.')
      : h('a', { class: 'btn primary', href: url, download: name }, 'Scarica l\'immagine'),
    h('p', { class: 'small' }, `Testo suggerito: ${formatNews(n, store.city).text} Il link per entrare è in bio.`)), { wide: true });
}

async function openRedazione() {
  const data = await run(null, () => store.admin());
  if (!data) return;
  const city = store.city;
  const name = (id) => city.residents[id]?.username || 'ex abitante';
  const reports = city.reports.filter((r) => !r.resolved);
  const residents = Object.values(city.residents);
  openSheet('Redazione', h('div', { class: 'stack' },
    h('ul', { class: 'facts' },
      h('li', {}, h('strong', {}, residents.filter((r) => r.confirmed).length), ' abitanti confermati'),
      h('li', {}, h('strong', {}, residents.filter((r) => !r.confirmed).length), ' in attesa di conferma'),
      h('li', {}, h('strong', {}, `${city.openDistricts}/5`), ' quartieri aperti')),
    h('h3', {}, 'Da dove arrivano gli iscritti'),
    data.sources.length ? h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, h('th', {}, 'Provenienza'), h('th', {}, 'Iscritti'), h('th', {}, 'Confermati'))),
      h('tbody', {}, data.sources.map((s) => h('tr', {}, h('td', {}, s.source), h('td', {}, s.n), h('td', {}, s.confirmed || 0)))))
      : h('p', { class: 'small' }, 'Ancora nessun iscritto.'),
    h('p', { class: 'small' }, 'Per sapere quali post funzionano, nella bio usa link come …/?da=bio e nelle storie …/?da=storia.'),
    h('h3', {}, `Segnalazioni aperte (${reports.length})`),
    reports.length ? h('ul', { class: 'rows' }, reports.map((rep) => h('li', { class: 'row col' },
      h('p', {}, h('strong', {}, name(rep.target)), ` · segnalato il ${fmtDay(rep.at)}`),
      h('p', { class: 'small' }, rep.reason),
      h('span', { class: 'row-actions' },
        h('button', { class: 'btn small', onclick: (e) => run(e.currentTarget, async () => { await store.op({ type: 'resolveReport', id: rep.id }); openRedazione(); }) }, 'Archivia'),
        city.residents[rep.target] ? h('button', { class: 'btn small danger', onclick: (e) => run(e.currentTarget, async () => {
          await store.op({ type: 'suspend', id: rep.target, on: !city.residents[rep.target].suspended });
          await store.op({ type: 'resolveReport', id: rep.id });
          toast('Abitante sospeso'); openRedazione();
        }) }, 'Sospendi') : null)))) : h('p', { class: 'small' }, 'Nessuna segnalazione da leggere.'),
    data.mailConfigured ? null : h('h3', {}, 'Posta in uscita (email non ancora configurate)'),
    data.mailConfigured ? null : data.outbox.length ? h('ul', { class: 'rows' }, data.outbox.slice(0, 10).map((m) => h('li', { class: 'row col' },
      h('p', {}, h('strong', {}, m.subject), ` → ${m.to}`), h('p', { class: 'small pre' }, m.body)))) : h('p', { class: 'small' }, 'Vuota.')), { wide: true });
}

function openRules(back) {
  openSheet('Regolamento e privacy', h('div', { class: 'stack prose' },
    h('h3', {}, 'Regolamento della città'),
    h('ol', {},
      h('li', {}, 'Un account per persona, una casa per account.'),
      h('li', {}, 'Nome utente e frase di presentazione devono essere rispettosi: niente insulti, volgarità, spam o nomi che imitano altre persone o la redazione.'),
      h('li', {}, 'Chi non rispetta le regole può essere segnalato e sospeso dalla redazione.'),
      h('li', {}, 'Per iscriversi bisogna avere almeno 14 anni.')),
    h('h3', {}, 'Informativa privacy (sintesi)'),
    h('p', {}, `Conserviamo email, nome utente, password (cifrata), casa, profilo, amicizie e la provenienza dell'iscrizione. L'email serve solo per confermare l'account e recuperare la password: non è mai mostrata agli altri e non viene ceduta a terzi. Il profilo Instagram compare solo se lo inserisci tu. Dal tuo profilo puoi scaricare tutti i tuoi dati o cancellare l'account in ogni momento.`),
    h('p', { class: 'small' }, 'Testo da completare con i dati del titolare del trattamento prima della pubblicazione.'),
    back ? h('button', { class: 'btn', onclick: back }, 'Torna indietro') : null));
}

function openDemoInbox() {
  const mails = store.inbox();
  openSheet('Email finte (demo)', h('div', { class: 'stack' },
    h('p', { class: 'small' }, 'Nella versione vera queste email arrivano nella casella di posta di chi si iscrive.'),
    mails.length ? h('ul', { class: 'rows' }, mails.map((m) => h('li', { class: 'row col' },
      h('p', {}, h('strong', {}, m.subject), ` → ${m.to}`),
      h('p', { class: 'small' }, m.body),
      m.action ? h('button', { class: 'btn small primary', onclick: () => (m.action.kind === 'confirm' ? confirmEmail(m.action.token) : openResetForm(m.action.token)) },
        m.action.kind === 'confirm' ? 'Conferma l\'email' : 'Scegli la nuova password') : null))) : h('p', { class: 'small' }, 'Nessuna email per ora.')));
}

/* Tocchi sulla mappa ------------------------------------------------------- */

function onTap(t) {
  if (ui.mode === 'choose') {
    if (t.kind === 'lot') return openLot(t.slot);
    if (t.kind === 'locked') return toast('Questo quartiere non è ancora aperto: scegli un lotto tratteggiato.', 'err');
    if (t.kind === 'house') return toast('Questo lotto è già occupato.', 'err');
    return;
  }
  if (t.kind === 'avatar' && t.id.startsWith('npc:')) return onNpcTap(t.id);
  if (t.kind === 'avatar') return openSay(t.id);
  if (ui.room) return onRoomTap(t);
  // Con il proprio omino in città, ogni tocco è anche una passeggiata.
  const walker = me() && map.avatarOf(me().id);
  const go = (x, y) => walker && walkTo(x, y);
  if (t.kind === 'shop') { const sh = shopById(t.shop); go(...sh.front); return openShop(sh); }
  if (t.kind === 'house') { go(...frontOf(store.city, t.slot)); return openHouse(t.slot); }
  if (t.kind === 'lot') { go(t.x, t.y); return openLot(t.slot); }
  if (t.kind === 'giornale') { go(t.x, t.y + 1); return openGiornale(); }
  if (t.kind === 'muro') { go(t.x, t.y + 1); return openMuro(); }
  if (t.kind === 'piazza') {
    if (walker && seatAt(store.city, null, t.x, t.y)) { closeSheet(); return sitOn(t.x, t.y); }
    if (walker) { closeSheet(); return go(t.x, t.y); }
    return openMuro();
  }
  if (t.kind === 'locked' && !walker) return openLocked(t.district);
  closeSheet();
  if (walker && !go(t.x, t.y)) toast('Da qui non si passa: prova a seguire le strade.', 'err');
}

// Muove il proprio omino e lo racconta agli altri abitanti.
function walkTo(x, y) {
  const ok = map.walk(me().id, x, y);
  if (ok) store.move(x, y);
  return ok;
}

/* Dentro casa ---------------------------------------------------------------- */

// Si entra in una casa (id del padrone) o in un negozio ('shop:…'): stessa stanza isometrica.
function enterHouse(ownerId) {
  const mine = me();
  if (!mine) return openLogin();
  const city = store.city;
  if (!canVisit(city, mine.id, ownerId)) return toast('Il padrone di casa non fa entrare visite.', 'err');
  if (!map.avatarOf(mine.id)) syncAvatars();
  closeSheet();
  ui.room = ownerId;
  ui.edit = false; ui.placing = null; ui.sel = null; ui.moving = null; ui.shopTab = null;
  map.walk(mine.id, ...ROOM_DOOR, ownerId);
  store.move(...ROOM_DOOR, ownerId);
  map.enterRoom(ownerId);
  const shop = shopById(ownerId);
  if (shop?.kind === 'bar') setTimeout(() => map.say('npc:' + shop.id, `Ciao ${mine.username}! Un caffè? O ti va di darmi una mano al bancone?`), 350);
  else if (shop?.kind === 'comune') {
    const fresh = !registered();
    setTimeout(() => map.say('npc:' + shop.id, fresh ? `Benvenuto in Comune, ${mine.username}! Vieni allo sportello per l'iscrizione.` : `Buongiorno ${mine.username}! Come posso aiutarti?`), 350);
    if (fresh) setTimeout(() => { if (ui.room === shop.room) openAnagrafe(); }, 900);
  } else if (shop) setTimeout(() => map.say('npc:' + shop.id, shop.kind === 'wear' ? `Ciao ${mine.username}! Tocca un manichino o il catalogo.` : `Benvenuto ${mine.username}! Tocca un mobile per prenderlo.`), 350);
  update();
}
function exitHouse() {
  const owner = ui.room;
  ui.room = null; ui.edit = false; ui.placing = null; ui.sel = null; ui.moving = null;
  const shop = shopById(owner);
  const house = shop ? null : residentHouse(store.city, owner);
  const [x, y] = shop ? shop.front : house ? frontOf(store.city, house.slot) : spawnPoint(store.city, me().id);
  map.walk(me().id, x, y, null);
  store.move(x, y, null);
  map.exitRoom();
  if (house) map.focus(house.slot);
  if (shop) map.focus([shop.x0 + Math.floor(shop.w / 2), shop.y0 + shop.d]);
  update();
}
// Dalla stanza al Mobilificio: si esce e si va a piedi fino alla sua porta.
function goToShop(id) {
  const shop = shopById(id);
  if (ui.room) exitHouse();
  map.focus([shop.x0 + 1, shop.y0 + 1]);
  if (me() && map.avatarOf(me().id)) walkTo(...shop.front);
  openShop(shop);
}

/* Negozi ------------------------------------------------------------------- */

function openShop(shop) {
  map.set({ selected: null });
  if (shop.kind === 'bar') return openBarSheet(shop);
  if (shop.kind === 'comune') {
    return openSheet(shop.name, h('div', { class: 'stack' },
      h('p', {}, `Il palazzo comunale di ${CITY}: qui c'è l'ufficio anagrafe, dove ogni nuovo abitante si iscrive e ritira la carta d'identità.`),
      h('p', { class: 'small' }, `Allo sportello c'è ${shop.keeper}. Sotto il portico c'è il Muro dei Fondatori, con le targhe dei primi abitanti.`),
      me() ? h('button', { class: 'btn primary big', onclick: () => enterHouse(shop.room) }, registered() ? 'Entra in Municipio' : 'Entra e iscriviti all\'anagrafe')
        : h('button', { class: 'btn primary', onclick: openRegister }, 'Iscriviti per abitare qui'),
      h('button', { class: 'btn', onclick: openMuro }, 'Muro dei Fondatori')));
  }
  const what = shop.kind === 'wear' ? 'Maglie, gonne, cappelli e accessori per il tuo omino.'
    : shop.kind === 'ride' ? 'Skateboard, biciclette e monopattini elettrici: a piedi si va a passo d\'uomo, con un mezzo si gira la città più svelti.'
      : 'Mobili e decorazioni da portare a casa e sistemare come vuoi.';
  openSheet(shop.name, h('div', { class: 'stack' },
    h('div', { class: 'badges' }, h('span', { class: 'tag live' }, 'Aperto'), h('span', { class: 'tag gold' }, coin(14), 'Si paga in soldi')),
    h('p', {}, what),
    h('p', { class: 'small' }, `Dietro al bancone c'è ${shop.keeper}.${me() ? ` Nel borsellino hai ${soldi(walletOf(store.city, me().id))}.` : ''}`),
    me() ? h('button', { class: 'btn primary big', onclick: () => enterHouse(shop.room) }, 'Entra nel negozio')
      : h('button', { class: 'btn primary', onclick: openRegister }, 'Iscriviti per fare acquisti')));
}
// Il cartellino del prezzo in soldi: in rosso se nel borsellino non bastano.
const priceTag = (price) => {
  const short = me() && walletOf(store.city, me().id) < price;
  return h('span', { class: 'price' + (short ? ' short' : ''), title: short ? 'Non ti bastano i soldi' : null }, coin(14), String(price));
};
async function buyFurni(t) {
  const f = furniById(t);
  const res = await run(null, () => store.op({ type: 'buy', kind: 'furni', t }));
  if (res) toast(`${f.label}: pagato ${soldi(f.price)}, è nell'inventario (${res.have} da sistemare)`);
  update();
}
function openWear(w) {
  const r = myResident();
  if (!r) return openLogin();
  const has = ownsWear(store.city, r.id, w.id);
  const look = { ...cleanLook(r.look, r.username), [w.slot]: w.id };
  const cv = h('canvas', { class: 'avatar-preview', width: 300, height: 300, 'aria-label': `Tu con ${w.label.toLowerCase()}` });
  const t0 = performance.now();
  const anim = (t) => { if (!cv.isConnected) return; drawAvatarPreview(cv, avatarLook(r.username, look), t - t0); requestAnimationFrame(anim); };
  const wearNow = (e) => run(e.currentTarget, async () => {
    if (has) await store.op({ type: 'look', look });
    else await store.op({ type: 'buy', kind: 'wear', id: w.id, wear: true });
    closeSheet(); syncAvatars();
    toast(has ? `Ora indossi: ${w.label.toLowerCase()}` : `${w.label}: pagato ${soldi(w.price)}. Ti sta benissimo!`);
  });
  openSheet(w.label, h('div', { class: 'stack' },
    h('div', { class: 'avatar-head' }, cv, h('div', { class: 'stack' },
      h('p', { class: 'small' }, has ? 'È già nel tuo armadio.' : 'Ecco come ti starebbe. Il colore lo cambi quando vuoi dal tuo personaggio.'),
      has ? null : priceTag(w.price))),
    h('button', { class: 'btn primary big', onclick: wearNow }, has ? 'Indossa' : `Compra e indossa · ${soldi(w.price)}`),
    has ? null : h('button', { class: 'btn', onclick: (e) => run(e.currentTarget, async () => { await store.op({ type: 'buy', kind: 'wear', id: w.id }); closeSheet(); toast(`${w.label}: nel tuo armadio`); }) }, 'Compra e tienilo da parte')), { wide: true });
  requestAnimationFrame(anim);
}
// Prova di un mezzo: l'omino ci gira sopra; si prende e ci si sale subito.
function openRide(m) {
  const r = myResident();
  if (!r) return openLogin();
  const has = (invOf(store.city, r.id).rides || []).includes(m.id);
  const on = r.ride === m.id;
  const cv = h('canvas', { class: 'avatar-preview', width: 300, height: 300, 'aria-label': `Tu su ${m.label.toLowerCase()}` });
  const t0 = performance.now();
  const anim = (t) => { if (!cv.isConnected) return; drawAvatarPreview(cv, avatarLook(r.username, r.look), t - t0, m.id); requestAnimationFrame(anim); };
  const go = (op, msg) => (e) => run(e.currentTarget, async () => { await store.op(op); closeSheet(); syncAvatars(); toast(msg); update(); });
  openSheet(m.label, h('div', { class: 'stack' },
    h('div', { class: 'avatar-head' }, cv, h('div', { class: 'stack' },
      h('p', { class: 'small' }, `Va ${Math.round((m.speed / WALK_SPEED) * 10) / 10} volte più veloce che a piedi.`),
      has ? h('p', { class: 'small' }, on ? 'Ci sei già sopra.' : 'È già tuo.') : priceTag(m.price))),
    has ? (on ? h('button', { class: 'btn big', onclick: go({ type: 'ride', id: null }, 'Sei sceso: si va a piedi') }, 'Scendi e vai a piedi')
      : h('button', { class: 'btn primary big', onclick: go({ type: 'ride', id: m.id }, `In sella! ${m.label}`) }, 'Sali'))
      : h('button', { class: 'btn primary big', onclick: go({ type: 'buy', kind: 'ride', id: m.id, use: true }, `${m.label}: pagato ${soldi(m.price)}, è tuo! Esci e fatti un giro`) }, `Compra e sali · ${soldi(m.price)}`),
    h('p', { class: 'small' }, 'In casa e nei negozi si entra sempre a piedi.')), { wide: true });
  requestAnimationFrame(anim);
}
/* Lavori: il turno da barista al Bar Centrale ----------------------------------- */

// Icone del menù del bar, disegnate a mano (48×48)
const MENU_SVG = {
  espresso: '<ellipse cx="24" cy="36" rx="15" ry="4" fill="#e9e1cf"/><path d="M14 22h18l-2 12a3 3 0 0 1-3 2.5h-8A3 3 0 0 1 16 34z" fill="#fff" stroke="#c9bfa8"/><ellipse cx="23" cy="22.5" rx="9" ry="2.2" fill="#5a3418"/><path d="M32 25a4 4 0 0 1 0 7" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M20 16c-1-2 1-3 0-5M25 16c-1-2 1-3 0-5" stroke="#c9bfa8" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  cappuccino: '<ellipse cx="24" cy="38" rx="18" ry="4.5" fill="#e9e1cf"/><path d="M9 18h28l-3 16a4 4 0 0 1-4 3H16a4 4 0 0 1-4-3z" fill="#fff" stroke="#c9bfa8"/><ellipse cx="23" cy="18.6" rx="14" ry="3.6" fill="#c9915a"/><ellipse cx="23" cy="18.6" rx="10" ry="2.4" fill="#f4e6cf"/><path d="M21 17.6c0-1.2 2-1.2 2 0 0-1.2 2-1.2 2 0 0 1-2 2-2 2s-2-1-2-2z" fill="#c9915a"/><path d="M37 21a5 5 0 0 1-1 9" fill="none" stroke="#fff" stroke-width="2.8"/>',
  cornetto: '<path d="M7 32c4-12 30-12 34 0-4 3-8 1-10-2-2 4-10 4-12 0-2 3-8 5-12 2z" fill="#d9a441" stroke="#a36a1f" stroke-width="1.4"/><path d="M17 26l2 6M24 24v7M31 26l-2 6" stroke="#a36a1f" stroke-width="1.4"/><path d="M12 28c3-4 7-6 12-6" stroke="#f3cf7d" stroke-width="1.6" fill="none"/>',
  spremuta: '<path d="M14 12h20l-3 28H17z" fill="#f2f6f7" stroke="#b9c6cc"/><path d="M15 20h18l-2.3 18H17.3z" fill="#f39a2b"/><circle cx="33" cy="13" r="6" fill="#f6b23e" stroke="#e08a1a"/><path d="M33 8v10M28 13h10M29.5 9.5l7 7M36.5 9.5l-7 7" stroke="#fde2a6" stroke-width="0.9"/><path d="M22 8l4 14" stroke="#e85d75" stroke-width="2"/>',
  tramezzino: '<path d="M6 34L24 12l18 22z" fill="#f4ecd8" stroke="#c9b48f" stroke-width="1.4"/><path d="M9 31l15-15 15 15" fill="none" stroke="#7bbf6a" stroke-width="3"/><path d="M11 33l13-13 13 13" fill="none" stroke="#f28cbf" stroke-width="2.4"/><path d="M6 34h36l-2 4H8z" fill="#e6d6b0" stroke="#c9b48f"/>',
  acqua: '<path d="M20 6h8v5c4 2 6 5 6 9v19a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V20c0-4 2-7 6-9z" fill="#cfe9f5" stroke="#6fa9c6" stroke-width="1.4"/><rect x="19" y="4" width="10" height="4" rx="1" fill="#3f6aa1"/><rect x="14" y="22" width="20" height="9" fill="#3f6aa1"/><path d="M18 26.5h12" stroke="#fff" stroke-width="1.4"/><path d="M17 33c3 1 11 1 14 0" stroke="#fff" stroke-width="1.2" fill="none" opacity=".7"/>',
};
const menuIcon = (id, size = 34) => h('span', { class: 'menu-ico', 'data-item': id, 'aria-hidden': 'true', html: `<svg viewBox="0 0 48 48" width="${size}" height="${size}">${MENU_SVG[id]}</svg>` });

function openBarSheet(shop) {
  const r = myResident();
  const job = JOBS.bar;
  const w = r ? workOf(store.city, r.id) : null;
  const lv = jobLevel('bar', w?.xp.bar || 0);
  const left = r ? shiftsLeft(store.city, r.id, 'bar', Date.now()) : job.shifts;
  openSheet(shop.name, h('div', { class: 'stack' },
    h('div', { class: 'badges' }, h('span', { class: 'tag live' }, 'Aperto'), h('span', { class: 'tag gold' }, coin(14), 'Cercasi baristi')),
    h('p', {}, 'Il bar di fronte alla piazza: espresso, cappuccino, cornetti caldi e le chiacchiere del paese.'),
    h('div', { class: 'job-card' },
      h('span', { class: 'job-ico' }, menuIcon('espresso', 40)),
      h('div', {},
        h('strong', {}, 'Turno da barista'),
        h('p', { class: 'small' }, `${job.secs} secondi al bancone: servi gli ordini prima che i clienti perdano la pazienza. Fino a ${soldi(job.cap)} a turno, ${job.shifts} turni al giorno.`),
        r ? h('p', { class: 'small' }, h('strong', {}, lv.label), lv.next ? ` · ${w.xp.bar || 0}/${lv.next.at} clienti per diventare ${lv.next.label.toLowerCase()} (paga +${Math.round(lv.next.bonus * 100)}%)` : ' · il massimo!') : null)),
    !me() ? h('button', { class: 'btn primary big', onclick: openRegister }, 'Iscriviti per lavorare')
      : !registered() ? h('button', { class: 'btn primary big', onclick: goToComune }, 'Prima l\'anagrafe in Municipio')
        : left > 0 ? h('button', { class: 'btn primary big', onclick: (e) => startShift(e.currentTarget) }, `☕ Inizia il turno (${left} ${left === 1 ? 'rimasto' : 'rimasti'} oggi)`)
          : h('p', { class: 'small' }, 'Per oggi hai fatto tutti i turni: Franco ti aspetta domani!'),
    me() && ui.room !== shop.room ? h('button', { class: 'btn', onclick: () => enterHouse(shop.room) }, 'Entra al bar') : null));
}
function barRoomBar(shop) {
  const r = myResident();
  const left = r ? shiftsLeft(store.city, r.id, 'bar', Date.now()) : 0;
  const head = h('div', { class: 'room-head' },
    h('div', { class: 'room-title' }, h('span', { class: 'eyebrow' }, 'Sei al bar'), h('strong', {}, shop.name)),
    h('span', { class: 'row-actions' }, h('button', { class: 'btn small', onclick: exitHouse }, 'Esci')));
  const work = registered() && left > 0 ? h('button', { class: 'btn primary', onclick: (e) => startShift(e.currentTarget) }, `☕ Turno da barista (${left}/${JOBS.bar.shifts})`)
    : h('button', { class: 'btn', onclick: () => openBarSheet(shop) }, '☕ Lavorare al bar');
  return h('div', { class: 'bar room-bar' }, head, work, chatBar());
}

// Il gioco: arrivano i clienti con l'ordinazione, si compone il vassoio, si serve.
async function startShift(btn) {
  const res = await run(btn, () => store.op({ type: 'shiftStart', job: 'bar' }));
  if (!res) return;
  closeSheet();
  const job = JOBS.bar, mine = me();
  const lvl = jobLevel('bar', workOf(store.city, mine.id).xp.bar || 0);
  const rate = job.rate * (1 + lvl.bonus);
  const total = job.secs * 1000;
  const pool = Object.values(store.city.residents).filter((x) => x.id !== mine.id && !x.suspended);
  const weights = job.menu.flatMap((m) => Array(m.w).fill(m.id));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const g = { t0: performance.now(), served: 0, items: 0, tray: [], queue: [], nextAt: 0, done: false, lost: 0, tips: 0 };
  // Interfaccia
  const timer = h('span', { class: 'job-timer-fill' });
  const earned = h('strong', {}, '0');
  const servedEl = h('span', {}, '0');
  const queueEl = h('div', { class: 'customers' }, h('p', { class: 'small cust-wait' }, 'Arrivano i clienti...'));
  const trayEl = h('div', { class: 'tray-items' });
  const trayBox = h('div', { class: 'tray' }, h('span', { class: 'tray-label' }, 'Vassoio'), trayEl,
    h('button', { class: 'btn small', onclick: () => { g.tray = []; drawTray(); } }, 'Svuota'));
  const menuEl = h('div', { class: 'menu-grid' }, job.menu.map((m) => h('button', { class: 'menu-btn', onclick: () => addItem(m.id) }, menuIcon(m.id, 40), h('span', {}, m.label))));
  const overlay = h('div', { class: 'job', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Turno al Bar Centrale' },
    h('div', { class: 'job-head' },
      h('div', {}, h('span', { class: 'eyebrow' }, 'Bar Centrale · turno'), h('strong', {}, 'Servi i clienti!')),
      h('div', { class: 'job-score' }, coin(22), earned, h('span', { class: 'small' }, ' · serviti '), servedEl)),
    h('div', { class: 'job-timer' }, timer),
    queueEl, trayBox, menuEl,
    h('p', { class: 'small job-hint' }, 'Tocca le cose ordinate: quando il vassoio corrisponde a un ordine, il cliente viene servito.'));
  document.body.append(overlay);
  const est = () => Math.min(job.cap, Math.round(g.items * rate));
  const sameOrder = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  const fits = (tray, order) => { const o = [...order]; return tray.every((t) => { const i = o.indexOf(t); if (i < 0) return false; o.splice(i, 1); return true; }); };
  function drawTray() {
    trayEl.replaceChildren(...(g.tray.length ? g.tray.map((t) => menuIcon(t, 30)) : [h('span', { class: 'small' }, 'vuoto')]));
  }
  function addCustomer(now) {
    const r = pool.length ? pick(pool) : null;
    const n = Math.random() < 0.5 ? 1 : Math.random() < 0.7 ? 2 : 3;
    const order = Array.from({ length: n }, () => pick(weights));
    const patience = Math.max(9000, 17000 - g.served * 350) + n * 1500;
    const cv = h('canvas', { class: 'cust-face', width: 72, height: 72, 'aria-hidden': 'true' });
    try { drawAvatarBust(cv, avatarLook(r?.username || 'cliente' + Math.random(), r?.look)); } catch { /* senza ritratto */ }
    const bar = h('span', { class: 'patience-fill' });
    const el = h('div', { class: 'customer' }, cv,
      h('div', { class: 'cust-body' },
        h('span', { class: 'cust-name' }, r?.username || 'Un turista'),
        h('div', { class: 'cust-order' }, order.map((o) => menuIcon(o, 28))),
        h('span', { class: 'patience' }, bar)));
    const c = { order, el, bar, born: now, patience };
    g.queue.push(c);
    queueEl.append(el);
  }
  function addItem(id) {
    if (g.done) return;
    if (g.tray.length >= 3) return flash('Il vassoio è pieno: servi o svuota.');
    g.tray.push(id);
    drawTray();
    const c = g.queue.find((q) => !q.gone && sameOrder(q.order, g.tray));
    if (c) return serve(c);
    if (!g.queue.some((q) => !q.gone && fits(g.tray, q.order))) {
      trayBox.classList.add('wrong');
      flash('Questo non l\'ha ordinato nessuno!');
      setTimeout(() => { trayBox.classList.remove('wrong'); g.tray = []; drawTray(); }, 650);
    }
  }
  function serve(c) {
    const now = performance.now();
    const left = 1 - (now - c.born) / c.patience;
    g.served++; g.items += c.order.length;
    c.gone = true;
    c.el.classList.add('happy');
    c.el.append(h('span', { class: 'cust-say' }, left > 0.6 ? 'Perfetto, grazie!' : 'Grazie!'));
    const pop = h('span', { class: 'coin-pop' }, `+${Math.round(c.order.length * rate)}`);
    c.el.append(pop);
    g.tray = []; drawTray();
    earned.textContent = est(); servedEl.textContent = g.served;
    setTimeout(() => { c.el.remove(); g.queue = g.queue.filter((q) => q !== c); }, 700);
  }
  let flashT = null;
  const flashEl = h('div', { class: 'job-flash', hidden: true });
  overlay.append(flashEl);
  function flash(text) { flashEl.textContent = text; flashEl.hidden = false; clearTimeout(flashT); flashT = setTimeout(() => { flashEl.hidden = true; }, 1300); }
  drawTray();
  const tick = () => {
    if (g.done) return;
    const now = performance.now();
    const el = now - g.t0;
    timer.style.width = `${Math.max(0, 100 - (el / total) * 100)}%`;
    if (now >= g.nextAt && g.queue.filter((q) => !q.gone).length < 3) { addCustomer(now); g.nextAt = now + 2200 + Math.random() * 2200; }
    for (const c of g.queue) {
      if (c.gone) continue;
      const p = Math.max(0, 1 - (now - c.born) / c.patience);
      c.bar.style.width = `${p * 100}%`;
      c.bar.classList.toggle('low', p < 0.3);
      if (p <= 0) {
        c.gone = true; g.lost++;
        c.el.classList.add('angry');
        c.el.append(h('span', { class: 'cust-say' }, 'Che lentezza!'));
        setTimeout(() => { c.el.remove(); g.queue = g.queue.filter((q) => q !== c); }, 900);
      }
    }
    if (el >= total) return finish();
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  async function finish() {
    g.done = true;
    let result = null, error = null;
    try { result = await store.op({ type: 'shiftEnd', job: 'bar', served: g.served, items: g.items }); } catch (ex) { error = errText(ex); }
    const left = result ? result.left : 0;
    overlay.replaceChildren(h('div', { class: 'job-end' },
      h('span', { class: 'eyebrow' }, 'Fine del turno'),
      h('h2', {}, result ? (g.served >= 10 ? 'Che bancone, complimenti!' : g.served >= 5 ? 'Bel turno!' : 'Turno finito') : 'Turno non pagato'),
      result ? h('div', { class: 'purse' }, h('span', { class: 'purse-coin', html: coinSvg(64) }),
        h('div', {}, h('p', { class: 'eyebrow' }, 'Paga del turno'), h('p', { class: 'purse-n' }, `+${soldi(result.pay)}`))) : h('p', {}, error),
      h('ul', { class: 'earn' },
        h('li', {}, '☕', h('span', {}, h('strong', {}, g.served), ' clienti serviti, ', h('strong', {}, g.items), ' cose portate al tavolo')),
        g.lost ? h('li', {}, '😤', h('span', {}, `${g.lost} ${g.lost === 1 ? 'cliente se n\'è andato' : 'clienti se ne sono andati'} senza aspettare`)) : null,
        result ? h('li', {}, '⭐', h('span', {}, result.promoted ? h('strong', {}, `Promozione! Ora sei ${result.level.toLowerCase()}: paga più alta.`) : `${result.level} · ${result.xp} clienti serviti in tutto`)) : null),
      h('div', { class: 'stack' },
        left > 0 ? h('button', { class: 'btn primary big', onclick: (e) => { overlay.remove(); startShift(e.currentTarget); } }, `Un altro turno (${left} ${left === 1 ? 'rimasto' : 'rimasti'})`) : h('p', { class: 'small' }, 'Per oggi basta così: torna domani per altri turni.'),
        h('button', { class: 'btn', onclick: () => { overlay.remove(); update(); } }, 'Torna in città'))));
    if (result?.promoted) toast(`Promozione al bar: ora sei ${result.level.toLowerCase()}!`);
    update();
  }
}

function onNpcTap(id) {
  if (id.startsWith('npc:p:')) { map.say(id, ['Buongiorno!', 'Bella giornata, eh?', 'Ciao!', 'Hai visto la fontana?', 'Vado a prendere un caffè'][Math.floor(Math.random() * 5)]); return; }
  const shop = shopById(ui.room);
  if (!shop) return;
  if (shop.kind === 'comune') return registered() ? openCarta() : openAnagrafe();
  if (shop.kind === 'bar') return openBarSheet(shop);
  const m = /^npc:man:(\d+)$/.exec(id);
  if (m) {
    // Il manichino mostra un capo in vendita: si apre la prova di quello.
    const look = MANNEQUINS[+m[1]].look;
    return openWear(['extra', 'top', 'bottom'].map((k) => wearById(look[k])).find((w) => w && !w.base));
  }
  map.say(id, shop.kind === 'wear' ? 'Prova quello che vuoi, provare non costa niente!' : shop.kind === 'ride' ? 'Fatti un giro di prova, è gratis!' : 'Scegli pure, i prezzi sono sul cartellino!');
}
// Barra in basso dentro un negozio: il catalogo completo, diviso per reparto.
function comuneBar(shop) {
  const head = h('div', { class: 'room-head' },
    h('div', { class: 'room-title' }, h('span', { class: 'eyebrow' }, 'Sei in Municipio'), h('strong', {}, 'Ufficio anagrafe')),
    h('span', { class: 'row-actions' }, h('button', { class: 'btn small', onclick: exitHouse }, 'Esci')));
  const r = myResident();
  const actions = r && r.anagrafe
    ? h('div', { class: 'row-wrap' },
      h('button', { class: 'btn primary', onclick: () => openCarta() }, '🪪 La mia carta d\'identità'),
      h('button', { class: 'btn', onclick: () => openCharacter() }, 'Cambia aspetto'),
      h('button', { class: 'btn', onclick: openMuro }, 'Muro dei Fondatori'))
    : h('button', { class: 'btn primary big', onclick: openAnagrafe }, 'Iscriviti all\'anagrafe');
  void shop;
  return h('div', { class: 'bar room-bar' }, head, actions, chatBar());
}
function shopBar(shop) {
  if (shop.kind === 'comune') return comuneBar(shop);
  if (shop.kind === 'bar') return barRoomBar(shop);
  const head = h('div', { class: 'room-head' },
    h('div', { class: 'room-title' }, h('span', { class: 'eyebrow' }, 'Sei in negozio'), h('strong', {}, shop.name)),
    h('span', { class: 'row-actions' }, h('button', { class: 'btn small', onclick: exitHouse }, 'Esci')));
  const r = myResident();
  const tabsList = shop.kind === 'wear' ? WEAR_SLOTS : shop.kind === 'ride' ? [{ id: 'mezzi', label: 'Mezzi' }] : FURNI_CATS;
  const tab = ui.shopTab || tabsList[0].id;
  const tabs = h('div', { class: 'seg', role: 'tablist' }, tabsList.map((o) =>
    h('button', { class: 'seg-btn' + (tab === o.id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === o.id), onclick: () => { ui.shopTab = o.id; update(); } }, o.label)));
  let items;
  if (shop.kind === 'ride') {
    const owned = r ? invOf(store.city, r.id).rides || [] : [];
    items = RIDES.map((m) => {
      const cv = h('canvas', { width: 112, height: 112, 'aria-hidden': 'true' });
      drawRideIcon(cv, m.id);
      return h('button', { class: 'catalog-item', role: 'listitem', onclick: () => openRide(m) }, cv, h('span', {}, m.label), owned.includes(m.id) ? h('span', { class: 'owned' }, r.ride === m.id ? 'Ci sei sopra' : 'Già tuo') : priceTag(m.price));
    });
  } else if (shop.kind === 'wear') {
    const base = r ? cleanLook(r.look, r.username) : null;
    items = WEAR.filter((w) => w.slot === tab && !w.base).map((w) => {
      const cv = h('canvas', { width: 112, height: 112, 'aria-hidden': 'true' });
      drawAvatarIcon(cv, avatarLook(r?.username || 'ospite', { ...base, [w.slot]: w.id }));
      const has = r && ownsWear(store.city, r.id, w.id);
      return h('button', { class: 'catalog-item', role: 'listitem', onclick: () => openWear(w) }, cv, h('span', {}, w.label), has ? h('span', { class: 'owned' }, 'Già tuo') : priceTag(w.price));
    });
  } else {
    const inv = r ? invOf(store.city, r.id).furni : {};
    items = FURNI.filter((f) => f.cat === tab).map((f) => {
      const cv = h('canvas', { width: 112, height: 112, 'aria-hidden': 'true' });
      drawFurniIcon(cv, f.id, 0);
      return h('button', { class: 'catalog-item', role: 'listitem', onclick: () => buyFurni(f.id) }, cv, h('span', {}, f.label), inv[f.id] ? h('span', { class: 'owned' }, `Ne hai ${inv[f.id]} · `, coin(12), String(f.price)) : priceTag(f.price));
    });
  }
  const strip = h('div', { class: 'catalog', role: 'list', 'aria-label': 'Catalogo del negozio' }, items);
  const hint = h('p', { class: 'small' }, shop.kind === 'wear' ? 'Tocca un capo per provarlo addosso.'
    : shop.kind === 'ride' ? 'Tocca un mezzo per provarlo. In città sali e scendi dal pannello dei gesti (la faccina accanto alla chat).'
      : 'Tocca un articolo per prenderlo: lo trovi in casa, nel pannello Arreda.');
  return h('div', { class: 'bar room-bar editing' }, head, tabs, strip, hint);
}
const isMyRoom = () => me() && ui.room === me().id;

async function onRoomTap(t) {
  if (t.kind === 'door') return exitHouse();
  const room = roomOf(store.city, ui.room);
  const shop = shopById(ui.room);
  if (shop && t.kind === 'furni') {
    // In negozio la merce esposta si compra; appendiabiti e bancone aprono il reparto vestiti.
    const it = room.items.find((x) => x.uid === t.uid);
    if (shop.kind === 'furni' && it) return buyFurni(it.t);
    if (shop.kind === 'ride' && it?.t === 'espositore') return openRide(RIDES[it.c % 3]); // l'ordine degli espositori è quello di RIDES
    if (it && (it.t === 'stender' || it.t === 'specchio')) { ui.shopTab = it.t === 'specchio' ? 'extra' : 'top'; return update(); }
  }
  if (ui.edit && isMyRoom()) {
    if (t.kind === 'floor' && ui.placing) {
      const p = ui.placing;
      const ok = await run(null, async () => { await store.op({ type: 'furni', act: 'add', t: p.t, x: t.x, y: t.y, r: p.r, c: p.c }); return true; });
      if (ok) { ui.placing = null; toast(`${furniById(p.t).label}: al suo posto`); }
      return update();
    }
    if (t.kind === 'floor' && ui.moving) {
      const uid = ui.moving;
      const ok = await run(null, async () => { await store.op({ type: 'furni', act: 'move', uid, x: t.x, y: t.y }); return true; });
      if (ok) ui.moving = null;
      map.setRoomUI({ selectedUid: ui.sel });
      return update();
    }
    if (t.kind === 'furni') { ui.sel = t.uid; ui.moving = null; ui.placing = null; map.setRoomUI({ selectedUid: t.uid }); return update(); }
    if (t.kind === 'floor') { ui.sel = null; map.setRoomUI({ selectedUid: null }); return update(); }
    return;
  }
  // Su sedie, poltrone, divani e pouf ci si siede.
  if (t.kind === 'furni') {
    const it = room.items.find((x) => x.uid === t.uid);
    if (it && seatAt(store.city, ui.room, it.x, it.y)) {
      const f = footprint(it);
      const sx = Math.max(f.x0, Math.min(f.x1, t.x)), sy = Math.max(f.y0, Math.min(f.y1, t.y));
      if (!sitOn(sx, sy, ui.room)) toast('Non si arriva a quella seduta.', 'err');
      return;
    }
  }
  // Fuori dalla modalità arredo ogni tocco è una passeggiata (verso il mobile o la casella).
  if (t.kind === 'floor' || t.kind === 'furni') {
    if (!map.walk(me().id, t.x, t.y, ui.room)) return;
    store.move(t.x, t.y, ui.room);
  }
  void room;
}

function roomBar() {
  const city = store.city;
  if (isShopRoom(ui.room)) return shopBar(shopById(ui.room));
  const owner = city.residents[ui.room];
  const mine = isMyRoom();
  const room = roomOf(city, ui.room);
  const title = h('div', { class: 'room-title' }, h('span', { class: 'eyebrow' }, mine ? 'Sei a casa' : 'Sei ospite'), h('strong', {}, mine ? 'Casa tua' : `Casa di ${owner?.username || '…'}`));
  const head = h('div', { class: 'room-head' }, title,
    h('span', { class: 'row-actions' },
      mine ? h('button', { class: 'btn small' + (ui.edit ? ' primary' : ''), onclick: () => { ui.edit = !ui.edit; ui.placing = null; ui.sel = null; ui.moving = null; map.setRoomUI({ selectedUid: null }); update(); } }, ui.edit ? 'Fine' : 'Arreda') : null,
      h('button', { class: 'btn small', onclick: exitHouse }, 'Esci')));
  if (!ui.edit || !mine) {
    // Il libro degli ospiti e i cuori: chi visita firma e lascia un ❤️, il padrone legge.
    const gb = city.guestbook?.[ui.room] || [];
    const seen = Number(ls.get('vi-gb-seen') || 0);
    const fresh = mine ? gb.filter((g) => g.at > seen).length : 0;
    const hearted = !mine && me() && (() => { const t = city.hearts?.[ui.room]?.[me().id]; return t !== undefined && weekKey(t) === weekKey(Date.now()); })();
    const n = heartsThisWeek(city, ui.room, Date.now());
    const social = h('div', { class: 'row-wrap room-social' },
      h('button', { class: 'btn small', onclick: () => openGuestbook(ui.room) }, mine ? `📖 Libro degli ospiti${fresh ? ` (${fresh} nuove)` : ` (${gb.length})`}` : '✍️ Firma il libro'),
      mine ? h('span', { class: 'tag' }, `❤️ ${n} questa settimana`)
        : h('button', { class: 'btn small heart' + (hearted ? ' on' : ''), 'aria-pressed': String(!!hearted), onclick: () => toggleHeart(ui.room) }, `${hearted ? '❤️' : '🤍'} ${n}`));
    return h('div', { class: 'bar room-bar' }, head, social, chatBar());
  }
  let body;
  if (ui.sel) {
    const it = room.items.find((x) => x.uid === ui.sel);
    if (!it) { ui.sel = null; return roomBar(); }
    const f = furniById(it.t);
    const act = (op, after) => async (e) => { await run(e.currentTarget, async () => { await store.op({ type: 'furni', uid: it.uid, ...op }); after?.(); }); update(); };
    body = h('div', { class: 'stack' },
      h('p', {}, h('strong', {}, f.label), ui.moving ? ' · tocca il pavimento dove spostarlo' : ''),
      h('div', { class: 'row-wrap' },
        h('button', { class: 'btn small', onclick: act({ act: 'rotate' }) }, 'Ruota'),
        f.color ? h('button', { class: 'btn small', onclick: act({ act: 'color' }) }, 'Colore') : null,
        h('button', { class: 'btn small' + (ui.moving ? ' primary' : ''), onclick: () => { ui.moving = ui.moving ? null : it.uid; update(); } }, 'Sposta'),
        h('button', { class: 'btn small danger', onclick: act({ act: 'remove' }, () => { ui.sel = null; map.setRoomUI({ selectedUid: null }); toast(`${f.label}: rimesso nell'inventario`); }) }, 'Metti via'),
        h('button', { class: 'btn small ghost', onclick: () => { ui.sel = null; ui.moving = null; map.setRoomUI({ selectedUid: null }); update(); } }, 'Chiudi')));
  } else if (ui.placing) {
    const f = furniById(ui.placing.t);
    body = h('div', { class: 'stack' },
      h('p', {}, 'Tocca il pavimento dove vuoi mettere ', h('strong', {}, f.label.toLowerCase()), '.'),
      h('div', { class: 'row-wrap' },
        h('button', { class: 'btn small', onclick: () => { ui.placing.r = ui.placing.r ? 0 : 1; toast(ui.placing.r ? 'Girato di lato' : 'Girato di fronte'); } }, 'Ruota'),
        f.color ? h('button', { class: 'btn small', onclick: () => { ui.placing.c = (ui.placing.c + 1) % 8; update(); } }, 'Colore') : null,
        h('button', { class: 'btn small ghost', onclick: () => { ui.placing = null; update(); } }, 'Annulla')));
  } else {
    // Si sistema solo quello che si ha nell'inventario; il resto si prende al Mobilificio.
    const inv = invOf(city, me().id).furni;
    const have = FURNI.filter((f) => inv[f.id] > 0);
    const shopBtn = h('button', { class: 'catalog-item shop-link', role: 'listitem', onclick: () => goToShop('mobili') }, h('span', { class: 'shop-ico', 'aria-hidden': 'true' }, '🛋️'), h('span', {}, 'Vai al Mobilificio'));
    const strip = h('div', { class: 'catalog', role: 'list', 'aria-label': 'I tuoi mobili da sistemare' }, have.map((f) => {
      const cv = h('canvas', { width: 112, height: 112, 'aria-hidden': 'true' });
      drawFurniIcon(cv, f.id, 0);
      return h('button', { class: 'catalog-item', role: 'listitem', onclick: () => { ui.placing = { t: f.id, r: 0, c: 0 }; update(); } }, cv, h('span', {}, f.label), h('span', { class: 'owned' }, `× ${inv[f.id]}`));
    }), shopBtn);
    if (!have.length) strip.prepend(h('p', { class: 'small empty-inv' }, 'Hai sistemato tutto. Per altri mobili e decorazioni passa dal Mobilificio, accanto alla piazza.'));
    const chips = (list, value, onPick) => h('div', { class: 'swatches' }, list.map((o) => h('button', { class: 'swatch' + (o.id === value ? ' on' : ''), onclick: () => onPick(o.id) }, o.label)));
    const style = (op) => run(null, async () => { await store.op({ type: 'roomStyle', ...op }); update(); });
    // Una scheda alla volta, così la stanza resta visibile sopra il pannello.
    const tab = ui.editTab || 'mobili';
    const tabs = h('div', { class: 'seg', role: 'tablist' }, [['mobili', 'Mobili'], ['pavimento', 'Pavimento'], ['pareti', 'Pareti'], ['ingresso', 'Chi entra']].map(([id, label]) =>
      h('button', { class: 'seg-btn' + (tab === id ? ' on' : ''), role: 'tab', 'aria-selected': String(tab === id), onclick: () => { ui.editTab = id; update(); } }, label)));
    const pane = tab === 'pavimento' ? chips(FLOORS, room.floor, (v) => style({ floor: v }))
      : tab === 'pareti' ? h('div', { class: 'swatches' }, WALLS.map((c) => h('button', { class: 'swatch color' + (c === room.wall ? ' on' : ''), style: `--sw:${c}`, 'aria-label': 'Colore delle pareti', onclick: () => style({ wall: c }) })))
        : tab === 'ingresso' ? h('div', { class: 'stack' }, chips(ACCESS, room.access, (v) => style({ access: v })), h('p', { class: 'small' }, 'Chi entra vede i tuoi mobili e può parlare con te. Solo tu puoi spostarli.'))
          : strip;
    body = h('div', { class: 'stack' }, tabs, pane);
  }
  return h('div', { class: 'bar room-bar editing' }, head, body);
}

// Gli omini in città: chi è collegato (e io, se ho fatto l'accesso).
function syncAvatars() {
  const city = store.city;
  if (!city) return;
  const ids = new Set([...store.online].filter((id) => city.residents[id]));
  if (me() && city.residents[me().id]) ids.add(me().id);
  map.setAvatars([...[...ids].map((id) => ({
    id, name: city.residents[id].username, me: id === me()?.id, look: city.residents[id].look, ride: city.residents[id].ride,
    pos: store.avatars?.[id] || spawnPoint(city, id),
  })), ...shopPeople(), ...passersby()]);
}
// Commessi e manichini dei negozi: esistono solo sullo schermo, stanno fermi al loro posto.
const KEEPER_LOOKS = { mobili: { gender: 'uomo', skin: 2, hair: 6, style: 'corti', beard: 'baffi', shirt: 3, pants: 3, top: 'camicia', bottom: 'pantaloni', extra: 'occhiali' },
  moda: { gender: 'donna', skin: 1, hair: 0, style: 'coda', lips: 'rosso', shirt: 9, pants: 5, top: 'giacca', bottom: 'gonna', extra: 'nessuno' },
  bici: { gender: 'uomo', skin: 3, hair: 2, style: 'ricci', beard: 'barbetta', shirt: 4, pants: 1, top: 'felpa', bottom: 'pantaloncini', extra: 'cuffie' },
  comune: { gender: 'donna', skin: 2, hair: 1, style: 'chignon', lips: 'rosa', shirt: 5, pants: 5, top: 'giacca', bottom: 'gonna', extra: 'occhiali' },
  bar: { gender: 'uomo', skin: 3, hair: 0, style: 'corti', beard: 'baffi', shirt: 8, pants: 5, shoes: 0, top: 'camicia', bottom: 'pantaloni', extra: 'nessuno' } };
// Passanti: gente del paese che fa due passi, si siede in piazza, prende il caffè. Esistono solo
// sullo schermo di chi guarda e servono a dare vita alla città anche quando gli abitanti sono pochi.
const PASSERSBY = Array.from({ length: 8 }, (_, i) => ({
  id: 'npc:p:' + i,
  look: { skin: (i * 3) % 7, hair: (i * 5) % 9, style: ['corti', 'lunghi', 'coda', 'ricci'][i % 4], shirt: (i * 7 + 2) % 10, pants: i % 6,
    top: ['maglietta', 'camicia', 'righe', 'felpa', 'giacca', 'maglietta', 'camicia', 'canotta'][i], bottom: ['pantaloni', 'gonna', 'pantaloni', 'pantaloncini'][i % 4],
    extra: ['nessuno', 'paglia', 'occhiali', 'coppola', 'nessuno', 'basco', 'sciarpa', 'nessuno'][i] },
  ride: i === 3 ? 'bici' : i === 6 ? 'monopattino' : null,
  pos: [[38, 28], [42, 23], [35, 27], [45, 25], [41, 29], [37, 22], [50, 30], [43, 28]][i],
}));
function passersby() { return PASSERSBY.map((p) => ({ id: p.id, name: '', colors: avatarLook('passante', p.look), ride: p.ride, pos: p.pos })); }
// Ogni tanto un passante sceglie dove andare: un'altra via del centro, una panchina, il bar.
function strollPassersby() {
  const city = store.city;
  if (!city || document.hidden) return;
  const idle = PASSERSBY.map((p) => map.avatarOf(p.id)).filter((a) => a && !a.path.length);
  if (!idle.length) return;
  const a = idle[Math.floor(Math.random() * idle.length)];
  const r = Math.random();
  if (r < 0.2) {
    const [bx, by] = BENCHES[Math.floor(Math.random() * BENCHES.length)];
    const busy = [...map.avatars.values()].some((o) => o !== a && Math.round(o.x) === bx && Math.round(o.y) === by);
    if (!busy && map.walk(a.id, bx, by)) map.act(a.id, 'siedi');
    return;
  }
  if (r < 0.28) { map.act(a.id, Math.random() < 0.6 ? 'saluta' : 'balla'); return; }
  for (let i = 0; i < 10; i++) {
    const tx = Math.max(1, Math.min(W - 2, Math.round(a.x + (Math.random() - 0.5) * 16)));
    const ty = Math.max(1, Math.min(SEA_Y - 1, Math.round(a.y + (Math.random() - 0.5) * 12)));
    if (!city.roads[`${tx},${ty}`] || !walkable(city, tx, ty)) continue;
    if (map.walk(a.id, tx, ty)) return;
  }
}
function shopPeople() {
  const out = SHOPS.map((sh) => ({ id: 'npc:' + sh.id, name: sh.keeper, look: KEEPER_LOOKS[sh.id], pos: [...SHOP_KEEPER_AT, sh.room], dir: 'SW' }));
  MANNEQUINS.forEach((m, i) => {
    const colors = { ...avatarLook('manichino', m.look), skin: '#e9e4da', hair: '#e9e4da', style: 'pelato', mannequin: true };
    out.push({ id: 'npc:man:' + i, name: '', colors, pos: [...m.at, 'shop:moda'], dir: i % 2 ? 'SW' : 'SE' });
  });
  return out;
}

/* Avvio ------------------------------------------------------------------- */

async function boot() {
  shell();
  try {
    await store.init();
  } catch (e) {
    $('#bottom').replaceChildren(h('div', { class: 'bar' }, h('p', {}, errText(e)), h('button', { class: 'btn', onclick: () => location.reload() }, 'Riprova')));
    return;
  }
  map.setCity(store.city, { animateNew: false });
  store.subscribe((kind, data) => {
    if (kind === 'move') { if (data.id !== me()?.id) map.walk(data.id, data.x, data.y, data.room ?? null); return; }
    if (kind === 'say') { if (data.id !== me()?.id) map.say(data.id, data.text); return; }
    if (kind === 'act') { if (data.id !== me()?.id) map.act(data.id, data.act); return; }
    map.setCity(store.city);
    syncAvatars();
    update();
  });
  syncAvatars();
  update();

  // Link dalle email e provenienza (?da=instagram) dal link in bio.
  const q = new URLSearchParams(location.search);
  if (q.get('da')) ss.set('vi-source', q.get('da').replace(/[^a-z0-9_-]/gi, '').slice(0, 30));
  const confirmToken = q.get('conferma');
  const resetToken = q.get('nuova-password');
  if (!DEMO && (confirmToken || resetToken || q.get('da'))) history.replaceState(null, '', location.pathname);
  if (confirmToken) return confirmEmail(confirmToken);
  if (resetToken) return openResetForm(resetToken);
  if (location.pathname === '/giornale') return openGiornale();
  if (!me() && !ui.welcomeSeen) openWelcome();
  else if (me() && !myHouse()) startChoosing();
}

if ('serviceWorker' in navigator && !DEMO && location.protocol !== 'file:') navigator.serviceWorker.register('/sw.js').catch(() => {});
setInterval(update, 60000);
setInterval(strollPassersby, 2500);
setInterval(renderTicker, 6000);
// Il menu della demo si chiude toccando altrove.
addEventListener('pointerdown', (e) => {
  const menu = document.getElementById('demo-menu');
  if (menu && !menu.hidden && !e.target.closest('#demo-menu, #demo-chip')) toggleDemoMenu(false);
});
boot();
