// ============================================================================
//  Garage · le auto del giocatore
//  Tutte le auto hanno la stessa struttura:
//    tuning   catalogo prestazioni (categorie → tendine; ogni pezzo: prezzo, km per sbloccarlo, nota)
//    presets  preparazioni pronte
//    params   selezione → parametri di fisica, suono e aspetto
//    body     estetica propria dell'auto (oltre a quella comune del Neon Kustom)
//  Per aggiungere un'auto basta un'altra voce con questi campi.
// ============================================================================
/* global TUNING_SUPRA, SUPRA_PRESETS, supraParams, tuningItemOf */
let ACTIVE_CAR = 'supra';

// ---------------------------------------------------------------- Volvo V40 SW 2.0
// Note da preparatore: il B4204S è un aspirato da 140 CV con testata buona e basamento solido (lo stesso
// blocco della T4 sovralimentata). Aspirato rende poco con scarico e filtro (+3-5 % in tutto): il salto vero
// è il turbo. La trazione anteriore è il limite: oltre ~220 CV serve l'autobloccante, e un posteriore
// alleggerito toglie ancora peso dalle ruote motrici.
const TUNING_V40 = {
  exhaust: {
    label: 'Scarico',
    items: [
      { id: 'oem', price: 0, km: 0, brand: 'Volvo', name: 'Originale', note: 'Silenziatore centrale e terminale chiusi: voce sorda e educata.', sim: { pw: 1 }, dsp: 'stock' },
      { id: 'catback', price: 700, km: 8, brand: 'Simons', name: 'Catback in inox da 63 mm', note: 'Terminale ovale grande: voce piena e ruvida, rimbombo verso i 3000. Sull\'aspirato vale un +3 %.', sim: { pw: 1.03 }, dsp: 'sport', look: { tip: 1 } },
      { id: 'turboback', price: 1300, km: 30, brand: 'Ferrita', name: 'Turboback 76 mm senza silenziatore centrale', note: 'Tutto lo scarico dal turbo in giù: col turbo +6 % e spool più pronto, da aspirata solo rumore (+3 %).', sim: { pw: 1.03, pwTurbo: 1.06, spool: 0.92 }, dsp: 'race', look: { tip: 2 } },
    ],
  },
  intake: {
    label: 'Aspirazione',
    items: [
      { id: 'oem', price: 0, km: 0, brand: 'Volvo', name: 'Airbox originale', note: 'Chiusa e silenziosa.', sim: { pw: 1 }, dsp: { in: 1, roar: 1, wh: 1 } },
      { id: 'pf', price: 250, km: 4, brand: 'K&N', name: 'Filtro a fungo', note: 'Risucchio forte ai bassi, col turbo il fischio si sente il doppio. +2 % (aria più calda nel vano: niente miracoli).', sim: { pw: 1.02 }, dsp: { in: 2.2, roar: 2.4, wh: 1.7 } },
    ],
  },
  ecu: {
    label: 'Centralina',
    items: [
      { id: 'oem', price: 0, km: 0, brand: 'Bosch', name: 'Motronic originale', note: 'Limitatore a 6500, taglio d\'iniezione morbido. Col turbo grosso non regge più di 1 bar.', sim: { lim: 6500, pw: 1, spark: false, maxBoost: 1.0 } },
      { id: 'remap', price: 450, km: 6, brand: 'Su misura', name: 'Rimappatura', note: 'Anticipo e benzina rivisti, limitatore a 6900: +4 % e allungo. Col turbo regge 1,2 bar.', sim: { lim: 6900, pw: 1.04, spark: false, maxBoost: 1.2 } },
      { id: 'standalone', price: 1800, km: 30, brand: 'Link', name: 'G4X stand-alone', note: 'Taglio d\'accensione a 7200, launch control, mappa pop & bang: col turbo scoppi e fiammate.', sim: { lim: 7200, pw: 1.05, spark: true, maxBoost: 1.5 } },
    ],
  },
  turbo: {
    label: 'Turbo',
    items: [
      { id: 'none', price: 0, km: 0, brand: '—', name: 'Aspirato', note: '140 CV a 6000 giri, coppia piatta ma modesta.', sim: { turbo: null } },
      { id: 'td04', price: 3800, km: 28, brand: 'Mitsubishi', name: 'Kit TD04HL della V40 T4 (0,7 bar)', note: 'Collettore, turbo, iniettori da 400 cc e pistoni bassi della T4: circa 210 CV, spinta da 2500. Fischio e valvola a ricircolo.', sim: { turbo: { max: 0.7, a: 2000, b: 3000, up: 0.3, down: 0.75, twin: false } }, dsp: { tb: { f0: 2600, f1: 8800, w: 0.04, wh: 0.06, damp: 2000, twin: 0, mani: 1 } }, look: { badge: 'T4' } },
      { id: 'td04_19t', price: 5500, km: 45, brand: 'Mitsubishi', name: 'TD04HL-19T (fino a 1,5 bar)', note: 'La turbina più grande della famiglia: arriva a 3000, poi spinge forte fino al limitatore. Serve una centralina per sfruttarlo e un intercooler serio.', sim: { turbo: { max: 1.5, a: 2800, b: 4000, up: 0.42, down: 0.85, twin: false } }, dsp: { tb: { f0: 2100, f1: 7600, w: 0.05, wh: 0.08, damp: 2200, twin: 0, mani: 1 } }, look: { badge: 'T5' } },
    ],
  },
  intercooler: {
    label: 'Intercooler',
    items: [
      { id: 'oem', price: 0, km: 0, brand: 'Volvo', name: 'Laterale piccolo (col kit turbo)', note: 'Quello della T4 dietro il paraurti: in un allungo l\'aria scalda e si perde fino al 10 %.', sim: { ic: { heat: 1.5 } } },
      { id: 'fmic', price: 900, km: 32, brand: 'Forge', name: 'Frontale maggiorato', note: 'Si vede dietro la griglia del paraurti: aria fresca anche a 1,5 bar, potenza costante tirando le marce.', sim: { ic: { heat: 0.4, lag: 1.05 } }, look: { fmic: 1 } },
    ],
  },
  tires: {
    label: 'Gomme anteriori',
    items: [
      { id: 'oem', price: 0, km: 0, brand: 'Michelin', name: 'Energy 195/55 R15', note: 'Da turismo: lavorano bene da fredde, ma oltre il 15 % di slittamento la presa cala e il muso allarga.', sim: { mu: 1.0, tyre: { B: 17, C: 1.4, E: 0.05, opt: 70, win: 75, crr: 0.011, brake: 0.95 } } },
      { id: 'sport', price: 650, km: 2, brand: 'Toyo', name: 'Proxes T1-R 205/45 R16', note: 'Sportive su cerchio da 16: +5 % di presa, sterzo più pronto, si scaldano a 85 °C.', sim: { mu: 1.05, tyre: { B: 20, C: 1.45, E: 0.2, opt: 85, win: 60, crr: 0.012 } } },
      { id: 'semislick', price: 1100, km: 25, brand: 'Toyo', name: 'Proxes R888R 205/45 R16', note: 'Semi-slick: +20 % di presa calde, scivolose da fredde. Con la trazione anteriore fanno la differenza in partenza.', sim: { mu: 1.2, tyre: { B: 22, C: 1.5, E: 0.4, opt: 95, win: 45, crr: 0.013 } } },
    ],
  },
  suspension: {
    label: 'Assetto',
    items: [
      { id: 'oem', price: 0, km: 0, brand: 'Volvo', name: 'Originale', note: 'Morbido da familiare: in partenza il muso si alza e scarica le ruote motrici.', sim: { susp: { pitch: 1.1, grip: 1, launch: 1 } }, look: { low: 0 } },
      { id: 'springs', price: 600, km: 5, brand: 'Eibach', name: 'Molle sportive −35 mm', note: 'Più bassa e meno rollio: il muso si alza meno in partenza, quindi le ruote davanti restano più cariche.', sim: { susp: { pitch: 0.75, grip: 1.03, launch: 1.03 } }, look: { low: 3 } },
      { id: 'coilover', price: 1500, km: 18, brand: 'Bilstein', name: 'Coilover B14', note: 'Assetto regolabile −45 mm, cassa quasi ferma: la familiare diventa precisa.', sim: { susp: { pitch: 0.5, grip: 1.05, launch: 1.04 } }, look: { low: 4 } },
    ],
  },
  final: {
    label: 'Differenziale e finale',
    items: [
      { id: 'oem', price: 0, km: 0, brand: 'Volvo', name: 'Aperto, finale 4,0', note: 'Con tanta coppia la ruota interna pattina da sola.', sim: { fd: 4.0, diff: 'open' } },
      { id: 'quaife', price: 1800, km: 40, brand: 'Quaife', name: 'Autobloccante ATB e finale 4,45', note: 'Tiene giù la ruota scarica e accorcia tutte le marce: partenze piantate, 10 % in meno di velocità massima.', sim: { fd: 4.45, diff: 'lsd' } },
    ],
  },
  clutch: {
    label: 'Frizione e volano',
    items: [
      { id: 'oem', price: 0, km: 0, brand: 'Sachs', name: 'Originale a doppia massa', note: 'Morbida e silenziosa; con il turbo grosso slitta.', sim: { Ie: 0.16, clutch: 420 }, dsp: { rattle: 0 } },
      { id: 'sport', price: 900, km: 20, brand: 'Sachs', name: 'Rinforzata con volano alleggerito', note: 'Giri che salgono di scatto e tintinnio in folle: regge 450 Nm.', sim: { Ie: 0.12, clutch: 620 }, dsp: { rattle: 1 } },
    ],
  },
  weight: {
    label: 'Alleggerimento',
    items: [
      { id: 'oem', price: 0, km: 0, brand: '—', name: 'Di serie', note: '1290 kg.', sim: { dm: 0, cabin: 1 } },
      { id: 's1', price: 400, km: 10, brand: '—', name: 'Via sedili posteriori, ruota di scorta e moquette', note: '−55 kg, quasi tutti dal posteriore: buono per la trazione anteriore.', sim: { dm: -55, cabin: 1.15, rearOff: 0.8 } },
      { id: 's2', price: 2200, km: 35, brand: 'Su misura', name: 'Cofano in fibra, sedili racing, batteria al litio', note: '−105 kg: rimbomba tutto, ma 1185 kg con 260 CV fanno paura.', sim: { dm: -105, cabin: 1.3, rearOff: 0.55 } },
    ],
  },
};
const V40_PRESETS = [
  { id: 'stock', name: 'Di serie', sel: { exhaust: 'oem', intake: 'oem', ecu: 'oem', turbo: 'none', intercooler: 'oem', tires: 'oem', suspension: 'oem', final: 'oem', clutch: 'oem', weight: 'oem' } },
  { id: 'street', name: 'Street aspirata', sel: { exhaust: 'catback', intake: 'pf', ecu: 'remap', turbo: 'none', intercooler: 'oem', tires: 'sport', suspension: 'springs', final: 'oem', clutch: 'oem', weight: 'oem' } },
  { id: 'sleeper', name: 'Sleeper T4', sel: { exhaust: 'oem', intake: 'oem', ecu: 'remap', turbo: 'td04', intercooler: 'oem', tires: 'sport', suspension: 'oem', final: 'quaife', clutch: 'sport', weight: 'oem' } },
  { id: 'full', name: 'Familiare cattiva', sel: { exhaust: 'turboback', intake: 'pf', ecu: 'standalone', turbo: 'td04_19t', intercooler: 'fmic', tires: 'semislick', suspension: 'coilover', final: 'quaife', clutch: 'sport', weight: 's2' } },
];
const V40_EX = {
  stock: { L: 3.6, r: -0.4, m: [['lp', 900, 0.6], ['lp', 1600, 0.5], ['peak', 130, 1.0, 3], ['peak', 480, 2, -4]], g: 1.5, jet: 0.1, rasp: 0.05, tips: 1 },
  sport: { L: 3.4, r: -0.6, m: [['lp', 2600, 0.6], ['peak', 170, 1.0, 4], ['peak', 1100, 1.4, 5], ['peak', 3200, 2, 1]], g: 2.2, jet: 0.6, rasp: 0.5, tips: 1 },
  race: { L: 3.1, r: -0.66, m: [['lp', 4600, 0.55], ['peak', 190, 0.9, 3], ['peak', 1500, 1.4, 6], ['peak', 3600, 2, 2]], g: 2.5, jet: 0.9, rasp: 0.75, tips: 1 },
};
function v40Params(sel) {
  const g = (k) => tuningItemOf(TUNING_V40, k, (sel || {})[k]);
  const ex = g('exhaust'), ecu = g('ecu'), tb = g('turbo'), ic = g('intercooler'), ty = g('tires'), su = g('suspension'), fin = g('final'), cl = g('clutch'), wt = g('weight');
  const turbo = tb.sim.turbo ? Object.assign({}, tb.sim.turbo, { max: Math.min(tb.sim.turbo.max, ecu.sim.maxBoost) }) : { max: 0, a: 9000, b: 9900, up: 1, down: 1, twin: false };
  if (tb.sim.turbo && ex.sim.spool) { turbo.up *= ex.sim.spool; turbo.a *= 0.97; }
  const hasT = !!tb.sim.turbo;
  const pw = (hasT ? (ex.sim.pwTurbo || ex.sim.pw) : ex.sim.pw) * g('intake').sim.pw * ecu.sim.pw;
  const pops = ecu.sim.spark && hasT;
  return {
    sim: {
      turbo, pw, limiter: ecu.sim.lim, sparkCut: ecu.sim.spark, ecuLaunch: ecu.sim.spark, ecuPops: pops,
      idle: 800, camLow: 1, camHigh: 1, lope: 0, Ie: cl.sim.Ie, clutchMax: cl.sim.clutch,
      mu: ty.sim.mu * su.sim.susp.grip, tyre: ty.sim.tyre, susp: su.sim.susp, ic: hasT ? ic.sim.ic : null,
      diff: fin.sim.diff, fd: fin.sim.fd, gears: null, dm: wt.sim.dm, rearOff: wt.sim.rearOff || 1,
      valve: hasT ? 'bov' : 'recirc', boostK: 0.42,     // 1.9-2.0 litri: la stessa pressione rende meno che sul 3.0 della Supra
    },
    dsp: {
      cyl: 4, ex: V40_EX[ex.dsp], cat: { lp: ex.dsp === 'stock' ? 2400 : 3800, g: 0.9, pop: pops ? 1.4 : hasT ? 0.7 : 0.25 },
      tb: hasT ? tb.dsp.tb : { f0: 2500, f1: 8000, w: 0, wh: 0, damp: 1700, twin: 0, mani: 1 },
      bov: hasT ? { v: 1, f0: 2200, sw: 900, q: 0.8, g: 0.7, chirp: 0.3 } : { v: 0, f0: 1800, sw: 600, q: 0.7, g: 0.05, chirp: 0 },
      intake: g('intake').dsp, scream: 0, lope: 0, rattle: cl.dsp.rattle, spark: ecu.sim.spark ? 1 : 0, cabin: wt.sim.cabin,
    },
    look: {
      low: (su.look || {}).low || 0, susp: su.sim.susp.pitch, exhaust: (ex.look || {}).tip || 0,
      turbo: hasT, turbo2: tb.id === 'td04_19t', badge: (tb.look || {}).badge || '', fmic: hasT && !!(ic.look || {}).fmic,
    },
  };
}

