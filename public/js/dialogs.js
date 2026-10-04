// Moduli delle operazioni. Ogni modulo cattura la revisione dell'elemento all'apertura:
// se un altro operatore salva prima, il salvataggio viene rifiutato (niente sovrascritture).
import {
  getLocation, fmtTons, fmtNum, parseNum, round3, FORMATS, NOTE_STATUSES, ORDER_STATUSES, ORDER_UNITS, EVENT_TYPES,
  planResidual, planRemainingContainers, positionStats, addDays, daysBetween, canDeleteNote, uid, EPS,
  tripsFor, VEHICLE_STATUSES, VEHICLE_KINDS,
} from './core.js';
import { vehicle } from './art.js';
import {
  App, h, icon, openDialog, confirmDialog, field, input, select, textarea, switchControl, datalist, locationPicker,
  toast, fmtDayShort, clear, fill,
} from './ui.js';
import { burst } from './fx.js';

const S = () => App.store.state;

/* Esecuzione con esito chiaro --------------------------------------- */

export async function act(op, { button, quiet = false } = {}) {
  setBusy(button, true);
  try {
    const result = await App.store.dispatch(op);
    if (!quiet) {
      burst(button, { hue: burstHue(op.type) });
      toast(result?.message || 'Salvato', { art: artFor(op) });
    }
    return result;
  } catch (e) {
    reportError(e);
    return null;
  } finally {
    setBusy(button, false);
  }
}

/** Il mezzo che accompagna l'esito: muletto per i carichi, pala per gli scarichi, camion per gli arrivi. */
export function artFor(op) {
  const t = op.type || '';
  if (t === 'lot.create' || t === 'lot.load') return vehicle('forklift', { load: true });
  if (t === 'lot.unload' || t === 'lot.unloadAll' || t === 'lot.delete') return vehicle('loader', { load: true });
  if (t.startsWith('plan.receive') || t === 'plan.create' || t === 'plan.confirmEstimates') return vehicle('truck');
  if (t === 'lot.transfer' || t === 'lot.update') return vehicle('telehandler', { load: true });
  if (t === 'fleet.update') {
    const v = App.store.state.fleet.find((x) => x.id === op.vehicleId);
    return vehicle(v?.kind || 'forklift');
  }
  return null;
}
const burstHue = (t) => (t === 'lot.unload' || t === 'lot.unloadAll' || t === 'lot.delete' ? 'dust' : 'molten');

/** Viaggi necessari con ciascun mezzo (stima, aggiunta di questa versione). */
function tripsBox() {
  const box = h('div.field', { hidden: true }, h('div.field-label', 'Con i mezzi del piazzale'), h('div.trips'));
  return {
    el: box,
    update(t) {
      const list = tripsFor(S(), t);
      box.hidden = !list.length;
      fill(box.lastChild, list.map((v) => {
        const off = v.status === 'Manutenzione' || v.status === 'Fermo';
        return h(`span.trip${off ? '.off' : ''}`, { title: off ? `${v.name}: ${v.status.toLowerCase()}` : `${v.name}, portata ${fmtNum(v.capacity)} t` },
          vehicle(v.kind), h('span', v.name), h('b', `${v.trips} ${v.trips === 1 ? 'viaggio' : 'viaggi'}`));
      }));
    },
  };
}

export function reportError(e, { inline } = {}) {
  if (e.code === 'network') {
    toast(e.message, { kind: 'error', action: e.op ? { label: 'Riprova', run: () => act(e.op) } : null });
  } else if (e.code === 'conflict') {
    toast(e.message, { kind: 'warn', duration: 10000 });
  } else if (inline) {
    inline(e.message);
  } else {
    toast(e.message || 'Operazione non riuscita', { kind: 'error' });
  }
}

function setBusy(btn, busy) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '';
    btn.append(h('span.spin'), 'Salvo…');
  } else if (btn.dataset.label) {
    btn.innerHTML = btn.dataset.label;
    btn.disabled = false;
    delete btn.dataset.label;
  }
}

/**
 * Dialogo con modulo. build() restituisce l'operazione oppure lancia un messaggio.
 * Errori di validazione restano nel modulo; conflitti chiudono e ricaricano.
 */
