#!/usr/bin/env node
/**
 * Guided first-time setup for the Hacklog analytics backend.
 *
 *   cd analytics-worker
 *   node scripts/setup.mjs                 # production + staging
 *   node scripts/setup.mjs --staging-only  # leave production untouched
 *
 * It walks, in order:
 *   1. check Wrangler is installed and authenticated
 *   2. create (or find) both D1 databases and write their ids into wrangler.toml
 *   3. optionally update each environment's ALLOWED_ORIGINS
 *   4. apply schema.sql to both databases with --remote
 *   5. deploy both workers, capturing their workers.dev URLs
 *   6. generate an INDEPENDENT secret set per environment and install it
 *   7. write the site's local .env (staging pair, so local work cannot touch
 *      production data) and print the production pair to paste into GitHub
 *   8. verify: tables reachable remotely, healthz, 404 on scanner paths, and a
 *      real beacon accepted on staging
 *
 * Every step is idempotent. Re-running is safe: the schema uses
 * CREATE TABLE IF NOT EXISTS, and database ids are only rewritten in place.
 *
 * Secrets CANNOT be read back from Cloudflare, so re-running the secret step
 * mints new ones and invalidates the old. That is fine for staging; for
 * production it means rebuilding the site (see the warning it prints).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { makeSecretSet, SECRET_NAMES } from './secrets.mjs';
import { currentOrigins, setDatabaseIds, setOrigins } from './config.mjs';

// ---------------------------------------------------------------- constants --

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = resolve(HERE, '..');
const REPO_ROOT = resolve(WORKER_DIR, '..');
const TOML_PATH = join(WORKER_DIR, 'wrangler.toml');
const ENV_PATH = join(REPO_ROOT, '.env');

const PROD = { name: 'production', worker: 'hacklog-analytics', db: 'hacklog-analytics' };
const STAGING = { name: 'staging', worker: 'hacklog-analytics-staging', db: 'hacklog-analytics-staging' };

const STAGING_ONLY = process.argv.includes('--staging-only');
const IS_WIN = process.platform === 'win32';

// --------------------------------------------------------------------- ui ----

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : String(s));
const bold = paint('1');
const dim = paint('2');
const cyan = paint('36');
const green = paint('32');
const yellow = paint('33');
const red = paint('31');

const log = (line = '') => console.log(line);
const step = (n, title) => log(`\n${bold(cyan(`[${n}/8] ${title}`))}`);
const ok = (s) => log(`  ${green('+')} ${s}`);
const warn = (s) => log(`  ${yellow('!')} ${s}`);
const bad = (s) => log(`  ${red('x')} ${s}`);

function abort(message) {
  log(`\n${red('Setup stopped.')} ${message}\n`);
  process.exit(1);
}

const stripAnsi = (s) => String(s ?? '').replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
const NOISE = /^(npm (warn|notice)|Need to install|`-- )/;

/** Indented, de-noised rendering of a child process's output. */
function show(text) {
  const lines = stripAnsi(text)
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '' && !NOISE.test(l));
  if (lines.length) log(lines.map((l) => `    ${dim(l)}`).join('\n'));
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function ask(label, fallback) {
  const suffix = fallback ? ` ${dim(`[${fallback}]`)}` : '';
  const answer = (await rl.question(`  ${label}${suffix}: `)).trim();
  return answer === '' ? (fallback ?? '') : answer;
}

async function yesNo(label, fallback) {
  const hint = fallback ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`  ${label} ${dim(`[${hint}]`)}: `)).trim().toLowerCase();
  if (!answer) return fallback;
  return answer === 'y' || answer === 'yes';
}

// --------------------------------------------------------------- wrangler ----

/**
 * Run `npx wrangler ...` from the worker directory.
 *
 * stdin is always piped, never inherited: `wrangler secret put` reads the secret
 * from stdin, and inheriting would let it fight our own prompt for the terminal.
 * `shell: true` is required on Windows because npx is a .cmd shim.
 */
