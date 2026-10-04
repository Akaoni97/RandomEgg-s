// Pagine dell'applicazione. Ogni funzione riceve lo stato e restituisce il contenuto centrale.
import {
  LOCATIONS, getLocation, findLocation, suggestLocations, positionStats, presentLots, openPlans, planResidual,
  planRemainingContainers, planSchedule, autoTarget, planEstimatedUnconfirmed, lotHasEstimates, locationHistory,
  movementSignFor, frequentLocations, fmtTons, fmtNum, round3, MOVEMENT_TYPES, ROLES, NOTE_STATUSES, ORDER_STATUSES,
  canDeleteNote, canDo, addDays, daysBetween, previewTargeted, validateBackup, APP_VERSION, KIND_LABEL, compareLocations, romeDate,
} from './core.js';
import {
  App, h, icon, clear, fill, openMenu, toast, fmtDayShort, fmtDayLong, fmtDayMonth, fmtTime, fmtDateTime, field, input, select,
  textarea, copyText, initials, openDialog, confirmDialog, switchControl, reducedMotion,
} from './ui.js';
import { countUp, previousWidth } from './fx.js';
import { scene, vehicle, lotArt, idleLift, truckSvg, forkliftSvg } from './art.js';
import {
  act, addMaterialDialog, qtyDialog, unloadAllDialog, editLotDialog, transferDialog, deleteLotDialog, editPlanDialog,
  receiveDialog, receiveAllDialog, pauseDialog, cancelPlanDialog, noteDialog, deleteNote, orderDialog, setOrderStatus,
  deleteOrder, eventDialog, reportError, fleetDialog,
} from './dialogs.js';

// Stato dell'interfaccia (filtri, schede) che sopravvive ai nuovi rendering.
export const ui = {
  q: '', searchError: null, ordersFilter: 'aperti', mvType: 'tutti', mvQuery: '', notesFilter: 'aperti', notesQuery: '',
  matTab: 'lotti', matQuery: '', histTab: 'posizione', histLoc: 'baia-5', calMonth: null, calSel: null, typeTimer: 0,
};
const seenBoxes = new Map();

const pageHead = (eyebrow, title, sub, actions) => h('header.page-head',
  h('div', { style: 'min-width:0' }, h('div.eyebrow', eyebrow), h('h1.page-title', title), sub ? h('p.page-sub', sub) : null),
  actions ? h('div.head-actions', actions) : null);

const tonsEl = (value, key, cls = '') => {
  const span = h(`span.num${cls}`);
  countUp(span, value, key);
  return span;
};

/* ------------------------------------------------------------------ */
/* Ricerca                                                             */
/* ------------------------------------------------------------------ */

export function renderSearch(s) {
  const totals = presentLots(s).reduce((a, l) => a + l.tons, 0);
  const incoming = openPlans(s).reduce((a, p) => a + planResidual(p), 0);
  const occupied = new Set(presentLots(s).map((l) => l.locationId)).size;
  const openNotes = s.notes.filter((n) => n.status !== 'Risolto').length;

  const inp = h('input', { id: 'q', type: 'search', inputmode: 'text', enterkeyhint: 'go', autocomplete: 'off', spellcheck: 'false',
    'aria-label': 'Numero o nome della posizione', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'q-list', 'aria-autocomplete': 'list',
    value: ui.q, placeholder: 'es. 18' });
  const list = h('div.suggest', { id: 'q-list', role: 'listbox', hidden: true });
  const errBox = h('div', { role: 'alert' });
  let active = -1;
  let opts = [];

  function go(loc) {
    ui.q = '';
    ui.searchError = null;
    App.navigate(`pos-${loc.id}`);
  }
  function submit() {
    if (active >= 0 && opts[active]) return go(opts[active]);
    const r = findLocation(inp.value);
    if (r.location) return go(r.location);
    ui.searchError = r;
    showError();
    const box = inp.closest('.search-field');
    box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
  }
  function showError() {
    clear(errBox);
    const r = ui.searchError;
    if (!r) return;
    errBox.append(h('div.search-error', icon('alert', 20), h('div',
      h('b', r.error), r.hint ? h('span', r.hint, ' ') : null,
      r.suggestion ? h('button.link-btn', { type: 'button', on: { click: () => go(r.suggestion) } }, `Apri ${r.suggestion.name}`) : null)));
  }
  function renderList() {
    const q = inp.value.trim();
    opts = q ? suggestLocations(q, 6) : [];
    clear(list);
    opts.forEach((l, i) => {
      const st = positionStats(s, l.id);
      list.append(h('div', { role: 'option', id: `q-opt-${i}`, 'aria-selected': String(i === active), on: { pointerdown: (e) => { e.preventDefault(); go(l); } } },
        h('span.s-code', l.code === 'T' ? 'T' : l.code), h('span', h('b', l.name), h('span.muted', ` · ${KIND_LABEL[l.kind]}`)),
        h('span.s-meta', st.present ? fmtTons(st.present) : 'vuota')));
    });
    list.hidden = !opts.length;
    inp.setAttribute('aria-expanded', String(!list.hidden));
    inp.setAttribute('aria-activedescendant', active >= 0 ? `q-opt-${active}` : '');
    highlightYard(opts.map((o) => o.id), q);
  }
  inp.addEventListener('input', () => { ui.q = inp.value; active = -1; ui.searchError = null; showError(); renderList(); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); active = Math.min(opts.length - 1, active + 1); renderList(); }
    else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); active = Math.max(-1, active - 1); renderList(); }
    else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') { list.hidden = true; }
  });
  inp.addEventListener('blur', () => setTimeout(() => { list.hidden = true; inp.setAttribute('aria-expanded', 'false'); }, 150));
  inp.addEventListener('focus', () => { if (inp.value) renderList(); });

  // Esempi che si alternano nel campo vuoto.
  clearInterval(ui.typeTimer);
  const examples = ['18', 'A', 'Tettoia', '49', '7', 'L'];
  let ei = 0;
  if (!reducedMotion()) ui.typeTimer = setInterval(() => { if (!inp.isConnected) return clearInterval(ui.typeTimer); inp.placeholder = `es. ${examples[++ei % examples.length]}`; }, 2200);

  const yard = renderYard(s);
  function highlightYard(ids, q) {
    yard.classList.toggle('filtering', !!q && ids.length > 0);
    for (const t of yard.querySelectorAll('.tile')) t.classList.toggle('match', ids.includes(t.dataset.id));
  }
  queueMicrotask(() => { if (ui.q) renderList(); showError(); });

  const plans = openPlans(s);
  return h('div',
    h('section.search-hero',
      h('div.eyebrow', icon('search', 14), 'Ricerca posizione'),
      h('h1.page-title', 'Che cosa c\'è in ', h('em', 'baia?')),
      h('p.page-sub', 'Scrivi il numero, la lettera o il nome: 18 apre il Mucchio 18, A la Baia A, Tettoia il deposito.'),
      h('div.search-box',
        h('form', { role: 'search', on: { submit: (e) => { e.preventDefault(); submit(); } } },
          h('div.search-field', icon('search', 28), inp,
            h('button.btn-forge', { type: 'submit', 'aria-label': 'Apri posizione' }, h('span.lbl', 'Apri'), icon('arrowL', 20, 'style="transform:rotate(180deg)"')))),
        list),
      errBox,
      h('div.quick', h('span.quick-label', 'Più usate'),
        frequentLocations(s, 8).map((l) => {
          const st = positionStats(s, l.id);
          return h('button', { type: 'button', on: { click: () => go(l) } }, l.name, h('span.q-t', st.present ? fmtTons(st.present) : 'vuota'));
        }))),
    h('div.kpis',
      h('div.kpi', h('div.kpi-label', 'In giacenza'), h('div.kpi-value', tonsEl(totals, 'k:tot'), h('small', 't'))),
      h('div.kpi', h('div.kpi-label', 'In arrivo'), h('div.kpi-value', tonsEl(incoming, 'k:inc'), h('small', 't'))),
      h('div.kpi', h('div.kpi-label', 'Posizioni occupate'), h('div.kpi-value', String(occupied), h('small', `/ ${LOCATIONS.length}`))),
      h('div.kpi', h('div.kpi-label', 'Appunti aperti'), h('div.kpi-value', String(openNotes)))),
    yardLive(s),
    plans.length ? h('section.section',
      h('div.section-head', h('h2.section-title', icon('truck', 18), 'Arrivi in corso', h('span.count', String(plans.length)))),
      h('div.arrivals-strip.stagger', plans.map((p, i) => miniPlan(s, p, i)))) : null,
    h('section.section', yard));
}

/** Piazzale animato: i mezzi si muovono secondo il loro stato (aggiunta di questa versione). */
function yardLive(s) {
  const inUse = s.fleet.filter((v) => v.status === 'In uso').length;
  const down = s.fleet.filter((v) => v.status === 'Manutenzione' || v.status === 'Fermo').length;
  return h('section.section',
    h('div.section-head',
      h('h2.section-title', icon('truck', 18), 'Mezzi sul piazzale', h('span.count', `${s.fleet.length}`)),
      h('span.muted', { style: 'font-size:13px' }, `${inUse} in uso · ${s.fleet.length - inUse - down} disponibili${down ? ` · ${down} ferm${down === 1 ? 'o' : 'i'}` : ''}`)),
    scene(s.fleet, { caption: 'Piazzale', wrenchIcon: () => icon('settings', 14) }),
    h('div.fleet', s.fleet.map((v) => fleetCard(v))));
}

