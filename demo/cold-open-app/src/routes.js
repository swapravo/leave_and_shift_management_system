'use strict';
const compile = (p) => ({ re: new RegExp('^' + p.replace(/:([a-z_]+)/g, '(?<$1>[^/]+)') + '$') });
const table = [...require('./leave').routes, ...require('./shifts').routes, ...require('./admin').routes]
  .map((r) => ({ ...r, ...compile(r.p) }));

// Returns { route, params } | { methodNotAllowed: true } | null
function match(method, pathname) {
  let pathMatched = false;
  for (const r of table) {
    const m = r.re.exec(pathname);
    if (!m) continue;
    pathMatched = true;
    if (r.m === method) {
      const params = {};
      for (const [k, v] of Object.entries(m.groups || {})) {
        try { params[k] = decodeURIComponent(v); } catch { params[k] = v; }
      }
      return { route: r, params };
    }
  }
  return pathMatched ? { methodNotAllowed: true } : null;
}
module.exports = { match };
