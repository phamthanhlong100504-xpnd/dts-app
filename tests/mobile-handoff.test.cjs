/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function transpile(filename) { return ts.transpileModule(fs.readFileSync(path.join(root, filename), 'utf8'), { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
} }).outputText; }
const nodes = (tree) => Array.isArray(tree) ? tree.flatMap(nodes) : !tree?.props ? [] : [tree, ...nodes(tree.props.children)];
function access({ state = { session: null, version: 4 }, actions = {} } = {}) {
  const exports = {};
  vm.runInNewContext(transpile('src/features/session/components/study-access.tsx'), { exports, require: (id) => {
    if (id === 'react') return { Fragment: 'Fragment' };
    if (id === 'react/jsx-runtime') return require(id);
    if (id === 'react-native') return { View: 'View', Text: 'Text', Pressable: 'Pressable' };
    if (id === 'expo-router') return { Stack: { Screen: 'StackScreen' } };
    if (id.endsWith('/session-store')) return { useLearnerSession: (selector) => selector(state) };
    if (id.endsWith('/study-host')) return { useStudyHost: () => actions };
    if (id === './study-license-picker') return { LicenseChoices: 'LicenseChoices' };
    throw new Error('Unexpected dependency: ' + id);
  } });
  return exports.StudyAccess({ children: 'owned-task-screen' });
}
test('production auth delegates to the supplied host action and never mounts standalone login or the protected task before sign-in', () => {
  let opens = 0;
  const tree = access({ actions: { openSignIn: () => opens++ } });
  assert.ok(!nodes(tree).some((node) => node.type === 'DevSignIn'));
  assert.ok(!JSON.stringify(tree).includes('owned-task-screen'));
  const button = nodes(tree).find((node) => node.type === 'Pressable'); assert.ok(button); button.props.onPress(); assert.equal(opens, 1);
});
test('unfinished host navigation does not fabricate a login route, default user or A1 session', () => {
  const tree = access(); assert.ok(!nodes(tree).some((node) => node.type === 'Pressable' || node.type === 'DevSignIn'));
  assert.ok(!JSON.stringify(tree).includes('owned-task-screen'));
});
test('verified account and license open the same task; account/license/version changes remount its UI scope', () => {
  const make = (id, license, version) => access({ state: { session: { profile: { id, selectedLicenseClass: license } }, version } });
  const a = make('student-a', 'A1', 4); assert.equal(a.props.children, 'owned-task-screen');
  for (const other of [make('student-b', 'A1', 4), make('student-a', 'B', 4), make('student-a', 'A1', 5)]) assert.notEqual(other.key, a.key);
  const unselected = make('student-a', null, 4); assert.ok(nodes(unselected).some((node) => node.type === 'LicenseChoices'));
  assert.ok(!JSON.stringify(unselected).includes('owned-task-screen'));
});
test('runtime task no longer depends on the archived local business stores or preview question bank', () => {
  function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(path.join(dir, entry.name)) : /\.(ts|tsx)$/u.test(entry.name) ? [path.join(dir, entry.name)] : []); }
  for (const filename of walk(path.join(root, 'src'))) {
    const source = fs.readFileSync(filename, 'utf8');
    assert.ok(!/usePracticeStore|useStudyContext|previewQuestions|features\/study\//u.test(source), filename);
  }
  for (const filename of ['src/store/usePracticeStore.ts', 'src/store/useStudyContext.ts', 'src/data/previewQuestions.ts', 'src/features/study/api.ts']) assert.equal(fs.existsSync(path.join(root, filename)), false);
});

test('product source has no temporary preview route, development login or local publish imports', () => {
  for (const name of ['src/app/study-preview.tsx', 'src/devtools/study-preview-config.ts', 'tools/publish-study-task.py']) assert.equal(fs.existsSync(path.join(root, name)), false);
  for (const name of ['src/features/session/components/study-access.tsx', 'src/features/session/components/study-license-picker.tsx']) assert.ok(!/devtools|Preview|STUDY_PREVIEW/u.test(fs.readFileSync(path.join(root, name), 'utf8')));
});
