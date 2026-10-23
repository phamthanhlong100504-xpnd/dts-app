import { DtsApiError } from '../../lib/api/http';
import { learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { currentStudyScope } from '../chapter-learning/question-catalog-service';
import { assertStudyScope } from '../chapter-learning/study-service';
import { countOf, idOf, invalidStudy, listOf, objectOf, questionOf, textOf, uniqueIds } from '../chapter-learning/study-contract';
import type { StudyQuestion, StudyScope } from '../chapter-learning/study-types';
export type ExamMode = 'EXAM' | 'PRACTICE';
export type ExamConfig = { examType: string; totalQuestions: number; durationMinutes: number; passingScore: number; criticalQuestionCount: number };
export type ActiveExam = { examId: string; examType: string; mode: ExamMode; status: 'IN_PROGRESS' | 'PAUSED'; totalQuestions: number; answeredCount: number; currentPosition: number; remainingTimeMs: number | null; presetId: string | null; title: string };
export type Preset = { id: string; title: string; code: string; licenseClass: string; totalQuestions: number; durationSeconds: number; userStatus: string; latestAttempt: { sessionId: string; status: string } | null };
export type ExamSession = { scope: StudyScope; examId: string; examType: string; mode: ExamMode; status: string; totalQuestions: number; questions: StudyQuestion[]; answers: Record<string, string>; currentQuestionId: number; remainingTimeMs: number | null; observedAt: number; feedback: Record<string, { selectedAnswer: string; correctAnswer: string; isCorrect: boolean; explanation: string }> };
export type ExamResult = { scope: StudyScope; examId: string; examType: string; mode: ExamMode; status: string; total: number; correct: number; wrong: number; unanswered: number; passed: boolean; durationMinutes: number | null; elapsedTimeMs: number | null; questions: (StudyQuestion & { selectedAnswer: string | null; isCorrect: boolean })[] };
const prefix = '/api/practice/v1/exams';
export function examId(value: unknown): string { const id = textOf(value); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id)) invalidStudy(); return id; }
function modeOf(value: unknown): ExamMode { if (value !== 'EXAM' && value !== 'PRACTICE') invalidStudy(); return value; }
function statusOf(value: unknown): string { if (!['IN_PROGRESS', 'PAUSED', 'COMPLETED', 'TIMEOUT'].includes(String(value))) invalidStudy(); return String(value); }
async function readScope(license: string) { const scope = { ...currentStudyScope(license), bankVersion: '' }; await reloadLearnerProfile(); assertStudyScope(scope); return scope; }
export async function getExamLobby(license: string, presets = false) {
  const scope = await readScope(license);
  const [configRaw, activeRaw, presetRaw] = await Promise.all([
    learnerRequest(prefix + '/config?examType=' + encodeURIComponent(license)),
    learnerRequest(prefix + '/active?examType=' + encodeURIComponent(license)),
    learnerRequest(prefix + '/presets?licenseClass=' + encodeURIComponent(license)),
  ]);
  assertStudyScope(scope); const c = objectOf(configRaw);
  if (c.examType !== license) invalidStudy();
  const config: ExamConfig = { examType: license, totalQuestions: idOf(c.totalQuestions), durationMinutes: idOf(c.durationMinutes), passingScore: countOf(c.passingScore), criticalQuestionCount: countOf(c.criticalQuestionCount) };
  if (config.passingScore > config.totalQuestions || config.criticalQuestionCount > config.totalQuestions) invalidStudy();
  let active: ActiveExam | null = null;
  let items: Preset[] = [];
  {
    const p = objectOf(presetRaw); if (p.licenseClass !== license) invalidStudy();
    items = listOf(p.items).map((value) => { const item = objectOf(value), last = item.latestAttempt == null ? null : objectOf(item.latestAttempt);
      if (item.licenseClass !== license || item.status !== 'PUBLISHED' || !['NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED'].includes(String(item.userStatus))) invalidStudy();
      return { id: examId(item.id), title: textOf(item.title), code: textOf(item.code), licenseClass: license, totalQuestions: idOf(item.totalQuestions), durationSeconds: idOf(item.durationSeconds), userStatus: String(item.userStatus), latestAttempt: last ? { sessionId: examId(last.sessionId), status: statusOf(last.status) } : null };
    });
    if (items.length !== countOf(p.total) || new Set(items.map((i) => i.id)).size !== items.length) invalidStudy();
  }
  if (activeRaw != null) {
    const a = objectOf(activeRaw);
    if (a.examType !== license || !['IN_PROGRESS', 'PAUSED'].includes(String(a.status))) invalidStudy();
    const activeId = examId(a.examId), activeMode = modeOf(a.mode);
    const raw = await learnerRequest(prefix + '/' + activeId); assertStudyScope(scope);
    const current = sessionOf(raw, scope, activeId);
    if (current.mode !== activeMode) invalidStudy();
    if (current.status === 'IN_PROGRESS' || current.status === 'PAUSED') {
      const preset = items.find((item) => item.latestAttempt?.sessionId === activeId);
      active = { examId: activeId, examType: license, mode: current.mode, status: current.status,
        totalQuestions: current.totalQuestions, answeredCount: Object.keys(current.answers).length,
        currentPosition: current.questions.findIndex((q) => q.id === current.currentQuestionId) + 1,
        remainingTimeMs: current.remainingTimeMs, presetId: preset?.id ?? null,
        title: preset?.title ?? `Bài thi hạng ${license}` };
    }
  }
  return { scope, config, active, items: presets ? items : [] };
}
export async function getExamSetup(license: string, presetId?: string) {
  if (presetId) examId(presetId);
  const lobby = await getExamLobby(license, true);
  const preset = presetId ? lobby.items.find((item) => item.id === presetId) : undefined;
  if (presetId && !preset) throw new DtsApiError('Bộ đề không còn trong danh sách được phát hành cho hạng này.');
  if (preset && preset.totalQuestions !== lobby.config.totalQuestions) invalidStudy();
  return { ...lobby, preset: preset ?? null };
}
function sessionOf(value: unknown, scope: StudyScope, requestedId?: string): ExamSession {
  const raw = objectOf(value), id = examId(raw.examId), mode = modeOf(raw.mode), status = statusOf(raw.status);
  if (raw.examType !== scope.licenseClass || requestedId && id !== requestedId) invalidStudy();
  const questions = listOf(raw.questions).map((v) => { const q = objectOf(v); return questionOf({ ...q, questionId: q.id }, true); }); uniqueIds(questions);
  const total = idOf(raw.totalQuestions); if (questions.length !== total) invalidStudy();
  const answers: Record<string, string> = {};
  for (const [key, value] of Object.entries(objectOf(raw.answers))) { const question = questions.find((q) => String(q.id) === key), selected = textOf(value); if (!question || !question.choices.some((q) => q.key === selected)) invalidStudy(); answers[key] = selected; }
  if (countOf(raw.answeredCount) !== Object.keys(answers).length) invalidStudy();
  const cursor = raw.currentQuestionId == null ? questions[0].id : idOf(raw.currentQuestionId); if (!questions.some((q) => q.id === cursor)) invalidStudy();
  const feedback: ExamSession['feedback'] = {};
  if (mode === 'PRACTICE' && raw.answerFeedback != null) {
    for (const [key, value] of Object.entries(objectOf(raw.answerFeedback))) { const f = objectOf(value), question = questions.find((q) => String(q.id) === key);
      if (!question || f.selectedAnswer !== answers[key] || typeof f.isCorrect !== 'boolean' || !question.choices.some((q) => q.key === f.correctAnswer)) invalidStudy();
      feedback[key] = { selectedAnswer: textOf(f.selectedAnswer), correctAnswer: textOf(f.correctAnswer), isCorrect: f.isCorrect, explanation: typeof f.explanation === 'string' ? f.explanation : '' };
    }
  }
  // Server remaining time is the countdown anchor; client time never grades a question.
  const remaining = raw.remainingTimeMs == null ? null : countOf(raw.remainingTimeMs);
  return { scope, examId: id, examType: scope.licenseClass, mode, status, totalQuestions: total, questions, answers, currentQuestionId: cursor, remainingTimeMs: remaining, observedAt: Date.now(), feedback };
}
export async function getExamSession(id: string, license: string): Promise<ExamSession> {
  examId(id); const scope = await readScope(license); const data = await learnerRequest(prefix + '/' + encodeURIComponent(id)); assertStudyScope(scope); return sessionOf(data, scope, id);
}
export async function startExam(license: string, mode: ExamMode, presetId?: string, ensureCurrent: () => void = () => {}): Promise<ExamSession> {
  modeOf(mode); const scope = await readScope(license); if (presetId) examId(presetId); ensureCurrent(); assertStudyScope(scope);
  const raw = await learnerRequest(presetId ? prefix + '/presets/' + encodeURIComponent(presetId) + '/sessions' : prefix, { method: 'POST', body: JSON.stringify(presetId ? { mode } : { examType: license, mode }) });
  assertStudyScope(scope); const data = sessionOf(raw, scope); if (data.mode !== mode) invalidStudy(); return data;
}
export async function answerExam(data: ExamSession, questionId: number, selectedAnswer: string) {
  assertStudyScope(data.scope); if (data.status !== 'IN_PROGRESS') throw new DtsApiError('Bài thi hiện không nhận đáp án.');
  const q = data.questions.find((v) => v.id === questionId); if (!q || !q.choices.some((v) => v.key === selectedAnswer)) invalidStudy();
  const result = objectOf(await learnerRequest(prefix + '/' + data.examId + '/answers', { method: 'POST', body: JSON.stringify({ questionId: String(questionId), selectedAnswer }) }));
  assertStudyScope(data.scope); if (data.mode === 'PRACTICE' && (typeof result.isCorrect !== 'boolean' || !q.choices.some((v) => v.key === result.correctAnswer))) invalidStudy();
  // A full GET confirms persisted state/feedback; callers recover by GET after an uncertain ACK, never replay POST automatically.
  const next = await getExamSession(data.examId, data.examType);
  if (next.mode !== data.mode || next.answers[String(questionId)] !== selectedAnswer || next.mode === 'PRACTICE' && !next.feedback[String(questionId)]) invalidStudy();
  return next;
}
export async function moveExam(data: ExamSession, questionId: number) {
  assertStudyScope(data.scope); if (data.status !== 'IN_PROGRESS' || !data.questions.some((q) => q.id === questionId)) invalidStudy();
  await learnerRequest(prefix + '/' + data.examId + '/cursor', { method: 'PUT', body: JSON.stringify({ currentQuestionId: questionId }) }); assertStudyScope(data.scope);
  const next = await getExamSession(data.examId, data.examType); if (next.mode !== data.mode || next.currentQuestionId !== questionId && next.status === 'IN_PROGRESS') invalidStudy(); return next;
}
export async function pauseOrResumeExam(data: ExamSession) {
  assertStudyScope(data.scope); if (!['IN_PROGRESS', 'PAUSED'].includes(data.status)) invalidStudy();
  const pause = data.status === 'IN_PROGRESS';
  const raw = await learnerRequest(prefix + '/' + data.examId + (pause ? '/pause' : '/resume'), { method: 'POST', ...(pause ? { body: JSON.stringify({ currentQuestionId: data.currentQuestionId }) } : {}) });
  assertStudyScope(data.scope); return sessionOf(raw, data.scope, data.examId);
}
export async function finishExam(data: ExamSession) {
  assertStudyScope(data.scope); if (data.status === 'PAUSED') throw new DtsApiError('Tiếp tục bài thi trước khi nộp bài.');
  const raw = await learnerRequest(prefix + '/' + data.examId + '/finish', { method: 'POST' }); assertStudyScope(data.scope); return resultOf(raw, data.scope, data.examId);
}
function resultOf(value: unknown, scope: StudyScope, id: string): ExamResult {
  const raw = objectOf(value); if (examId(raw.examId) !== id || raw.examType !== scope.licenseClass || !['COMPLETED', 'TIMEOUT'].includes(String(raw.status)) || typeof raw.passed !== 'boolean') invalidStudy();
  const questions = listOf(raw.answers).map((value) => { const row = objectOf(value); const q = questionOf({ ...row, id: row.questionId });
    const selected = row.selectedAnswer == null || row.selectedAnswer === '' ? null : textOf(row.selectedAnswer);
    if (typeof row.isCorrect !== 'boolean' || selected && !q.choices.some((v) => v.key === selected)) invalidStudy();
    return { ...q, selectedAnswer: selected, isCorrect: row.isCorrect };
  }); uniqueIds(questions);
  const total = idOf(raw.totalQuestions), correct = countOf(raw.correctCount), wrong = countOf(raw.answeredWrongCount), unanswered = countOf(raw.unansweredCount);
  if (questions.length !== total || correct + wrong + unanswered !== total || raw.wrongCount !== wrong + unanswered || questions.filter((q) => q.isCorrect).length !== correct || questions.filter((q) => !q.selectedAnswer).length !== unanswered) invalidStudy();
  return { scope, examId: id, examType: scope.licenseClass, mode: modeOf(raw.mode), status: String(raw.status), total, correct, wrong, unanswered, passed: raw.passed, elapsedTimeMs: null, durationMinutes: raw.durationMinutes == null ? null : idOf(raw.durationMinutes), questions };
}
function serverInstant(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/u.test(value)) return null;
  const time = Date.parse(value); return Number.isFinite(time) ? time : null;
}
function elapsedTime(result: ExamResult, rawResult: Record<string, unknown>, rawSession: Record<string, unknown>): number | null {
  const started = serverInstant(rawResult.startedAt), completed = serverInstant(rawResult.completedAt), deadline = serverInstant(rawSession.expiresAt);
  const sessionStarted = serverInstant(rawSession.startedAt);
  if (started === null || completed === null || deadline === null || sessionStarted !== started || completed < started ||
    result.durationMinutes === null || rawSession.durationMinutes !== result.durationMinutes) return null;
  // Resume moves expiresAt by the frozen remaining time. Subtracting the final
  // unused time from the budget excludes all paused time, unlike wall-clock age.
  const duration = result.durationMinutes * 60000;
  const used = duration - Math.max(0, deadline - completed);
  return used >= 0 && used <= duration ? used : null;
}
export async function getExamResult(id: string, license: string): Promise<ExamResult> {
  examId(id); const scope = await readScope(license);
  const raw = objectOf(await learnerRequest(prefix + '/' + id + '/result')); assertStudyScope(scope);
  const result = resultOf(raw, scope, id);
  if (result.durationMinutes === null) return result;
  const rawSession = objectOf(await learnerRequest(prefix + '/' + id)); assertStudyScope(scope);
  const session = sessionOf(rawSession, scope, id);
  if (session.mode !== result.mode || session.status !== result.status || session.questions.length !== result.questions.length ||
    session.questions.some((question, index) => question.id !== result.questions[index].id)) invalidStudy();
  return { ...result, elapsedTimeMs: elapsedTime(result, raw, rawSession) };
}

export async function retryExam(result: ExamResult, ensureCurrent: () => void = () => {}) {
  assertStudyScope(result.scope); examId(result.examId); ensureCurrent();
  const raw = await learnerRequest(prefix + '/' + result.examId + '/retry', { method: 'POST' });
  assertStudyScope(result.scope); const next = sessionOf(raw, result.scope);
  if (next.examId === result.examId || next.mode !== result.mode || next.status !== 'IN_PROGRESS' || Object.keys(next.answers).length ||
    next.questions.length !== result.questions.length || next.questions.some((q, i) => q.id !== result.questions[i].id)) invalidStudy();
  return next;
}
