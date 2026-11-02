// ============================================================================
//  Reparto tuning · catalogo delle parti e loro effetto su fisica e suono
//  I marchi identificano parti reali per la JZA80/2JZ; il carattere sonoro è
//  una nostra modellazione fisica, non una registrazione del prodotto.
// ============================================================================
const TUNING = {
  exhaust: {
    label: 'Scarico (catback)',
    items: [
      { id: 'oem', price: 0, pw: 1, brand: 'Toyota', name: 'Originale', note: 'Silenziatore a camere: cupo, trattenuto, il fischio del turbo resta in primo piano.',
        dsp: { L: 4.4, r: -0.42, m: [['lp', 360, 0.6], ['lp', 1000, 0.5], ['peak', 105, 1.0, 6], ['peak', 420, 2, -5]], g: 1.7, jet: 0.12, rasp: 0, tips: 1 } },
      { id: 'hks', price: 1300, pw: 1.03, brand: 'HKS', name: 'Hi-Power', note: 'Terminale singolo grande: basso pieno e profondo, rimbombo a 2000–3000 giri.',
        dsp: { L: 4.0, r: -0.55, m: [['lp', 1150, 0.6], ['peak', 118, 1.0, 6], ['peak', 520, 1.2, 3], ['peak', 2400, 1.5, -5]], g: 2.2, jet: 0.4, rasp: 0.2, tips: 1 } },
      { id: 'apexi', price: 1100, pw: 1.035, brand: 'Apexi', name: 'N1 Evolution', note: 'Il classico JDM: ruvido e aggressivo, medi in evidenza, doppia uscita.',
        dsp: { L: 4.0, r: -0.6, m: [['lp', 2200, 0.6], ['peak', 160, 1.0, 3], ['peak', 900, 1.3, 5], ['peak', 3000, 2, -2]], g: 2.1, jet: 0.6, rasp: 0.45, tips: 2 } },
      { id: 'tomei', price: 2400, pw: 1.04, brand: 'Tomei', name: 'Expreme Ti', note: 'Titanio a pareti sottili: timbro metallico e acuto, urlo in alto.',
        dsp: { L: 3.9, r: -0.62, m: [['lp', 3200, 0.6], ['peak', 140, 1.0, 2], ['peak', 1400, 1.6, 6], ['peak', 3800, 2.5, 3]], g: 1.9, jet: 0.8, rasp: 0.6, tips: 1 } },
      { id: 'blitz', price: 1500, pw: 1.03, brand: 'Blitz', name: 'Nür-Spec', note: 'Sportivo ma educato: tono profondo, poco rimbombo in crociera.',
        dsp: { L: 4.1, r: -0.5, m: [['lp', 1400, 0.6], ['peak', 110, 1.0, 5], ['peak', 700, 1.3, 2], ['peak', 2500, 1.5, -4]], g: 2.0, jet: 0.3, rasp: 0.15, tips: 2 } },
      { id: 'straight', price: 350, pw: 1.05, brand: 'Su misura', name: 'Straight pipe 3,5"', note: 'Tubo dritto senza silenziatori: tutto il motore, crudo e fortissimo.',
        dsp: { L: 3.5, r: -0.68, m: [['lp', 5200, 0.55], ['peak', 140, 0.9, 3], ['peak', 1850, 1.4, 5], ['peak', 3600, 2, 2]], g: 2.4, jet: 1.0, rasp: 0.8, tips: 1 } },
    ],
  },
  cat: {
    label: 'Downpipe e catalizzatore',
    items: [
      { id: 'oem', price: 0, pw: 1, brand: 'Toyota', name: 'Catalizzatore originale', note: 'Ceramico ad alta densità: smussa le alte frequenze.', dsp: { lp: 2600, g: 0.85, pop: 1 } },
      { id: 'sport', price: 650, pw: 1.02, brand: 'Su misura', name: 'Downpipe 3,5" con cat 200 celle', note: 'Metallico ad alto flusso: più presenza, scoppiettii più vivi.', dsp: { lp: 5200, g: 1.0, pop: 1.25 } },
      { id: 'decat', price: 250, pw: 1.03, brand: 'Su misura', name: 'Decat (solo pista)', note: 'Nessun filtro: suono aperto, afterfire forti.', dsp: { lp: 0, g: 1.15, pop: 1.7 } },
    ],
  },
  turbo: {
    label: 'Turbocompressore',
    items: [
      { id: 'ct12b', price: 0, brand: 'Toyota', name: 'CT12B biturbo sequenziale', note: 'Due turbine piccole: spinta da 1800 giri, il secondo entra a 4000 con cambio di fischio. Con centralina aftermarket 1 bar.',
        sim: { max: 0.75, a: 1500, b: 3000, up: 0.26, down: 0.75, twin: true }, dsp: { f0: 2500, f1: 8700, w: 0.035, wh: 0.05, damp: 1700, twin: 1, mani: 0 } },
      { id: 'gtx3582', price: 4500, brand: 'Garrett', name: 'GTX3582R', note: 'Single a cuscinetti, risposta pronta: fischio pulito e acuto.',
        sim: { max: 1.6, a: 2900, b: 4300, up: 0.45, down: 0.9 }, dsp: { f0: 1800, f1: 6900, w: 0.055, wh: 0.08, damp: 2300, twin: 0, mani: 1 } },
      { id: 'pte6466', price: 3800, brand: 'Precision', name: '6466 Gen2', note: 'Il single da strada più diffuso sul 2JZ: spool rumoroso, sibilo pieno.',
        sim: { max: 1.95, a: 3200, b: 4600, up: 0.5, down: 0.95 }, dsp: { f0: 1500, f1: 6100, w: 0.07, wh: 0.09, damp: 2400, twin: 0, mani: 1 } },
      { id: 'efr9180', price: 5200, brand: 'BorgWarner', name: 'EFR 9180', note: 'Girante in titanio-alluminio, spool rapido per la taglia: fischio più discreto.',
        sim: { max: 1.9, a: 3100, b: 4500, up: 0.4, down: 0.9 }, dsp: { f0: 1900, f1: 7200, w: 0.045, wh: 0.07, damp: 2400, twin: 0, mani: 1 } },
      { id: 't51r', price: 6000, brand: 'HKS', name: 'T51R SPL', note: 'Il mostro anni 90 delle drag: tanto ritardo, poi un ululato enorme oltre 5000.',
        sim: { max: 2.1, a: 4000, b: 5600, up: 0.85, down: 1.1 }, dsp: { f0: 1300, f1: 5300, w: 0.095, wh: 0.11, damp: 2600, twin: 0, mani: 1 } },
    ],
  },
  bov: {
    label: 'Valvola pop-off',
    items: [
      { id: 'oem', price: 0, brand: 'Toyota', name: 'Ricircolo originale', note: 'Rimanda l’aria in aspirazione: solo un soffio leggero.', dsp: { v: 0, f0: 1800, sw: 600, q: 0.7, g: 0.12, chirp: 0 } },
      { id: 'ssqv', price: 380, brand: 'HKS', name: 'SSQV', note: 'Sfiato in atmosfera con il celebre sibilo acuto a “trombetta”.', dsp: { v: 1, f0: 2700, sw: 1100, q: 1.1, g: 0.85, chirp: 1 } },
      { id: 'raceport', price: 450, brand: 'Turbosmart', name: 'Race Port', note: 'Grande portata: soffio forte e pieno, molto aria.', dsp: { v: 1, f0: 2000, sw: 900, q: 0.7, g: 0.9, chirp: 0.2 } },
      { id: 'greddy', price: 300, brand: 'GReddy', name: 'Type-RS', note: 'Regolabile, tono più basso e rotondo.', dsp: { v: 1, f0: 1600, sw: 700, q: 0.75, g: 0.7, chirp: 0 } },
      { id: 'none', price: 0, brand: '—', name: 'Nessuna (flutter)', note: 'Il compressore va in pompaggio: il famoso “stu-tu-tu”.', dsp: { v: 2, f0: 1500, sw: 1000, q: 0.75, g: 0.75, chirp: 0 } },
    ],
  },
  wastegate: {
    label: 'Wastegate',
    items: [
      { id: 'int', price: 0, brand: 'Integrata', name: 'Interna / ricircolata', note: 'L’eccesso di gas torna nello scarico: nessun rumore in più.', dsp: { scream: 0 } },
      { id: 'tial', price: 900, brand: 'TiAL', name: 'MV-R 44 mm con screamer pipe', note: 'Scarico libero della wastegate: urlo e crepitio a pieno boost (solo single turbo).', dsp: { scream: 1 } },
    ],
  },
  intake: {
    label: 'Aspirazione',
    items: [
      { id: 'oem', price: 0, pw: 1, brand: 'Toyota', name: 'Airbox originale', note: 'Chiuso e silenziato.', dsp: { in: 1, roar: 1, wh: 1 } },
      { id: 'pf', price: 280, pw: 1.02, brand: 'HKS', name: 'Super Power Flow', note: 'Filtro a fungo aperto: risucchio forte, soffio e fischio del turbo amplificati.', dsp: { in: 2.4, roar: 2.6, wh: 1.7 } },
    ],
  },
  cams: {
    label: 'Alberi a camme',
    items: [
      { id: 'oem', price: 0, brand: 'Toyota', name: 'Originali', note: 'Minimo liscio come una turbina.', sim: { idle: 750, low: 1, high: 1, lope: 0 }, dsp: { lope: 0 } },
      { id: 'hks264', price: 1100, brand: 'HKS', name: '264° step pro', note: 'Un filo di irregolarità al minimo, più allungo.', sim: { idle: 800, low: 0.97, high: 1.04, lope: 0.35 }, dsp: { lope: 0.35 } },
      { id: 'hks272', price: 1200, brand: 'HKS', name: '272° step pro', note: 'Incrocio lungo: minimo “zoppo” e ballerino, coppia spostata in alto.', sim: { idle: 950, low: 0.9, high: 1.09, lope: 1 }, dsp: { lope: 1 } },
    ],
  },
  ecu: {
    label: 'Centralina',
    items: [
      { id: 'oem', price: 0, brand: 'Toyota', name: 'Originale', note: 'Limitatore a 7000 a taglio d’iniezione: niente scoppi, niente launch.', sim: { lim: 7000, spark: false, launch: false, pops: false } },
      { id: 'haltech', price: 2600, brand: 'Haltech', name: 'Elite 2500', note: 'Taglio d’accensione a 7600, launch control, mappa pop & bang.', sim: { lim: 7600, spark: true, launch: true, pops: true } },
      { id: 'link', price: 2100, brand: 'Link', name: 'G4X', note: 'Taglio d’accensione a 7500, launch control, mappa pop & bang.', sim: { lim: 7500, spark: true, launch: true, pops: true } },
    ],
  },
  tires: {
    label: 'Gomme posteriori',
    items: [
      { id: 'oem', price: 0, brand: 'Bridgestone', name: 'Potenza originali 265/40 R17', note: 'Stradali: con molta coppia pattinano in prima e in seconda.', sim: { mu: 1.1 }, dsp: {} },
      { id: 'r888r', price: 1100, brand: 'Toyo', name: 'Proxes R888R', note: 'Semi-slick: più presa in partenza, stridio più acuto quando slittano.', sim: { mu: 1.3 }, dsp: {} },
      { id: 'etstreet', price: 1500, brand: 'Mickey Thompson', name: 'ET Street R', note: 'Radiali da drag: partenze piantate anche con 700 CV.', sim: { mu: 1.55 }, dsp: {} },
    ],
  },
  clutch: {
    label: 'Frizione e volano',
    items: [
      { id: 'oem', price: 0, brand: 'Toyota', name: 'Monodisco originale', note: 'Volano pesante: salite di giri morbide.', sim: { Ie: 0.21 }, dsp: { rattle: 0 } },
      { id: 'osgiken', price: 1800, brand: 'OS Giken', name: 'Bidisco con volano alleggerito', note: 'Giri che salgono e scendono di scatto, tipico tintinnio in folle al minimo.', sim: { Ie: 0.16 }, dsp: { rattle: 1 } },
    ],
  },
};

