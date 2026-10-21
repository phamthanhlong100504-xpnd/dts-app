import { DtsApiError } from '../../lib/api/http';
import { assertSession, learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { useLearnerSession } from '../session/session-store';
import { answerOf, countOf, idOf, invalidStudy, listOf, objectOf, questionOf, textOf, uniqueIds, withReferenceAnswers } from './study-contract';
import type { ChapterStudy, StudyMode, StudyQuestion, StudyScope } from './study-types';

const prefix = '/api/practice/v1';
function scopeOf(licenseClass: string): Omit<StudyScope, 'bankVersion'> {
  const version = useLearnerSession.getState().version;
  const current = assertSession(version);
  if (!licenseClass || current.profile.selectedLicenseClass !== licenseClass) {
    throw new DtsApiError('Hạng bằng đã thay đổi. Vui lòng về danh sách chương.');
  }
  return { version, userId: current.profile.id, licenseClass };
}
export function assertStudyScope(scope: Omit<StudyScope, 'bankVersion'>) {
  const current = assertSession(scope.version);
  if (current.profile.id !== scope.userId || current.profile.selectedLicenseClass !== scope.licenseClass) invalidStudy();
}
function chapterPath(chapterId: number) {
  if (!Number.isInteger(chapterId) || chapterId < 1 || chapterId > 6) invalidStudy();
  return `${prefix}/learning/chapters/${chapterId}`;
}
function questionIn(data: ChapterStudy, questionId: number): StudyQuestion {
  assertStudyScope(data.scope);
  const question = data.questions.find((item) => item.id === questionId);
  if (!question) invalidStudy();
  return question;
}
function reviewPath(data: ChapterStudy) {
  if (!data.reviewSessionId || data.mode !== 'review') invalidStudy();
  return `${chapterPath(data.chapterId)}/review-sessions/${encodeURIComponent(data.reviewSessionId)}`;
}
function validateSnapshot(current: ChapterStudy, next: ChapterStudy) {
  if (current.scope.bankVersion !== next.scope.bankVersion || current.reviewSessionId !== next.reviewSessionId ||
      current.questions.length !== next.questions.length ||
      current.questions.some((question, index) => question.id !== next.questions[index].id)) invalidStudy();
}

// Re-read Identity on entry/foreground. Writes below always remain bound to this
// account, license and bank snapshot; no old device store is involved.
export async function openChapterStudy(chapterId: number, mode: StudyMode, licenseClass: string,
  existing?: ChapterStudy | null, ensureCurrent: () => void = () => {}) : Promise<ChapterStudy> {
  const path = chapterPath(chapterId);
  if (mode !== 'learn' && mode !== 'review') invalidStudy();
  const scope = scopeOf(licenseClass);
  const profile = await reloadLearnerProfile();
  ensureCurrent(); assertStudyScope(scope);
  if (profile.selectedLicenseClass !== licenseClass) invalidStudy();
  const query = '?licenseClass=' + encodeURIComponent(licenseClass);
  const [rawCatalog, rawOverview] = await Promise.all([
    learnerRequest<unknown>(prefix + '/questions/learning-catalog' + query),
    learnerRequest<unknown>(prefix + '/learning/chapters' + query),
  ]);
  ensureCurrent(); assertStudyScope(scope);
  const catalog = objectOf(rawCatalog), overview = objectOf(rawOverview);
  const bankVersion = textOf(catalog.bankVersion);
  if (catalog.licenseClass !== licenseClass || overview.licenseClass !== licenseClass || overview.bankVersion !== bankVersion) invalidStudy();
  const matches = listOf(catalog.chapters).map(objectOf).filter((row) => row.chapterId === chapterId);
  const progressRows = listOf(overview.chapters).map(objectOf).filter((row) => row.chapterId === chapterId);
  if (matches.length !== 1 || progressRows.length !== 1) invalidStudy();
  const chapter = matches[0], progress = progressRows[0];
  const total = idOf(chapter.totalQuestions), learned = countOf(progress.learnedQuestions);
  if (progress.totalQuestions !== total || learned > total ||
      !['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(String(progress.status))) invalidStudy();
  const base = { scope: { ...scope, bankVersion }, chapterId, chapterName: textOf(chapter.chapterName) };
  if (mode === 'review') {
    if (existing?.mode === 'review' && existing.scope.userId === scope.userId &&
        existing.scope.licenseClass === licenseClass && existing.scope.bankVersion !== bankVersion) invalidStudy();
    const keep = existing?.mode === 'review' && existing.scope.version === scope.version &&
      existing.scope.bankVersion === bankVersion && existing.scope.userId === scope.userId &&
      existing.scope.licenseClass === licenseClass && existing.chapterId === chapterId ? existing : null;
    ensureCurrent(); assertStudyScope(scope);
    const references = listOf(await learnerRequest<unknown>(`${prefix}/questions/chapter/${chapterId}${query}`)).map((value) => {
      if (objectOf(value).chapter !== chapterId) invalidStudy();
      return questionOf(value);
    });
    if (references.length !== total) invalidStudy();
    ensureCurrent(); assertStudyScope(scope);
    const raw = keep ? await learnerRequest<unknown>(reviewPath(keep)) :
      await learnerRequest<unknown>(path + '/review-sessions', { method: 'POST', body: JSON.stringify({ licenseClass }) });
    ensureCurrent(); assertStudyScope(scope);
    const result = reviewOf(raw, base, references);
    if (result.questions.length !== total) invalidStudy();
    if (keep) validateSnapshot(keep, result);
    return result;
  }
  const [rawQuestions, rawAnswers] = await Promise.all([
    learnerRequest<unknown>(`${prefix}/questions/chapter/${chapterId}${query}`),
    learnerRequest<unknown>(path + '/answers' + query),
  ]);
  ensureCurrent(); assertStudyScope(scope);
  const questions = listOf(rawQuestions).map((value) => {
    if (objectOf(value).chapter !== chapterId) invalidStudy();
    return questionOf(value);
  });
  uniqueIds(questions);
  if (questions.length !== total) invalidStudy();
  const answers: ChapterStudy['answers'] = {};
  for (const value of listOf(rawAnswers)) {
    const id = idOf(objectOf(value).questionId);
    const question = questions.find((item) => item.id === id);
    if (!question || answers[id]) invalidStudy();
    answers[id] = answerOf(value, question, true);
  }
  if (Object.keys(answers).length !== learned) invalidStudy();
  const resumeId = progress.resumeQuestionId == null ? null : idOf(progress.resumeQuestionId);
  if (resumeId !== null && !questions.some((question) => question.id === resumeId)) invalidStudy();
  return { ...base, mode, status: progress.status as ChapterStudy['status'], reviewSessionId: null, questions, answers,
    currentQuestionId: resumeId ?? questions.find((question) => !answers[question.id])?.id ?? questions[0].id };
}

function reviewOf(value: unknown, base: Pick<ChapterStudy, 'scope' | 'chapterId' | 'chapterName'>, references: StudyQuestion[]): ChapterStudy {
  const raw = objectOf(value);
  if (raw.licenseClass !== base.scope.licenseClass || raw.bankVersion !== base.scope.bankVersion ||
      raw.chapterId !== base.chapterId || !['IN_PROGRESS', 'COMPLETED'].includes(String(raw.status))) invalidStudy();
  const questions = withReferenceAnswers(listOf(raw.questions).map((value, index) => {
    if (objectOf(value).position !== index + 1) invalidStudy();
    return questionOf(value, true);
  }), references);
  uniqueIds(questions);
  if (!questions.length || raw.totalQuestions !== questions.length) invalidStudy();
  const answers: ChapterStudy['answers'] = {};
  for (const [key, value] of Object.entries(objectOf(raw.answers))) {
    const question = questions.find((item) => String(item.id) === key);
    if (!question) invalidStudy();
    answers[question.id] = answerOf(value, question);
  }
  if (raw.answeredQuestions !== Object.keys(answers).length ||
      (raw.status === 'COMPLETED' && raw.answeredQuestions !== questions.length)) invalidStudy();
  const currentQuestionId = idOf(raw.currentQuestionId);
  if (questions.findIndex((question) => question.id === currentQuestionId) + 1 !== idOf(raw.currentPosition)) invalidStudy();
  return { ...base, mode: 'review', status: raw.status as ChapterStudy['status'],
    reviewSessionId: textOf(raw.reviewSessionId), questions, answers, currentQuestionId };
}

export async function submitStudyAnswer(data: ChapterStudy, questionId: number, selectedAnswer: string): Promise<ChapterStudy> {
  const question = questionIn(data, questionId);
  if (!question.choices.some((choice) => choice.key === selectedAnswer)) invalidStudy();
  if (data.mode === 'review') {
    const raw = await learnerRequest<unknown>(reviewPath(data) + '/answers', {
      method: 'POST', body: JSON.stringify({ questionId, selectedAnswer }),
    });
    assertStudyScope(data.scope);
    const next = reviewOf(raw, data, data.questions);
    validateSnapshot(data, next);
    if (next.answers[questionId]?.selectedAnswer !== selectedAnswer) invalidStudy();
    return next;
  }
  const raw = await learnerRequest<unknown>(chapterPath(data.chapterId) + '/answers', {
    method: 'POST', body: JSON.stringify({ licenseClass: data.scope.licenseClass, questionId, selectedAnswer }),
  });
  assertStudyScope(data.scope);
  const answer = answerOf(raw, question);
  if (answer.selectedAnswer !== selectedAnswer) invalidStudy();
  // isCorrect/correctAnswer come solely from the POST result, never comparison
  // with a client answer key. Reload reads canonical overview/answers again.
  return { ...data, currentQuestionId: questionId, answers: { ...data.answers, [questionId]: answer } };
}

export async function saveStudyCursor(data: ChapterStudy, questionId: number): Promise<ChapterStudy> {
  questionIn(data, questionId);
  if (data.mode === 'review') {
    if (data.status === 'COMPLETED') return { ...data, currentQuestionId: questionId }; // Viewing a finished review only.
    const raw = await learnerRequest<unknown>(reviewPath(data) + '/cursor', {
      method: 'PUT', body: JSON.stringify({ currentQuestionId: questionId }),
    });
    assertStudyScope(data.scope);
    const next = reviewOf(raw, data, data.questions);
    validateSnapshot(data, next);
    if (next.currentQuestionId !== questionId) invalidStudy();
    return next;
  }
  const raw = objectOf(await learnerRequest<unknown>(chapterPath(data.chapterId) + '/cursor', {
    method: 'PUT', body: JSON.stringify({ licenseClass: data.scope.licenseClass, questionId }),
  }));
  assertStudyScope(data.scope);
  if (raw.chapterId !== data.chapterId || raw.resumeQuestionId !== questionId || raw.lastQuestionId !== questionId) invalidStudy();
  return { ...data, currentQuestionId: questionId };
}

export async function finishStudy(data: ChapterStudy): Promise<ChapterStudy> {
  assertStudyScope(data.scope);
  if (data.mode === 'learn') {
    const next = await openChapterStudy(data.chapterId, 'learn', data.scope.licenseClass);
    assertStudyScope(data.scope);
    validateSnapshot(data, next);
    return next;
  }
  const raw = await learnerRequest<unknown>(reviewPath(data) + '/finish', { method: 'POST' });
  assertStudyScope(data.scope);
  const next = reviewOf(raw, data, data.questions);
  validateSnapshot(data, next);
  if (next.status !== 'COMPLETED') invalidStudy();
  return next;
}
