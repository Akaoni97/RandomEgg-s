// Prove del Banco Suono 2JZ: fisica (motore, cambio, prestazioni) e sintesi audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dir = new URL('../motori/', import.meta.url);
const src = ['dsp.js', 'sim.js', 'tuning.js', 'samples.js', 'game.js'].map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
const { EngineDSP, SupraSim, TUNING, TUNING_PRESETS, tuningParams, SamplePlayer, StreetGame, GAME_LANE_Z } =
  new Function(src + ';return { EngineDSP, SupraSim, TUNING, TUNING_PRESETS, tuningParams, SamplePlayer, StreetGame, GAME_LANE_Z };')();

function drive(sim, seconds, each) {
  for (let t = 0; t < seconds; t += 1 / 60) { each?.(sim, t); sim.update(1 / 60); sim.events.length = 0; }
}
function startEngine(sim) {
  sim.setIgnition(true);
  drive(sim, 4, (s, t) => s.setStarter(t < 1.2));
}

test('avviamento e minimo stabile', () => {
  const sim = new SupraSim();
  startEngine(sim);
  assert.ok(sim.running, 'il motore deve partire');
  drive(sim, 25);
  assert.ok(sim.rpm > 700 && sim.rpm < 850, `minimo a ${sim.rpm.toFixed(0)} giri`);
});

test('limitatore a 7000 giri in folle', () => {
  const sim = new SupraSim();
  startEngine(sim);
  let max = 0, cut = false;
  drive(sim, 3, (s) => { s.in.thr = 1; max = Math.max(max, s.rpm); cut ||= s.cut === 2; });
  assert.ok(cut, 'il taglio deve intervenire');
  assert.ok(max < 7150, `massimo ${max.toFixed(0)} giri`);
});

test('prestazioni realistiche della configurazione originale', () => {
  const sim = new SupraSim();
  startEngine(sim);
  sim.shift(1);
  drive(sim, 30, (s) => {
    s.in.thr = 1;
    if (s.rpm > 6750 && s.gear > 0 && s.gear < 6 && !s.shiftSeq) s.shift(s.gear + 1);
  });
  assert.ok(sim.best100 > 4.5 && sim.best100 < 6, `0-100 in ${sim.best100?.toFixed(2)} s`);
  assert.ok(sim.best400.t > 12.6 && sim.best400.t < 14.2, `400 m in ${sim.best400.t.toFixed(2)} s`);
  assert.ok(Number.isFinite(sim.v) && Number.isFinite(sim.we));
});

test('frizione manuale: senza pedale il cambio gratta', () => {
  const sim = new SupraSim();
  sim.cfg.autoClutch = false;
  startEngine(sim);
  assert.equal(sim.shift(1), false);
  assert.ok(sim.events.some((e) => e.type === 'grind'));
  sim.in.clutch = 1;
  assert.equal(sim.shift(1), true);
});

test('rilascio con boost genera lo sfiato della valvola', () => {
  const sim = new SupraSim();
  startEngine(sim);
  let bov = false;
  drive(sim, 0.6, (s) => { s.in.thr = 1; });
  for (let i = 0; i < 60; i++) { sim.in.thr = 0; sim.update(1 / 60); bov ||= sim.events.some((e) => e.type === 'bov'); sim.events.length = 0; }
  assert.ok(bov);
});

test('audio: frequenza di scoppio corretta e uscita senza errori', () => {
  const sr = 48000, dsp = new EngineDSP(sr);
  dsp.msg({ cfg: { view: 1, exhaust: 2 }, p: { rpm: 3000, charge: 0.6, air: 0.6, thr: 0.5, running: 1 } });
  const n = sr, L = new Float32Array(n), R = new Float32Array(n);
  dsp.render(L, R, n);
  dsp.render(L, R, n);
  let peak = 0;
  for (const x of L) { assert.ok(Number.isFinite(x)); peak = Math.max(peak, Math.abs(x)); }
  assert.ok(peak > 0.02 && peak <= 0.9, `picco ${peak}`);
  const mag = (f) => { let re = 0, im = 0; for (let i = 0; i < n; i++) { const a = 2 * Math.PI * f * i / sr; re += L[i] * Math.cos(a); im += L[i] * Math.sin(a); } return Math.hypot(re, im); };
  // 3000 giri, sei cilindri a quattro tempi: 3 scoppi per giro = 150 Hz
  assert.ok(mag(150) > 3 * mag(127), 'la terza armonica di giro deve dominare');
});

