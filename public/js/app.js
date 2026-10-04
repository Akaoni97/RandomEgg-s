// Guscio dell'applicazione: accesso, menu, router, palette comandi, preferenze.
import { getLocation, suggestLocations, presentLots, openPlans, ROLES, fmtTons, positionStats, KIND_LABEL, LOCATIONS } from './core.js';
import { App, h, icon, clear, fill, brandMark, toast, openDialog, openMenu, initials, fmtTime, fmtDayShort, dialogOpen, reducedMotion, input, field } from './ui.js';
import { forge } from './fx.js';
import { createStore } from './store.js';
import { addMaterialDialog, orderDialog, noteDialog, eventDialog, reportError } from './dialogs.js';
import {
  ui, renderSearch, renderPosition, renderOrders, renderMaterials, renderMovements, renderNotes, renderHistory, renderCalendar, renderSettings,
} from './views.js';

/* Preferenze (solo comodità del singolo dispositivo) ---------------- */

const PREF_KEY = 'magazzino-prefs';
const prefs = {
  theme: 'system',
  motion: 'auto',
  load() {
    try { Object.assign(this, JSON.parse(localStorage.getItem(PREF_KEY) || '{}')); } catch { /* niente */ }
    this.apply();
  },
  set(patch) {
    Object.assign(this, patch);
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ theme: this.theme, motion: this.motion })); } catch { /* niente */ }
    this.apply();
    render();
  },
  apply() {
    const root = document.documentElement;
    const map = { system: [null, null], forgia: ['dark', null], acciaio: ['light', null], cobalto: ['light', 'cobalto'], sole: ['light', 'sole'] };
    const [theme, palette] = map[this.theme] || map.system;
    // Con "Sistema" non tocchiamo un tema impostato da chi ospita la pagina.
    if (theme) { root.dataset.theme = theme; this.ownsTheme = true; } else if (this.ownsTheme) { delete root.dataset.theme; this.ownsTheme = false; }
    if (palette) root.dataset.palette = palette; else delete root.dataset.palette;
    if (this.motion === 'reduced') root.dataset.motion = 'reduced'; else delete root.dataset.motion;
  },
};

/* Navigazione -------------------------------------------------------- */

const NAV = [
  { id: 'ricerca', label: 'Ricerca', icon: 'search' },
  { id: 'ordini', label: 'Ordini di lavoro', icon: 'orders' },
  { id: 'materiali', label: 'Materiali e lotti', icon: 'layers' },
  { id: 'movimenti', label: 'Movimenti', icon: 'moves' },
  { id: 'appunti', label: 'Appunti', icon: 'note' },
  { id: 'storico', label: 'Storico', icon: 'history' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar' },
  { id: 'impostazioni', label: 'Impostazioni', icon: 'settings' },
];

let route = parseHash();
let root, shell, mainEl, mainInner, sidebarEl, scrimEl, topbarEl, tabbarEl;

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  if (raw.startsWith('pos-') && getLocation(raw.slice(4))) return raw;
  return NAV.some((n) => n.id === raw) ? raw : 'ricerca';
}

function navigate(to) {
  closeDrawer();
  if (to === route) { mainEl?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }); return; }
  route = to;
  try { history.pushState(null, '', `#${to}`); } catch { location.hash = to; }
  const run = () => { render({ nav: true }); mainEl.scrollTop = 0; };
  if (document.startViewTransition && !reducedMotion()) document.startViewTransition(run);
  else run();
}
App.navigate = navigate;
addEventListener('popstate', () => { route = parseHash(); render({ nav: true }); });
addEventListener('hashchange', () => { const r = parseHash(); if (r !== route) { route = r; render({ nav: true }); } });

/* Rendering ---------------------------------------------------------- */

