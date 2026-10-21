/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function viewHarness(filename, names, context = {}) {
  const full = path.resolve(__dirname, '..', filename), exports = {}, slots = [], navigation = [];
  let cursor = 0;
  let source = fs.readFileSync(full, 'utf8');
  for (const name of names) source = source.replace(`function ${name}(`, `export function ${name}(`);
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const loadFormat = () => {
    const result = {};
    const output = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src/features/history/history-format.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    vm.runInNewContext(output, { exports: result, Date }); return result;
  };
  vm.runInNewContext(code, { exports, require: (id) => {
    if (id === 'react/jsx-runtime') return require(id);
    if (id === 'react') return { useCallback: (fn) => fn, useState: (initial) => {
      const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    } };
    if (id === 'react-native') return Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'FlatList', 'ActivityIndicator', 'RefreshControl'].map((name) => [name, name]));
    if (id === 'expo-symbols') return { SymbolView: 'SymbolView' };
    if (id === 'expo-router') return { Stack: { Screen: 'StackScreen' }, router: { push: (target) => navigation.push(target) }, useLocalSearchParams: () => ({ resultId: 'owned-result-id' }) };
    if (id.endsWith('/history-format')) return loadFormat();
    if (id.endsWith('/history-service')) return { getHistoryOverview: (license, filters) => { context.loads.push([license, filters]); return Promise.resolve(context.data); } };
    if (id.endsWith('/study-access')) return { StudyAccess: 'StudyAccess' };
    if (id.endsWith('/study-license-picker')) return { StudyLicensePicker: 'StudyLicensePicker' };
    if (id.endsWith('/session-store')) return { useLearnerSession: (selector) => selector({ session: { profile: { selectedLicenseClass: 'A1' } } }) };
    if (id.endsWith('/use-learner-resource')) return { useLearnerResource: (_key, loader) => {
      context.loader = loader; return { data: context.data ?? null, loading: false, error: null, reload() {} };
    } };
    if (id.endsWith('/question-image')) return { QuestionImage: 'QuestionImage' };
    if (id.endsWith('/chapter-question-content')) return { splitExplanationParagraphs: (value) => [value] };
    throw new Error('Unexpected UI dependency: ' + id);
  } });
  return { render(name, props) { cursor = 0; return exports[name](props); }, navigation };
}
const nodes = (tree) => Array.isArray(tree) ? tree.flatMap(nodes) : !tree?.props ? [] : [tree, ...nodes(tree.props.children)];
const text = (tree) => Array.isArray(tree) ? tree.map(text).join('') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree);
const historyFile = 'src/features/history/components/history-screen.tsx';
const reviewFile = 'src/features/history/components/history-review-screen.tsx';
const item = { id: '20000000-0000-4000-8000-000000000001', sourceId: '30000000-0000-4000-8000-000000000001',
  title: 'Tên đề từ máy chủ', activityType: 'RANDOM_EXAM', licenseClass: 'A1', result: 'FAILED', correctCount: 2, questionCount: 25,
  completedAt: '2026-10-21T05:00:00Z', durationSeconds: 754, score: 80, maxScore: 100 };
