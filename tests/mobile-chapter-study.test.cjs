/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const ok = (data) => Response.json({ success: true, data });
const fail = (status, errorCode) => Response.json({ success: false, errorCode, message: errorCode }, { status });
const time = '2026-10-20T15:00:00Z';
const reviewId = '10000000-0000-4000-8000-000000000001';
const mediaId = '20000000-0000-4000-8000-000000000001';
const wait = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const copy = (value) => JSON.parse(JSON.stringify(value));

function harness() {
  const cache = new Map(), requests = [];
  let fetcher;
  function load(filename) {
    const full = path.resolve(__dirname, '..', filename);
    if (cache.has(full)) return cache.get(full);
    const exports = {}; cache.set(full, exports);
    const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports, console, URL, Response, AbortController, setTimeout, clearTimeout,
      process: { env: { EXPO_PUBLIC_DTS_API_URL: 'http://172.20.10.3:8888' } },
      fetch: (...args) => { requests.push(args); return fetcher(...args); },
      require: (id) => id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(full), id + '.ts'))) : require(id),
    }, { filename: full });
    return exports;
  }
  const store = load('src/features/session/session-store.ts').useLearnerSession;
  const profile = { id: 'student-a', username: 'student', fullName: 'Học viên', email: '', selectedLicenseClass: 'A1' };
  const version = store.getState().beginSignIn();
  store.getState().acceptSignIn(version, { accessToken: 'access', refreshToken: 'refresh', profile: copy(profile) });
  const questions = [601, 605, 699].map((id) => ({ id, chapter: 1, questionText: `Nội dung máy chủ ${id}`,
    options: [{ label: 'A', text: 'Phương án A' }, { label: 'B', text: 'Phương án B' }],
    correctAnswer: 'B', explanation: `Giải thích ${id}`, isCritical: id === 601,
    imageUrl: id === 601 ? '/question-images/q601.webp' : null, mediaFileId: null }));
  const saved = new Map([[601, { questionId: 601, selectedAnswer: 'A', isCorrect: false, learnedAt: time, lastAnsweredAt: time }]]);
  const catalog = { licenseClass: 'A1', bankVersion: 'server-bank-v4', chapters: [{ chapterId: 1, chapterName: 'Chương từ Practice', totalQuestions: 3 }] };
  const overview = () => ({ licenseClass: 'A1', bankVersion: 'server-bank-v4', chapters: [{ chapterId: 1, totalQuestions: 3,
    learnedQuestions: saved.size, status: saved.size === 3 ? 'COMPLETED' : 'IN_PROGRESS', resumeQuestionId: server.cursor }] });
  const review = { reviewSessionId: reviewId, licenseClass: 'A1', bankVersion: 'server-bank-v4', chapterId: 1,
    status: 'IN_PROGRESS', totalQuestions: 3, answeredQuestions: 0, currentPosition: 1, currentQuestionId: 601,
    questions: questions.map((question, index) => ({ questionId: question.id, position: index + 1,
      questionText: question.questionText, options: question.options, isCritical: question.isCritical,
      imageUrl: question.imageUrl, mediaFileId: null, bookmarked: false })), answers: {}, startedAt: time, completedAt: null };
  const server = { cursor: 605, questions, saved, catalog, profile, review, starts: 0 };
  const grade = (id, selectedAnswer) => ({ questionId: id, selectedAnswer, isCorrect: selectedAnswer === questions.find((q) => q.id === id).correctAnswer,
    correctAnswer: questions.find((q) => q.id === id).correctAnswer, explanation: `Giải thích ${id}`, answeredAt: time });
  async function serve(url, options) {
    const route = new URL(url).pathname;
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    assert.equal(options.headers.Authorization, 'Bearer access');
    if (route === '/api/v1/users/me') return ok(copy(profile));
    if (route.endsWith('/learning-catalog')) return ok(copy(catalog));
    if (route.endsWith('/learning/chapters')) return ok(overview());
    if (route.endsWith('/questions/chapter/1')) {
      assert.equal(new URL(url).searchParams.get('licenseClass'), 'A1'); return ok(copy(questions));
    }
    if (route.endsWith('/learning/chapters/1/answers')) {
      if (method === 'GET') return ok(Array.from(saved.values(), copy));
      assert.deepEqual(Object.keys(body).sort(), ['licenseClass', 'questionId', 'selectedAnswer']);
      assert.equal(body.licenseClass, 'A1');
      const answer = grade(body.questionId, body.selectedAnswer);
      saved.set(body.questionId, { ...answer, learnedAt: time, lastAnsweredAt: time }); server.cursor = body.questionId;
      return ok(answer);
    }
    if (route.endsWith('/learning/chapters/1/cursor')) {
      assert.equal(method, 'PUT'); assert.deepEqual(Object.keys(body).sort(), ['licenseClass', 'questionId']);
      server.cursor = body.questionId;
      return ok({ chapterId: 1, lastQuestionId: body.questionId, resumeQuestionId: body.questionId, lastStudiedAt: time });
    }
    if (route.endsWith('/review-sessions')) {
      assert.equal(method, 'POST'); assert.deepEqual(body, { licenseClass: 'A1' });
      server.starts++; return saved.size === 3 ? ok(copy(review)) : fail(409, 'CHAPTER_LEARNING_INCOMPLETE');
    }
    if (route.includes('/review-sessions/')) {
      assert.ok(route.includes(reviewId));
      if (route.endsWith('/answers')) {
        assert.deepEqual(Object.keys(body).sort(), ['questionId', 'selectedAnswer']);
        review.answers[body.questionId] = grade(body.questionId, body.selectedAnswer);
        review.answeredQuestions = Object.keys(review.answers).length;
        if (review.answeredQuestions === 3) { review.status = 'COMPLETED'; review.completedAt = time; }
      } else if (route.endsWith('/cursor')) {
        assert.deepEqual(Object.keys(body), ['currentQuestionId']);
        if (review.status === 'COMPLETED') return fail(409, 'REVIEW_COMPLETED');
        review.currentQuestionId = body.currentQuestionId;
        review.currentPosition = questions.findIndex((q) => q.id === body.currentQuestionId) + 1;
      } else if (route.endsWith('/finish')) {
        assert.equal(method, 'POST');
        if (review.answeredQuestions !== 3) return fail(409, 'CHAPTER_REVIEW_INCOMPLETE');
        review.status = 'COMPLETED';
      } else assert.equal(method, 'GET');
      return ok(copy(review));
    }
    if (route === '/api/v1/media/' + mediaId) return Response.json({ mediaId, mediaType: 'IMAGE', status: 'READY', url: 'https://cdn.example.test/q.webp?signature=keep' });
    throw new Error('Unexpected route: ' + method + ' ' + route);
  }
  fetcher = serve;
  const service = load('src/features/chapter-learning/study-service.ts');
  const Model = load('src/features/chapter-learning/chapter-study-model.ts').ChapterStudyModel;
  const images = load('src/features/chapter-learning/question-image-service.ts');
  return { load, store, server, service, Model, images, requests, serve, fetch: (fn) => { fetcher = fn; },
    learnAll: () => questions.forEach((q) => saved.set(q.id, { ...grade(q.id, 'B'), learnedAt: time, lastAnsweredAt: time })) };
}