let pending = false;
function render(opts = {}) {
  const store = App.store;
  if (!store) return;
  if (!store.user || !store.state) { renderLogin(); return; }
  if (!shell || !shell.isConnected) buildShell();

  // Non ridisegnare mentre si scrive in un campo della pagina: aggiorna appena si esce.
  const activeEl = document.activeElement;
  const typing = activeEl && mainEl.contains(activeEl) && activeEl.matches('input, textarea, select');
  if (typing && !opts.keepFocus && !opts.nav) {
    if (!pending) { pending = true; activeEl.addEventListener('blur', () => { pending = false; setTimeout(() => render(), 0); }, { once: true }); }
    updateChrome();
    return;
  }
  const focusId = typing ? activeEl.id : null;
  const sel = typing && activeEl.selectionStart != null ? [activeEl.selectionStart, activeEl.selectionEnd] : null;
  const scroll = mainEl.scrollTop;

  const s = store.state;
  let view;
  try {
    if (route.startsWith('pos-')) view = renderPosition(s, route.slice(4));
    else view = ({
      ricerca: renderSearch, ordini: renderOrders, materiali: renderMaterials, movimenti: renderMovements, appunti: renderNotes,
      storico: renderHistory, calendario: renderCalendar, impostazioni: (st) => renderSettings(st, prefs),
    }[route] || renderSearch)(s);
  } catch (e) {
    console.error(e);
    view = h('div.empty', icon('alert', 40), h('h3', 'Questa pagina non si è caricata'), h('p', String(e.message || e)), h('button.btn', { on: { click: () => navigate('ricerca') } }, 'Torna alla ricerca'));
  }
  fill(mainInner, view);
  if (!opts.nav) mainEl.scrollTop = scroll;
  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch { /* niente */ } }
  }
  updateChrome();
}
App.render = render;

function buildShell() {
  root = document.getElementById('app');
  clear(root);
  sidebarEl = h('aside.sidebar', { id: 'sidebar', 'aria-label': 'Menu principale' });
  scrimEl = h('div.scrim', { on: { click: closeDrawer } });
  topbarEl = h('header.topbar');
  mainInner = h('div.main-inner', { style: 'view-transition-name: main-content' });
  mainEl = h('main.main', { id: 'main', tabindex: '-1' }, topbarEl, mainInner);
  tabbarEl = h('nav.tabbar', { 'aria-label': 'Navigazione rapida' });
  shell = h('div.shell.grain', sidebarEl, mainEl, scrimEl, tabbarEl);
  root.append(h('a.sr-only', { href: '#main', on: { focus: (e) => e.target.classList.remove('sr-only'), blur: (e) => e.target.classList.add('sr-only') } }, 'Vai al contenuto'), shell);
}

function counts() {
  const s = App.store.state;
  const today = App.store.today();
  return {
    orders: s.orders.filter((o) => (o.status === 'Da fare' || o.status === 'Programmato') && o.date <= today).length,
    notes: s.notes.filter((n) => n.status !== 'Risolto').length,
  };
}

function statusInfo() {
  const store = App.store;
  const st = store.status;
  if (st.saving) return { cls: 'busy', title: 'Salvataggio…', sub: 'Attendi la conferma' };
  if (!st.online) return { cls: 'bad', title: 'Non connesso', sub: 'Le modifiche NON vengono salvate' };
  if (store.mode === 'demo') return { cls: 'demo', title: 'Demo locale', sub: 'Dati solo in questo browser' };
  return { cls: 'ok', title: 'Online · condiviso', sub: `Aggiornato alle ${fmtTime(st.lastSync)}` };
}

