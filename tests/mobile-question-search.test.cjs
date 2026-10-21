/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function hookHarness() {
  const slots = [], effects = [], jobs = [], calls = [];
  let stateCursor = 0, effectCursor = 0, version = 1;
  const session = (selector) => selector({ version }); session.getState = () => ({ version });
  const exports = {}, full = path.resolve(__dirname, '..', 'src/features/chapter-learning/use-question-search.ts');
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, console, Error, require: (id) => {
    if (id === 'react') return {
      useState(initial) { const i = stateCursor++; if (!(i in slots)) slots[i] = initial;
        return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
      useEffect(fn, deps) { const i = effectCursor++, previous = effects[i];
        if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
          jobs.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; });
        } },
    };
    if (id.endsWith('/session-store')) return { useLearnerSession: session };
    if (id === './question-catalog-service') return {
      getBankQuestions(license, bank) { const operation = deferred(); calls.push({ license, bank, ...operation }); return operation.promise; },
      searchQuestionText(rows, query) { return rows.filter((row) => row.question.text.includes(query)); },
    };
    throw new Error('Unexpected hook dependency: ' + id);
  } }, { filename: full });
  return { calls, switchAccount: () => { version++; }, render(query, license = 'A1', bank = 'bank-a') {
    stateCursor = 0; effectCursor = 0;
    const result = exports.useQuestionSearch(query, { licenseClass: license, bankVersion: bank });
    while (jobs.length) jobs.shift()(); return result;
  } };
}
test('typing while the catalog loads uses the latest query and does not refetch on every keystroke', async () => {
  const h = hookHarness(); assert.equal(h.render('xe').loading, true);
  h.render('biển'); assert.equal(h.calls.length, 1);
  h.calls[0].resolve([{ question: { id: 1, text: 'xe tải' } }, { question: { id: 2, text: 'biển báo' } }]); await tick();
  const result = h.render('biển'); assert.equal(result.results.length, 1); assert.equal(result.results[0].question.id, 2);
  h.render('xe'); assert.equal(h.calls.length, 1);
});
test('switching account, license and bank hides old results immediately and discards late responses', async () => {
  const h = hookHarness(); h.render('xe'); h.switchAccount();
  let result = h.render('xe', 'B', 'bank-b'); assert.equal(result.results.length, 0); assert.equal(result.loading, true);
  h.calls[0].resolve([{ question: { id: 1, text: 'xe của A' } }]); await tick();
  result = h.render('xe', 'B', 'bank-b'); assert.equal(result.results.length, 0);
  h.calls[1].resolve([{ question: { id: 99, text: 'xe của B' } }]); await tick();
  result = h.render('xe', 'B', 'bank-b'); assert.equal(result.results[0].question.id, 99);
  h.switchAccount(); result = h.render('xe', 'A1', 'bank-a'); assert.equal(result.results.length, 0);
});
test('a failed catalog read shows the server error and explicit retry can load real results', async () => {
  const h = hookHarness(); h.render('xe'); h.calls[0].reject(new Error('Practice unavailable')); await tick();
  let result = h.render('xe'); assert.equal(result.error, 'Practice unavailable'); assert.equal(result.results.length, 0);
  result.reload(); result = h.render('xe'); assert.equal(result.error, null); assert.equal(result.loading, true); assert.equal(h.calls.length, 2);
  h.calls[1].resolve([{ question: { id: 5, text: 'xe từ Practice' } }]); await tick();
  result = h.render('xe'); assert.equal(result.results[0].question.id, 5); assert.equal(result.error, null);
});