export function fleetCard(v) {
  const st = v.status;
  const chip = st === 'Disponibile' ? '.ok' : st === 'In uso' ? '.accent' : st === 'Manutenzione' ? '.warn' : '.bad';
  return h(`button.fleet-card.${st === 'In uso' ? 'inuso' : st.toLowerCase()}`, { type: 'button', 'aria-label': `${v.name}, portata ${fmtNum(v.capacity)} t, ${st}${v.note ? `: ${v.note}` : ''}. Cambia stato`, title: v.note || '',
    on: { click: () => fleetDialog(v) } },
  vehicle(v.kind, { load: st === 'In uso' }),
  h('div', { style: 'min-width:0' }, h('b', v.name), h('small', `portata ${fmtNum(v.capacity)} t${v.note ? ` · ${v.note}` : ''}`)),
  h(`span.chip${chip}`, st));
}

function miniPlan(s, p, i) {
  const pct = p.totalTons ? (p.receivedTons / p.totalTons) * 100 : 0;
  return h('a.card.mini-plan', { href: `#pos-${p.locationId}`, '--i': i, on: { click: (e) => { e.preventDefault(); App.navigate(`pos-${p.locationId}`); } } },
    h('div.mini-plan-top', h('b', getLocation(p.locationId).name), p.paused ? h('span.chip.warn', icon('pause', 12), 'In pausa') : h('span.chip.stripe', 'Su più giorni')),
    h('div', { style: 'font-size:14px;color:var(--ink-2)' }, `${p.material} · `, h('span.mono', p.lotCode)),
    h('div.pb-track', h('i', { style: { width: `${pct}%` } })),
    h('div', { style: 'display:flex;justify-content:space-between;font-size:13px;color:var(--ink-3)' },
      h('span.num', `${p.receivedContainers}/${p.containers} container`), h('span.num', `residuo ${fmtTons(planResidual(p))}`)));
}

function renderYard(s) {
  const groups = [
    ['Baie 1–20', LOCATIONS.filter((l) => l.group === 'Baie 1–20'), ''],
    ['Mucchi 18 · 21–60', LOCATIONS.filter((l) => l.kind === 'mucchio'), 'mucchi'],
    ['Baie A–L · Tettoia', LOCATIONS.filter((l) => l.group === 'Baie A–L' || l.kind === 'deposito'), ''],
  ];
  const maxHeap = Math.max(1, ...LOCATIONS.filter((l) => l.kind !== 'baia').map((l) => positionStats(s, l.id).final));
  const noteLocs = new Set(s.notes.filter((n) => n.status !== 'Risolto' && n.locationId).map((n) => n.locationId));
  return h('div.card.yard',
    h('div.yard-head',
      h('div', h('h2.section-title', icon('map', 18), 'Piazzale'), h('div', { style: 'font-size:13px;color:var(--ink-3);margin-top:4px' }, 'Tocca una posizione per aprirla.')),
      h('div.yard-legend', h('span', h('i.lg.fill'), 'Presente'), h('span', h('i.lg.inc'), 'In arrivo'), h('span', h('i.lg.note'), 'Appunto aperto'))),
    h('div.yard-groups', groups.map(([title, locs, cls]) => h('div',
      h('div.yard-group-title', title),
      h(`div.yard-row${cls ? '.' + cls : ''}`, locs.map((l) => {
        const st = positionStats(s, l.id);
        const scale = st.capacity || maxHeap;
        const fillPct = Math.min(100, (st.present / scale) * 100);
        const incPct = Math.min(100 - fillPct, (st.incoming / scale) * 100);
        return h(`button.tile.${l.kind}${st.over ? '.over' : ''}${fillPct > 55 ? '.full' : ''}`, {
          type: 'button', dataset: { id: l.id },
          title: `${l.name}: ${st.present ? fmtTons(st.present) : 'vuota'}${st.incoming ? ` · in arrivo ${fmtTons(st.incoming)}` : ''}`,
          'aria-label': `${l.name}, ${st.present ? fmtTons(st.present) : 'vuota'}${st.incoming ? `, in arrivo ${fmtTons(st.incoming)}` : ''}${noteLocs.has(l.id) ? ', appunto aperto' : ''}`,
          on: { click: () => App.navigate(`pos-${l.id}`) },
        },
        h('span.t-fill', { style: { height: `${fillPct}%` } }),
        incPct ? h('span.t-inc', { style: { bottom: `${fillPct}%`, height: `${Math.max(6, incPct)}%` } }) : null,
        noteLocs.has(l.id) ? h('span.t-note') : null,
        h('span.t-label', l.kind === 'deposito' ? 'TETTOIA' : l.code));
      }))))),
    h('div.yard-note', icon('info', 14), 'Schema dimostrativo: raggruppa le posizioni ma non rappresenta la disposizione reale del piazzale. Baie in proporzione alla capienza provvisoria; mucchi e Tettoia in proporzione al più pieno.'));
}

/* ------------------------------------------------------------------ */
/* Scheda posizione                                                    */
/* ------------------------------------------------------------------ */

export function renderPosition(s, locId) {
  const loc = getLocation(locId);
  if (!loc) return h('div.empty', h('h3', 'Posizione inesistente'), h('button.btn', { on: { click: () => App.navigate('ricerca') } }, 'Torna alla ricerca'));
  const st = positionStats(s, locId);
  const notes = s.notes.filter((n) => n.locationId === locId);
  const active = notes.filter((n) => n.status !== 'Risolto').sort((a, b) => (b.important - a.important) || b.updatedAt - a.updatedAt);
  const resolved = notes.filter((n) => n.status === 'Risolto');
  const today = App.store.today();

  const code = loc.kind === 'deposito' ? 'TETTOIA' : loc.code;
  return h('div',
    h('section.pos-hero',
      h('div.rack-sign', { 'aria-hidden': 'true' }, h('div.chains', h('i'), h('i')),
        h('div.plate', h('span.plate-kind', loc.kind === 'deposito' ? 'DEPOSITO' : KIND_LABEL[loc.kind].toUpperCase()), h(`span.plate-code${code.length > 3 ? '.long' : ''}`, code), h('span.hazard'))),
      h('button.btn.ghost.sm', { type: 'button', on: { click: () => App.navigate('ricerca') } }, icon('arrowL', 16), 'Ricerca'),
      h('div.eyebrow', { style: 'margin-top:14px' }, KIND_LABEL[loc.kind], st.capacity == null ? h('span.chip.outline', 'Capienza non impostata') : null),
      h('h1.pos-title', loc.name),
      h('div.pos-actions',
        h('button.btn-forge', { type: 'button', on: { click: () => addMaterialDialog({ locationId: locId }) } }, icon('plus', 20), 'Aggiungi materiale'),
        h('button.btn', { type: 'button', on: { click: () => addMaterialDialog({ locationId: locId, tab: 'plan' }) } }, icon('truck', 18), 'Arrivo su più giorni'),
        h('button.btn', { type: 'button', on: { click: () => noteDialog(null, { locationId: locId }) } }, icon('note', 18), 'Appunto'))),

    active.length ? h('section.notes-strip', { 'aria-label': 'Appunti della posizione' }, active.map((n, i) => noteCard(n, i))) : null,

    h('section.metrics',
      h('div.card.metric.present', h('div.metric-label', 'Presente ora'), h('div.metric-value', tonsEl(st.present, `p:${locId}`), h('small', 't')),
        h('div.metric-foot', `${st.lots.length} ${st.lots.length === 1 ? 'lotto' : 'lotti'}`)),
      h('div.card.metric.incoming', h('div.metric-label', 'Ancora in arrivo'), h('div.metric-value', tonsEl(st.incoming, `i:${locId}`), h('small', 't')),
        h('div.metric-foot', st.plans.length ? `${st.plans.reduce((a, p) => a + planRemainingContainers(p), 0)} container previsti` : 'Nessun arrivo attivo')),
      h('div.card.metric', h('div.metric-label', 'Spazio libero ora'),
        st.capacity != null
          ? h('div.metric-value', tonsEl(st.free, `f:${locId}`), h('small', 't'))
          : h('div.metric-value.placeholder', 'Capienza non impostata'),
        h('div.metric-foot', st.capacity != null ? `su ${fmtTons(st.capacity, { fixed2: true })} (parametro provvisorio)` : 'Mucchi e Tettoia non hanno una capienza massima'))),
    occupancy(st, locId),

    h('section.section',
      h('div.section-head', h('h2.section-title', icon('ingot', 18), 'Lotti presenti', h('span.count', String(st.lots.length)))),
      st.lots.length
        ? h('div.grid.cols-2.stagger', st.lots.sort((a, b) => b.tons - a.tons).map((l, i) => lotCard(s, l, i)))
        : h('div.empty', idleLift(), h('h3', 'Nessun materiale presente'),
          h('p', st.plans.length ? 'Gli arrivi previsti sono qui sotto: diventano presenti quando vengono ricevuti o stimati.' : 'La posizione è vuota. Lo storico resta consultabile più in basso.'),
          h('button.btn.accent', { type: 'button', on: { click: () => addMaterialDialog({ locationId: locId }) } }, icon('plus', 18), 'Aggiungi materiale'))),

    st.plans.length ? h('section.section',
      h('div.section-head', h('h2.section-title', icon('truck', 18), 'In arrivo', h('span.count', String(st.plans.length)))),
      h('div.grid.stagger', st.plans.map((p, i) => planCard(s, p, today, i)))) : null,

    resolved.length ? h('details.section', h('summary', { style: 'cursor:pointer' }, h('span.section-title', { style: 'display:inline-flex' }, icon('check', 16), `Appunti risolti (${resolved.length})`)),
      h('div.notes-strip', resolved.map((n, i) => noteCard(n, i)))) : null,

    positionHistory(s, locId));
}

const pct = (v, cap) => `${fmtNum(Math.round((v / cap) * 1000) / 10)}%`;