function updateChrome() {
  const store = App.store;
  const user = store.user;
  const c = counts();
  const st = statusInfo();
  const current = route.startsWith('pos-') ? 'ricerca' : route;

  fill(sidebarEl, 
    h('a.brand', { href: '#ricerca', on: { click: (e) => { e.preventDefault(); navigate('ricerca'); } } }, brandMark(42),
      h('span.brand-text', h('span.brand-title', 'MAGAZZINO'), h('span.brand-sub', 'Ferroleghe · MPR Logistics'))),
    h('button.btn-forge', { type: 'button', on: { click: () => { closeDrawer(); addMaterialDialog({ locationId: route.startsWith('pos-') ? route.slice(4) : null }); } } }, icon('plus', 20), 'Aggiungi materiale'),
    h('nav.nav', h('div.nav-label', 'Lavoro'),
      NAV.map((n) => h('a', { href: `#${n.id}`, 'aria-current': current === n.id ? 'page' : null, on: { click: (e) => { e.preventDefault(); navigate(n.id); } } },
        icon(n.icon, 19), n.label,
        n.id === 'ordini' && c.orders ? h('span.badge', { title: 'Ordini aperti per oggi o in ritardo' }, String(c.orders)) : null,
        n.id === 'appunti' && c.notes ? h('span.badge.soft', String(c.notes)) : null))),
    h('div.sidebar-foot',
      h('div.conn', { role: 'status' }, h('span.dot.' + st.cls), h('span', h('b', st.title), st.sub)),
      h('div.profile', h('div.avatar', initials(user.name)),
        h('div.profile-text', h('div.profile-name', user.name), h('div.profile-role', ROLES[user.role] || user.role)),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Cambia tema', title: 'Cambia tema', on: { click: cycleTheme } }, icon(isDark() ? 'sun' : 'moon', 18)),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Esci', title: 'Esci', on: { click: logout } }, icon('logout', 18)))));

  const crumbs = route.startsWith('pos-')
    ? [h('a.crumb-parent', { href: '#ricerca', on: { click: (e) => { e.preventDefault(); navigate('ricerca'); } } }, 'Ricerca'), h('span.crumb-parent', '/'), h('b', getLocation(route.slice(4)).name)]
    : [h('b', NAV.find((n) => n.id === route)?.label || 'Ricerca')];
  const off = store.mode === 'demo' ? store.offsetDays : 0;
  fill(topbarEl, 
    h('button.icon-btn.menu-btn', { type: 'button', 'aria-label': 'Apri menu', 'aria-controls': 'sidebar', 'aria-expanded': String(sidebarEl.classList.contains('open')), on: { click: openDrawer } }, icon('menu', 22)),
    h('div.crumbs', crumbs),
    off ? h('button.clock-chip', { type: 'button', title: 'Data simulata dalla demo', on: { click: () => navigate('impostazioni') } }, icon('clock', 14), `Data demo: ${fmtDayShort(store.today())}`) : null,
    h('span.top-status', { title: `${st.title} · ${st.sub}` }, h('span.dot.' + st.cls), h('span.sr-only', st.title)),
    h('button.kbd-btn', { type: 'button', on: { click: openPalette } }, icon('search', 16), 'Cerca ovunque', h('kbd', '⌘K')),
    h('button.icon-btn.top-avatar', { type: 'button', 'aria-label': `Profilo di ${user.name}`, on: { click: (e) => openMenu(e.currentTarget, [
      { label: `${user.name} · ${ROLES[user.role]}`, icon: 'user', run: () => navigate('impostazioni') },
      { label: isDark() ? 'Tema chiaro' : 'Tema scuro', icon: isDark() ? 'sun' : 'moon', run: cycleTheme },
      { label: 'Cerca ovunque', icon: 'search', run: openPalette },
      '-',
      { label: 'Esci', icon: 'logout', run: logout },
    ]) } }, h('span.avatar', initials(user.name))));

  const tab = (id, label, ic, badge) => h('a', { href: `#${id}`, 'aria-current': current === id ? 'page' : null, on: { click: (e) => { e.preventDefault(); navigate(id); } } }, icon(ic, 22), label);
  fill(tabbarEl, 
    tab('ricerca', 'Ricerca', 'search'),
    tab('materiali', 'Materiali', 'layers'),
    h('div.fab-wrap', h('button.fab', { type: 'button', 'aria-label': 'Aggiungi materiale', on: { click: () => addMaterialDialog({ locationId: route.startsWith('pos-') ? route.slice(4) : null }) } }, icon('plus', 28))),
    tab('ordini', c.orders ? `Ordini · ${c.orders}` : 'Ordini', 'orders'),
    tab('appunti', 'Appunti', 'note'));
}

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
function cycleTheme() { prefs.set({ theme: isDark() ? 'acciaio' : 'forgia' }); }

