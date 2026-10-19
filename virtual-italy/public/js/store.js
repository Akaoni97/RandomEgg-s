// Due archivi con la stessa interfaccia:
// - RemoteStore: il server vero (server/server.js), una sola città per tutti.
// - LocalStore: demo nel browser. La città vive solo in questo browser e le email sono finte.
import { applyOp, emptyState, publicView, DomainError, checkEmail, checkPassword, checkUsername, usernameKey, residentHouse, friendsOf, uid, spawnPoint, walkPath, W, SEA_Y, checkSay, SAY_PRESETS } from './core.js';
import { seedResidents, DEMO_TAG } from './seed.js';

class Base {
  constructor() { this.listeners = new Set(); this.city = null; this.me = null; this.online = new Set(); this.avatars = {}; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(kind, data) { for (const fn of this.listeners) fn(kind, data); }
}

/* Server ------------------------------------------------------------------ */

export class RemoteStore extends Base {
  constructor() { super(); this.mode = 'server'; }

  async call(method, p, body) {
    let res;
    try {
      res = await fetch(p, { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-VI': '1' }, body: body ? JSON.stringify(body) : undefined });
    } catch {
      throw new DomainError('network', 'Connessione assente: controlla internet e riprova.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new DomainError(data.code || 'validation', data.error || 'Qualcosa non ha funzionato. Riprova.');
    return data;
  }

  async init() {
    const s = await this.call('GET', '/api/session');
    this.me = s.me;
    this.devMail = s.devMail;
    await this.refresh();
    this.listen();
  }
  async refresh() {
    const d = await this.call('GET', '/api/city');
    this.take(d);
  }
  take(d) {
    if (d.city) this.city = d.city;
    if (d.online) this.online = new Set(d.online);
    if (d.avatars) this.avatars = d.avatars;
    this.emit('city');
  }
  listen() {
    this.es?.close();
    this.es = new EventSource('/api/events');
    this.es.addEventListener('city', (e) => {
      const d = JSON.parse(e.data);
      this.online = new Set(d.online);
      if (!this.city || d.rev !== this.city.rev) this.refresh().catch(() => {});
      else this.emit('online');
    });
    this.es.addEventListener('say', (e) => this.emit('say', JSON.parse(e.data)));
    this.es.addEventListener('move', (e) => {
      const d = JSON.parse(e.data);
      this.avatars[d.id] = [d.x, d.y];
      this.emit('move', d);
    });
  }
  async afterAuth(d) {
    this.me = d.me ?? (await this.call('GET', '/api/session')).me;
    await this.refresh();
    this.listen();
    this.emit('me');
  }

  async register(form) { const d = await this.call('POST', '/api/register', form); await this.afterAuth(d); return d; }
  async confirm(token) { const d = await this.call('POST', '/api/confirm', { token }); await this.afterAuth(d); return d; }
  resend() { return this.call('POST', '/api/resend'); }
  async login(login, password) { const d = await this.call('POST', '/api/login', { login, password }); await this.afterAuth(d); return d; }
  async logout() { await this.call('POST', '/api/logout'); this.me = null; await this.refresh(); this.listen(); this.emit('me'); }
  requestReset(email) { return this.call('POST', '/api/reset/request', { email }); }
  async resetPassword(token, password) { const d = await this.call('POST', '/api/reset', { token, password }); await this.afterAuth({}); return d; }
  async op(op) { const d = await this.call('POST', '/api/op', { op }); this.take(d); return d.result; }
  exportData() { return this.call('GET', '/api/me/export'); }
  async deleteAccount(password) { await this.call('POST', '/api/me/delete', { password }); this.me = null; await this.refresh(); this.emit('me'); }
  admin() { return this.call('GET', '/api/admin'); }
  // Il proprio omino: si muove subito qui, il server lo racconta agli altri.
  move(x, y) {
    if (!this.me) return;
    this.avatars[this.me.id] = [x, y];
    this.emit('move', { id: this.me.id, x, y });
    this.call('POST', '/api/move', { x, y }).catch(() => {});
  }
  say(text) { checkSay(text); return this.call('POST', '/api/say', { text }); }
}

/* Demo nel browser ---------------------------------------------------------- */

const KEY = 'virtual-italy-demo-v1';
const localBox = () => { try { return window.localStorage; } catch { return null; } };
function load() { try { return JSON.parse(localBox()?.getItem(KEY) || 'null'); } catch { return null; } }
function save(v) { try { localBox()?.setItem(KEY, JSON.stringify(v)); } catch { /* demo senza memoria */ } }

export class LocalStore extends Base {
  constructor() { super(); this.mode = 'demo'; this.devMail = true; }

  async init() {
    const saved = load();
    this.db = saved?.version === 1 ? saved : this.fresh();
    this.me = this.db.session ? this.meView(this.db.session) : null;
    this.publish();
    // Qualche abitante finto entra ed esce, per vedere le finestre accese di sera, e passeggia.
    this.timer = setInterval(() => this.shuffleOnline(), 15000);
    this.walker = setInterval(() => this.wander(), 2200);
  }
  fresh() {
    const now = Date.now();
    return { version: 1, state: seedResidents(emptyState(now - 6 * 86400000), 14, now), accounts: {}, tokens: {}, session: null, inbox: [] };
  }
  persist() { save(this.db); }
  meView(id) {
    const a = this.db.accounts[id];
    if (!a) return null;
    return { id, email: a.email, username: this.db.state.residents[id]?.username, emailConfirmed: a.confirmed, admin: true };
  }
  shuffleOnline() {
    const ids = Object.keys(this.db.state.residents).filter((id) => id.startsWith(DEMO_TAG));
    this.online = new Set(ids.filter((id, i) => (i * 7 + Math.floor(Date.now() / 15000)) % 3 === 0));
    if (this.me) this.online.add(this.me.id);
    for (const id of this.online) if (!this.avatars[id]) this.avatars[id] = spawnPoint(this.db.state, id);
    for (const id of Object.keys(this.avatars)) if (!this.online.has(id)) delete this.avatars[id];
    this.emit('online');
  }
  publish() {
    this.city = publicView(this.db.state, this.me?.id, true);
    if (!this.online.size) this.shuffleOnline();
    this.emit('city');
  }
  apply(op, ctx) {
    const r = applyOp(this.db.state, op, { now: Date.now(), ...ctx });
    this.db.state = r.state;
    this.persist();
    this.publish();
    return r.result;
  }
  mail(to, subject, body, action) {
    this.db.inbox.unshift({ id: uid('m'), to, subject, body, action, at: Date.now() });
    this.db.inbox.length = Math.min(this.db.inbox.length, 30);
  }

  async register(f) {
    if (f.website || Number(f.elapsed) < 2500) throw new DomainError('validation', 'Non siamo riusciti a completare l\'iscrizione: riprova tra qualche secondo.');
    const email = checkEmail(f.email);
    const username = checkUsername(f.username);
    checkPassword(f.password);
    if (!f.accept) throw new DomainError('validation', 'Per iscriverti devi accettare il regolamento e l\'informativa privacy.');
    if (!f.adult) throw new DomainError('validation', 'Per iscriverti devi avere almeno 14 anni.');
    if (Object.values(this.db.accounts).some((a) => a.email === email)) throw new DomainError('validation', 'Esiste già un abitante con questa email: prova ad accedere.');
    const id = 'u_' + uid('');
    this.apply({ type: 'join', id, username }, { system: true });
    this.db.accounts[id] = { email, password: f.password, confirmed: false, source: f.source || 'diretto', createdAt: Date.now() };
    const token = uid('t');
    this.db.tokens[token] = { id, kind: 'confirm' };
    this.mail(email, 'Conferma la tua casa a Virtual-Italy', `Ciao ${username}, per finire la tua casa conferma l'indirizzo email entro 24 ore.`, { kind: 'confirm', token });
    this.db.session = id;
    this.me = this.meView(id);
    this.persist();
    this.publish();
    this.emit('me');
    return { ok: true, devToken: token };
  }
  async confirm(token) {
    const t = this.db.tokens[token];
    if (!t || t.kind !== 'confirm') throw new DomainError('validation', 'Il link di conferma non è valido o è già stato usato.');
    delete this.db.tokens[token];
    this.db.accounts[t.id].confirmed = true;
    const r = this.apply({ type: 'confirm', id: t.id }, { system: true });
    this.db.session = t.id;
    this.me = this.meView(t.id);
    this.persist();
    this.emit('me');
    return { ok: true, number: r.number };
  }
  async resend() {
    const id = this.me?.id;
    const token = uid('t');
    this.db.tokens[token] = { id, kind: 'confirm' };
    this.mail(this.me.email, 'Conferma la tua casa a Virtual-Italy', 'Nuovo link di conferma.', { kind: 'confirm', token });
    this.persist();
    return { ok: true, devToken: token };
  }
  async login(login, password) {
    const l = String(login || '').trim().toLowerCase();
    const id = Object.keys(this.db.accounts).find((k) => this.db.accounts[k].email === l || usernameKey(this.db.state.residents[k]?.username || '') === l);
    if (!id || this.db.accounts[id].password !== password) throw new DomainError('auth', 'Email, nome utente o password errati.');
    this.db.session = id;
    this.me = this.meView(id);
    this.persist();
    this.publish();
    this.emit('me');
    return { ok: true };
  }
  async logout() { this.db.session = null; this.me = null; this.persist(); this.publish(); this.emit('me'); }
  async requestReset(email) {
    const id = Object.keys(this.db.accounts).find((k) => this.db.accounts[k].email === String(email).trim().toLowerCase());
    let token;
    if (id) {
      token = uid('t');
      this.db.tokens[token] = { id, kind: 'reset' };
      this.mail(this.db.accounts[id].email, 'Nuova password per Virtual-Italy', 'Apri il link per scegliere una nuova password.', { kind: 'reset', token });
      this.persist();
    }
    return { ok: true, devToken: token };
  }
  async resetPassword(token, password) {
    checkPassword(password);
    const t = this.db.tokens[token];
    if (!t || t.kind !== 'reset') throw new DomainError('validation', 'Il link non è valido o è scaduto: chiedine uno nuovo.');
    delete this.db.tokens[token];
    this.db.accounts[t.id].password = password;
    return this.login(this.db.accounts[t.id].email, password);
  }
  async op(op) {
    if (op.type === 'leave') throw new DomainError('validation', 'Per cancellare l\'account usa le impostazioni.');
    return this.apply(op, { user: { id: this.me?.id, admin: true } });
  }
  async exportData() {
    const id = this.me.id, a = this.db.accounts[id], s = this.db.state;
    return { esportatoIl: new Date().toISOString(), account: { email: a.email, nomeUtente: s.residents[id]?.username, provenienza: a.source },
      abitante: s.residents[id], casa: residentHouse(s, id), amici: friendsOf(s, id).map((x) => s.residents[x]?.username) };
  }
  async deleteAccount(password) {
    const id = this.me.id;
    if (this.db.accounts[id].password !== password) throw new DomainError('validation', 'La password non è corretta.');
    this.apply({ type: 'leave', id }, { system: true });
    delete this.db.accounts[id];
    this.db.session = null;
    this.me = null;
    this.persist();
    this.publish();
    this.emit('me');
  }
  async admin() {
    const sources = {};
    for (const a of Object.values(this.db.accounts)) {
      const s = (sources[a.source] ||= { source: a.source, n: 0, confirmed: 0 });
      s.n++; if (a.confirmed) s.confirmed++;
    }
    return { sources: Object.values(sources), outbox: this.db.inbox.map((m) => ({ to: m.to, subject: m.subject, body: m.body, at: m.at })), mailConfigured: false };
  }

  move(x, y) {
    if (!this.me) return;
    this.avatars[this.me.id] = [x, y];
    this.emit('move', { id: this.me.id, x, y });
  }
  async say(text) { checkSay(text); return { ok: true }; }
  // Gli abitanti finti in città fanno due passi qua e là, e ogni tanto salutano.
  wander() {
    if (Math.random() < 0.18) {
      const talkers = [...this.online].filter((x) => x.startsWith(DEMO_TAG) && this.avatars[x]);
      if (talkers.length) this.emit('say', { id: talkers[Math.floor(Math.random() * talkers.length)], text: SAY_PRESETS[Math.floor(Math.random() * SAY_PRESETS.length)] });
    }
    const s = this.db.state;
    const ids = [...this.online].filter((id) => id.startsWith(DEMO_TAG) && this.avatars[id]);
    if (!ids.length) return;
    const id = ids[Math.floor(Math.random() * ids.length)];
    const [x, y] = this.avatars[id];
    for (let i = 0; i < 12; i++) {
      const tx = Math.max(0, Math.min(W - 1, x + Math.round((Math.random() - 0.5) * 14)));
      const ty = Math.max(0, Math.min(SEA_Y, y + Math.round((Math.random() - 0.5) * 10)));
      const p = walkPath(s, [x, y], [tx, ty], 1500);
      if (p && p.length > 2 && p.length < 22) { this.avatars[id] = [tx, ty]; this.emit('move', { id, x: tx, y: ty }); return; }
    }
  }

  // Solo demo: la casella email finta, nuovi abitanti finti, ripartenza.
  inbox() { return this.db.inbox; }
  addResidents(n) {
    this.db.state = seedResidents(this.db.state, n, Date.now(), Date.now());
    this.persist();
    this.publish();
  }
  knock() {
    // Un vicino finto bussa alla porta dell'utente della demo.
    if (!this.me) return false;
    const s = this.db.state;
    const from = Object.keys(s.residents).find((id) => id.startsWith(DEMO_TAG) && !s.requests.some((q) => q.from === id) && !s.friendships.some((f) => f.a === id || f.b === id));
    if (!from) return false;
    this.apply({ type: 'friendRequest', to: this.me.id }, { user: { id: from } });
    return true;
  }
  reset() { this.db = this.fresh(); this.me = null; this.persist(); this.publish(); this.emit('me'); }
}