function occupancy(st, locId) {
  const cap = st.capacity;
  const scale = Math.max(cap || 0, st.final, 1);
  const pPct = (st.present / scale) * 100;
  const iPct = (st.incoming / scale) * 100;
  const present = h('div.occ-present', { style: { width: `${previousWidth(`p${locId}`, pPct)}%` } });
  const incoming = h('div.occ-incoming', { style: { left: `${previousWidth(`l${locId}`, pPct)}%`, width: `${previousWidth(`i${locId}`, iPct)}%`, display: st.incoming ? '' : 'none' } });
  const liftAt = (v) => `${Math.max(4, Math.min(93, v))}%`;
  const lift = h('div.occ-lift', { style: { left: liftAt(previousWidth(`f${locId}`, pPct)) } });
  lift.innerHTML = forkliftSvg({ load: true });
  requestAnimationFrame(() => requestAnimationFrame(() => {
    present.style.width = `${pPct}%`;
    incoming.style.left = `${pPct}%`;
    incoming.style.width = `${iPct}%`;
    if (lift.style.left !== liftAt(pPct)) {
      const bar = lift.parentElement;
      bar?.classList.add('moving');
      lift.style.left = liftAt(pPct);
      setTimeout(() => bar?.classList.remove('moving'), 950);
    }
  }));
  return h('section.card.occupancy', { 'aria-label': 'Occupazione' },
    h('div.occ-top',
      h('span', 'Occupazione · ', h('b', fmtTons(st.present)), cap ? ` (${pct(st.present, cap)})` : ''),
      h('span', 'A fine arrivi · ', h('b', fmtTons(st.final)), cap ? ` (${pct(st.final, cap)})` : '')),
    h(`div.occ-bar${st.over ? '.over' : ''}`, { role: 'img', 'aria-label': `Presente ${fmtTons(st.present)}, in arrivo ${fmtTons(st.incoming)}${cap ? `, capienza ${fmtTons(cap)}` : ''}` },
      present, incoming, lift,
      cap ? h('div.occ-cap', { style: { left: `calc(${(cap / scale) * 100}% - 1px)` }, 'data-label': 'capienza' }) : null),
    h('div.occ-scale', h('span', '0 t'), h('span', cap ? fmtTons(scale) : `${fmtTons(scale)} (nessuna capienza)`)),
    st.over ? h('div.occ-warn', icon('alert', 18), st.overNow ? `Già oltre la capienza provvisoria di ${fmtTons(round3(st.present - cap))}.` : `A fine arrivi supererà la capienza provvisoria di ${fmtTons(round3(st.final - cap))}.`) : null);
}

function noteCard(n, i = 0) {
  const user = App.store.user;
  const loc = n.locationId ? getLocation(n.locationId) : null;
  const st = n.status;
  return h(`article.note-card${n.important && st !== 'Risolto' ? '.important' : ''}${st === 'Risolto' ? '.resolved' : ''}`, { '--i': i, style: `animation-delay:${i * 50}ms` },
    h('div.note-icon', icon(n.important ? 'alert' : 'note', 18)),
    h('div', { style: 'min-width:0' },
      h('div.note-title', n.title),
      n.text ? h('div.note-text', n.text) : null,
      h('div.note-meta',
        h(`span.chip${st === 'Aperto' ? '.warn' : st === 'Risolto' ? '.ok' : '.info'}`, st),
        loc ? h('button.link-btn', { type: 'button', on: { click: () => App.navigate(`pos-${loc.id}`) } }, loc.name) : h('span.chip.outline', 'Generale'),
        h('span', `${n.createdByName || 'autore sconosciuto'} · ${fmtDateTime(n.createdAt)}`),
        n.updatedByName && n.updatedAt !== n.createdAt ? h('span', `· modificato da ${n.updatedByName}`) : null)),
    h('div.note-actions',
      st !== 'Risolto' ? h('button.icon-btn', { type: 'button', title: 'Segna come risolto', 'aria-label': `Segna “${n.title}” come risolto`,
        on: { click: (e) => act({ type: 'note.update', noteId: n.id, expectRev: n.rev, fields: { status: 'Risolto' } }, { button: e.currentTarget }) } }, icon('check', 18)) : null,
      h('button.icon-btn', { type: 'button', title: 'Modifica', 'aria-label': `Modifica “${n.title}”`, on: { click: () => noteDialog(n) } }, icon('edit', 18)),
      canDeleteNote(user, n) ? h('button.icon-btn', { type: 'button', title: 'Elimina', 'aria-label': `Elimina “${n.title}”`, on: { click: (e) => deleteNote(n, e.currentTarget) } }, icon('trash', 18)) : null));
}

function lotCard(s, lot, i) {
  const plan = lot.sourcePlanId ? s.plans.find((p) => p.id === lot.sourcePlanId) : null;
  const estimates = lotHasEstimates(s, lot);
  return h('article.card.lot', { '--i': i },
    h('div.lot-top',
      h('div', { style: 'min-width:0' }, h('div.lot-material', lot.material), h('div.lot-client', lot.client)),
      h('div.lot-tons', tonsEl(lot.tons, `lot:${lot.id}`), h('small', 't'))),
    h('div.lot-mid', h('div',
    h('div.lot-tags',
      h('span.code', lot.lotCode),
      h('span.chip', lot.format === 'Sacconi' && lot.bags ? `Sacconi · ${lot.bags}` : lot.format),
      plan ? h('span.chip.info', icon('truck', 12), plan.status === 'attivo' ? 'Lotto su più giorni' : 'Da arrivo') : null,
      estimates ? h('span.chip.stripe', { title: 'Parte della quantità deriva da stime automatiche del piano, non da consegne confermate' }, 'Include stime') : null),
    h('div.lot-meta',
      h('span', `Aggiornato da ${lot.updatedByName} · ${fmtDateTime(lot.updatedAt)}`),
      lot.pdfRef ? h('span', icon('file', 12), ' ', lot.pdfRef) : null)),
    lotArt(lot)),
    h('div.lot-actions',
      h('button.btn.load', { type: 'button', on: { click: () => qtyDialog(lot, 'load') } }, icon('plus', 18), 'Carico'),
      h('button.btn.unload', { type: 'button', on: { click: () => qtyDialog(lot, 'unload') } }, icon('minus', 18), 'Scarico'),
      h('button.btn', { type: 'button', on: { click: (e) => unloadAllDialog(lot, e.currentTarget) } }, 'Scarica tutto'),
      h('button.btn.more', { type: 'button', 'aria-label': `Altre azioni per ${lot.lotCode}`, 'aria-haspopup': 'menu', on: { click: (e) => openMenu(e.currentTarget, [
        { label: 'Modifica lotto', icon: 'edit', run: () => editLotDialog(lot) },
        { label: 'Trasferisci', icon: 'transfer', run: () => transferDialog(lot) },
        '-',
        { label: 'Elimina dalla giacenza', icon: 'trash', danger: true, run: () => deleteLotDialog(lot) },
      ]) } }, icon('more', 18), h('span.sr-only', 'Altro'))));
}

function planCard(s, p, today, i) {
  const sched = planSchedule(p, today);
  const elapsed = daysBetween(p.startDate, today);
  const receipts = s.receipts.filter((r) => r.planId === p.id);
  const boxes = [];
  for (const r of receipts) for (let k = 0; k < r.containers; k++) boxes.push(r.mode === 'stima' && !r.confirmedAt ? 'est' : 'recv');
  const prevSeen = seenBoxes.has(p.id) ? seenBoxes.get(p.id) : boxes.length;
  seenBoxes.set(p.id, boxes.length);
  const unconfirmed = planEstimatedUnconfirmed(s, p.id);
  const unconfirmedC = unconfirmed.reduce((a, r) => a + r.containers, 0);
  const avg = planRemainingContainers(p) ? round3(planResidual(p) / planRemainingContainers(p)) : 0;
  const confirmMode = s.settings.arrivalMode === 'conferma';
  const expected = autoTarget(p, today);
  const behind = confirmMode && !p.paused ? Math.max(0, expected - p.receivedContainers) : 0;
  const next = sched.find((d) => d.day > Math.max(0, elapsed) && d.inc > 0);

  let idx = 0;
  const track = h('div.track', { role: 'img', 'aria-label': `${p.receivedContainers} container su ${p.containers} ricevuti o stimati` },
    sched.map((d) => {
      const col = [];
      for (let k = 0; k < d.inc; k++, idx++) {
        const kind = boxes[idx];
        col.push(h(`span.cbox${kind ? '.' + kind : ''}${kind && idx >= prevSeen ? '.pop' : ''}`, { style: kind && idx >= prevSeen ? `animation-delay:${(idx - prevSeen) * 90}ms` : '' }));
      }
      const truck = d.state === 'today' && !p.paused ? h('span.today-truck', { 'aria-hidden': 'true' }) : null;
      if (truck) truck.innerHTML = truckSvg();
      return h(`div.track-day${d.state === 'today' ? '.today' : ''}`, truck, h('div.track-boxes', col),
        h('div.track-label', `G${d.day}`, h('br'), fmtDayMonth(d.date)));
    }));

  const statusChip = p.paused ? h('span.chip.warn', icon('pause', 12), 'Automatico in pausa')
    : confirmMode ? h('span.chip.info', 'Solo conferma manuale')
    : h('span.chip.ok', icon('bolt', 12), 'Stima automatica attiva');

  return h(`article.card.plan${p.paused ? '.paused' : ''}`, { '--i': i },
    h('div.plan-top',
      h('div', { style: 'min-width:0' },
        h('div.eyebrow', 'Lotto su più giorni'),
        h('div.plan-title', { style: 'margin-top:4px' }, p.material),
        h('div.plan-sub', h('span.code', p.lotCode), p.client, h('span.muted', `· dal ${fmtDayShort(p.startDate)} · ${p.containers} container in ${p.days} giorni`))),
      statusChip),
    h('div.plan-nums',
      h('div.plan-num', h('span', 'Ricevuto'), h('b', tonsEl(p.receivedTons, `pr:${p.id}`), ' t'), h('em', `${p.receivedContainers} container`)),
      h('div.plan-num', h('span', 'Residuo'), h('b', tonsEl(planResidual(p), `pres:${p.id}`), ' t'), h('em', `${planRemainingContainers(p)} container · ~${fmtTons(avg)} cad.`)),
      h('div.plan-num', h('span', 'Totale'), h('b', fmtNum(p.totalTons), ' t'), h('em', `${p.containers} container`))),
    track,
    h('div.plan-legend',
      h('span', h('i.cbox.recv'), 'Ricevuto'),
      h('span', h('i.cbox.est'), 'Stimato (non confermato)'),
      h('span', h('i.cbox'), 'Previsto'),
      next && !p.paused ? h('span', icon('clock', 13), `Prossima stima ${fmtDayShort(next.date)}: +${next.inc} container`) : null),
    unconfirmedC ? h('div.estimate-note', icon('alert', 18),
      h('span', `${unconfirmedC} container (${fmtTons(round3(unconfirmed.reduce((a, r) => a + r.tons, 0)))}) sono stime automatiche del piano: incrementano la giacenza ma non provano una consegna.`),
      h('button.btn.sm', { type: 'button', on: { click: (e) => act({ type: 'plan.confirmEstimates', planId: p.id, expectRev: p.rev }, { button: e.currentTarget }) } }, 'Conferma arrivati')) : null,
    behind ? h('div.estimate-note', icon('info', 18), h('span', `Ad oggi il piano prevede ${expected} container: ne mancano ${behind} da confermare.`),
      h('button.btn.sm', { type: 'button', on: { click: () => receiveDialog(p, { suggested: behind }) } }, `Conferma ${behind}`)) : null,
    h('div.plan-actions',
      h('button.btn.accent', { type: 'button', on: { click: () => receiveDialog(p) } }, icon('container', 18), 'Ricevi oggi'),
      h('button.btn', { type: 'button', on: { click: (e) => receiveAllDialog(p, e.currentTarget) } }, icon('check', 18), 'Ricevi tutto oggi'),
      h('button.btn', { type: 'button', on: { click: (e) => pauseDialog(p, e.currentTarget) } }, icon(p.paused ? 'play' : 'pause', 18), p.paused ? 'Riprendi' : 'Pausa'),
      h('button.btn', { type: 'button', on: { click: () => editPlanDialog(p) } }, icon('edit', 18), 'Modifica piano'),
      h('button.btn.danger', { type: 'button', on: { click: () => cancelPlanDialog(p) } }, icon('x', 18), p.receivedContainers ? 'Annulla arrivo' : 'Elimina')));
}

