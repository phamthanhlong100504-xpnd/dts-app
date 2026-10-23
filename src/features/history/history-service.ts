import { DtsApiError } from '../../lib/api/http';
import { learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { currentStudyScope } from '../chapter-learning/question-catalog-service';
import { assertStudyScope } from '../chapter-learning/study-service';
import { countOf, idOf, invalidStudy, listOf, objectOf, questionOf, textOf, uniqueIds } from '../chapter-learning/study-contract';
import type { StudyQuestion, StudyScope } from '../chapter-learning/study-types';

export type HistoryActivity = 'RANDOM_EXAM' | 'PRESET_EXAM';
export type HistoryOutcome = 'ALL' | 'PASSED' | 'FAILED';
export type HistoryPeriod = 'ALL' | '7D' | '30D';
export type HistoryFilters = { activity: HistoryActivity; outcome: HistoryOutcome; period: HistoryPeriod; page: number };
export type HistoryItem = {
  id: string; sourceType: string | null; sourceId: string | null; activityType: HistoryActivity;
  title: string | null; licenseClass: string; correctCount: number | null; questionCount: number | null;
  result: 'PASSED' | 'FAILED'; score: number | null; maxScore: number | null; durationSeconds: number | null;
  completedAt: string; resultAvailable: boolean; reviewAvailable: boolean | null;
  sourceResult: { sourceType: string; sourceId: string; resultPath: string } | null;
};
export type HistoryPage = { items: HistoryItem[]; page: number; total: number; totalPages: number };
export type HistoryOverview = HistoryPage & { summary: { total: number; passed: number; failed: number } };
export type HistoryDetail = HistoryItem & { metadata: Record<string, unknown>; resultSnapshot: Record<string, unknown> };
export type HistoryReview = { history: HistoryDetail; scope: StudyScope; questions: (StudyQuestion & {
  selectedAnswer: string | null; isCorrect: boolean })[]; correct: number; wrong: number; unanswered: number; passed: boolean };
const prefix = '/api/result/v1/results/me/history';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export function resultIdOf(value: unknown): string {
  const id = textOf(value); if (!uuid.test(id)) invalidStudy(); return id;
}
function optionalText(value: unknown): string | null { return value == null ? null : textOf(value); }
function optionalNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalidStudy(); return value;
}
function itemOf(value: unknown, licenseClass: string): HistoryItem {
  const raw = objectOf(value);
  if (!['RANDOM_EXAM', 'PRESET_EXAM'].includes(String(raw.activityType)) || raw.licenseClass !== licenseClass ||
    raw.targetType !== 'EXAM' || !['PASSED', 'FAILED'].includes(String(raw.result)) || raw.resultAvailable !== true ||
    (raw.reviewAvailable !== null && typeof raw.reviewAvailable !== 'boolean')) invalidStudy();
  const completedAt = textOf(raw.completedAt);
  if (!Number.isFinite(Date.parse(completedAt))) invalidStudy();
  const correctCount = raw.correctCount == null ? null : countOf(raw.correctCount);
  const questionCount = raw.questionCount == null ? null : idOf(raw.questionCount);
  if (correctCount !== null && questionCount !== null && correctCount > questionCount) invalidStudy();
  const source = raw.sourceResult == null ? null : objectOf(raw.sourceResult);
  return { id: resultIdOf(raw.id), sourceType: optionalText(raw.sourceType), sourceId: raw.sourceId == null ? null : resultIdOf(raw.sourceId),
    activityType: raw.activityType as HistoryActivity, title: optionalText(raw.displayTitle), licenseClass,
    correctCount, questionCount, result: raw.result as HistoryItem['result'], score: optionalNumber(raw.score),
    maxScore: optionalNumber(raw.maxScore), durationSeconds: raw.durationSeconds == null ? null : countOf(raw.durationSeconds),
    completedAt, resultAvailable: true, reviewAvailable: raw.reviewAvailable as boolean | null,
    sourceResult: source ? { sourceType: textOf(source.sourceType), sourceId: resultIdOf(source.sourceId), resultPath: textOf(source.resultPath) } : null };
}
export function practiceSourceId(item: HistoryItem): string | null {
  const source = item.sourceResult;
  if (!item.resultAvailable || item.sourceType !== 'PRACTICE_SESSION' || !item.sourceId || !source ||
    source.sourceType !== item.sourceType || source.sourceId.toLowerCase() !== item.sourceId.toLowerCase()) return null;
  // This is a web pathname contract, never an arbitrary URL to open/fetch.
  const match = /^\/practice\/result\/([0-9a-f-]+)$/iu.exec(source.resultPath);
  return match && uuid.test(match[1]) && match[1].toLowerCase() === item.sourceId.toLowerCase() ? item.sourceId : null;
}
function queryFor(licenseClass: string, filters: HistoryFilters, from: string | null, page: number, size: number, outcome: HistoryOutcome) {
  if (!['RANDOM_EXAM', 'PRESET_EXAM'].includes(filters.activity) || !['ALL', 'PASSED', 'FAILED'].includes(outcome) ||
    !Number.isSafeInteger(page) || page < 0) invalidStudy();
  const query = new URLSearchParams({ targetType: 'EXAM', activityType: filters.activity, licenseClass,
    page: String(page), size: String(size), sort: 'completedAt,desc' });
  if (outcome !== 'ALL') query.set('result', outcome);
  if (from) query.set('from', from); return '?' + query.toString();
}
async function pageOf(licenseClass: string, filters: HistoryFilters, from: string | null, page: number, size: number, outcome: HistoryOutcome): Promise<HistoryPage> {
  const raw = objectOf(await learnerRequest<unknown>(prefix + queryFor(licenseClass, filters, from, page, size, outcome), {}, 'plain'));
  const items = listOf(raw.content).map((value) => itemOf(value, licenseClass));
  const total = countOf(raw.totalElements), totalPages = countOf(raw.totalPages);
  if (raw.number !== page || raw.size !== size || items.length > size || new Set(items.map((item) => item.id)).size !== items.length ||
    items.some((item) => item.activityType !== filters.activity || outcome !== 'ALL' && item.result !== outcome) ||
    totalPages !== Math.ceil(total / size) || (total === 0 && items.length > 0)) invalidStudy();
  return { items, page, total, totalPages };
}
export async function getHistoryOverview(licenseClass: string, filters: HistoryFilters, now = new Date()): Promise<HistoryOverview> {
  const scope = currentStudyScope(licenseClass);
  await reloadLearnerProfile(); assertStudyScope(scope);
  if (!['ALL', '7D', '30D'].includes(filters.period)) invalidStudy();
  const from = filters.period === 'ALL' ? null : new Date(now.getTime() - (filters.period === '7D' ? 7 : 30) * 86400000).toISOString();
  const [page, total, passed, failed] = await Promise.all([
    pageOf(licenseClass, filters, from, filters.page, 15, filters.outcome),
    pageOf(licenseClass, filters, from, 0, 1, 'ALL'), pageOf(licenseClass, filters, from, 0, 1, 'PASSED'),
    pageOf(licenseClass, filters, from, 0, 1, 'FAILED'),
  ]);
  assertStudyScope(scope);
  // Totals come from server-filtered Page metadata, never just the visible page.
  return { ...page, summary: { total: total.total, passed: passed.total, failed: failed.total } };
}
export async function getHistoryDetail(resultId: string, licenseClass: string): Promise<HistoryDetail> {
  resultIdOf(resultId); const scope = currentStudyScope(licenseClass);
  await reloadLearnerProfile(); assertStudyScope(scope);
  const raw = objectOf(await learnerRequest<unknown>(prefix + '/' + encodeURIComponent(resultId), {}, 'plain'));
  assertStudyScope(scope); const item = itemOf(raw, licenseClass);
  if (item.id.toLowerCase() !== resultId.toLowerCase()) invalidStudy();
  return { ...item, metadata: raw.metadata == null ? {} : objectOf(raw.metadata),
    resultSnapshot: raw.resultSnapshot == null ? {} : objectOf(raw.resultSnapshot) };
}
export async function getHistoryReview(resultId: string, licenseClass: string): Promise<HistoryReview> {
  const scope = currentStudyScope(licenseClass), history = await getHistoryDetail(resultId, licenseClass);
  assertStudyScope(scope);
  const sourceId = practiceSourceId(history);
  if (!sourceId || history.reviewAvailable === false) throw new DtsApiError('Bài làm này hiện không cho phép xem lại câu hỏi.');
  const raw = objectOf(await learnerRequest<unknown>(`/api/practice/v1/exams/${encodeURIComponent(sourceId)}/result`));
  assertStudyScope(scope);
  if (raw.examId !== sourceId || raw.examType !== licenseClass || !['COMPLETED', 'TIMEOUT'].includes(String(raw.status)) || typeof raw.passed !== 'boolean') invalidStudy();
  const questions = listOf(raw.answers).map((value) => {
    const row = objectOf(value), question = questionOf({ ...row, id: row.questionId });
    const selectedAnswer = row.selectedAnswer === '' || row.selectedAnswer == null ? null : textOf(row.selectedAnswer);
    if (typeof row.isCorrect !== 'boolean' || selectedAnswer && !question.choices.some((choice) => choice.key === selectedAnswer)) invalidStudy();
    return { ...question, selectedAnswer, isCorrect: row.isCorrect };
  });
  uniqueIds(questions);
  const total = idOf(raw.totalQuestions), correct = countOf(raw.correctCount), wrong = countOf(raw.answeredWrongCount), unanswered = countOf(raw.unansweredCount);
  if (questions.length !== total || correct + wrong + unanswered !== total || raw.wrongCount !== wrong + unanswered ||
    questions.filter((question) => question.isCorrect).length !== correct || questions.filter((question) => !question.selectedAnswer).length !== unanswered) invalidStudy();
  // Bank metadata is only an image-cache qualifier here, never a current-bank
  // replacement for this historical source result. Empty means not supplied.
  const bankVersion = typeof history.metadata.bankVersion === 'string' ? history.metadata.bankVersion : '';
  return { history, scope: { ...scope, bankVersion }, questions, correct, wrong, unanswered, passed: raw.passed };
}
