// Server di Virtual-Italy: iscrizione con email e nome utente, conferma via email, sessioni in cookie
// HttpOnly, città condivisa in SQLite, aggiornamenti in tempo reale (Server-Sent Events).
// Nessuna dipendenza esterna: richiede Node.js 22.5 o successivo.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  applyOp, emptyState, publicView, DomainError, checkEmail, checkPassword, checkUsername, usernameKey,
  residentHouse, friendsOf, CITY, PAPER, spawnPoint, W, SEA_Y, checkSay, ROOM, canVisit,
} from '../public/js/core.js';
import { seedResidents } from '../public/js/seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SECURE_COOKIE = process.env.COOKIE_SECURE === '1';
const DEV_MAIL = process.env.DEV_MAIL === '1';           // mostra i link delle email anche nella risposta (solo sviluppo)
const RESEND_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || `${CITY} <noreply@example.com>`;
const ADMIN_EMAILS = new Set(String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
// Molti telefoni condividono lo stesso IP (reti mobili): il limite è largo, la vera barriera è la conferma email.
const REGISTER_PER_HOUR = Number(process.env.REGISTER_PER_HOUR || 30);
const SESSION_DAYS = 60;
const COOKIE = 'vi_session';

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'virtual-italy.db'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS store (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT NOT NULL, rev INTEGER NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, username_key TEXT UNIQUE NOT NULL,
    salt TEXT NOT NULL, hash TEXT NOT NULL, email_confirmed INTEGER NOT NULL DEFAULT 0, source TEXT, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, expires_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, to_addr TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);
`);

/* Città condivisa ----------------------------------------------------- */

let state;
{
  const row = db.prepare('SELECT json FROM store WHERE id = 1').get();
  if (row) state = JSON.parse(row.json);
  else {
    state = emptyState();
    if (process.env.DEMO_DATA === '1') state = seedResidents(state, Number(process.env.DEMO_COUNT || 18));
    db.prepare('INSERT INTO store (id, json, rev, updated_at) VALUES (1, ?, ?, ?)').run(JSON.stringify(state), state.rev, Date.now());
    console.log(process.env.DEMO_DATA === '1' ? 'Città creata con abitanti dimostrativi.' : 'Città creata: è vuota e aspetta i primi abitanti.');
  }
}

function persist(next) {
  db.prepare('UPDATE store SET json = ?, rev = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(next), next.rev, Date.now());
  state = next;
  broadcast();
}
function system(op) {
  const r = applyOp(state, op, { system: true, now: Date.now() });
  persist(r.state);
  return r.result;
}
function inTransaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const out = fn(); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// I cantieri non confermati entro 24 ore liberano il lotto; i codici scaduti si cancellano.
function housekeeping() {
  const now = Date.now();
  const r = applyOp(state, { type: 'expire' }, { system: true, now });
  if (r.result.freed) persist(r.state);
  db.prepare('DELETE FROM tokens WHERE expires_at < ?').run(now);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}
housekeeping();
setInterval(housekeeping, 60000).unref();

/* Tempo reale ---------------------------------------------------------- */

const streams = new Set(); // { res, userId }
// Dove si trovano gli omini di chi è in città (solo in memoria: chi esce sparisce).
const avatars = new Map(); // userId → [x, y]
const lastMove = new Map();
const onlineIds = () => [...new Set([...streams].map((c) => c.userId).filter(Boolean))];
function broadcast() {
  const data = `event: city\ndata: ${JSON.stringify({ rev: state.rev, online: onlineIds() })}\n\n`;
  for (const c of streams) c.res.write(data);
}
setInterval(() => { for (const c of streams) c.res.write(': ping\n\n'); }, 25000).unref();

/* Account ---------------------------------------------------------------- */

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function verifyPassword(password, salt, hash) {
  return crypto.timingSafeEqual(crypto.scryptSync(String(password), salt, 64), Buffer.from(hash, 'hex'));
}
const isAdmin = (u) => !!u && ADMIN_EMAILS.has(u.email);
function meView(u) {
  if (!u) return null;
  const r = state.residents[u.id];
  return { id: u.id, email: u.email, username: r?.username, emailConfirmed: !!u.email_confirmed, admin: isAdmin(u) };
}

function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(sha(token), userId, Date.now() + SESSION_DAYS * 86400000);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${SECURE_COOKIE ? '; Secure' : ''}`);
}
function sessionToken(req) {
  return new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.headers.cookie || '')?.[1];
}
function sessionUser(req) {
  const t = sessionToken(req);
  if (!t) return null;
  const row = db.prepare('SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?').get(sha(t));
  if (!row || row.expires_at < Date.now() || state.residents[row.id]?.suspended) return null;
  return row;
}