function positionHistory(s, locId) {
  const hist = locationHistory(s, locId);
  const mvs = s.movements.filter((m) => m.locationId === locId || m.toLocationId === locId).slice(-8).reverse();
  return h('section.section',
    h('div.section-head', h('h2.section-title', icon('history', 18), 'Storico della posizione'),
      h('button.btn.sm.ghost', { type: 'button', on: { click: () => { ui.histTab = 'posizione'; ui.histLoc = locId; App.navigate('storico'); } } }, 'Apri storico completo', icon('chevR', 16))),
    hist.length ? h('div.hist-list', hist.slice(0, 6).map((e) => h('div.hist-row',
      h('div', { style: 'min-width:0' }, h('b', e.material), ' ', h('span.code', e.lotCode), h('div.muted', { style: 'font-size:13px' }, e.client)),
      h('div.muted', { style: 'font-size:13px' }, `entrate ${fmtTons(e.inTons)} · uscite ${fmtTons(e.outTons)}`),
      e.stillPresent ? h('span.chip.ok', 'Presente') : h('span.chip', 'Uscito')))) : h('p.muted', 'Nessun movimento registrato in questa posizione.'),
    mvs.length ? h('div.feed', { style: 'margin-top:14px' }, mvs.map((m) => movementRow(s, m, locId))) : null);
}

/* ------------------------------------------------------------------ */
/* Movimenti                                                           */
/* ------------------------------------------------------------------ */

function movementRow(s, m, perspectiveLoc) {
  const t = MOVEMENT_TYPES[m.type] || { label: m.type };
  const loc = getLocation(m.locationId);
  const to = m.toLocationId ? getLocation(m.toLocationId) : null;
  let sign = perspectiveLoc ? movementSignFor(m, perspectiveLoc) : (m.type === 'trasferimento' || m.type === 'annullo_arrivo') ? 0 : movementSignFor(m, m.locationId);
  const cls = m.type === 'stima' ? 'est' : sign > 0 ? 'in' : sign < 0 ? 'out' : 'neutral';
  const ic = { creazione: 'plus', carico: 'arrowDown', scarico: 'arrowUp', scarica_tutto: 'arrowUp', ricezione: 'container', stima: 'bolt',
    rettifica: 'edit', trasferimento: 'transfer', eliminazione: 'trash', annullo_arrivo: 'x', aggiornamento: 'upload' }[m.type] || 'moves';
  return h(`div.mv${m.type === 'stima' ? '.est' : ''}`,
    h(`div.mv-icon.${cls}`, icon(ic, 20)),
    h('div', { style: 'min-width:0' },
      h('div.mv-title', t.label, m.lotCode ? h('span.code', m.lotCode) : null,
        loc ? h('button.link-btn', { type: 'button', on: { click: () => App.navigate(`pos-${loc.id}`) } }, loc.name) : null,
        to ? h('span.muted', '→') : null,
        to ? h('button.link-btn', { type: 'button', on: { click: () => App.navigate(`pos-${to.id}`) } }, to.name) : null),
      h('div.mv-sub', [m.material, m.byName, fmtTime(m.at), m.containers ? `${m.containers} container` : null, m.note].filter(Boolean).join(' · '))),
    h(`div.mv-qty.${sign > 0 ? 'in' : sign < 0 ? 'out' : ''}`, m.tons != null ? `${sign > 0 ? '+' : sign < 0 ? '−' : ''}${fmtTons(m.tons)}` : '',
      m.type === 'annullo_arrivo' ? h('small', 'previsto tolto') : m.type === 'stima' ? h('small', 'stima') : null));
}

