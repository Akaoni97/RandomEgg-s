// ============================================================================
//  StreetGame · carriera su strada: soldi, benzina, polizia, sfide, consegne
//  Indipendente dalla grafica: la scena 3D legge `ents`, `laneZ`, `s.dist`.
// ============================================================================
const GAME_FUEL_PRICE = 1.95;            // € al litro
const GAME_RIVALS = [
  { name: 'Kenji', car: 'Nissan Silvia S15' }, { name: 'Marta', car: 'Mazda RX-7 FD' },
  { name: 'Dario', car: 'Mitsubishi Lancer Evo VI' }, { name: 'Yuki', car: 'Honda NSX' },
  { name: 'Ivan', car: 'Nissan Skyline GT-R R34' }, { name: 'Sara', car: 'Subaru Impreza STI' },
  { name: 'Leo', car: 'BMW M3 E46' }, { name: 'Nico', car: 'Honda S2000' },
];
const GAME_COLORS = [0x2b4c7e, 0x8a8f96, 0x1d1f22, 0xe8e6df, 0x6b1b14, 0x2f5d3a, 0xb38b2d];
const GAME_LANE_Z = { 0: 6.1, 1: 3.5, 2: 0, 3: -3.5 };
// bagagliaio: 12 posti, 150 kg; il peso si somma alla massa della Supra
const TRUNK_SLOTS = 12, TRUNK_KG = 150, CAR_MASS = 1570;
const INV = {
  tanica: { name: 'Tanica 10 L', kg: 9, price: 35, note: 'Versa 10 litri nel serbatoio, anche a secco.' },
  kit: { name: 'Kit attrezzi', kg: 7, price: 120, uses: 3, note: 'Raddrizzi un po\' la carrozzeria per strada: −15 % di danni, tre usi.' },
  scorta: { name: 'Ruota di scorta', kg: 14, price: 90, note: 'Peso morto finché non serve. Toglierla alleggerisce l\'auto.' },
  pacco: { name: 'Pacco da consegnare', kg: 10, price: 0, note: 'Va portato a destinazione.' },
  trofeo: { name: 'Trofeo', kg: 2, price: 0, note: 'Ricordo di un capo battuto.' },
  zavorra: { name: 'Sacco di sabbia', kg: 25, price: 10, note: 'Peso sul posteriore: più trazione in partenza, ma più massa.' },
};
// scala dei rivali: quattro quartieri, tre rivali e un capo ciascuno (tempi sui 400 m)
const GAME_LADDER = [
  { zone: 'Porto', rivals: [
    { name: 'Tommy', car: 'Honda Civic Type R EK9', et: 15.2, prize: 300 },
    { name: 'Gina', car: 'Mazda MX-5 turbo', et: 14.6, prize: 400 },
    { name: 'Bruno', car: 'Nissan 200SX S14', et: 14.0, prize: 550 },
    { name: 'Lo Scaricatore', car: 'Nissan Skyline GTS-T R33', et: 13.5, prize: 1200, boss: true } ] },
  { zone: 'Zona industriale', rivals: [
    { name: 'Ale', car: 'Mitsubishi Lancer Evo VI', et: 13.1, prize: 900 },
    { name: 'Rina', car: 'Subaru Impreza STI', et: 12.8, prize: 1100 },
    { name: 'Max', car: 'Mazda RX-7 FD', et: 12.5, prize: 1300 },
    { name: 'La Gru', car: 'Nissan Skyline GT-R R34', et: 12.1, prize: 2800, boss: true } ] },
  { zone: 'Centro', rivals: [
    { name: 'Yuki', car: 'Honda NSX', et: 11.9, prize: 2000 },
    { name: 'Dario', car: 'Nissan Silvia S15 SR20 big turbo', et: 11.6, prize: 2400 },
    { name: 'Vera', car: 'Toyota Chaser JZX100', et: 11.3, prize: 2800 },
    { name: 'Il Notaio', car: 'Nissan Skyline GT-R R32 RB26 800 CV', et: 11.0, prize: 6000, boss: true } ] },
  { zone: 'Tangenziale', rivals: [
    { name: 'Ivan', car: 'Mitsubishi 3000GT', et: 10.8, prize: 4000 },
    { name: 'Sara', car: 'Toyota Supra JZA80 single turbo', et: 10.6, prize: 4800 },
    { name: 'Leo', car: 'Nissan GT-R R35', et: 10.4, prize: 5600 },
    { name: 'Il Fantasma', car: 'Toyota Supra JZA80 1000 CV', et: 10.1, prize: 15000, boss: true } ] },
];