function formDialog({ title, subtitle, content, submitLabel = 'Salva', danger = false, wide = false, build, after, extraFoot }) {
  const opId = uid('op'); // stesso id per i tentativi ripetuti: un solo effetto
  let errBox;
  let submitBtn;
  return openDialog({
    title, subtitle, wide,
    body: (d) => {
      errBox = h('div', { role: 'alert' });
      const form = h('form', { novalidate: true, style: 'display:grid;gap:16px', on: { submit: (e) => { e.preventDefault(); submit(d); } } },
        errBox, typeof content === 'function' ? content(d) : content, h('button', { type: 'submit', hidden: true }));
      d.form = form;
      return form;
    },
    foot: (d) => [
      extraFoot ? extraFoot(d) : null,
      h('button.btn.ghost', { type: 'button', on: { click: () => d.close() } }, 'Annulla'),
      submitBtn = h(`button.btn${danger ? '.danger.solid' : '.accent'}`, { type: 'button', on: { click: () => submit(d) } }, submitLabel),
    ],
  });
  async function submit(d) {
    clear(errBox);
    let op;
    try { op = build(d); } catch (msg) { showErr(String(msg.message || msg)); return; }
    if (!op) return;
    setBusy(submitBtn, true);
    try {
      const result = await App.store.dispatch({ ...op, opId });
      burst(submitBtn, { count: 46, hue: burstHue(op.type) });
      toast(result?.message || 'Salvato', { art: artFor(op) });
      d.close();
      after?.(result);
    } catch (e) {
      if (e.code === 'validation' || e.code === 'forbidden') showErr(e.message);
      else if (e.code === 'network') showErr(e.message + ' Puoi premere di nuovo: l\'operazione non verrà duplicata.');
      else { d.close(); reportError(e); }
    } finally {
      setBusy(submitBtn, false);
    }
  }
  function showErr(msg) {
    fill(errBox, h('div.form-error', icon('alert', 18), h('span', msg)));
  }
}

function suggestionsFor(key) {
  const s = S();
  return [...s.lots.map((l) => l[key]), ...s.plans.map((p) => p[key])];
}
const locStatsFor = (id) => {
  const st = positionStats(S(), id);
  return st.present ? fmtTons(st.present) : 'vuota';
};

function lotHeader(lot) {
  return h('div.preview-bar', { style: 'gap:4px' },
    h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, h('b', lot.material), h('span.code', lot.lotCode)),
    h('div', { style: 'font-size:13.5px;color:var(--ink-3)' }, `${lot.client} · ${getLocation(lot.locationId)?.name} · ${lot.format}${lot.bags ? ` (${lot.bags} sacconi)` : ''}`));
}

/* Aggiungi materiale ------------------------------------------------- */

export function addMaterialDialog({ locationId = null, tab = 'lot' } = {}) {
  let mode = tab;
  const lotPanel = h('div', { style: 'display:grid;gap:16px' });
  const planPanel = h('div', { style: 'display:grid;gap:16px' });
  const loc = locationPicker({ value: locationId, id: 'am-loc', statsFor: locStatsFor });
  const material = input({ id: 'am-mat', list: 'dl-mat', placeholder: 'es. Ferro-silicio FeSi 75' });
  const client = input({ id: 'am-cli', list: 'dl-cli', placeholder: 'es. Acciaierie Demo Nord' });
  const lotCode = input({ id: 'am-lot', placeholder: 'es. DEMO-123', class: 'mono' });
  const format = select(FORMATS, 'Sfuso', { id: 'am-fmt' });
  const common = h('div', { style: 'display:grid;gap:16px' },
    field('Posizione', loc.el, { id: 'am-loc' }),
    h('div.row', field('Materiale', material), field('Cliente', client)),
    h('div.row', field('Numero lotto / ID', lotCode, { hint: 'Come scritto sui documenti.' }), field('Formato', format)),
    datalist('dl-mat', suggestionsFor('material')), datalist('dl-cli', suggestionsFor('client')));

  // Lotto presente
  const tons = input({ id: 'am-tons', inputmode: 'decimal', placeholder: '0' });
  const bags = input({ id: 'am-bags', inputmode: 'numeric', placeholder: 'facoltativo' });
  const bagsField = field('Numero sacconi', bags);
  const pdf = input({ id: 'am-pdf', placeholder: 'facoltativo, es. DDT-0412.pdf' });
  const note = input({ id: 'am-note', placeholder: 'facoltativa' });
  const syncBags = () => { bagsField.hidden = format.value !== 'Sacconi'; };
  format.addEventListener('change', syncBags);
  syncBags();
  lotPanel.append(
    field('Quantità presente', h('div.big-num', tons, h('span.unit', 't')), { id: 'am-tons', hint: 'Fino a tre decimali, es. 12,5' }),
    bagsField,
    h('details', h('summary', { style: 'cursor:pointer;font-weight:650;color:var(--ink-2);padding:6px 0' }, 'Dettagli secondari'),
      h('div', { style: 'display:grid;gap:14px;margin-top:10px' }, field('Riferimento PDF / documento', pdf), field('Nota del movimento', note))));

  // Arrivo su più giorni
  const pf = planForm(null);
  planPanel.append(pf.el);

  const tabsEl = h('div.tabs', { role: 'tablist' });
  const tabBtn = (key, label) => h('button', { type: 'button', role: 'tab', 'aria-selected': String(mode === key), on: { click: () => { mode = key; sync(); } } }, label);
  const tLot = tabBtn('lot', 'Materiale presente');
  const tPlan = tabBtn('plan', 'Arrivo su più giorni');
  tabsEl.append(tLot, tPlan);
  function sync() {
    tLot.setAttribute('aria-selected', String(mode === 'lot'));
    tPlan.setAttribute('aria-selected', String(mode === 'plan'));
    lotPanel.hidden = mode !== 'lot';
    planPanel.hidden = mode !== 'plan';
  }
  sync();

  formDialog({
    title: 'Aggiungi materiale',
    subtitle: 'Ogni lotto resta separato, anche nella stessa posizione.',
    wide: true,
    content: h('div', { style: 'display:grid;gap:16px' }, tabsEl, common, lotPanel, planPanel),
    submitLabel: 'Salva',
    build: () => {
      if (!loc.validate()) throw 'Scegli una posizione valida dall\'elenco.';
      const base = { locationId: loc.value, material: material.value, client: client.value, lotCode: lotCode.value, format: format.value };
      if (mode === 'lot') {
        return { type: 'lot.create', ...base, tons: tons.value, bags: format.value === 'Sacconi' ? bags.value : '', pdfRef: pdf.value, note: note.value };
      }
      return { type: 'plan.create', ...base, ...pf.values() };
    },
    after: () => App.navigate(`pos-${loc.value}`),
  });
}

