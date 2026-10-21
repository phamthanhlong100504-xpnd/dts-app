import { learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { currentStudyScope } from './question-catalog-service';
import { answerOf, idOf, invalidStudy, listOf, objectOf, questionOf, textOf, uniqueIds, withReferenceAnswers } from './study-contract';
import { assertStudyScope } from './study-service';
import type { ChapterStudy, StudyMode, StudyScope } from './study-types';

const prefix = '/api/practice/v1/questions/critical';
function sessionPath(data: ChapterStudy) {
  assertStudyScope(data.scope);
  if (data.collection !== 'critical' || !data.criticalSessionId) invalidStudy();
  return `${prefix}/sessions/${encodeURIComponent(data.criticalSessionId)}`;
}
function parseSession(value: unknown, scope: StudyScope, mode: StudyMode, references: ChapterStudy['questions']): ChapterStudy {
  const raw = objectOf(value);
  if (raw.licenseClass !== scope.licenseClass || raw.bankVersion !== scope.bankVersion ||
    raw.mode !== (mode === 'review' ? 'REVIEW' : 'CONTINUE') ||
    !['IN_PROGRESS', 'COMPLETED'].includes(String(raw.status))) invalidStudy();
  const rows = listOf(raw.questions).map(objectOf);
  const questions = withReferenceAnswers(rows.map((question, index) => {
    if (question.position !== index + 1 || typeof question.learnedBeforeSession !== 'boolean' ||
      question.isCritical !== true || idOf(question.chapterId) > 6 ||
      (mode === 'review' && question.learnedBeforeSession)) invalidStudy();
    return questionOf(question, true);
  }), references);
  uniqueIds(questions);
  if (questions.length !== idOf(raw.totalQuestions)) invalidStudy();
  const answers: ChapterStudy['answers'] = {};
  for (const [key, value] of Object.entries(objectOf(raw.answers))) {
    const question = questions.find((item) => String(item.id) === key);
    if (!question) invalidStudy();
    answers[question.id] = answerOf(value, question);
  }
  // Older canonical progress can be learned without a retained answer. Keep the
  // server flag separate; never invent a selected option or a correct verdict.
  const learnedQuestionIds = [...new Set([...rows.filter((row) => row.learnedBeforeSession)
    .map((row) => idOf(row.questionId)), ...Object.values(answers).map((answer) => answer.questionId)])];
  if (raw.answeredQuestions !== learnedQuestionIds.length ||
    (raw.status === 'COMPLETED' && learnedQuestionIds.length !== questions.length)) invalidStudy();
  const currentQuestionId = idOf(raw.currentQuestionId);
  if (questions.findIndex((question) => question.id === currentQuestionId) + 1 !== idOf(raw.currentPosition)) invalidStudy();
  return { scope, chapterId: 0, chapterName: 'Câu điểm liệt', mode,
    status: raw.status as ChapterStudy['status'], collection: 'critical', reviewSessionId: null,
    criticalSessionId: textOf(raw.sessionId), questions, answers, learnedQuestionIds, currentQuestionId };
}
function validateSession(data: ChapterStudy, next: ChapterStudy) {
  if (next.criticalSessionId !== data.criticalSessionId || next.questions.length !== data.questions.length ||
    next.questions.some((question, index) => question.id !== data.questions[index].id)) invalidStudy();
}

export async function openCriticalStudy(mode: StudyMode, licenseClass: string, existing: ChapterStudy | null | undefined,
  ensureCurrent: () => void): Promise<ChapterStudy> {
  const scope = currentStudyScope(licenseClass);
  await reloadLearnerProfile(); ensureCurrent(); assertStudyScope(scope);
  const query = '?licenseClass=' + encodeURIComponent(licenseClass);
  const [catalogValue, questionsValue, overviewValue] = await Promise.all([
    learnerRequest<unknown>('/api/practice/v1/questions/learning-catalog' + query),
    learnerRequest<unknown>(prefix + query), learnerRequest<unknown>(prefix + '/overview' + query),
  ]);
  ensureCurrent(); assertStudyScope(scope);
  const catalog = objectOf(catalogValue), overview = objectOf(overviewValue);
  if (catalog.licenseClass !== licenseClass || overview.licenseClass !== licenseClass) invalidStudy();
  const fullScope = { ...scope, bankVersion: textOf(catalog.bankVersion) };
  const rawReferences = listOf(questionsValue).map(objectOf);
  const references = rawReferences.map((row) => {
    if (row.isCritical !== true || idOf(row.chapter) > 6) invalidStudy();
    return questionOf(row);
  });
  uniqueIds(references);
  if (references.length !== idOf(catalog.criticalQuestions) || overview.totalQuestions !== references.length) invalidStudy();
  const keep = existing?.collection === 'critical' && existing.scope.version === scope.version &&
    existing.scope.userId === scope.userId && existing.scope.licenseClass === licenseClass && existing.mode === mode ? existing : null;
  if (keep && keep.scope.bankVersion !== fullScope.bankVersion) invalidStudy();
  if (!keep && mode === 'review' && overview.learnedQuestions !== references.length) invalidStudy();
  ensureCurrent(); assertStudyScope(scope);
  const raw = keep ? await learnerRequest<unknown>(sessionPath(keep)) : await learnerRequest<unknown>(prefix + '/sessions', {
    method: 'POST', body: JSON.stringify({ licenseClass, mode: mode === 'review' ? 'REVIEW' : 'CONTINUE', restart: false }),
  });
  ensureCurrent(); assertStudyScope(scope);
  // A session may span chapters: validate every source chapter as well as IDs.
  for (const row of listOf(objectOf(raw).questions).map(objectOf)) {
    if (rawReferences.find((reference) => reference.id === row.questionId)?.chapter !== row.chapterId) invalidStudy();
  }
  const next = parseSession(raw, fullScope, mode, references);
  if (keep) validateSession(keep, next);
  return next;
}
export async function readCriticalStudy(data: ChapterStudy): Promise<ChapterStudy> {
  const raw = await learnerRequest<unknown>(sessionPath(data)); assertStudyScope(data.scope);
  const next = parseSession(raw, data.scope, data.mode, data.questions); validateSession(data, next);
  return next;
}
export async function submitCriticalStudyAnswer(data: ChapterStudy, questionId: number, selectedAnswer: string): Promise<ChapterStudy> {
  sessionPath(data);
  const question = data.questions.find((item) => item.id === questionId);
  if (!question || !question.choices.some((choice) => choice.key === selectedAnswer)) invalidStudy();
  const raw = await learnerRequest<unknown>(prefix + '/answers', { method: 'POST',
    body: JSON.stringify({ licenseClass: data.scope.licenseClass, sessionId: data.criticalSessionId, questionId, selectedAnswer }) });
  assertStudyScope(data.scope);
  const grade = answerOf(raw, question);
  if (grade.selectedAnswer !== selectedAnswer) invalidStudy();
  const next = await readCriticalStudy(data);
  const stored = next.answers[questionId];
  if (!stored || stored.selectedAnswer !== grade.selectedAnswer || stored.isCorrect !== grade.isCorrect ||
    stored.correctAnswer !== grade.correctAnswer || stored.answeredAt !== grade.answeredAt) invalidStudy();
  return { ...next, currentQuestionId: questionId };
}
export async function saveCriticalStudyCursor(data: ChapterStudy, questionId: number): Promise<ChapterStudy> {
  const path = sessionPath(data);
  if (!data.questions.some((question) => question.id === questionId)) invalidStudy();
  if (data.status === 'COMPLETED') return { ...data, currentQuestionId: questionId };
  const raw = await learnerRequest<unknown>(path + '/cursor', { method: 'PUT', body: JSON.stringify({ questionId }) });
  assertStudyScope(data.scope);
  const next = parseSession(raw, data.scope, data.mode, data.questions); validateSession(data, next);
  if (next.currentQuestionId !== questionId) invalidStudy();
  return next;
}
