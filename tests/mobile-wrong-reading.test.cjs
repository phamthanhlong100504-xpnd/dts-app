/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const ok = (data) => Response.json({ success: true, data });
const copy = (value) => JSON.parse(JSON.stringify(value));
function apiHarness(total = 119) {
  const modules = new Map(), calls = []; let fetcher;
  function load(filename) {
    const file = path.resolve(__dirname, '..', filename);
    if (modules.has(file)) return modules.get(file);
    const exports = {}; modules.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, Error, console, URL, Response, AbortController, setTimeout, clearTimeout,
      process: { env: { EXPO_PUBLIC_DTS_API_URL: 'http://172.20.10.3:8888' } },
      fetch: (...args) => { calls.push(args); return fetcher(...args); },
      require: (id) => id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(file), id + '.ts'))) : require(id),
    }, { filename: file }); return exports;
  }
  const store = load('src/features/session/session-store.ts').useLearnerSession;
  const profile = { id: 'student-a', username: 'student', fullName: 'Học viên', email: '', selectedLicenseClass: 'A1' };
  const version = store.getState().beginSignIn(); store.getState().acceptSignIn(version, { accessToken: 'access', refreshToken: 'refresh', profile: copy(profile) });
  const raw = Array.from({ length: total }, (_, index) => ({ questionId: 8001 + index, sourceQuestionId: 138 + index,
    chapterId: index % 6 + 1, questionText: `Nội dung thật ${index}`, options: [{ label: 'A', text: 'Đáp án A' }, { label: 'B', text: 'Đáp án B' }],
    correctAnswer: 'B', selectedAnswer: 'A', isCritical: index % 11 === 0, explanation: '1. Ý đầu. 2. Ý tiếp theo.',
    imageUrl: '/question-images/q138.webp', mediaFileId: null, lastWrongAt: '2026-10-21T00:00:00Z' }));
  let session = null, starts = 0, finishes = 0, answerKeyOverride = null;
  function snapshot() { return copy(session); }
  function start() {
    starts++;
    if (session?.status === 'IN_PROGRESS') return snapshot();
    session = { sessionId: 'owned-wrong-round-' + starts, licenseClass: 'A1', bankVersion: 'server-bank', status: 'IN_PROGRESS',
      totalQuestions: raw.length, currentQuestionId: raw[0]?.questionId, currentPosition: 1,
      questions: raw.map((row, index) => ({ ...copy(row), position: index + 1, previousWrongAnswer: row.selectedAnswer })),
      answers: {}, answeredQuestions: 0, correctCount: 0, wrongCount: 0, unansweredCount: raw.length, remainingCount: raw.length };
    return snapshot();
  }
  function refresh() {
    session.answeredQuestions = Object.keys(session.answers).length;
    session.correctCount = Object.values(session.answers).filter((a) => a.isCorrect).length;
    session.wrongCount = session.answeredQuestions - session.correctCount;
    session.unansweredCount = session.totalQuestions - session.answeredQuestions; session.remainingCount = raw.length;
    return snapshot();
  }
  async function serve(url, options) {
    const u = new URL(url);
    assert.equal(options.headers.Authorization, 'Bearer access');
    if (u.pathname === '/api/v1/users/me') return ok(copy(profile));
    if (u.pathname === '/api/practice/v1/wrong-questions/sessions') {
      assert.equal(options.method, 'POST'); assert.deepEqual(JSON.parse(options.body), { licenseClass: 'A1' }); return ok(start());
    }
    if (u.pathname.includes('/wrong-questions/sessions/')) {
      assert.ok(session); assert.ok(u.pathname.includes(session.sessionId));
      if (u.pathname.endsWith('/finish')) { assert.equal(options.method, 'POST'); finishes++; session.status = 'COMPLETED'; return ok(refresh()); }
      if (u.pathname.endsWith('/answers')) {
        assert.equal(options.method, 'POST'); const body = JSON.parse(options.body);
        assert.deepEqual(Object.keys(body).sort(), ['questionId', 'selectedAnswer']); assert.equal(session.status, 'IN_PROGRESS');
        const q = session.questions.find((item) => item.questionId === body.questionId); assert.ok(q);
        const correctAnswer = answerKeyOverride ?? q.correctAnswer;
        const grade = { questionId: q.questionId, selectedAnswer: body.selectedAnswer, isCorrect: body.selectedAnswer === correctAnswer,
          correctAnswer, explanation: q.explanation, answeredAt: '2026-10-21T01:00:00Z' };
        q.correctAnswer = correctAnswer; session.answers[q.questionId] = grade;
        const index = raw.findIndex((row) => row.questionId === q.questionId);
        if (grade.isCorrect && index >= 0) raw.splice(index, 1);
        refresh(); return ok(grade);
      }
      assert.ok(!options.method || options.method === 'GET'); return ok(refresh());
    }
    assert.ok(!options.method || options.method === 'GET', 'Only native wrong-review API may write');
    assert.equal(u.searchParams.get('licenseClass'), 'A1');
    if (u.pathname.endsWith('/learning-catalog')) return ok({ licenseClass: 'A1', bankVersion: 'server-bank', chapters: [1, 2, 3, 4, 5, 6].map((chapterId) => ({ chapterId })) });
    if (u.pathname.endsWith('/wrong/overview')) return ok({ licenseClass: 'A1', totalWrongQuestions: raw.length, hasWrongQuestions: raw.length > 0 });
    if (u.pathname.endsWith('/questions/wrong')) return ok(copy(raw));
    throw new Error('Unexpected request: ' + u.pathname);
  }
  fetcher = serve;
  return { load, calls, raw, profile, store, seedSession: () => start(), session: () => session, starts: () => starts, finishes: () => finishes,
    overrideKey: (value) => { answerKeyOverride = value; }, service: load('src/features/wrong-questions/wrong-service.ts'), serve, fetch: (fn) => { fetcher = fn; } };
}
test('reading all 119 canonical wrong questions has no 100-item cap and never resumes/finishes a session', async () => {
  const h = apiHarness(); const data = await h.service.getWrongReading(8119, 'A1', 'all');
  assert.equal(data.questions.length, 119); assert.equal(data.questions.at(-1).question.id, 8119); assert.equal(data.initialQuestionId, 8119);
  assert.ok(h.calls.every(([url]) => !/sessions|cursor|answers|finish|progress/.test(url)));
});
test('theory, signs, situations and critical filters use exact canonical chapter IDs and license-scoped critical flags', async () => {
  const h = apiHarness(12), data = await h.service.getWrongOverview('A1');
  const expected = { theory: [1, 2, 3, 4], signs: [5], situations: [6] };
  for (const [filter, chapters] of Object.entries(expected)) {
    const rows = h.service.filterWrongQuestions(data.questions, filter);
    assert.ok(rows.length > 0); assert.ok(rows.every((row) => chapters.includes(row.chapterId)));
    const read = await h.service.getWrongReading(rows[0].question.id, 'A1', filter);
    assert.deepEqual(Array.from(read.questions, (row) => row.question.id), Array.from(rows, (row) => row.question.id));
  }
  assert.deepEqual(Array.from(h.service.filterWrongQuestions(data.questions, 'critical'), (row) => row.question.id), [8001, 8012]);
});
test('a question outside the selected tab is refused instead of opening an unrelated session', async () => {
  const h = apiHarness(); await assert.rejects(h.service.getWrongReading(8001, 'A1', 'signs'), /bộ lọc/);
  assert.ok(h.calls.every(([url]) => !url.includes('/sessions')));
});
test('invalid filter and noncanonical route IDs are refused before requesting data', async () => {
  for (const [id, filter] of [[8001, 'unknown'], [0, 'all'], [1.5, 'all'], [NaN, 'all']]) {
    const h = apiHarness(); await assert.rejects(h.service.getWrongReading(id, 'A1', filter)); assert.equal(h.calls.length, 0);
  }
});
test('a question corrected on another client is not replaced by preview data or a stale review snapshot', async () => {
  const h = apiHarness(); h.raw.shift(); await assert.rejects(h.service.getWrongReading(8001, 'A1', 'all'), /không còn/);
});
test('an API outage is an error, never an empty successful reading', async () => {
  const h = apiHarness(); h.fetch((url, options) => url.includes('/questions/wrong?') ? Response.json({ message: 'Practice unavailable' }, { status: 503 }) : h.serve(url, options));
  await assert.rejects(h.service.getWrongReading(8001, 'A1', 'all'), /Practice unavailable/);
});
test('foreign license and a late response from a cleared account cannot open the reading', async () => {
  let h = apiHarness(); h.profile.selectedLicenseClass = 'B'; await assert.rejects(h.service.getWrongReading(8001, 'A1', 'all'));
  h = apiHarness(); let release; const gate = new Promise((resolve) => { release = resolve; });
  h.fetch((url, options) => url.includes('/questions/wrong?') ? gate.then(() => h.serve(url, options)) : h.serve(url, options));
  const pending = h.service.getWrongReading(8001, 'A1', 'all'); await new Promise((resolve) => setImmediate(resolve)); h.store.getState().clear(); release(); await assert.rejects(pending);
});
function viewHarness(filename, exportName, context = {}) {
  const slots = [], navigation = []; let cursor = 0;
  const file = path.resolve(__dirname, '..', filename), exports = {};
  const source = fs.readFileSync(file, 'utf8').replace('function WrongQuestionsContent(', 'export function WrongQuestionsContent(');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Error, console, require: (id) => {
    if (id === 'react') return { useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial;
      return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; }, useMemo: (fn) => fn(), useCallback: (fn) => fn, useRef: (initial) => ({ current: initial }) };
    if (id === 'react/jsx-runtime') return require(id);
    if (id === 'react-native') return Object.fromEntries(['View', 'Text', 'Pressable', 'ScrollView', 'FlatList', 'ActivityIndicator'].map((name) => [name, name]));
    if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 24 }) };
    if (id === 'expo-symbols') return { SymbolView: 'SymbolView' };
    if (id === 'expo-router') return { Stack: { Screen: 'StackScreen' }, router: Object.fromEntries(['push', 'replace', 'setParams', 'dismissTo'].map((name) => [name, (value) => navigation.push([name, copy(value)])])), useLocalSearchParams: () => ({}) };
    if (id.endsWith('/study-access')) return { StudyAccess: 'StudyAccess' };
    if (id.endsWith('/study-license-picker')) return { StudyLicensePicker: 'StudyLicensePicker' };
    if (id.endsWith('/session-store')) return { useLearnerSession: () => {} };
    if (id.endsWith('/use-wrong-question')) return {};
    if (id.endsWith('/wrong-question-swipe')) return swipeModule();
    if (id.endsWith('/use-learner-resource')) return { useLearnerResource: () => ({ data: context.overview, loading: false, error: null, reload() {} }) };
    if (id.endsWith('/wrong-service')) return context.service || {};
    if (id.endsWith('/question-image')) return { QuestionImage: 'QuestionImage' };
    if (id.endsWith('/chapter-question-content')) return { splitExplanationParagraphs: (value) => [value] };
    throw new Error('Unexpected view dependency: ' + id);
  } }, { filename: file });
  return { render(props) { cursor = 0; return exports[exportName](props); }, navigation };
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : !tree?.props ? [] : [tree, ...nodes(tree.props.children)]; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join('') : tree == null || typeof tree === 'boolean' ? '' : typeof tree === 'object' ? text(tree.props?.children) : String(tree); }
function button(tree, label) { const node = nodes(tree).find((n) => n.type === 'Pressable' && (n.props.accessibilityLabel === label || text(n) === label)); assert.ok(node, 'Missing button ' + label); return node; }
const detailFile = 'src/features/wrong-questions/components/wrong-question-screen.tsx';
test('the list shows black inline question titles without previous-answer/chapter/action labels, and keeps the selected tab when opening', async () => {
  const h = apiHarness(12), overview = await h.service.getWrongOverview('A1');
  const view = viewHarness('src/features/wrong-questions/components/wrong-questions-screen.tsx', 'WrongQuestionsContent', { overview, service: h.service });
  const props = { licenseClass: 'A1', initialFilter: 'all' }; let tree = view.render(props);
  assert.ok(!text(tree).includes('Các câu đã sai')); assert.ok(!text(tree).includes('119 câu')); assert.ok(!text(tree).includes('Hạng A1')); assert.ok(!text(tree).includes('Ôn các câu đã sai'));
  button(tree, 'Biển báo').props.onPress(); tree = view.render(props);
  const list = nodes(tree).find((node) => node.type === 'FlatList'); assert.equal(list.props.data.length, 2);
  const card = list.props.renderItem({ item: list.props.data[0] }); assert.ok(text(card).startsWith('Câu 142: Nội dung thật 4'));
  assert.ok(!/Chương|Lần trước|Làm lại/u.test(text(card)));
  assert.equal(card.props.style.marginBottom, 16); assert.ok(!text(card).includes('Điểm liệt'));
  assert.equal(button(tree, 'Biển báo').props.children.props.style.fontSize, 16);
  const title = nodes(card).find((node) => node.type === 'Text'); assert.ok(title.props.className.includes('text-gray-900')); assert.ok(title.props.className.includes('font-normal'));
  card.props.onPress(); const target = view.navigation.at(-1)[1]; assert.equal(target.pathname, '/wrong-questions/[questionId]');
  assert.equal(target.params.filter, 'signs'); assert.equal(target.params.questionId, '8005'); assert.equal(target.params.licenseClass, 'A1');
});
test('standalone detail keeps its layout, reveal/skip and source number while choices submit an explicit answer', async () => {
  const h = apiHarness(2), data = await h.service.getWrongReading(8001, 'A1', 'all'); const calls = [];
  const v = viewHarness(detailFile, 'WrongQuestionContent'); const props = { row: data.questions[0], data, grade: null, busy: false, resolved: false, needsReload: false, error: null, onAnswer: (answer) => calls.push(answer), onReload() {}, onSkip: () => calls.push('skip') };
  const before = JSON.stringify(data); let tree = v.render(props);
  assert.ok(text(tree).includes('Câu 138: Nội dung thật 0')); assert.ok(!/Hạng|Đã trả lời|Kết thúc|Chọn câu|Câu trước|Kiểm tra|Lần trước|Trả lời lại/u.test(text(tree)));
  assert.equal(nodes(tree).filter((n) => n.type === 'Pressable').length, 4);
  button(tree, 'Chọn đáp án A').props.onPress(); assert.deepEqual(calls, ['A']); calls.length = 0;
  assert.equal(nodes(tree).find((n) => n.type === 'QuestionImage').props.question.id, 8001);
  button(tree, 'Hiện đáp án').props.onPress(); tree = v.render(props); assert.ok(text(tree).includes('Đáp án đúng: B'));
  assert.ok(text(tree).includes('Giải thích')); button(tree, 'Ẩn đáp án').props.onPress(); tree = v.render(props); assert.ok(!text(tree).includes('Đáp án đúng:'));
  button(tree, 'Bỏ qua câu đang xem').props.onPress(); assert.deepEqual(calls, ['skip']); assert.equal(JSON.stringify(data), before);
  assert.equal(h.calls.length, 4); // identity + three read endpoints, no UI writes
});
test('skip stays inside the selected filter and signals return after its last question', async () => {
  const h = apiHarness(12), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8005, 'A1', 'signs'); await model.load();
  assert.equal(model.getSnapshot().row.question.id, 8005); assert.equal(model.skip(), true);
  assert.equal(model.getSnapshot().row.question.id, 8011); assert.equal(model.skip(), false);
  assert.ok(h.calls.every(([, options]) => !options.method || options.method === 'GET'));
});

