// Interfaccia di Virtual-Italy: mappa a tutto schermo, schede dal basso, iscrizione, scelta del lotto,
// costruzione della casa, amicizie, giornale e redazione.
import {
  CITY, PAPER, ROOFS, DOORS, GARDENS, DECOS, PLAN, FOUNDERS, RESERVE_MS, UNLOCK_RATIO,
  districtAt, districtById, parseKey, makeStyle, residentHouse, builtCount, isFounder, areFriends, friendsOf,
  formatNews, nextGoal, goalProgress, lotsOpen, DomainError, frontOf, spawnPoint, LOOK, cleanLook, SAY_PRESETS, SAY_MAX,
  FURNI, FLOORS, WALLS, ACCESS, ROOM_DOOR, furniById, roomOf, canVisit,
  SHOPS, shopById, isShopRoom, FURNI_CATS, WEAR, WEAR_SLOTS, wearById, invOf, ownsWear, SHOP_KEEPER_AT, MANNEQUINS,
  seatAt, footprint, missionStatus, progressOf, dayKey, weekKey, heartsThisWeek, weekRanking, WELCOME_PRIZE,
  RIDES, rideById, walkable, W, SEA_Y, BENCHES, WALK_SPEED,
} from './core.js';
import { CityMap, drawPreview, renderPoster, drawAvatarPreview, avatarLook, drawFurniIcon, drawAvatarIcon, drawRideIcon } from './render.js';
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
  turnL: '<path d="M8 4 4 8l4 4"/><path d="M4 8h9a6 6 0 0 1 0 12H9"/>',
  turnR: '<path d="m16 4 4 4-4 4"/><path d="M20 8h-9a6 6 0 0 0 0 12h4"/>',
  fountain: '<path d="M4 15h16M6 15c0 3 2.7 5 6 5s6-2 6-5M12 15V8M12 8c-2 0-3.5 1.2-4 3M12 8c2 0 3.5 1.2 4 3M12 5v1"/>',
  flask: '<path d="M10 3h4M10.5 3v5.5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5.5-9.5V3M7.5 14h9"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c.9 1.4 2.1 2 3.5 2s2.6-.6 3.5-2M9 9.5v.5M15 9.5v.5"/>',
};
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
        h('button', { class: 'brand', onclick: () => { closeSheet(); map.fitCentro(); }, 'aria-label': 'Torna al centro della città' },
          h('span', { class: 'brand-mark', 'aria-hidden': 'true', html: BRAND_MARK }),
          h('span', { class: 'brand-text' },
            h('span', { class: 'brand-name' }, 'Virtual', h('span', { class: 'brand-dash' }, '-'), 'Italy'),
            h('span', { class: 'brand-count', id: 'count' }))),
        DEMO ? h('button', { class: 'demo-chip', id: 'demo-chip', 'aria-expanded': 'false', onclick: toggleDemoMenu }, icon('flask'), h('span', { class: 'demo-label' }, 'Demo')) : null,
        h('nav', { class: 'top-actions', 'aria-label': 'Comandi' },
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
      h('button', { class: 'tab', onclick: () => map.zoomStep(1), 'aria-label': 'Ingrandisci' }, icon('plus')),
      h('button', { class: 'tab', onclick: () => map.zoomStep(-1), 'aria-label': 'Rimpicciolisci' }, icon('minus')),
      h('button', { class: 'tab turn', onclick: () => map.rotate(-1), 'aria-label': 'Gira la città a sinistra' }, icon('turnL')),
      h('button', { class: 'tab turn', onclick: () => map.rotate(1), 'aria-label': 'Gira la città a destra' }, icon('turnR'))),
    h('footer', { class: 'bottom', id: 'bottom' }),
    h('div', { class: 'scrim', id: 'scrim', hidden: true, onclick: closeSheet }),
    h('section', { class: 'sheet', id: 'sheet', hidden: true, role: 'dialog', 'aria-modal': 'true' }),
    h('div', { class: 'toasts', id: 'toasts' }),
  );
  map = new CityMap($('#map'), { onTap });
  if (!map.t3) for (const b of document.querySelectorAll('.zoom .turn')) b.hidden = true;
  window.__virtualItaly = { store, map }; // comodo per il debug dalla console
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
  else if (!house) cta = h('button', { class: 'btn primary big', onclick: startChoosing }, 'Scegli il tuo lotto');
  else if (house.status === 'casa') cta = h('button', { class: 'btn primary big', onclick: () => enterHouse(mine.id) }, icon('home'), 'Entra in casa');
  else cta = h('button', { class: 'btn big', onclick: () => { map.focus(house.slot, 2); openHouse(house.slot); } }, icon('home'), 'La mia casa');
  const talk = mine && map.avatarOf(mine.id) ? chatBar() : null;
  bottom.replaceChildren(h('div', { class: 'bar' }, talk, goal, cta));
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
function openMissions() {
  const mine = me();
  if (!mine) return openLogin();
  const city = store.city;
  const st = missionStatus(city, mine.id, Date.now());
  const claim = (what) => (e) => run(e.currentTarget, async () => {
    const r = await store.op({ type: 'claim', what });
    if (r.prize) toast(`Premio: ${furniById(r.prize).label}! La trovi in casa, nel pannello Arreda.`);
    else toast(r.streak > 1 ? `Fatto! Sono ${r.streak} giorni di fila 🔥` : 'Fatto! Torna domani per la prossima missione 🔥');
    openMissions(); update();
  });
  const n = st.welcome.filter((m) => m.done).length;
  const welcome = st.welcomeClaimed ? null : h('section', { class: 'missions' },
    h('div', { class: 'missions-head' }, h('h3', {}, 'Benvenuto in città'), h('span', { class: 'tag' }, `${n}/${st.welcome.length}`)),
    h('ul', { class: 'mission-list' }, st.welcome.map((m) => h('li', { class: 'mission' + (m.done ? ' done' : '') },
      h('span', { class: 'mission-tick', 'aria-hidden': 'true' }, m.done ? '✓' : ''),
      h('span', { class: 'mission-body' }, h('strong', {}, m.label), m.done ? null : h('span', { class: 'small' }, m.hint))))),
    h('p', { class: 'small' }, `Premio finale: ${furniById(WELCOME_PRIZE).label.toLowerCase()} da mettere in casa, solo per chi le completa tutte.`),
    st.welcomeReady ? h('button', { class: 'btn primary big', onclick: claim('welcome') }, 'Ritira il premio') : null);
  const daily = h('section', { class: 'missions daily' },
    h('div', { class: 'missions-head' }, h('h3', {}, 'Missione del giorno'), h('span', { class: 'tag gold' }, `🔥 ${st.streak} ${st.streak === 1 ? 'giorno' : 'giorni'} di fila`)),
    h('div', { class: 'mission' + (st.daily.done ? ' done' : '') }, h('span', { class: 'mission-tick', 'aria-hidden': 'true' }, st.daily.done ? '✓' : ''), h('span', { class: 'mission-body' }, h('strong', {}, st.daily.label))),
    st.daily.claimed ? h('p', { class: 'small' }, 'Fatta! Domani ne arriva un\'altra: non perdere la serie.')
      : st.daily.done ? h('button', { class: 'btn primary', onclick: claim('daily') }, 'Segna come fatta')
        : h('p', { class: 'small' }, 'Ogni giorno una missione nuova, uguale per tutti. Completale di fila per allungare la serie.'));
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
        toast(`Account creato. Ti abbiamo mandato un'email per confermare.`);
        openCharacter({ first: true });
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

function openCharacter({ first = false } = {}) {
  const r = myResident();
  if (!r) return openLogin();
  const look = cleanLook(r.look, r.username);
  const preview = h('canvas', { class: 'avatar-preview', width: 360, height: 360, 'aria-label': 'Anteprima del tuo personaggio' });
  const groups = h('div', { class: 'stack' });
  // L'omino cammina sul posto e si gira nelle quattro direzioni.
  const t0 = performance.now();
  const animate = (t) => {
    if (!preview.isConnected) return;
    drawAvatarPreview(preview, avatarLook(r.username, look), t - t0);
    requestAnimationFrame(animate);
  };
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
  // Nei vestiti compare solo quello che si ha: i capi base più quelli presi alla Sartoria.
  const owned = (slot) => WEAR.filter((w) => w.slot === slot && ownsWear(store.city, r.id, w.id));
  const paint = () => groups.replaceChildren(
    colorRow('Carnagione', 'skin', LOOK.skin),
    idRow('Pettinatura', 'style', LOOK.style),
    colorRow('Colore dei capelli', 'hair', LOOK.hair),
    idRow('Maglia', 'top', owned('top')),
    colorRow('Colore della maglia', 'shirt', LOOK.shirt),
    idRow('Sotto', 'bottom', owned('bottom')),
    colorRow('Colore di pantaloni e gonne', 'pants', LOOK.pants),
    idRow('Accessorio', 'extra', owned('extra')),
    WEAR.some((w) => !ownsWear(store.city, r.id, w.id)) ? h('p', { class: 'small' }, 'Altri vestiti e accessori ti aspettano alla Sartoria Moda, accanto alla piazza.') : null);
  const shuffle = () => {
    const pick = (n) => Math.floor(Math.random() * n);
    const any = (list) => list[pick(list.length)].id;
    Object.assign(look, { skin: pick(LOOK.skin.length), hair: pick(LOOK.hair.length), style: LOOK.style[pick(LOOK.style.length)].id,
      shirt: pick(LOOK.shirt.length), pants: pick(LOOK.pants.length), extra: any(owned('extra')), top: any(owned('top')), bottom: any(owned('bottom')) });
    paint();
  };
  paint();
  const save = h('button', { class: 'btn primary big', onclick: (e) => run(e.currentTarget, async () => {
    await store.op({ type: 'look', look });
    if (first) { toast('Che stile! Ora scegli dove costruire casa.'); startChoosing(); }
    else { closeSheet(); toast('Personaggio aggiornato'); }
  }) }, first ? 'Avanti: scegli il lotto' : 'Salva il personaggio');
  openSheet(first ? 'Come sei?' : 'Il mio personaggio', h('div', { class: 'stack' },
    h('div', { class: 'avatar-head' }, preview,
      h('div', { class: 'stack' },
        h('p', { class: 'small' }, first ? `Questo è ${r.username}: così ti vedranno gli altri abitanti mentre passeggi.` : 'Così ti vedono gli altri abitanti mentre passeggi.'),
        h('button', { class: 'btn small', onclick: shuffle }, 'A caso'))),
    groups, save), { wide: true, onClose: first ? () => { if (!myHouse() && ui.mode !== 'choose') startChoosing(); } : undefined });
  requestAnimationFrame(animate);
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
  if (shop) setTimeout(() => map.say('npc:' + shop.id, shop.kind === 'wear' ? `Ciao ${mine.username}! Tocca un manichino o il catalogo.` : `Benvenuto ${mine.username}! Tocca un mobile per prenderlo.`), 350);
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
  if (shop) map.focus([shop.x0 + 1, shop.y0 + 1]);
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
  const what = shop.kind === 'wear' ? 'Maglie, gonne, cappelli e accessori per il tuo omino.'
    : shop.kind === 'ride' ? 'Skateboard, biciclette e monopattini elettrici: a piedi si va a passo d\'uomo, con un mezzo si gira la città più svelti.'
      : 'Mobili e decorazioni da portare a casa e sistemare come vuoi.';
  openSheet(shop.name, h('div', { class: 'stack' },
    h('div', { class: 'badges' }, h('span', { class: 'tag live' }, 'Aperto'), h('span', { class: 'tag gold' }, 'Inaugurazione: tutto gratis')),
    h('p', {}, what),
    h('p', { class: 'small' }, `Dietro al bancone c'è ${shop.keeper}. Presto in città arriverà la moneta di ${CITY}: i prezzi sono già pronti.`),
    me() ? h('button', { class: 'btn primary big', onclick: () => enterHouse(shop.room) }, 'Entra nel negozio')
      : h('button', { class: 'btn primary', onclick: openRegister }, 'Iscriviti per fare acquisti')));
}
// Il cartellino del prezzo: per ora tutto gratis, il numero servirà con la moneta.
const priceTag = () => h('span', { class: 'price' }, 'Gratis');
async function buyFurni(t) {
  const f = furniById(t);
  const res = await run(null, () => store.op({ type: 'buy', kind: 'furni', t }));
  if (res) toast(`${f.label}: nell'inventario (${res.have} da sistemare)`);
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
    toast(has ? `Ora indossi: ${w.label.toLowerCase()}` : `${w.label}: preso! Ti sta benissimo.`);
  });
  openSheet(w.label, h('div', { class: 'stack' },
    h('div', { class: 'avatar-head' }, cv, h('div', { class: 'stack' },
      h('p', { class: 'small' }, has ? 'È già nel tuo armadio.' : 'Ecco come ti starebbe. Il colore lo cambi quando vuoi dal tuo personaggio.'),
      has ? null : priceTag())),
    h('button', { class: 'btn primary big', onclick: wearNow }, has ? 'Indossa' : 'Prendi e indossa'),
    has ? null : h('button', { class: 'btn', onclick: (e) => run(e.currentTarget, async () => { await store.op({ type: 'buy', kind: 'wear', id: w.id }); closeSheet(); toast(`${w.label}: nel tuo armadio`); }) }, 'Prendi e tienilo da parte')), { wide: true });
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
      has ? h('p', { class: 'small' }, on ? 'Ci sei già sopra.' : 'È già tuo.') : priceTag())),
    has ? (on ? h('button', { class: 'btn big', onclick: go({ type: 'ride', id: null }, 'Sei sceso: si va a piedi') }, 'Scendi e vai a piedi')
      : h('button', { class: 'btn primary big', onclick: go({ type: 'ride', id: m.id }, `In sella! ${m.label}`) }, 'Sali'))
      : h('button', { class: 'btn primary big', onclick: go({ type: 'buy', kind: 'ride', id: m.id, use: true }, `${m.label}: è tuo! Esci e fatti un giro`) }, 'Prendi e sali'),
    h('p', { class: 'small' }, 'In casa e nei negozi si entra sempre a piedi.')), { wide: true });
  requestAnimationFrame(anim);
}
function onNpcTap(id) {
  if (id.startsWith('npc:p:')) { map.say(id, ['Buongiorno!', 'Bella giornata, eh?', 'Ciao!', 'Hai visto la fontana?', 'Vado a prendere un caffè'][Math.floor(Math.random() * 5)]); return; }
  const shop = shopById(ui.room);
  if (!shop) return;
  const m = /^npc:man:(\d+)$/.exec(id);
  if (m) {
    // Il manichino mostra un capo in vendita: si apre la prova di quello.
    const look = MANNEQUINS[+m[1]].look;
    return openWear(['extra', 'top', 'bottom'].map((k) => wearById(look[k])).find((w) => w && !w.base));
  }
  map.say(id, shop.kind === 'wear' ? 'Prova quello che vuoi, oggi è tutto gratis!' : shop.kind === 'ride' ? 'Fatti un giro di prova, oggi è tutto gratis!' : 'Scegli pure: oggi è tutto gratis!');
}
// Barra in basso dentro un negozio: il catalogo completo, diviso per reparto.
function shopBar(shop) {
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
      return h('button', { class: 'catalog-item', role: 'listitem', onclick: () => openRide(m) }, cv, h('span', {}, m.label), owned.includes(m.id) ? h('span', { class: 'owned' }, r.ride === m.id ? 'Ci sei sopra' : 'Già tuo') : priceTag());
    });
  } else if (shop.kind === 'wear') {
    const base = r ? cleanLook(r.look, r.username) : null;
    items = WEAR.filter((w) => w.slot === tab && !w.base).map((w) => {
      const cv = h('canvas', { width: 112, height: 112, 'aria-hidden': 'true' });
      drawAvatarIcon(cv, avatarLook(r?.username || 'ospite', { ...base, [w.slot]: w.id }));
      const has = r && ownsWear(store.city, r.id, w.id);
      return h('button', { class: 'catalog-item', role: 'listitem', onclick: () => openWear(w) }, cv, h('span', {}, w.label), has ? h('span', { class: 'owned' }, 'Già tuo') : priceTag());
    });
  } else {
    const inv = r ? invOf(store.city, r.id).furni : {};
    items = FURNI.filter((f) => f.cat === tab).map((f) => {
      const cv = h('canvas', { width: 112, height: 112, 'aria-hidden': 'true' });
      drawFurniIcon(cv, f.id, 0);
      return h('button', { class: 'catalog-item', role: 'listitem', onclick: () => buyFurni(f.id) }, cv, h('span', {}, f.label), inv[f.id] ? h('span', { class: 'owned' }, `Ne hai ${inv[f.id]}`) : priceTag());
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
const KEEPER_LOOKS = { mobili: { skin: 2, hair: 6, style: 'corti', shirt: 3, pants: 3, top: 'camicia', bottom: 'pantaloni', extra: 'occhiali' },
  moda: { skin: 1, hair: 0, style: 'coda', shirt: 9, pants: 5, top: 'giacca', bottom: 'gonna', extra: 'nessuno' },
  bici: { skin: 3, hair: 2, style: 'ricci', shirt: 4, pants: 1, top: 'felpa', bottom: 'pantaloncini', extra: 'cuffie' } };
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
    const colors = { ...avatarLook('manichino', m.look), skin: '#e9e4da', hair: '#e9e4da', style: 'corti' };
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