test('tuning: potenza stimata coerente con le preparazioni', () => {
  const cv = (sel) => { const s = new SupraSim(); s.setTune(tuningParams(sel).sim); return s.estimatePeak().cv; };
  const [stock, street, single, drag] = TUNING_PRESETS.map((p) => cv(p.sel));
  assert.ok(stock > 290 && stock < 360, `originale ${stock.toFixed(0)} CV`);
  assert.ok(street > stock && single > street && drag > single);
});

test('tuning: ogni parte produce audio valido e lo straight pipe è più forte dell\'originale', () => {
  const sr = 48000;
  const rms = (sel) => {
    const dsp = new EngineDSP(sr);
    dsp.msg({ cfg: { view: 1, tune: tuningParams(sel).dsp }, p: { rpm: 5000, charge: 1.6, air: 1, thr: 1, running: 1, turbo: 0.9, boost: 0.8, wg: 0.4 } });
    const L = new Float32Array(sr / 2), R = new Float32Array(sr / 2);
    dsp.render(L, R, L.length); dsp.render(L, R, L.length);
    let e = 0; for (const x of L) { assert.ok(Number.isFinite(x)); e += x * x; }
    return Math.sqrt(e / L.length);
  };
  const base = TUNING_PRESETS[0].sel;
  for (const [k, cat] of Object.entries(TUNING)) for (const it of cat.items) rms({ ...base, [k]: it.id });
  assert.ok(rms({ ...base, exhaust: 'straight' }) > 1.5 * rms(base));
});

test('centralina originale: niente launch control', () => {
  const sim = new SupraSim();
  sim.cfg.launch = true;
  startEngine(sim);
  sim.shift(1);
  drive(sim, 1, (s) => { s.in.brake = 1; s.in.thr = 1; });
  assert.equal(sim.launchArmed, false);
  sim.setTune(tuningParams({ ...TUNING_PRESETS[0].sel, ecu: 'haltech' }).sim);
  drive(sim, 1, (s) => { s.in.brake = 1; s.in.thr = 1; });
  assert.ok(sim.launchArmed && sim.rpm < 4500, `giri ${sim.rpm.toFixed(0)}`);
});

test('campioni della mod: regime e tipo letti dal nome, dissolvenza a potenza costante', () => {
  assert.deepEqual(SamplePlayer.parse('on_4000.ogg'), { rpm: 4000, off: false });
  assert.deepEqual(SamplePlayer.parse('supra_off_2500.wav'), { rpm: 2500, off: true });
  const a = { rpm: 2000 }, b = { rpm: 4000 };
  const w = SamplePlayer.weights([a, b], 3000);
  assert.ok(Math.abs(w.get(a) ** 2 + w.get(b) ** 2 - 1) < 1e-9);
});

// ---- carriera su strada --------------------------------------------------------
function career() {
  const sim = new SupraSim();
  const game = new StreetGame(sim, () => 0.5);
  startEngine(sim);
  game.nextSpawn = 1e9;                   // eventi solo quelli creati dal test
  return { sim, game };
}
function play(sim, game, seconds, pedals) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    const p = pedals ? pedals(sim, t) : { thr: 0, brake: 0 };
    sim.in.thr = p.thr; sim.in.brake = p.brake;
    const c = game.control(sim.in, 1 / 60);
    sim.in.thr = c.thr; sim.in.brake = c.brake;
    sim.update(1 / 60); sim.events.length = 0;
    game.update(1 / 60);
  }
}
const flatOut = (sim) => {
  if (sim.rpm > 6500 && sim.gear < 6 && !sim.shiftSeq) sim.shift(sim.gear + 1);
  return { thr: 1, brake: 0 };
};