/** Campi del piano di arrivo con anteprima della ripartizione. */
function planForm(plan) {
  const s = S();
  const tpc = s.settings.tonsPerContainer;
  const containers = input({ id: 'pf-c', inputmode: 'numeric', value: plan ? String(plan.containers) : '10' });
  const days = input({ id: 'pf-d', inputmode: 'numeric', value: plan ? String(plan.days) : '5' });
  const start = input({ id: 'pf-s', type: 'date', value: plan ? plan.startDate : App.store.today() });
  const total = input({ id: 'pf-t', inputmode: 'decimal', value: plan ? fmtNum(plan.totalTons) : '' });
  const note = input({ id: 'pf-n', placeholder: 'facoltativa', value: plan?.note || '' });
  let totalTouched = !!plan;
  const preview = h('div', { style: 'display:grid;gap:10px' });
  function values() {
    return { containers: containers.value, days: days.value, startDate: start.value, totalTons: total.value.trim() === '' ? '' : total.value, note: note.value };
  }
  function update() {
    const c = parseNum(containers.value);
    const d = parseNum(days.value);
    if (!totalTouched) total.placeholder = Number.isInteger(c) && c > 0 ? fmtNum(c * tpc) : '';
    clear(preview);
    if (!Number.isInteger(c) || c < 1 || !Number.isInteger(d) || d < 1 || !start.value) return;
    const t = total.value.trim() ? parseNum(total.value) : c * tpc;
    const rows = [];
    let prev = 0;
    for (let i = 1; i <= Math.min(d, 31); i++) { const cum = Math.floor((c * i) / d); rows.push(cum - prev); prev = cum; }
    const max = Math.max(...rows, 1);
    preview.append(
      h('div.form-info', icon('info', 18), h('span',
        `${c} container in ${d} giorni: circa ${fmtNum(round3(c / d))} al giorno · peso medio ${Number.isFinite(t) ? fmtTons(round3(t / c)) : '—'} per container. `,
        `Il primo giorno (${fmtDayShort(start.value)}) non matura nulla; l'ultima stima arriva ${fmtDayShort(addDays(start.value, d))}.`)),
      h('div.schedule-mini', { 'aria-label': 'Container stimati per giorno' },
        rows.map((n, i) => h('div', h('i', { style: { height: `${Math.max(4, (n / max) * 40)}px` } }), `G${i + 1}`, h('span', { style: 'color:var(--ink-2)' }, String(n))))));
  }
  for (const el of [containers, days, start, total]) el.addEventListener('input', update);
  total.addEventListener('input', () => { totalTouched = total.value.trim() !== ''; });
  update();
  const el = h('div', { style: 'display:grid;gap:16px' },
    h('div.row',
      field('Container totali', containers),
      field('Giorni stimati', days),
      field('Primo giorno del piano', start)),
    h('div.row',
      field('Tonnellate totali previste', h('div.big-num', total, h('span.unit', 't')), { id: 'pf-t', hint: `Vuoto = container × ${fmtNum(tpc)} t (parametro modificabile, non è una pesatura).` }),
      field('Nota', note)),
    preview);
  return { el, values };
}

/* Carico / scarico --------------------------------------------------- */

