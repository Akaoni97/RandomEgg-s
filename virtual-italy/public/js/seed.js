// Abitanti dimostrativi: passano dalle stesse operazioni dei veri iscritti (join → confirm → chooseSlot).
// Servono alla demo nel browser, alle prove e a `npm run demo`. Non hanno un account per accedere.
import { applyOp, PLAN, PIAZZA, parseKey, districtAt, ROOFS, DOORS, GARDENS, DECOS, hash, usernameKey } from './core.js';

const NAMES = ['giulia.romano', 'marco_bianchi', 'sofia.ferri', 'luca.esposito', 'chiara_gallo', 'matteo.conti',
  'aurora.ricci', 'tommaso.greco', 'alice.marino', 'davide.costa', 'martina.fontana', 'riccardo.moretti', 'elena.bruno',
  'pietro.colombo', 'bea.lombardi', 'andrea.villa', 'giorgia.serra', 'nicolo.rinaldi', 'francesca.caruso', 'lorenzo.deluca',
  'anna.mancini', 'federico.galli', 'camilla.leone', 'simone.longo', 'vale.gentile', 'gabriele.martini', 'irene.rossi',
  'ema.barbieri', 'noemi.testa', 'leo.pellegrini', 'sara.marchetti', 'filippo.sala', 'ginevra.farina', 'alessio.monti',
  'rebecca.cattaneo', 'samuele.fabbri', 'greta.orlando', 'diego.basile', 'ludovica.neri', 'christian.vitale'];
const BIOS = ['Amo il mare e la pizza napoletana', 'Ciclista della domenica', 'Caffè sempre, domande poche', '',
  'Fotografo di tramonti', 'Nonna mi ha insegnato le tagliatelle', '', 'Fan della Vespa dal 1998', 'Leggo in piazza',
  'Musica, montagna, amici', '', 'Vengo da Bari, abito a Virtual-Italy'];

export const DEMO_TAG = 'demo_';

export function seedResidents(state, n, now = Date.now(), salt = 0) {
  let s = state;
  const sys = { system: true, now };
  const taken = new Set(Object.values(s.residents).map((r) => usernameKey(r.username)));
  for (let i = 0; i < n; i++) {
    let name = NAMES.find((u) => !taken.has(u));
    if (!name) name = 'abitante.' + (taken.size + 1);
    taken.add(name);
    const id = DEMO_TAG + hash(name + salt).toString(36);
    const t = now - (n - i) * 3600000 * 3;
    s = applyOp(s, { type: 'join', id, username: name }, { ...sys, now: t }).state;
    s = applyOp(s, { type: 'confirm', id }, { ...sys, now: t }).state;
    const slot = pickSlot(s, hash(name + 'slot' + salt));
    if (!slot) break;
    const h = hash(name);
    const style = { roof: ROOFS[h % 6].id, door: DOORS[(h >>> 4) % 6].id, garden: GARDENS[(h >>> 8) % GARDENS.length].id, deco: DECOS[(h >>> 12) % DECOS.length].id };
    s = applyOp(s, { type: 'anagrafe' }, { user: { id }, now: t }).state;
    s = applyOp(s, { type: 'chooseSlot', slot, style }, { user: { id }, now: t }).state;
    s = applyOp(s, { type: 'profile', bio: BIOS[h % BIOS.length] }, { user: { id }, now: t }).state;
  }
  return s;
}

// Lotto libero vicino alla piazza, con un po' di casualità: la città cresce dal centro.
export function pickSlot(s, seed = 0) {
  const cx = (PIAZZA.x0 + PIAZZA.x1) / 2, cy = PIAZZA.y1;
  let best = null, bestScore = Infinity;
  for (const k of PLAN.lots) {
    if (s.houses[k]) continue;
    const [x, y] = parseKey(k);
    if (districtAt(x, y) > s.openDistricts) continue;
    const score = Math.hypot(x - cx, (y - cy) * 1.4) + ((hash(k + seed) % 1000) / 1000) * 9;
    if (score < bestScore) { bestScore = score; best = k; }
  }
  return best;
}
