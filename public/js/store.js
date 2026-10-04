// Due archivi con la stessa interfaccia:
// - LocalStore: demo nel browser. NON è condiviso fra dispositivi; due schede dello stesso browser
//   si comportano come due dispositivi (conflitti di revisione reali).
// - RemoteStore: server reale (server/server.js), fonte unica per PC e telefono.
import { applyOp, reconcile, romeDate, uid, DomainError, exportBackup } from './core.js';
import { buildDemoState, DEMO_USERS } from './seed.js';

const DAY = 86400000;

function safeGet(storage, key) {
  try { return storage.getItem(key); } catch { return null; }
}
function safeSet(storage, key, value) {
  try { storage.setItem(key, value); return true; } catch { return false; }
}
function safeDel(storage, key) {
  try { storage.removeItem(key); } catch { /* niente */ }
}
const ls = () => { try { return window.localStorage; } catch { return null; } };
const ss = () => { try { return window.sessionStorage; } catch { return null; } };

class BaseStore {
  constructor() {
    this.listeners = new Set();
    this.status = { online: true, saving: false, lastSync: Date.now(), error: null };
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(kind = 'state') { for (const fn of this.listeners) fn(kind); }
  setStatus(patch) { Object.assign(this.status, patch); this.emit('status'); }
}

/* ------------------------------------------------------------------ */

export class LocalStore extends BaseStore {
  constructor() {
    super();
    this.mode = 'demo';
    this.key = 'magazzino-demo-v1';
    this.users = DEMO_USERS;
    this.sim = { offline: false, conflictNext: false };
    const off = Number(safeGet(ls(), this.key + ':offset'));
    this.offsetDays = Number.isFinite(off) ? off : 0;
    this.persistent = true;
    this.state = this.read() || this.seed();
    const uidSaved = safeGet(ss(), this.key + ':user') || safeGet(ls(), this.key + ':user');
    this.user = DEMO_USERS.find((u) => u.id === uidSaved) || null;
    addEventListener('storage', (e) => {
      if (e.key === this.key && e.newValue) {
        const next = this.read();
        if (next && next.rev !== this.state.rev) { this.state = next; this.status.lastSync = Date.now(); this.emit('remote'); }
      }
      if (e.key === this.key + ':offset') { this.offsetDays = Number(e.newValue) || 0; this.tick(); this.emit('clock'); }
    });
  }
  async init() { this.tick(); return { user: this.user }; }
  now() { return Date.now() + this.offsetDays * DAY; }
  today() { return romeDate(this.now()); }
  ctx() { return { user: this.user, now: this.now(), today: this.today() }; }
  read() {
    const raw = safeGet(ls(), this.key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }
  write() {
    if (!safeSet(ls(), this.key, JSON.stringify(this.state))) this.persistent = false;
  }
  seed() {
    const s = buildDemoState(this.now ? this.now() : Date.now());
    this.state = s;
    this.write();
    return s;
  }
  resetDemo() {
    this.offsetDays = 0;
    safeSet(ls(), this.key + ':offset', '0');
    this.state = buildDemoState(Date.now());
    this.write();
    this.emit('state');
  }
  login(userId) {
    this.user = DEMO_USERS.find((u) => u.id === userId) || null;
    safeSet(ss(), this.key + ':user', userId);
    safeSet(ls(), this.key + ':user', userId);
    this.emit('auth');
  }
  logout() {
    this.user = null;
    safeDel(ss(), this.key + ':user');
    safeDel(ls(), this.key + ':user');
    this.emit('auth');
  }
  /** Stime automatiche: all'apertura e ogni 30 secondi mentre la pagina è aperta. */
  tick() {
    const latest = this.read();
    if (latest && latest.rev > this.state.rev) this.state = latest;
    const next = reconcile(this.state, { ...this.ctx(), user: this.user || DEMO_USERS[0] });
    if (next) { this.state = next; this.write(); this.emit('state'); }
    this.status.lastSync = Date.now();
  }
  shiftDays(n) {
    this.offsetDays = n === 0 ? 0 : this.offsetDays + n;
    safeSet(ls(), this.key + ':offset', String(this.offsetDays));
    this.tick();
    this.emit('clock');
  }
  async dispatch(op) {
    const full = { ...op, opId: op.opId || uid('op') };
    this.setStatus({ saving: true });
    await new Promise((r) => setTimeout(r, 160));
    try {
      if (this.sim.offline) {
        this.setStatus({ online: false, error: 'Archivio irraggiungibile' });
        const err = new Error('Archivio irraggiungibile: operazione NON salvata. Controlla la connessione e riprova.');
        err.code = 'network';
        err.op = full;
        throw err;
      }
      // Rilegge l'archivio: un'altra scheda (altro "dispositivo") può aver salvato nel frattempo.
      const latest = this.read();
      if (latest && latest.rev > this.state.rev) this.state = latest;
      if (this.sim.conflictNext) {
        this.sim.conflictNext = false;
        this.simulateOtherDevice(full);
      }
      const r = applyOp(this.state, full, this.ctx());
      if (!r.duplicate) { this.state = r.state; this.write(); }
      this.status.online = true; this.status.error = null; this.status.lastSync = Date.now();
      this.emit('state');
      return r.result;
    } catch (e) {
      if (e instanceof DomainError && e.code === 'conflict') this.emit('state');
      throw e;
    } finally {
      this.setStatus({ saving: false });
    }
  }
  /** Strumento demo: un altro dispositivo modifica lo stesso elemento un attimo prima del salvataggio. */
  simulateOtherDevice(op) {
    const s = structuredClone(this.state);
    const pools = [['lotId', 'lots'], ['planId', 'plans'], ['noteId', 'notes'], ['orderId', 'orders'], ['eventId', 'events']];
    for (const [k, coll] of pools) {
      if (!op[k]) continue;
      const e = s[coll].find((x) => x.id === op[k]);
      if (!e) continue;
      e.rev += 1;
      e.updatedAt = this.now();
      e.updatedByName = 'Altro dispositivo (simulato)';
      s.audit.push({ id: uid('au'), at: this.now(), by: 'sim', byName: 'Altro dispositivo (simulato)', action: 'Modifica concorrente simulata', object: coll, objectId: e.id });
      s.rev += 1;
      this.state = s;
      this.write();
      return;
    }
  }
  exportJson() { return JSON.stringify(exportBackup(this.state, { exportedBy: this.user?.name, demo: true }), null, 2); }
}

/* ------------------------------------------------------------------ */

export class RemoteStore extends BaseStore {
  constructor() {
    super();
    this.mode = 'server';
    this.state = null;
    this.user = null;
    this.users = [];
    this.serverOffset = 0;
    this.persistent = true;
  }
  async api(method, path, body) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Magazzino': '1' },
        credentials: 'same-origin',
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      this.setStatus({ online: false, error: 'Server irraggiungibile' });
      const err = new Error('Server irraggiungibile: operazione NON salvata. Controlla la connessione e riprova.');
      err.code = 'network';
      throw err;
    }
    let data = {};
    try { data = await res.json(); } catch { /* risposta vuota */ }
    if (!this.status.online) this.setStatus({ online: true, error: null });
    if (!res.ok) {
      if (data.state) { this.state = data.state; this.emit('state'); }
      if (res.status === 401 && this.user) { this.user = null; this.emit('auth'); }
      throw new DomainError(data.code || 'validation', data.error || `Errore ${res.status}`, data.extra);
    }
    return data;
  }
  async init() {
    const s = await this.api('GET', '/api/session');
    this.user = s.user;
    this.needsSetup = s.needsSetup;
    if (this.user) await this.pull(true);
    if (!this.poller) this.poller = setInterval(() => this.user && this.pull().catch(() => {}), 5000);
    return s;
  }
  now() { return Date.now() + this.serverOffset; }
  today() { return romeDate(this.now()); }
  async pull(force = false) {
    const d = await this.api('GET', `/api/state${force || !this.state ? '' : `?since=${this.state.rev}`}`);
    if (d.serverTime) this.serverOffset = d.serverTime - Date.now();
    this.status.lastSync = Date.now();
    if (!d.unchanged) { this.state = d.state; this.emit('remote'); } else this.emit('status');
  }
  async dispatch(op) {
    const full = { ...op, opId: op.opId || uid('op') };
    this.setStatus({ saving: true });
    try {
      const d = await this.api('POST', '/api/op', { op: full });
      this.state = d.state;
      this.status.lastSync = Date.now();
      this.emit('state');
      return d.result;
    } catch (e) {
      if (e.code === 'network') e.op = full; // ripetibile con lo stesso opId: nessun doppio effetto
      throw e;
    } finally {
      this.setStatus({ saving: false });
    }
  }
  async login(username, password) { await this.api('POST', '/api/login', { username, password }); await this.init(); this.emit('auth'); }
  async setup(body) { await this.api('POST', '/api/setup', body); await this.init(); this.emit('auth'); }
  async register(body) { await this.api('POST', '/api/register', body); await this.init(); this.emit('auth'); }
  async logout() { await this.api('POST', '/api/logout').catch(() => {}); this.user = null; this.state = null; this.emit('auth'); }
  async listUsers() { return this.api('GET', '/api/users'); }
  async invite(role, name) { return this.api('POST', '/api/invites', { role, name }); }
  async updateUser(id, patch) { return this.api('POST', '/api/users/update', { id, ...patch }); }
  async changePassword(current, next) { return this.api('POST', '/api/password', { current, next }); }
  exportJson() { return JSON.stringify(exportBackup(this.state, { exportedBy: this.user?.name }), null, 2); }
}

/** Sceglie l'archivio: build artifact = demo; sul server si usa l'API se risponde. */
export async function createStore() {
  const forced = globalThis.__MAG_MODE;
  const wantsDemo = forced === 'demo' || /[?&]demo\b/.test(location.search);
  if (!wantsDemo) {
    try {
      const r = await fetch('/api/session', { headers: { 'X-Magazzino': '1' } });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
        const store = new RemoteStore();
        await store.init();
        return store;
      }
    } catch { /* nessun server: demo locale */ }
  }
  const store = new LocalStore();
  await store.init();
  return store;
}