function wrangler(args, { input, quiet = false } = {}) {
  const res = spawnSync('npx', ['--yes', 'wrangler', ...args], {
    cwd: WORKER_DIR,
    encoding: 'utf8',
    input,
    shell: IS_WIN,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    maxBuffer: 32 * 1024 * 1024,
  });
  const text = stripAnsi(`${res.stdout ?? ''}${res.stderr ?? ''}`);
  if (!quiet) show(text);
  return { status: res.status ?? 1, text, error: res.error };
}

const envArgs = (env) => (env === PROD ? [] : ['--env', env.name]);

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Pull a database id out of Wrangler's output. `d1 create` prints it as
 * `database_id = "..."`, while `d1 info` prints a box-drawn table row
 * (`│ uuid │ ... │`), so the separator class has to tolerate both — and the
 * box-drawing character \u2502. Falls back to the first bare UUID.
 */
const LABELLED_UUID = /(?:database_id|uuid)\b[\s"'\u2502|:=]*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const findUuid = (text) => {
  const s = String(text);
  return (s.match(LABELLED_UUID) ?? [])[1] ?? (s.match(UUID) ?? [])[0] ?? null;
};
const WORKERS_DEV = /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev/gi;
const findWorkersDevUrl = (text) => {
  const matches = String(text).match(WORKERS_DEV) ?? [];
  // The deploy output echoes the worker name first; the last URL is the live one.
  return matches.length ? matches[matches.length - 1].replace(/\/$/, '') : null;
};

// ------------------------------------------------------------ toml editing ----

const readToml = () => readFileSync(TOML_PATH, 'utf8');

/**
 * Apply a pure transform from config.mjs to the real file. Returns false when
 * nothing changed, so the script can report "unchanged" instead of claiming an
 * edit it did not make.
 */
function updateToml(transform) {
  const original = readToml();
  let next;
  try {
    next = transform(original);
  } catch (err) {
    abort(err.message);
  }
  if (next === original) return false;
  writeFileSync(TOML_PATH, next);
  return true;
}

// ------------------------------------------------------------ cf operations --

function requireAuth() {
  const res = wrangler(['whoami'], { quiet: true });
  if (res.status !== 0 || /not authenticated|not logged in|no account/i.test(res.text)) {
    if (res.status !== 0) show(res.text);
    abort('Wrangler is not authenticated. Run `npx wrangler login` and then re-run this script.');
  }
}

/** Find an existing database by name, or create it. Returns its uuid. */
function resolveDatabase(name) {
  const info = wrangler(['d1', 'info', name], { quiet: true });
  if (info.status === 0) {
    const id = findUuid(info.text);
    if (id) return { id, created: false };
  }

  const created = wrangler(['d1', 'create', name], { quiet: true });
  const id = findUuid(created.text);
  if (created.status !== 0 || !id) {
    bad(`could not create D1 database "${name}"`);
    if (created.error) bad(String(created.error.message));
    show(created.text);
    abort('Fix the error above (most often an account or login problem), then re-run.');
  }
  return { id, created: true };
}

function applySchema(database, label) {
  const res = wrangler(['d1', 'execute', database, '--remote', '--file', 'schema.sql']);
  if (res.status !== 0) {
    bad(`schema failed on ${label} (${database})`);
    return false;
  }
  ok(`schema applied to ${label} (${database})`);
  return true;
}

function deployWorker(env) {
  const res = wrangler(['deploy', ...envArgs(env)]);
  if (res.status !== 0) {
    bad(`deploy failed for ${env.name}`);
    return null;
  }
  const url = findWorkersDevUrl(res.text);
  ok(`${env.name} deployed${url ? ` → ${url}` : ''}`);
  return url;
}

function pushSecret(name, value, env) {
  const res = wrangler(['secret', 'put', name, ...envArgs(env)], { input: `${value}\n`, quiet: true });
  if (res.status !== 0) {
    bad(`${name} → ${env.name} failed`);
    show(res.text);
    return false;
  }
  ok(`${name} → ${env.name}`);
  return true;
}

