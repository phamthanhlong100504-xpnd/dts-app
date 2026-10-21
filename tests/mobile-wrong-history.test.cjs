/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const time = '2026-10-20T15:00:00Z';
const sessionId = '10000000-0000-4000-8000-000000000001';
const resultId = '20000000-0000-4000-8000-000000000001';
const sourceId = '30000000-0000-4000-8000-000000000001';
const copy = (value) => JSON.parse(JSON.stringify(value));
const ok = (data) => Response.json({ success: true, data });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { resolve, promise }; };
function harness() {
  const cache = new Map(), requests = []; let fetcher;
  function load(filename) {
    const full = path.resolve(__dirname, '..', filename);
    if (cache.has(full)) return cache.get(full);
    const exports = {}; cache.set(full, exports);
    const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, { exports, console, Error, URL, URLSearchParams, Response, AbortController, setTimeout, clearTimeout,
      process: { env: { EXPO_PUBLIC_DTS_API_URL: 'http://172.20.10.3:8888' } },
      fetch: (...args) => { requests.push(args); return fetcher(...args); },
      require: (id) => id.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(full), id + '.ts'))) : require(id),
    }, { filename: full }); return exports;
  }
  const store = load('src/features/session/session-store.ts').useLearnerSession;
  const profile = { id: 'student-a', username: 'student', fullName: 'Học viên', email: '', selectedLicenseClass: 'A1' };
  const version = store.getState().beginSignIn();
  store.getState().acceptSignIn(version, { accessToken: 'access', refreshToken: 'refresh', profile: copy(profile) });
  const questions = [601, 801, 901].map((id, index) => ({ questionId: id, chapterId: [1, 5, 6][index], sourceQuestionId: id - 600,
    questionText: `Câu từ Practice ${id}`, options: [{ label: 'A', text: 'Phương án A' }, { label: 'B', text: 'Phương án B' }],
    correctAnswer: 'B', selectedAnswer: 'A', explanation: '1. Ý đầu. 2. Ý tiếp theo.', isCritical: index === 0,
    imageUrl: index === 0 ? '/question-images/q601.webp' : null, mediaFileId: null, lastWrongAt: time }));
  const catalog = { licenseClass: 'A1', bankVersion: 'server-bank', chapters: [1, 5, 6].map((id) => ({ chapterId: id, totalQuestions: 1 })) };
  const review = { sessionId, licenseClass: 'A1', bankVersion: 'server-bank', status: 'IN_PROGRESS', totalQuestions: 3,
    currentPosition: 1, currentQuestionId: 601, questions: questions.map((q, index) => ({ ...q, position: index + 1, previousWrongAnswer: 'A' })),
    answers: {}, answeredQuestions: 0, correctCount: 0, wrongCount: 0, unansweredCount: 3, remainingCount: 3, startedAt: time, completedAt: null };
  const history = { id: resultId, sourceType: 'PRACTICE_SESSION', sourceId, activityType: 'RANDOM_EXAM', displayTitle: 'Tên bài từ máy chủ',
    licenseClass: 'A1', correctCount: 0, questionCount: 3, result: 'FAILED', score: 0, maxScore: 3, durationSeconds: 0,
    completedAt: time, targetType: 'EXAM', resultAvailable: true, reviewAvailable: true,
    sourceResult: { sourceType: 'PRACTICE_SESSION', sourceId, resultPath: '/practice/result/' + sourceId }, metadata: { bankVersion: 'historical-bank' }, resultSnapshot: {} };
  const source = { examId: sourceId, examType: 'A1', status: 'COMPLETED', totalQuestions: 3, correctCount: 0, wrongCount: 3,
    answeredWrongCount: 2, unansweredCount: 1, passed: false, answers: questions.map((q, index) => ({ ...q, selectedAnswer: index === 2 ? '' : 'A', isCorrect: false })) };
  const server = { profile, catalog, questions, review, history, source, needs: new Set([601, 801, 901]), starts: 0 };
  function counts() {
    review.answeredQuestions = Object.keys(review.answers).length;
    review.correctCount = Object.values(review.answers).filter((a) => a.isCorrect).length;
    review.wrongCount = review.answeredQuestions - review.correctCount;
    review.unansweredCount = review.totalQuestions - review.answeredQuestions;
    review.remainingCount = server.needs.size;
  }
  async function serve(url, options) {
    const u = new URL(url), route = u.pathname, method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;
    assert.equal(options.headers.Authorization, 'Bearer access');
    if (route === '/api/v1/users/me') return ok(copy(profile));
    if (route.endsWith('/learning-catalog')) return ok(copy(catalog));
    if (route.endsWith('/questions/wrong/overview')) return ok({ licenseClass: 'A1', totalWrongQuestions: server.needs.size, hasWrongQuestions: server.needs.size > 0 });
    if (route.endsWith('/questions/wrong')) return ok(copy(questions.filter((q) => server.needs.has(q.questionId))));
    if (route === '/api/practice/v1/wrong-questions/sessions') {
      assert.equal(method, 'POST'); assert.deepEqual(body, { licenseClass: 'A1' }); server.starts++; counts(); return ok(copy(review));
    }
    if (route.startsWith('/api/practice/v1/wrong-questions/sessions/')) {
      assert.ok(route.includes(sessionId));
      if (route.endsWith('/answers')) {
        assert.equal(method, 'POST'); assert.deepEqual(Object.keys(body).sort(), ['questionId', 'selectedAnswer']);
        const answer = { selectedAnswer: body.selectedAnswer, isCorrect: body.selectedAnswer === 'B', answeredAt: time };
        review.answers[body.questionId] = answer;
        if (answer.isCorrect) server.needs.delete(body.questionId); else server.needs.add(body.questionId);
        counts(); return ok({ ...answer, questionId: body.questionId, correctAnswer: 'B', explanation: questions[0].explanation });
      }
      if (route.endsWith('/cursor')) { assert.equal(method, 'PUT'); assert.deepEqual(Object.keys(body), ['questionId']);
        review.currentQuestionId = body.questionId; review.currentPosition = review.questions.findIndex((q) => q.questionId === body.questionId) + 1;
      } else if (route.endsWith('/finish')) { assert.equal(method, 'POST'); review.status = 'COMPLETED'; review.completedAt = time;
      } else assert.equal(method, 'GET');
      counts(); return ok(copy(review));
    }
    if (route === '/api/result/v1/results/me/history') {
      assert.equal(method, 'GET'); assert.equal(u.searchParams.get('targetType'), 'EXAM');
      assert.ok(['RANDOM_EXAM', 'PRESET_EXAM'].includes(u.searchParams.get('activityType')));
      assert.equal(u.searchParams.get('licenseClass'), 'A1');
      const outcome = u.searchParams.get('result'), page = Number(u.searchParams.get('page')), size = Number(u.searchParams.get('size'));
      const total = outcome === 'PASSED' ? 8 : outcome === 'FAILED' ? 12 : 20;
      const row = { ...history, activityType: u.searchParams.get('activityType'), result: outcome || 'FAILED' };
      return Response.json({ content: page * size < total ? [row] : [], totalElements: total, totalPages: Math.ceil(total / size), number: page, size });
    }
    if (route === '/api/result/v1/results/me/history/' + resultId) return Response.json(copy(history));
    if (route === '/api/practice/v1/exams/' + sourceId + '/result') return ok(copy(source));
    throw new Error('Unexpected request: ' + method + ' ' + route);
  }
  fetcher = serve;
  return { load, store, server, requests, serve, counts, fetch: (fn) => { fetcher = fn; },
    wrong: load('src/features/wrong-questions/wrong-service.ts'), history: load('src/features/history/history-service.ts'),
    service: load('src/features/wrong-questions/wrong-study-service.ts'), Model: load('src/features/chapter-learning/chapter-study-model.ts').ChapterStudyModel };
}