class StreetGame {
  constructor(sim, rnd = Math.random) {
    this.sim = sim;
    this.rnd = rnd;
    this.mode = 'career';                 // 'career' | 'free'
    this.s = { money: 3000, rep: 0, heat: 0, dist: 0, owned: {}, wins: 0, losses: 0, fines: 0, jobs: 0, ladder: 0,
      trunk: [{ kind: 'scorta', kg: 14 }, { kind: 'kit', kg: 7, uses: 3 }, { kind: 'tanica', kg: 9 }] };
    this.ents = [];
    this.prompt = null;
    this.ap = null;                        // pilota automatico (fermate)
    this.race = null;
    this.job = null;
    this.out = [];                         // messaggi per l'interfaccia
    this.lane = 1; this.laneZ = GAME_LANE_Z[1]; this.laneT = 0;
    this.nextSpawn = 250; this.id = 1;
    this.siren = 0;
    this.autoLane = true;      // sorpasso automatico (si può spegnere)
    this.manualT = 0;          // secondi in cui la corsia l'ha scelta il pilota
    this.steerIn = 0;          // sterzo libero tenuto dal pilota: +1 sinistra, -1 destra
    this.latV = 0;             // velocità laterale (m/s)
    this.free = false;         // posizione libera sulla carreggiata, fuori dalle corsie
    this.fx = [];              // eventi grafici per le viste (tamponamenti…)
    this.applyMass();
  }

  // cambio corsia del pilota: dir +1 a sinistra (verso la corsia 3), -1 a destra (verso la 1)
  steer(dir) {
    if (this.race || this.ap) return false;
    const nl = Math.max(1, Math.min(3, this.lane + dir));
    if (nl === this.lane) return false;
    this.lane = nl; this.manualT = this.autoLane ? 5 : 1e9;
    return true;
  }

  // sterzo libero: finché il pilota tiene premuto, l'auto si sposta dove vuole sulla carreggiata
  steerHold(x) { this.steerIn = Math.max(-1, Math.min(1, x || 0)); }

  // tamponamento: la Supra rallenta di colpo, l'altra auto viene spinta avanti, si pagano i danni
  crash(e) {
    const sim = this.sim, dv = sim.v - e.v, dmg = Math.min(0.45, 0.05 + dv * 0.025);
    sim.v = Math.max(0, e.v * 0.85); sim.ww = sim.v / sim.P.r; sim.wo = sim.ww; sim.phi = 0;
    if (sim.gear > 0 && sim.lock) sim.we = Math.max(sim.we * 0.6, sim.wo * sim.ratio(sim.gear));
    e.v += Math.min(6, dv * 0.4); e.x = this.s.dist + 5.2;
    sim.damage = Math.min(1, sim.damage + dmg); this.s.crashes = (this.s.crashes || 0) + 1;
    sim.events.push({ type: 'crash', I: Math.min(1.5, dv / 10) });
    this.fx.push({ k: 'crash', I: Math.min(1.5, dv / 10) });
    this.say(`Tamponamento a ${Math.round(dv * 3.6)} km/h di differenza: carrozzeria al ${Math.round(sim.damage * 100)} % di danni`, 'police');
  }

  // ------------------------------------------------------------ salvataggio
  save() { return JSON.stringify({ mode: this.mode, s: this.s }); }
  load(json) {
    try { const o = JSON.parse(json); if (o && o.s) { Object.assign(this.s, o.s); this.mode = o.mode === 'free' ? 'free' : 'career'; } } catch (e) { /* salvataggio illeggibile */ }
    if (!Array.isArray(this.s.trunk)) this.s.trunk = [];
    this.applyMass();
  }
  reset() { const m = this.mode; Object.assign(this, new StreetGame(this.sim, this.rnd)); this.mode = m; }