test('learning restores canonical IDs, saved grades and exact server resume ID', async () => {
  const h = harness(); const data = await h.service.openChapterStudy(1, 'learn', 'A1');
  assert.equal(data.currentQuestionId, 605); assert.equal(data.chapterName, 'Chương từ Practice');
  assert.deepEqual(Array.from(data.questions, (q) => q.id), [601, 605, 699]);
  assert.equal(data.answers[601].isCorrect, false); assert.equal(data.answers[601].correctAnswer, 'B');
  assert.ok(h.requests.every(([url]) => !/progress|history/.test(url)));
  assert.ok(h.requests.every(([, options]) => !options.method || options.method === 'GET'));
});
test('a missing cursor chooses a server-listed unanswered question without writing progress', async () => {
  const h = harness(); h.server.cursor = null;
  const data = await h.service.openChapterStudy(1, 'learn', 'A1'); assert.equal(data.currentQuestionId, 605);
});
test('a foreign or changed license is rejected before requests', async () => {
  const h = harness(); await assert.rejects(h.service.openChapterStudy(1, 'learn', 'B'), /Hạng bằng/); assert.equal(h.requests.length, 0);
});
test('a web-side license change prevents opening the old chapter scope', async () => {
  const h = harness(); h.server.profile.selectedLicenseClass = 'B';
  await assert.rejects(h.service.openChapterStudy(1, 'learn', 'A1')); assert.equal(h.requests.length, 1);
});
test('mixed bank metadata is rejected', async () => {
  const h = harness(); h.fetch((url, options) => url.endsWith('/learning/chapters?licenseClass=A1') ?
    ok({ licenseClass: 'A1', bankVersion: 'other', chapters: [] }) : h.serve(url, options));
  await assert.rejects(h.service.openChapterStudy(1, 'learn', 'A1'), /đồng nhất/);
});
test('partial saved answers cannot reduce server progress counts', async () => {
  const h = harness(); h.fetch((url, options) => url.endsWith('/answers?licenseClass=A1') ? ok([]) : h.serve(url, options));
  await assert.rejects(h.service.openChapterStudy(1, 'learn', 'A1'), /đồng nhất/);
});
test('questions from another chapter are rejected', async () => {
  const h = harness(); h.server.questions[1].chapter = 2;
  await assert.rejects(h.service.openChapterStudy(1, 'learn', 'A1'), /đồng nhất/);
});
test('duplicate question IDs and foreign resume IDs are rejected', async () => {
  const h = harness(); h.server.questions[1].id = 601;
  await assert.rejects(h.service.openChapterStudy(1, 'learn', 'A1'), /đồng nhất/);
  const other = harness(); other.server.cursor = 999;
  await assert.rejects(other.service.openChapterStudy(1, 'learn', 'A1'), /đồng nhất/);
});
test('option labels must come from Practice and are never generated by position', async () => {
  const h = harness(); delete h.server.questions[0].options[0].label;
  await assert.rejects(h.service.openChapterStudy(1, 'learn', 'A1'), /đồng nhất/);
});
test('the POST grade overrides a previously downloaded answer key', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1'); await model.load();
  h.server.questions[1].correctAnswer = 'A'; model.select('B'); await model.submit();
  const grade = model.getSnapshot().data.answers[605];
  assert.equal(grade.isCorrect, false); assert.equal(grade.correctAnswer, 'A'); assert.equal(grade.selectedAnswer, 'B');
});
test('a double tap submits exactly one answer', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1'); await model.load(); model.select('B');
  const pending = wait(); h.fetch((url, options) => options.method === 'POST' ? pending.promise : h.serve(url, options));
  const first = model.submit(); await model.submit();
  assert.equal(h.requests.filter(([, options]) => options.method === 'POST').length, 1);
  pending.resolve(ok({ questionId: 605, selectedAnswer: 'B', isCorrect: true, correctAnswer: 'B', explanation: 'Server', answeredAt: time }));
  await first; assert.equal(model.getSnapshot().data.answers[605].isCorrect, true);
});
test('an uncertain committed POST requires a GET reload and is not automatically replayed', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1'); await model.load(); model.select('B');
  h.fetch(async (url, options) => { const response = await h.serve(url, options); if (options.method === 'POST') throw new Error('connection lost'); return response; });
  await model.submit(); assert.equal(model.getSnapshot().needsReload, true);
  assert.equal(model.getSnapshot().data.answers[605], undefined); await model.submit();
  assert.equal(h.requests.filter(([, options]) => options.method === 'POST').length, 1);
  h.fetch(h.serve); await model.load();
  assert.equal(model.getSnapshot().data.answers[605].isCorrect, true); assert.equal(model.getSnapshot().needsReload, false);
  assert.equal(h.requests.filter(([, options]) => options.method === 'POST').length, 1);
});
test('a refused cursor write never moves the displayed question', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1'); await model.load();
  h.fetch((url, options) => options.method === 'PUT' ? fail(500, 'CURSOR_FAILED') : h.serve(url, options));
  await model.move(699); assert.equal(model.getSnapshot().data.currentQuestionId, 605);
  assert.equal(model.getSnapshot().needsReload, true);
});
test('cursor moves only after the server acknowledges the exact question ID', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1'); await model.load();
  const pending = wait(); h.fetch((url, options) => options.method === 'PUT' ? pending.promise : h.serve(url, options));
  const move = model.move(699); assert.equal(model.getSnapshot().data.currentQuestionId, 605);
  pending.resolve(ok({ chapterId: 1, lastQuestionId: 699, resumeQuestionId: 699, lastStudiedAt: time }));
  await move; assert.equal(model.getSnapshot().data.currentQuestionId, 699);
});
test('foreign question IDs cannot be written', async () => {
  const h = harness(); const data = await h.service.openChapterStudy(1, 'learn', 'A1'); const count = h.requests.length;
  await assert.rejects(h.service.saveStudyCursor(data, 999));
  await assert.rejects(h.service.submitStudyAnswer(data, 999, 'B')); assert.equal(h.requests.length, count);
});
test('a grade response for another question is rejected', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1'); await model.load(); model.select('B');
  h.fetch((url, options) => options.method === 'POST' ? ok({ questionId: 699, selectedAnswer: 'B', isCorrect: true, correctAnswer: 'B', answeredAt: time }) : h.serve(url, options));
  await model.submit(); assert.equal(model.getSnapshot().data.answers[605], undefined); assert.equal(model.getSnapshot().needsReload, true);
});
test('a late answer cannot update a cleared account', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1'); await model.load(); model.select('B');
  const pending = wait(); h.fetch(() => pending.promise); const operation = model.submit(); h.store.getState().clear();
  pending.resolve(ok({ questionId: 605, selectedAnswer: 'B', isCorrect: true, correctAnswer: 'B', answeredAt: time }));
  await operation; assert.equal(model.getSnapshot().data.answers[605], undefined); assert.equal(h.store.getState().session, null);
});
test('a changed license cannot reuse a loaded chapter for writes', async () => {
  const h = harness(); const data = await h.service.openChapterStudy(1, 'learn', 'A1'); const count = h.requests.length;
  h.store.getState().acceptProfile(data.scope.version, { ...h.server.profile, selectedLicenseClass: 'B' });
  await assert.rejects(h.service.submitStudyAnswer(data, 605, 'B')); assert.equal(h.requests.length, count);
});
test('editing an answer changes canonical state only after another server verdict', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1'); await model.load(); await model.move(601);
  model.edit(); model.select('B'); assert.equal(model.getSnapshot().data.answers[601].isCorrect, false);
  await model.submit(); assert.equal(model.getSnapshot().data.answers[601].isCorrect, true); assert.equal(h.server.saved.size, 1);
});
test('learning finish reads server progress and never creates an exam or aggregate progress', async () => {
  const h = harness(); const data = await h.service.openChapterStudy(1, 'learn', 'A1'); const before = h.requests.length;
  const result = await h.service.finishStudy(data); assert.equal(Object.keys(result.answers).length, 1);
  assert.ok(h.requests.slice(before).every(([, options]) => !options.method || options.method === 'GET'));
});
test('review start uses a server session with its own empty answers', async () => {
  const h = harness(); h.learnAll(); const data = await h.service.openChapterStudy(1, 'review', 'A1');
  assert.equal(data.reviewSessionId, reviewId); assert.equal(Object.keys(data.answers).length, 0);
  assert.equal(data.questions[0].referenceAnswer, 'B'); assert.equal(h.server.saved.size, 3);
});
test('review cannot start before the backend confirms chapter completion', async () => {
  const h = harness(); await assert.rejects(h.service.openChapterStudy(1, 'review', 'A1'), /CHAPTER_LEARNING_INCOMPLETE/);
});
test('resuming a review uses GET of its exact existing session', async () => {
  const h = harness(); h.learnAll(); const data = await h.service.openChapterStudy(1, 'review', 'A1');
  await h.service.openChapterStudy(1, 'review', 'A1', data); assert.equal(h.server.starts, 1);
});
test('a failed GET reload retains the known completed review ID for the next retry', async () => {
  const h = harness(); h.learnAll(); const model = new h.Model(1, 'review', 'A1'); await model.load();
  for (const id of [601, 605, 699]) { await model.move(id); model.select('B'); await model.submit(); }
  h.fetch((url, options) => url.endsWith(reviewId) ? fail(503, 'TEMPORARY') : h.serve(url, options));
  await model.load(); assert.equal(model.getSnapshot().data, null);
  h.fetch(h.serve); await model.load();
  assert.equal(model.getSnapshot().data.reviewSessionId, reviewId); assert.equal(model.getSnapshot().finished, true);
  assert.equal(h.server.starts, 1);
});
test('an existing review cannot silently become a new-bank session', async () => {
  const h = harness(); h.learnAll(); const data = await h.service.openChapterStudy(1, 'review', 'A1');
  h.server.catalog.bankVersion = 'new-bank';
  h.fetch((url, options) => new URL(url).pathname.endsWith('/learning/chapters') ?
    ok({ licenseClass: 'A1', bankVersion: 'new-bank', chapters: [{ chapterId: 1, totalQuestions: 3, learnedQuestions: 3, status: 'COMPLETED' }] }) : h.serve(url, options));
  await assert.rejects(h.service.openChapterStudy(1, 'review', 'A1', data), /đồng nhất/); assert.equal(h.server.starts, 1);
});
test('a cancelled screen never starts a review after its reads finish', async () => {
  const h = harness(); h.learnAll();
  await assert.rejects(h.service.openChapterStudy(1, 'review', 'A1', null, () => { throw new Error('screen closed'); }), /screen closed/);
  assert.equal(h.server.starts, 0);
});
test('leaving while review prerequisites load prevents the subsequent POST start', async () => {
  const h = harness(); h.learnAll(); const model = new h.Model(1, 'review', 'A1');
  h.fetch(async (url, options) => {
    const response = await h.serve(url, options);
    if (new URL(url).pathname.endsWith('/learning/chapters')) model.invalidate();
    return response;
  });
  await model.load(); assert.equal(h.server.starts, 0);
});
test('foreign review license, bank, chapter and session IDs are rejected', async () => {
  for (const [key, value] of [['licenseClass', 'B'], ['bankVersion', 'other'], ['chapterId', 2]]) {
    const h = harness(); h.learnAll(); h.server.review[key] = value;
    await assert.rejects(h.service.openChapterStudy(1, 'review', 'A1'), /đồng nhất/);
  }
  const h = harness(); h.learnAll(); const data = await h.service.openChapterStudy(1, 'review', 'A1');
  h.server.review.reviewSessionId = 'foreign-session';
  await assert.rejects(h.service.openChapterStudy(1, 'review', 'A1', data), /đồng nhất/);
});
test('an incomplete review cannot display a fabricated finished result', async () => {
  const h = harness(); h.learnAll(); const model = new h.Model(1, 'review', 'A1'); await model.load(); await model.finish();
  assert.equal(model.getSnapshot().finished, false); assert.equal(model.getSnapshot().needsReload, true);
});
test('review completion comes from server answers and preserves accumulated learning', async () => {
  const h = harness(); h.learnAll(); const before = copy(Array.from(h.server.saved));
  const model = new h.Model(1, 'review', 'A1'); await model.load();
  for (const id of [601, 605, 699]) { await model.move(id); model.select('B'); await model.submit(); }
  assert.equal(model.getSnapshot().finished, true); assert.equal(model.getSnapshot().data.status, 'COMPLETED');
  assert.equal(Object.keys(model.getSnapshot().data.answers).length, 3);
  assert.deepEqual(Array.from(h.server.saved), before);
  model.viewAnswers(); const requests = h.requests.length; await model.move(601);
  assert.equal(model.getSnapshot().finished, false); assert.equal(h.requests.length, requests);
  await model.load(); assert.equal(h.server.starts, 1);
});
test('current bank images use the configured Gateway, including old loopback URLs', () => {
  const h = harness();
  assert.equal(h.images.resolveQuestionImage('/question-images/a.webp'), 'http://172.20.10.3:8888/question-images/a.webp');
  assert.equal(h.images.resolveQuestionImage('http://localhost:8087/question-images/a.webp'), 'http://172.20.10.3:8888/question-images/a.webp');
});
test('signed external image URLs are preserved and unsafe URLs are refused', () => {
  const h = harness(); const signed = 'https://cdn.example.test/a.webp?signature=unchanged';
  assert.equal(h.images.resolveQuestionImage(signed), signed);
  for (const url of ['javascript:alert(1)', '//evil.example.test/a', 'http://user:password@example.test/a', 'http://localhost:9000/a?signature=x']) {
    assert.throws(() => h.images.resolveQuestionImage(url));
  }
});
test('Media metadata uses the plain response contract and does not fetch the signed URL with credentials', async () => {
  const h = harness(); const data = await h.service.openChapterStudy(1, 'learn', 'A1');
  const question = { ...data.questions[0], imageUrl: null, mediaFileId: mediaId };
  const url = await h.images.getQuestionImage(question, data.scope); assert.equal(url, 'https://cdn.example.test/q.webp?signature=keep');
  assert.equal(h.requests.at(-1)[0], 'http://172.20.10.3:8888/api/v1/media/' + mediaId);
  assert.ok(h.requests.every(([url]) => new URL(url).host === '172.20.10.3:8888'));
});
test('an unavailable Media URL is shown as an error rather than fabricated image content', async () => {
  const h = harness(); const data = await h.service.openChapterStudy(1, 'learn', 'A1');
  h.fetch(() => Response.json({ mediaId, mediaType: 'IMAGE', status: 'READY', url: null }));
  await assert.rejects(h.images.getQuestionImage({ ...data.questions[0], imageUrl: null, mediaFileId: mediaId }, data.scope));
});
test('plain Media responses share the existing authenticated refresh and retry flow', async () => {
  const h = harness(); const data = await h.service.openChapterStudy(1, 'learn', 'A1'); let mediaCalls = 0, refreshCalls = 0;
  h.fetch(async (url, options) => {
    if (url.endsWith('/auth/refresh')) {
      refreshCalls++; return ok({ accessToken: 'renewed', refreshToken: 'renewed-refresh', user: { id: 'student-a' } });
    }
    assert.equal(new URL(url).pathname, '/api/v1/media/' + mediaId); mediaCalls++;
    if (options.headers.Authorization === 'Bearer access') return fail(401, 'EXPIRED');
    assert.equal(options.headers.Authorization, 'Bearer renewed');
    return Response.json({ mediaId, mediaType: 'IMAGE', status: 'READY', url: 'https://cdn.example.test/a.webp' });
  });
  assert.equal(await h.images.getQuestionImage({ ...data.questions[0], imageUrl: null, mediaFileId: mediaId }, data.scope), 'https://cdn.example.test/a.webp');
  assert.equal(mediaCalls, 2); assert.equal(refreshCalls, 1);
});
test('a Media response from an old account is discarded', async () => {
  const h = harness(); const data = await h.service.openChapterStudy(1, 'learn', 'A1'); const pending = wait();
  h.fetch(() => pending.promise); const operation = h.images.getQuestionImage({ ...data.questions[0], imageUrl: null, mediaFileId: mediaId }, data.scope);
  h.store.getState().clear(); pending.resolve(Response.json({ mediaId, mediaType: 'IMAGE', status: 'READY', url: 'https://cdn.example.test/a' }));
  await assert.rejects(operation);
});