function newToken(userId, kind, hours) {
  const token = crypto.randomBytes(24).toString('base64url');
  db.prepare('DELETE FROM tokens WHERE user_id = ? AND kind = ?').run(userId, kind);
  db.prepare('INSERT INTO tokens (token_hash, user_id, kind, expires_at) VALUES (?, ?, ?, ?)').run(sha(token), userId, kind, Date.now() + hours * 3600000);
  return token;
}
function useToken(token, kind) {
  const row = db.prepare('SELECT * FROM tokens WHERE token_hash = ? AND kind = ?').get(sha(String(token || '')), kind);
  if (!row || row.expires_at < Date.now()) return null;
  db.prepare('DELETE FROM tokens WHERE token_hash = ?').run(row.token_hash);
  return row.user_id;
}

// Email: con RESEND_API_KEY parte davvero, altrimenti resta nella posta in uscita (console e redazione).
async function sendMail(to, subject, body) {
  if (RESEND_KEY) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, text: body }),
      });
      if (r.ok) return;
      console.error('Invio email non riuscito:', r.status, await r.text());
    } catch (e) {
      console.error('Invio email non riuscito:', e.message);
    }
  }
  db.prepare('INSERT INTO outbox (to_addr, subject, body, created_at) VALUES (?, ?, ?, ?)').run(to, subject, body, Date.now());
  db.prepare('DELETE FROM outbox WHERE id NOT IN (SELECT id FROM outbox ORDER BY id DESC LIMIT 200)').run();
  console.log(`\n[email per ${to}] ${subject}\n${body}\n`);
}
function confirmMail(u, username) {
  const link = `${BASE_URL}/?conferma=${newToken(u.id, 'confirm', 24)}`;
  sendMail(u.email, `Conferma la tua casa a ${CITY}`,
    `Ciao ${username},\n\nper finire la tua casa a ${CITY} conferma l'indirizzo email entro 24 ore:\n${link}\n\nSe non ti sei iscritto tu, ignora questo messaggio.\n\n${PAPER}`);
  return link;
}

const attempts = new Map();
function throttle(key, max, minutes) {
  const now = Date.now();
  const e = attempts.get(key) || { n: 0, t: now };
  if (now - e.t > minutes * 60000) { e.n = 0; e.t = now; }
  e.n++;
  attempts.set(key, e);
  if (e.n > max) throw new DomainError('forbidden', 'Troppi tentativi. Riprova fra qualche minuto.');
}
setInterval(() => { const now = Date.now(); for (const [k, e] of attempts) if (now - e.t > 3600000) attempts.delete(k); }, 600000).unref();
const ip = (req) => (process.env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '';

/* HTTP ------------------------------------------------------------------- */

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) throw new DomainError('validation', 'Richiesta troppo grande.');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DomainError('validation', 'Richiesta non valida.'); }
}
const STATUS = { validation: 400, auth: 401, forbidden: 403, notfound: 404, conflict: 409 };
const cityFor = (u) => ({ city: publicView(state, u?.id, isAdmin(u)), online: onlineIds(), avatars: Object.fromEntries(avatars) });

