/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise view handlers with native elements replaced by inspectable elements.
// API/model calls are spies; these tests do not represent a native-device run.
function view(filename, name) {
  const slots = [];
  let cursor = 0;
  const full = path.resolve(__dirname, '..', filename);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, console,
    require: (id) => {
      if (id === 'react') return { useState: (initial) => {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
      } };
      if (id === 'react-native') return { Pressable: 'Pressable', Text: 'Text', View: 'View', ScrollView: 'ScrollView', Modal: 'Modal' };
      if (id === 'expo-symbols') return { SymbolView: 'SymbolView' };
      if (id === './question-image') return { QuestionImage: 'QuestionImage' };
      if (id === 'react/jsx-runtime') return require(id);
      throw new Error('Unexpected view dependency: ' + id);
    },
  }, { filename: full });
  return (props) => { cursor = 0; return exports[name](props); };
}
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  return [tree, ...nodes(tree.props.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (tree == null || typeof tree === 'boolean') return '';
  return typeof tree === 'object' ? text(tree.props?.children) : String(tree);
}
function button(tree, label) {
  const found = nodes(tree).find((node) => node.type === 'Pressable' &&
    (node.props.accessibilityLabel === label || text(node) === label));
  assert.ok(found, 'Missing button: ' + label);
  return found;
}
function fixture() {
  const data = { scope: { version: 3, userId: 'student-a', licenseClass: 'A1', bankVersion: 'server-bank' },
    chapterId: 6, chapterName: 'Tên chương từ Practice', mode: 'learn', status: 'IN_PROGRESS', reviewSessionId: null,
    currentQuestionId: 1128, answers: {}, questions: [{ id: 1128, text: 'Nội dung từ máy chủ',
      choices: [{ key: 'A', text: 'Phương án A' }, { key: 'B', text: 'Phương án B' }],
      isCritical: false, imageUrl: null, mediaFileId: null, referenceAnswer: 'B', explanation: 'Giải thích từ Practice' }] };
  const calls = [];
  const model = Object.fromEntries(['select', 'edit', 'submit', 'move', 'finish', 'load'].map((name) =>
    [name, (...args) => { calls.push([name, ...args]); }]));
  const state = { data, loading: false, busy: false, error: null, needsReload: false,
    selectedAnswer: null, editing: false, finished: false };
  return { data, state, model, calls, canSkip: true, onSkip: () => { calls.push(['skip']); } };
}
const questionFile = 'src/features/chapter-learning/components/chapter-question-content.tsx';

test('showing a backend reference answer does not submit, select or increment learning progress', () => {
  const props = fixture();
  const before = JSON.stringify(props.data);
  const render = view(questionFile, 'ChapterQuestionContent');
  let tree = render(props);
  assert.ok(!text(tree).includes('Giải thích từ Practice'));
  button(tree, 'Hiện đáp án').props.onPress();
  tree = render(props);
  assert.ok(text(tree).includes('Đáp án đúng: B'));
  assert.ok(text(tree).includes('Giải thích từ Practice'));
  assert.equal(JSON.stringify(props.data), before);
  assert.equal(props.state.selectedAnswer, null);
  assert.deepEqual(props.calls, []);
});

test('feedback uses the canonical recorded verdict when it differs from a downloaded reference key', () => {
  const props = fixture();
  props.data.answers[1128] = { questionId: 1128, selectedAnswer: 'B', isCorrect: false,
    correctAnswer: 'A', explanation: 'Giải thích từ POST', answeredAt: 'server-time' };
  props.state.editing = true;
  const render = view(questionFile, 'ChapterQuestionContent');
  button(render(props), 'Hiện đáp án').props.onPress();
  const tree = render(props);
  assert.ok(text(tree).includes('Đáp án đúng: A'));
  assert.ok(text(tree).includes('Giải thích từ POST'));
  assert.ok(!text(tree).includes('Giải thích từ Practice'));
  assert.equal(props.data.answers[1128].isCorrect, false);
  assert.deepEqual(props.calls, []);
});

test('an unanswered review cannot reveal a learning reference or fabricate feedback', () => {
  const props = fixture();
  props.data.mode = 'review';
  props.data.reviewSessionId = 'server-review';
  props.data.questions[0].referenceAnswer = null;
  const tree = view(questionFile, 'ChapterQuestionContent')(props);
  assert.equal(button(tree, 'Hiện đáp án').props.disabled, true);
  assert.ok(!text(tree).includes('Đáp án đúng:'));
  assert.ok(!text(tree).includes('Giải thích từ Practice'));
  assert.deepEqual(props.calls, []);
});

test('busy or uncertain server state disables view actions and answer selection', () => {
  for (const flag of ['busy', 'needsReload']) {
    const props = fixture();
    props.state[flag] = true;
    const tree = view(questionFile, 'ChapterQuestionContent')(props);
    for (const node of nodes(tree).filter((item) => item.type === 'Pressable')) {
      assert.equal(node.props.disabled, true);
    }
    assert.deepEqual(props.calls, []);
  }
});

test('hiding and reopening a recorded grade preserves canonical wrong-answer state', () => {
  const props = fixture();
  props.data.answers[1128] = { questionId: 1128, selectedAnswer: 'A', isCorrect: false,
    correctAnswer: 'B', explanation: 'Phản hồi đã lưu', answeredAt: 'server-time' };
  props.state.selectedAnswer = 'A';
  const before = JSON.stringify(props.data);
  const render = view(questionFile, 'ChapterQuestionContent');
  button(render(props), 'Ẩn đáp án').props.onPress();
  let tree = render(props);
  assert.ok(!text(tree).includes('Phản hồi đã lưu'));
  button(tree, 'Hiện đáp án').props.onPress();
  tree = render(props);
  assert.ok(text(tree).includes('Đáp án đúng: B'));
  assert.ok(text(tree).includes('Phản hồi đã lưu'));
  assert.equal(JSON.stringify(props.data), before);
  assert.deepEqual(props.calls, []);
});

test('the partial final row of the five-column navigator selects the exact canonical question ID', () => {
  const props = fixture();
  props.data.questions = [901, 905, 1031, 1100, 1101, 1234, 1999].map((id) => ({ ...props.data.questions[0], id }));
  props.data.currentQuestionId = 901;
  const render = view('src/features/chapter-learning/components/chapter-question-navigator.tsx', 'ChapterQuestionNavigator');
  const calls = [];
  const tree = render({ data: props.data, open: true, close: () => calls.push(['close']), onSelect: (id) => calls.push(['select', id]) });
  button(tree, 'Câu 7, chưa trả lời').props.onPress();
  assert.deepEqual(calls, [['close'], ['select', 1999]]);
  assert.deepEqual(props.calls, []);
});

function sessionView(props) {
  const full = path.resolve(__dirname, '..', 'src/features/chapter-learning/components/chapter-session-screen.tsx');
  const source = fs.readFileSync(full, 'utf8').replace('function ChapterSessionContent(', 'export function ChapterSessionContent(');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, console,
    require: (id) => {
      if (id === 'react') return { useState: () => [false, () => {}], useEffect: () => {}, useRef: () => ({ current: null }) };
      if (id === 'react/jsx-runtime') return require(id);
      if (id === 'react-native') return { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable',
        ScrollView: 'ScrollView', Text: 'Text', View: 'View', useWindowDimensions: () => ({ width: 390, height: 844 }) };
      if (id === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ bottom: 24 }) };
      if (id === 'expo-router') return { Stack: { Screen: 'StackScreen' }, router: {}, useLocalSearchParams: () => ({}) };
      if (id.endsWith('/study-access')) return { StudyAccess: 'StudyAccess' };
      if (id.endsWith('/study-license-picker')) return { StudyLicensePicker: 'StudyLicensePicker' };
      if (id.endsWith('/session-store')) return { useLearnerSession: () => {} };
      if (id === '../use-chapter-study') return { useChapterStudy: () => ({ state: props.state, model: props.model }) };
      if (id === './chapter-question-content') return { ChapterQuestionContent: 'ChapterQuestionContent' };
      if (id === './chapter-question-navigator') return { ChapterQuestionNavigator: 'ChapterQuestionNavigator' };
      throw new Error('Unexpected screen dependency: ' + id);
    },
  }, { filename: full });
  return exports.ChapterSessionContent({ chapterId: props.data.chapterId, mode: props.data.mode,
    licenseClass: props.data.scope.licenseClass });
}