function verifyTables(database, label) {
  const dir = join(WORKER_DIR, '.wrangler');
  mkdirSync(dir, { recursive: true });
  const rel = '.wrangler/setup-verify.sql';
  writeFileSync(
    join(WORKER_DIR, rel),
    'SELECT COUNT(*) AS pageviews FROM pageviews;\nSELECT COUNT(*) AS visitors FROM visitors;\n',
  );
  try {
    const res = wrangler(['d1', 'execute', database, '--remote', '--file', rel], { quiet: true });
    if (res.status !== 0 || /no such table/i.test(res.text)) {
      bad(`${label}: tables are NOT reachable remotely`);
      show(res.text);
      return false;
    }
    ok(`${label}: pageviews + visitors reachable remotely`);
    return true;
  } finally {
    rmSync(join(WORKER_DIR, rel), { force: true });
  }
}

/** Status code, or null when the request could not be made at all. */
async function httpStatus(url, init) {
  try {
    const res = await fetch(url, { redirect: 'manual', ...init });
    return res.status;
  } catch {
    return null;
  }
}

function writeEnvFile(origin, collectPath) {
  const body = `# Written by analytics-worker/scripts/setup.mjs.
# Points at the STAGING worker on purpose: local experiments must never write
# to production data. For a production-like build, swap in the production pair
# printed at the end of setup.
PUBLIC_ANALYTICS_ORIGIN=${origin}
PUBLIC_ANALYTICS_COLLECT_PATH=${collectPath}

# Uncomment to build a noindex preview.
# PUBLIC_NOINDEX=1
`;
  writeFileSync(ENV_PATH, body);
}

// ------------------------------------------------------------------- flow ----

log(`\n${bold('Hacklog analytics — guided setup')}`);
log(dim(`  worker dir : ${WORKER_DIR}`));
log(dim(`  scope      : ${STAGING_ONLY ? 'staging only (production left untouched)' : 'production + staging'}`));

// ── 1 ────────────────────────────────────────────────────────────────────────
step(1, 'Preflight');

if (!existsSync(TOML_PATH)) abort(`wrangler.toml not found at ${TOML_PATH}.`);
ok('wrangler.toml found');

const probe = wrangler(['--version'], { quiet: true });
if (probe.status !== 0) {
  show(probe.text);
  abort('Could not run `npx wrangler`. Check that Node and npm/npx work, then re-run.');
}
ok(`wrangler ${probe.text.trim().replace(/^.*?(\d)/, '$1') || 'available'}`);

requireAuth();
ok('Cloudflare authentication OK');

// ── 2 ────────────────────────────────────────────────────────────────────────
step(2, 'D1 databases');
log(dim('  Looking each database up by name before creating, so re-runs are safe.'));

const stagingDb = resolveDatabase(STAGING.db);
ok(`staging  ${STAGING.db} ${dim(stagingDb.created ? '(created)' : '(existing)')} ${dim(stagingDb.id)}`);

let prodDb = { id: null, created: false };
if (!STAGING_ONLY) {
  prodDb = resolveDatabase(PROD.db);
  ok(`production ${PROD.db} ${dim(prodDb.created ? '(created)' : '(existing)')} ${dim(prodDb.id)}`);
} else {
  log(`  ${dim('- production database skipped (--staging-only)')}`);
}

const idsChanged = updateToml((text) => setDatabaseIds(text, { prodId: prodDb.id, stagingId: stagingDb.id }));
if (idsChanged) ok('wrangler.toml updated with database ids');
else ok('wrangler.toml already had those database ids');

// ── 3 ────────────────────────────────────────────────────────────────────────
step(3, 'Origin allow-list');
log(dim('  A var, not a secret: hostnames are public. Press Enter to keep the'));
log(dim('  current value. Staging needs every URL the test deployment answers on.'));

const prodOrigins = STAGING_ONLY
  ? null
  : await ask('Allowed origins for production (comma-separated)', currentOrigins(readToml(), false));
