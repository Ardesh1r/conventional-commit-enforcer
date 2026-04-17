'use strict';

const { buildPattern, validateSubject } = require('./validate');

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
  if (actual === expected) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ ${description}`);
    console.error(`     expected: ${expected}`);
    console.error(`     received: ${actual}`);
    failed++;
  }
}

const DEFAULT_TYPES = ['feat', 'fix', 'chore', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'revert'];
const DEFAULT_SCOPE = '[a-zA-Z0-9_.\\-]+';

function check(subject, requireScope = false) {
  const pattern = buildPattern(DEFAULT_TYPES, requireScope, DEFAULT_SCOPE);
  return validateSubject(subject, pattern, true);
}

console.log('\n--- Valid messages ---');
assert('simple feat', check('feat: add login page').valid, true);
assert('fix with scope', check('fix(auth): handle expired token').valid, true);
assert('breaking change marker', check('chore!: drop Node 16').valid, true);
assert('breaking change with scope', check('feat(api)!: rename endpoint').valid, true);
assert('chore no scope', check('chore: update dependencies').valid, true);
assert('ci type', check('ci: add matrix builds').valid, true);
assert('revert type', check('revert: revert bad deploy').valid, true);
assert('scope with dot', check('fix(ui.button): fix hover state').valid, true);
assert('scope with dash', check('feat(my-module): add thing').valid, true);
assert('uppercase type (case-insensitive)', check('Feat: add something').valid, true);

console.log('\n--- Invalid messages ---');
assert('no type', check('add login page').valid, false);
assert('wrong type', check('added: new feature').valid, false);
assert('missing space after colon', check('feat:missing space').valid, false);
assert('empty description', check('feat: ').valid, false);
assert('only whitespace description', check('feat:    ').valid, false);
assert('type only', check('feat:').valid, false);

console.log('\n--- Merge commits (should be skipped) ---');
assert('merge commit skipped', check('Merge pull request #1 from foo/bar').skipped, true);
assert('merge commit valid=true when skipped', check('Merge branch main into dev').valid, true);

console.log('\n--- require-scope: true ---');
assert('scope required, scope present', check('feat(core): add thing', true).valid, true);
assert('scope required, scope missing', check('feat: add thing', true).valid, false);

console.log(`\n${'─'.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