  // ------------------------------------------------------------ officina
  // ---------------------------------------------------------------- bagagliaio
  trunkKg() { return (this.s.trunk || []).reduce((a, it) => a + it.kg, 0); }
  trunkFits(kg) { return (this.s.trunk || []).length < TRUNK_SLOTS && this.trunkKg() + kg <= TRUNK_KG; }
  applyMass() {
    // il peso nel bagagliaio pesa sul posteriore: più massa e un filo di carico in più sulle ruote motrici
    const kg = this.trunkKg(), P = this.sim.P;
    P.mass = CAR_MASS + kg;
    P.rearW = (0.47 * CAR_MASS + kg * 0.95) / (CAR_MASS + kg);
  }
  addItem(kind, extra = {}) {
    const it = Object.assign({ kind, kg: INV[kind].kg }, INV[kind].uses ? { uses: INV[kind].uses } : {}, extra);
    if (!this.trunkFits(it.kg)) return false;
    this.s.trunk.push(it); this.applyMass(); return true;
  }
  itemName(it) { return it.name || INV[it.kind].name; }
  buyItem(kind) {
    const p = this.mode === 'career' ? INV[kind].price : 0;
    if (p > this.s.money) return { ok: false, why: `Costa € ${p}` };
    if (!this.trunkFits(INV[kind].kg)) return { ok: false, why: 'Il bagagliaio è pieno' };
    this.s.money -= p; this.addItem(kind); this.say(`${INV[kind].name} nel bagagliaio${p ? `: − € ${p}` : ''}`, 'buy');
    return { ok: true };
  }
  useItem(i) {
    const it = this.s.trunk[i]; if (!it) return { ok: false, why: 'Posto vuoto' };
    const sim = this.sim;
    if (it.kind === 'tanica') {
      if (sim.fuel > 0.97) return { ok: false, why: 'Il serbatoio è già pieno' };
      sim.fuel = Math.min(1, sim.fuel + 10 / sim.P.tank); sim.dry = false; this.s.trunk.splice(i, 1);
      this.say('10 litri dalla tanica', 'fuel');
    } else if (it.kind === 'kit') {
      if (Math.abs(sim.v) > 0.5) return { ok: false, why: 'Fermati per usare gli attrezzi' };
      if (sim.damage < 0.01) return { ok: false, why: 'Non c\'è niente da raddrizzare' };
      sim.damage = Math.max(0, sim.damage - 0.15); it.uses -= 1; if (it.uses <= 0) this.s.trunk.splice(i, 1);
      this.say(`Martello e pazienza: danni al ${Math.round(sim.damage * 100)} %`, 'buy');
    } else return { ok: false, why: it.kind === 'pacco' ? 'Il pacco va consegnato, non aperto' : 'Questo oggetto non si usa: puoi solo toglierlo' };
    this.applyMass(); return { ok: true };
  }
  dropItem(i) {
    const it = this.s.trunk[i]; if (!it) return { ok: false };
    if (it.kind === 'pacco' && this.job) return { ok: false, why: 'Se butti il pacco perdi la consegna: portalo a destinazione' };
    this.s.trunk.splice(i, 1); this.applyMass(); this.say(`${this.itemName(it)} lasciato sul marciapiede`); return { ok: true };
  }

  // servizi d'officina: carrozziere e gomme nuove
  repairCost() { return Math.round(this.sim.damage * 2600 / 10) * 10; }
  tireCost() { return Math.max(380, Math.round(tuningItem('tires', this.tireId || 'oem').price * 0.55 / 10) * 10); }
  repair() {
    const c = this.mode === 'career' ? this.repairCost() : 0;
    if (!this.sim.damage) return { ok: false, why: 'La carrozzeria è già a posto' };
    if (c > this.s.money) return { ok: false, why: `Il carrozziere vuole € ${c}` };
    this.s.money -= c; this.sim.damage = 0; this.say(`Carrozzeria riparata${c ? `: − € ${c}` : ''}`, 'buy'); return { ok: true };
  }
  newTires() {
    const c = this.mode === 'career' ? this.tireCost() : 0;
    if (c > this.s.money) return { ok: false, why: `Un treno di gomme costa € ${c}` };
    this.s.money -= c; this.sim.tireWear = 0; this.sim.tireT = 24; this.say(`Gomme nuove montate${c ? `: − € ${c}` : ''}`, 'buy'); return { ok: true };
  }
  owns(cat, id) { return this.mode === 'free' || TUNING[cat].items[0].id === id || !!this.s.owned[cat + ':' + id]; }
  price(cat, id) { return this.owns(cat, id) ? 0 : tuningItem(cat, id).price; }
  canMount() { return this.mode === 'free' || (Math.abs(this.sim.v) < 0.5 && !this.race); }
  buy(cat, id) {
    const p = this.price(cat, id);
    if (p > this.s.money) return { ok: false, why: `Servono € ${p}, ne hai ${Math.floor(this.s.money)}` };
    this.s.money -= p;
    this.s.owned[cat + ':' + id] = true;
    if (p) this.say(`Comprato ${tuningItem(cat, id).brand} ${tuningItem(cat, id).name}: − € ${p}`, 'buy');
    return { ok: true, paid: p };
  }