test('legacy wrong links redirect to the standalone reading, while chapters/all/critical keep their original screen', () => {
  const file = path.resolve(__dirname, '..', 'src/app/practice/[chapterId].tsx');
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  let params = {}; const exports = {};
  vm.runInNewContext(code, { exports, require: (id) => {
    if (id === 'react/jsx-runtime') return require(id);
    if (id === 'expo-router') return { Redirect: 'Redirect', useLocalSearchParams: () => params };
    if (id.endsWith('/chapter-session-screen')) return { __esModule: true, default: 'ChapterSessionScreen' };
    throw new Error('Unexpected route dependency ' + id);
  } }, { filename: file });
  for (const chapterId of ['1', '6', 'all', 'critical']) { params = { chapterId }; assert.equal(exports.default().type, 'ChapterSessionScreen'); }
  params = { chapterId: 'wrong', questionId: '8001', licenseClass: 'A1' };
  let route = exports.default(); assert.equal(route.type, 'Redirect'); assert.equal(route.props.href.pathname, '/wrong-questions/[questionId]');
  assert.equal(route.props.href.params.questionId, '8001'); assert.equal(route.props.href.params.licenseClass, 'A1');
  params = { chapterId: 'wrong' }; route = exports.default(); assert.equal(route.props.href, '/wrong-questions');
});

