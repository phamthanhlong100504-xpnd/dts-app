/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function harness() {
  const slots = [], effects = [], callbacks = [], jobs = [], calls = [];
  let cursor = 0, effectCursor = 0, callbackCursor = 0, version = 1, license = 'A1', appState;
  const session = (selector) => selector({ version, session: { profile: { selectedLicenseClass: license } } });
  session.getState = () => ({ version });
  const exports = {}, full = path.resolve(__dirname, '..', 'src/features/session/use-learner-resource.ts');
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) { const i = callbackCursor++, previous = callbacks[i];
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) callbacks[i] = { fn, deps }; return callbacks[i].fn; },
    useEffect(fn, deps) { const i = effectCursor++, previous = effects[i];
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) jobs.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const loader = () => { const operation = deferred(); calls.push(operation); return operation.promise; };
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Error, require: (id) => {
    if (id === 'react') return react;
    if (id === 'react-native') return { AppState: { addEventListener(_, callback) { appState = callback; return { remove() {} }; } } };
    if (id === 'expo-router') return { useFocusEffect(fn) { react.useEffect(fn, [fn]); } };
    if (id === './session-store') return { useLearnerSession: session };
    throw new Error('Unexpected dependency ' + id);
  } }, { filename: full });
  return { calls, switchScope() { version++; license = 'B'; }, foreground: () => appState('active'),
    render(key = 'wrong') { cursor = 0; effectCursor = 0; callbackCursor = 0;
      const value = exports.useLearnerResource(key, loader); while (jobs.length) jobs.shift()(); return value; } };
}
test('read snapshots disappear immediately across account/license changes and late reads are discarded', async () => {
  const h = harness(); h.render(); h.calls[0].resolve({ name: 'student A' }); await tick(); assert.equal(h.render().data.name, 'student A');
  h.switchScope(); assert.equal(h.render().data, null); h.calls[1].resolve({ name: 'student B' }); await tick(); assert.equal(h.render().data.name, 'student B');
  h.render('history'); h.switchScope(); h.render('history'); h.calls[2].resolve({ name: 'old response' }); await tick(); assert.equal(h.render('history').data, null);
});
test('changing history filters discards an out-of-order previous response', async () => {
  const h = harness(); h.render('random'); h.render('preset'); h.calls[1].resolve({ activity: 'preset' }); await tick();
  assert.equal(h.render('preset').data.activity, 'preset'); h.calls[0].resolve({ activity: 'random' }); await tick(); assert.equal(h.render('preset').data.activity, 'preset');
});
test('read errors remain visible and retry/foreground reload the canonical resource', async () => {
  const h = harness(); h.render(); h.calls[0].reject(new Error('Result unavailable')); await tick();
  let value = h.render(); assert.equal(value.error, 'Result unavailable'); assert.equal(value.data, null);
  value.reload(); value = h.render(); assert.equal(value.loading, true); h.calls[1].resolve({ total: 0 }); await tick();
  assert.equal(h.render().data.total, 0); h.foreground(); assert.equal(h.render().data, null); assert.equal(h.calls.length, 3);
});