  say(text, kind = 'info') { this.out.push({ text, kind }); }
  ask(p) { if (this.prompt) return false; this.prompt = Object.assign({ t: 9, time: 9 }, p); this.prompt.t = this.prompt.time; return true; }
  answer(i) {
    const p = this.prompt; if (!p) return;
    const o = p.options[i]; if (!o) return;
    this.prompt = null;
    if (o.act) o.act();
  }

  get kmh() { return this.sim.v * 3.6; }
  rel(e) { return e.x - this.s.dist; }

  // ------------------------------------------------------------ eventi
  spawn() {
    const sim = this.sim, d = this.s.dist, r = this.rnd;
    const w = [
      ['traffic', 40], ['police', 16], ['station', sim.fuel < 0.35 ? 34 : sim.fuel < 0.6 ? 12 : 4],
      ['race', this.kmh > 15 && !this.job ? 14 : 0], ['job', !this.job ? 10 : 0],
    ];
    let k = r() * w.reduce((a, x) => a + x[1], 0), kind = 'traffic';
    for (const [n, p] of w) { if ((k -= p) < 0) { kind = n; break; } }
    if (kind === 'traffic') {
      const n = 1 + (r() < 0.35 ? 1 : 0);
      for (let i = 0; i < n; i++) this.ents.push({ id: this.id++, kind: 'traffic', lane: r() < 0.6 ? 1 : r() < 0.7 ? 2 : 3, x: d + 230 + r() * 160 + i * 45, v: 18 + r() * 11, color: GAME_COLORS[Math.floor(r() * GAME_COLORS.length)] });
    } else if (kind === 'police') {
      const parked = r() < 0.6;
      this.ents.push({ id: this.id++, kind: 'police', lane: parked ? 0 : 2, x: d + (parked ? 380 : 260), v: parked ? 0 : 24 + r() * 4 });
    } else if (kind === 'station') {
      if (!this.ents.some((e) => e.kind === 'station')) this.ents.push({ id: this.id++, kind: 'station', lane: 0, x: d + 760, v: 0 });
    } else if (kind === 'race') this.offerRace();
    else if (kind === 'job') this.offerJob();
  }

  offerRace() {
    const r = this.rnd, rv = GAME_RIVALS[Math.floor(r() * GAME_RIVALS.length)];
    const stake = Math.round((200 + r() * 300 + this.s.rep * 6) / 50) * 50;
    this.ask({
      kind: 'race', title: 'Sfida al semaforo',
      text: `${rv.name} su ${rv.car} si affianca e dà due colpi di gas. 400 metri da fermo, posta € ${stake}.`,
      options: [
        { label: 'Accetto', act: () => this.startRace(rv, stake) },
        { label: 'Lascia stare', act: () => this.say(`${rv.name} se ne va ridendo.`) },
      ],
    });
  }

  offerJob() {
    const r = this.rnd, km = 2 + Math.round(r() * 30) / 10, pay = Math.round((90 + km * 45 + r() * 60) / 10) * 10;
    const goods = [['un pacco per un\'officina', 8], ['dei cerchi in lega', 36], ['una centralina riprogrammata', 3], ['dei pezzi di ricambio', 22], ['una cassa di olio motore', 28]];
    const [what, kg] = goods[Math.floor(r() * goods.length)];
    if (!this.trunkFits(kg)) { this.say(`Un lavoretto da ${kg} kg, ma il bagagliaio non ce la fa`, 'job'); return; }
    this.ask({
      kind: 'job', title: 'Lavoretto',
      text: `Porta ${what} (${kg} kg nel bagagliaio) a ${km.toLocaleString('it-IT')} km da qui. Paga € ${pay}, + 30% se arrivi entro ${Math.ceil(km / 0.95)} minuti.`,
      options: [
        { label: 'Lo faccio', act: () => {
          const to = this.s.dist + km * 1000;
          this.job = { to, pay, km, deadline: km / 0.95 * 60, t: 0 };
          this.addItem('pacco', { kg, name: what.replace(/^(un |una |dei |delle )/, '').replace(/^./, (c) => c.toUpperCase()) });
          this.ents.push({ id: this.id++, kind: 'drop', lane: 1, x: to, v: 0 });
          this.say(`Consegna accettata: ${km.toLocaleString('it-IT')} km`, 'job');
        } },
        { label: 'No grazie' },
      ],
    });
  }