const stagingOrigins = await ask(
  'Allowed origins for staging (comma-separated)',
  currentOrigins(readToml(), true),
);

if (updateToml((text) => setOrigins(text, { prodOrigins, stagingOrigins }))) {
  ok('wrangler.toml updated with allowed origins');
} else {
  ok('allowed origins unchanged');
}

// ── 4 ────────────────────────────────────────────────────────────────────────
step(4, 'Apply schema (--remote)');
log(dim('  --remote is mandatory: `wrangler d1 execute` defaults to a LOCAL file,'));
log(dim('  which silently leaves the deployed worker with no tables.'));

if (!STAGING_ONLY && !applySchema(PROD.db, 'production')) {
  abort('Could not apply the production schema. See the output above.');
}
if (!applySchema(STAGING.db, 'staging')) {
  abort('Could not apply the staging schema. See the output above.');
}

// ── 5 ────────────────────────────────────────────────────────────────────────
step(5, 'Deploy workers');
log(dim('  Deploying before setting secrets is deliberate: a worker with no'));
log(dim('  secrets 404s every path, which is exactly the fail-closed behaviour'));
log(dim('  we want. It also reveals the workers.dev URL this script needs.'));

let prodUrl = null;
let stagingUrl = null;

if (await yesNo('Deploy now?', true)) {
  if (!STAGING_ONLY) prodUrl = deployWorker(PROD);
  stagingUrl = deployWorker(STAGING);
} else {
  warn('skipped — secrets may fail to attach until the worker exists, and the');
  warn('workers.dev URLs will be left blank in .env');
}

// ── 6 ────────────────────────────────────────────────────────────────────────
step(6, 'Generate and install secrets');
log(dim('  One independent set per environment. Cloudflare never returns secret'));
log(dim('  values, so this always mints new ones — see the warning below.'));

const stagingSecrets = makeSecretSet();
const prodSecrets = STAGING_ONLY ? null : makeSecretSet();

let secretFailures = 0;

if (!STAGING_ONLY) {
  for (const name of SECRET_NAMES) {
    if (!pushSecret(name, prodSecrets[name], PROD)) secretFailures++;
  }
}
for (const name of SECRET_NAMES) {
  if (!pushSecret(name, stagingSecrets[name], STAGING)) secretFailures++;
}

if (secretFailures) {
  warn(`${secretFailures} secret(s) failed to attach — check the output above.`);
}

if (!STAGING_ONLY) {
  warn('Production COLLECT_PATH changed. If the live site is already built with');
  warn('the previous path, beacons stop until you update the GitHub secret and');
  warn('redeploy the site. Rotate both sides together.');
}

// ── 7 ────────────────────────────────────────────────────────────────────────
step(7, 'Site build environment');

const stagingOrigin = stagingUrl ?? 'https://<your-staging-worker>.workers.dev';
let writeEnv = true;
if (existsSync(ENV_PATH)) {
  warn('.env already exists at the repo root');
  writeEnv = await yesNo('Overwrite it with the staging pair?', true);
}
if (writeEnv) {
  writeEnvFile(stagingOrigin, stagingSecrets.COLLECT_PATH);
  ok(`.env written → ${ENV_PATH}`);
} else {
  warn('.env left alone. Required values:');
  log(`    PUBLIC_ANALYTICS_ORIGIN=${stagingOrigin}`);
  log(`    PUBLIC_ANALYTICS_COLLECT_PATH=${stagingSecrets.COLLECT_PATH}`);
}

// ── 8 ────────────────────────────────────────────────────────────────────────
step(8, 'Verify');

let allGood = true;
allGood = verifyTables(STAGING.db, 'staging') && allGood;
if (!STAGING_ONLY) allGood = verifyTables(PROD.db, 'production') && allGood;

/** Report a status check and fold it into the overall verdict. */
function expect(label, actual, wanted, fatal = true) {
  if (actual === wanted) {
    ok(`${label} → ${actual}`);
    return;
  }
  bad(`${label} → ${actual} (wanted ${wanted})`);
  if (fatal) allGood = false;
}