export function renderMovements(s) {
  const types = [['tutti', 'Tutti'], ['entrate', 'Entrate'], ['uscite', 'Uscite'], ['stima', 'Stime automatiche'], ['altro', 'Rettifiche e spostamenti']];
  const q = ui.mvQuery.trim().toLowerCase();
  let list = s.movements.slice().reverse().filter((m) => {
    const sign = movementSignFor(m, m.locationId);
    if (ui.mvType === 'entrate' && !(sign > 0 && m.type !== 'stima')) return false;
    if (ui.mvType === 'uscite' && !(sign < 0)) return false;
    if (ui.mvType === 'stima' && m.type !== 'stima') return false;
    if (ui.mvType === 'altro' && !['rettifica', 'trasferimento', 'aggiornamento', 'annullo_arrivo'].includes(m.type)) return false;
    if (q) {
      const hay = [m.lotCode, m.material, m.client, m.byName, m.note, getLocation(m.locationId)?.name, getLocation(m.toLocationId)?.name].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const total = list.length;
  list = list.slice(0, 250);
  const byDay = new Map();
  for (const m of list) {
    const d = romeDate(m.at);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(m);
  }
  const search = h('input.input', { id: 'mv-q', type: 'search', placeholder: 'Cerca lotto, materiale, persona, posizione…', value: ui.mvQuery,
    on: { input: (e) => { ui.mvQuery = e.target.value; App.render({ keepFocus: true }); } } });
  return h('div',
    pageHead('Registro quantità', 'Movimenti', 'Ogni carico, scarico, ricezione e stima, con autore, data e nota. Le stime automatiche sono evidenziate a righe.'),
    h('div.toolbar',
      h('div.search-input', icon('search', 18), search),
      h('div.seg', { role: 'group', 'aria-label': 'Tipo di movimento' }, types.map(([k, l]) =>
        h('button', { type: 'button', 'aria-pressed': String(ui.mvType === k), on: { click: () => { ui.mvType = k; App.render(); } } }, l)))),
    total > 250 ? h('p.muted', { style: 'font-size:13px' }, `Mostro i 250 più recenti su ${total}.`) : null,
    list.length ? [...byDay.entries()].map(([d, ms]) => h('section.day-group',
      h('div.day-head', h('h3', fmtDayLong(d)), h('span', `${ms.length} movimenti`)),
      h('div.feed', ms.map((m) => movementRow(s, m)))))
      : h('div.empty', icon('moves', 40), h('h3', 'Nessun movimento'), h('p', 'Cambia i filtri o registra un carico da una posizione.')));
}

/* ------------------------------------------------------------------ */
/* Ordini                                                              */
/* ------------------------------------------------------------------ */

export function renderOrders(s) {
  const today = App.store.today();
  const filters = [['aperti', 'Da fare'], ['completati', 'Completati'], ['annullati', 'Annullati'], ['tutti', 'Tutti']];
  const open = (o) => o.status === 'Da fare' || o.status === 'Programmato';
  let list = s.orders.filter((o) => ui.ordersFilter === 'tutti' || (ui.ordersFilter === 'aperti' ? open(o) : ui.ordersFilter === 'completati' ? o.status === 'Completato' : o.status === 'Annullato'));
  list.sort((a, b) => (open(b) - open(a)) || (open(a) ? (a.date + a.time).localeCompare(b.date + b.time) : (b.date + b.time).localeCompare(a.date + a.time)));
  const groups = new Map();
  for (const o of list) {
    let g;
    if (!open(o)) g = o.status === 'Completato' ? 'Completati' : 'Annullati';
    else if (o.date < today) g = 'In ritardo';
    else if (o.date === today) g = 'Oggi';
    else if (o.date === addDays(today, 1)) g = 'Domani';
    else g = 'Prossimi';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(o);
  }
  const counts = { aperti: s.orders.filter(open).length };
  return h('div',
    pageHead('Lavoro da fare', 'Ordini di lavoro', 'Completare un ordine non scarica materiale: lo scarico si registra sul lotto, così non ci sono movimenti doppi.',
      h('button.btn-forge', { type: 'button', on: { click: () => orderDialog(null) } }, icon('plus', 20), 'Nuovo ordine')),
    h('div.toolbar', h('div.seg', { role: 'group', 'aria-label': 'Filtro ordini' }, filters.map(([k, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(ui.ordersFilter === k), on: { click: () => { ui.ordersFilter = k; App.render(); } } }, l, k === 'aperti' && counts.aperti ? ` · ${counts.aperti}` : '')))),
    list.length ? [...groups.entries()].map(([g, os]) => h('section.day-group',
      h('div.day-head', h('h3', { style: g === 'In ritardo' ? 'color:var(--bad)' : '' }, g), h('span', `${os.length}`)),
      h('div.grid.stagger', os.map((o, i) => orderCard(o, today, i)))))
      : h('div.empty', icon('orders', 40), h('h3', ui.ordersFilter === 'aperti' ? 'Nessun ordine da fare' : 'Nessun ordine'), h('button.btn.accent', { type: 'button', on: { click: () => orderDialog(null) } }, icon('plus', 18), 'Nuovo ordine')));
}

const vehOf = (o) => (o.vehicleId ? App.store.state.fleet.find((v) => v.id === o.vehicleId) : null);

function orderCard(o, today, i) {
  const done = o.status === 'Completato';
  const cancelled = o.status === 'Annullato';
  const loc = o.locationId ? getLocation(o.locationId) : null;
  const late = !done && !cancelled && o.date < today;
  return h(`article.card.order${done || cancelled ? '.done' : ''}`, { '--i': i },
    h('button.check' + (done ? '.on' : ''), { type: 'button', 'aria-label': done ? `Riapri “${o.title}”` : `Completa “${o.title}”`, 'aria-pressed': String(done),
      on: { click: (e) => setOrderStatus(o, done ? 'Da fare' : 'Completato', e.currentTarget) } }, icon('check', 18)),
    h('div', { style: 'min-width:0' },
      h('div.order-title', o.title),
      h('div.order-meta',
        h(`span.chip${o.status === 'Da fare' ? '.accent' : o.status === 'Programmato' ? '.info' : o.status === 'Completato' ? '.ok' : ''}`, o.status),
        loc ? h('button.chip.outline', { type: 'button', on: { click: () => App.navigate(`pos-${loc.id}`) } }, icon('pin', 12), loc.name) : null,
        o.material ? h('span.chip', o.material) : null,
        o.qty != null ? h('span.chip.num', `${fmtNum(o.qty)} ${o.unit}`) : null,
        vehOf(o) ? h('span.chip.veh-chip', vehicle(vehOf(o).kind), vehOf(o).name) : null),
      o.notes ? h('div.order-notes', o.notes) : null,
      h('div.muted', { style: 'font-size:12.5px;margin-top:8px' }, `${o.createdByName}${o.updatedByName !== o.createdByName ? ` · modificato da ${o.updatedByName}` : ''}`)),
    h('div.order-side',
      h(`div.order-date${late ? '.late' : ''}`, fmtDayShort(o.date), o.time ? ` · ${o.time}` : ''),
      h('div', { style: 'display:flex;gap:4px' },
        loc ? h('button.icon-btn', { type: 'button', title: 'Apri posizione', 'aria-label': `Apri ${loc.name}`, on: { click: () => App.navigate(`pos-${loc.id}`) } }, icon('pin', 18)) : null,
        h('button.icon-btn', { type: 'button', title: 'Modifica', 'aria-label': `Modifica “${o.title}”`, on: { click: () => orderDialog(o) } }, icon('edit', 18)),
        h('button.icon-btn', { type: 'button', title: 'Altro', 'aria-label': `Altre azioni per “${o.title}”`, on: { click: (e) => openMenu(e.currentTarget, [
          o.status !== 'Programmato' && !done ? { label: 'Segna come programmato', icon: 'calendar', run: () => setOrderStatus(o, 'Programmato', e.target) } : null,
          !cancelled ? { label: 'Annulla ordine', icon: 'x', run: () => setOrderStatus(o, 'Annullato', e.target) } : { label: 'Ripristina', icon: 'history', run: () => setOrderStatus(o, 'Da fare', e.target) },
          '-',
          { label: 'Elimina', icon: 'trash', danger: true, run: () => deleteOrder(o) },
        ]) } }, icon('more', 18)))));
}

/* ------------------------------------------------------------------ */
/* Materiali e lotti                                                   */
/* ------------------------------------------------------------------ */

export function renderMaterials(s) {
  const q = ui.matQuery.trim().toLowerCase();
  const match = (x) => !q || [x.material, x.client, x.lotCode, getLocation(x.locationId)?.name].join(' ').toLowerCase().includes(q);
  const lots = presentLots(s).filter(match);
  const plans = openPlans(s).filter(match);
  const byMat = new Map();
  for (const l of lots) {
    if (!byMat.has(l.material)) byMat.set(l.material, []);
    byMat.get(l.material).push(l);
  }
  const groups = [...byMat.entries()].map(([m, ls]) => ({ m, ls: ls.sort((a, b) => compareLocations(getLocation(a.locationId), getLocation(b.locationId))), tot: round3(ls.reduce((a, l) => a + l.tons, 0)) }))
    .sort((a, b) => b.tot - a.tot);
  const search = h('input.input', { id: 'mat-q', type: 'search', placeholder: 'Materiale, cliente, lotto o posizione', value: ui.matQuery,
    on: { input: (e) => { ui.matQuery = e.target.value; App.render({ keepFocus: true }); } } });
  const tab = (k, l, n) => h('button', { type: 'button', 'aria-pressed': String(ui.matTab === k), on: { click: () => { ui.matTab = k; App.render(); } } }, `${l} · ${n}`);
  return h('div',
    pageHead('Giacenza', 'Materiali e lotti', 'Tutti i lotti presenti, raggruppati per materiale. Tocca una riga per aprire la posizione.',
      h('button.btn-forge', { type: 'button', on: { click: () => addMaterialDialog() } }, icon('plus', 20), 'Aggiungi materiale')),
    h('div.toolbar', h('div.search-input', icon('search', 18), search),
      h('div.seg', { role: 'group' }, tab('lotti', 'Presenti', lots.length), tab('arrivi', 'In arrivo', plans.length))),
    ui.matTab === 'lotti'
      ? (groups.length ? h('div.table-wrap', h('table.data',
        h('thead', h('tr', h('th', 'Lotto'), h('th', 'Cliente'), h('th', 'Posizione'), h('th', 'Formato'), h('th.r', 'Tonnellate'))),
        h('tbody', groups.map((g) => [
          h('tr.group-row', h('td', { colspan: 4 }, g.m, h('span.muted', { style: 'font-weight:500' }, ` · ${g.ls.length} ${g.ls.length === 1 ? 'lotto' : 'lotti'}`)), h('td.r', fmtTons(g.tot))),
          g.ls.map((l) => h('tr', { tabindex: '0', on: { click: () => App.navigate(`pos-${l.locationId}`), keydown: (e) => { if (e.key === 'Enter') App.navigate(`pos-${l.locationId}`); } } },
            h('td', h('span.code', l.lotCode), lotHasEstimates(s, l) ? h('span.chip.stripe', { style: 'margin-left:6px' }, 'stime') : null),
            h('td', l.client), h('td', h('b', getLocation(l.locationId).name)), h('td', l.format === 'Sacconi' && l.bags ? `Sacconi · ${l.bags}` : l.format),
            h('td.r', h('b', fmtTons(l.tons))))),
        ])))) : h('div.empty', icon('layers', 40), h('h3', 'Nessun lotto trovato')))
      : (plans.length ? h('div.arrivals-strip.stagger', plans.map((p, i) => miniPlan(s, p, i))) : h('div.empty', icon('truck', 40), h('h3', 'Nessun arrivo attivo'))));
}

/* ------------------------------------------------------------------ */
/* Appunti                                                             */
/* ------------------------------------------------------------------ */

export function renderNotes(s) {
  const q = ui.notesQuery.trim().toLowerCase();
  const filters = [['aperti', 'Da gestire'], ['generali', 'Generali'], ['miei', 'Miei'], ['risolti', 'Risolti'], ['tutti', 'Tutti']];
  const user = App.store.user;
  const list = s.notes.filter((n) => {
    if (ui.notesFilter === 'aperti' && n.status === 'Risolto') return false;
    if (ui.notesFilter === 'risolti' && n.status !== 'Risolto') return false;
    if (ui.notesFilter === 'generali' && n.locationId) return false;
    if (ui.notesFilter === 'miei' && n.createdBy !== user.id) return false;
    if (q && ![n.title, n.text, getLocation(n.locationId)?.name, n.createdByName].join(' ').toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => (b.important - a.important) || b.updatedAt - a.updatedAt);
  const search = h('input.input', { id: 'nt-q', type: 'search', placeholder: 'Cerca negli appunti', value: ui.notesQuery,
    on: { input: (e) => { ui.notesQuery = e.target.value; App.render({ keepFocus: true }); } } });
  return h('div',
    pageHead('Metti, modifica, leva', 'Appunti', 'Gli appunti importanti compaiono anche in cima alla scheda della posizione. Ognuno elimina i propri; tutti possono modificarli o segnarli come risolti.',
      h('button.btn-forge', { type: 'button', on: { click: () => noteDialog(null) } }, icon('plus', 20), 'Nuovo appunto')),
    h('div.toolbar', h('div.search-input', icon('search', 18), search),
      h('div.seg', { role: 'group' }, filters.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(ui.notesFilter === k), on: { click: () => { ui.notesFilter = k; App.render(); } } }, l)))),
    list.length ? h('div.notes-strip', list.map((n, i) => noteCard(n, i)))
      : h('div.empty', icon('note', 40), h('h3', 'Nessun appunto'), h('button.btn.accent', { type: 'button', on: { click: () => noteDialog(null) } }, icon('plus', 18), 'Nuovo appunto')));
}

/* ------------------------------------------------------------------ */
/* Storico                                                             */
/* ------------------------------------------------------------------ */

export function renderHistory(s) {
  const tabs = [['posizione', 'Per posizione'], ['esauriti', 'Lotti usciti'], ['arrivi', 'Arrivi conclusi'], ['audit', 'Registro modifiche']];
  let body;
  if (ui.histTab === 'posizione') {
    const sel = select(LOCATIONS.map((l) => [l.id, l.name]), ui.histLoc, { id: 'h-loc', on: { change: (e) => { ui.histLoc = e.target.value; App.render(); } } });
    const hist = locationHistory(s, ui.histLoc);
    const mvs = s.movements.filter((m) => m.locationId === ui.histLoc || m.toLocationId === ui.histLoc).slice().reverse();
    body = h('div', { style: 'display:grid;gap:18px' },
      h('div.toolbar', { style: 'margin:0' }, h('div', { style: 'width:min(320px,100%)' }, field('Posizione', sel)),
        h('button.btn', { type: 'button', style: 'align-self:end', on: { click: () => App.navigate(`pos-${ui.histLoc}`) } }, 'Apri scheda', icon('chevR', 16))),
      hist.length ? h('div.table-wrap', h('table.data',
        h('thead', h('tr', h('th', 'Lotto'), h('th', 'Materiale'), h('th', 'Cliente'), h('th.r', 'Entrate'), h('th.r', 'Uscite'), h('th', 'Ultimo movimento'), h('th', 'Stato'))),
        h('tbody', hist.map((e) => h('tr', { style: 'cursor:default' }, h('td', h('span.code', e.lotCode)), h('td', e.material), h('td', e.client),
          h('td.r', fmtTons(e.inTons)), h('td.r', fmtTons(e.outTons)), h('td', fmtDateTime(e.last)), h('td', e.stillPresent ? h('span.chip.ok', 'Presente') : h('span.chip', 'Uscito'))))))) : h('p.muted', 'Nessun lotto è mai passato da qui.'),
      mvs.length ? h('div.feed', mvs.slice(0, 60).map((m) => movementRow(s, m, ui.histLoc))) : null);
  } else if (ui.histTab === 'esauriti') {
    const gone = s.lots.filter((l) => l.status !== 'presente').sort((a, b) => b.updatedAt - a.updatedAt);
    body = gone.length ? h('div.table-wrap', h('table.data',
      h('thead', h('tr', h('th', 'Lotto'), h('th', 'Materiale'), h('th', 'Cliente'), h('th', 'Ultima posizione'), h('th', 'Esito'), h('th', 'Quando'), h('th', 'Chi'))),
      h('tbody', gone.map((l) => h('tr', { on: { click: () => App.navigate(`pos-${l.locationId}`) } }, h('td', h('span.code', l.lotCode)), h('td', l.material), h('td', l.client),
        h('td', getLocation(l.locationId).name), h('td', l.status === 'eliminato' ? h('span.chip.bad', 'Eliminato') : h('span.chip', 'Scaricato')),
        h('td', fmtDateTime(l.updatedAt)), h('td', l.updatedByName))))))
      : h('div.empty', h('h3', 'Nessun lotto uscito'));
  } else if (ui.histTab === 'arrivi') {
    const done = s.plans.filter((p) => p.status !== 'attivo').sort((a, b) => b.updatedAt - a.updatedAt);
    body = done.length ? h('div.table-wrap', h('table.data',
      h('thead', h('tr', h('th', 'Lotto'), h('th', 'Materiale'), h('th', 'Posizione'), h('th.r', 'Ricevuto'), h('th.r', 'Annullato'), h('th', 'Esito'), h('th', 'Chiuso'))),
      h('tbody', done.map((p) => h('tr', { on: { click: () => App.navigate(`pos-${p.locationId}`) } }, h('td', h('span.code', p.lotCode)), h('td', p.material), h('td', getLocation(p.locationId).name),
        h('td.r', `${fmtTons(p.receivedTons)} · ${p.receivedContainers} c.`), h('td.r', p.cancelledTons ? fmtTons(p.cancelledTons) : '—'),
        h('td', p.status === 'completato' ? h('span.chip.ok', 'Completato') : h('span.chip.bad', 'Annullato')), h('td', fmtDateTime(p.completedAt || p.cancelledAt || p.updatedAt)))))))
      : h('div.empty', h('h3', 'Nessun arrivo concluso'), h('p', 'I piani completati o annullati restano qui con quanto ricevuto.'));
  } else {
    const rows = s.audit.slice().reverse().slice(0, 300);
    body = rows.length ? h('div.table-wrap', h('table.data',
      h('thead', h('tr', h('th', 'Quando'), h('th', 'Chi'), h('th', 'Azione'), h('th', 'Dettagli'))),
      h('tbody', rows.map((a) => h('tr', { style: 'cursor:default' }, h('td', { style: 'white-space:nowrap' }, fmtDateTime(a.at)), h('td', a.byName), h('td', h('b', a.action)),
        h('td', { style: 'font-size:13px;color:var(--ink-3)' }, auditDetail(a)))))))
      : h('div.empty', h('h3', 'Registro vuoto'));
  }
  return h('div',
    pageHead('Ciò che è transitato', 'Storico', 'Lo storico resta anche quando la posizione è vuota. Il registro modifiche dice chi ha creato, cambiato o tolto cosa.'),
    h('div.toolbar', h('div.seg', { role: 'group' }, tabs.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(ui.histTab === k), on: { click: () => { ui.histTab = k; App.render(); } } }, l)))),
    body);
}