  // tempo previsto sui 400 m con la formula di Hale (+ partenza da strada)
  etEstimate() {
    const cv = this.sim.estimatePeak().cv;
    return 5.825 * Math.pow((this.sim.P.mass + 75) * 2.2046 / (cv * 0.986), 1 / 3) + 0.45 + Math.max(0, 0.35 - (this.sim.P.mu - 1.1));
  }
  ladderRival() {
    let i = this.s.ladder || 0;
    for (const z of GAME_LADDER) { if (i < z.rivals.length) return { zone: z.zone, ...z.rivals[i] }; i -= z.rivals.length; }
    return null;
  }
  // zona verde dei giri in partenza: più boost da costruire, più alta; più grip, più alta
  launchZone() {
    const tc = this.sim.tune.turbo, mid = (tc.twin ? 3600 : 3600 + (tc.a - 2800) * 0.6) + (this.sim.P.mu - 1.1) * 1800;
    return { lo: Math.round(mid - 450), hi: Math.round(mid + 450) };
  }
  startLadder() {
    const rv = this.ladderRival(); if (!rv || this.race) return false;
    this.startRace(rv, 0, { et: rv.et, prize: rv.prize, ladder: this.s.ladder });
    return true;
  }

  startRace(rv, stake, opt = {}) {
    this.ents = this.ents.filter((e) => e.kind === 'station' || e.kind === 'drop' || this.rel(e) < -20);
    this.prompt = null;
    const et = opt.et || this.etEstimate() * (1.0 + this.rnd() * 0.09 - Math.min(0.05, this.s.rep * 0.0005));
    this.race = { rv, stake, et, phase: 'stage', t: 0, prize: opt.prize || 0, ladder: opt.ladder, zone: this.launchZone(), shifts: [], hitLim: false };
    this.lane = 1;
    this.stopAt(null, () => {
      this.race.phase = 'count'; this.race.t = 3.6;
      this.race.x0 = this.s.dist;
      this.ap = null;
      this.ents.push({ id: this.id++, kind: 'rival', lane: 2, x: this.s.dist, v: 0, color: GAME_COLORS[Math.floor(this.rnd() * GAME_COLORS.length)] });
      this.ents.push({ id: this.id++, kind: 'line', lane: 1, x: this.s.dist + 2.6, v: 0 });
      this.ents.push({ id: this.id++, kind: 'line', lane: 1, x: this.s.dist + 402.3 + 2.6, v: 0, finish: true });
      this.say('Prima marcia. Tieni il freno, gas su, parti al verde.', 'race');
    });
    this.say(`Sfida accettata contro ${rv.name}: accosta al semaforo`, 'race');
  }

  busted(e) {
    const kmh = this.kmh;
    const fine = Math.round((160 + Math.max(0, kmh - 90) * 6) * (1 + this.s.heat * 0.3) / 10) * 10;
    e.chase = true; e.lane = this.lane; e.x = Math.min(e.x, this.s.dist - 40);
    this.siren = 1;
    this.say(`Polizia! Fermato in sesta a ${Math.round(kmh)} km/h`, 'police');
    this.stopAt(null, () => {
      this.ask({
        kind: 'police', title: 'Posto di blocco', time: 12,
        text: `Patente e libretto. Sesta marcia a ${Math.round(kmh)} km/h in città: multa di € ${fine}.`,
        options: [{ label: `Paga € ${fine}`, act: () => this.payFine(e, fine) }],
        onTimeout: () => this.payFine(e, fine),
      });
    });
  }
  payFine(e, fine) {
    this.s.money -= fine; this.s.fines += fine; this.s.heat = Math.min(5, this.s.heat + 1);
    e.chase = false; e.v = 0; e.lane = 0; this.siren = 0; this.ap = null;
    this.say(`Multa pagata: − € ${fine}`, 'police');
  }

  // fermata guidata dal gioco; atX = posizione assoluta o null (prima possibile)
  stopAt(atX, onStop) { this.ap = { atX, onStop, stopped: false, t: 0 }; }