export function qtyDialog(lot, kind) {
  const isLoad = kind === 'load';
  const rev = lot.rev;
  const qty = input({ id: 'q-t', inputmode: 'decimal', placeholder: '0', autofocus: true });
  const note = input({ id: 'q-n', placeholder: isLoad ? 'es. camion in entrata' : 'es. camion per cliente' });
  const after = h('b', fmtTons(lot.tons));
  const barNow = h('i', { style: { width: '100%' } });
  const barGhost = h('i.ghost', { style: { width: '0%' } });
  const quick = h('div.quick-qty', (isLoad ? [1, 5, 10, 27] : [1, 5, 10, 25]).filter((v) => isLoad || v < lot.tons).map((v) =>
    h('button', { type: 'button', on: { click: () => { qty.value = fmtNum(v); upd(); qty.focus(); } } }, `${fmtNum(v)} t`)),
  !isLoad && h('button', { type: 'button', on: { click: () => { qty.value = fmtNum(round3(lot.tons / 2)); upd(); } } }, 'Metà'),
  !isLoad && h('button', { type: 'button', on: { click: () => { qty.value = fmtNum(lot.tons); upd(); } } }, `Tutto (${fmtTons(lot.tons)})`));
  let submitBtn;
  function upd() {
    const v = parseNum(qty.value);
    const next = Number.isFinite(v) ? round3(isLoad ? lot.tons + v : lot.tons - v) : lot.tons;
    after.textContent = fmtTons(Math.max(0, next));
    after.style.color = next < -EPS ? 'var(--bad)' : '';
    const scale = Math.max(lot.tons, next, 1);
    if (isLoad) { barNow.style.width = `${(lot.tons / scale) * 100}%`; barGhost.style.width = `${(Math.max(0, next) / scale) * 100}%`; barGhost.style.zIndex = '-1'; }
    else { barNow.style.width = `${(Math.max(0, next) / scale) * 100}%`; barGhost.style.width = `${(lot.tons / scale) * 100}%`; }
    qty.setAttribute('aria-invalid', String(next < -EPS));
    if (submitBtn) submitBtn.textContent = Number.isFinite(v) && v > 0 ? `${isLoad ? 'Carica' : 'Scarica'} ${fmtTons(v)}` : (isLoad ? 'Carica' : 'Scarica');
  }
  const trips = tripsBox();
  qty.addEventListener('input', upd);
  qty.addEventListener('input', () => trips.update(parseNum(qty.value)));
  quick.addEventListener('click', () => trips.update(parseNum(qty.value)));
  const d = formDialog({
    title: isLoad ? 'Carico' : 'Scarico',
    subtitle: isLoad ? 'Aggiunge quantità a questo lotto.' : 'Toglie quantità da questo lotto. Non può superare il disponibile.',
    content: h('div', { style: 'display:grid;gap:16px' },
      lotHeader(lot),
      field(isLoad ? 'Quantità da caricare' : 'Quantità da scaricare', h('div.big-num', qty, h('span.unit', 't')), { id: 'q-t' }),
      quick,
      h('div.preview-bar',
        h('div.pb-row', h('span', 'Ora'), h('b', fmtTons(lot.tons))),
        h('div.pb-track', { style: 'isolation:isolate' }, barGhost, barNow),
        h('div.pb-row', h('span', 'Dopo'), after)),
      trips.el,
      field('Nota (facoltativa)', note)),
    submitLabel: isLoad ? 'Carica' : 'Scarica',
    build: () => ({ type: isLoad ? 'lot.load' : 'lot.unload', lotId: lot.id, expectRev: rev, tons: qty.value, note: note.value }),
  });
  submitBtn = d.el.querySelector('.dialog-foot .btn.accent');
  upd();
}

export async function unloadAllDialog(lot, button) {
  const ok = await confirmDialog({
    title: `Scaricare tutto ${lot.lotCode}?`,
    message: `Tolgo ${fmtTons(lot.tons)} dalla giacenza di ${getLocation(lot.locationId).name}. Il lotto non comparirà più fra i presenti; il movimento resta nello storico.`,
    confirmLabel: `Scarica ${fmtTons(lot.tons)}`,
    danger: true,
  });
  if (ok) await act({ type: 'lot.unloadAll', lotId: lot.id, expectRev: lot.rev }, { button });
}

export function editLotDialog(lot) {
  const rev = lot.rev;
  const loc = locationPicker({ value: lot.locationId, id: 'el-loc', statsFor: locStatsFor });
  const material = input({ id: 'el-mat', list: 'dl-mat2', value: lot.material });
  const client = input({ id: 'el-cli', list: 'dl-cli2', value: lot.client });
  const lotCode = input({ id: 'el-lot', value: lot.lotCode, class: 'mono' });
  const format = select(FORMATS, lot.format, { id: 'el-fmt' });
  const bags = input({ id: 'el-bags', inputmode: 'numeric', value: lot.bags ?? '' });
  const pdf = input({ id: 'el-pdf', value: lot.pdfRef || '' });
  const tons = input({ id: 'el-t', inputmode: 'decimal', value: fmtNum(lot.tons) });
  const reason = input({ id: 'el-r', placeholder: 'es. ripesatura, errore di inserimento' });
  const reasonField = field('Motivo della rettifica', reason, { hint: 'Obbligatorio se cambi la quantità: resta nei movimenti.' });
  const syncReason = () => { reasonField.hidden = Math.abs((parseNum(tons.value) || 0) - lot.tons) <= EPS; };
  tons.addEventListener('input', syncReason);
  syncReason();
  formDialog({
    title: 'Modifica lotto',
    subtitle: `${lot.lotCode} · ultima modifica di ${lot.updatedByName || '—'}`,
    wide: true,
    content: h('div', { style: 'display:grid;gap:16px' },
      h('div.row', field('Materiale', material), field('Cliente', client)),
      h('div.row', field('Numero lotto / ID', lotCode), field('Formato', format), field('Sacconi', bags)),
      field('Posizione', loc.el, { id: 'el-loc', hint: 'Cambiare posizione sposta l\'intero lotto (movimento registrato). Per spostarne una parte usa “Trasferisci”.' }),
      h('div.row', field('Quantità', h('div.big-num', tons, h('span.unit', 't')), { id: 'el-t' }), reasonField),
      field('Riferimento PDF / documento', pdf),
      datalist('dl-mat2', suggestionsFor('material')), datalist('dl-cli2', suggestionsFor('client'))),
    build: () => {
      if (!loc.validate()) throw 'Scegli una posizione valida.';
      return { type: 'lot.update', lotId: lot.id, expectRev: rev, reason: reason.value,
        fields: { material: material.value, client: client.value, lotCode: lotCode.value, format: format.value, bags: bags.value, pdfRef: pdf.value, locationId: loc.value, tons: tons.value } };
    },
  });
}