function auditDetail(a) {
  const pick = (o) => o ? (o.lotCode || o.title || o.name || '') : '';
  const name = pick(a.after) || pick(a.before);
  if (a.before && a.after) {
    const changes = Object.keys(a.after).filter((k) => a.before[k] !== a.after[k] && !['updatedAt'].includes(k)).slice(0, 4)
      .map((k) => `${k}: ${a.before[k] ?? '—'} → ${a.after[k] ?? '—'}`);
    return [name, changes.join(' · ')].filter(Boolean).join(' — ');
  }
  return name;
}

/* ------------------------------------------------------------------ */
/* Calendario                                                          */
/* ------------------------------------------------------------------ */

const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function renderCalendar(s) {
  const today = App.store.today();
  ui.calMonth ||= today.slice(0, 7);
  ui.calSel ||= today;
  const [y, m] = ui.calMonth.split('-').map(Number);
  const first = `${ui.calMonth}-01`;
  const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -dow);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const evBy = new Map();
  const add = (d, item) => { if (!evBy.has(d)) evBy.set(d, []); evBy.get(d).push(item); };
  for (const e of s.events) add(e.date, { kind: e.kind, title: e.title, time: e.time, ev: e });
  for (const o of s.orders) if (o.status !== 'Annullato') add(o.date, { kind: 'ordine', title: o.title, time: o.time, order: o });
  for (const p of openPlans(s)) for (const r of planSchedule(p, today)) if (r.inc > 0 && r.date >= today) add(r.date, { kind: 'arrivo', title: `${getLocation(p.locationId).name}: +${r.inc} container`, time: '', plan: p });
  const sortItems = (a, b) => (a.time || '99').localeCompare(b.time || '99');
  const shift = (n) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    ui.calMonth = d.toISOString().slice(0, 7);
    App.render();
  };
  const selItems = (evBy.get(ui.calSel) || []).sort(sortItems);
  return h('div',
    pageHead('Pianificazione', 'Calendario', 'Eventi, ordini e arrivi previsti per giorno.',
      h('button.btn-forge', { type: 'button', on: { click: () => eventDialog(null, { date: ui.calSel }) } }, icon('plus', 20), 'Nuovo evento')),
    h('div.cal-head',
      h('button.icon-btn', { type: 'button', 'aria-label': 'Mese precedente', on: { click: () => shift(-1) } }, icon('chevL')),
      h('h2.cal-month', monthFmt.format(new Date(`${first}T00:00:00Z`))),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Mese successivo', on: { click: () => shift(1) } }, icon('chevR')),
      h('button.btn.sm', { type: 'button', on: { click: () => { ui.calMonth = today.slice(0, 7); ui.calSel = today; App.render(); } } }, 'Oggi')),
    h('div.cal-layout',
      h('div.card.cal',
        h('div.cal-dow', ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((d) => h('div', d))),
        h('div.cal-grid', days.map((d) => {
          const items = (evBy.get(d) || []).sort(sortItems);
          return h(`button.cal-day${d.slice(0, 7) !== ui.calMonth ? '.other' : ''}${d === today ? '.today' : ''}${d === ui.calSel ? '.sel' : ''}`, {
            type: 'button', 'aria-label': `${fmtDayLong(d)}${items.length ? `, ${items.length} elementi` : ''}`, 'aria-pressed': String(d === ui.calSel),
            on: { click: () => { ui.calSel = d; App.render(); }, dblclick: () => eventDialog(null, { date: d }) } },
          h('span.cal-num', String(Number(d.slice(8)))),
          items.slice(0, 3).map((it) => h(`span.cal-ev.k-${it.kind === 'arrivo' ? 'Carico' : it.kind}`, it.time ? `${it.time} ${it.title}` : it.title)),
          items.length > 3 ? h('span.muted', { style: 'font-size:11px' }, `+${items.length - 3}`) : null,
          items.length ? h('span.cal-dots', items.slice(0, 4).map(() => h('i'))) : null);
        }))),
      h('aside.card.cal-side',
        h('h3', fmtDayLong(ui.calSel)),
        h('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap' },
          h('button.btn.sm', { type: 'button', on: { click: () => eventDialog(null, { date: ui.calSel }) } }, icon('plus', 16), 'Evento'),
          h('button.btn.sm', { type: 'button', on: { click: () => orderDialog(null, { date: ui.calSel }) } }, icon('plus', 16), 'Ordine')),
        selItems.length ? h('div.agenda', selItems.map((it) => h('div.agenda-item',
          h('span.agenda-time', it.time || '—'),
          h('div', { style: 'min-width:0' }, h('b', { style: 'display:block;overflow-wrap:anywhere' }, it.title),
            h('span.muted', { style: 'font-size:12.5px' }, it.kind === 'ordine' ? `Ordine · ${it.order.status}` : it.kind === 'arrivo' ? 'Arrivo previsto dal piano' : it.kind)),
          it.ev ? h('button.icon-btn', { type: 'button', 'aria-label': `Modifica ${it.title}`, on: { click: () => eventDialog(it.ev) } }, icon('edit', 18))
            : it.order ? h('button.icon-btn', { type: 'button', 'aria-label': `Modifica ${it.title}`, on: { click: () => orderDialog(it.order) } }, icon('edit', 18))
              : h('button.icon-btn', { type: 'button', 'aria-label': 'Apri posizione', on: { click: () => App.navigate(`pos-${it.plan.locationId}`) } }, icon('chevR', 18)))))
          : h('p.muted', { style: 'margin-top:14px' }, 'Nessun evento in questa giornata.'))));
}