  // il gioco può prendere il controllo dei pedali (fermate, rifornimento)
  control(inp, dt) {
    const out = { thr: inp.thr, brake: inp.brake, auto: false };
    const ap = this.ap;
    if (ap) {
      out.auto = true; out.thr = 0;
      const v = Math.max(0, this.sim.v);
      if (!ap.stopped) {
        const rel = ap.atX === null ? 0 : ap.atX - this.s.dist;
        if (ap.atX === null) out.brake = Math.min(1, 6 / 10.3 * 1.5 + 0.05);
        else {
          // velocità obiettivo: avvicinamento a ~50 km/h, poi frenata a 3 m/s² fino alla pompa
          const vt = Math.min(Math.max(v, 14), Math.sqrt(2 * 3 * Math.max(rel, 0)));
          const need = v * v / (2 * Math.max(rel, 0.8));
          out.brake = v > vt + 0.4 ? Math.min(1, need / 10.3 * 1.4 + (v - vt) * 0.05) : 0;
          if (v < vt - 1 && rel > 4) out.thr = Math.min(0.5, 0.08 + (vt - v) * 0.1);
        }
        if (v < 0.25 && (ap.atX === null || rel < 6)) {
          ap.stopped = true;
          if (this.sim.gear > 1 && this.sim.cfg.autoClutch) this.sim.shift(1);
          if (ap.onStop) ap.onStop();
        }
      } else { out.brake = 1; ap.t += dt; if (ap.tick) ap.tick(dt); }
    }
    if (this.race && this.race.phase === 'count') out.auto = false;
    return out;
  }

