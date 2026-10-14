// Cloud Functions entry point (audit ENH-06). Deploy with `firebase deploy --only functions` on a project that has the
// Blaze plan. OWNER_EMAILS: comma-separated owner emails (lowercase) – owners are admins, as in firestore.rules.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as core from './src/approvalCore.mjs';

initializeApp();
const db = getFirestore();
const owners = () => String(process.env.OWNER_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean);
const REGION = 'asia-southeast1';

async function run(fn, req) {
  try {
    return await fn({ db, auth: req.auth, data: req.data, owners: owners(), now: new Date().toISOString() });
  } catch (e) {
    const code = ['unauthenticated', 'permission-denied', 'invalid-argument', 'failed-precondition'].includes(e.code) ? e.code : 'internal';
    throw new HttpsError(code, e.message || 'Lỗi máy chủ.');
  }
}
export const requestApproval = onCall({ region: REGION }, (req) => run(core.requestApproval, req));
export const approveApproval = onCall({ region: REGION }, (req) => run(core.approveApproval, req));