export function transferDialog(lot) {
  const rev = lot.rev;
  const dest = locationPicker({ id: 'tr-loc', statsFor: locStatsFor, exclude: lot.locationId });
  const qty = input({ id: 'tr-t', inputmode: 'decimal', value: fmtNum(lot.tons) });
  const note = input({ id: 'tr-n', placeholder: 'facoltativa' });
  const info = h('div.preview-bar');
  function upd() {
    const v = parseNum(qty.value);
    clear(info);
    const ok = Number.isFinite(v) && v > 0 && v <= lot.tons + EPS;
    info.append(
      h('div.pb-row', h('span', getLocation(lot.locationId).name), h('b', ok ? `${fmtTons(lot.tons)} → ${fmtTons(round3(lot.tons - v))}` : fmtTons(lot.tons))),
      h('div.pb-row', h('span', dest.value ? getLocation(dest.value).name : 'Destinazione'), h('b', ok ? `+ ${fmtTons(v)}` : '—')),
      h('div.pb-row', h('span', 'Totale magazzino'), h('b', 'invariato')));
  }
  const trips = tripsBox();
  qty.addEventListener('input', upd);
  qty.addEventListener('input', () => trips.update(parseNum(qty.value)));
  dest.el.addEventListener('locchange', upd);
  upd();
  trips.update(lot.tons);
  formDialog({
    title: 'Trasferisci',
    subtitle: 'Aggiunta di questa versione: sposta tutto o parte del lotto registrando origine e destinazione.',
    content: h('div', { style: 'display:grid;gap:16px' },
      lotHeader(lot),
      field('Destinazione', dest.el, { id: 'tr-loc' }),
      field('Quantità da spostare', h('div.big-num', qty, h('span.unit', 't')), { id: 'tr-t' }),
      info,
      trips.el,
      field('Nota', note)),
    submitLabel: 'Trasferisci',
    build: () => {
      if (!dest.validate()) throw 'Scegli una destinazione valida.';
      return { type: 'lot.transfer', lotId: lot.id, expectRev: rev, toLocationId: dest.value, tons: qty.value, note: note.value };
    },
  });
}

export function deleteLotDialog(lot) {
  const reason = input({ id: 'dl-r', placeholder: 'es. inserito per errore' });
  formDialog({
    title: `Eliminare ${lot.lotCode}?`,
    subtitle: 'Il lotto esce dalla giacenza corrente. Movimenti, appunti e arrivi futuri non vengono cancellati.',
    content: h('div', { style: 'display:grid;gap:16px' }, lotHeader(lot), field('Motivo (facoltativo)', reason)),
    submitLabel: 'Elimina lotto',
    danger: true,
    build: () => ({ type: 'lot.delete', lotId: lot.id, expectRev: lot.rev, reason: reason.value }),
  });
}

/* Piani di arrivo ---------------------------------------------------- */

export function editPlanDialog(plan) {
  const rev = plan.rev;
  const material = input({ id: 'ep-mat', value: plan.material, list: 'dl-mat3' });
  const client = input({ id: 'ep-cli', value: plan.client, list: 'dl-cli3' });
  const lotCode = input({ id: 'ep-lot', value: plan.lotCode, class: 'mono' });
  const format = select(FORMATS, plan.format, { id: 'ep-fmt' });
  const loc = locationPicker({ value: plan.locationId, id: 'ep-loc', statsFor: locStatsFor });
  if (plan.receivedContainers > 0) loc.input.disabled = true;
  const pf = planForm(plan);
  formDialog({
    title: 'Modifica piano di arrivo',
    subtitle: `Già ricevuti ${plan.receivedContainers} container (${fmtTons(plan.receivedTons)}): restano riconosciuti.`,
    wide: true,
    content: h('div', { style: 'display:grid;gap:16px' },
      h('div.row', field('Materiale', material), field('Cliente', client)),
      h('div.row', field('Numero lotto / ID', lotCode), field('Formato', format)),
      field('Posizione', loc.el, { id: 'ep-loc', hint: plan.receivedContainers > 0 ? 'Bloccata: il piano ha già ricevuto materiale. Sposta il lotto con “Trasferisci”.' : '' }),
      pf.el,
      datalist('dl-mat3', suggestionsFor('material')), datalist('dl-cli3', suggestionsFor('client'))),
    build: () => {
      if (!loc.validate()) throw 'Scegli una posizione valida.';
      return { type: 'plan.update', planId: plan.id, expectRev: rev,
        fields: { material: material.value, client: client.value, lotCode: lotCode.value, format: format.value, locationId: loc.value, ...pf.values() } };
    },
  });
}