test('wrong list uses canonical needsReview, native question IDs, chapter filters and server counts', async () => {
  const h = harness(), data = await h.wrong.getWrongOverview('A1');
  assert.equal(data.total, 3); assert.equal(data.questions[0].question.id, 601);
  assert.equal(data.questions[0].sourceNumber, 1); assert.equal(data.questions[0].previousAnswer, 'A');
  for (const filter of ['theory', 'signs', 'situations', 'critical']) assert.equal(h.wrong.filterWrongQuestions(data.questions, filter).length, 1);
  assert.ok(h.requests.every(([url, options]) => !/progress|history/.test(url) && (!options.method || options.method === 'GET')));
});
test('empty wrong questions are a valid server response, not local history reconstruction', async () => {
  const h = harness(); h.server.needs.clear(); const data = await h.wrong.getWrongOverview('A1'); assert.equal(data.total, 0);
});
test('wrong list rejects partial counts, duplicate IDs, foreign chapters and foreign licenses', async () => {
  for (const mutate of [
    (h) => h.server.needs.add(999), (h) => h.server.questions.push(copy(h.server.questions[0])),
    (h) => { h.server.questions[0].chapterId = 3; }, (h) => { h.server.catalog.licenseClass = 'B'; },
  ]) { const h = harness(); mutate(h); await assert.rejects(h.wrong.getWrongOverview('A1')); }
});
test('a wrong-list outage is an error, never a fabricated empty success', async () => {
  const h = harness(); h.fetch((url, options) => url.endsWith('/questions/wrong?licenseClass=A1') ? Response.json({ message: 'Practice unavailable' }, { status: 503 }) : h.serve(url, options));
  await assert.rejects(h.wrong.getWrongOverview('A1'), /Practice unavailable/);
});
test('wrong review starts the native session and resumes its exact known ID by GET', async () => {
  const h = harness(); const first = await h.service.openWrongStudy('A1', null, () => {});
  assert.equal(first.wrongSessionId, sessionId); assert.equal(first.currentQuestionId, 601); assert.equal(first.questions[0].previousWrongAnswer, 'A');
  const next = await h.service.openWrongStudy('A1', first, () => {}); assert.equal(next.wrongSessionId, sessionId); assert.equal(h.server.starts, 1);
});
test('a cancelled or changed-license screen cannot start a wrong review after its reads', async () => {
  const h = harness(); await assert.rejects(h.service.openWrongStudy('A1', null, () => { throw new Error('cancelled'); })); assert.equal(h.server.starts, 0);
  h.server.profile.selectedLicenseClass = 'B'; await assert.rejects(h.service.openWrongStudy('A1', null, () => {})); assert.equal(h.server.starts, 0);
});
test('wrong review refuses foreign bank, license, order, question and invalid counters', async () => {
  for (const mutate of [
    (r) => { r.bankVersion = 'other'; }, (r) => { r.licenseClass = 'B'; }, (r) => { r.questions[0].position = 2; },
    (r) => { r.questions[0].chapterId = 3; }, (r) => { r.currentQuestionId = 999; }, (r) => { r.questions.push(copy(r.questions[0])); },
  ]) { const h = harness(); mutate(h.server.review); await assert.rejects(h.service.openWrongStudy('A1', null, () => {})); }
});
test('wrong review uses POST grade then reads exact stored answers and needsReview from Practice', async () => {
  const h = harness(), model = new h.Model('wrong', 'review', 'A1'); await model.load(); model.select('B'); await model.submit();
  const data = model.getSnapshot().data; assert.equal(data.answers[601].isCorrect, true); assert.equal(data.wrongSummary.remainingCount, 2);
  assert.equal((await h.wrong.getWrongOverview('A1')).total, 2);
  assert.equal(h.requests.filter(([url]) => url.endsWith('/answers')).length, 1);
});
test('double taps send one wrong-review answer, and a late cleared-account response is discarded', async () => {
  const h = harness(), model = new h.Model('wrong', 'review', 'A1'); await model.load(); const gate = deferred();
  h.fetch((url, options) => url.endsWith('/answers') ? gate.promise.then(() => h.serve(url, options)) : h.serve(url, options));
  model.select('B'); const first = model.submit(); await model.submit(); h.store.getState().clear(); gate.resolve(); await first;
  assert.equal(h.requests.filter(([url]) => url.endsWith('/answers')).length, 1); assert.equal(model.getSnapshot().data.answers[601], undefined);
});
test('uncertain committed wrong answer requires GET recovery without replaying POST', async () => {
  const h = harness(), model = new h.Model('wrong', 'review', 'A1'); await model.load(); let once = true;
  h.fetch(async (url, options) => { const result = await h.serve(url, options); if (url.endsWith('/answers') && once) { once = false; throw new Error('response lost after commit'); } return result; });
  model.select('B'); await model.submit(); assert.equal(model.getSnapshot().needsReload, true); await model.submit();
  await model.load(); assert.equal(model.getSnapshot().data.answers[601].isCorrect, true); assert.equal(h.server.starts, 1);
  assert.equal(h.requests.filter(([url]) => url.endsWith('/answers')).length, 1);
});
test('wrong review cursor is acknowledged, and foreign question IDs cannot be sent', async () => {
  const h = harness(), data = await h.service.openWrongStudy('A1', null, () => {});
  assert.equal((await h.service.saveWrongCursor(data, 801)).currentQuestionId, 801); const before = h.requests.length;
  await assert.rejects(h.service.saveWrongCursor(data, 999)); assert.equal(h.requests.length, before);
});
test('partial wrong-review finish preserves unanswered questions and locks further answers', async () => {
  const h = harness(), model = new h.Model('wrong', 'review', 'A1'); await model.load(); model.select('B'); await model.submit(); await model.finish();
  assert.equal(model.getSnapshot().finished, true); assert.equal(model.getSnapshot().data.wrongSummary.unansweredCount, 2);
  assert.equal(model.getSnapshot().data.wrongSummary.remainingCount, 2);
  model.viewAnswers(); await model.move(801); const before = h.requests.length; model.select('B'); await model.submit(); model.edit();
  assert.equal(model.getSnapshot().selectedAnswer, null); assert.equal(h.requests.length, before); assert.equal(h.server.needs.size, 2);
});
test('global remaining needsReview may exceed the review snapshot size', async () => {
  const h = harness(); h.server.needs.add(999); const data = await h.service.openWrongStudy('A1', null, () => {}); assert.equal(data.wrongSummary.remainingCount, 4);
});
const filters = { activity: 'RANDOM_EXAM', outcome: 'ALL', period: 'ALL', page: 0 };
test('history queries only the selected practice activity before pagination and uses native total counts', async () => {
  const h = harness(), data = await h.history.getHistoryOverview('A1', { ...filters, activity: 'PRESET_EXAM', page: 1 });
  assert.equal(data.items.length, 1); assert.equal(data.total, 20); assert.equal(data.page, 1);
  assert.deepEqual({ ...data.summary }, { total: 20, passed: 8, failed: 12 });
  const calls = h.requests.filter(([url]) => url.includes('/results/me/history'));
  assert.equal(calls.length, 4); assert.ok(calls.every(([url]) => new URL(url).searchParams.get('activityType') === 'PRESET_EXAM'));
  assert.ok(calls.every(([url, options]) => !url.includes('OFFICIAL') && (!options.method || options.method === 'GET')));
});
test('history filters use the same exact time window and outcome on the server', async () => {
  const h = harness(); await h.history.getHistoryOverview('A1', { ...filters, outcome: 'FAILED', period: '7D' }, new Date('2026-10-20T15:00:00Z'));
  const urls = h.requests.filter(([url]) => url.includes('/results/me/history')).map(([url]) => new URL(url));
  assert.ok(urls.every((url) => url.searchParams.get('from') === '2026-10-13T15:00:00.000Z'));
  assert.equal(urls[0].searchParams.get('result'), 'FAILED'); assert.equal(urls[0].searchParams.get('size'), '15');
});
test('history preserves native zero scores/counts/duration and nullable legacy fields', async () => {
  const h = harness(); let data = await h.history.getHistoryDetail(resultId, 'A1'); assert.equal(data.score, 0); assert.equal(data.correctCount, 0); assert.equal(data.durationSeconds, 0);
  Object.assign(h.server.history, { correctCount: null, questionCount: null, score: null, maxScore: null, durationSeconds: null, displayTitle: null });
  data = await h.history.getHistoryDetail(resultId, 'A1'); assert.equal(data.correctCount, null); assert.equal(data.score, null); assert.equal(data.title, null);
});
test('official exams are refused in list, detail and review even through manual URLs', async () => {
  const h = harness(); h.server.history.activityType = 'OFFICIAL_EXAM'; await assert.rejects(h.history.getHistoryDetail(resultId, 'A1'));
  await assert.rejects(h.history.getHistoryReview(resultId, 'A1')); assert.ok(!h.requests.some(([url]) => url.includes('/api/practice/v1/exams/')));
  h.fetch(async (url, options) => { if (url.includes('/results/me/history?')) { const body = await (await h.serve(url, options)).json(); body.content[0].activityType = 'OFFICIAL_EXAM'; return Response.json(body); } return h.serve(url, options); });
  await assert.rejects(h.history.getHistoryOverview('A1', filters));
});
test('history rejects official activity parameters before requesting any Result data', async () => {
  const h = harness(); await assert.rejects(h.history.getHistoryOverview('A1', { ...filters, activity: 'OFFICIAL_EXAM' }));
  assert.ok(!h.requests.some(([url]) => url.includes('/results/me/history')));
});
test('history refuses a foreign license, duplicate result IDs and invalid page metadata', async () => {
  for (const mutate of [(b) => { b.content[0].licenseClass = 'B'; }, (b) => { b.content.push(copy(b.content[0])); }, (b) => { b.number = 99; }]) {
    const h = harness(); h.fetch(async (url, options) => { const r = await h.serve(url, options); if (!url.includes('/results/me/history?')) return r;
      const b = await r.json(); mutate(b); return Response.json(b); }); await assert.rejects(h.history.getHistoryOverview('A1', filters));
  }
});
test('owned detail 404 and Result outage stay errors without fabricated history', async () => {
  const h = harness(); h.fetch((url, options) => url.includes('/results/me/history') ? Response.json({ message: 'not found' }, { status: 404 }) : h.serve(url, options));
  await assert.rejects(h.history.getHistoryReview(resultId, 'A1'), /not found/); assert.ok(!h.requests.some(([url]) => url.includes('/api/practice/v1/exams/')));
});
test('history review follows owned source exam ID, not Result ID, and never writes or grades', async () => {
  const h = harness(), data = await h.history.getHistoryReview(resultId, 'A1');
  assert.equal(data.questions[0].imageUrl, '/question-images/q601.webp'); assert.equal(data.questions[2].selectedAnswer, null);
  assert.equal(data.scope.bankVersion, 'historical-bank'); assert.equal(data.correct, 0); assert.equal(data.wrong, 2); assert.equal(data.unanswered, 1);
  assert.ok(h.requests.some(([url]) => url.endsWith('/exams/' + sourceId + '/result')));
  assert.ok(!h.requests.some(([url]) => url.endsWith('/exams/' + resultId + '/result')));
  assert.ok(h.requests.every(([, options]) => !options.method || options.method === 'GET'));
});
test('review denied by Result never calls the source API; unknown policy can defer to Practice', async () => {
  const h = harness(); h.server.history.reviewAvailable = false; await assert.rejects(h.history.getHistoryReview(resultId, 'A1')); assert.equal(h.requests.length, 2);
  h.server.history.reviewAvailable = null; assert.equal((await h.history.getHistoryReview(resultId, 'A1')).questions.length, 3);
});
test('source route rejects mismatched IDs, external URLs, official paths and query injections', async () => {
  for (const value of [
    '/practice/result/' + resultId, 'https://evil.example/practice/result/' + sourceId,
    '/examination/result/' + sourceId, '/practice/result/' + sourceId + '?userId=other',
  ]) { const h = harness(); h.server.history.sourceResult.resultPath = value; await assert.rejects(h.history.getHistoryReview(resultId, 'A1'));
    assert.ok(!h.requests.some(([url]) => url.includes('/api/practice/v1/exams/')));
  }
});
test('source review rejects foreign exam/license, inconsistent counts and duplicate questions', async () => {
  for (const mutate of [(s) => { s.examId = resultId; }, (s) => { s.examType = 'B'; }, (s) => { s.wrongCount = 0; }, (s) => { s.answers[1].questionId = 601; }]) {
    const h = harness(); mutate(h.server.source); await assert.rejects(h.history.getHistoryReview(resultId, 'A1'));
  }
});
test('source result failure does not substitute current-bank questions or local preview data', async () => {
  const h = harness(); h.fetch((url, options) => url.includes('/exams/') ? Response.json({ message: 'source unavailable' }, { status: 503 }) : h.serve(url, options));
  await assert.rejects(h.history.getHistoryReview(resultId, 'A1'), /source unavailable/); assert.ok(!h.requests.some(([url]) => url.includes('learning-catalog')));
});
test('a response from a cleared account cannot expose history or its source result', async () => {
  const h = harness(), gate = deferred(); h.fetch((url, options) => url.endsWith('/history/' + resultId) ? gate.promise.then(() => h.serve(url, options)) : h.serve(url, options));
  const pending = h.history.getHistoryReview(resultId, 'A1'); await new Promise((resolve) => setImmediate(resolve)); h.store.getState().clear(); gate.resolve();
  await assert.rejects(pending); assert.ok(!h.requests.some(([url]) => url.includes('/exams/')));
});