const TUNING_PRESETS = [
  { id: 'stock', name: 'Originale', sel: { exhaust: 'oem', cat: 'oem', turbo: 'ct12b', bov: 'oem', wastegate: 'int', intake: 'oem', cams: 'oem', ecu: 'oem', clutch: 'oem', tires: 'oem' } },
  { id: 'street', name: 'Street biturbo', sel: { exhaust: 'hks', cat: 'sport', turbo: 'ct12b', bov: 'ssqv', wastegate: 'int', intake: 'pf', cams: 'oem', ecu: 'link', clutch: 'oem', tires: 'r888r' } },
  { id: 'single', name: 'Big single', sel: { exhaust: 'tomei', cat: 'sport', turbo: 'pte6466', bov: 'raceport', wastegate: 'tial', intake: 'pf', cams: 'hks264', ecu: 'haltech', clutch: 'osgiken', tires: 'etstreet' } },
  { id: 'drag', name: 'Drag anni 90', sel: { exhaust: 'straight', cat: 'decat', turbo: 't51r', bov: 'none', wastegate: 'tial', intake: 'pf', cams: 'hks272', ecu: 'haltech', clutch: 'osgiken', tires: 'etstreet' } },
];

function tuningItem(cat, id) {
  const c = TUNING[cat];
  return c.items.find((i) => i.id === id) || c.items[0];
}