test('polizia: passarle accanto in sesta costa una multa e alza il livello di ricercato', () => {
  const { sim, game } = career();
  sim.shift(1);
  play(sim, game, 32, flatOut);
  assert.equal(sim.gear, 6);
  game.ents.push({ id: 99, kind: 'police', lane: 0, x: game.s.dist + 60, v: 0 });
  const money = game.s.money;
  play(sim, game, 14, flatOut);
  assert.ok(game.prompt && game.prompt.kind === 'police', 'deve fermarti');
  assert.ok(Math.abs(sim.v) < 0.5, 'il gioco frena fino a fermarti');
  game.answer(0);
  assert.ok(game.s.money < money && game.s.heat >= 1);
});

test('polizia: in quinta si passa senza problemi', () => {
  const { sim, game } = career();
  sim.shift(1);
  play(sim, game, 10, (s) => { if (s.rpm > 6000 && s.gear < 5 && !s.shiftSeq) s.shift(s.gear + 1); return { thr: 0.8, brake: 0 }; });
  game.ents.push({ id: 99, kind: 'police', lane: 0, x: game.s.dist + 40, v: 0 });
  play(sim, game, 4, () => ({ thr: 0.5, brake: 0 }));
  assert.equal(game.prompt, null);
  assert.equal(game.s.heat, 0);
});

test('traffico lento in prima corsia: sorpasso automatico e rientro', () => {
  const { sim, game } = career();
  sim.shift(1);
  play(sim, game, 6, flatOut);
  game.ents.push({ id: 50, kind: 'traffic', lane: 1, x: game.s.dist + 50, v: 12 });
  let overtook = false;
  play(sim, game, 12, (s) => { overtook ||= game.lane === 2; return flatOut(s); });
  assert.ok(overtook, 'deve spostarsi in seconda corsia');
  assert.equal(game.lane, 1, 'poi rientra');
});

test('distributore: il pieno ferma l\'auto, riempie il serbatoio e scala i soldi', () => {
  const { sim, game } = career();
  sim.fuel = 0.3;
  sim.shift(1);
  play(sim, game, 4, flatOut);
  game.ents.push({ id: 7, kind: 'station', lane: 0, x: game.s.dist + 500, v: 0 });
  play(sim, game, 0.2, flatOut);
  assert.equal(game.prompt.kind, 'station');
  const money = game.s.money;
  game.answer(0);
  play(sim, game, 60, (s) => (game.ap ? { thr: 1, brake: 0 } : { thr: 0, brake: 0 }));
  assert.ok(sim.fuel > 0.98, `serbatoio al ${(sim.fuel * 100).toFixed(0)}%`);
  assert.ok(money - game.s.money > 80 && money - game.s.money < 100);
});

test('sfida: semaforo, conto alla rovescia, 400 m e pagamento', () => {
  const { sim, game } = career();
  game.startRace({ name: 'Test', car: 'Test' }, 300);
  play(sim, game, 1, () => ({ thr: 0, brake: 1 }));
  assert.equal(game.race.phase, 'count');
  sim.shift(1);
  play(sim, game, 3.3, () => ({ thr: 0, brake: 1 }));
  assert.equal(game.race.phase, 'run');
  const money = game.s.money;
  play(sim, game, 25, flatOut);
  assert.equal(game.race, null);
  assert.ok(game.lastRace && Math.abs(game.s.money - money) === 300);
});

test('sfida: partire prima del via è falsa partenza', () => {
  const { sim, game } = career();
  game.startRace({ name: 'Test', car: 'Test' }, 200);
  sim.shift(1);
  play(sim, game, 1.5, () => ({ thr: 0, brake: 1 }));
  play(sim, game, 2, flatOut);
  assert.equal(game.race, null);
  assert.equal(game.lastRace.win, false);
});

test('officina: si compra solo con i soldi sufficienti', () => {
  const { game } = career();
  assert.equal(game.owns('turbo', 't51r'), false);
  assert.equal(game.buy('turbo', 't51r').ok, false, 'costa 6000, ne hai 3000');
  assert.equal(game.buy('bov', 'ssqv').ok, true);
  assert.equal(game.s.money, 3000 - 380);
  assert.ok(game.owns('bov', 'ssqv'));
});

