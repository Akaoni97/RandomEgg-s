// Server del magazzino: archivio condiviso SQLite, account personali con invito,
// sessioni in cookie HttpOnly, revisioni per i conflitti e operazioni idempotenti.
// Nessuna dipendenza esterna: richiede Node.js 22.5 o successivo.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { applyOp, reconcile, emptyState, romeDate, exportBackup, DomainError, ROLES, SYSTEM_USER } from '../public/js/core.js';
import { buildDemoState } from '../public/js/seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const SECURE_COOKIE = process.env.COOKIE_SECURE === '1';
const SESSION_DAYS = 30;

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'magazzino.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, rev INTEGER NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL,
    salt TEXT NOT NULL, hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS invites (code_hash TEXT PRIMARY KEY, role TEXT NOT NULL, name TEXT, created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_by TEXT);
`);

/* Stato condiviso ---------------------------------------------------- */

let state;
{
  const row = db.prepare('SELECT json FROM store WHERE id = 1').get();
  if (row) state = JSON.parse(row.json);
  else {
    state = process.env.DEMO_DATA === '1' ? buildDemoState() : emptyState();
    state.meta.createdAt = Date.now();
    db.prepare('INSERT INTO store (id, json, rev, updated_at) VALUES (1, ?, ?, ?)').run(JSON.stringify(state), state.rev, Date.now());
    console.log(process.env.DEMO_DATA === '1' ? 'Archivio creato con dati DEMO.' : 'Archivio vuoto creato.');
  }
}

function ctxFor(user) {
  const now = Date.now();
  return { user, now, today: romeDate(now) };
}

function persist(next) {
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE store SET json = ?, rev = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(next), next.rev, Date.now());
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  state = next;
}

function runReconcile() {
  const next = reconcile(state, ctxFor(SYSTEM_USER));
  if (next) persist(next);
}

function publicState() {
  const { meta, ...rest } = state;
  return { ...rest, meta: { createdAt: meta.createdAt } };
}

// Le stime automatiche maturano anche a sito chiuso, finché questo processo è in esecuzione.
runReconcile();
setInterval(runReconcile, Math.max(10, state.settings.reconcileSeconds || 30) * 1000).unref();

/* Account ------------------------------------------------------------ */

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function verifyPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}
function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 8) throw new DomainError('validation', 'La password deve avere almeno 8 caratteri.');
}
function checkUsername(u) {
  if (typeof u !== 'string' || !/^[a-z0-9._-]{3,32}$/.test(u)) throw new DomainError('validation', 'Nome utente: 3–32 caratteri minuscoli, numeri, punto, trattino.');
}
const userCount = () => db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
const userView = (u) => u && { id: u.id, username: u.username, name: u.name, role: u.role, active: !!u.active, createdAt: u.created_at };

function createUser({ username, name, password, role }) {
  checkUsername(username);
  checkPassword(password);
  if (!ROLES[role]) throw new DomainError('validation', 'Ruolo non valido.');
  const cleanName = String(name || '').trim().slice(0, 60);
  if (!cleanName) throw new DomainError('validation', 'Il nome è obbligatorio.');
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new DomainError('validation', 'Nome utente già in uso.');
  const { salt, hash } = hashPassword(password);
  const id = 'u_' + crypto.randomBytes(8).toString('hex');
  db.prepare('INSERT INTO users (id, username, name, role, salt, hash, active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)').run(id, username, cleanName, role, salt, hash, Date.now());
  return id;
}

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), userId, Date.now() + SESSION_DAYS * 86400000);
  res.setHeader('Set-Cookie', `mag_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_DAYS * 86400}${SECURE_COOKIE ? '; Secure' : ''}`);
}
function sessionUser(req) {
  const m = /(?:^|;\s*)mag_session=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const row = db.prepare(`SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`).get(sha(m[1]));
  if (!row || row.expires_at < Date.now() || !row.active) return null;
  return row;
}

// Codice di prima configurazione: stampato in console finché non esiste un amministratore.
const SETUP_CODE = process.env.SETUP_CODE || crypto.randomBytes(5).toString('hex');
if (userCount() === 0) {
  console.log('\n  Nessun utente. Apri il sito e crea l\'amministratore con il codice di configurazione:');
  console.log(`  >>> ${SETUP_CODE} <<<\n`);
}

const loginAttempts = new Map();
function throttle(key) {
  const now = Date.now();
  const e = loginAttempts.get(key) || { n: 0, t: now };
  if (now - e.t > 15 * 60000) { e.n = 0; e.t = now; }
  e.n++;
  loginAttempts.set(key, e);
  if (e.n > 10) throw new DomainError('forbidden', 'Troppi tentativi. Riprova fra qualche minuto.');
}

/* HTTP --------------------------------------------------------------- */

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 8 * 1024 * 1024) throw new DomainError('validation', 'Richiesta troppo grande.');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DomainError('validation', 'JSON non valido.'); }
}
const STATUS = { validation: 400, forbidden: 403, notfound: 404, conflict: 409, auth: 401 };

const routes = {
  'GET /api/session': (req, res, user) => send(res, 200, { mode: 'server', user: userView(user), needsSetup: userCount() === 0, roles: ROLES }),

  'POST /api/setup': async (req, res) => {
    const b = await readJson(req);
    if (userCount() > 0) throw new DomainError('forbidden', 'Il sito è già configurato.');
    throttle('setup');
    if (String(b.setupCode || '').trim() !== SETUP_CODE) throw new DomainError('forbidden', 'Codice di configurazione errato: lo trovi nella console del server.');
    const id = createUser({ ...b, role: 'admin' });
    startSession(res, id);
    send(res, 200, { ok: true });
  },

  'POST /api/login': async (req, res) => {
    const b = await readJson(req);
    throttle('login:' + (req.socket.remoteAddress || '') + ':' + String(b.username || ''));
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(String(b.username || '').trim().toLowerCase());
    if (!u || !verifyPassword(String(b.password || ''), u.salt, u.hash)) throw new DomainError('auth', 'Nome utente o password errati.');
    if (!u.active) throw new DomainError('forbidden', "Account disattivato: contatta l'amministratore.");
    startSession(res, u.id);
    send(res, 200, { ok: true, user: userView(u) });
  },

  'POST /api/logout': (req, res) => {
    const m = /(?:^|;\s*)mag_session=([^;]+)/.exec(req.headers.cookie || '');
    if (m) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(m[1]));
    send(res, 200, { ok: true }, { 'Set-Cookie': 'mag_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
  },

  'POST /api/register': async (req, res) => {
    const b = await readJson(req);
    throttle('register:' + (req.socket.remoteAddress || ''));
    const inv = db.prepare('SELECT * FROM invites WHERE code_hash = ?').get(sha(String(b.invite || '').trim()));
    if (!inv || inv.used_by || inv.expires_at < Date.now()) throw new DomainError('forbidden', 'Invito non valido o già usato.');
    const id = createUser({ username: String(b.username || '').trim().toLowerCase(), name: b.name || inv.name, password: b.password, role: inv.role });
    db.prepare('UPDATE invites SET used_by = ? WHERE code_hash = ?').run(id, inv.code_hash);
    startSession(res, id);
    send(res, 200, { ok: true });
  },

  'POST /api/password': async (req, res, user) => {
    const b = await readJson(req);
    if (!verifyPassword(String(b.current || ''), user.salt, user.hash)) throw new DomainError('validation', 'La password attuale non è corretta.');
    checkPassword(b.next);
    const { salt, hash } = hashPassword(b.next);
    db.prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').run(salt, hash, user.id);
    send(res, 200, { ok: true, message: 'Password cambiata' });
  },

  'GET /api/state': (req, res, user, url) => {
    runReconcile();
    const since = Number(url.searchParams.get('since'));
    if (since === state.rev) return send(res, 200, { rev: state.rev, unchanged: true, serverTime: Date.now() });
    send(res, 200, { rev: state.rev, state: publicState(), serverTime: Date.now() });
  },

  'POST /api/op': async (req, res, user) => {
    const b = await readJson(req);
    const op = b.op;
    try {
      const r = applyOp(state, op, ctxFor({ id: user.id, name: user.name, role: user.role }));
      if (!r.duplicate) persist(r.state);
      send(res, 200, { ok: true, result: r.result, duplicate: !!r.duplicate, rev: state.rev, state: publicState() });
    } catch (e) {
      if (e instanceof DomainError) return send(res, STATUS[e.code] || 400, { error: e.message, code: e.code, extra: e.extra, rev: state.rev, state: publicState() });
      throw e;
    }
  },

  'GET /api/export': (req, res, user) => {
    const name = `magazzino-backup-${romeDate(Date.now())}.json`;
    send(res, 200, JSON.stringify(exportBackup(state, { exportedBy: user.name }), null, 2), {
      'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` });
  },

  'GET /api/users': (req, res) => {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at').all().map(userView);
    const invites = db.prepare('SELECT role, name, created_at, expires_at, used_by FROM invites ORDER BY created_at DESC LIMIT 30').all();
    send(res, 200, { users, invites });
  },

  'POST /api/invites': async (req, res, user) => {
    const b = await readJson(req);
    if (!ROLES[b.role]) throw new DomainError('validation', 'Ruolo non valido.');
    const code = crypto.randomBytes(9).toString('base64url');
    db.prepare('INSERT INTO invites (code_hash, role, name, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(sha(code), b.role, String(b.name || '').slice(0, 60), user.id, Date.now(), Date.now() + 7 * 86400000);
    send(res, 200, { code, expiresInDays: 7 });
  },

  'POST /api/users/update': async (req, res, user) => {
    const b = await readJson(req);
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(String(b.id || ''));
    if (!target) throw new DomainError('notfound', 'Utente non trovato.');
    if (target.id === user.id && (b.active === false || (b.role && b.role !== 'admin'))) throw new DomainError('validation', 'Non puoi disattivare o declassare te stesso.');
    if (b.role !== undefined) {
      if (!ROLES[b.role]) throw new DomainError('validation', 'Ruolo non valido.');
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(b.role, target.id);
    }
    if (b.active !== undefined) {
      db.prepare('UPDATE users SET active = ? WHERE id = ?').run(b.active ? 1 : 0, target.id);
      if (!b.active) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    }
    send(res, 200, { ok: true });
  },
};

