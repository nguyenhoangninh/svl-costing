import fs from 'node:fs';

let total = 0, fail = 0;
const ok = (label, cond) => { total++; console.log(`${cond ? '✓' : '✗'} ${label}`); if (!cond) fail++; };
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const cfg = fs.readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
const sw = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

const v = pkg.version;
ok('package version = 1.10.0', v === '1.10.0');
ok('APP_VERSION matches package version', cfg.includes(`web ${v}`));
ok('PWA cache version matches package version', sw.includes(`const VERSION = 'v${v}'`));
ok('README release header matches package version', readme.includes(`v${v} STEP 5R & Close Integrity`));
ok('STEP 5R module is precached', sw.includes("'./src/engine/return.js'"));
ok('STEP 5R is documented in scope', readme.includes('| STEP 5R |'));
ok('CSP is present', html.includes('Content-Security-Policy'));
ok('CSP blocks object content', html.includes("object-src 'none'"));
ok('referrer policy is present', html.includes('strict-origin-when-cross-origin'));
ok('production Firestore owner is source-controlled', rules.includes("kamenguyen@gmail.com"));
ok('placeholder owner is absent', !rules.includes('YOUR_EMAIL@gmail.com'));
ok('npm test includes retention contracts', String(pkg.scripts && pkg.scripts.test).includes('rules-contract.mjs'));

console.log(`\n${total - fail}/${total} v${v} release contracts passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
