// ============================================================================
//  Garage · le auto del giocatore
//  La Supra usa il reparto tuning completo (tuning.js). La Volvo V40 SW ha una
//  scala di potenziamenti progressivi: si comprano in ordine, ognuno si vede sull'auto.
// ============================================================================
/* global tuningParams, TUNING_PRESETS */
const CARS = {
  supra: {
    id: 'supra', name: 'Toyota Supra RZ', short: 'Supra', tag: 'Toyota Supra RZ · JZA80 · sei in linea biturbo · Getrag V160',
    engine: '2JZ-GTE 3.0 biturbo', mass: 1570, driveW: 0.47, fwd: false,
  },
  v40: {
    id: 'v40', name: 'Volvo V40 SW 2.0', short: 'V40', tag: 'Volvo V40 SW · 2.0 16V B4204S · quattro in linea · cambio M56 a 5 marce',
    engine: 'B4204S 2.0 16V aspirato', mass: 1290, driveW: 0.61, fwd: true,
    // fisica: 2.0 aspirato da 140 CV a 6100 giri e 183 Nm a 4500, trazione anteriore, 5 marce
    P: {
      idle: 800, limiter: 6500, launchRpm: 3800, Ie: 0.16, mass: 1290, r: 0.308, cd: 0.33, A: 2.08, mu: 1.0, cgH: 0.52, wb: 2.56,
      tank: 60, gears: [0, 3.385, 1.905, 1.233, 0.906, 0.730], rev: -3.15, fd: 4.0, clutchMax: 420,
      // coppia indicata (le perdite interne del modello si sottraggono): netti 140 CV a 6000 e ~185 Nm a 4500
      tq: [[0, 130], [500, 150], [1000, 185], [1500, 205], [2000, 216], [2500, 224], [3000, 229], [3500, 233],
        [4000, 236], [4500, 238], [5000, 238], [5500, 236], [6000, 233], [6500, 220], [7000, 200], [7500, 180]],
    },
    // potenziamenti in ordine: ciascuno richiede il precedente, costa soldi e chiede chilometri
    ups: [
      { id: 'lavaggio', name: 'Lavaggio e lucidatura', price: 80, km: 0, note: 'Via fango e polvere dalle fiancate: la vernice torna a brillare.' },
      { id: 'cerchi', name: 'Cerchi in lega 16" e gomme sportive', price: 650, km: 2, note: 'Via i copricerchi: cerchi a cinque razze, pinze rosse dietro, un po\' più di presa.' },
      { id: 'assetto', name: 'Assetto ribassato', price: 900, km: 5, note: 'Molle e ammortizzatori sportivi: 35 mm più bassa, meno rollio, più aderenza.' },
      { id: 'scarico', name: 'Scarico sportivo', price: 700, km: 8, note: 'Terminale grande e cromato: voce piena e ruvida, +4 % di potenza.' },
      { id: 'aspira', name: 'Filtro aperto e centralina', price: 600, km: 12, note: 'Aspirazione libera e mappa nuova: limitatore a 6900, +5 %.' },
      { id: 'kit', name: 'Kit estetico', price: 1200, km: 16, note: 'Paraurti con labbro, minigonne e diffusore in tinta.' },
      { id: 'spoiler', name: 'Spoiler sul portellone', price: 350, km: 20, note: 'Alettone sopra il lunotto.' },
      { id: 'turbo', name: 'Kit turbo T4', price: 3800, km: 28, note: 'Il turbo della V40 T4: Mitsubishi TD04HL, intercooler nel paraurti, 0,7 bar. Fischio e valvola.' },
      { id: 'turbo2', name: 'Turbo maggiorato e iniettori', price: 5500, km: 45, note: 'Turbo più grande a 1,3 bar, iniettori e taglio d\'accensione: scoppi e fiammate.' },
      { id: 'lsd', name: 'Autobloccante Quaife e finale corto', price: 1800, km: 60, note: 'Con tanta coppia sulle ruote davanti il differenziale aperto fa pattinare la ruota scarica: il Quaife la tiene giù. Finale 4,45: più spinta in ogni marcia.' },
    ],
  },
};
const CAR_IDS = Object.keys(CARS);