const PUBLIC_ROUTES = new Set(['GET /api/session', 'POST /api/setup', 'POST /api/login', 'POST /api/logout', 'POST /api/register']);
const ADMIN_ROUTES = new Set(['GET /api/export', 'GET /api/users', 'POST /api/invites', 'POST /api/users/update']);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Vietato');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Non trovato');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const key = `${req.method} ${url.pathname}`;
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Metodo non consentito');
    return serveStatic(req, res, url);
  }
  const handler = routes[key];
  if (!handler) return send(res, 404, { error: 'Percorso API sconosciuto.' });
  try {
    // Protezione CSRF: le scritture devono arrivare dal nostro script (intestazione personalizzata + SameSite=Strict).
    if (req.method === 'POST' && req.headers['x-magazzino'] !== '1') throw new DomainError('forbidden', 'Richiesta non valida.');
    const user = sessionUser(req);
    if (!PUBLIC_ROUTES.has(key) && !user) throw new DomainError('auth', 'Sessione scaduta: accedi di nuovo.');
    if (ADMIN_ROUTES.has(key) && user.role !== 'admin') throw new DomainError('forbidden', "Riservato all'amministratore.");
    await handler(req, res, user, url);
  } catch (e) {
    if (e instanceof DomainError) return send(res, STATUS[e.code] || 400, { error: e.message, code: e.code });
    console.error(e);
    send(res, 500, { error: 'Errore interno del server: nessuna modifica è stata salvata.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Magazzino in ascolto su http://localhost:${PORT}  (archivio: ${path.join(DATA_DIR, 'magazzino.db')})`);
});
