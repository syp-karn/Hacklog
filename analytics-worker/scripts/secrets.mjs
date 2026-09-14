/**
 * Secret derivation, shared by new-secrets.mjs (print a set) and setup.mjs
 * (generate and install a set).
 *
 * Everything comes from 32 bytes of CSPRNG entropy. Paths are SHA-256 reduced to
 * 32 hex chars so they are URL-safe and have no separators to escape; tokens are
 * base64url with 256 bits of entropy.
 */

import { createHash, randomBytes } from 'node:crypto';

/** `/<32 hex chars>` — unguessable, URL-safe, no separator to escape. */
export const newPath = (label) =>
  '/' + createHash('sha256').update(`${label}:${randomBytes(32).toString('hex')}`).digest('hex').slice(0, 32);

/** 43 chars, base64url — for the bearer-style token and the IP-hash salt. */
export const newToken = () => randomBytes(32).toString('base64url');

/** The four names the worker reads out of `env`. */
export const SECRET_NAMES = ['COLLECT_PATH', 'STATS_PATH', 'STATS_TOKEN', 'COLLECT_SALT'];

/** A complete, independent set — call once per environment. */
export function makeSecretSet() {
  return {
    COLLECT_PATH: newPath('collect'),
    STATS_PATH: newPath('stats'),
    STATS_TOKEN: newToken(),
    COLLECT_SALT: newToken(),
  };
}