// HTTP fixtures follow the approved Practice chapter and critical-session DTOs.
function collectionHarness() {
  const h = harness();
  const question = { ...copy(h.server.questions[1]), id: 801, chapter: 5, questionText: 'Đường ưu tiên có biển báo nào?',
    isCritical: true, explanation: '1. Xe tải đi trước; 2. Xe con phải nhường.' };
  const saved = new Map();
  const criticalLearned = new Map();
  let criticalSession = null, criticalStarts = 0, extraCursor = 801;
  const extraReview = { ...copy(h.server.review), reviewSessionId: 'review-chapter-5', chapterId: 5,
    totalQuestions: 1, currentQuestionId: 801, currentPosition: 1,
    questions: [{ ...copy(h.server.review.questions[1]), questionId: 801, position: 1,
      questionText: question.questionText, isCritical: true }], answers: {} };
  h.server.catalog.totalQuestions = 4; h.server.catalog.criticalQuestions = 2;
  h.server.catalog.chapters.push({ chapterId: 5, chapterName: 'Biển báo từ Practice', totalQuestions: 1 });
  function verdict(q, answer) { return { questionId: q.id, selectedAnswer: answer, isCorrect: answer === 'B',
    correctAnswer: 'B', explanation: q.explanation, answeredAt: time }; }
  function progress() {
    return { licenseClass: 'A1', bankVersion: h.server.catalog.bankVersion, totalQuestions: 4,
      learnedQuestions: h.server.saved.size + saved.size,
      chapters: [{ chapterId: 1, totalQuestions: 3, learnedQuestions: h.server.saved.size,
        status: h.server.saved.size === 3 ? 'COMPLETED' : 'IN_PROGRESS', resumeQuestionId: h.server.cursor },
        { chapterId: 5, totalQuestions: 1, learnedQuestions: saved.size,
          status: saved.size ? 'COMPLETED' : 'NOT_STARTED', resumeQuestionId: extraCursor }] };
  }
  const criticalQuestions = () => [h.server.questions[0], question];
  function refreshCritical() {
    const ids = new Set([...criticalSession.questions.filter((q) => q.learnedBeforeSession).map((q) => q.questionId),
      ...Object.keys(criticalSession.answers).map(Number)]);
    criticalSession.answeredQuestions = ids.size;
    criticalSession.currentPosition = criticalSession.questions.findIndex((q) => q.questionId === criticalSession.currentQuestionId) + 1;
    if (ids.size === 2) criticalSession.status = 'COMPLETED';
    return copy(criticalSession);
  }
  async function serve(url, options) {
    const route = new URL(url).pathname, method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    assert.equal(options.headers.Authorization, 'Bearer access');
    if (route.endsWith('/learning/chapters')) return ok(progress());
    if (route.endsWith('/questions/chapter/5')) return ok([copy(question)]);
    if (route.endsWith('/learning/chapters/5/answers')) {
      if (method === 'GET') return ok(Array.from(saved.values(), copy));
      assert.equal(body.licenseClass, 'A1'); assert.equal(body.questionId, 801);
      const grade = verdict(question, body.selectedAnswer); saved.set(801, { ...grade, lastAnsweredAt: time });return ok(grade);
    }
    if (route.endsWith('/learning/chapters/5/cursor')) {
      assert.deepEqual(body, { licenseClass: 'A1', questionId: 801 }); extraCursor = body.questionId;
      return ok({ chapterId: 5, lastQuestionId: extraCursor, resumeQuestionId: extraCursor });
    }
    if (route.endsWith('/chapters/5/review-sessions')) {
      assert.equal(method, 'POST'); assert.deepEqual(body, { licenseClass: 'A1' });
      return saved.size ? ok(copy(extraReview)) : fail(409, 'CHAPTER_LEARNING_INCOMPLETE');
    }
    if (route.includes('/chapters/5/review-sessions/')) {
      assert.ok(route.includes('review-chapter-5'));
      if (route.endsWith('/answers')) { extraReview.answers[801] = verdict(question, body.selectedAnswer);
        extraReview.answeredQuestions = 1; extraReview.status = 'COMPLETED'; }
      else if (route.endsWith('/finish') && !extraReview.answeredQuestions) return fail(409, 'CHAPTER_REVIEW_INCOMPLETE');
      return ok(copy(extraReview));
    }
    if (route.endsWith('/questions/critical/overview')) return ok({ licenseClass: 'A1', totalQuestions: 2,
      learnedQuestions: criticalLearned.size, completionPercent: criticalLearned.size * 50 });
    if (route.endsWith('/questions/critical')) return ok(copy(criticalQuestions()));
    if (route.endsWith('/questions/critical/sessions')) {
      assert.equal(method, 'POST'); assert.equal(body.restart, false); assert.equal(body.licenseClass, 'A1');
      criticalStarts++;
      if (criticalSession?.status === 'IN_PROGRESS') {
        if (criticalSession.mode !== body.mode) return fail(409, 'ACTIVE_CRITICAL_SESSION_EXISTS');
        return ok(refreshCritical());
      }
      if (body.mode === 'REVIEW' && criticalLearned.size !== 2) return fail(409, 'CRITICAL_LEARNING_INCOMPLETE');
      if (body.mode === 'CONTINUE' && criticalLearned.size === 2) return fail(409, 'CRITICAL_ALREADY_LEARNED');
      const questions = criticalQuestions().map((q, index) => ({ questionId: q.id, chapterId: q.chapter, position: index + 1,
        questionText: q.questionText, options: q.options, isCritical: true, imageUrl: q.imageUrl,
        mediaFileId: q.mediaFileId, learnedBeforeSession: body.mode === 'CONTINUE' && criticalLearned.has(q.id) }));
      criticalSession = { sessionId: 'critical-server-session', licenseClass: 'A1', bankVersion: 'server-bank-v4', mode: body.mode,
        status: 'IN_PROGRESS', totalQuestions: 2, answeredQuestions: 0, currentPosition: 1,
        currentQuestionId: questions.find((q) => !q.learnedBeforeSession)?.questionId ?? 601, questions, answers: {} };
      if (body.mode === 'CONTINUE') for (const q of criticalQuestions()) {
        const answer = criticalLearned.get(q.id); if (answer) criticalSession.answers[q.id] = copy(answer);
      }
      return ok(refreshCritical());
    }
    if (route.endsWith('/questions/critical/answers')) {
      assert.equal(method, 'POST'); assert.deepEqual(Object.keys(body).sort(), ['licenseClass', 'questionId', 'selectedAnswer', 'sessionId']);
      assert.equal(body.sessionId, criticalSession.sessionId); assert.equal(body.licenseClass, 'A1');
      const q = criticalQuestions().find((q) => q.id === body.questionId);
      if (!q || criticalSession.status !== 'IN_PROGRESS') return fail(409, 'INVALID_CRITICAL_ANSWER');
      const answer = verdict(q, body.selectedAnswer); criticalSession.answers[q.id] = answer; criticalLearned.set(q.id, copy(answer));
      refreshCritical(); return ok(answer);
    }
    if (route.includes('/questions/critical/sessions/')) {
      assert.ok(route.includes('critical-server-session'));
      if (route.endsWith('/cursor')) { assert.equal(method, 'PUT'); assert.deepEqual(Object.keys(body), ['questionId']);
        if (!criticalQuestions().some((q) => q.id === body.questionId)) return fail(400, 'FOREIGN_ID');
        criticalSession.currentQuestionId = body.questionId; }
      return ok(refreshCritical());
    }
    return h.serve(url, options);
  }
  h.fetch(serve);
  return { ...h, serve, question, saved, criticalLearned, extraReview, critical: () => criticalSession,
    criticalStarts: () => criticalStarts, collections: h.load('src/features/chapter-learning/study-collection-service.ts'),
    bank: h.load('src/features/chapter-learning/question-catalog-service.ts'),
    learnEveryChapter: () => { h.learnAll(); saved.set(801, { ...verdict(question, 'B'), lastAnsweredAt: time }); } };
}