test('native wrong-review answer removes a question only after the server wrong-list GET confirms it', async () => {
  const h = apiHarness(), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8119, 'A1', 'all'); await model.load(); await model.answer('B');
  const state = model.getSnapshot(); assert.equal(state.grade.isCorrect, true); assert.equal(state.resolved, true);
  assert.equal(state.row.question.id, 8119); assert.ok(!state.availableIds.includes(8119)); assert.equal(h.raw.length, 118);
  const answers = h.calls.filter(([url, options]) => url.endsWith('/answers') && options.method === 'POST'); assert.equal(answers.length, 1);
  assert.match(answers[0][0], /wrong-questions\/sessions\/owned-wrong-round-1\/answers$/);
  assert.ok(!h.calls.some(([url, options]) => url.includes('/learning/chapters/') && options.method)); assert.equal(h.finishes(), 0);
});
test('a wrong native verdict stays in the list and another explicit answer can correct it', async () => {
  const h = apiHarness(3), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8001, 'A1', 'all'); await model.load(); await model.answer('A');
  assert.equal(model.getSnapshot().grade.isCorrect, false); assert.equal(model.getSnapshot().resolved, false);
  await model.answer('B'); assert.equal(model.getSnapshot().resolved, true); assert.equal(h.raw.length, 2); assert.equal(h.starts(), 1);
});
test('double taps produce one native answer write and an uncertain commit requires GET recovery', async () => {
  const h = apiHarness(3), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8001, 'A1', 'all'); await model.load();
  h.fetch(async (url, options) => { const result = await h.serve(url, options); if (url.endsWith('/answers') && options.method === 'POST') throw new Error('lost acknowledgement'); return result; });
  await Promise.all([model.answer('B'), model.answer('B')]);
  const writes = () => h.calls.filter(([url, options]) => url.endsWith('/answers') && options.method === 'POST').length;
  assert.equal(writes(), 1); assert.equal(model.getSnapshot().needsReload, true); assert.equal(model.getSnapshot().grade, null);
  await model.answer('A'); assert.equal(writes(), 1);
  h.fetch(h.serve); await model.load(); assert.equal(model.getSnapshot().resolved, true); assert.equal(model.getSnapshot().grade, null);
  assert.equal(model.getSnapshot().needsReload, false); assert.equal(h.finishes(), 0);
});
test('native POST verdict overrides downloaded keys and a failed wrong-list GET does not optimistically remove a card', async () => {
  const h = apiHarness(2), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8001, 'A1', 'all'); await model.load(); let posted = false; h.overrideKey('A');
  h.fetch(async (url, options) => {
    if (posted && url.includes('/questions/wrong')) return Response.json({ message: 'read unavailable' }, { status: 503 });
    const result = await h.serve(url, options); if (url.endsWith('/answers') && options.method === 'POST') posted = true; return result;
  });
  await model.answer('A'); assert.equal(model.getSnapshot().grade.correctAnswer, 'A');
  assert.equal(model.getSnapshot().resolved, false); assert.equal(model.getSnapshot().needsReload, true);
  assert.ok(model.getSnapshot().availableIds.includes(8001));
});
test('changed license, missing current item and invalid options cannot start or answer a review', async () => {
  for (const kind of ['license', 'missing', 'option']) {
    const h = apiHarness(2), data = await h.service.getWrongReading(8001, 'A1', 'all');
    if (kind === 'license') h.profile.selectedLicenseClass = 'B'; if (kind === 'missing') h.raw.shift();
    await assert.rejects(h.service.submitWrongQuestionAnswer(data, data.questions[0], kind === 'option' ? 'Z' : 'B', null, () => {}));
    assert.equal(h.calls.filter(([, options]) => options.method === 'POST').length, 0);
  }
});
test('late native answer and closing a screen before session preparation cannot write into the next screen', async () => {
  const h = apiHarness(2), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8001, 'A1', 'all'); await model.load(); let release;
  const gate = new Promise((resolve) => { release = resolve; });
  h.fetch((url, options) => url.endsWith('/answers') && options.method === 'POST' ? gate.then(() => h.serve(url, options)) : h.serve(url, options));
  const pending = model.answer('B'); await new Promise((resolve) => setImmediate(resolve)); h.store.getState().clear(); release(); await pending;
  assert.equal(model.getSnapshot().grade, null); assert.equal(model.getSnapshot().resolved, false);
  const other = apiHarness(2), Other = other.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const closed = new Other(8001, 'A1', 'all'); await closed.load();
  other.fetch(async (url, options) => { const value = await other.serve(url, options); if (url.includes('/learning-catalog')) closed.invalidate(); return value; });
  await closed.answer('B'); assert.equal(other.starts(), 0);
});
test('an older 100-question round is refreshed behind one explicit answer without truncating the 119-question list', async () => {
  const h = apiHarness(100); const old = h.seedSession();
  for (let index = 100; index < 119; index++) h.raw.push({ ...copy(h.raw[0]), questionId: 8001 + index, sourceQuestionId: 138 + index });
  const Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8119, 'A1', 'all'); await model.load(); assert.equal(model.getSnapshot().data.questions.length, 119);
  assert.equal(h.finishes(), 0); assert.equal(h.session().questions.length, 100);
  await model.answer('B'); assert.equal(h.finishes(), 1); assert.equal(h.session().questions.length, 119);
  assert.equal(model.getSnapshot().resolved, true); assert.equal(h.raw.length, 118);
  assert.equal(model.getSnapshot().needsReload, false); assert.equal(model.getSnapshot().error, null);
  assert.equal(Object.keys(old.answers).length, 0);
  assert.equal(h.calls.filter(([url, options]) => url.endsWith('/answers') && options.method === 'POST').length, 1);
});
test('a previous correct verdict with newer wrong evidence uses a fresh native round before one answer POST', async () => {
  const h = apiHarness(2); h.seedSession(); const old = h.session();
  old.answers[8001] = { selectedAnswer: 'B', isCorrect: true, answeredAt: '2026-10-20T00:00:00Z' };
  old.answeredQuestions = 1; old.correctCount = 1; old.unansweredCount = 1;
  const Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8001, 'A1', 'all'); await model.load(); await model.answer('B');
  assert.equal(model.getSnapshot().grade.isCorrect, true); assert.equal(model.getSnapshot().resolved, true);
  assert.equal(model.getSnapshot().error, null); assert.equal(h.finishes(), 1);
  assert.equal(old.answers[8001].answeredAt, '2026-10-20T00:00:00Z'); assert.equal(old.status, 'COMPLETED');
  assert.equal(h.calls.filter(([url, options]) => url.endsWith('/answers') && options.method === 'POST').length, 1);
});
test('a concurrent server wrong-list change never causes an answer POST to be replayed or a local removal', async () => {
  const h = apiHarness(2), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8001, 'A1', 'all'); await model.load();
  h.fetch(async (url, options) => {
    if (url.endsWith('/answers') && options.method === 'POST') {
      const old = copy(h.raw[0]); const response = await h.serve(url, options); h.raw.unshift(old); return response;
    }
    return h.serve(url, options);
  });
  await model.answer('B'); assert.equal(model.getSnapshot().grade.isCorrect, true);
  assert.equal(model.getSnapshot().resolved, false); assert.equal(model.getSnapshot().needsReload, true);
  assert.ok(!/lượt|phiên/iu.test(model.getSnapshot().error)); assert.equal(h.finishes(), 0);
  assert.equal(h.calls.filter(([url, options]) => url.endsWith('/answers') && options.method === 'POST').length, 1);
});
test('a failed preparation never posts an answer, and recovery uses the known completed session without another finish', async () => {
  const h = apiHarness(2); h.seedSession(); h.raw.push({ ...copy(h.raw[0]), questionId: 8003, sourceQuestionId: 140 });
  const Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8003, 'A1', 'all'); await model.load();
  h.fetch(async (url, options) => {
    if (h.finishes() && url.endsWith('/wrong-questions/sessions') && options.method === 'POST') throw new Error('network interruption');
    return h.serve(url, options);
  });
  await model.answer('B'); assert.equal(model.getSnapshot().needsReload, true); assert.equal(h.finishes(), 1);
  assert.equal(h.calls.filter(([url, options]) => url.endsWith('/answers') && options.method === 'POST').length, 0);
  assert.equal(h.raw.length, 3); h.fetch(h.serve); await model.load(); await model.answer('B');
  assert.equal(h.finishes(), 1); assert.equal(model.getSnapshot().resolved, true); assert.equal(h.raw.length, 2);
});
test('leaving during native preparation prevents the subsequent start and answer write', async () => {
  const h = apiHarness(2); h.seedSession(); h.raw.push({ ...copy(h.raw[0]), questionId: 8003, sourceQuestionId: 140 });
  const Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8003, 'A1', 'all'); await model.load();
  h.fetch(async (url, options) => { const response = await h.serve(url, options); if (url.endsWith('/finish')) model.invalidate(); return response; });
  await model.answer('B'); assert.equal(h.finishes(), 1);
  assert.equal(h.calls.filter(([url, options]) => url.endsWith('/wrong-questions/sessions') && options.method === 'POST').length, 1);
  assert.equal(h.calls.filter(([url, options]) => url.endsWith('/answers') && options.method === 'POST').length, 0);
  assert.equal(model.getSnapshot().grade, null);
});

