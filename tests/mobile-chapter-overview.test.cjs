/* global __dirname */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(apiUrl = 'http://192.168.3.151:8888') {
  const cache = new Map();
  const requests = [];
  let fetcher = () => { throw new Error('Unexpected request'); };
  function load(filename) {
    const full = path.resolve(__dirname, '..', filename);
    if (cache.has(full)) return cache.get(full);
    const exports = {};
    cache.set(full, exports);
    const output = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(output, {
      exports, console, URL, Response, AbortController, setTimeout, clearTimeout,
      process: { env: { EXPO_PUBLIC_DTS_API_URL: apiUrl } },
      fetch: (...args) => { requests.push(args); return fetcher(...args); },
      require: (id) => {
        if (!id.startsWith('.')) return require(id);
        return load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(full), id + '.ts')));
      },
    }, { filename: full });
    return exports;
  }
  const store = load('src/features/session/session-store.ts').useLearnerSession;
  store.getState().clear();
  const session = load('src/features/session/session-service.ts');
  const chapters = load('src/features/chapter-learning/chapter-service.ts');
  return { store, session, chapters, requests, load, fetch: (fn) => { fetcher = fn; } };
}
const ok = (data) => Response.json({ success: true, data });
const profile = (license = 'A1', id = 'student-a') => ({ id, username: 'student', fullName: 'Học viên', email: 'student@example.test', selectedLicenseClass: license });
const tokens = (id = 'student-a') => ({ accessToken: 'server-access', refreshToken: 'server-refresh', user: { id } });
function authenticate(h, license = 'A1') {
  const version = h.store.getState().beginSignIn();
  h.store.getState().acceptSignIn(version, { accessToken: 'access', refreshToken: 'refresh', profile: profile(license) });
}
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

function chapterInputs() {
  return {
    catalog: { licenseClass: 'A1', bankVersion: 'bank-server-v2', totalQuestions: 5, criticalQuestions: 2,
      chapters: [{ chapterId: 1, chapterName: 'Tên chương từ máy chủ', totalQuestions: 3 }, { chapterId: 5, chapterName: 'Biển báo', totalQuestions: 2 }] },
    overview: { licenseClass: 'A1', bankVersion: 'bank-server-v2', totalQuestions: 5, learnedQuestions: 3, completionPercent: 60,
      chapters: [{ chapterId: 1, totalQuestions: 3, learnedQuestions: 2, status: 'IN_PROGRESS', resumeQuestionId: 42 },
        { chapterId: 5, totalQuestions: 2, learnedQuestions: 1, status: 'IN_PROGRESS', resumeQuestionId: 82 }] },
    critical: { licenseClass: 'A1', totalQuestions: 2, learnedQuestions: 1, completionPercent: 50 },
    wrong: { licenseClass: 'A1', totalWrongQuestions: 4 },
    answers: { 1: [{ questionId: 41, isCorrect: true }, { questionId: 42, isCorrect: false }], 5: [{ questionId: 81, isCorrect: true }] },
  };
}
function serveChapters(h, inputs = chapterInputs()) {
  h.fetch(async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer access');
    assert.equal(new URL(url).searchParams.get('licenseClass'), 'A1');
    const route = new URL(url).pathname;
    if (route.endsWith('/learning-catalog')) return ok(inputs.catalog);
    if (route.endsWith('/learning/chapters')) return ok(inputs.overview);
    if (route.endsWith('/critical/overview')) return ok(inputs.critical);
    if (route.endsWith('/wrong/overview')) return ok(inputs.wrong);
    const id = route.match(/\/chapters\/(\d+)\/answers$/)?.[1];
    if (id) return ok(inputs.answers[id]);
    throw new Error('Unexpected route: ' + route);
  });
}

test('missing environment refuses to use the old VPS', async () => {
  const h = harness('');
  await assert.rejects(h.session.signInLearner('user', 'password'), /cấu hình/);
  assert.equal(h.requests.length, 0);
});