/* ------------------------------------------------------------------ */
/* Impostazioni                                                        */
/* ------------------------------------------------------------------ */

export const THEMES = [
  { id: 'system', label: 'Sistema', sw: ['#e7ebef', '#0a0d11', '#ff6a1a'] },
  { id: 'forgia', label: 'Forgia', sw: ['#0a0d11', '#141a21', '#ff6a1a'] },
  { id: 'acciaio', label: 'Acciaio', sw: ['#e7ebef', '#ffffff', '#e2550e'] },
  { id: 'cobalto', label: 'Cobalto', sw: ['#0c1f46', '#e9eef6', '#2f6bff'] },
  { id: 'sole', label: 'Pieno sole', sw: ['#ffffff', '#000000', '#c43c00'] },
];

export function renderSettings(s, prefs) {
  const store = App.store;
  const user = store.user;
  const isAdmin = user.role === 'admin';
  const panels = [];

  // Profilo e aspetto
  const motion = switchControl('Riduci le animazioni', prefs.motion === 'reduced', { id: 'set-motion', on: { change: (e) => prefs.set({ motion: e.target.checked ? 'reduced' : 'auto' }) } });
  panels.push(h('section.card.panel',
    h('h2', icon('palette', 20), 'Profilo e aspetto'),
    h('div.profile', { style: 'background:var(--surface-2);border-color:var(--line)' }, h('div.avatar', initials(user.name)),
      h('div.profile-text', h('div.profile-name', user.name), h('div', { style: 'font-size:13px;color:var(--ink-3)' }, `${ROLES[user.role]}${user.username ? ` · @${user.username}` : ''}`))),
    h('div.field-label', 'Tema'),
    h('div.themes', THEMES.map((t) => h('button.theme-opt', { type: 'button', 'aria-pressed': String(prefs.theme === t.id), on: { click: () => prefs.set({ theme: t.id }) } },
      h('span.swatch', { style: { background: t.sw[0] } },
        h('i', { style: { inset: '45% 0 0 30%', background: t.sw[1], borderTopLeftRadius: '6px' } }),
        h('i', { style: { left: '10%', top: '22%', width: '34%', height: '18%', borderRadius: '4px', background: t.sw[2] } })),
      t.label))),
    motion.el,
    store.mode === 'server' ? passwordForm() : null));

  // Parametri
  const cap = input({ id: 'set-cap', inputmode: 'decimal', value: s.settings.bayCapacity != null ? fmtNum(s.settings.bayCapacity, { fixed2: true }) : '', disabled: !isAdmin });
  const tpc = input({ id: 'set-tpc', inputmode: 'decimal', value: fmtNum(s.settings.tonsPerContainer), disabled: !isAdmin });
  const mode = select([['stima', 'Stima automatica (comportamento del sito attuale)'], ['conferma', 'Solo previsione + conferma manuale (proposta)']], s.settings.arrivalMode, { id: 'set-mode', disabled: !isAdmin });
  panels.push(h('section.card.panel',
    h('h2', icon('settings', 20), 'Parametri del magazzino'),
    !isAdmin ? h('p', 'Solo l\'amministratore può cambiare i parametri.') : null,
    h('div.row', field('Capienza baie (t)', cap, { hint: 'Provvisoria, dall\'inventario: non è una capacità certificata. Vuoto = non impostata.' }),
      field('Peso medio per container (t)', tpc, { hint: 'Usato per proporre il totale dei piani.' })),
    field('Avanzamento degli arrivi', mode, { hint: 'La stima automatica incrementa la giacenza (come il sito attuale). La conferma manuale mostra solo il previsto finché qualcuno non registra la ricezione.' }),
    isAdmin ? h('div', h('button.btn.primary', { type: 'button', on: { click: (e) => act({ type: 'settings.update', fields: { bayCapacity: cap.value, tonsPerContainer: tpc.value, arrivalMode: mode.value } }, { button: e.currentTarget }) } }, 'Salva parametri')) : null));

  // Utenti
  panels.push(usersPanel(store, isAdmin));

  // Backup
  panels.push(backupPanel(s, store, isAdmin));

  // Aggiornamento mirato
  if (isAdmin) panels.push(targetedPanel(s));

  // Strumenti demo
  if (store.mode === 'demo') panels.push(demoPanel(s, store));

  // Informazioni
  panels.push(h('section.card.panel',
    h('h2', icon('info', 20), 'Che cosa è reale qui'),
    h('div.legend-grid',
      h('div', h('b', 'Archivio'), h('span', store.mode === 'demo'
        ? 'Demo locale: i dati restano in questo browser. Due schede si comportano come due dispositivi, ma telefono e PC NON condividono nulla.'
        : 'Server condiviso (SQLite): fonte unica per tutti i dispositivi, con revisioni e conflitti.')),
      h('div', h('b', 'Accesso'), h('span', store.mode === 'demo'
        ? 'Profili dimostrativi senza password: non è sicurezza. Il server incluso ha account personali, password cifrate, inviti e sessioni.'
        : 'Account personali con password cifrata (scrypt), sessione in cookie HttpOnly, registrazione solo su invito.')),
      h('div', h('b', 'Stime automatiche'), h('span', store.mode === 'demo'
        ? 'Calcolate all\'apertura e ogni 30 secondi mentre la pagina è aperta.'
        : 'Calcolate dal server ogni 30 secondi, anche a sito chiuso, finché il server è acceso.')),
      h('div', h('b', 'Versione'), h('span', `${APP_VERSION} · ${store.mode === 'demo' ? 'dimostrativa' : 'server'}`)))));

  return h('div', pageHead('Configurazione', 'Impostazioni'), h('div.settings', panels));
}

function passwordForm() {
  const cur = input({ id: 'pw-cur', type: 'password', autocomplete: 'current-password' });
  const next = input({ id: 'pw-new', type: 'password', autocomplete: 'new-password' });
  return h('details', h('summary', { style: 'cursor:pointer;font-weight:650' }, 'Cambia password'),
    h('div', { style: 'display:grid;gap:12px;margin-top:12px' }, field('Password attuale', cur), field('Nuova password (min. 8 caratteri)', next),
      h('div', h('button.btn', { type: 'button', on: { click: async () => {
        try { await App.store.changePassword(cur.value, next.value); toast('Password cambiata'); cur.value = next.value = ''; } catch (e) { reportError(e); }
      } } }, 'Aggiorna password'))));
}

function usersPanel(store, isAdmin) {
  const panel = h('section.card.panel', h('h2', icon('users', 20), 'Utenti e accessi'));
  if (store.mode === 'demo') {
    panel.append(h('p', 'Nella demo i profili sono fissi e senza password. Puoi cambiare profilo per provare i ruoli (es. Marco non può eliminare gli appunti di Luca).'),
      h('div', { style: 'display:grid;gap:8px' }, store.users.map((u) => h('button.persona', { type: 'button', disabled: u.id === store.user.id, on: { click: () => { store.login(u.id); toast(`Ora lavori come ${u.name}`); } } },
        h('span.avatar', initials(u.name)), h('span', h('b', u.name), h('span', ROLES[u.role])), u.id === store.user.id ? h('span.chip.ok', 'Attivo') : icon('chevR', 18)))));
    return panel;
  }
  if (!isAdmin) {
    panel.append(h('p', 'Gli utenti li gestisce l\'amministratore: nuovi account solo tramite invito.'));
    return panel;
  }
  const listEl = h('div', { style: 'display:grid;gap:8px' }, h('p.muted', 'Carico gli utenti…'));
  const role = select(Object.entries(ROLES), 'magazzino', { id: 'inv-role' });
  const name = input({ id: 'inv-name', placeholder: 'Nome della persona' });
  const out = h('div');
  async function load() {
    try {
      const { users } = await store.listUsers();
      fill(listEl, ...users.map((u) => h('div.agenda-item', { style: 'grid-template-columns:auto minmax(0,1fr) auto' },
        h('span.avatar', { style: 'width:32px;height:32px;font-size:12px;box-shadow:none' }, initials(u.name)),
        h('div', h('b', u.name), h('div.muted', { style: 'font-size:12.5px' }, `@${u.username} · ${ROLES[u.role]}${u.active ? '' : ' · disattivato'}`)),
        u.id === store.user.id ? h('span.chip.ok', 'Tu') : h('button.btn.sm', { type: 'button', on: { click: async () => {
          try { await store.updateUser(u.id, { active: !u.active }); toast(u.active ? 'Utente disattivato' : 'Utente riattivato'); load(); } catch (e) { reportError(e); }
        } } }, u.active ? 'Disattiva' : 'Riattiva'))));
    } catch (e) { fill(listEl, h('p.muted', e.message)); }
  }
  load();
  panel.append(listEl,
    h('div.field-label', 'Invita una persona'),
    h('div.row', field('Nome', name), field('Ruolo', role)),
    h('div', h('button.btn.primary', { type: 'button', on: { click: async () => {
      try {
        const r = await store.invite(role.value, name.value);
        const code = h('input.input.mono', { readonly: true, value: r.code, id: 'inv-code' });
        fill(out, h('div.form-info', icon('key', 18), h('div', { style: 'display:grid;gap:8px;width:100%' },
          h('span', `Codice d'invito valido ${r.expiresInDays} giorni, utilizzabile una volta. Consegnalo alla persona: lo inserirà in “Ho un invito”.`),
          h('div', { style: 'display:flex;gap:8px' }, code, h('button.btn', { type: 'button', on: { click: () => copyText(r.code, code) } }, icon('copy', 16), 'Copia')))));
      } catch (e) { reportError(e); }
    } } }, icon('plus', 18), 'Crea invito')),
    out);
  return panel;
}