test('search reads every applicable chapter with GET only and matches Vietnamese without accents', async () => {
  const h = collectionHarness();
  const rows = await h.bank.getBankQuestions('A1', 'server-bank-v4');
  assert.deepEqual(Array.from(rows, (row) => row.question.id), [601, 605, 699, 801]);
  const matches = h.bank.searchQuestionText(rows, 'DUONG uu tien');
  assert.equal(matches.length, 1); assert.equal(matches[0].chapterId, 5); assert.equal(matches[0].question.id, 801);
  assert.equal(h.bank.searchQuestionText(rows, 'không có trong dữ liệu').length, 0);
  assert.equal(h.bank.searchQuestionText(rows, ' ').length, 0);
  assert.ok(h.requests.every(([, options]) => !options.method || options.method === 'GET'));
});
test('search refuses stale banks, foreign chapters, duplicate IDs and old-account responses', async () => {
  let h = collectionHarness(); await assert.rejects(h.bank.getBankQuestions('A1', 'stale-bank'));
  h = collectionHarness(); h.question.chapter = 1; await assert.rejects(h.bank.getBankQuestions('A1', 'server-bank-v4'));
  h = collectionHarness(); h.question.id = 601; await assert.rejects(h.bank.getBankQuestions('A1', 'server-bank-v4'));
  h = collectionHarness(); const pending = wait(); h.fetch(() => pending.promise);
  const read = h.bank.getBankQuestions('A1', 'server-bank-v4'); h.store.getState().clear(); pending.resolve(ok(copy(h.server.profile)));
  await assert.rejects(read);
});
test('a search result opens its exact question after the backend acknowledges the cursor and only on first entry', async () => {
  const h = harness(); const model = new h.Model(1, 'learn', 'A1', 699); await model.load();
  assert.equal(model.getSnapshot().data.currentQuestionId, 699); assert.equal(h.server.cursor, 699);
  await model.move(605); await model.load(); assert.equal(model.getSnapshot().data.currentQuestionId, 605);
  const writes = h.requests.filter(([url, options]) => url.endsWith('/cursor') && options.method === 'PUT');
  assert.equal(writes.length, 2);
});
test('a foreign search result ID is never written and a refused search cursor does not open the question', async () => {
  let h = harness(); let model = new h.Model(1, 'learn', 'A1', 999); await model.load();
  assert.equal(model.getSnapshot().data, null); assert.ok(!h.requests.some(([url]) => url.endsWith('/cursor')));
  h = harness(); h.fetch((url, options) => url.endsWith('/cursor') ? fail(503, 'CURSOR_REFUSED') : h.serve(url, options));
  model = new h.Model(1, 'learn', 'A1', 699); await model.load(); assert.equal(model.getSnapshot().data, null);
});
test('all-question learning combines canonical chapters and routes writes to the owning chapter', async () => {
  const h = collectionHarness(); const model = new h.Model('all', 'learn', 'A1'); await model.load();
  let data = model.getSnapshot().data; assert.equal(data.collection, 'all');
  assert.deepEqual(Array.from(data.questions, (q) => q.id), [601, 605, 699, 801]); assert.equal(data.answers[601].isCorrect, false);
  await model.move(801); model.select('B'); await model.submit(); data = model.getSnapshot().data;
  assert.equal(data.answers[801].isCorrect, true); assert.equal(h.saved.size, 1);
  assert.ok(h.requests.some(([url, options]) => url.includes('/chapters/5/answers') && options.method === 'POST'));
  assert.ok(!h.requests.some(([url]) => /critical\/answers|progress\/|results/.test(url)));
});
test('all-question learning preserves partial progress on finish instead of manufacturing completion', async () => {
  const h = collectionHarness(); const model = new h.Model('all', 'learn', 'A1'); await model.load(); await model.finish();
  assert.equal(model.getSnapshot().finished, true); assert.equal(model.getSnapshot().data.status, 'IN_PROGRESS');
  assert.equal(Object.keys(model.getSnapshot().data.answers).length, 1);
});
test('all-question review refuses incomplete learning before starting any chapter review', async () => {
  const h = collectionHarness(); const model = new h.Model('all', 'review', 'A1'); await model.load();
  assert.equal(model.getSnapshot().data, null); assert.ok(!h.requests.some(([, options]) => options.method === 'POST'));
});
test('all-question review keeps separate server rounds, shows references and completes only after server grades', async () => {
  const h = collectionHarness(); h.learnEveryChapter(); const model = new h.Model('all', 'review', 'A1'); await model.load();
  let data = model.getSnapshot().data; assert.equal(data.chapters.length, 2); assert.equal(Object.keys(data.answers).length, 0);
  assert.equal(data.questions[0].referenceAnswer, 'B');
  for (const id of [601, 605, 699, 801]) { await model.move(id); model.select('B'); await model.submit(); }
  data = model.getSnapshot().data; assert.equal(data.status, 'COMPLETED'); assert.equal(model.getSnapshot().finished, true);
  await model.load(); assert.equal(h.server.starts, 1); assert.equal(model.getSnapshot().data.chapters[1].reviewSessionId, 'review-chapter-5');
  assert.equal(h.server.saved.size + h.saved.size, 4);
});
test('a partial all-review reload retains completed chapter IDs across failure and retry', async () => {
  const h = collectionHarness(); h.learnEveryChapter(); const model = new h.Model('all', 'review', 'A1'); await model.load();
  for (const id of [601, 605, 699]) { await model.move(id); model.select('B'); await model.submit(); }
  h.fetch((url, options) => url.includes('/chapters/5/review-sessions/review-chapter-5') ? fail(503, 'TEMPORARY') : h.serve(url, options));
  await model.load(); assert.equal(model.getSnapshot().data, null);
  h.fetch(h.serve); await model.load(); assert.equal(h.server.starts, 1);
  assert.equal(model.getSnapshot().data.chapters[0].status, 'COMPLETED');
});
test('review reference hydration rejects a changed snapshot instead of mixing question content', async () => {
  const h = harness(); h.learnAll(); h.server.review.questions[0].questionText = 'Changed frozen text';
  await assert.rejects(h.service.openChapterStudy(1, 'review', 'A1'), /đồng nhất/);
});
test('critical learning uses the dedicated server session and canonical answer response', async () => {
  const h = collectionHarness(); const model = new h.Model('critical', 'learn', 'A1'); await model.load();
  let data = model.getSnapshot().data; assert.equal(data.collection, 'critical'); assert.equal(data.questions.length, 2);
  assert.equal(data.questions[0].referenceAnswer, 'B'); assert.equal(data.currentQuestionId, 601);
  model.select('A'); await model.submit(); data = model.getSnapshot().data;
  assert.equal(data.answers[601].isCorrect, false); assert.equal(h.criticalLearned.size, 1);
  await model.move(801); model.select('B'); await model.submit(); await model.finish();
  assert.equal(model.getSnapshot().data.status, 'COMPLETED'); assert.equal(h.criticalLearned.size, 2);
  assert.ok(!h.requests.some(([url, options]) => url.includes('/learning/chapters/') && options.method === 'POST'));
});
test('critical review starts with empty round answers and preserves accumulated critical learning', async () => {
  const h = collectionHarness(); h.criticalLearned.set(601, null); h.criticalLearned.set(801, null);
  const model = new h.Model('critical', 'review', 'A1'); await model.load();
  assert.equal(Object.keys(model.getSnapshot().data.answers).length, 0);
  assert.equal(model.getSnapshot().data.learnedQuestionIds.length, 0);
  assert.equal(h.critical().mode, 'REVIEW'); assert.equal(h.criticalLearned.size, 2);
  await model.load(); assert.equal(h.criticalStarts(), 1);
});
test('legacy learned critical questions keep server progress without inventing answer choices or grades', async () => {
  const h = collectionHarness(); h.criticalLearned.set(601, null);
  const model = new h.Model('critical', 'learn', 'A1'); await model.load();
  const data = model.getSnapshot().data;
  assert.equal(data.learnedQuestionIds.length, 1); assert.equal(data.answers[601], undefined); assert.equal(data.currentQuestionId, 801);
});
test('critical review refuses incomplete learning and a closed screen never starts a critical session', async () => {
  const h = collectionHarness(); let model = new h.Model('critical', 'review', 'A1'); await model.load();
  assert.equal(model.getSnapshot().data, null); assert.equal(h.criticalStarts(), 0);
  model = new h.Model('critical', 'learn', 'A1');
  h.fetch(async (url, options) => { const result = await h.serve(url, options);
    if (url.includes('/critical/overview')) model.invalidate(); return result; });
  await model.load(); assert.equal(h.criticalStarts(), 0);
});
test('critical session responses reject foreign bank, license, chapter, session ID and question order', async () => {
  for (const mutation of ['bankVersion', 'licenseClass', 'chapter', 'order']) {
    const h = collectionHarness(); h.fetch(async (url, options) => {
      const result = await h.serve(url, options);
      if (!url.endsWith('/critical/sessions')) return result;
      const envelope = await result.json();
      if (mutation === 'chapter') envelope.data.questions[0].chapterId = 5;
      else if (mutation === 'order') envelope.data.questions[0].position = 2;
      else envelope.data[mutation] = 'foreign';
      return Response.json(envelope);
    });
    const model = new h.Model('critical', 'learn', 'A1'); await model.load(); assert.equal(model.getSnapshot().data, null, mutation);
  }
  const h = collectionHarness(); const model = new h.Model('critical', 'learn', 'A1'); await model.load();
  h.critical().sessionId = 'foreign-session'; await model.load(); assert.equal(model.getSnapshot().data, null);
});
test('a timed-out committed critical answer is recovered by GET without replaying the answer', async () => {
  const h = collectionHarness(); const model = new h.Model('critical', 'learn', 'A1'); await model.load(); model.select('B');
  h.fetch(async (url, options) => { const result = await h.serve(url, options);
    if (url.endsWith('/critical/answers')) throw new Error('network timeout after commit'); return result; });
  await model.submit(); assert.equal(model.getSnapshot().needsReload, true); assert.equal(h.criticalLearned.size, 1);
  h.fetch(h.serve); await model.load(); assert.equal(model.getSnapshot().data.answers[601].isCorrect, true);
  assert.equal(h.requests.filter(([url]) => url.endsWith('/critical/answers')).length, 1); assert.equal(h.criticalStarts(), 1);
});