export function receiveDialog(plan, { suggested } = {}) {
  const rev = plan.rev;
  const remC = planRemainingContainers(plan);
  const remT = planResidual(plan);
  const avg = round3(remT / remC);
  let n = Math.min(remC, suggested || 1);
  const count = input({ id: 'rc-c', inputmode: 'numeric', value: String(n) });
  const tons = input({ id: 'rc-t', inputmode: 'decimal' });
  let touched = false;
  const sum = h('div.preview-bar');
  function auto() {
    const c = parseNum(count.value);
    if (!touched && Number.isInteger(c) && c > 0) tons.value = fmtNum(c >= remC ? remT : round3(avg * c));
    const t = parseNum(tons.value);
    fill(sum, 
      h('div.pb-row', h('span', 'Residuo ora'), h('b', `${remC} container · ${fmtTons(remT)}`)),
      h('div.pb-row', h('span', 'Dopo la ricezione'), h('b', Number.isInteger(c) && Number.isFinite(t) ? `${Math.max(0, remC - c)} container · ${fmtTons(Math.max(0, round3(remT - t)))}` : '—')));
  }
  const step = (dlt) => { const c = Math.min(remC, Math.max(1, (parseNum(count.value) || 0) + dlt)); count.value = String(c); auto(); };
  count.addEventListener('input', auto);
  tons.addEventListener('input', () => { touched = true; auto(); });
  auto();
  formDialog({
    title: 'Ricevi oggi',
    subtitle: `${plan.material} · ${plan.lotCode} → ${getLocation(plan.locationId).name}`,
    content: h('div', { style: 'display:grid;gap:16px' },
      field('Container arrivati', h('div.stepper',
        h('button.btn', { type: 'button', 'aria-label': 'Un container in meno', on: { click: () => step(-1) } }, '−'),
        count,
        h('button.btn', { type: 'button', 'aria-label': 'Un container in più', on: { click: () => step(1) } }, '+')), { id: 'rc-c' }),
      field('Tonnellate complessive', h('div.big-num', tons, h('span.unit', 't')), { id: 'rc-t', hint: `Proposte con il peso medio residuo (${fmtTons(avg)}/container). Gli ultimi container chiudono il residuo.` }),
      sum),
    submitLabel: 'Registra ricezione',
    build: () => ({ type: 'plan.receive', planId: plan.id, expectRev: rev, containers: count.value, tons: tons.value }),
  });
}

export async function receiveAllDialog(plan, button) {
  const ok = await confirmDialog({
    title: 'Ricevere tutto oggi?',
    message: `Registro gli ultimi ${planRemainingContainers(plan)} container (${fmtTons(planResidual(plan))}) e chiudo il piano. Il materiale si aggiunge al lotto ${plan.lotCode}.`,
    confirmLabel: 'Ricevi tutto',
  });
  if (ok) await act({ type: 'plan.receiveAll', planId: plan.id, expectRev: plan.rev }, { button });
}

export function pauseDialog(plan, button) {
  if (!plan.paused) return act({ type: 'plan.pause', planId: plan.id, expectRev: plan.rev, paused: true }, { button });
  const days = Math.max(0, daysBetween(plan.pausedAt || App.store.today(), App.store.today()));
  if (days === 0) return act({ type: 'plan.pause', planId: plan.id, expectRev: plan.rev, paused: false }, { button });
  openDialog({
    title: 'Riprendere l\'automatico',
    subtitle: `Il piano è in pausa da ${days} ${days === 1 ? 'giorno' : 'giorni'}.`,
    body: h('div', { style: 'display:grid;gap:12px' },
      h('p', { style: 'color:var(--ink-2)' }, 'Scegli come riprendere. La prima opzione segue la formula originale; la seconda è un\'aggiunta di questa versione.')),
    foot: (d) => [
      h('button.btn', { type: 'button', on: { click: () => { d.close(); act({ type: 'plan.pause', planId: plan.id, expectRev: plan.rev, paused: false }, { button }); } } },
        'Riprendi e recupera'),
      h('button.btn.accent', { type: 'button', on: { click: () => { d.close(); act({ type: 'plan.pause', planId: plan.id, expectRev: plan.rev, paused: false, shiftSchedule: true }, { button }); } } },
        `Sposta il calendario di ${days} g`),
    ],
  });
}

export function cancelPlanDialog(plan) {
  if (plan.receivedContainers === 0) {
    return confirmDialog({ title: 'Eliminare il piano?', message: 'Non è ancora arrivato nulla: il piano viene tolto dagli arrivi.', confirmLabel: 'Elimina piano', danger: true })
      .then((ok) => ok && act({ type: 'plan.delete', planId: plan.id, expectRev: plan.rev }));
  }
  const reason = input({ id: 'cp-r', placeholder: 'es. il cliente ha ridotto l\'ordine' });
  formDialog({
    title: 'Annullare l\'arrivo?',
    subtitle: 'Tolgo solo il futuro non ricevuto.',
    content: h('div', { style: 'display:grid;gap:16px' },
      h('div.preview-bar',
        h('div.pb-row', h('span', 'Già ricevuto (resta presente)'), h('b', `${plan.receivedContainers} container · ${fmtTons(plan.receivedTons)}`)),
        h('div.pb-row', h('span', 'Residuo da annullare'), h('b', { style: 'color:var(--bad)' }, `${planRemainingContainers(plan)} container · ${fmtTons(planResidual(plan))}`))),
      field('Motivo (facoltativo)', reason)),
    submitLabel: 'Annulla arrivo',
    danger: true,
    build: () => ({ type: 'plan.cancel', planId: plan.id, expectRev: plan.rev, reason: reason.value }),
  });
}