function backupPanel(s, store, isAdmin) {
  const json = () => store.exportJson();
  const area = textarea({ id: 'bk-in', placeholder: 'Incolla qui un backup JSON, oppure scegli un file', class: 'mono', style: 'font-size:12.5px' });
  const file = h('input', { type: 'file', accept: '.json,application/json', id: 'bk-file', class: 'input' });
  const pv = h('div');
  file.addEventListener('change', async () => { const f = file.files[0]; if (f) { area.value = await f.text(); preview(); } });
  area.addEventListener('input', () => preview());
  let valid = null;
  function preview() {
    clear(pv);
    if (!area.value.trim()) { valid = null; return; }
    const v = validateBackup(area.value);
    valid = v.ok ? v : null;
    if (!v.ok) { pv.append(h('div.form-error', icon('alert', 18), v.error)); return; }
    const cur = { lots: s.lots.length, plans: s.plans.length, movements: s.movements.length, notes: s.notes.length, orders: s.orders.length, events: s.events.length };
    pv.append(h('div.preview-bar', h('b', 'Anteprima della sostituzione'),
      ...Object.keys(cur).map((k) => h('div.pb-row', h('span', k), h('b', `${cur[k]} → ${v.counts[k]}`)))),
    h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, h('button.btn.danger.solid', { type: 'button', on: { click: () => doImport() } }, icon('upload', 18), 'Sostituisci l\'archivio')));
  }
  async function doImport() {
    if (!valid) return;
    const ok = await confirmDialog({ title: 'Sostituire tutto l\'archivio?', message: 'Prima della sostituzione scarico (o mostro) un backup dello stato attuale. Giacenze, appunti, ordini, movimenti e calendario verranno sostituiti.', confirmLabel: 'Sostituisci', danger: true });
    if (!ok) return;
    const before = json();
    try { localStorage.setItem(`magazzino-backup-${Date.now()}`, before); } catch { /* spazio non disponibile */ }
    download(before, `magazzino-prima-di-import-${App.store.today()}.json`);
    const r = await act({ type: 'data.replaceAll', backup: valid.state });
    if (r) { area.value = ''; preview(); }
  }
  return h('section.card.panel',
    h('h2', icon('database', 20), 'Backup'),
    h('p', 'Backup JSON completo di giacenze, arrivi, appunti, ordini, movimenti, calendario e parametri. Non contiene password né sessioni.'),
    h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
      h('button.btn.primary', { type: 'button', on: { click: () => download(json(), `magazzino-backup-${App.store.today()}.json`) } }, icon('download', 18), 'Scarica backup'),
      h('button.btn', { type: 'button', on: { click: () => showJson(json()) } }, icon('copy', 18), 'Mostra e copia')),
    isAdmin ? h('details', h('summary', { style: 'cursor:pointer;font-weight:650' }, 'Importa backup (amministratore)'),
      h('div', { style: 'display:grid;gap:12px;margin-top:12px' }, file, area, pv)) : null);
}

function download(text, name) {
  try {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: 'application/json' })), download: name });
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    if (App.store.mode === 'demo') toast('Se il download non parte (anteprima protetta), usa “Mostra e copia”.', { kind: 'warn' });
  } catch {
    showJson(text);
  }
}

function showJson(text) {
  const area = textarea({ id: 'json-out', readonly: true, class: 'mono', style: 'min-height:320px;font-size:12px' });
  area.value = text;
  openDialog({
    title: 'Backup JSON', subtitle: `${fmtNum(round3(text.length / 1024))} KB`, wide: true,
    body: area,
    foot: (d) => [h('button.btn.ghost', { type: 'button', on: { click: () => d.close() } }, 'Chiudi'), h('button.btn.accent', { type: 'button', on: { click: () => copyText(text, area) } }, icon('copy', 18), 'Copia')],
  });
}

function targetedPanel(s) {
  const example = '{"updates":[{"location":"mucchio-21","lot":"DEMO-M21","tons":125.5}]}';
  const area = textarea({ id: 'tg-in', class: 'mono', style: 'font-size:12.5px', placeholder: example });
  const pv = h('div');
  let payload = null;
  function preview() {
    clear(pv);
    payload = null;
    if (!area.value.trim()) return;
    const r = previewTargeted(App.store.state, area.value);
    if (!r.rows.length) { pv.append(h('div.form-error', icon('alert', 18), r.error)); return; }
    pv.append(h('div.table-wrap', h('table.data.pv-table', { style: 'min-width:520px' },
      h('thead', h('tr', h('th', '#'), h('th', 'Posizione'), h('th', 'Lotto'), h('th.r', 'Prima'), h('th.r', 'Dopo'), h('th', 'Esito'))),
      h('tbody', r.rows.map((row) => h('tr', { style: 'cursor:default' }, h('td', String(row.index)), h('td', row.locationName || row.input?.location || '—'), h('td', row.lotCode ? h('span.code', row.lotCode) : '—'),
        h('td.r', row.before != null ? fmtTons(row.before) : '—'), h('td.r', row.after != null ? fmtTons(row.after) : '—'),
        h(`td${row.ok ? '' : '.err'}`, row.ok ? h('span.pv-ok', 'OK') : row.error)))))),
    r.ok ? h('div', h('button.btn.accent', { type: 'button', on: { click: async (e) => { const ok = await act({ type: 'data.importTargeted', payload: area.value }, { button: e.currentTarget }); if (ok) { area.value = ''; preview(); } } } }, icon('check', 18), `Applica ${r.rows.length} aggiornamenti`))
      : h('div.form-error', icon('alert', 18), r.error));
    payload = r.ok ? area.value : null;
  }
  area.addEventListener('input', preview);
  return h('section.card.panel',
    h('h2', icon('upload', 20), 'Aggiornamento mirato giacenze'),
    h('p', 'JSON preparato fuori dal sito (es. dai PDF di inventario). Cambia solo la quantità di lotti esistenti nei mucchi indicati; tutto il resto resta com\'è. Se nel mucchio ci sono più lotti, “lot” è obbligatorio. Il sito non legge PDF da solo.'),
    h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' }, h('button.btn.sm', { type: 'button', on: { click: () => { area.value = example; preview(); } } }, 'Usa l\'esempio'),
      h('button.btn.sm', { type: 'button', on: { click: () => { area.value = '{"updates":[{"location":"22","tons":60}]}'; preview(); } } }, 'Esempio ambiguo')),
    area, pv);
}

function demoPanel(s, store) {
  const off = store.offsetDays;
  const net = switchControl('Simula archivio irraggiungibile', store.sim.offline, { id: 'sim-net', on: { change: (e) => { store.sim.offline = e.target.checked; store.setStatus({ online: !e.target.checked, error: e.target.checked ? 'Simulato' : null }); } } });
  const conf = switchControl('Il prossimo salvataggio trova una modifica concorrente', store.sim.conflictNext, { id: 'sim-conf', on: { change: (e) => { store.sim.conflictNext = e.target.checked; } } });
  return h('section.card.panel.demo',
    h('h2', icon('flask', 20), 'Strumenti della demo'),
    h('p', 'Servono a verificare gli scenari senza aspettare giorni veri. Non esistono nella versione server.'),
    h('div.field-label', 'Data simulata'),
    h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
      h('button.btn', { type: 'button', on: { click: () => store.shiftDays(-1) } }, icon('chevL', 16), '−1 giorno'),
      h('span.chip.warn', { style: 'height:36px;font-size:14px' }, fmtDayLong(store.today()), off ? ` (${off > 0 ? '+' : ''}${off} g)` : ' (oggi)'),
      h('button.btn.accent', { type: 'button', on: { click: (e) => { store.shiftDays(1); toast('Un giorno è passato: le stime maturate sono state applicate.'); } } }, '+1 giorno', icon('chevR', 16)),
      off ? h('button.btn.ghost', { type: 'button', on: { click: () => store.shiftDays(0) } }, 'Torna a oggi') : null),
    h('p', { style: 'font-size:13px' }, 'Tornare indietro non annulla le stime già registrate: come nella realtà, il ricevuto non si “disfa”.'),
    net.el,
    conf.el,
    h('p', { style: 'font-size:13px' }, 'Conflitti veri: apri la demo in due schede dello stesso browser e modifica lo stesso lotto da entrambe.'),
    h('div', h('button.btn.danger', { type: 'button', on: { click: async () => {
      if (await confirmDialog({ title: 'Ripristinare i dati demo?', message: 'Tutte le modifiche fatte in questa demo verranno perse.', confirmLabel: 'Ripristina', danger: true })) { store.resetDemo(); toast('Dati demo ripristinati'); App.navigate('ricerca'); }
    } } }, icon('history', 18), 'Ripristina dati demo')),
    !store.persistent ? h('div.form-error', icon('alert', 18), 'Questo browser non permette di salvare: le modifiche si perdono ricaricando la pagina.') : null);
}

