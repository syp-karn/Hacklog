#!/usr/bin/env node
/**
 * Proxy worker smoke test — offline, no Cloudflare account.
 *   node analytics-worker/proxy-worker/smoke-test.mjs
 *
 * Pins down:
 *   - only POST <PROXY_PATH> is served; everything else 404s
 *   - disallowed origin 403s; empty allow-list accepts any origin
 *   - unset COLLECT_PATH fails closed (500), never guesses
 *   - request is forwarded to UPSTREAM + COLLECT_PATH with the original
 *     origin header preserved
 */

const worker = (await import('./src/index.js')).default;

const forwarded = [];
const fetchMock = async (reqOrUrl, init) => {
  // Worker calls fetch(url-string, init) — normalise to inspect headers.
  const url = typeof reqOrUrl === 'string' ? reqOrUrl : reqOrUrl.url;
  const headers = new Headers(init?.headers ?? (typeof reqOrUrl === 'object' ? reqOrUrl.headers : {}));
  forwarded.push({ url, origin: headers.get('origin'), ct: headers.get('content-type') });
  return new Response(null, { status: 204 });
};
globalThis.fetch = fetchMock;

const env = (o = {}) => ({
  UPSTREAM: 'https://collector.example',
  PROXY_PATH: '/_collect',
  COLLECT_PATH: '/secret123',
  ALLOWED_ORIGINS: 'https://site.example',
  ...o,
});

const req = (method, url, headers = {}, body) =>
  new Request(url, { method, headers, ...(body ? { body } : {}) });

let fails = 0;
const check = (name, cond, extra = '') => {
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  ${extra}` : ''}`);
};

const okBody = JSON.stringify({ v: 1, type: 'pageview', vid: 'aabbcc112233', sid: 'aabbcc112233', path: '/', ref: '', ts: 1 });

let r = await worker.fetch(req('POST', 'https://p.example/_collect', { origin: 'https://site.example', 'content-type': 'text/plain' }, okBody), env());
check('valid beacon → 204', r.status === 204);
check('forwarded to upstream+collectPath', forwarded[0]?.url === 'https://collector.example/secret123', forwarded[0]?.url);
check('original origin preserved', forwarded[0]?.origin === 'https://site.example');

r = await worker.fetch(req('GET', 'https://p.example/_collect'), env());
check('GET on proxy path → 404', r.status === 404);
r = await worker.fetch(req('POST', 'https://p.example/other', { origin: 'https://site.example' }, okBody), env());
check('other path → 404', r.status === 404);
r = await worker.fetch(req('POST', 'https://p.example/_collect', { origin: 'https://evil.example' }, okBody), env());
check('disallowed origin → 403', r.status === 403);
r = await worker.fetch(req('POST', 'https://p.example/_collect', { origin: 'https://any.example' }, okBody), env({ ALLOWED_ORIGINS: '' }));
check('empty allow-list accepts any origin', r.status === 204);
r = await worker.fetch(req('POST', 'https://p.example/_collect', { origin: 'https://site.example' }, okBody), env({ COLLECT_PATH: undefined }));
check('unset COLLECT_PATH fails closed (500)', r.status === 500);
r = await worker.fetch(req('OPTIONS', 'https://p.example/_collect'), env());
check('preflight → 204', r.status === 204);
r = await worker.fetch(req('GET', 'https://p.example/healthz'), env());
check('healthz → 200', r.status === 200);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILED`);
process.exit(fails ? 1 : 0);
