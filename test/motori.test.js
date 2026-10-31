// Prove del Banco Suono 2JZ: fisica (motore, cambio, prestazioni) e sintesi audio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dir = new URL('../motori/', import.meta.url);
const src = readFileSync(new URL('dsp.js', dir), 'utf8') + readFileSync(new URL('sim.js', dir), 'utf8');
const { EngineDSP, SupraSim } = new Function(src + ';return { EngineDSP, SupraSim };')();

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