function openDrawer() {
  sidebarEl.classList.add('open');
  scrimEl.classList.add('open');
  sidebarEl.querySelector('a[aria-current], a')?.focus();
}
function closeDrawer() {
  sidebarEl?.classList.remove('open');
  scrimEl?.classList.remove('open');
}

async function logout() {
  await App.store.logout();
  shell = null;
  render();
}

/* Accesso ------------------------------------------------------------ */

let stopForge = null;
function renderLogin() {
  shell = null;
  root = document.getElementById('app');
  stopForge?.();
  const store = App.store;
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const card = h('div.login-card');
  const art = h('div.login-art', canvas, h('div.glow'),
    h('div', { style: 'position:relative;display:flex;align-items:center;gap:12px;margin-bottom:auto' }, brandMark(44),
      h('span', { style: 'font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--on-steel-2)' }, 'MPR Logistics')),
    h('h1.login-word', h('span', 'MAGAZZINO'), h('span', 'FERROLEGHE')),
    h('p.login-tag', 'Baie, mucchi e tettoia. Che materiale c\'è, dove si trova, quanto ne resta: dal telefono, senza passare in ufficio.'));
  fill(root, h('div.login', art, h('div.login-panel', card)));
  requestAnimationFrame(() => { stopForge = forge(canvas); });

  if (store.mode === 'demo') {
    card.append(
      h('div', h('div.eyebrow', 'Versione dimostrativa'), h('h2', { style: 'margin-top:6px' }, 'Chi sta lavorando?')),
      h('div.demo-banner', icon('alert', 20), h('span', 'Accesso dimostrativo: nessuna password e nessuna sicurezza. I dati sono inventati e restano solo in questo browser. Il server incluso nel progetto ha account veri.')),
      h('div', { style: 'display:grid;gap:10px' }, store.users.map((u, i) => h('button.persona', { type: 'button', style: `animation:rise 600ms ${300 + i * 90}ms both`, on: { click: () => { store.login(u.id); stopForge?.(); render({ nav: true }); toast(`Ciao ${u.name}: lavori come ${ROLES[u.role]}.`); } } },
        h('span.avatar', initials(u.name)), h('span', h('b', u.name), h('span', ROLES[u.role])), icon('chevR', 20)))));
    return;
  }

  // Server reale
  const err = h('div', { role: 'alert' });
  const fail = (e) => fill(err, h('div.form-error', icon('alert', 18), e.message));
  if (store.needsSetup) {
    const code = input({ id: 'su-code', autocomplete: 'off', class: 'mono' });
    const name = input({ id: 'su-name', autocomplete: 'name' });
    const user = input({ id: 'su-user', autocomplete: 'username', autocapitalize: 'none' });
    const pass = input({ id: 'su-pass', type: 'password', autocomplete: 'new-password' });
    card.append(h('div', h('div.eyebrow', 'Prima configurazione'), h('h2', { style: 'margin-top:6px' }, 'Crea l\'amministratore')), err,
      h('form', { style: 'display:grid;gap:14px', on: { submit: async (e) => { e.preventDefault(); try { await store.setup({ setupCode: code.value, name: name.value, username: user.value.trim().toLowerCase(), password: pass.value }); stopForge?.(); render({ nav: true }); } catch (x) { fail(x); } } } },
        field('Codice di configurazione', code, { hint: 'Lo trovi nella console del server all\'avvio.' }), field('Nome', name), field('Nome utente', user), field('Password (min. 8 caratteri)', pass),
        h('button.btn-forge', { type: 'submit' }, 'Crea e accedi')));
    return;
  }
  let mode = 'login';
  const body = h('div', { style: 'display:grid;gap:14px' });
  const tabs = h('div.seg', { role: 'tablist' });
  const draw = () => {
    fill(tabs, 
      h('button', { type: 'button', 'aria-pressed': String(mode === 'login'), on: { click: () => { mode = 'login'; draw(); } } }, 'Accedi'),
      h('button', { type: 'button', 'aria-pressed': String(mode === 'invite'), on: { click: () => { mode = 'invite'; draw(); } } }, 'Ho un invito'));
    clear(err);
    clear(body);
    if (mode === 'login') {
      const user = input({ id: 'li-user', autocomplete: 'username', autocapitalize: 'none' });
      const pass = input({ id: 'li-pass', type: 'password', autocomplete: 'current-password' });
      body.append(h('form', { style: 'display:grid;gap:14px', on: { submit: async (e) => { e.preventDefault(); try { await store.login(user.value, pass.value); stopForge?.(); render({ nav: true }); } catch (x) { fail(x); } } } },
        field('Nome utente', user), field('Password', pass), h('button.btn-forge', { type: 'submit' }, 'Entra')));
    } else {
      const inv = input({ id: 'rg-inv', class: 'mono', autocomplete: 'off' });
      const name = input({ id: 'rg-name', autocomplete: 'name' });
      const user = input({ id: 'rg-user', autocomplete: 'username', autocapitalize: 'none' });
      const pass = input({ id: 'rg-pass', type: 'password', autocomplete: 'new-password' });
      body.append(h('form', { style: 'display:grid;gap:14px', on: { submit: async (e) => { e.preventDefault(); try { await store.register({ invite: inv.value, name: name.value, username: user.value, password: pass.value }); stopForge?.(); render({ nav: true }); } catch (x) { fail(x); } } } },
        field('Codice d\'invito', inv), field('Nome e cognome', name), field('Nome utente', user, { hint: 'Minuscole, numeri, punto o trattino.' }), field('Password (min. 8 caratteri)', pass),
        h('button.btn-forge', { type: 'submit' }, 'Crea account')));
    }
  };
  card.append(h('div', h('div.eyebrow', 'Area riservata'), h('h2', { style: 'margin-top:6px' }, 'Accedi al magazzino')), tabs, err, body);
  draw();
}