/* Appunti ------------------------------------------------------------ */

export function noteDialog(note, { locationId = null } = {}) {
  const title = input({ id: 'nt-t', value: note?.title || '', placeholder: 'es. Telo da sistemare', autofocus: true });
  const text = textarea({ id: 'nt-x', placeholder: 'Dettagli (facoltativi)' });
  text.value = note?.text || '';
  const loc = locationPicker({ value: note ? note.locationId : locationId, id: 'nt-loc', allowGeneral: true, required: false });
  const status = select(NOTE_STATUSES, note?.status || 'Aperto', { id: 'nt-s' });
  const imp = switchControl('Importante: mostralo in cima alla posizione', note ? note.important : true, { id: 'nt-i' });
  const user = App.store.user;
  formDialog({
    title: note ? 'Modifica appunto' : 'Nuovo appunto',
    subtitle: note ? `Scritto da ${note.createdByName || 'autore sconosciuto'}${note.updatedByName && note.updatedByName !== note.createdByName ? ` · modificato da ${note.updatedByName}` : ''}` : `Autore: ${user.name}`,
    content: h('div', { style: 'display:grid;gap:16px' },
      field('Titolo', title), field('Testo', text),
      h('div.row', field('Posizione', loc.el, { id: 'nt-loc', hint: 'Lascia vuoto per un appunto generale.' }), field('Stato', status)),
      imp.el),
    extraFoot: note && canDeleteNote(user, note) ? (d) => h('button.btn.danger', { type: 'button', style: 'margin-right:auto', on: { click: async () => { d.close(); await deleteNote(note); } } }, icon('trash', 18), 'Elimina') : null,
    build: () => {
      if (!loc.validate()) throw 'Posizione non valida: sceglila dall\'elenco o lascia vuoto.';
      const fields = { title: title.value, text: text.value, locationId: loc.value, status: status.value, important: imp.input.checked };
      return note ? { type: 'note.update', noteId: note.id, expectRev: note.rev, fields } : { type: 'note.create', ...fields };
    },
  });
}

export async function deleteNote(note, button) {
  if (!canDeleteNote(App.store.user, note)) {
    toast(note.createdBy ? `Puoi eliminare solo i tuoi appunti: questo è di ${note.createdByName}. Puoi segnarlo come Risolto.` : "Gli appunti senza autore li elimina l'amministratore.", { kind: 'warn' });
    return;
  }
  const ok = await confirmDialog({ title: 'Eliminare l\'appunto?', message: `“${note.title}” verrà tolto. L'operazione resta nel registro modifiche.`, confirmLabel: 'Elimina', danger: true });
  if (ok) await act({ type: 'note.delete', noteId: note.id, expectRev: note.rev }, { button });
}

/* Ordini ------------------------------------------------------------- */

export function orderDialog(order, { date } = {}) {
  const title = input({ id: 'or-t', value: order?.title || '', placeholder: 'es. Caricare camion per cliente', autofocus: true });
  const d = input({ id: 'or-d', type: 'date', value: order?.date || date || App.store.today() });
  const t = input({ id: 'or-h', type: 'time', value: order?.time || '' });
  const material = input({ id: 'or-m', list: 'dl-mat4', value: order?.material || '', placeholder: 'facoltativo' });
  const loc = locationPicker({ value: order?.locationId || null, id: 'or-loc', required: false, statsFor: locStatsFor });
  const qty = input({ id: 'or-q', inputmode: 'decimal', value: order?.qty != null ? fmtNum(order.qty) : '', placeholder: 'facoltativa' });
  const unit = select(ORDER_UNITS, order?.unit || 't', { id: 'or-u' });
  const status = select(ORDER_STATUSES, order?.status || 'Da fare', { id: 'or-s' });
  const notes = textarea({ id: 'or-n', placeholder: 'facoltative' });
  notes.value = order?.notes || '';
  const veh = select([['', 'Nessuno'], ...S().fleet.map((v) => [v.id, `${v.name} · ${fmtNum(v.capacity)} t${v.status !== 'Disponibile' ? ` (${v.status.toLowerCase()})` : ''}`])], order?.vehicleId || '', { id: 'or-v' });
  formDialog({
    title: order ? 'Modifica ordine' : 'Nuovo ordine di lavoro',
    subtitle: 'Completare un ordine non scarica materiale: lo scarico si fa sul lotto.',
    wide: true,
    content: h('div', { style: 'display:grid;gap:16px' },
      field('Titolo', title),
      h('div.row', field('Data', d), field('Ora (facoltativa)', t), field('Stato', status)),
      h('div.row', field('Materiale', material), field('Posizione', loc.el, { id: 'or-loc' })),
      h('div.row', field('Quantità', qty), field('Unità', unit), field('Mezzo', veh)),
      field('Note', notes),
      datalist('dl-mat4', suggestionsFor('material'))),
    build: () => {
      if (!loc.validate()) throw 'Posizione non valida: sceglila dall\'elenco o lascia vuoto.';
      const fields = { title: title.value, date: d.value, time: t.value, material: material.value, locationId: loc.value, qty: qty.value, unit: unit.value, status: status.value, notes: notes.value, vehicleId: veh.value || null };
      return order ? { type: 'order.update', orderId: order.id, expectRev: order.rev, fields } : { type: 'order.create', ...fields };
    },
  });
}

