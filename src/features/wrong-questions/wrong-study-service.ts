import { DtsApiError } from '../../lib/api/http';
import { learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { currentStudyScope } from '../chapter-learning/question-catalog-service';
import { assertStudyScope } from '../chapter-learning/study-service';
import { answerOf, countOf, idOf, invalidStudy, listOf, objectOf, questionOf, textOf, uniqueIds } from '../chapter-learning/study-contract';
import type { ChapterStudy, StudyScope } from '../chapter-learning/study-types';

const prefix = '/api/practice/v1/wrong-questions/sessions';
function pathOf(data: ChapterStudy) {
  assertStudyScope(data.scope);
  if (data.collection !== 'wrong' || !data.wrongSessionId) invalidStudy();
  return prefix + '/' + encodeURIComponent(data.wrongSessionId);
}
function parse(value: unknown, scope: StudyScope): ChapterStudy {
  const raw = objectOf(value);
  if (raw.licenseClass !== scope.licenseClass || raw.bankVersion !== scope.bankVersion ||
    !['IN_PROGRESS', 'COMPLETED'].includes(String(raw.status))) invalidStudy();
  const questions = listOf(raw.questions).map((value, index) => {
    const row = objectOf(value);
    if (row.position !== index + 1 || idOf(row.chapterId) > 6) invalidStudy();
    const question = questionOf({ ...row, id: row.questionId });
    if (row.previousWrongAnswer != null && !question.choices.some((choice) => choice.key === row.previousWrongAnswer)) invalidStudy();
    return { ...question, previousWrongAnswer: row.previousWrongAnswer == null ? null : textOf(row.previousWrongAnswer) };
  });
  uniqueIds(questions);
  if (questions.length !== idOf(raw.totalQuestions)) invalidStudy();
  const answers: ChapterStudy['answers'] = {};
  for (const [key, value] of Object.entries(objectOf(raw.answers))) {
    const question = questions.find((item) => String(item.id) === key);
    if (!question) invalidStudy();
    answers[question.id] = answerOf({ ...objectOf(value), questionId: question.id,
      correctAnswer: question.referenceAnswer, explanation: question.explanation }, question);
  }
  const answered = Object.values(answers), correct = answered.filter((answer) => answer.isCorrect).length;
  if (raw.answeredQuestions !== answered.length || raw.correctCount !== correct || raw.wrongCount !== answered.length - correct ||
    raw.unansweredCount !== questions.length - answered.length) invalidStudy();
  const currentQuestionId = idOf(raw.currentQuestionId);
  if (questions.findIndex((question) => question.id === currentQuestionId) + 1 !== idOf(raw.currentPosition)) invalidStudy();
  return { scope, chapterId: 0, chapterName: 'Ôn câu đã sai', collection: 'wrong', mode: 'review',
    status: raw.status as ChapterStudy['status'], wrongSessionId: textOf(raw.sessionId), reviewSessionId: null,
    questions, answers, currentQuestionId, wrongSummary: { correctCount: correct, wrongCount: raw.wrongCount as number,
      unansweredCount: raw.unansweredCount as number, remainingCount: countOf(raw.remainingCount) } };
}
function sameSession(data: ChapterStudy, next: ChapterStudy) {
  if (data.wrongSessionId !== next.wrongSessionId || data.questions.length !== next.questions.length ||
    data.questions.some((question, index) => question.id !== next.questions[index].id || question.text !== next.questions[index].text ||
      JSON.stringify(question.choices) !== JSON.stringify(next.questions[index].choices))) invalidStudy();
}
export async function openWrongStudy(licenseClass: string, existing: ChapterStudy | null | undefined,
  ensureCurrent: () => void): Promise<ChapterStudy> {
  const scope = currentStudyScope(licenseClass);
  await reloadLearnerProfile(); ensureCurrent(); assertStudyScope(scope);
  const catalog = objectOf(await learnerRequest<unknown>('/api/practice/v1/questions/learning-catalog?licenseClass=' + encodeURIComponent(licenseClass)));
  ensureCurrent(); assertStudyScope(scope);
  if (catalog.licenseClass !== licenseClass) invalidStudy();
  const fullScope = { ...scope, bankVersion: textOf(catalog.bankVersion) };
  const keep = existing?.collection === 'wrong' && existing.scope.version === scope.version &&
    existing.scope.userId === scope.userId && existing.scope.licenseClass === licenseClass ? existing : null;
  if (keep && keep.scope.bankVersion !== fullScope.bankVersion) invalidStudy();
  ensureCurrent(); assertStudyScope(scope);
  const raw = keep ? await learnerRequest<unknown>(pathOf(keep)) : await learnerRequest<unknown>(prefix, {
    method: 'POST', body: JSON.stringify({ licenseClass }),
  });
  ensureCurrent(); assertStudyScope(scope);
  const next = parse(raw, fullScope);
  const chapters = listOf(catalog.chapters).map((row) => objectOf(row).chapterId);
  if (next.questions.some((question) => !chapters.includes(question.chapterId))) invalidStudy();
  if (keep) sameSession(keep, next);
  return next;
}
async function read(data: ChapterStudy) {
  const raw = await learnerRequest<unknown>(pathOf(data)); assertStudyScope(data.scope);
  const next = parse(raw, data.scope); sameSession(data, next); return next;
}
export async function submitWrongAnswer(data: ChapterStudy, questionId: number, selectedAnswer: string) {
  const path = pathOf(data), question = data.questions.find((item) => item.id === questionId);
  if (!question || !question.choices.some((choice) => choice.key === selectedAnswer)) invalidStudy();
  const raw = await learnerRequest<unknown>(path + '/answers', { method: 'POST', body: JSON.stringify({ questionId, selectedAnswer }) });
  assertStudyScope(data.scope); const grade = answerOf(raw, question);
  if (grade.selectedAnswer !== selectedAnswer) invalidStudy();
  const next = await read(data), saved = next.answers[questionId];
  if (!saved || saved.selectedAnswer !== selectedAnswer || saved.isCorrect !== grade.isCorrect ||
    saved.correctAnswer !== grade.correctAnswer || saved.answeredAt !== grade.answeredAt) invalidStudy();
  return { ...next, currentQuestionId: questionId };
}
export async function saveWrongCursor(data: ChapterStudy, questionId: number) {
  const path = pathOf(data);
  if (!data.questions.some((question) => question.id === questionId)) {
    throw new DtsApiError('Câu này không thuộc lượt ôn đang dở. Mở lượt ôn để tiếp tục hoặc tải lại danh sách câu sai.');
  }
  if (data.status === 'COMPLETED') return { ...data, currentQuestionId: questionId };
  const raw = await learnerRequest<unknown>(path + '/cursor', { method: 'PUT', body: JSON.stringify({ questionId }) });
  assertStudyScope(data.scope); const next = parse(raw, data.scope); sameSession(data, next);
  if (next.currentQuestionId !== questionId) invalidStudy(); return next;
}
export async function finishWrongStudy(data: ChapterStudy) {
  const raw = await learnerRequest<unknown>(pathOf(data) + '/finish', { method: 'POST' });
  assertStudyScope(data.scope); const next = parse(raw, data.scope); sameSession(data, next);
  if (next.status !== 'COMPLETED') invalidStudy(); return next;
}