test('gara: la cambiata vicino al limitatore è perfetta e più rapida', () => {
  const { sim, game } = career();
  game.startRace({ name: 'T', car: 'T' }, 0, { et: 30 });
  play(sim, game, 1, () => ({ thr: 0, brake: 1 }));
  sim.shift(1);
  play(sim, game, 3.7, () => ({ thr: 0.6, brake: 1 }));
  assert.equal(game.race.phase, 'run');
  let fastT = null, slowT = null;
  // prima → seconda a regime perfetto (ci si ferma appena la cambiata è finita)
  for (let n = 0; n < 400 && !(fastT !== null && !sim.shiftSeq); n++) play(sim, game, 1 / 60, (s) => {
    if (s.gear === 1 && s.rpm > s.P.limiter - 300 && !s.shiftSeq) { assert.equal(game.gradeShift(), 'perfetta'); s.shift(2); fastT = 0; }
    if (fastT !== null && s.shiftSeq) fastT += 1 / 60;
    return { thr: 1, brake: 0 };
  });
  // seconda → terza troppo presto
  play(sim, game, 0.2, (s) => {
    if (s.gear === 2 && !s.shiftSeq && slowT === null) { assert.equal(game.gradeShift(), 'anticipata'); s.shift(3); slowT = 0; }
    if (slowT !== null && s.shiftSeq) slowT += 1 / 60;
    return { thr: 1, brake: 0 };
  });
  play(sim, game, 0.4, (s) => { if (s.shiftSeq) slowT += 1 / 60; return { thr: 1, brake: 0 }; });
  assert.ok(fastT < slowT, `perfetta ${fastT.toFixed(2)} s, normale ${slowT.toFixed(2)} s`);
  assert.deepEqual(game.race.shifts, ['perfetta', 'anticipata']);
});

test('scala dei rivali: vincere avanza, perdere non costa', () => {
  const { sim, game } = career();
  assert.equal(game.ladderRival().name, 'Tommy');
  const money = game.s.money;
  game.startLadder();
  game.race.et = 99;                         // rivale lentissimo: si vince
  play(sim, game, 1, () => ({ thr: 0, brake: 1 }));
  sim.shift(1);
  play(sim, game, 3.7, () => ({ thr: 0, brake: 1 }));
  play(sim, game, 30, flatOut);
  assert.ok(game.result && game.result.win);
  assert.equal(game.s.ladder, 1);
  assert.equal(game.s.money, money + 300);
  game.result = null;
  game.startLadder();
  game.race.et = 1;                          // rivale imbattibile
  play(sim, game, 40, (s, t) => (game.race && game.race.phase !== 'run' ? { thr: 0, brake: 1 } : flatOut(s)));
  assert.equal(game.result.win, false);
  assert.equal(game.s.ladder, 1);
  assert.equal(game.s.money, money + 300);
});

test('gomme da drag: più aderenza e tempo stimato migliore', () => {
  const { sim, game } = career();
  const base = game.etEstimate();
  sim.setTune(tuningParams({ ...TUNING_PRESETS[0].sel, tires: 'etstreet' }).sim);
  assert.equal(sim.P.mu, 1.55);
  assert.ok(game.etEstimate() < base);
});

test('corsie a mano: si cambia corsia e tamponare costa', () => {
  const { sim, game } = career();
  game.autoLane = false;
  sim.shift(1);
  play(sim, game, 6, flatOut);
  assert.equal(game.steer(1), true);
  assert.equal(game.lane, 2);
  play(sim, game, 1.5, flatOut);
  assert.ok(Math.abs(game.laneZ - GAME_LANE_Z[2]) < 0.2, 'la Supra si sposta in seconda corsia');
  const money = game.s.money, v0 = sim.v;
  game.ents.push({ id: 77, kind: 'traffic', lane: 2, x: game.s.dist + 25, v: 8, color: 0x2b4c7e });
  play(sim, game, 3, flatOut);
  assert.ok(sim.damage > 0, 'la carrozzeria si ammacca'); assert.equal(game.s.money, money, 'si paga solo quando si ripara');
  assert.ok(game.repair().ok); assert.equal(sim.damage, 0); assert.ok(game.s.money < money);
  assert.ok(game.s.crashes >= 1);
  assert.equal(game.steer(1), true); assert.equal(game.lane, 3);
  assert.equal(game.steer(1), false, 'non si va oltre la terza corsia');
  void v0;
});

