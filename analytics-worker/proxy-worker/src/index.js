/**
 * First-party beacon proxy — Hacklog analytics (staging variant).
 *
 * Serves POST /_collect on the SITE's own domain and forwards the body to the
 * collector worker at UPSTREAM + COLLECT_PATH.
 *
 * Why this exists:
 *   - Content blockers (uBlock, EasyPrivacy, Brave shields) match third-party
 *     beacon URLs; a workers.dev hostname is a strong signal. A POST to a
 *     first-party path on the site itself looks like any other site API call,
 *     and blockers are reluctant to break first-party functionality.
 *   - Bonus: the collector's secret COLLECT_PATH moves out of the site's JS
 *     bundle entirely (it lives in THIS worker's env instead). The shipped
 *     site code only knows "/_collect".
 *
 * Security posture:
 *   - Body forwarded verbatim; the collector does all validation, rate
 *     limiting, geo stamping and storage. This proxy stores and logs nothing.
 *   - No secrets in the site bundle. COLLECT_PATH is a secret on this worker
 *     (set via `wrangler secret put COLLECT_PATH`), byte-identical to the
 *     collector's own secret.
 *   - Origin gate here is belt-and-braces; the collector re-checks anyway.
 *
 * Deploy (staging):
 *   cd analytics-worker/proxy-worker
 *   npx wrangler secret put COLLECT_PATH     # paste the staging collector's path
 *   npx wrangler deploy
 * then add the route (dashboard or uncomment in wrangler.toml).
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const proxyPath = env.PROXY_PATH || '/_collect';
    const upstream = String(env.UPSTREAM ?? '').replace(/\/$/, '');
    const origin = request.headers.get('origin') ?? '';

    // Health/liveness (harmless, and useful when wiring routes).
    if (url.pathname === '/healthz') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), {
        headers: { 'content-type': 'application/json' },
      });
    }

    // CORS preflight for the proxy path.
    if (request.method === 'OPTIONS' && url.pathname === proxyPath) {
      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
          'access-control-max-age': '86400',
          ...(origin ? { 'access-control-allow-origin': origin } : {}),
        },
      });
    }

    // Only the proxy path, only POST. Every other request 404s so this worker
    // is not a discovery surface for anything else on the domain.
    if (url.pathname !== proxyPath || request.method !== 'POST') {
      return new Response(null, { status: 404 });
    }

    if (!upstream) {
      return new Response('proxy misconfigured: UPSTREAM unset', { status: 500 });
    }

    // Optional origin allow-list (comma-separated var). Empty accepts all —
    // the collector still enforces its own list on the forwarded Origin.
    const allowed = String(env.ALLOWED_ORIGINS ?? '')
      .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
    if (allowed.length && origin && !allowed.includes(origin.replace(/\/$/, ''))) {
      return new Response(null, { status: 403 });
    }

    // COLLECT_PATH must be configured here (secret). Without it the proxy
    // fails closed with 500 — never guess a path.
    const collectPath = env.COLLECT_PATH;
    if (!collectPath || typeof collectPath !== 'string' || !collectPath.startsWith('/')) {
      return new Response('proxy misconfigured: COLLECT_PATH unset', { status: 500 });
    }

    // Forward verbatim, preserving content-type and the ORIGINAL origin so
    // the collector's allow-list sees the real site, not this proxy.
    const body = await request.arrayBuffer();
    const resp = await fetch(`${upstream}${collectPath}`, {
      method: 'POST',
      body,
      headers: {
        'content-type': request.headers.get('content-type') ?? 'text/plain',
        ...(origin ? { origin } : {}),
      },
    });

    // Relay the collector's status so the tracker's debug path is honest
    // (204 = stored, 403 = origin rejected, 400 = body rejected, etc).
    return new Response(null, {
      status: resp.status,
      headers: {
        ...(origin ? { 'access-control-allow-origin': origin } : {}),
        'cache-control': 'no-store',
      },
    });
  },
};