// parametri di fisica e suono per la Volvo al livello di potenziamento dato (0 = di serie)
function v40Params(level) {
  const has = (id) => CARS.v40.ups.findIndex((u) => u.id === id) < level;
  const base = tuningParams(TUNING_PRESETS[0].sel);
  const t1 = has('turbo'), t2 = has('turbo2');
  const turbo = t2 ? { max: 1.3, a: 2800, b: 4000, up: 0.42, down: 0.85, twin: false }
    : t1 ? { max: 0.7, a: 2000, b: 3000, up: 0.3, down: 0.75, twin: false }
      : { max: 0, a: 9000, b: 9900, up: 1, down: 1, twin: false };
  const pw = (has('scarico') ? 1.04 : 1) * (has('aspira') ? 1.05 : 1);
  const mu = 1.0 + (has('cerchi') ? 0.04 : 0) + (has('assetto') ? 0.05 : 0);
  // scarico di serie: silenziatore piccolo e chiuso; sportivo: terminale grande, ruvido
  const exStock = { L: 3.6, r: -0.4, m: [['lp', 900, 0.6], ['lp', 1600, 0.5], ['peak', 130, 1.0, 3], ['peak', 480, 2, -4]], g: 1.5, jet: 0.1, rasp: 0.05, tips: 1 };
  const exSport = { L: 3.4, r: -0.6, m: [['lp', 2600, 0.6], ['peak', 170, 1.0, 4], ['peak', 1100, 1.4, 5], ['peak', 3200, 2, 1]], g: 2.2, jet: 0.6, rasp: 0.5, tips: 1 };
  return {
    sim: {
      turbo, pw, limiter: has('aspira') ? 6900 : 6500, sparkCut: t2, ecuLaunch: t2, ecuPops: t2,
      idle: 800, camLow: 1, camHigh: 1, lope: 0, Ie: 0.16, mu, valve: t1 ? 'bov' : 'recirc',
      // gomme: di serie 195/55 R15 da turismo; coi cerchi 205/45 R16 sportive
      tyre: has('cerchi') ? { B: 20, C: 1.45, E: 0.2, opt: 85, win: 60, crr: 0.012 } : { B: 17, C: 1.4, E: 0.05, opt: 70, win: 75, crr: 0.011, brake: 0.95 },
      diff: has('lsd') ? 'lsd' : 'open', fd: has('lsd') ? 4.45 : 4.0, gears: null,
      boostK: 0.42,                 // 1.9-2.0 litri: la stessa pressione rende meno che sul 3.0 della Supra
    },
    dsp: Object.assign({}, base.dsp, {
      cyl: 4,
      ex: has('scarico') ? exSport : exStock,
      cat: { lp: has('scarico') ? 3800 : 2400, g: 0.9, pop: t2 ? 1.4 : t1 ? 0.7 : 0.25 },
      tb: t2 ? { f0: 2100, f1: 7600, w: 0.05, wh: 0.08, damp: 2200, twin: 0, mani: 1 }
        : t1 ? { f0: 2600, f1: 8800, w: 0.04, wh: 0.06, damp: 2000, twin: 0, mani: 1 }
          : { f0: 2500, f1: 8000, w: 0, wh: 0, damp: 1700, twin: 0, mani: 1 },
      bov: t1 ? { v: 1, f0: 2200, sw: 900, q: 0.8, g: 0.7, chirp: 0.3 } : { v: 0, f0: 1800, sw: 600, q: 0.7, g: 0.05, chirp: 0 },
      intake: has('aspira') ? { in: 2.2, roar: 2.4, wh: 1.6 } : { in: 1, roar: 1, wh: 1 },
      scream: 0, lope: 0, rattle: 0, spark: t2 ? 1 : 0,
    }),
    look: {
      clean: has('lavaggio'), alloys: has('cerchi'), low: has('assetto'), exhaust: has('scarico'), intake: has('aspira'),
      kit: has('kit'), spoiler: has('spoiler'), turbo: t1, turbo2: t2,
    },
  };
}
if (typeof window !== 'undefined') Object.assign(window, { CARS, CAR_IDS, v40Params });