  update(dt) {
    const sim = this.sim, d0 = this.s.dist;
    if (sim.v > 0) this.s.dist += sim.v * dt;
    const d = this.s.dist;
    if (this.prompt) {
      this.prompt.t -= dt;
      if (this.prompt.t <= 0) {          // senza risposta vale l'ultima opzione (di solito "no")
        const p = this.prompt; this.prompt = null;
        if (p.onTimeout) p.onTimeout(); else { const o = p.options[p.options.length - 1]; if (o.act) o.act(); }
      }
    }
    this.s.heat = Math.max(0, this.s.heat - dt * 0.004);

    if (this.mode === 'career' && sim.running && !this.race && !this.ap && d > this.nextSpawn) {
      this.spawn(); this.nextSpawn = d + 220 + this.rnd() * 380;
    }
    if (this.mode === 'career' && sim.dry && Math.abs(sim.v) < 0.5 && !this.prompt && !this.ap) {
      this.ask({
        kind: 'fuel', title: 'A secco', time: 30,
        text: 'Il serbatoio è vuoto. Il carro attrezzi ti porta 10 litri per € 120.',
        options: [{ label: 'Chiama il soccorso', act: () => { this.s.money -= 120; sim.fuel = Math.min(1, sim.fuel + 10 / sim.P.tank); sim.dry = false; this.say('10 litri nel serbatoio. Riavvia il motore.', 'fuel'); } }],
        onTimeout: () => {},
      });
    }

    // entità
    for (const e of this.ents) {
      if (e.chase) { e.x += (d - 9 - e.x) * Math.min(1, dt * 1.6) + sim.v * dt; e.lane = this.lane; continue; }
      e.x += (e.v || 0) * dt;
      const rel = e.x - d;
      if (e.kind === 'police' && !e.checked && rel < 3 && rel > -8 && this.mode === 'career') {
        e.checked = true;
        if (sim.gear === 6 && sim.v > 4 && !this.ap) this.busted(e);
      }
      if (e.kind === 'station' && !e.asked && rel < 620 && rel > 120) {
        e.asked = true;
        const missing = Math.max(0, (1 - sim.fuel) * sim.P.tank), full = Math.ceil(missing * GAME_FUEL_PRICE);
        this.ask({
          kind: 'station', title: 'Distributore tra 600 m',
          text: `Nel serbatoio hai ${Math.round(sim.fuel * sim.P.tank)} litri su ${sim.P.tank}. Benzina a € ${GAME_FUEL_PRICE.toLocaleString('it-IT')} al litro.`,
          options: [
            { label: `Pieno · € ${full}`, act: () => this.planFuel(e, missing) },
            { label: '€ 20 di benzina', act: () => this.planFuel(e, 20 / GAME_FUEL_PRICE) },
            { label: 'Tiro dritto' },
          ],
        });
      }
      if (e.kind === 'drop' && this.job && rel <= 0) {
        const j = this.job, bonus = j.t <= j.deadline ? Math.round(j.pay * 0.3) : 0;
        this.s.money += j.pay + bonus; this.s.jobs++; this.s.rep += 3;
        this.say(`Consegna fatta: + € ${j.pay}${bonus ? ` e € ${bonus} di bonus puntualità` : ''}`, 'money');
        this.job = null; e.done = true;
        const pi = this.s.trunk.findIndex((it) => it.kind === 'pacco'); if (pi >= 0) { this.s.trunk.splice(pi, 1); this.applyMass(); }
      }
    }
    if (this.job) this.job.t += dt;
    this.ents = this.ents.filter((e) => !e.done && (e.chase || e.kind === 'drop' || (e.x - d > -220 && e.x - d < 1500)));

    // sorpasso automatico: resta a destra, sposta a sinistra solo se c'è qualcuno più lento davanti
    const ahead = (lane, from, to) => this.ents.some((e) => (e.kind === 'traffic' || (e.kind === 'police' && e.v > 0)) && e.lane === lane && e.x - d > from && e.x - d < to);
    this.laneT = Math.max(0, this.laneT - dt);
    this.manualT = Math.max(0, this.manualT - dt);
    this.blocked = false;
    if (!this.race && !this.ap && this.autoLane && this.manualT === 0) {
      const look = 18 + sim.v * 1.6, L = this.lane;
      const slower = this.ents.some((e) => e.kind === 'traffic' && e.lane === L && e.x - d > -5 && e.x - d < look && e.v < sim.v - 0.3);
      if (slower && L < 3 && !ahead(L + 1, -10, 25)) { this.lane = L + 1; this.laneT = 1.2; }
      else if (!slower && L > 1 && this.laneT === 0 && !ahead(L - 1, -14, 22 + sim.v * 0.8)) this.lane = L - 1;
      // nessuno spazio: rallenta dietro (frenata dolce)
      this.blocked = slower && (L === 3 || ahead(L + 1, -10, 25)) && this.ents.some((e) => e.kind === 'traffic' && e.lane === L && e.x - d > 0 && e.x - d < 14 + sim.v * 0.6);
    }
    // tamponamenti: stessa corsia, muso contro coda
    if (!this.race) for (const e of this.ents) {
      if (!(e.kind === 'traffic' || (e.kind === 'police' && e.v > 0 && !e.chase))) continue;
      const rel = e.x - d;
      if (rel > 0.5 && rel < 4.5 && Math.abs(this.laneZ - GAME_LANE_Z[e.lane]) < 1.7 && sim.v > e.v + 1) this.crash(e);
    }
    // frecce: lampeggiano qualche secondo quando cambia la corsia scelta
    if (this.prevLane !== undefined && this.lane !== this.prevLane) this.signal = { dir: this.lane > this.prevLane ? 'L' : 'R', t: 2.6 };
    this.prevLane = this.lane;
    if (this.signal) { this.signal.t -= dt; if (this.signal.t <= 0) this.signal = null; }
    // sterzo libero: velocità laterale che cresce con la velocità, nessuno scatto tra le corsie
    const freeOK = !this.race && !this.ap && sim.v > 0.3;
    if (freeOK && Math.abs(this.steerIn) > 0.05) {
      this.free = true; this.manualT = this.autoLane ? 5 : 1e9;
      // più reattivo: la velocità laterale arriva quasi subito e cresce con la velocità dell'auto
      const vmax = 1.6 + Math.min(4.6, sim.v * 0.17);
      this.latV += (-this.steerIn * vmax - this.latV) * Math.min(1, dt * 11);
    } else this.latV += (0 - this.latV) * Math.min(1, dt * 12);
    if (!freeOK || (this.manualT === 0 && Math.abs(this.steerIn) <= 0.05)) this.free = false;
    if (this.free) {
      this.laneZ = Math.max(GAME_LANE_Z[3] - 1.4, Math.min(GAME_LANE_Z[1] + 1.4, this.laneZ + this.latV * dt));
      if (this.laneZ === GAME_LANE_Z[3] - 1.4 || this.laneZ === GAME_LANE_Z[1] + 1.4) this.latV = 0;   // cordolo
      let best = 1; for (const l of [2, 3]) if (Math.abs(GAME_LANE_Z[l] - this.laneZ) < Math.abs(GAME_LANE_Z[best] - this.laneZ)) best = l;
      this.lane = best; this.prevLane = best;
    } else {
      this.latV = 0;
      const zT = GAME_LANE_Z[this.lane];
      this.laneZ += Math.sign(zT - this.laneZ) * Math.min(Math.abs(zT - this.laneZ), dt * (sim.v > 1 ? 1.6 + Math.min(1.2, sim.v * 0.03) : 0.6));
    }

    this.updateRace(dt, d0);
  }