function navigationFixture() {
  const props = fixture();
  props.data.questions = [101, 205, 399].map((id) => ({ ...props.data.questions[0], id }));
  props.data.currentQuestionId = 205;
  return props;
}
function recordGrade(props, id) {
  props.data.answers[id] = { questionId: id, selectedAnswer: 'A', isCorrect: false,
    correctAnswer: 'B', explanation: 'Server verdict', answeredAt: 'server-time' };
  props.state.selectedAnswer = 'A';
}

test('the settings header explicitly renders the canonical chapter name with its chapter number', () => {
  const props = navigationFixture();
  const screen = nodes(sessionView(props)).find((node) => node.type === 'StackScreen');
  assert.equal(screen.props.options.headerShown, true);
  assert.equal(screen.props.options.title, 'Chương VI. Tên chương từ Practice');
  const title = screen.props.options.headerTitle();
  assert.equal(text(title), 'Chương VI. Tên chương từ Practice');
  assert.equal(title.props.numberOfLines, 1);
  assert.equal(title.props.ellipsizeMode, 'tail');
  assert.deepEqual(props.calls, []);
});

test('the right button preserves check, next and finish handlers from Stage 2', () => {
  let props = navigationFixture();
  props.state.selectedAnswer = 'A';
  button(sessionView(props), 'Kiểm tra').props.onPress();
  assert.deepEqual(props.calls, [['submit']]);

  props = navigationFixture();
  recordGrade(props, 205);
  button(sessionView(props), 'Câu tiếp').props.onPress();
  assert.deepEqual(props.calls, [['move', 399]]);

  props = navigationFixture();
  props.data.currentQuestionId = 399;
  recordGrade(props, 399);
  button(sessionView(props), 'Kết thúc').props.onPress();
  assert.deepEqual(props.calls, [['finish']]);

  props = navigationFixture();
  props.data.mode = 'review';
  props.data.currentQuestionId = 399;
  recordGrade(props, 399);
  button(sessionView(props), 'Câu tiếp').props.onPress();
  assert.deepEqual(props.calls, [['move', 101]]);
});