// trasforma la selezione in parametri per la fisica e per il DSP
function tuningParams(sel) {
  const g = (k) => tuningItem(k, sel[k]);
  const tb = g('turbo'), ecu = g('ecu'), cams = g('cams'), cl = g('clutch');
  // con una centralina programmabile i turbo di serie reggono circa 1 bar
  const turbo = tb.sim.twin && ecu.id !== 'oem' ? Object.assign({}, tb.sim, { max: 1.0 }) : tb.sim;
  const pw = g('exhaust').pw * g('cat').pw * g('intake').pw;
  return {
    sim: {
      turbo, pw, limiter: ecu.sim.lim, sparkCut: ecu.sim.spark, ecuLaunch: ecu.sim.launch, ecuPops: ecu.sim.pops,
      idle: cams.sim.idle, camLow: cams.sim.low, camHigh: cams.sim.high, lope: cams.sim.lope, Ie: cl.sim.Ie,
      mu: g('tires').sim.mu,
      valve: g('bov').dsp.v === 2 ? 'flutter' : g('bov').dsp.v === 1 ? 'bov' : 'recirc',
    },
    dsp: {
      ex: g('exhaust').dsp, cat: g('cat').dsp, tb: tb.dsp, bov: g('bov').dsp,
      scream: tb.sim.twin ? 0 : g('wastegate').dsp.scream, intake: g('intake').dsp, lope: cams.dsp.lope,
      rattle: cl.dsp.rattle, spark: ecu.sim.spark ? 1 : 0,
    },
  };
}
