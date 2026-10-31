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

class StreetGame {
  constructor(sim, rnd = Math.random) {
    this.sim = sim;
    this.rnd = rnd;
    this.mode = 'career';                 // 'career' | 'free'
    this.s = { money: 3000, rep: 0, heat: 0, dist: 0, owned: {}, wins: 0, losses: 0, fines: 0, jobs: 0 };
    this.ents = [];
    this.prompt = null;
    this.ap = null;                        // pilota automatico (fermate)
    this.race = null;
    this.job = null;
    this.out = [];                         // messaggi per l'interfaccia
    this.lane = 1; this.laneZ = GAME_LANE_Z[1]; this.laneT = 0;
    this.nextSpawn = 250; this.id = 1;
    this.siren = 0;
  }

  // ------------------------------------------------------------ salvataggio
  save() { return JSON.stringify({ mode: this.mode, s: this.s }); }
  load(json) {
    try { const o = JSON.parse(json); if (o && o.s) { Object.assign(this.s, o.s); this.mode = o.mode === 'free' ? 'free' : 'career'; } } catch (e) { /* salvataggio illeggibile */ }
  }
  reset() { const m = this.mode; Object.assign(this, new StreetGame(this.sim, this.rnd)); this.mode = m; }

  // ------------------------------------------------------------ officina
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
      for (let i = 0; i < n; i++) this.ents.push({ id: this.id++, kind: 'traffic', lane: r() < 0.75 ? 1 : 2, x: d + 230 + r() * 160 + i * 45, v: 18 + r() * 11, color: GAME_COLORS[Math.floor(r() * GAME_COLORS.length)] });
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
    const what = ['un pacco per un\'officina', 'dei cerchi in lega', 'una centralina riprogrammata', 'dei pezzi di ricambio', 'una cassa di olio motore'][Math.floor(r() * 5)];
    this.ask({
      kind: 'job', title: 'Lavoretto',
      text: `Porta ${what} a ${km.toLocaleString('it-IT')} km da qui. Paga € ${pay}, + 30% se arrivi entro ${Math.ceil(km / 0.95)} minuti.`,
      options: [
        { label: 'Lo faccio', act: () => {
          const to = this.s.dist + km * 1000;
          this.job = { to, pay, km, deadline: km / 0.95 * 60, t: 0 };
          this.ents.push({ id: this.id++, kind: 'drop', lane: 1, x: to, v: 0 });
          this.say(`Consegna accettata: ${km.toLocaleString('it-IT')} km`, 'job');
        } },
        { label: 'No grazie' },
      ],
    });
  }

  startRace(rv, stake) {
    this.ents = this.ents.filter((e) => e.kind === 'station' || e.kind === 'drop' || this.rel(e) < -20);
    const cv = this.sim.estimatePeak().cv;
    // tempo previsto con la formula di Hale, poi un rivale alla pari
    const etYou = 5.825 * Math.pow((this.sim.P.mass + 75) * 2.2046 / (cv * 0.986), 1 / 3) + 0.45;
    const et = etYou * (1.0 + this.rnd() * 0.09 - Math.min(0.05, this.s.rep * 0.0005));
    this.race = { rv, stake, et, phase: 'stage', t: 0 };
    this.lane = 1;
    this.stopAt(null, () => {
      this.race.phase = 'count'; this.race.t = 3.2;
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
      }
    }
    if (this.job) this.job.t += dt;
    this.ents = this.ents.filter((e) => !e.done && (e.chase || e.kind === 'drop' || (e.x - d > -220 && e.x - d < 1500)));

    // sorpasso automatico: sempre in prima corsia, a sinistra solo se c'è qualcuno davanti
    const ahead = (lane, from, to) => this.ents.some((e) => (e.kind === 'traffic' || (e.kind === 'police' && e.v > 0)) && e.lane === lane && e.x - d > from && e.x - d < to);
    this.laneT = Math.max(0, this.laneT - dt);
    if (!this.race && !this.ap) {
      const look = 18 + sim.v * 1.6;
      const slower = this.ents.some((e) => e.kind === 'traffic' && e.lane === 1 && e.x - d > -5 && e.x - d < look && e.v < sim.v - 0.3);
      if (this.lane === 1 && slower && !ahead(2, -10, 25)) { this.lane = 2; this.laneT = 1.2; }
      else if (this.lane === 2 && this.laneT === 0 && !ahead(1, -14, 22 + sim.v * 0.8)) this.lane = 1;
      // nessuno spazio: rallenta dietro (frenata dolce)
      this.blocked = this.lane === 1 && slower && ahead(2, -10, 25) && this.ents.some((e) => e.kind === 'traffic' && e.lane === 1 && e.x - d > 0 && e.x - d < 14 + sim.v * 0.6);
    } else this.blocked = false;
    const zT = GAME_LANE_Z[this.lane];
    this.laneZ += Math.sign(zT - this.laneZ) * Math.min(Math.abs(zT - this.laneZ), dt * (1.2 + sim.v * 0.08));

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
      if (R.t <= 0) { R.phase = 'run'; R.tt = 0; this.say('VIA!', 'race'); }
    } else if (R.phase === 'run') {
      R.tt += dt;
      if (rival) {
        const k = R.tt / R.et;
        rival.x = R.x0 + (k <= 1 ? 402.3 * Math.pow(k, 1.75) : 402.3 + 402.3 * 1.75 / R.et * (R.tt - R.et));
      }
      if (d - R.x0 >= 402.3) { R.you = R.tt; this.endRace(R.tt < R.et); }
      else if (R.tt > R.et + 12) this.endRace(false);
    }
  }
  endRace(win, why) {
    const R = this.race; this.race = null;
    if (win) { this.s.money += R.stake; this.s.rep += 10; this.s.wins++; this.say(`Vinto contro ${R.rv.name}: ${R.you.toFixed(2)} s contro ${R.et.toFixed(2)}. + € ${R.stake}`, 'money'); }
    else { this.s.money -= R.stake; this.s.losses++; this.say(`${why || 'Perso'} ${R.rv.name} in ${R.et.toFixed(2)} s${R.you ? `, tu ${R.you.toFixed(2)}` : ''}. − € ${R.stake}`, 'lose'); }
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
