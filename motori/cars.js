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


// ---------------------------------------------------------------- auto con disegno del giocatore: costruttore comune
// Ogni auto descrive motore, cambio e i nomi dei suoi pezzi; catalogo, parametri e suono si costruiscono da qui.
const GEN_DATA = {"r5":{"tq":[[0,60],[500,80],[1000,100],[1500,118],[2000,147],[2500,189],[3000,163],[3500,152],[4000,153],[4500,152],[5000,152],[5500,151],[6000,151],[6500,146],[7000,138],[7500,131]],"sprite":{"w":169,"h":62,"wy":34.1,"wr":13.9,"ax":[30.8,137.7],"head":[159,33],"tail":[5,24,5,5],"ex":[3,51],"hx":78,"hy":-1,"refL":139.2,"slots":{"st_door":[92,35,25,11],"st_rear":[30,26,19,9],"st_glass":[46,13,19,6]},"ws":15}},"b2002":{"tq":[[0,77],[500,103],[1000,130],[1500,148],[2000,167],[2500,180],[3000,200],[3500,203],[4000,199],[4500,199],[5000,199],[5500,194],[6000,187],[6500,178],[7000,168],[7500,159]],"sprite":{"w":186,"h":62,"wy":33.7,"wr":14.0,"ax":[37.9,147.9],"head":[176,29],"tail":[2,30,5,5],"ex":[3,51],"hx":95,"hy":-3,"refL":188.0,"slots":{"st_door":[102,35,27,11],"st_rear":[37,25,19,9],"st_glass":[60,11,19,6]},"ws":16}},"e30":{"tq":[[0,98],[500,134],[1000,170],[1500,193],[2000,212],[2500,226],[3000,240],[3500,253],[4000,266],[4500,277],[5000,284],[5500,287],[6000,285],[6500,284],[7000,279],[7500,265]],"sprite":{"w":192,"h":65,"wy":37.3,"wr":13.9,"ax":[41.9,154.7],"head":[177,38],"tail":[3,31,5,5],"ex":[3,55],"hx":91,"hy":-2,"refL":198.8,"slots":{"st_door":[105,38,28,11],"st_rear":[41,29,19,9],"st_glass":[59,12,19,6]},"ws":15}},"e36":{"tq":[[0,137],[500,188],[1000,240],[1500,273],[2000,299],[2500,320],[3000,340],[3500,357],[4000,364],[4500,368],[5000,370],[5500,372],[6000,373],[6500,375],[7000,372],[7500,351]],"sprite":{"w":196,"h":58,"wy":29.1,"wr":14.1,"ax":[39.3,158.6],"head":[182,33],"tail":[12,20,5,5],"ex":[3,47],"hx":91,"hy":-5,"refL":48.3,"slots":{"st_door":[107,30,29,11],"st_rear":[39,21,19,9],"st_glass":[60,9,19,6]},"ws":16}},"e34":{"tq":[[0,154],[500,212],[1000,270],[1500,303],[2000,327],[2500,345],[3000,365],[3500,379],[4000,394],[4500,407],[5000,414],[5500,416],[6000,413],[6500,411],[7000,399],[7500,375]],"sprite":{"w":203,"h":60,"wy":32.7,"wr":13.7,"ax":[43.2,164.7],"head":[192,34],"tail":[3,25,5,5],"ex":[3,50],"hx":111,"hy":-7,"refL":29.2,"slots":{"st_door":[111,34,30,10],"st_rear":[43,25,19,9],"st_glass":[58,7,19,6]},"ws":15}}};
const GEN_EX = {
  old4: { L: 3.8, r: -0.45, m: [['lp', 1300, 0.6], ['peak', 120, 1.0, 4], ['peak', 600, 1.4, 2], ['peak', 2200, 2, -4]], g: 1.7, jet: 0.2, rasp: 0.2, tips: 1 },
  rally4: { L: 3.2, r: -0.55, m: [['lp', 2400, 0.6], ['peak', 150, 1.0, 3], ['peak', 1300, 1.4, 4], ['peak', 3200, 2, 1]], g: 2.0, jet: 0.5, rasp: 0.5, tips: 1 },
  bmw4: { L: 3.6, r: -0.5, m: [['lp', 2600, 0.6], ['peak', 140, 1.0, 3], ['peak', 1200, 1.4, 4], ['peak', 3000, 2, 0]], g: 1.9, jet: 0.45, rasp: 0.4, tips: 1 },
  bmw6: { L: 4.2, r: -0.5, m: [['lp', 2200, 0.6], ['peak', 150, 1.0, 3], ['peak', 900, 1.3, 3], ['peak', 2600, 2, -2]], g: 1.9, jet: 0.35, rasp: 0.25, tips: 2 },
  sport4: { L: 3.4, r: -0.6, m: [['lp', 3000, 0.6], ['peak', 160, 1.0, 4], ['peak', 1300, 1.4, 5], ['peak', 3400, 2, 2]], g: 2.2, jet: 0.7, rasp: 0.6, tips: 1 },
  sport6: { L: 4.0, r: -0.6, m: [['lp', 3200, 0.6], ['peak', 140, 1.0, 4], ['peak', 1400, 1.5, 6], ['peak', 3800, 2.5, 3]], g: 2.1, jet: 0.7, rasp: 0.55, tips: 2 },
  race: { L: 3.1, r: -0.66, m: [['lp', 4800, 0.55], ['peak', 180, 0.9, 3], ['peak', 1600, 1.4, 6], ['peak', 3800, 2, 2]], g: 2.5, jet: 1.0, rasp: 0.8, tips: 1 },
};
// catalogo con le stesse categorie per ogni auto (nomi, prezzi e chilometri dalla scheda dell'auto)
function genCatalog(c) {
  const n = c.names || {}, $ = (base) => Math.round(base * (c.priceK || 1) / 10) * 10, kk = (base) => Math.round(base * (c.kmK || 1));
  const T = c.turbo;                                // turbo di serie (o null se aspirata)
  const tb = [];
  if (T) tb.push({ id: 'stock', price: 0, km: 0, brand: T.brand, name: T.name, note: T.note, sim: { turbo: T.sim }, dsp: { tb: T.dsp } });
  else tb.push({ id: 'none', price: 0, km: 0, brand: '—', name: 'Aspirato', note: c.naNote || 'Nessuna sovralimentazione.', sim: { turbo: null } });
  for (const u of c.boost) tb.push({ id: u.id, price: $(u.price), km: kk(u.km), brand: u.brand, name: u.name, note: u.note, sim: { turbo: u.sim }, dsp: { tb: u.dsp }, look: u.look || {} });
  const cat = {
    exhaust: { label: 'Scarico', items: [
      { id: 'oem', price: 0, km: 0, brand: c.make, name: 'Originale', note: n.exOem || 'Silenziatori di serie.', sim: { pw: 1 }, dsp: c.exStock },
      { id: 'catback', price: $(800), km: kk(8), brand: n.exBrand || 'Supersprint', name: 'Catback in inox', note: 'Terminali più grandi: voce piena e ruvida. +3 % sull\'aspirato, +5 % col turbo.', sim: { pw: 1.03, pwTurbo: 1.05 }, dsp: c.cyl === 6 ? 'sport6' : 'sport4', look: { tip: 1 } },
      { id: 'race', price: $(1500), km: kk(25), brand: 'Su misura', name: 'Scarico diretto da gara', note: 'Collettore tubolare e niente silenziatori: +5 % (col turbo +8 % e spool più pronto). Fortissimo.', sim: { pw: 1.05, pwTurbo: 1.08, spool: 0.9 }, dsp: 'race', look: { tip: 2 } } ] },
    intake: { label: 'Aspirazione', items: [
      { id: 'oem', price: 0, km: 0, brand: c.make, name: n.inOem || 'Airbox originale', note: 'Chiusa e silenziosa.', sim: { pw: 1 }, dsp: c.inStock || { in: 1, roar: 1, wh: 1 } },
      { id: 'pf', price: $(300), km: kk(4), brand: 'K&N', name: 'Filtro a fungo', note: 'Risucchio forte ai bassi, fischio del turbo più presente. +2 %.', sim: { pw: 1.02 }, dsp: { in: 2.2, roar: 2.4, wh: 1.7 } } ] },
    ecu: { label: 'Centralina', items: [
      { id: 'oem', price: 0, km: 0, brand: c.ecuBrand || 'Bosch', name: 'Originale', note: `Limitatore a ${c.P.limiter}, taglio d'iniezione morbido.`, sim: { lim: c.P.limiter, pw: 1, spark: false, maxBoost: c.ecuMax || 1.0 } },
      { id: 'remap', price: $(500), km: kk(6), brand: 'Su misura', name: 'Rimappatura', note: `Anticipo e benzina rivisti, limitatore a ${c.P.limiter + 300}: +4 %.`, sim: { lim: c.P.limiter + 300, pw: 1.04, spark: false, maxBoost: (c.ecuMax || 1.0) + 0.3 } },
      { id: 'standalone', price: $(2000), km: kk(30), brand: 'MoTeC', name: 'M84 stand-alone', note: `Taglio d'accensione a ${c.P.limiter + 500}, launch control, pop & bang.`, sim: { lim: c.P.limiter + 500, pw: 1.05, spark: true, maxBoost: (c.ecuMax || 1.0) + 0.8 } } ] },
    turbo: { label: T ? 'Turbo' : 'Sovralimentazione', items: tb },
    intercooler: { label: 'Intercooler', items: [
      { id: 'oem', price: 0, km: 0, brand: c.make, name: T ? 'Originale' : 'Del kit', note: 'Piccolo: tirando le marce l\'aria scalda e si perde fino al 10 %.', sim: { ic: { heat: T ? (T.icHeat || 1.2) : 1.4 } } },
      { id: 'fmic', price: $(1000), km: kk(30), brand: 'Wagner', name: 'Frontale maggiorato', note: 'Aria fresca anche ad alta pressione: la potenza non cala più.', sim: { ic: { heat: 0.4, lag: 1.05 } } } ] },
    tires: { label: c.fwd ? 'Gomme anteriori' : 'Gomme posteriori', items: [
      { id: 'oem', price: 0, km: 0, brand: n.tyreBrand || 'Michelin', name: n.tyreOem || 'Originali', note: 'Stradali: presa onesta, lavorano bene da fredde.', sim: { mu: c.mu || 1.05, tyre: { B: 19, C: 1.42, E: 0.1, opt: 80, win: 70, crr: 0.012 } } },
      { id: 'sport', price: $(800), km: kk(3), brand: 'Toyo', name: 'Proxes R1R', note: 'Sportive: +6 % di presa, sterzo più pronto, ideali a 85 °C.', sim: { mu: (c.mu || 1.05) * 1.06, tyre: { B: 20, C: 1.45, E: 0.2, opt: 85, win: 60, crr: 0.012 } } },
      { id: 'semislick', price: $(1200), km: kk(25), brand: 'Toyo', name: 'Proxes R888R', note: 'Semi-slick: +20 % di presa calde, scivolose da fredde.', sim: { mu: (c.mu || 1.05) * 1.2, tyre: { B: 22, C: 1.5, E: 0.4, opt: 95, win: 45, crr: 0.013 } } } ] },
    suspension: { label: 'Assetto', items: [
      { id: 'oem', price: 0, km: 0, brand: c.make, name: 'Originale', note: c.suspNote || 'Comodo: la cassa si muove parecchio.', sim: { susp: { pitch: c.pitch || 1, grip: 1, launch: 1 } }, look: { low: 0 } },
      { id: 'springs', price: $(600), km: kk(5), brand: 'Eibach', name: 'Molle sportive −30 mm', note: 'Più bassa, meno rollio e beccheggio.', sim: { susp: { pitch: (c.pitch || 1) * 0.7, grip: 1.03, launch: c.fwd ? 1.03 : 0.99 } }, look: { low: 2 } },
      { id: 'coilover', price: $(1600), km: kk(18), brand: 'KW', name: 'Coilover V3', note: 'Regolabile −40 mm: cassa quasi ferma, precisa.', sim: { susp: { pitch: (c.pitch || 1) * 0.5, grip: 1.05, launch: 1.02 } }, look: { low: 3 } } ] },
    final: { label: 'Differenziale e finale', items: [
      { id: 'oem', price: 0, km: 0, brand: c.make, name: c.diff0.name, note: c.diff0.note, sim: { fd: c.P.fd, diff: c.diff0.diff } },
      { id: 'lsd', price: $(1600), km: kk(30), brand: 'Drexler', name: `Autobloccante al 40 %, finale ${(c.P.fd * 1.12).toFixed(2).replace('.', ',')}`, note: 'Blocca la ruota che slitta e accorcia le marce: partenze piantate, meno velocità massima.', sim: { fd: Math.round(c.P.fd * 1.12 * 100) / 100, diff: 'lsd' } } ] },
    clutch: { label: 'Frizione e volano', items: [
      { id: 'oem', price: 0, km: 0, brand: 'Sachs', name: 'Originale', note: 'Morbida; con molta coppia slitta.', sim: { Ie: c.P.Ie, clutch: c.P.clutchMax }, dsp: { rattle: 0 } },
      { id: 'sport', price: $(1000), km: kk(15), brand: 'Sachs', name: 'Rinforzata con volano alleggerito', note: 'Giri che salgono di scatto, tintinnio in folle.', sim: { Ie: Math.round(c.P.Ie * 0.75 * 100) / 100, clutch: Math.round(c.P.clutchMax * 1.5) }, dsp: { rattle: 1 } } ] },
    weight: { label: 'Alleggerimento', items: [
      { id: 'oem', price: 0, km: 0, brand: '—', name: 'Di serie', note: `${c.mass} kg.`, sim: { dm: 0, cabin: 1 } },
      { id: 's1', price: $(600), km: kk(10), brand: '—', name: 'Sedili racing, via insonorizzanti', note: `−${Math.round(c.mass * 0.045)} kg.`, sim: { dm: -Math.round(c.mass * 0.045), cabin: 1.15 } },
      { id: 's2', price: $(2600), km: kk(35), brand: 'Su misura', name: 'Cofano e portellone in fibra, vetri in policarbonato', note: `−${Math.round(c.mass * 0.09)} kg: rimbomba tutto.`, sim: { dm: -Math.round(c.mass * 0.09), cabin: 1.35 } } ] },
  };
  if (c.gearbox) cat.gearbox = { label: 'Cambio', items: [{ id: 'oem', price: 0, km: 0, brand: c.gearbox.brand0, name: c.gearbox.name0, note: c.gearbox.note0, sim: { gears: null } }].concat(c.gearbox.items.map((g) => Object.assign({ km: kk(g.km), price: $(g.price) }, g, { sim: { gears: g.gears } }))) };
  return cat;
}
function genPresets(c) {
  const base = { exhaust: 'oem', intake: 'oem', ecu: 'oem', turbo: c.turbo ? 'stock' : 'none', intercooler: 'oem', tires: 'oem', suspension: 'oem', final: 'oem', clutch: 'oem', weight: 'oem' };
  if (c.gearbox) base.gearbox = 'oem';
  const b1 = c.boost[0], b2 = c.boost[c.boost.length - 1];
  return [
    { id: 'stock', name: 'Di serie', sel: base },
    { id: 'street', name: 'Street', sel: Object.assign({}, base, { exhaust: 'catback', intake: 'pf', ecu: 'remap', tires: 'sport', suspension: 'springs' }) },
    { id: 'boost', name: c.turbo ? 'Più pressione' : 'Sovralimentata', sel: Object.assign({}, base, { exhaust: 'catback', ecu: 'remap', turbo: b1.id, intercooler: 'fmic', tires: 'sport', suspension: 'springs', final: 'lsd' }) },
    { id: 'full', name: 'Da gara', sel: Object.assign({}, base, { exhaust: 'race', intake: 'pf', ecu: 'standalone', turbo: b2.id, intercooler: 'fmic', tires: 'semislick', suspension: 'coilover', final: 'lsd', clutch: 'sport', weight: 's2' }, c.gearbox ? { gearbox: c.gearbox.items[0].id } : {}) },
  ];
}
function genParams(c) {
  return (sel) => {
    const g = (k) => tuningItemOf(c.tuning, k, (sel || {})[k]);
    const ex = g('exhaust'), ecu = g('ecu'), tb = g('turbo'), ic = g('intercooler'), ty = g('tires'), su = g('suspension'), fin = g('final'), cl = g('clutch'), wt = g('weight');
    const hasT = !!tb.sim.turbo;
    const turbo = hasT ? Object.assign({}, tb.sim.turbo, { max: Math.min(tb.sim.turbo.max, ecu.sim.maxBoost) }) : { max: 0, a: 9000, b: 9900, up: 1, down: 1, twin: false };
    if (hasT && ex.sim.spool) { turbo.up *= ex.sim.spool; turbo.a *= 0.97; }
    const pw = (hasT ? (ex.sim.pwTurbo || ex.sim.pw) : ex.sim.pw) * g('intake').sim.pw * ecu.sim.pw;
    const pops = ecu.sim.spark && hasT;
    const exd = typeof ex.dsp === 'string' ? GEN_EX[ex.dsp] : ex.dsp;
    const vo = c.voice || {};
    return {
      sim: {
        turbo, pw, limiter: ecu.sim.lim, sparkCut: ecu.sim.spark, ecuLaunch: ecu.sim.spark, ecuPops: pops,
        idle: c.P.idle, camLow: 1, camHigh: 1, lope: (vo.lope || 0) * 0.6, Ie: cl.sim.Ie, clutchMax: cl.sim.clutch,
        mu: ty.sim.mu * su.sim.susp.grip, tyre: ty.sim.tyre, susp: su.sim.susp, ic: hasT ? ic.sim.ic : null,
        diff: fin.sim.diff, fd: fin.sim.fd, gears: c.tuning.gearbox ? g('gearbox').sim.gears : null, dm: wt.sim.dm, rearOff: 0.6,
        valve: hasT ? 'bov' : 'recirc', boostK: c.boostK || (c.turbo ? 0.9 : 0.72),   // kit su aspirate: rapporto di compressione alto, si spinge meno
      },
      dsp: {
        cyl: c.cyl, ex: exd, cat: { lp: ex.id === 'oem' ? 2600 : 4200, g: 0.95, pop: pops ? 1.4 : hasT ? 0.7 : 0.3 },
        tb: hasT ? tb.dsp.tb : { f0: 2500, f1: 8000, w: 0, wh: 0, damp: 1700, twin: 0, mani: 1 },
        bov: hasT ? Object.assign({ v: 1, f0: 2200, sw: 900, q: 0.8, g: 0.75, chirp: 0.25 }, vo.bov) : { v: 0, f0: 1800, sw: 600, q: 0.7, g: 0.05, chirp: 0 },
        intake: g('intake').dsp, scream: 0, lope: vo.lope || 0, rattle: cl.dsp.rattle, spark: ecu.sim.spark ? 1 : 0, cabin: wt.sim.cabin,
        voice: vo,
      },
      look: { low: (su.look || {}).low || 0, susp: su.sim.susp.pitch, exhaust: (ex.look || {}).tip || 0, badge: (tb.look || {}).badge || '' },
    };
  };
}
function genCar(c) {
  const d = GEN_DATA[c.id];
  c.P.tq = d.tq; c.sprite = Object.assign({ img: `img/${c.id}.png`, wheel: `img/${c.id}_wheel.png`, paint: `img/${c.id}_paint.png` }, d.sprite);
  c.sprite.wy = Math.round((d.sprite.wy + d.sprite.wr) * 10) / 10;   // nei dati è il bordo alto della gomma: serve il centro della ruota
  c.tuning = genCatalog(c); c.presets = genPresets(c); c.params = genParams(c); c.body = c.body || {}; c.paint0 = 'orig';
  return c;
}
// turbo e compressori aggiuntivi, condivisi
const KIT_SC = (id, brand, name, bar, price, km, note) => ({ id, brand, name, price, km, note, sim: { max: bar, a: 1800, b: 5500, up: 0.2, down: 0.5, twin: false }, dsp: { f0: 3200, f1: 9800, w: 0.06, wh: 0.06, damp: 2600, twin: 0, mani: 1 } });
const KIT_T = (id, brand, name, bar, a, b, price, km, note, badge) => ({ id, brand, name, price, km, note, sim: { max: bar, a, b, up: 0.42, down: 0.85, twin: false }, dsp: { f0: 2000, f1: 7400, w: 0.055, wh: 0.08, damp: 2300, twin: 0, mani: 1 }, look: badge ? { badge } : {} });
const GEN_CARS = [
  { id: 'r5', name: 'Renault 5 Turbo 2', short: 'R5 Turbo', make: 'Renault', tag: 'Renault 5 Turbo 2 · 1.4 turbo a motore centrale · trazione posteriore · 5 marce',
    voice: { mani: [0.5, 0.45, 0.45, 0.5], rf: -0.46, pulse: 0.82, rough: 0.3, bias: [1.04, 0.95, 1.02, 0.97], metal: 0.3, metalF: 2400, boomRpm: 3900, hiRpm: 6600, bov: { f0: 2600, sw: 1300, q: 0.9, g: 0.95, chirp: 0.45 } },
    engine: 'C1J 1.4 turbo Garrett T3', mass: 970, driveW: 0.6, fwd: false, cyl: 4, exStock: GEN_EX.rally4, pitch: 0.9, mu: 1.08, ecuBrand: 'Renix', ecuMax: 1.0,
    P: { idle: 900, limiter: 6800, launchRpm: 4200, Ie: 0.12, mass: 970, r: 0.30, cd: 0.37, A: 1.85, mu: 1.08, cgH: 0.46, wb: 2.43, tank: 50, gears: [0, 3.364, 2.059, 1.381, 1.037, 0.861], rev: -3.18, fd: 3.889, clutchMax: 380 },
    turbo: { brand: 'Garrett', name: 'T3 originale (0,9 bar)', note: 'Il turbo da rally: sotto i 3000 giri dorme, poi arriva tutto insieme.', sim: { max: 0.9, a: 2400, b: 3400, up: 0.38, down: 0.8, twin: false }, dsp: { f0: 2300, f1: 8600, w: 0.07, wh: 0.11, damp: 2100, twin: 0, mani: 1 }, icHeat: 1.3 },
    boost: [KIT_T('t3_12', 'Garrett', 'T3 con wastegate a 1,2 bar', 1.2, 2500, 3500, 1400, 18, 'Più pressione sullo stesso turbo: +20 % con la centralina.'),
      KIT_T('t3t4', 'Garrett', 'T3/T4 ibrido (1,6 bar)', 1.6, 3000, 4200, 4200, 40, 'Il kit Gruppo B stradale: ritardo enorme, poi una catapulta. Servono centralina e intercooler.')],
    diff0: { name: 'Aperto, finale 3,889', note: 'Con il motore dietro la trazione è già buona.', diff: 'open' }, suspNote: 'Motore centrale: in partenza il peso è già sulle ruote motrici.' },
  { id: 'b2002', name: 'BMW 2002 Turbo', short: '2002 Turbo', make: 'BMW', tag: 'BMW 2002 Turbo · 2.0 turbo KKK · trazione posteriore · 4 marce',
    voice: { mani: [0.74, 0.64, 0.64, 0.74], rf: -0.3, pulse: 1.18, rough: 0.45, lope: 0.3, bias: [1.06, 0.93, 1.03, 0.96], boomRpm: 2800, hiRpm: 6200, bov: { v: 2, f0: 1500, sw: 500, q: 0.7, g: 0.9, chirp: 0 } },
    engine: 'M10 2.0 turbo KKK', mass: 1080, driveW: 0.46, fwd: false, cyl: 4, exStock: GEN_EX.old4, pitch: 1.25, mu: 1.0, ecuBrand: 'Kugelfischer', ecuMax: 0.8,
    P: { idle: 900, limiter: 6400, launchRpm: 4000, Ie: 0.16, mass: 1080, r: 0.29, cd: 0.40, A: 1.85, mu: 1.0, cgH: 0.52, wb: 2.5, tank: 70, gears: [0, 3.764, 2.02, 1.32, 1.0], rev: -4.1, fd: 3.36, clutchMax: 380 },
    turbo: { brand: 'KKK', name: 'BLD originale (0,55 bar)', note: 'Il primo turbo europeo di serie: ritardo leggendario, poi 170 CV su un\'auto da 1080 kg.', sim: { max: 0.55, a: 3000, b: 4000, up: 0.55, down: 0.9, twin: false }, dsp: { f0: 1700, f1: 6400, w: 0.045, wh: 0.13, damp: 1800, twin: 0, mani: 1 }, icHeat: 1.6 },
    boost: [KIT_T('kkk09', 'KKK', 'BLD regolato a 0,9 bar', 0.9, 3000, 4000, 1200, 16, 'Wastegate ritarata: +25 %, ma il ritardo resta.'),
      KIT_T('t3', 'Garrett', 'T3 moderno (1,3 bar)', 1.3, 2600, 3700, 3600, 38, 'Turbo a cuscinetti con iniezione elettronica: risposta molto più pronta.')],
    gearbox: { brand0: 'Getrag', name0: '4 marce originale', note0: 'Quarta diretta: a 180 km/h sei già al limitatore.', items: [{ id: 'g245', brand: 'Getrag', name: '245 a 5 marce', note: 'La quinta di riposo e marce più vicine.', price: 1800, km: 12, gears: [0, 3.368, 2.16, 1.58, 1.241, 1.0] }] },
    diff0: { name: 'Autobloccante 40 % (di serie), finale 3,36', note: 'Il Turbo aveva già l\'autobloccante.', diff: 'torsen' }, suspNote: 'Molle morbide anni 70: in partenza il muso si alza tantissimo.' },
  { id: 'e30', name: 'BMW M3 E30', short: 'M3 E30', make: 'BMW', tag: 'BMW M3 E30 · S14 2.3 16V · trazione posteriore · Getrag 265 "dogleg"',
    voice: { mani: [0.55, 0.5, 0.5, 0.55], rf: -0.42, pulse: 0.78, rough: 0.12, lope: 0.18, howl: 0.75, howlF: 820, metal: 0.5, metalF: 3100, boomRpm: 3600, hiRpm: 7250 },
    engine: 'S14 2.3 16V aspirato', mass: 1200, driveW: 0.47, fwd: false, cyl: 4, exStock: GEN_EX.bmw4, pitch: 0.95, mu: 1.05, ecuBrand: 'Bosch Motronic', inStock: { in: 1.8, roar: 2.0, wh: 1 },
    naNote: 'Quattro farfalle singole: grida fino a 7250 giri.',
    P: { idle: 880, limiter: 7250, launchRpm: 4500, Ie: 0.13, mass: 1200, r: 0.30, cd: 0.33, A: 1.9, mu: 1.05, cgH: 0.48, wb: 2.565, tank: 70, gears: [0, 3.72, 2.40, 1.77, 1.26, 1.00], rev: -4.23, fd: 4.10, clutchMax: 450 },
    turbo: null,
    boost: [KIT_SC('sc', 'Rotrex', 'Compressore centrifugo (0,5 bar)', 0.5, 4200, 30, 'Spinta che cresce coi giri come un aspirato più grosso: +35 % in alto, fischio da compressore.'),
      KIT_T('turbo', 'Garrett', 'Kit turbo GT28 (1,0 bar)', 1.0, 2900, 4100, 5200, 45, 'Pistoni bassi e turbo: il 2.3 da corsa arriva a 330 CV.', 'TURBO')],
    diff0: { name: 'Autobloccante 25 %, finale 4,10', note: 'Di serie sulla M3.', diff: 'torsen' } },
  { id: 'e36', name: 'BMW M3 E36', short: 'M3 E36', make: 'BMW', tag: 'BMW M3 E36 coupé · S50 3.0 sei in linea · trazione posteriore · 5 marce',
    voice: { mani: [0.5, 0.47, 0.45, 0.45, 0.47, 0.5], split: 0.12, rf: -0.36, pulse: 0.84, howl: 0.35, howlF: 950, metal: 0.8, metalF: 3400, boomRpm: 3400, hiRpm: 7200 },
    engine: 'S50 3.0 aspirato', mass: 1460, driveW: 0.49, fwd: false, cyl: 6, exStock: GEN_EX.bmw6, pitch: 0.9, mu: 1.07, ecuBrand: 'Bosch Motronic',
    naNote: 'Sei in linea col VANOS: coppia piena da 3000 giri.',
    P: { idle: 800, limiter: 7200, launchRpm: 4000, Ie: 0.17, mass: 1460, r: 0.31, cd: 0.32, A: 2.0, mu: 1.07, cgH: 0.48, wb: 2.71, tank: 62, gears: [0, 4.20, 2.49, 1.66, 1.24, 1.00], rev: -3.89, fd: 3.15, clutchMax: 560 },
    turbo: null,
    boost: [KIT_SC('sc', 'ESS', 'Compressore ESS VT1 (0,5 bar)', 0.5, 5600, 30, 'Il kit più diffuso sulla E36: +35 %, guidabilità da serie.'),
      KIT_T('turbo', 'Precision', 'Kit turbo 6262 (1,0 bar)', 1.0, 2800, 4000, 6800, 45, 'Single turbo su collettore tubolare: oltre 500 CV.', 'TURBO')],
    diff0: { name: 'Autobloccante 25 %, finale 3,15', note: 'Di serie sulla M3.', diff: 'torsen' } },
  { id: 'e34', name: 'BMW M5 E34', short: 'M5 E34', make: 'BMW', tag: 'BMW M5 E34 · S38 3.6 sei in linea · trazione posteriore · 5 marce',
    voice: { mani: [0.64, 0.6, 0.57, 0.57, 0.6, 0.64], split: 0.16, rf: -0.4, pulse: 0.95, lope: 0.12, howl: 0.85, howlF: 690, metal: 0.55, metalF: 2900, boomRpm: 3000, hiRpm: 7000 },
    engine: 'S38 3.6 aspirato', mass: 1670, driveW: 0.48, fwd: false, cyl: 6, exStock: GEN_EX.bmw6, pitch: 1.0, mu: 1.07, ecuBrand: 'Bosch Motronic', inStock: { in: 1.8, roar: 2.0, wh: 1 },
    naNote: 'Sei farfalle singole, figlio del motore della M1: 315 CV a 6900 giri.',
    P: { idle: 850, limiter: 7200, launchRpm: 4000, Ie: 0.18, mass: 1670, r: 0.31, cd: 0.32, A: 2.05, mu: 1.07, cgH: 0.5, wb: 2.76, tank: 90, gears: [0, 3.51, 2.08, 1.35, 1.00, 0.81], rev: -3.71, fd: 3.91, clutchMax: 620 },
    turbo: null,
    boost: [KIT_SC('sc', 'Vortech', 'Compressore centrifugo (0,5 bar)', 0.5, 6200, 30, 'La berlina diventa una catapulta: +35 %.'),
      KIT_T('turbo', 'Garrett', 'Biturbo GT30 (0,9 bar)', 0.9, 2800, 3900, 8200, 50, 'Due turbo sul sei in linea: 500 CV da quattro porte.', 'BITURBO')],
    diff0: { name: 'Autobloccante 25 %, finale 3,91', note: 'Di serie sulla M5.', diff: 'torsen' } },
];

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
for (const c of GEN_CARS) CARS[c.id] = genCar(c);
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