export async function setOrderStatus(order, status, button) {
  const r = await act({ type: 'order.update', orderId: order.id, expectRev: order.rev, fields: { status } }, { button, quiet: true });
  if (!r) return;
  if (status === 'Completato') {
    burst(button, { count: 28, hue: 'cool' });
    toast('Ordine completato. Nessuno scarico automatico: la giacenza non cambia.', {
      action: order.locationId ? { label: 'Vai allo scarico', run: () => App.navigate(`pos-${order.locationId}`) } : null, duration: 7000 });
  } else toast(r.message);
}

export async function deleteOrder(order) {
  const ok = await confirmDialog({ title: 'Eliminare l\'ordine?', message: `“${order.title}” verrà tolto dagli ordini.`, confirmLabel: 'Elimina', danger: true });
  if (ok) await act({ type: 'order.delete', orderId: order.id, expectRev: order.rev });
}

/* Calendario --------------------------------------------------------- */

export function eventDialog(ev, { date } = {}) {
  const title = input({ id: 'ev-t', value: ev?.title || '', placeholder: 'es. Arrivo camion', autofocus: true });
  const d = input({ id: 'ev-d', type: 'date', value: ev?.date || date || App.store.today() });
  const t = input({ id: 'ev-h', type: 'time', value: ev?.time || '' });
  const kind = select(EVENT_TYPES, ev?.kind || 'Promemoria', { id: 'ev-k' });
  const notes = textarea({ id: 'ev-n', placeholder: 'facoltative' });
  notes.value = ev?.notes || '';
  formDialog({
    title: ev ? 'Modifica evento' : 'Nuovo evento',
    content: h('div', { style: 'display:grid;gap:16px' },
      field('Titolo', title),
      h('div.row', field('Data', d), field('Ora', t), field('Tipo', kind)),
      field('Note', notes)),
    extraFoot: ev ? (dl) => h('button.btn.danger', { type: 'button', style: 'margin-right:auto', on: { click: async () => {
      dl.close();
      if (await confirmDialog({ title: 'Eliminare l\'evento?', message: `“${ev.title}” verrà tolto dal calendario.`, confirmLabel: 'Elimina', danger: true })) await act({ type: 'event.delete', eventId: ev.id, expectRev: ev.rev });
    } } }, icon('trash', 18), 'Elimina') : null,
    build: () => {
      const fields = { title: title.value, date: d.value, time: t.value, kind: kind.value, notes: notes.value };
      return ev ? { type: 'event.update', eventId: ev.id, expectRev: ev.rev, fields } : { type: 'event.create', ...fields };
    },
  });
}


/* Mezzi -------------------------------------------------------------- */

export function fleetDialog(v) {
  const isAdmin = App.store.user.role === 'admin';
  let status = v.status;
  const seg = h('div.seg', { role: 'radiogroup', 'aria-label': 'Stato del mezzo' });
  const drawSeg = () => fill(seg, VEHICLE_STATUSES.map((st) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(st === status), 'aria-pressed': String(st === status),
    on: { click: () => { status = st; drawSeg(); } } }, st)));
  drawSeg();
  const note = input({ id: 'fl-n', value: v.note || '', placeholder: 'es. cambio forche, rientra giovedì' });
  const name = input({ id: 'fl-name', value: v.name, disabled: !isAdmin });
  const cap = input({ id: 'fl-cap', inputmode: 'decimal', value: fmtNum(v.capacity), disabled: !isAdmin });
  const pic = vehicle(v.kind, { load: true, cls: 'dialog-veh' });
  pic.style.cssText = 'width:min(260px,70%);justify-self:center;display:block';
  formDialog({
    title: v.name,
    subtitle: `${VEHICLE_KINDS[v.kind] || 'Mezzo'} · portata ${fmtNum(v.capacity)} t${v.updatedByName ? ` · aggiornato da ${v.updatedByName}` : ''}`,
    content: h('div', { style: 'display:grid;gap:16px' },
      pic,
      h('div.field', h('div.field-label', 'Stato'), seg),
      field('Nota', note),
      h('div.row', field('Nome', name), field('Portata (t)', cap, { hint: isAdmin ? '' : "Modificabili dall'amministratore." }))),
    submitLabel: 'Salva',
    build: () => ({ type: 'fleet.update', vehicleId: v.id, expectRev: v.rev, fields: { status, note: note.value, ...(isAdmin ? { name: name.value, capacity: cap.value } : {}) } }),
  });
}