/* Palette comandi ---------------------------------------------------- */

function openPalette() {
  if (document.querySelector('.palette')) return;
  const s = App.store.state;
  const inp = h('input', { id: 'pal-q', type: 'search', placeholder: 'Posizione, lotto, materiale o comando…', autocomplete: 'off', role: 'combobox', 'aria-controls': 'pal-list', 'aria-expanded': 'true' });
  const list = h('div.palette-list', { id: 'pal-list', role: 'listbox' });
  let items = [];
  let active = 0;
  let dlg;
  const commands = [
    { label: 'Aggiungi materiale', kind: 'Comando', icon: 'plus', run: () => addMaterialDialog() },
    { label: 'Nuovo arrivo su più giorni', kind: 'Comando', icon: 'truck', run: () => addMaterialDialog({ tab: 'plan' }) },
    { label: 'Nuovo ordine di lavoro', kind: 'Comando', icon: 'orders', run: () => orderDialog(null) },
    { label: 'Nuovo appunto', kind: 'Comando', icon: 'note', run: () => noteDialog(null) },
    { label: 'Nuovo evento', kind: 'Comando', icon: 'calendar', run: () => eventDialog(null) },
    ...NAV.map((n) => ({ label: n.label, kind: 'Pagina', icon: n.icon, run: () => navigate(n.id) })),
  ];
  function compute() {
    const q = inp.value.trim().toLowerCase();
    const locs = (q ? suggestLocations(q, 5) : LOCATIONS.slice(0, 0)).map((l) => {
      const st = positionStats(s, l.id);
      return { label: l.name, kind: `${KIND_LABEL[l.kind]} · ${st.present ? fmtTons(st.present) : 'vuota'}`, icon: 'pin', run: () => navigate(`pos-${l.id}`) };
    });
    const lots = q ? presentLots(s).filter((l) => `${l.lotCode} ${l.material} ${l.client}`.toLowerCase().includes(q)).slice(0, 6)
      .map((l) => ({ label: `${l.lotCode} · ${l.material}`, kind: `${getLocation(l.locationId).name} · ${fmtTons(l.tons)}`, icon: 'ingot', run: () => navigate(`pos-${l.locationId}`) })) : [];
    const plans = q ? openPlans(s).filter((p) => `${p.lotCode} ${p.material}`.toLowerCase().includes(q)).slice(0, 3)
      .map((p) => ({ label: `${p.lotCode} · in arrivo`, kind: getLocation(p.locationId).name, icon: 'truck', run: () => navigate(`pos-${p.locationId}`) })) : [];
    const cmds = commands.filter((c) => !q || c.label.toLowerCase().includes(q));
    items = [...locs, ...lots, ...plans, ...cmds].slice(0, 14);
    active = Math.min(active, Math.max(0, items.length - 1));
    clear(list);
    items.forEach((it, i) => list.append(h('div', { role: 'option', id: `pal-${i}`, 'aria-selected': String(i === active), on: { pointerdown: (e) => { e.preventDefault(); choose(i); }, pointermove: () => { if (active !== i) { active = i; mark(); } } } },
      icon(it.icon, 18), h('span', it.label), h('span.p-kind', it.kind))));
    if (!items.length) list.append(h('p.muted', { style: 'padding:14px' }, 'Nessun risultato.'));
    inp.setAttribute('aria-activedescendant', items.length ? `pal-${active}` : '');
  }
  function mark() {
    [...list.children].forEach((c, i) => c.setAttribute?.('aria-selected', String(i === active)));
    list.children[active]?.scrollIntoView?.({ block: 'nearest' });
    inp.setAttribute('aria-activedescendant', `pal-${active}`);
  }
  function choose(i) {
    const it = items[i];
    if (!it) return;
    dlg.close();
    setTimeout(() => it.run(), 60);
  }
  inp.addEventListener('input', () => { active = 0; compute(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, items.length); mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % Math.max(1, items.length); mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
  });
  dlg = openDialog({
    className: 'palette', labelledBy: 'pal-q',
    body: h('div', { style: 'display:grid;margin:-4px -20px -20px' }, h('div.search-field', icon('search', 22), inp), list,
      h('div.palette-foot', h('span', h('kbd', '↑↓'), ' scegli'), h('span', h('kbd', 'Invio'), ' apri'), h('span', h('kbd', 'Esc'), ' chiudi'))),
  });
  compute();
}

