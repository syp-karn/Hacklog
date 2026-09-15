/**
 * Pure helpers for editing wrangler.toml from the setup script.
 *
 * Every function here is text → text so it can be exercised against a scratch
 * copy of the real config in tests; the setup script owns all file I/O.
 *
 * The whole scheme rests on one structural fact: the TOP-LEVEL block is
 * production and everything from `[env.staging]` onward is staging. That gives
 * exactly two regions, each holding one `database_id` and one
 * `ALLOWED_ORIGINS`.
 */

/**
 * Marker between the production (top-level) and staging regions.
 * Tolerates CRLF: git's autocrlf on Windows rewrites this file with \r\n, and
 * an exact '\n[env.staging]\n' match would then never hit.
 */
const STAGING_MARKER = /\r?\n\[env\.staging\]\r?\n/;

export function splitToml(text) {
  const m = text.match(STAGING_MARKER);
  if (!m || m.index === undefined) {
    throw new Error('wrangler.toml has no [env.staging] section — restore it, then re-run.');
  }
  return { prod: text.slice(0, m.index), staging: text.slice(m.index) };
}

/** Current `ALLOWED_ORIGINS` value for a region, for use as a prompt default. */
export function currentOrigins(text, isStaging) {
  const region = splitToml(text)[isStaging ? 'staging' : 'prod'];
  return (region.match(/ALLOWED_ORIGINS\s*=\s*"([^"]*)"/) ?? [])[1] ?? '';
}

/**
 * Set database ids in place. A null id means "leave this region alone", which
 * is what `--staging-only` needs so it cannot touch production config.
 * Only the FIRST `database_id` in each region is rewritten, so any commented-out
 * example below it survives untouched.
 */
export function setDatabaseIds(text, { prodId = null, stagingId = null } = {}) {
  const { prod, staging } = splitToml(text);

  const one = (region, id, label) => {
    if (!id) return region;
    if (!/database_id\s*=\s*"[^"]*"/.test(region)) {
      throw new Error(`no database_id placeholder found in the ${label} section of wrangler.toml.`);
    }
    return region.replace(/database_id\s*=\s*"[^"]*"/, `database_id = "${id}"`);
  };

  return one(prod, prodId, 'production') + one(staging, stagingId, 'staging');
}

/** Set `ALLOWED_ORIGINS` per region. An empty value leaves that region alone. */
export function setOrigins(text, { prodOrigins = null, stagingOrigins = null } = {}) {
  const { prod, staging } = splitToml(text);

  const one = (region, value) =>
    value ? region.replace(/ALLOWED_ORIGINS\s*=\s*"[^"]*"/, `ALLOWED_ORIGINS = "${value}"`) : region;

  return one(prod, prodOrigins) + one(staging, stagingOrigins);
}

/** Sanity check used by the setup script before it writes anything. */
export function databaseIdFor(text, isStaging) {
  const region = splitToml(text)[isStaging ? 'staging' : 'prod'];
  return (region.match(/database_id\s*=\s*"([^"]*)"/) ?? [])[1] ?? null;
}