test('the left button moves to the previous canonical ID and remains disabled on the first question', () => {
  const props = navigationFixture();
  button(sessionView(props), 'Câu trước').props.onPress();
  assert.deepEqual(props.calls, [['move', 101]]);
  props.data.currentQuestionId = 101;
  assert.equal(button(sessionView(props), 'Câu trước').props.disabled, true);
});

test('check stays disabled until a choice is selected and both footer actions lock on uncertain state', () => {
  const props = navigationFixture();
  assert.equal(button(sessionView(props), 'Kiểm tra').props.disabled, true);
  props.state.selectedAnswer = 'A';
  props.state.needsReload = true;
  const tree = sessionView(props);
  assert.equal(button(tree, 'Kiểm tra').props.disabled, true);
  assert.equal(button(tree, 'Câu trước').props.disabled, true);
  assert.deepEqual(props.calls, []);
});

test('footer buttons retain their visible native size and blue surface without a style callback', () => {
  const props = navigationFixture();
  props.state.selectedAnswer = 'A';
  const tree = sessionView(props);
  for (const label of ['Câu trước', 'Kiểm tra']) {
    const control = button(tree, label);
    // A callback combined with className previously lost height and background
    // in native CSS interop, leaving white labels on the blank white footer.
    assert.equal(typeof control.props.style, 'object');
    assert.equal(control.props.style.height, 40);
    assert.equal(control.props.style.backgroundColor, '#0877F9');
    assert.equal(control.props.style.opacity, 1);
    const caption = nodes(control).find((node) => node.type === 'Text');
    assert.equal(caption.props.style.color, '#FFFFFF');
  }
  const row = nodes(tree).find((node) => node.props.style?.flexDirection === 'row' &&
    nodes(node).some((child) => child.type === 'Pressable' && text(child) === 'Câu trước'));
  assert.equal(row.props.style.justifyContent, 'space-between');
  const scroll = nodes(tree).find((node) => node.type === 'ScrollView');
  assert.ok(!text(scroll).includes('Câu trước'));
  assert.deepEqual(props.calls, []);
});

