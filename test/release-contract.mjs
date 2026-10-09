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
ok('package version = 1.14.4', v === '1.14.4');
ok('APP_VERSION matches package version', cfg.includes(`web ${v}`));
ok('PWA cache version matches package version', sw.includes(`const VERSION = 'v${v}'`));
ok('README release header matches package version', readme.includes(`v${v} `));
ok('STEP 5R module is precached', sw.includes("'./src/engine/return.js'"));
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

console.log(`\n${total - fail}/${total} v${v} release contracts passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