const routes = {
  'GET /api/session': (req, res, user) => send(res, 200, { mode: 'server', me: meView(user), devMail: DEV_MAIL }),

  'GET /api/city': (req, res, user) => send(res, 200, cityFor(user)),

  'GET /api/events': (req, res, user) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const c = { res, userId: user?.id || null };
    streams.add(c);
    if (c.userId && !avatars.has(c.userId) && state.residents[c.userId]) avatars.set(c.userId, spawnPoint(state, c.userId));
    res.write(`retry: 3000\nevent: city\ndata: ${JSON.stringify({ rev: state.rev, online: onlineIds() })}\n\n`);
    broadcast();
    req.on('close', () => {
      streams.delete(c);
      if (c.userId && ![...streams].some((o) => o.userId === c.userId)) avatars.delete(c.userId);
      broadcast();
    });
  },

  'POST /api/register': async (req, res) => {
    const b = await readJson(req);
    throttle('register:' + ip(req), REGISTER_PER_HOUR, 60);
    // Trappola per i bot: campo nascosto compilato o modulo inviato troppo in fretta.
    if (b.website || Number(b.elapsed) < 2500) throw new DomainError('validation', 'Non siamo riusciti a completare l\'iscrizione: riprova tra qualche secondo.');
    const email = checkEmail(b.email);
    const username = checkUsername(b.username);
    checkPassword(b.password);
    if (!b.accept) throw new DomainError('validation', 'Per iscriverti devi accettare il regolamento e l\'informativa privacy.');
    if (!b.adult) throw new DomainError('validation', 'Per iscriverti devi avere almeno 14 anni.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new DomainError('validation', 'Esiste già un abitante con questa email: prova ad accedere.');
    if (db.prepare('SELECT 1 FROM users WHERE username_key = ?').get(usernameKey(username))) throw new DomainError('validation', 'Questo nome utente è già preso.');
    const id = 'u_' + crypto.randomBytes(9).toString('hex');
    const source = String(b.source || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 30) || 'diretto';
    const { salt, hash } = hashPassword(b.password);
    const next = applyOp(state, { type: 'join', id, username }, { system: true, now: Date.now() }).state;
    inTransaction(() => {
      db.prepare('INSERT INTO users (id, email, username_key, salt, hash, email_confirmed, source, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)')
        .run(id, email, usernameKey(username), salt, hash, source, Date.now());
      db.prepare('UPDATE store SET json = ?, rev = ?, updated_at = ? WHERE id = 1').run(JSON.stringify(next), next.rev, Date.now());
    });
    state = next;
    broadcast();
    const link = confirmMail({ id, email }, username);
    startSession(res, id);
    send(res, 200, { ok: true, me: meView(db.prepare('SELECT * FROM users WHERE id = ?').get(id)), devLink: DEV_MAIL ? link : undefined });
  },

  'POST /api/confirm': async (req, res) => {
    const b = await readJson(req);
    throttle('confirm:' + ip(req), 20, 15);
    const userId = useToken(b.token, 'confirm');
    if (!userId) throw new DomainError('validation', 'Il link di conferma non è valido o è scaduto. Accedi e chiedine uno nuovo.');
    db.prepare('UPDATE users SET email_confirmed = 1 WHERE id = ?').run(userId);
    const r = system({ type: 'confirm', id: userId });
    startSession(res, userId);
    send(res, 200, { ok: true, number: r.number, me: meView(db.prepare('SELECT * FROM users WHERE id = ?').get(userId)) });
  },

  'POST /api/resend': (req, res, user) => {
    if (user.email_confirmed) return send(res, 200, { ok: true, already: true });
    throttle('resend:' + user.id, 3, 60);
    const link = confirmMail(user, state.residents[user.id]?.username || '');
    send(res, 200, { ok: true, devLink: DEV_MAIL ? link : undefined });
  },

  'POST /api/login': async (req, res) => {
    const b = await readJson(req);
    const login = String(b.login || '').trim().toLowerCase();
    throttle('login:' + ip(req) + ':' + login, 10, 15);
    const u = db.prepare('SELECT * FROM users WHERE email = ? OR username_key = ?').get(login, login);
    if (!u || !verifyPassword(b.password || '', u.salt, u.hash)) throw new DomainError('auth', 'Email, nome utente o password errati.');
    if (state.residents[u.id]?.suspended) throw new DomainError('forbidden', 'Questo account è sospeso. Scrivi alla redazione per chiarimenti.');
    startSession(res, u.id);
    send(res, 200, { ok: true, me: meView(u) });
  },

  'POST /api/logout': (req, res) => {
    const t = sessionToken(req);
    if (t) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(t));
    send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
  },

  // Risponde sempre allo stesso modo, così non si scopre chi è iscritto.
  'POST /api/reset/request': async (req, res) => {
    const b = await readJson(req);
    throttle('reset:' + ip(req), 5, 60);
    const email = String(b.email || '').trim().toLowerCase();
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    let link;
    if (u) {
      link = `${BASE_URL}/?nuova-password=${newToken(u.id, 'reset', 1)}`;
      sendMail(u.email, `Nuova password per ${CITY}`, `Per scegliere una nuova password apri questo link entro un'ora:\n${link}\n\nSe non l'hai chiesto tu, ignora questo messaggio.\n\n${PAPER}`);
    }
    send(res, 200, { ok: true, devLink: DEV_MAIL ? link : undefined });
  },

  'POST /api/reset': async (req, res) => {
    const b = await readJson(req);
    checkPassword(b.password);
    const userId = useToken(b.token, 'reset');
    if (!userId) throw new DomainError('validation', 'Il link non è valido o è scaduto: chiedine uno nuovo.');
    const { salt, hash } = hashPassword(b.password);
    db.prepare('UPDATE users SET salt = ?, hash = ? WHERE id = ?').run(salt, hash, userId);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    startSession(res, userId);
    send(res, 200, { ok: true });
  },

  'POST /api/op': async (req, res, user) => {
    const b = await readJson(req);
    const op = b.op || {};
    if (op.type === 'leave') throw new DomainError('validation', 'Per cancellare l\'account usa le impostazioni.');
    const r = applyOp(state, op, { user: { id: user.id, admin: isAdmin(user) }, now: Date.now() });
    persist(r.state);
    if (op.type === 'suspend' && op.on) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(String(op.id));
    send(res, 200, { ok: true, result: r.result, ...cityFor(user) });
  },

  // Il proprio omino cammina verso una casella: lo raccontiamo a tutti quelli collegati.
  'POST /api/move': async (req, res, user) => {
    const b = await readJson(req);
    const x = Number(b.x), y = Number(b.y);
    const room = b.room ? String(b.room) : null;
    if (room) {
      // Dentro una casa: deve esistere, l'abitante deve poter entrare e la casella deve stare nella stanza.
      if (!residentHouse(state, room)) throw new DomainError('notfound', 'Questa casa non esiste.');
      if (!canVisit(state, user.id, room)) throw new DomainError('forbidden', 'Il padrone di casa non fa entrare visite.');
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= ROOM || y >= ROOM) throw new DomainError('validation', 'Destinazione non valida.');
    } else if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= W || y > SEA_Y) throw new DomainError('validation', 'Destinazione non valida.');
    const now = Date.now();
    const sameRoom = (avatars.get(user.id)?.[2] ?? null) === room;
    if (sameRoom && now - (lastMove.get(user.id) || 0) < 150) return send(res, 200, { ok: true, skipped: true });
    lastMove.set(user.id, now);
    avatars.set(user.id, [x, y, room]);
    const data = `event: move\ndata: ${JSON.stringify({ id: user.id, x, y, room })}\n\n`;
    for (const c of streams) if (c.userId !== user.id) c.res.write(data);
    send(res, 200, { ok: true });
  },

  // Nuvoletta sopra il proprio omino, raccontata a tutti quelli collegati.
  'POST /api/say': async (req, res, user) => {
    const b = await readJson(req);
    const text = checkSay(b.text);
    throttle('say:' + user.id, 12, 1);
    const data = `event: say\ndata: ${JSON.stringify({ id: user.id, text })}\n\n`;
    for (const c of streams) if (c.userId !== user.id) c.res.write(data);
    send(res, 200, { ok: true });
  },

  'GET /api/me/export': (req, res, user) => {
    const r = state.residents[user.id];
    const data = {
      esportatoIl: new Date().toISOString(),
      account: { email: user.email, nomeUtente: r?.username, iscrittoIl: new Date(user.created_at).toISOString(), emailConfermata: !!user.email_confirmed, provenienza: user.source },
      abitante: r, casa: residentHouse(state, user.id),
      amici: friendsOf(state, user.id).map((id) => state.residents[id]?.username).filter(Boolean),
      richieste: state.requests.filter((q) => q.from === user.id || q.to === user.id),
    };
    send(res, 200, data, { 'Content-Disposition': 'attachment; filename="virtual-italy-i-miei-dati.json"' });
  },

  'POST /api/me/delete': async (req, res, user) => {
    const b = await readJson(req);
    if (!verifyPassword(b.password || '', user.salt, user.hash)) throw new DomainError('validation', 'La password non è corretta.');
    system({ type: 'leave', id: user.id });
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM tokens WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    send(res, 200, { ok: true }, { 'Set-Cookie': `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
  },

  'GET /api/admin': (req, res) => {
    const sources = db.prepare('SELECT source, COUNT(*) AS n, SUM(email_confirmed) AS confirmed FROM users GROUP BY source ORDER BY n DESC').all();
    const outbox = RESEND_KEY ? [] : db.prepare('SELECT to_addr AS "to", subject, body, created_at AS at FROM outbox ORDER BY id DESC LIMIT 30').all();
    send(res, 200, { sources, outbox, mailConfigured: !!RESEND_KEY });
  },
};

const PUBLIC_ROUTES = new Set(['GET /api/session', 'GET /api/city', 'GET /api/events', 'POST /api/register', 'POST /api/confirm',
  'POST /api/login', 'POST /api/logout', 'POST /api/reset/request', 'POST /api/reset']);
const ADMIN_ROUTES = new Set(['GET /api/admin']);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '/giornale') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end('Vietato'); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Non trovato'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const routeKey = `${req.method} ${url.pathname}`;
  if (!url.pathname.startsWith('/api/')) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return serveStatic(req, res, url);
  }
  const handler = routes[routeKey];
  if (!handler) return send(res, 404, { error: 'Percorso sconosciuto.' });
  try {
    // Protezione CSRF: le scritture devono arrivare dal nostro script (intestazione personalizzata).
    if (req.method === 'POST' && req.headers['x-vi'] !== '1') throw new DomainError('forbidden', 'Richiesta non valida.');
    const user = sessionUser(req);
    if (!PUBLIC_ROUTES.has(routeKey) && !user) throw new DomainError('auth', 'Accedi per continuare.');
    if (ADMIN_ROUTES.has(routeKey) && !isAdmin(user)) throw new DomainError('forbidden', 'Riservato alla redazione.');
    await handler(req, res, user, url);
  } catch (e) {
    if (e instanceof DomainError) return send(res, STATUS[e.code] || 400, { error: e.message, code: e.code });
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Errore del server: nessuna modifica è stata salvata.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`${CITY} in ascolto su ${BASE_URL}  (archivio: ${path.join(DATA_DIR, 'virtual-italy.db')})`);
  if (!RESEND_KEY) console.log('Email non configurate: i messaggi compaiono qui in console e nella Redazione (posta in uscita).');
  if (!ADMIN_EMAILS.size) console.log('Nessuna email di redazione: imposta ADMIN_EMAILS per accedere alla Redazione.');
});
