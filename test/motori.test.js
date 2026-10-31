// Prove del Banco Suono 2JZ: fisica (motore, cambio, prestazioni) e sintesi audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dir = new URL('../motori/', import.meta.url);
const src = ['dsp.js', 'sim.js', 'tuning.js', 'samples.js'].map((f) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
const { EngineDSP, SupraSim, TUNING, TUNING_PRESETS, tuningParams, SamplePlayer } =
  new Function(src + ';return { EngineDSP, SupraSim, TUNING, TUNING_PRESETS, tuningParams, SamplePlayer };')();

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