test('the whole history card opens its owned Result ID directly without expansion or confusing it with the Practice ID', () => {
  const view = viewHarness(historyFile, ['HistoryCard']);
  for (const activityType of ['RANDOM_EXAM', 'PRESET_EXAM']) {
    const tree = view.render('HistoryCard', { item: { ...item, activityType } });
    assert.equal(tree.type, 'Pressable'); assert.equal(tree.props.accessibilityState?.expanded, undefined);
    assert.ok(!/Xem chi tiết|Thu gọn/u.test(text(tree)));
    assert.ok(text(tree).includes('2 đúng')); assert.ok(text(tree).includes('23 chưa đúng'));
    tree.props.onPress(); const target = view.navigation.at(-1);
    assert.equal(target.pathname, '/history/[resultId]'); assert.equal(target.params.resultId, item.id); assert.notEqual(target.params.resultId, item.sourceId);
  }
});
test('history tabs keep only random and preset, reset pagination and request all results/all time through the existing API', async () => {
  const context = { loads: [], data: { summary: { total: 200, passed: 80, failed: 120 }, items: [], totalPages: 4 } };
  const view = viewHarness(historyFile, ['HistoryContent'], context);
  let tree = view.render('HistoryContent', { licenseClass: 'A1' });
  assert.ok(!/Theo hạng|Mọi kết quả|Mọi thời gian|7 ngày|30 ngày/u.test(text(tree)));
  const summary = nodes(tree).filter((node) => typeof node.type === 'function' && node.type.name === 'SummaryCell');
  assert.deepEqual(summary.map((node) => node.props.value), [200, 80, 120]);
  const button = (label) => nodes(tree).find((node) => node.type === 'Pressable' && text(node) === label);
  button('Trang tiếp').props.onPress(); tree = view.render('HistoryContent', { licenseClass: 'A1' }); await context.loader();
  assert.equal(context.loads.at(-1)[1].page, 1);
  button('Bộ đề có sẵn').props.onPress(); tree = view.render('HistoryContent', { licenseClass: 'A1' }); await context.loader();
  assert.equal(context.loads.at(-1)[0], 'A1'); assert.deepEqual({ ...context.loads.at(-1)[1] }, { activity: 'PRESET_EXAM', outcome: 'ALL', period: 'ALL', page: 0 });
  assert.equal(nodes(tree).filter((node) => node.type === 'Pressable' && /Ngẫu nhiên|Bộ đề có sẵn/u.test(text(node))).length, 2);
});
test('review score uses canonical correct/total for both exam types and license sizes even when history stores a percentage', () => {
  const view = viewHarness(reviewFile, ['HistoryReviewSummary']);
  for (const activityType of ['RANDOM_EXAM', 'PRESET_EXAM']) for (const total of [25, 30, 35]) {
    const data = { history: { ...item, activityType }, scope: { licenseClass: 'A1' }, questions: Array(total).fill({}),
      correct: 2, wrong: 3, unanswered: total - 5, passed: false };
    const tree = view.render('HistoryReviewSummary', { data });
    assert.ok(text(tree).includes(`2/${total}`)); assert.ok(!text(tree).includes('80/100'));
    const counts = nodes(tree).filter((node) => typeof node.type === 'function' && node.type.name === 'Count');
    assert.deepEqual(counts.map((node) => node.props.value), [2, 3, total - 5]);
    assert.ok(text(tree).includes(activityType === 'RANDOM_EXAM' ? 'Thi thử ngẫu nhiên' : 'Bộ đề có sẵn'));
  }
});
test('review removes selected-answer wording while preserving canonical answer colors and the source image', () => {
  const view = viewHarness(reviewFile, ['ResultQuestion']);
  const question = { id: 901, text: 'Nội dung đã chấm', selectedAnswer: 'A', referenceAnswer: 'B', isCorrect: false,
    choices: [{ key: 'A', text: 'Đáp án A' }, { key: 'B', text: 'Đáp án B' }], explanation: 'Giải thích gốc', imageUrl: '/saved-question.webp' };
  const data = { questions: [question], scope: { bankVersion: 'historical-bank' } };
  const tree = view.render('ResultQuestion', { question, index: 0, data });
  assert.ok(!text(tree).includes('Bạn đã chọn')); assert.ok(text(tree).includes('Đáp án đúng: B'));
  assert.ok(nodes(tree).some((node) => node.props.style?.backgroundColor === '#FEE2E2'));
  assert.ok(nodes(tree).some((node) => node.props.style?.backgroundColor === '#DCFCE7'));
  const image = nodes(tree).find((node) => node.type === 'QuestionImage'); assert.equal(image.props.question, question); assert.equal(image.props.scope, data.scope);
  assert.equal(nodes(tree).filter((node) => node.type === 'Pressable').length, 0);
});
