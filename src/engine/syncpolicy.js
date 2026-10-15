// Cloud sync policy (audit ENH-07 / ENH-09 / ENH-10, v1.14.36). Pure functions; app.js and phase3.js use them.

/** Automatic retry after a failed cloud push: 2 s, 4 s, 8 s … capped at 60 s; stops after RETRY_LIMIT attempts. */
export const RETRY_BASE_MS = 2000, RETRY_CAP_MS = 60000, RETRY_LIMIT = 8;
export function retryDelayMs(attempt, base = RETRY_BASE_MS, cap = RETRY_CAP_MS) {
  const n = Math.max(1, Math.floor(Number(attempt) || 1));
  return Math.min(cap, base * 2 ** Math.min(n - 1, 10));
}
/** attempt = number of failed automatic pushes so far (1 = first failure). */
export const shouldRetry = (attempt) => attempt >= 1 && attempt <= RETRY_LIMIT;

/** Periods other than the one on screen whose changes are still waiting for the cloud (outbox). */
export const outboxOthers = (periods, current) => [...new Set((periods || []).filter((p) => p && p !== current))].sort();

/**
 * Did the cloud commit THIS close? closedAt is unique per close attempt, so it doubles as the idempotency key:
 * a CLOSE whose reply was lost (timeout after the commit) is confirmed by the cloud instead of being applied twice.
 */
export const closeCommitted = (meta, closedAt) => !!(meta && meta.summary && closedAt && meta.summary.closed === closedAt);

/**
 * v1.14.86 (audit AUD-02 / AUD-03 / NEW-05): which copy of another period may be trusted.
 *   OFFLINE   – not signed in: only this device's copy exists (cannot be verified)
 *   ERROR     – the cloud could not be read: the local copy must not be treated as current
 *   NO_CLOUD  – the period is not on the cloud: this device's copy is the only one
 *   LOCAL     – this device holds the cloud's latest revision
 *   CLOUD     – this device's copy is older or missing: read the cloud
 */
export function periodReadPlan({ signedIn, metaError = null, meta = null, localRev = null }) {
  if (!signedIn) return 'OFFLINE';
  if (metaError) return 'ERROR';
  if (!meta) return 'NO_CLOUD';
  return localRev !== null && localRev !== undefined && localRev === (meta.rev || 0) ? 'LOCAL' : 'CLOUD';
}