addEventListener('keydown', (e) => {
  if (!App.store?.user) return;
  const typing = e.target.matches?.('input, textarea, select, [contenteditable]');
  if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing && !dialogOpen())) {
    e.preventDefault();
    openPalette();
  }
  if (e.key === 'Escape' && sidebarEl?.classList.contains('open')) closeDrawer();
});

/* Avvio -------------------------------------------------------------- */

async function boot() {
  prefs.load();
  const host = document.getElementById('app');
  try {
    App.store = await createStore();
  } catch (e) {
    host.textContent = `Impossibile avviare: ${e.message}`;
    return;
  }
  const store = App.store;
  store.subscribe((kind) => {
    if (kind === 'status') { if (shell) updateChrome(); return; }
    if (kind === 'auth') { shell = null; }
    if (kind === 'remote' && store.user && shell) {
      // un altro dispositivo ha salvato: aggiornamento silenzioso
    }
    render();
  });
  if (store.mode === 'demo') setInterval(() => store.tick(), (store.state.settings.reconcileSeconds || 30) * 1000);
  addEventListener('online', () => store.mode === 'server' && store.pull?.().catch(() => {}));
  addEventListener('offline', () => store.setStatus({ online: false, error: 'Rete assente' }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (store.mode === 'demo') store.tick(); else store.pull?.().catch((e) => reportError(e));
  });
  render({ nav: true });
}

boot();
