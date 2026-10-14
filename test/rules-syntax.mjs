// Lightweight lexical sanity check: catches unbalanced rules constructs BEFORE production publish.
// This does not replace compilation/execution in the Firestore Emulator.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const expected = [
  'match /svl_costing_notifications/{id}',
  'match /svl_costing_notification_reads/{uid}',
  'match /svl_costing_audit/{id}',
  "period.matches('^[0-9]{4}-[0-9]{2}$')",
];
for (const text of expected) assert.ok(source.includes(text), 'Required rule not found: ' + text);
for (const m of ['svl_costing_notifications', 'svl_costing_notification_reads', 'svl_costing_audit']) {
  assert.equal((source.match(new RegExp('match /' + m + '/\\\\{', 'g')) || []).length, 1, 'Exactly one match block expected for ' + m);
}
let stack = [], mode = 'code', line = 1, closing = { '{': '}', '(': ')', '[': ']' };
for (let i=0; i<source.length; i++) {
  const c=source[i], n=source[i+1];
  if(c==='\n'){line++; if(mode==='comment')mode='code'; continue;}
  if(mode==='comment')continue;
  if(mode==='single'||mode==='double'){
    if(c==='\\'){i++;if(source[i]==='\n')line++;continue;}
    if(c===(mode==='single'?"'":'"'))mode='code';
    continue;
  }
  if(c==='/'&&n==='/'){mode='comment';i++;continue;}
  if(c==="'"){mode='single';continue;}
  if(c==='"'){mode='double';continue;}
  if(closing[c])stack.push({c,line});
  else if('})]'.includes(c)){
    const p=stack.pop();
    assert.ok(p&&closing[p.c]===c, `Mismatched ${c} at line ${line}, opener ${p?.c||'none'} at ${p?.line||'-'}`);
  }
}
assert.equal(mode,'code','Unterminated Firestore string/comment at end of file');
assert.equal(stack.length,0,'Unclosed group: '+JSON.stringify(stack.slice(-3)));
console.log('PASS: Firestore Rules lexical balance and all notification match blocks');