const CARS = {
  supra: {
    id: 'supra', name: 'Toyota Supra RZ', short: 'Supra', tag: 'Toyota Supra RZ · JZA80 · sei in linea biturbo · Getrag V160',
    engine: '2JZ-GTE 3.0 biturbo', mass: 1570, driveW: 0.47, fwd: false,
    tuning: null, presets: null, params: null,                  // assegnati sotto (tuning.js è caricato prima)
    body: {},
  },
  v40: {
    id: 'v40', name: 'Volvo V40 SW 2.0', short: 'V40', tag: 'Volvo V40 SW · 2.0 16V B4204S · quattro in linea · cambio M56 a 5 marce',
    engine: 'B4204S 2.0 16V aspirato', mass: 1290, driveW: 0.61, fwd: true,
    // fisica: 2.0 aspirato da 140 CV a 6000 giri e ~185 Nm a 4500, trazione anteriore, 5 marce
    P: {
      idle: 800, limiter: 6500, launchRpm: 3800, Ie: 0.16, mass: 1290, r: 0.308, cd: 0.33, A: 2.08, mu: 1.0, cgH: 0.52, wb: 2.56,
      tank: 60, gears: [0, 3.385, 1.905, 1.233, 0.906, 0.730], rev: -3.15, fd: 4.0, clutchMax: 420,
      // coppia indicata (le perdite interne del modello si sottraggono): netti 140 CV a 6000 e ~185 Nm a 4500
      tq: [[0, 130], [500, 150], [1000, 185], [1500, 205], [2000, 216], [2500, 224], [3000, 229], [3500, 233],
        [4000, 236], [4500, 238], [5000, 238], [5500, 236], [6000, 233], [6500, 220], [7000, 200], [7500, 180]],
    },
    tuning: TUNING_V40, presets: V40_PRESETS, params: v40Params,
    // estetica propria (al Neon Kustom, oltre a vernice, neon, pinze, vetri e sticker comuni)
    body: {
      wheels: { label: 'Cerchi', items: [
        { id: 'none', name: 'Copricerchi di serie', price: 0 },
        { id: 'a5', name: 'Lega 5 razze 16"', price: 550 },
        { id: 'mesh', name: 'Lega a raggi 17"', price: 900 } ] },
      kit: { label: 'Kit carrozzeria', items: [
        { id: 'none', name: 'Di serie', price: 0 },
        { id: 'kit', name: 'Labbro, minigonne e diffusore', price: 1200 } ] },
      spoiler: { label: 'Spoiler', items: [
        { id: 'none', name: 'Nessuno', price: 0 },
        { id: 'roof', name: 'Sopra il portellone', price: 350 } ] },
    },
    // vecchia scala di potenziamenti (salvataggi precedenti): livello → pezzi ed estetica
    legacyUps: ['lavaggio', 'cerchi', 'assetto', 'scarico', 'aspira', 'kit', 'spoiler', 'turbo', 'turbo2', 'lsd'],
  },
};
CARS.supra.tuning = TUNING_SUPRA; CARS.supra.presets = SUPRA_PRESETS; CARS.supra.params = supraParams;
const CAR_IDS = Object.keys(CARS);

