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
ok('package version = 1.14.86', v === '1.14.86');
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
ok('audit report kept with the code', fs.existsSync(new URL('../docs/audit/SVL_Costing_Audit_v1.14.86.docx', import.meta.url)));
console.log(`\n${total - fail}/${total} v${v} release contracts passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
