import { DtsApiError } from '../../lib/api/http';
import { assertSession, learnerRequest } from '../session/session-service';
import { useLearnerSession } from '../session/session-store';

type Catalog = {
  licenseClass: string; bankVersion: string; totalQuestions: number; criticalQuestions: number;
  chapters: { chapterId: number; chapterName: string; totalQuestions: number; criticalQuestions: number }[];
};
type Overview = {
  licenseClass: string; bankVersion: string; totalQuestions: number; learnedQuestions: number; completionPercent: number;
  chapters: { chapterId: number; totalQuestions: number; learnedQuestions: number; completionPercent: number; status: string; resumeQuestionId: number | null }[];
};
type LearnedAnswer = { questionId: number; isCorrect: boolean };
export type ChapterRow = {
  id: number; name: string; total: number; learned: number; correct: number; wrong: number;
  status: string; resumeQuestionId: number | null;
};
export type ChapterOverview = {
  licenseClass: string; bankVersion: string; total: number; learned: number; correct: number; wrong: number;
  wrongQuestions: number; chapters: ChapterRow[];
  critical: { total: number; learned: number; completionPercent: number };
};

function validCount(value: unknown): value is number { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
function invalid(): never { throw new DtsApiError('Dữ liệu chương chưa đồng nhất. Vui lòng tải lại.'); }

// The overview, saved answers, wrong count and critical progress all come from
// Practice. No Progress service, device attempts, or exam-history replay is used.
export async function getChapterOverview(licenseClass: string): Promise<ChapterOverview> {
  const version = useLearnerSession.getState().version;
  if (!licenseClass || assertSession(version).profile.selectedLicenseClass !== licenseClass) invalid();
  const query = '?licenseClass=' + encodeURIComponent(licenseClass);
  const [catalog, overview, critical, wrong] = await Promise.all([
    learnerRequest<Catalog>('/api/practice/v1/questions/learning-catalog' + query),
    learnerRequest<Overview>('/api/practice/v1/learning/chapters' + query),
    learnerRequest<{ licenseClass: string; totalQuestions: number; learnedQuestions: number; completionPercent: number }>('/api/practice/v1/questions/critical/overview' + query),
    learnerRequest<{ licenseClass: string; totalWrongQuestions: number }>('/api/practice/v1/questions/wrong/overview' + query),
  ]);
  assertSession(version);
  if (!catalog || !overview || !critical || !wrong ||
    [catalog, overview, critical, wrong].some((item) => item.licenseClass !== licenseClass) ||
    typeof catalog.bankVersion !== 'string' || !catalog.bankVersion || catalog.bankVersion !== overview.bankVersion ||
    !Array.isArray(catalog.chapters) || !Array.isArray(overview.chapters) ||
    !validCount(catalog.totalQuestions) || !validCount(overview.totalQuestions) ||
    !validCount(overview.learnedQuestions) || overview.learnedQuestions > overview.totalQuestions ||
    catalog.totalQuestions !== overview.totalQuestions || !validCount(wrong.totalWrongQuestions) ||
    !validCount(critical.totalQuestions) || !validCount(critical.learnedQuestions) ||
    critical.learnedQuestions > critical.totalQuestions || !validCount(critical.completionPercent) || critical.completionPercent > 100 ||
    catalog.criticalQuestions !== critical.totalQuestions) invalid();
  const catalogIds = catalog.chapters.map((item) => item?.chapterId);
  const overviewIds = overview.chapters.map((item) => item?.chapterId);
  // Practice overview includes empty chapters; the catalog groups only chapters
  // with applicable questions. Empty overview-only rows are valid for a license.
  if (new Set(catalogIds).size !== catalogIds.length || new Set(overviewIds).size !== overviewIds.length ||
    catalogIds.some((id) => !overviewIds.includes(id)) || overview.chapters.some((chapter) =>
      !chapter || !validCount(chapter.chapterId) || chapter.chapterId < 1 ||
      !validCount(chapter.totalQuestions) || !validCount(chapter.learnedQuestions) ||
      (!catalogIds.includes(chapter.chapterId) && (chapter.totalQuestions !== 0 || chapter.learnedQuestions !== 0)))) invalid();
  const rows = await Promise.all(catalog.chapters.map(async (chapter): Promise<ChapterRow> => {
    const progress = overview.chapters.find((item) => item.chapterId === chapter.chapterId);
    if (!validCount(chapter.chapterId) || chapter.chapterId < 1 || typeof chapter.chapterName !== 'string' || !chapter.chapterName.trim() ||
      !validCount(chapter.totalQuestions) || !progress || progress.totalQuestions !== chapter.totalQuestions ||
      !validCount(progress.learnedQuestions) || progress.learnedQuestions > chapter.totalQuestions ||
      !['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'].includes(progress.status)) invalid();
    const answers = await learnerRequest<LearnedAnswer[]>(`/api/practice/v1/learning/chapters/${chapter.chapterId}/answers${query}`);
    if (!Array.isArray(answers) || answers.length !== progress.learnedQuestions ||
      answers.some((answer) => !answer || !validCount(answer.questionId) || answer.questionId < 1 || typeof answer.isCorrect !== 'boolean') ||
      new Set(answers.map((answer) => answer.questionId)).size !== answers.length) invalid();
    const correct = answers.filter((answer) => answer.isCorrect).length;
    return { id: chapter.chapterId, name: chapter.chapterName, total: chapter.totalQuestions, learned: progress.learnedQuestions,
      correct, wrong: answers.length - correct, status: progress.status, resumeQuestionId: progress.resumeQuestionId };
  }));
  assertSession(version);
  if (rows.reduce((sum, row) => sum + row.total, 0) !== overview.totalQuestions ||
    rows.reduce((sum, row) => sum + row.learned, 0) !== overview.learnedQuestions) invalid();
  return { licenseClass, bankVersion: overview.bankVersion, total: overview.totalQuestions, learned: overview.learnedQuestions,
    correct: rows.reduce((sum, row) => sum + row.correct, 0), wrong: rows.reduce((sum, row) => sum + row.wrong, 0),
    wrongQuestions: wrong.totalWrongQuestions, chapters: rows.filter((row) => row.total > 0).sort((a, b) => a.id - b.id),
    critical: { total: critical.totalQuestions, learned: critical.learnedQuestions, completionPercent: critical.completionPercent } };
}
