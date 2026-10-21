import { learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { currentStudyScope } from '../chapter-learning/question-catalog-service';
import { assertStudyScope } from '../chapter-learning/study-service';
import { countOf, idOf, invalidStudy, listOf, objectOf, questionOf, textOf, uniqueIds } from '../chapter-learning/study-contract';
import type { ChapterStudy, StudyAnswer, StudyQuestion, StudyScope } from '../chapter-learning/study-types';
import { openWrongStudy, submitWrongAnswer, finishWrongStudy } from './wrong-study-service';
import { DtsApiError } from '../../lib/api/http';

export type WrongFilter = 'all' | 'theory' | 'signs' | 'situations' | 'critical';
export type WrongQuestion = { question: StudyQuestion; chapterId: number; sourceNumber: number | null;
  previousAnswer: string | null; lastWrongAt: string | null };
export type WrongOverview = { scope: StudyScope; total: number; questions: WrongQuestion[] };
export async function getWrongOverview(licenseClass: string): Promise<WrongOverview> {
  const scope = currentStudyScope(licenseClass);
  await reloadLearnerProfile(); assertStudyScope(scope);
  const query = '?licenseClass=' + encodeURIComponent(licenseClass);
  const [catalogValue, overviewValue, questionsValue] = await Promise.all([
    learnerRequest<unknown>('/api/practice/v1/questions/learning-catalog' + query),
    learnerRequest<unknown>('/api/practice/v1/questions/wrong/overview' + query),
    learnerRequest<unknown>('/api/practice/v1/questions/wrong' + query),
  ]);
  assertStudyScope(scope);
  const catalog = objectOf(catalogValue), overview = objectOf(overviewValue);
  if (catalog.licenseClass !== licenseClass || overview.licenseClass !== licenseClass) invalidStudy();
  const chapters = listOf(catalog.chapters).map((row) => idOf(objectOf(row).chapterId));
  const questions = listOf(questionsValue).map((value): WrongQuestion => {
    const row = objectOf(value), chapterId = idOf(row.chapterId);
    if (!chapters.includes(chapterId) || chapterId > 6) invalidStudy();
    const question = questionOf({ ...row, id: row.questionId });
    const previousAnswer = row.selectedAnswer == null ? null : textOf(row.selectedAnswer);
    if (previousAnswer && !question.choices.some((choice) => choice.key === previousAnswer)) invalidStudy();
    const lastWrongAt = row.lastWrongAt == null ? null : textOf(row.lastWrongAt);
    if (lastWrongAt && !Number.isFinite(Date.parse(lastWrongAt))) invalidStudy();
    return { question, chapterId, previousAnswer, lastWrongAt,
      sourceNumber: row.sourceQuestionId == null ? null : idOf(row.sourceQuestionId) };
  });
  uniqueIds(questions.map((row) => row.question));
  if (countOf(overview.totalWrongQuestions) !== questions.length || overview.hasWrongQuestions !== (questions.length > 0)) invalidStudy();
  return { scope: { ...scope, bankVersion: textOf(catalog.bankVersion) }, total: questions.length, questions };
}
export function filterWrongQuestions(rows: WrongQuestion[], filter: WrongFilter): WrongQuestion[] {
  if (!isWrongFilter(filter)) invalidStudy();
  return rows.filter((row) => {
    switch (filter) {
      case 'theory': return row.chapterId >= 1 && row.chapterId <= 4;
      case 'signs': return row.chapterId === 5;
      case 'situations': return row.chapterId === 6;
      case 'critical': return row.question.isCritical;
      default: return true;
    }
  });
}
export function isWrongFilter(value: unknown): value is WrongFilter {
  return typeof value === 'string' && ['all', 'theory', 'signs', 'situations', 'critical'].includes(value);
}
export type WrongReading = { scope: StudyScope; filter: WrongFilter; questions: WrongQuestion[]; initialQuestionId: number };
export async function getWrongReading(questionId: number, licenseClass: string, filter: WrongFilter): Promise<WrongReading> {
  if (!Number.isSafeInteger(questionId) || questionId <= 0 || !isWrongFilter(filter)) invalidStudy();
  // Read the current needsReview list. Do not start/resume a frozen review
  // session merely to read answers; that snapshot can differ from this list.
  const overview = await getWrongOverview(licenseClass);
  const questions = filterWrongQuestions(overview.questions, filter);
  if (!questions.some((row) => row.question.id === questionId)) {
    throw new DtsApiError('Câu này không còn trong danh sách câu cần ôn của bộ lọc đã chọn. Vui lòng quay lại danh sách.');
  }
  return { scope: overview.scope, filter, questions, initialQuestionId: questionId };
}

export type WrongAnswerSession = ChapterStudy;
function matchQuestion(data: WrongReading, row: WrongQuestion, session: WrongAnswerSession) {
  const question = session.questions.find((item) => item.id === row.question.id);
  if (session.scope.bankVersion !== data.scope.bankVersion || session.scope.userId !== data.scope.userId ||
      session.scope.licenseClass !== data.scope.licenseClass || session.scope.version !== data.scope.version) invalidStudy();
  if (!question) return false;
  if (question.chapterId !== row.chapterId || question.text !== row.question.text ||
      JSON.stringify(question.choices) !== JSON.stringify(row.question.choices) || question.isCritical !== row.question.isCritical ||
      question.imageUrl !== row.question.imageUrl || question.mediaFileId !== row.question.mediaFileId) invalidStudy();
  return true;
}
export async function submitWrongQuestionAnswer(data: WrongReading, row: WrongQuestion, selectedAnswer: string,
  existing: WrongAnswerSession | null, checkpoint: (session: WrongAnswerSession) => void,
  ensureCurrent: () => void = () => {}): Promise<{ grade: StudyAnswer; session: WrongAnswerSession }> {
  assertStudyScope(data.scope);
  if (!data.questions.some((item) => item.question.id === row.question.id) ||
      !row.question.choices.some((choice) => choice.key === selectedAnswer)) invalidStudy();
  const current = await getWrongOverview(data.scope.licenseClass);
  ensureCurrent(); assertStudyScope(data.scope);
  if (current.scope.bankVersion !== data.scope.bankVersion || !current.questions.some((item) => item.question.id === row.question.id)) invalidStudy();
  // An explicit answer prepares the server session behind this direct-answer
  // screen. Reading/revealing/skipping never starts or closes a round.
  let session = await openWrongStudy(data.scope.licenseClass, existing, ensureCurrent);
  ensureCurrent(); assertStudyScope(data.scope); checkpoint(session);
  const containsQuestion = matchQuestion(data, row, session);
  const previous = session.answers[row.question.id];
  // An older round can omit newly wrong questions or contain a correct answer
  // whose idempotent replay would not clear newer wrong evidence. Prepare a
  // fresh native round BEFORE posting the selected answer, once only.
  if (!containsQuestion || session.status !== 'IN_PROGRESS' ||
      (previous?.isCorrect && previous.selectedAnswer === selectedAnswer)) {
    session = await refreshWrongQuestionSession(data, row, session, checkpoint, ensureCurrent);
  }
  ensureCurrent();
  const next = await submitWrongAnswer(session, row.question.id, selectedAnswer);
  ensureCurrent(); assertStudyScope(data.scope); checkpoint(next);
  const grade = next.answers[row.question.id];
  if (!grade || grade.selectedAnswer !== selectedAnswer) invalidStudy();
  return { grade, session: next };
}
// The user requested direct answers without a round-management UI. Finishing
// archives only the old round's summary; the native API preserves every saved
// answer and the needsReview list. This runs only for an explicit answer.
async function refreshWrongQuestionSession(data: WrongReading, row: WrongQuestion,
  existing: WrongAnswerSession, checkpoint: (session: WrongAnswerSession) => void,
  ensureCurrent: () => void = () => {}): Promise<WrongAnswerSession> {
  assertStudyScope(data.scope);
  const session = await openWrongStudy(data.scope.licenseClass, existing, ensureCurrent);
  ensureCurrent(); assertStudyScope(data.scope);
  if (session.scope.bankVersion !== data.scope.bankVersion) invalidStudy();
  const finished = session.status === 'COMPLETED' ? session : await finishWrongStudy(session);
  ensureCurrent(); assertStudyScope(data.scope); checkpoint(finished);
  const next = await openWrongStudy(data.scope.licenseClass, null, ensureCurrent);
  ensureCurrent(); assertStudyScope(data.scope); checkpoint(next);
  if (!matchQuestion(data, row, next) || next.status !== 'IN_PROGRESS') {
    throw new DtsApiError('Chưa thể chấm câu này. Vui lòng đọc lại dữ liệu rồi chọn đáp án.');
  }
  return next;
}
