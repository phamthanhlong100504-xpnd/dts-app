import { learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { currentStudyScope } from './question-catalog-service';
import { openCriticalStudy, readCriticalStudy, saveCriticalStudyCursor, submitCriticalStudyAnswer } from './critical-study-service';
import { idOf, invalidStudy, listOf, objectOf, textOf, uniqueIds } from './study-contract';
import { assertStudyScope, finishStudy, openChapterStudy, saveStudyCursor, submitStudyAnswer } from './study-service';
import type { ChapterStudy, StudyMode, StudyTarget } from './study-types';
import { finishWrongStudy, openWrongStudy, saveWrongCursor, submitWrongAnswer } from '../wrong-questions/wrong-study-service';

function combine(chapters: ChapterStudy[], currentQuestionId?: number): ChapterStudy {
  const first = chapters[0];
  if (!first || chapters.some((chapter) => chapter.collection || chapter.mode !== first.mode ||
    JSON.stringify(chapter.scope) !== JSON.stringify(first.scope))) invalidStudy();
  if (new Set(chapters.map((chapter) => chapter.chapterId)).size !== chapters.length) invalidStudy();
  const questions = chapters.flatMap((chapter) => chapter.questions); uniqueIds(questions);
  const answers = Object.assign({}, ...chapters.map((chapter) => chapter.answers));
  const active = chapters.find((chapter) => chapter.questions.some((question) => question.id === currentQuestionId)) ??
    chapters.find((chapter) => chapter.status !== 'COMPLETED') ?? first;
  return { scope: first.scope, chapterId: 0, chapterName: 'Toàn bộ câu hỏi', mode: first.mode, collection: 'all',
    reviewSessionId: null, chapters, questions, answers, currentQuestionId: active.currentQuestionId,
    status: chapters.every((chapter) => chapter.status === 'COMPLETED') ? 'COMPLETED' :
      Object.keys(answers).length ? 'IN_PROGRESS' : 'NOT_STARTED' };
}
function replaceChapter(data: ChapterStudy, next: ChapterStudy) {
  const chapters = data.chapters;
  if (!chapters?.some((chapter) => chapter.chapterId === next.chapterId)) invalidStudy();
  return combine(chapters.map((chapter) => chapter.chapterId === next.chapterId ? next : chapter), next.currentQuestionId);
}
function owningChapter(data: ChapterStudy, questionId: number) {
  assertStudyScope(data.scope);
  const chapter = data.chapters?.find((item) => item.questions.some((question) => question.id === questionId));
  if (!chapter) invalidStudy();
  return chapter;
}
async function openAllStudy(mode: StudyMode, licenseClass: string, existing: ChapterStudy | null | undefined,
  ensureCurrent: () => void, checkpoint: (data: ChapterStudy) => void): Promise<ChapterStudy> {
  const scope = currentStudyScope(licenseClass);
  await reloadLearnerProfile(); ensureCurrent(); assertStudyScope(scope);
  const query = '?licenseClass=' + encodeURIComponent(licenseClass);
  const [rawCatalog, rawProgress] = await Promise.all([
    learnerRequest<unknown>('/api/practice/v1/questions/learning-catalog' + query),
    learnerRequest<unknown>('/api/practice/v1/learning/chapters' + query),
  ]);
  ensureCurrent(); assertStudyScope(scope);
  const catalog = objectOf(rawCatalog), progress = objectOf(rawProgress), bankVersion = textOf(catalog.bankVersion);
  if (catalog.licenseClass !== licenseClass || progress.licenseClass !== licenseClass || progress.bankVersion !== bankVersion ||
    catalog.totalQuestions !== progress.totalQuestions) invalidStudy();
  const rows = listOf(catalog.chapters).map(objectOf).sort((a, b) => idOf(a.chapterId) - idOf(b.chapterId));
  if (new Set(rows.map((row) => row.chapterId)).size !== rows.length ||
    rows.reduce((sum, row) => sum + idOf(row.totalQuestions), 0) !== idOf(catalog.totalQuestions)) invalidStudy();
  if (mode === 'review' && progress.learnedQuestions !== catalog.totalQuestions) invalidStudy();
  const keep = existing?.collection === 'all' && existing.mode === mode && existing.scope.version === scope.version &&
    existing.scope.userId === scope.userId && existing.scope.licenseClass === licenseClass ? existing : null;
  if (keep && keep.scope.bankVersion !== bankVersion) invalidStudy();
  const chapters: ChapterStudy[] = [];
  // Review has one canonical backend session per chapter. Keep their returned
  // IDs after each step so a later failure cannot restart a completed round.
  for (const row of rows) {
    const chapterId = idOf(row.chapterId);
    ensureCurrent(); assertStudyScope(scope);
    const chapter = await openChapterStudy(chapterId, mode, licenseClass,
      keep?.chapters?.find((item) => item.chapterId === chapterId), ensureCurrent);
    if (chapter.scope.bankVersion !== bankVersion || chapter.questions.length !== row.totalQuestions) invalidStudy();
    chapters.push(chapter); ensureCurrent();
    checkpoint(combine([...chapters, ...(keep?.chapters ?? []).filter((known) =>
      !chapters.some((loaded) => loaded.chapterId === known.chapterId))], keep?.currentQuestionId));
  }
  return combine(chapters, keep?.currentQuestionId);
}

export async function openStudyTarget(target: StudyTarget, mode: StudyMode, licenseClass: string,
  existing: ChapterStudy | null | undefined, ensureCurrent: () => void,
  checkpoint: (data: ChapterStudy) => void): Promise<ChapterStudy> {
  if (mode !== 'learn' && mode !== 'review') invalidStudy();
  if (target === 'wrong') {
    if (mode !== 'review') invalidStudy();
    return openWrongStudy(licenseClass, existing, ensureCurrent);
  }
  if (target === 'all') return openAllStudy(mode, licenseClass, existing, ensureCurrent, checkpoint);
  if (target === 'critical') return openCriticalStudy(mode, licenseClass, existing, ensureCurrent);
  return openChapterStudy(target, mode, licenseClass, existing, ensureCurrent);
}
export async function submitTargetAnswer(data: ChapterStudy, questionId: number, selectedAnswer: string): Promise<ChapterStudy> {
  if (data.collection === 'wrong') return submitWrongAnswer(data, questionId, selectedAnswer);
  if (data.collection === 'critical') return submitCriticalStudyAnswer(data, questionId, selectedAnswer);
  if (data.collection === 'all') return replaceChapter(data, await submitStudyAnswer(owningChapter(data, questionId), questionId, selectedAnswer));
  return submitStudyAnswer(data, questionId, selectedAnswer);
}
export async function saveTargetCursor(data: ChapterStudy, questionId: number): Promise<ChapterStudy> {
  if (data.collection === 'wrong') return saveWrongCursor(data, questionId);
  if (data.collection === 'critical') return saveCriticalStudyCursor(data, questionId);
  if (data.collection === 'all') return replaceChapter(data, await saveStudyCursor(owningChapter(data, questionId), questionId));
  return saveStudyCursor(data, questionId);
}
export async function finishTargetStudy(data: ChapterStudy): Promise<ChapterStudy> {
  assertStudyScope(data.scope);
  if (data.collection === 'wrong') return finishWrongStudy(data);
  if (data.collection === 'critical') {
    const next = await readCriticalStudy(data);
    if (data.mode === 'review' && next.status !== 'COMPLETED') invalidStudy();
    return next;
  }
  if (data.collection === 'all') {
    if (!data.chapters || (data.mode === 'review' && Object.keys(data.answers).length !== data.questions.length)) invalidStudy();
    const chapters: ChapterStudy[] = [];
    for (const chapter of data.chapters) {
      assertStudyScope(data.scope); chapters.push(await finishStudy(chapter));
    }
    return combine(chapters, data.currentQuestionId);
  }
  return finishStudy(data);
}
