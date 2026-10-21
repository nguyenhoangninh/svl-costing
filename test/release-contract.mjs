import fs from 'node:fs';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++; };
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const cfg = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const phase3 = fs.readFileSync(new URL('../src/views/phase3.js', import.meta.url), 'utf8');

const v = pkg.version;
ok('package version = 1.14.93', v === '1.14.93');
ok('APP_VERSION matches package version', cfg.includes(`web ${v}`));
ok('PWA cache version matches package version', sw.includes(`const VERSION = 'v${v}'`));
ok('README release header matches package version', readme.includes(`v${v} `));
ok('STEP 5R module is precached', sw.includes("'./src/engine/return.js'"));
ok('STEP 5P (Dự phòng FG) is a visible process navigation item', app.includes("{ id: 'provision', no: '5P'") && app.includes("import * as PV from './views/provision.js'"));
ok('STEP 5P has a dedicated route/view', app.includes('VIEWS.provision = (el) => PV.view(el)'));
ok('STEP 5P module is precached', sw.includes("'./src/views/provision.js'"));
ok('STEP 5P is documented in scope', readme.includes('| STEP 5P |'));
ok('STEP 5R is documented in scope', readme.includes('| STEP 5R |'));
ok('STEP 5R is a visible process navigation item', app.includes("{ id: 'salesreturn', no: '5R'"));
ok('STEP 5R has a dedicated route/view', app.includes('VIEWS.salesreturn') && phase3.includes('export function viewReturns'));
ok('sign-in uses dedicated auth screen', app.includes("document.body.classList.add('auth-screen')") && html.includes('.auth-login'));
ok('phone auth layout is responsive', html.includes('@media (max-width: 699px)') && html.includes('.auth-signin'));
ok('CSP is present', html.includes('Content-Security-Policy'));
ok('CSP blocks object content', html.includes("object-src 'none'"));
ok('referrer policy is present', html.includes('strict-origin-when-cross-origin'));
ok('no personal email committed in firestore.rules', rules.includes('YOUR_EMAIL@gmail.com') && !/[a-z0-9._-]+@gmail\.com/i.test(rules.replace(/YOUR_EMAIL@gmail\.com/g, '')));
ok('npm test includes retention contracts', String(pkg.scripts && pkg.scripts.test).includes('rules-contract.mjs'));
ok('Dashboard doanh thu · GP is a visible navigation item with its own route', app.includes("{ id: 'dashboard'") && app.includes('VIEWS.dashboard = (el) => DBV.view(el)'));
ok('dashboard, customer P&L and journal modules are precached', ['./src/views/dashboard.js', './src/engine/custpl.js', './src/engine/journal.js'].every((f) => sw.includes(`'${f}'`)));
ok('JE07 is split by customer in the journal and export', app.includes('journalWithCustomers(ctx)') && app.includes('async function exportHachToan') && app.includes('SVL_Bang_Tong_Hop_Hach_Toan_'));
ok('dashboard chart styles use theme tokens (dark mode follows)', html.includes('.dash-svg') && html.includes('.dash-gp { fill: var(--accent)'));
ok('dashboard is documented in README', readme.includes('Dashboard doanh thu & GP'));
ok('dashboard plan is saved with the period (dashPlan blob)', app.includes('...DBV.DASH_BLOBS') && fs.readFileSync(new URL('../src/views/dashboard.js', import.meta.url), 'utf8').includes("DASH_BLOBS = ['dashPlan']"));
ok('journal summary export has the product sheet', app.includes("'3_TongHop_SanPham'"));
ok('5P provision movement gates CLOSE (AUD-08)', phase3.includes('export function provisionGate') && phase3.includes('const pg = provisionGate(S, res); if (pg) closeReason = pg;'));
const ci = fs.readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
ok('dashboard render test runs in npm test', String(pkg.scripts.test).includes('dashboard-render.mjs'));
// v1.14.81 (audit AUD-12): CI runs the full npm test list, plus the release contracts
ok('CI runs the full npm test suite and the release contracts', /run: npm test\b/.test(ci) && ci.includes('node test/release-contract.mjs'));
ok('CI lists no test that npm test leaves out (single test manifest)', ['nrv-decision', 'provision-logic', 'i18n-vi', 'export-form', 'xlsxstyle'].every((t) => String(pkg.scripts.test).includes(t)));