test('feedback and explanation use the same font size and line height as the answer choices', () => {
  const props = fixture();
  const render = view(questionFile, 'ChapterQuestionContent');
  button(render(props), 'Hiện đáp án').props.onPress();
  const tree = render(props);
  for (const label of ['Phương án A', 'Đáp án đúng: B', 'Giải thích', 'Giải thích từ Practice']) {
    const content = nodes(tree).find((node) => node.type === 'Text' && text(node) === label);
    assert.ok(content, 'Missing text: ' + label);
    assert.ok(content.props.className.split(/\s+/).includes('text-lg'));
    assert.ok(content.props.className.split(/\s+/).includes('leading-7'));
  }
  assert.ok(!text(tree).includes('Giải thích đáp án'));
  assert.deepEqual(props.calls, []);
});

test('inline numbered backend explanations render as separate paragraphs without changing their wording', () => {
  const props = fixture();
  props.data.questions[0].explanation = 'Thứ tự ưu tiên. 1. Xe tải: Đi thẳng; 2. Xe con: Rẽ phải. 3. Xe mô tô: Phải nhường.';
  const before = JSON.stringify(props.data);
  const render = view(questionFile, 'ChapterQuestionContent');
  button(render(props), 'Hiện đáp án').props.onPress();
  const tree = render(props);
  const paragraphs = nodes(tree).filter((node) => node.type === 'Text' && node.props.style?.marginTop !== undefined);
  assert.deepEqual(paragraphs.map(text), ['Thứ tự ưu tiên.', '1. Xe tải: Đi thẳng;', '2. Xe con: Rẽ phải.', '3. Xe mô tô: Phải nhường.']);
  assert.equal(JSON.stringify(props.data), before);
  assert.deepEqual(props.calls, []);
});

test('explanation line breaks preserve decimal numbers, road markings and URLs', () => {
  const props = fixture();
  props.data.questions[0].explanation = 'Khoảng cách 0.5 m, vạch 1.2 và https://example.test/1.2.\nLưu ý khoản 1. Không vượt xe.';
  const render = view(questionFile, 'ChapterQuestionContent');
  button(render(props), 'Hiện đáp án').props.onPress();
  const paragraphs = nodes(render(props)).filter((node) => node.type === 'Text' && node.props.style?.marginTop !== undefined);
  assert.deepEqual(paragraphs.map(text), ['Khoảng cách 0.5 m, vạch 1.2 và https://example.test/1.2.', 'Lưu ý khoản 1. Không vượt xe.']);
  assert.deepEqual(props.calls, []);
});

test('a review with a matching Practice reference can reveal feedback without submitting or learning progress', () => {
  const props = fixture(); props.data.mode = 'review'; props.data.reviewSessionId = 'server-review';
  const before = JSON.stringify(props.data); const render = view(questionFile, 'ChapterQuestionContent');
  assert.equal(button(render(props), 'Hiện đáp án').props.disabled, false);
  button(render(props), 'Hiện đáp án').props.onPress(); const tree = render(props);
  assert.ok(text(tree).includes('Đáp án đúng: B')); assert.ok(text(tree).includes('Giải thích từ Practice'));
  assert.equal(JSON.stringify(props.data), before); assert.deepEqual(props.calls, []);
});