// rende attivo il catalogo dell'auto: TUNING e TUNING_PRESETS (usati dall'officina) puntano a quelli dell'auto
function setActiveCar(id) {
  ACTIVE_CAR = CARS[id] ? id : 'supra';
  TUNING = CARS[ACTIVE_CAR].tuning; TUNING_PRESETS = CARS[ACTIVE_CAR].presets;   // eslint-disable-line no-global-assign
}
// selezione e estetica ricavate dalla vecchia scala della V40
function v40FromLegacy(level) {
  const has = (id) => CARS.v40.legacyUps.indexOf(id) > -1 && CARS.v40.legacyUps.indexOf(id) < level;
  const sel = Object.assign({}, V40_PRESETS[0].sel);
  if (has('cerchi')) sel.tires = 'sport';
  if (has('assetto')) sel.suspension = 'springs';
  if (has('scarico')) sel.exhaust = 'catback';
  if (has('aspira')) { sel.intake = 'pf'; sel.ecu = 'remap'; }
  if (has('turbo')) sel.turbo = 'td04';
  if (has('turbo2')) { sel.turbo = 'td04_19t'; sel.ecu = 'standalone'; }
  if (has('lsd')) sel.final = 'quaife';
  const cos = { wheels: has('cerchi') ? 'a5' : 'none', kit: has('kit') ? 'kit' : 'none', spoiler: has('spoiler') ? 'roof' : 'none' };
  return { sel, cos, clean: has('lavaggio') };
}
if (typeof window !== 'undefined') Object.assign(window, { CARS, CAR_IDS, v40Params, setActiveCar, v40FromLegacy });
