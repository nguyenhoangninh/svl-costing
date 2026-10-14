// Audit event identity (audit ENH-08, v1.14.35).
// An event records WHO did it and WHEN at the moment the action happens. Upload later never re-attributes it:
// - an event with actorUid may be uploaded only while that same Firebase uid is signed in (attribution ACTOR);
// - an event created without a verified actor (no sign-in, or queued before this version) is uploaded under the
//   email of whoever is signed in, flagged attribution UNVERIFIED, so reviewers can tell it apart.
// Pure functions only: no Firebase, no IndexedDB. store.js wires them to the cloud.

export const AUDIT_SCHEMA = 2;

/** Random id for one event; used as the Firestore document id so a repeated upload is idempotent. */
export function newEventId(cryptoObj = globalThis.crypto) {
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') return cryptoObj.randomUUID();
  const b = new Uint8Array(16);
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') cryptoObj.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

const low = (s) => String(s ?? '').trim().toLowerCase();

/**
 * Build an immutable event. `actor` is {uid, email, role} captured now (null when nobody is signed in).
 * `at` is the client clock at the action (kept for display; the server time is added at upload).
 */
export function makeAuditEvent({ period, action, detail, app, at, actor = null, deviceId = '', eventId }) {
  const verified = !!(actor && actor.uid);
  return {
    schema: AUDIT_SCHEMA,
    eventId: eventId || newEventId(),
    period: String(period || ''),
    action: String(action || ''),
    detail: String(detail ?? '').slice(0, 2000),
    app: String(app || ''),
    at: String(at || new Date().toISOString()),
    deviceId: String(deviceId || ''),
    attribution: verified ? 'ACTOR' : 'UNVERIFIED',
    actorUid: verified ? String(actor.uid) : '',
    actorEmail: verified ? low(actor.email) : '',
    actorRole: verified ? String(actor.role || '') : '',
  };
}

/** Queue entries written before v1.14.35 have no eventId/attribution: give them an id and mark them UNVERIFIED. */
export function normalizeQueue(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((e) => e && typeof e === 'object').map((e) => (e.eventId && e.attribution
    ? e
    : { schema: AUDIT_SCHEMA, deviceId: '', actorUid: '', actorEmail: '', actorRole: '', attribution: 'UNVERIFIED', ...e, eventId: e.eventId || newEventId(), at: e.at || new Date().toISOString() }));
}

/** May the signed-in user (uid) upload this event now? Events of another verified actor stay queued. */
export const mayUpload = (evt, uid) => !evt.actorUid || (!!uid && evt.actorUid === uid);

/**
 * The Firestore document for one event. `by` must equal the signed-in email (firestore.rules enforce it):
 * for ACTOR events that is the actor (== uploader by construction); for UNVERIFIED events it is the uploader.
 */
export function toAuditDoc(evt, uploader) {
  const actor = evt.attribution === 'ACTOR';
  return {
    schema: evt.schema || AUDIT_SCHEMA,
    eventId: evt.eventId,
    period: evt.period,
    action: evt.action,
    detail: evt.detail,
    app: evt.app,
    at: evt.at,
    deviceId: evt.deviceId || '',
    attribution: actor ? 'ACTOR' : 'UNVERIFIED',
    actorUid: actor ? evt.actorUid : '',
    actorEmail: actor ? evt.actorEmail : '',
    by: low(uploader.email),
    role: actor ? (evt.actorRole || uploader.role || '') : (uploader.role || ''),
  };
}

/** Split the queue into what this uid can upload now and what must wait for its actor. */
export function partitionQueue(queue, uid) {
  const ready = [], waiting = [];
  for (const e of queue) (mayUpload(e, uid) ? ready : waiting).push(e);
  return { ready, waiting };
}