  planFuel(e, liters) {
    liters = Math.max(0, Math.min(liters, (1 - this.sim.fuel) * this.sim.P.tank));
    this.lane = 1;
    this.stopAt(e.x, null);
    const ap = this.ap; let got = 0;
    ap.onStop = () => this.say('Pompa n. 3, sblocca il tappo…', 'fuel');
    ap.tick = (dt) => {
      if (ap.t < 1) return;
      const step = Math.min(liters - got, dt * 9);
      got += step; this.sim.fuel = Math.min(1, this.sim.fuel + step / this.sim.P.tank);
      if (got >= liters - 1e-6) {
        const cost = Math.round(got * GAME_FUEL_PRICE);
        this.s.money -= cost; this.ap = null; this.sim.dry = false;
        this.say(`Rifornimento: ${Math.round(got)} litri, − € ${cost}`, 'fuel');
      }
    };
  }

  updateRace(dt) {
    const R = this.race; if (!R) return;
    const d = this.s.dist, rival = this.ents.find((e) => e.kind === 'rival');
    if (R.phase === 'count') {
      R.t -= dt;
      if (d - R.x0 > 1.0) { this.endRace(false, 'Falsa partenza!'); return; }
      if (R.t <= 0) {
        R.phase = 'run'; R.tt = 0;
        const rpm = this.sim.rpm, z = R.zone;
        R.launchRpm = rpm;
        R.launch = rpm >= z.lo && rpm <= z.hi ? 'perfetta' : rpm >= z.lo - 700 && rpm <= z.hi + 700 ? 'buona' : rpm < z.lo ? 'fiacca' : 'pattinata';
      }
    } else if (R.phase === 'run') {
      R.tt += dt;
      const released = this.sim.cfg.autoClutch ? this.sim.in.brake < 0.25 : this.sim.in.clutch < 0.6;
      if (R.react === undefined && released) R.react = R.tt;
      if (this.sim.cut === 2 && this.sim.clutch < 0.3 && R.tt > 0.3) R.hitLim = true;   // limitatore a frizione chiusa
      R.vmax = Math.max(R.vmax || 0, this.kmh);
      if (rival) {
        const k = R.tt / R.et;
        rival.x = R.x0 + (k <= 1 ? 402.3 * Math.pow(k, 1.75) : 402.3 + 402.3 * 1.75 / R.et * (R.tt - R.et));
      }
      if (d - R.x0 >= 402.3) { R.you = R.tt; this.endRace(R.tt < R.et); }
      else if (R.tt > R.et + 12) this.endRace(false);
    }
  }
  // valuta una cambiata durante la gara; la perfetta rende il cambio più rapido
  gradeShift() {
    const R = this.race; if (!R || R.phase !== 'run') return null;
    const rpm = this.sim.rpm, lim = this.sim.P.limiter;
    const g = R.hitLim || rpm > lim - 30 ? 'tardi' : rpm >= lim - 420 ? 'perfetta' : rpm >= lim - 1000 ? 'buona' : 'anticipata';
    R.shifts.push(g); R.hitLim = false;
    this.sim.fastShift = g === 'perfetta';
    return g;
  }

  endRace(win, why) {
    const R = this.race; this.race = null;
    const ladder = R.ladder !== undefined;
    const gain = win ? (ladder ? R.prize : R.stake) : (ladder ? 0 : -R.stake);
    if (this.mode === 'career') this.s.money += gain;
    if (win) { this.s.rep += ladder ? 15 : 10; this.s.wins++; } else this.s.losses++;
    if (win && ladder && R.ladder === this.s.ladder) this.s.ladder++;
    if (win && R.rv.boss) { if (this.addItem('trofeo', { name: `Trofeo: ${R.rv.name}` })) this.say(`Trofeo di ${R.rv.name} nel bagagliaio`, 'money'); }
    this.say(win ? `Vinto contro ${R.rv.name}: ${R.you.toFixed(3)} s contro ${R.et.toFixed(3)}` : `${why || 'Perso'} contro ${R.rv.name}`, win ? 'money' : 'lose');
    this.result = {
      win, why, rv: R.rv, you: R.you, et: R.et, gain, ladder, react: R.react, launch: R.launch, launchRpm: R.launchRpm,
      shifts: R.shifts, vmax: R.vmax, boss: !!R.rv.boss, zoneDone: win && ladder && R.rv.boss,
    };
    this.lastRace = { win, you: R.you, et: R.et, rv: R.rv };
    this.ents.forEach((e) => { if (e.kind === 'rival') e.v = win ? 18 : 40; });
  }

  // polizia più vicina davanti (per l'avviso radar)
  radar() {
    const d = this.s.dist;
    let best = null;
    for (const e of this.ents) if (e.kind === 'police' && !e.chase && e.x - d > 0 && e.x - d < 450 && (!best || e.x < best.x)) best = e;
    return best ? best.x - d : null;
  }
}