if (stagingUrl) {
  expect('staging /healthz', await httpStatus(`${stagingUrl}/healthz`), 200);
  expect('staging /api/collect (scanner path)', await httpStatus(`${stagingUrl}/api/collect`), 404);

  // No Origin header on purpose: that is the curl/fallback-client shape, which
  // the worker accepts. Only a *disallowed* browser origin is rejected.
  const beacon = await httpStatus(`${stagingUrl}${stagingSecrets.COLLECT_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },      body: JSON.stringify({
        v: 1, type: 'pageview', vid: 'abcdef1234567890', sid: 'abcdef1234567890',
        path: '/setup-check', ref: '', ts: Date.now(), ua: 'setup-script',
      }),
  });
  expect('staging beacon accepted', beacon, 204);
  if (beacon === 204) {
    log(dim('    one test row ("/setup-check") was written to the staging database'));
  }
} else {
  warn('no staging URL captured, so live checks were skipped');
}

if (prodUrl) expect('production /healthz', await httpStatus(`${prodUrl}/healthz`), 200, false);

// ── summary ──────────────────────────────────────────────────────────────────
log(`\n${bold(cyan('Summary'))}`);

log(`\n${bold('Production')} ${dim(`(worker ${PROD.worker}${prodUrl ? `, ${prodUrl}` : ''})`)}`);
if (STAGING_ONLY || !prodSecrets) {
  log(`  ${dim('unchanged (--staging-only)')}`);
} else {
  log(`  COLLECT_PATH  ${bold(prodSecrets.COLLECT_PATH)}`);
  log(`  STATS_PATH    ${prodSecrets.STATS_PATH}`);
  log(`  STATS_TOKEN   ${prodSecrets.STATS_TOKEN}`);
  log(`  COLLECT_SALT  ${prodSecrets.COLLECT_SALT}`);
}

log(`\n${bold('Staging')} ${dim(`(worker ${STAGING.worker}${stagingUrl ? `, ${stagingUrl}` : ''})`)}`);
log(`  COLLECT_PATH  ${bold(stagingSecrets.COLLECT_PATH)}`);
log(`  STATS_PATH    ${stagingSecrets.STATS_PATH}`);
log(`  STATS_TOKEN   ${stagingSecrets.STATS_TOKEN}`);
log(`  COLLECT_SALT  ${stagingSecrets.COLLECT_SALT}`);

log(`\n${bold('Paste into GitHub')} ${dim('Settings → Secrets and variables → Actions')}`);
log(`  Variable  PUBLIC_ANALYTICS_ORIGIN        = ${prodUrl ?? 'https://<your-worker>.workers.dev'}`);
log(`  Secret    PUBLIC_ANALYTICS_COLLECT_PATH  = ${prodSecrets ? prodSecrets.COLLECT_PATH : '<existing production path>'}`);
log(dim('  The path must equal the production worker\'s COLLECT_PATH exactly.'));

log(`\n${bold('Paste into Cloudflare Pages')} ${dim('(project → Settings → Environment variables)')}`);
log(`  NODE_VERSION=22`);
log(`  PUBLIC_ANALYTICS_ORIGIN=${stagingOrigin}`);
log(`  PUBLIC_ANALYTICS_COLLECT_PATH=${stagingSecrets.COLLECT_PATH}`);
log(`  PUBLIC_NOINDEX=1`);

log(`\n${bold('Next')}`);
log(`  1. pnpm build && pnpm preview           ${dim('writes to the staging DB only')}`);
log(`  2. npx wrangler d1 execute ${PROD.db} --remote --command "SELECT COUNT(*) FROM pageviews"`);

log(`\n${yellow('Note:')} this terminal's scrollback now contains the secrets.`);
log(dim('Re-running this script mints a new set for every environment it touches.'));

if (!allGood) {
  log(`\n${red('Some checks failed — scroll up; the failing lines are marked with x.')}`);
}
rl.close();