// v1.14.86 (audit wave 2)
const storeSrc = fs.readFileSync(new URL('../src/store.js', import.meta.url), 'utf8');
ok('AUD-02: previous period is read verified against the cloud revision', app.includes('async function readPeriodVerified(') && app.includes("readPeriodVerified(p, ['step3', 'register', 'closed', 'step5', 'nrvDecision'])") && storeSrc.includes('export async function cloudLoad(period, onProgress, names = null)'));
ok('AUD-02: unverified previous period blocks CLOSE', phase3.includes('S.prevVerifyErr && !(d.closed && d.closed.period === S.period)) closeReason = S.prevVerifyErr;'));
ok('AUD-02: FG / provision opening compared with last closing', phase3.includes('export function fgOpenDrift(') && app.includes('P3.fgOpenDrift(S, prevD, p)'));
ok('AUD-03: REOPEN reads the next period status from the cloud', phase3.includes('nm = await A.cloudMeta(np)'));
ok('NEW-05: dashboard comparison uses the verified reader', app.includes('readPeriod: (p, names) => readPeriodVerified(p, names)') && fs.readFileSync(new URL('../src/views/dashboard.js', import.meta.url), 'utf8').includes('A.readPeriod(p, [\'step5\'])'));
ok('audit report kept with the code', fs.existsSync(new URL('../docs/audit/SVL_Costing_Audit_v1.14.89.docx', import.meta.url)));
// v1.14.87 (audit NEW-01): a whole synthetic period runs in the browser in CI, and deploy / Rules publish wait for it
ok('CI runs the synthetic browser period and gates deploy + rules on it', /\n  e2e:\n/.test(ci) && ci.includes('node test/e2e-synthetic.mjs') && (ci.match(/needs: \[checks, e2e\]/g) || []).length === 2);
ok('synthetic data is shared by the engine and browser tests', fs.readFileSync(new URL('./synth.mjs', import.meta.url), 'utf8').includes("from './support/synth-data.mjs'") && fs.existsSync(new URL('./support/synth-files.mjs', import.meta.url)));
// v1.14.88 (audit AUD-06)
const step2Src = fs.readFileSync(new URL('../src/engine/step2.js', import.meta.url), 'utf8');
ok('AUD-06: marked consumption lines carry a snapshot and are reconciled before STEP 2', step2Src.includes('export function consumeReconcile(') && app.includes('snap: consSnapOf(set)') && app.includes("case 'cons-reconcile':") && /const rec = consRec\(\);\s*\n\s*if \(!rec\.ok\) \{ toast\(`STEP 2 bị chặn/.test(app));
ok('AUD-06: without # the Stock Out line key is built from content, not row position', step2Src.includes("['@', txt(r[c.date]), num(r[c.qty]).toFixed(4), num(r[c.amt]).toFixed(0)]"));
// v1.14.89 (audit AUD-01 / 09 / 10)
const syncSrc = fs.readFileSync(new URL('../src/engine/syncpolicy.js', import.meta.url), 'utf8');
ok('AUD-01/09: CLOSE and REOPEN decide their outcome from the cloud pointer (transition id)', syncSrc.includes('export function transitionOutcome(') && (phase3.match(/SP\.transitionOutcome\(/g) || []).length === 2 && !phase3.includes('const committed = r.ok ||'));
ok('AUD-10: the transition is committed in the pointer and the revision document', storeSrc.includes('if (opts.transition) meta.transition =') && storeSrc.includes('...(meta.transition ? { transition: meta.transition } : {})'));
// v1.14.91 (audit wave A: ACC-01, ACC-02 / 05, SEC-03)
const dqSrc = fs.readFileSync(new URL('../src/engine/dataquality.js', import.meta.url), 'utf8');
const jSrc = fs.readFileSync(new URL('../src/engine/journal.js', import.meta.url), 'utf8');
ok('ACC-02: unreadable text numbers block STEP 2 and cannot be confirmed', dqSrc.includes('export function textReadable(') && dqSrc.includes("return 'BLOCK - FIX DATA'") && app.includes("if (dqSt === 'BLOCK - FIX DATA')"));
ok('ACC-01: journal lines in whole VND, JE07 by customer adds up to JE07 rounded', jSrc.includes('export function roundToTotal(') && jSrc.includes('export function journalRoundCheck(') && app.includes('journalRoundCheck(ctx)'));
ok('SEC-03: no inline script and no \'unsafe-inline\' in script-src', !/<script>(?!<\/script>)/.test(html) && !/script-src[^;]*'unsafe-inline'/.test(html) && html.includes('<script src="src/theme.js"></script>') && sw.includes("'./src/theme.js'"));
// v1.14.92 (audit wave B: ACC-03, SEC-05, SEC-02)
const p2Src = fs.readFileSync(new URL('../src/views/phase2.js', import.meta.url), 'utf8');
ok('ACC-03: STEP 4 and STEP 5 results carry the calculation revision and go OUTDATED when it changes', fs.existsSync(new URL('../src/engine/calcrev.js', import.meta.url)) && p2Src.includes('calcRev: CALC_REV.step4') && p2Src.includes("calcRevReason('step4'") && phase3.includes('calcRev: CALC_REV.step5') && phase3.includes("calcRevReason('step5'") && sw.includes("'./src/engine/calcrev.js'"));
ok('SEC-05: Firestore Rules and backup restore run on the Emulator inside the required e2e job', /\n  e2e:\n[\s\S]*emulators:exec --only firestore[^\n]*node test\/rules-emulator\.mjs && node test\/backup-roundtrip\.mjs[\s\S]*\n  deploy:/.test(ci));
const bk = fs.existsSync(new URL('../.github/workflows/backup.yml', import.meta.url)) ? fs.readFileSync(new URL('../.github/workflows/backup.yml', import.meta.url), 'utf8') : '';
ok('SEC-02: weekly backup is encrypted and skipped without a passphrase', bk.includes('schedule:') && bk.includes('openssl enc -aes-256-cbc -pbkdf2') && bk.includes('BACKUP_PASSPHRASE') && !/upload-artifact[\s\S]*\.ndjson\.gz\n/.test(bk));
ok('TST-01: cloud, language and export browser tests run in CI on synthetic data', ['e2e-cloud.mjs', 'e2e-i18n.mjs', 'e2e-exports.mjs'].every((t) => ci.includes(`node test/${t} http://127.0.0.1:8765/`)) && !fs.readFileSync(new URL('./e2e-cloud.mjs', import.meta.url), 'utf8').includes('costing.xlsm'));
ok('own in-flight save is not taken for a remote change (false conflict)', app.includes('S.inflight[period] > 0') && app.includes('} finally { S.inflight[p]--; }'));
// v1.14.93 Xưởng giá thành
ok('Xưởng giá thành has its navigation item, route, modules precached and a browser check', app.includes("{ id: 'workshop'") && app.includes('VIEWS.workshop = (el) =>') && ["'./src/views/workshop.js'", "'./src/engine/workshop.js'"].every((f) => sw.includes(f)) && fs.readFileSync(new URL('./e2e-synthetic.mjs', import.meta.url), 'utf8').includes('#ws-canvas'));
console.log(`\n${total - fail}/${total} v${v} release contracts passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