test('sterzo libero: si va dove si vuole, si resta lì, cordolo come limite', () => {
  const { sim, game } = career();
  game.autoLane = false;
  sim.shift(1);
  play(sim, game, 6, flatOut);
  const z0 = game.laneZ;
  game.steerHold(1); play(sim, game, 0.6, flatOut); game.steerHold(0);
  const z1 = game.laneZ;
  assert.ok(z1 < z0 - 0.3, `a sinistra: ${z0.toFixed(2)} -> ${z1.toFixed(2)}`);
  play(sim, game, 2, flatOut);
  assert.ok(Math.abs(game.laneZ - z1) < 0.6, 'mollato lo sterzo la Supra non torna in corsia da sola');
  assert.ok(Math.abs(game.laneZ - GAME_LANE_Z[1]) > 0.3 && Math.abs(game.laneZ - GAME_LANE_Z[2]) > 0.3, 'sta fra le corsie');
  game.steerHold(-1); play(sim, game, 8, flatOut); game.steerHold(0);
  assert.ok(game.laneZ <= GAME_LANE_Z[1] + 1.4 + 1e-9, 'il cordolo ferma la Supra');
  assert.equal(game.lane, 1);
});

test('gomme: si scaldano pattinando, la presa ha un ottimo e si consumano', () => {
  const { sim } = career();
  const cold = sim.tireGrip();
  sim.tireT = 90; const hot = sim.tireGrip();
  sim.tireT = 150; const cooked = sim.tireGrip();
  assert.ok(hot > cold && hot > cooked, `fredde ${cold.toFixed(2)}, a temperatura ${hot.toFixed(2)}, cotte ${cooked.toFixed(2)}`);
  sim.tireT = 24;
  // burnout: freno tirato, gas a fondo in prima
  sim.cfg.autoClutch = false; sim.in.clutch = 1; sim.shift(1);
  drive(sim, 1, (s) => { s.in.thr = 0.5; s.in.brake = 1; s.in.clutch = 1; });
  drive(sim, 6, (s) => { s.in.thr = 1; s.in.brake = 1; s.in.clutch = 0; });
  assert.ok(sim.tireT > 45, `dopo il burnout ${sim.tireT.toFixed(0)} °C`);
  assert.ok(sim.tireWear > 0.001);
});

test('bagagliaio: peso sull\'auto, tanica, kit, consegne', () => {
  const { sim, game } = career();
  assert.equal(sim.P.mass, 1570 + 30, 'ruota di scorta, kit e tanica pesano 30 kg');
  const et0 = game.etEstimate();
  for (let n = 0; n < 4; n++) game.buyItem('zavorra');
  assert.equal(sim.P.mass, 1570 + 130);
  assert.ok(game.etEstimate() > et0, 'più peso, tempi peggiori');
  assert.equal(game.buyItem('zavorra').ok, false, 'oltre 150 kg non entra');
  sim.fuel = 0.1;
  const ti = game.s.trunk.findIndex((it) => it.kind === 'tanica');
  assert.ok(game.useItem(ti).ok); assert.ok(Math.abs(sim.fuel - (0.1 + 10 / 70)) < 1e-9);
  sim.damage = 0.3;
  const ki = game.s.trunk.findIndex((it) => it.kind === 'kit');
  assert.ok(game.useItem(ki).ok); assert.ok(Math.abs(sim.damage - 0.15) < 1e-9);
  while (game.s.trunk.some((it) => it.kind === 'zavorra')) game.dropItem(game.s.trunk.findIndex((it) => it.kind === 'zavorra'));
  game.offerJob(); game.answer(0);
  assert.ok(game.s.trunk.some((it) => it.kind === 'pacco'), 'il pacco va nel bagagliaio');
  assert.equal(game.dropItem(game.s.trunk.findIndex((it) => it.kind === 'pacco')).ok, false);
});
