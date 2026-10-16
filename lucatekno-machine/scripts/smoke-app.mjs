// Prova di avvio dell'app desktop: apre la finestra, accende la macchina, avvia la riproduzione,
// renderizza un pattern offline e salva uno screenshot.
// Uso:  node scripts/smoke-app.mjs            (Electron di sviluppo + build in dist/)
//       node scripts/smoke-app.mjs --packaged (eseguibile in release/win-unpacked o linux-unpacked)

import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packaged = process.argv.includes('--packaged');
let launch;
if (packaged) {
  const exe = process.platform === 'win32'
    ? path.join(root, 'release', 'win-unpacked', 'LucaTekno_Machine.exe')
    : path.join(root, 'release', 'linux-unpacked', 'lucatekno-machine');
  if (!fs.existsSync(exe)) throw new Error('Eseguibile non trovato: ' + exe);
  launch = { executablePath: exe, args: [] };
} else {
  const exe = path.join(root, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
  launch = { executablePath: exe, args: [root, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])] };
}

const failures = [];
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) failures.push(msg); };

const app = await electron.launch({ ...launch, cwd: root, timeout: 60000 });
const win = await app.firstWindow();
const errors = [];
win.on('pageerror', (e) => errors.push(e.message));
await win.waitForSelector('.lcd', { timeout: 30000 });
await win.waitForTimeout(800);

check((await win.title()) === 'LucaTekno_Machine', 'titolo finestra');
check(await win.evaluate(() => !!window.__tm?.store), 'interfaccia caricata');

await win.keyboard.press('KeyK');
await win.waitForTimeout(1500);
const powered = await win.evaluate(() => window.__tm.store.getState().powered);
check(powered, 'accensione (AudioContext)');

if (powered) {
  await win.keyboard.press('Space');
  await win.waitForTimeout(1500);
  const s = await win.evaluate(() => ({ playing: window.__tm.store.getState().playing, ph: document.querySelectorAll('.step-key.ph').length }));
  check(s.playing && s.ph === 1, 'riproduzione e LED del playhead');
  await win.keyboard.press('Escape');

  // LT DECK: il piatto del Mattone deve essere pronto e suonare quando gira
  await win.waitForFunction(() => window.__tm.deck.getState().ready, null, { timeout: 15000 }).catch(() => {});
  await win.keyboard.press('KeyJ');
  await win.waitForTimeout(900);
  // la frase scratch ha pause tra le parole: si prende il massimo su più letture
  const deck = await win.evaluate(async () => {
    const an = window.__tm.engine().meterL;
    const b = new Float32Array(an.fftSize);
    let rms = 0;
    for (let k = 0; k < 15; k++) {
      an.getFloatTimeDomainData(b);
      let s = 0;
      for (const v of b) s += v * v;
      rms = Math.max(rms, Math.sqrt(s / b.length));
      await new Promise((r) => setTimeout(r, 50));
    }
    return { ready: window.__tm.deck.getState().ready, rms };
  });
  check(deck.ready && deck.rms > 0.03, `piatto scratch (RMS ${deck.rms.toFixed(3)})`);
  await win.keyboard.press('KeyJ');
}

// i campioni della cassa (moduli separati) devono caricarsi anche da file:// nell'app impacchettata
await win.waitForFunction(() => window.__tm.hasSample('lib:mr_ta'), null, { timeout: 15000 }).catch(() => {});
check(await win.evaluate(() => window.__tm.hasSample('lib:mr_ta')), 'campioni della cassa dei dischi');

const r = await win.evaluate(async () => {
  const { renderPattern, analyze, PRESETS } = window.__tm;
  const a = analyze(await renderPattern(PRESETS[0].build().patterns[0], 2));
  return { peak: a.peak, nan: a.nan };
});
check(!r.nan && r.peak > 0.3 && r.peak < 0.99, `render audio offline (picco ${r.peak.toFixed(3)})`);

const shot = path.join(root, 'release', 'smoke.png');
fs.mkdirSync(path.dirname(shot), { recursive: true });
await win.screenshot({ path: shot });
console.log('screenshot:', shot);
check(errors.length === 0, 'nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));

await app.close();
if (failures.length) {
  console.error(`\n${failures.length} controlli falliti`);
  process.exit(1);
}
console.log('\nTutti i controlli superati');