test('sign-in loads the authoritative Identity profile before opening study', async () => {
  const h = harness();
  h.fetch(async (url, options) => {
    if (url.endsWith('/auth/login')) {
      assert.equal(JSON.parse(options.body).deviceInfo, 'DTS Mobile');
      return ok({ ...tokens(), user: { id: 'student-a', selectedLicenseClass: 'A1' } });
    }
    assert.equal(url, 'http://192.168.3.151:8888/api/v1/users/me');
    assert.equal(h.store.getState().session, null);
    return ok(profile('B'));
  });
  await h.session.signInLearner(' user ', 'password');
  assert.equal(h.store.getState().session.profile.selectedLicenseClass, 'B');
});

test('a profile with no license remains unselected, never defaults to A1', async () => {
  const h = harness();
  h.fetch(async (url) => ok(url.endsWith('/auth/login') ? tokens() : profile(null)));
  await h.session.signInLearner('user', 'password');
  assert.equal(h.store.getState().session.profile.selectedLicenseClass, null);
});

test('sign-in rejects a profile owned by another user', async () => {
  const h = harness();
  h.fetch(async (url) => ok(url.endsWith('/auth/login') ? tokens() : profile('A1', 'student-b')));
  await assert.rejects(h.session.signInLearner('user', 'password'), /không khớp/);
  assert.equal(h.store.getState().session, null);
});

test('a late sign-in cannot restore a cleared session', async () => {
  const h = harness();
  const pending = deferred();
  h.fetch(() => pending.promise);
  const operation = h.session.signInLearner('user', 'password');
  h.store.getState().clear();
  pending.resolve(ok(tokens()));
  await assert.rejects(operation, /hết hiệu lực/);
  assert.equal(h.store.getState().session, null);
});

test('license changes are accepted only after Identity confirms them', async () => {
  const h = harness(); authenticate(h);
  const pending = deferred();
  h.fetch((url, options) => {
    assert.ok(url.endsWith('/api/v1/users/me/license'));
    assert.equal(options.method, 'PUT');
    assert.equal(JSON.parse(options.body).licenseClass, 'B');
    return pending.promise;
  });
  const operation = h.session.chooseLearnerLicense('B');
  assert.equal(h.store.getState().session.profile.selectedLicenseClass, 'A1');
  pending.resolve(ok({ licenseClass: 'B' }));
  await operation;
  assert.equal(h.store.getState().session.profile.selectedLicenseClass, 'B');
});

test('a rejected license update leaves the confirmed license unchanged', async () => {
  const h = harness(); authenticate(h);
  h.fetch(async () => Response.json({ message: 'Unavailable' }, { status: 500 }));
  await assert.rejects(h.session.chooseLearnerLicense('B'), /Unavailable/);
  assert.equal(h.store.getState().session.profile.selectedLicenseClass, 'A1');
});

test('a web-side license change is adopted when the profile is reloaded', async () => {
  const h = harness(); authenticate(h);
  const version = h.store.getState().version;
  h.fetch(async () => ok(profile('B')));
  await h.session.reloadLearnerProfile();
  assert.equal(h.store.getState().session.profile.selectedLicenseClass, 'B');
  assert.equal(h.store.getState().version, version + 1);
});

test('chapter numbers, names, bank, resume IDs and counts come from Practice', async () => {
  const h = harness(); authenticate(h); serveChapters(h);
  const data = await h.chapters.getChapterOverview('A1');
  assert.equal(data.bankVersion, 'bank-server-v2');
  assert.equal(data.total, 5); assert.equal(data.learned, 3);
  assert.equal(data.correct, 2); assert.equal(data.wrong, 1);
  assert.equal(data.wrongQuestions, 4);
  assert.equal(data.chapters[0].name, 'Tên chương từ máy chủ');
  assert.equal(data.chapters[0].resumeQuestionId, 42);
  assert.deepEqual(Array.from(data.chapters, (item) => item.id), [1, 5]);
  assert.equal(h.requests.length, 6);
  assert.ok(h.requests.every(([url, options]) => url.includes('/api/practice/v1/') && (!options.method || options.method === 'GET')));
  assert.ok(h.requests.every(([url]) => !url.includes('/progress') && !url.includes('/history')));
});