function chaptersView(overview, searchResults = []) {
  const full = path.resolve(__dirname, '..', 'src/features/chapter-learning/components/chapters-screen.tsx');
  const source = fs.readFileSync(full, 'utf8').replace('function ChaptersContent(', 'export function ChaptersContent(');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {}, navigation = []; let query = '';
  vm.runInNewContext(code, { exports, console,
    require: (id) => {
      if (id === 'react') return { useState: () => [query, (value) => { query = value; }] };
      if (id === 'react/jsx-runtime') return require(id);
      if (id === 'react-native') return Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'FlatList', 'ActivityIndicator'].map((name) => [name, name]));
      if (id === 'expo-symbols') return { SymbolView: 'SymbolView' };
      if (id === 'expo-router') return { Stack: { Screen: 'StackScreen' }, router: { push: (value) => navigation.push(value) } };
      if (id.endsWith('/study-access')) return { StudyAccess: 'StudyAccess' };
      if (id.endsWith('/study-license-picker')) return { StudyLicensePicker: 'StudyLicensePicker' };
      if (id === '../use-chapter-overview') return { useChapterOverview: () => ({ data: overview, loading: false, error: null, reload: () => {} }) };
      if (id === '../use-question-search') return { useQuestionSearch: () => ({ results: searchResults, error: null, loading: false }) };
      throw new Error('Unexpected chapters dependency: ' + id);
    },
  }, { filename: full });
  function expand(tree) {
    if (Array.isArray(tree)) return tree.map(expand);
    if (!tree?.props) return tree;
    if (typeof tree.type === 'function') return expand(tree.type(tree.props));
    return { ...tree, props: { ...tree.props, children: expand(tree.props.children) } };
  }
  return { render: () => expand(exports.ChaptersContent()), navigation };
}
function chapterOverviewFixture() {
  return { licenseClass: 'A1', bankVersion: 'server-bank', total: 4, learned: 1, correct: 0, wrong: 1,
    wrongQuestions: 1, chapters: [{ id: 1, name: 'Tên chương từ Practice', learned: 1, total: 4, correct: 0, wrong: 1 }],
    critical: { total: 2, learned: 0, correct: 0, wrong: 0 } };
}
test('the total card opens all questions and critical card uses start, continue and review states', () => {
  for (const [learned, label, mode] of [[0, 'Bắt đầu học', 'learn'], [1, 'Tiếp tục học', 'learn'], [2, 'Ôn tập lại', 'review']]) {
    const data = chapterOverviewFixture(); data.critical.learned = learned;
    const screen = chaptersView(data), tree = screen.render();
    const critical = button(tree, 'Mở câu điểm liệt'); assert.ok(text(critical).includes(label));
    if (!learned) assert.ok(text(critical).includes('Chưa làm câu nào'));
    critical.props.onPress();
    assert.equal(screen.navigation[0].params.chapterId, 'critical'); assert.equal(screen.navigation[0].params.mode, mode);
    button(tree, 'Mở toàn bộ câu hỏi').props.onPress();
    assert.equal(screen.navigation[1].params.chapterId, 'all'); assert.equal(screen.navigation[1].params.licenseClass, 'A1');
    const options = nodes(tree).find((node) => node.type === 'StackScreen').props.options;
    assert.equal(options.headerShadowVisible, true);
  }
});
test('search input shows real question results and opens the exact backend ID in its owning chapter', () => {
  const data = chapterOverviewFixture();
  const screen = chaptersView(data, [{ position: 17, chapterId: 5, chapterName: 'Biển báo', question: { id: 801, text: 'Đường ưu tiên?' } }]);
  let tree = screen.render(); const input = nodes(tree).find((node) => node.type === 'TextInput');
  input.props.onChangeText('duong uu tien'); tree = screen.render();
  const list = nodes(tree).find((node) => node.type === 'FlatList'); assert.equal(list.props.data.length, 1);
  const row = list.props.renderItem({ item: list.props.data[0] }); row.props.onPress();
  assert.equal(screen.navigation[0].params.chapterId, '5'); assert.equal(screen.navigation[0].params.questionId, '801');
  assert.equal(screen.navigation[0].params.mode, 'learn');
  button(tree, 'Xóa tìm kiếm').props.onPress(); assert.ok(!nodes(screen.render()).some((node) => node.type === 'FlatList'));
});


test('critical card keeps native learned progress and hides verdicts not supplied by the API', () => {
  const data = chapterOverviewFixture(); data.critical.learned = 1;
  const tree = chaptersView(data).render(), card = button(tree, 'Mở câu điểm liệt');
  assert.ok(text(card).includes('Đã học 1/2')); assert.ok(text(card).includes('Còn 1'));
  assert.ok(!/chưa có kết quả|phân loại|Đúng|Sai/iu.test(text(card)));
});
test('chapter list removes the reload label and retains pull-to-refresh', () => {
  const tree = chaptersView(chapterOverviewFixture()).render();
  assert.ok(!text(tree).includes('Tải lại dữ liệu'));
  const scroll = nodes(tree).find((node) => node.type === 'ScrollView' && node.props.refreshControl);
  assert.ok(scroll); assert.equal(typeof scroll.props.refreshControl.props.onRefresh, 'function');
});