function swipeModule() {
  const filename = path.resolve(__dirname, '../src/features/wrong-questions/wrong-question-swipe.ts');
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, { exports, require: (id) => {
    assert.equal(id, 'react-native'); return { PanResponder: { create: (handlers) => ({ panHandlers: handlers }) } };
  } });
  return exports;
}
test('right swipe goes to next and left swipe goes to previous without submitting or leaving the selected tab', async () => {
  const h = apiHarness(12), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8005, 'A1', 'signs'); await model.load(); const before = h.calls.length;
  const handlers = swipeModule().createWrongQuestionSwipe(false, (direction) => model.move(direction));
  assert.equal(model.move(-1), false); assert.equal(model.getSnapshot().row.question.id, 8005);
  handlers.onPanResponderGrant(); handlers.onPanResponderRelease(null, { dx: 70, dy: 4, numberActiveTouches: 0 });
  assert.equal(model.getSnapshot().row.question.id, 8011);
  handlers.onPanResponderRelease(null, { dx: 80, dy: 3, numberActiveTouches: 0 });
  assert.equal(model.getSnapshot().row.question.id, 8011);
  handlers.onPanResponderRelease(null, { dx: -70, dy: 4, numberActiveTouches: 0 });
  assert.equal(model.getSnapshot().row.question.id, 8005); assert.equal(h.calls.length, before);
  assert.equal(h.starts(), 0); assert.equal(h.finishes(), 0);
});
test('swipe ignores taps, short or vertical drags, cancellations, multiple fingers and blocked state', () => {
  const moves = [], handlers = swipeModule().createWrongQuestionSwipe(false, (direction) => moves.push(direction));
  assert.equal(handlers.onStartShouldSetPanResponder(), false);
  for (const gesture of [{ dx: 2, dy: 1, numberActiveTouches: 1 }, { dx: 30, dy: 80, numberActiveTouches: 1 }, { dx: 70, dy: 3, numberActiveTouches: 2 }]) {
    assert.equal(handlers.onMoveShouldSetPanResponderCapture(null, gesture), false);
    handlers.onPanResponderRelease(null, gesture);
  }
  assert.equal(handlers.onMoveShouldSetPanResponderCapture(null, { dx: 20, dy: 2, numberActiveTouches: 1 }), true);
  handlers.onPanResponderGrant(); handlers.onPanResponderRelease(null, { dx: 30, dy: 2, numberActiveTouches: 0 });
  handlers.onPanResponderGrant(); handlers.onPanResponderMove(null, { numberActiveTouches: 2 });
  handlers.onPanResponderRelease(null, { dx: 80, dy: 2, numberActiveTouches: 0 });
  handlers.onPanResponderGrant(); handlers.onPanResponderTerminate(); handlers.onPanResponderRelease(null, { dx: -80, dy: 2, numberActiveTouches: 0 });
  const blocked = swipeModule().createWrongQuestionSwipe(true, (direction) => moves.push(direction));
  assert.equal(blocked.onMoveShouldSetPanResponderCapture(null, { dx: 80, dy: 2, numberActiveTouches: 1 }), false);
  blocked.onPanResponderRelease(null, { dx: 80, dy: 2, numberActiveTouches: 0 });
  assert.deepEqual(moves, []);
});
test('both directions skip server-removed questions and keep the answered card position across a reload', async () => {
  const h = apiHarness(4), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8002, 'A1', 'all'); await model.load(); await model.answer('B');
  assert.equal(model.getSnapshot().resolved, true); await model.load();
  assert.equal(model.getSnapshot().row.question.id, 8002);
  assert.equal(model.move(-1), true); assert.equal(model.getSnapshot().row.question.id, 8001);
  assert.equal(model.move(1), true); assert.equal(model.getSnapshot().row.question.id, 8003);
  assert.equal(model.getSnapshot().grade, null); assert.equal(model.getSnapshot().resolved, false);
  assert.ok(!model.getSnapshot().availableIds.includes(8002));
  assert.equal(h.calls.filter(([, options]) => options.method === 'POST').length, 2);
});
test('a pending answer, uncertain acknowledgement or changed account blocks navigation', async () => {
  const h = apiHarness(3), Model = h.load('src/features/wrong-questions/wrong-question-model.ts').WrongQuestionModel;
  const model = new Model(8002, 'A1', 'all'); await model.load(); let release;
  const gate = new Promise((resolve) => { release = resolve; });
  h.fetch((url, options) => url.endsWith('/answers') && options.method === 'POST' ? gate.then(() => { throw new Error('Lost acknowledgement'); }) : h.serve(url, options));
  const pending = model.answer('B'); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(model.move(1), false); assert.equal(model.move(-1), false); assert.equal(model.skip(), true);
  release(); await pending; assert.equal(model.getSnapshot().needsReload, true);
  assert.equal(model.move(1), false); assert.equal(model.getSnapshot().row.question.id, 8002);
  h.fetch(h.serve); await model.load(); h.store.getState().clear();
  assert.equal(model.move(-1), false); assert.equal(model.getSnapshot().needsReload, true);
});
test('wrong-answer feedback keeps choice grading but omits the extra incorrect sentence and connects swipe only to navigation', async () => {
  const h = apiHarness(2), data = await h.service.getWrongReading(8001, 'A1', 'all'), moves = [];
  const view = viewHarness(detailFile, 'WrongQuestionContent');
  const props = { row: data.questions[0], data, grade: { selectedAnswer: 'A', isCorrect: false, correctAnswer: 'B' },
    busy: false, resolved: false, needsReload: false, error: null, onAnswer() {}, onReload() {}, onSkip() {}, onMove: (value) => moves.push(value) };
  const tree = view.render(props); assert.ok(!text(tree).includes('Chưa đúng. Bạn có thể chọn lại đáp án'));
  assert.equal(button(tree, 'Chọn đáp án A').props.style.backgroundColor, '#FEE2E2');
  const surface = nodes(tree).find((node) => node.props.onPanResponderRelease);
  assert.ok(surface); surface.props.onPanResponderRelease(null, { dx: -80, dy: 1, numberActiveTouches: 0 });
  assert.deepEqual(moves, [-1]);
});