test('Practice errors do not become zero progress or preview data', async () => {
  const h = harness(); authenticate(h);
  h.fetch(async () => Response.json({ message: 'Practice unavailable', traceId: 'test-trace' }, { status: 500 }));
  await assert.rejects(h.chapters.getChapterOverview('A1'), /Practice unavailable.*test-trace/);
});

test('empty overview-only chapters are valid and do not create artificial catalog rows', async () => {
  const h = harness(); authenticate(h);
  const inputs = chapterInputs();
  inputs.overview.chapters.push({ chapterId: 4, totalQuestions: 0, learnedQuestions: 0, status: 'NOT_STARTED', resumeQuestionId: null });
  serveChapters(h, inputs);
  const data = await h.chapters.getChapterOverview('A1');
  assert.equal(data.total, 5);
  assert.deepEqual(Array.from(data.chapters, (item) => item.id), [1, 5]);
  assert.ok(h.requests.every(([url]) => !url.includes('/chapters/4/answers')));
});

test('different bank versions cannot be combined', async () => {
  const h = harness(); authenticate(h);
  const inputs = chapterInputs(); inputs.overview.bankVersion = 'other-bank';
  serveChapters(h, inputs);
  await assert.rejects(h.chapters.getChapterOverview('A1'), /chưa đồng nhất/);
});

test('another license response cannot be presented as the selected license', async () => {
  const h = harness(); authenticate(h);
  const inputs = chapterInputs(); inputs.overview.licenseClass = 'B';
  serveChapters(h, inputs);
  await assert.rejects(h.chapters.getChapterOverview('A1'), /chưa đồng nhất/);
});

test('partial saved-answer responses cannot silently lower the progress counts', async () => {
  const h = harness(); authenticate(h);
  const inputs = chapterInputs(); inputs.answers[1] = [];
  serveChapters(h, inputs);
  await assert.rejects(h.chapters.getChapterOverview('A1'), /chưa đồng nhất/);
});

test('a response from a previous account is discarded', async () => {
  const h = harness(); authenticate(h);
  const pending = deferred(); h.fetch(() => pending.promise);
  const operation = h.session.learnerRequest('/api/v1/users/me');
  h.store.getState().clear(); pending.resolve(ok(profile()));
  await assert.rejects(operation, /đã thay đổi/);
});

test('concurrent 401s share one token refresh and retry with the server token', async () => {
  const h = harness(); authenticate(h);
  let refreshCount = 0;
  h.fetch(async (url, options) => {
    if (url.endsWith('/auth/refresh')) { refreshCount++; return ok(tokens()); }
    return options.headers.Authorization === 'Bearer server-access' ? ok(profile()) : Response.json({}, { status: 401 });
  });
  await Promise.all([h.session.learnerRequest('/api/v1/users/me'), h.session.learnerRequest('/api/v1/users/me')]);
  assert.equal(refreshCount, 1);
});

test('a late refresh cannot restore a cleared account', async () => {
  const h = harness(); authenticate(h);
  const pending = deferred(), started = deferred();
  h.fetch(async (url) => {
    if (url.endsWith('/auth/refresh')) { started.resolve(); return pending.promise; }
    return Response.json({}, { status: 401 });
  });
  const operation = h.session.learnerRequest('/api/v1/users/me');
  await started.promise; h.store.getState().clear(); pending.resolve(ok(tokens()));
  await assert.rejects(operation);
  assert.equal(h.store.getState().session, null);
});
