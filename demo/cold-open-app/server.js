'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const db = require('./src/db');
const L = require('./src/lib');
const auth = require('./src/auth');
const core = require('./src/core');
const { match } = require('./src/routes');

const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8',
};
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const MAX_BODY = 256 * 1024;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY, ...headers });
  res.end(body);
}
const sendJson = (res, status, obj, headers = {}) =>
  send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });

function parseCookies(h) {
  const out = {};
  for (const part of String(h || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new L.HttpError(413, 'Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!size) return resolve({});
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error();
        resolve(v);
      } catch {
        reject(L.bad('Request body must be a JSON object'));
      }
    });
    req.on('error', reject);
  });
}
const cookieHeader = (token, maxAge) =>
  `sid=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

async function handleApi(req, res, url) {
  const ip = req.socket.remoteAddress || '';
  const cookies = parseCookies(req.headers.cookie);
  const method = req.method;
  const pathname = url.pathname;
  try {
    if (method !== 'GET' && method !== 'HEAD' && req.headers['x-requested-with'] !== 'app') {
      throw new L.HttpError(403, 'Missing X-Requested-With header');
    }
    const body = method === 'GET' || method === 'HEAD' ? {} : await readBody(req);
    const query = Object.fromEntries(url.searchParams);

    if (method === 'POST' && pathname === '/api/login') {
      const email = L.str(body.email, 'email', { max: 120 });
      const password = typeof body.password === 'string' ? body.password : '';
      auth.checkLockout(ip, email);
      const row = db.get('SELECT * FROM users WHERE email = ? AND active = 1', email);
      const ok = auth.verifyPassword(password, row ? row.password_hash : 'scrypt$00$00');
      if (!row || !ok) {
        auth.recordFail(ip, email);
        core.audit({ id: null, name: email, role: null, ip }, 'auth.login_failed', 'user', row ? row.id : null, `Failed sign-in for ${email}`, null);
        throw new L.HttpError(401, 'Incorrect email or password');
      }
      auth.clearFails(ip, email);
      auth.purgeExpired();
      const s = auth.createSession(row.id);
      core.audit({ ...row, ip }, 'auth.login', 'user', row.id, `${row.name} signed in`, null);
      return sendJson(res, 200, { user: auth.publicUser(row) }, { 'Set-Cookie': cookieHeader(s.token, s.maxAge) });
    }
    if (method === 'GET' && pathname === '/api/health') return sendJson(res, 200, { ok: true });

    const user = auth.userForToken(cookies.sid);
    if (method === 'GET' && pathname === '/api/session' && !user) return sendJson(res, 200, { authenticated: false });
    if (method === 'GET' && pathname === '/api/session') return sendJson(res, 200, { authenticated: true });
    if (!user) throw new L.HttpError(401, 'Please sign in');
    user.ip = ip;

    if (method === 'POST' && pathname === '/api/logout') {
      auth.destroySession(cookies.sid);
      core.audit(user, 'auth.logout', 'user', user.id, `${user.name} signed out`, null);
      return sendJson(res, 200, { ok: true }, { 'Set-Cookie': cookieHeader('', 0) });
    }
    const m = match(method === 'HEAD' ? 'GET' : method, pathname);
    if (!m) throw L.notFound('No such endpoint');
    if (m.methodNotAllowed) throw new L.HttpError(405, 'Method not allowed');
    const result = await m.route.h({ user, body, query, params: m.params, req });
    if (result && result.__raw) {
      return send(res, 200, result.__raw.body, { 'Content-Type': result.__raw.type, 'Cache-Control': 'no-store', ...(result.__raw.headers || {}) });
    }
    return sendJson(res, 200, result);
  } catch (e) {
    if (e instanceof L.HttpError) return sendJson(res, e.status, { error: { message: e.message, ...e.extra } });
    console.error('Unhandled error:', e);
    return sendJson(res, 500, { error: { message: 'Something went wrong on the server' } });
  }
}

function serveStatic(req, res, url) {
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
    send(res, 200, req.method === 'HEAD' ? '' : data, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
  });
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) return void handleApi(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return serveStatic(req, res, url);
  });
}

function start({ port = Number(process.env.PORT) || 3000, host = process.env.HOST || '127.0.0.1', dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'app.db') } = {}) {
  db.open(dbPath);
  if (!db.get('SELECT COUNT(*) n FROM users').n && process.env.NO_AUTO_SEED !== '1') {
    console.log('Empty database: loading demo data...');
    require('./src/seed').seed();
  }
  const server = createServer();
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

module.exports = { start, createServer };

if (require.main === module) {
  start().then((s) => {
    const a = s.address();
    console.log(`Leave & Shift Manager running at http://${a.address === '::' ? 'localhost' : a.address}:${a.port}`);
    console.log('Demo logins (password: password123): helen.park@example.com (HR), maria.santos@example.com (manager), aisha.khan@example.com (employee)');
  });
}
