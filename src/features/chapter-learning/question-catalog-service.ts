import { assertSession, learnerRequest, reloadLearnerProfile } from '../session/session-service';
import { useLearnerSession } from '../session/session-store';
import { assertStudyScope } from './study-service';
import { idOf, invalidStudy, listOf, objectOf, questionOf, textOf, uniqueIds } from './study-contract';
import type { StudyQuestion, StudyScope } from './study-types';

export type BankQuestion = { question: StudyQuestion; chapterId: number; chapterName: string; position: number };
export function currentStudyScope(licenseClass: string): Omit<StudyScope, 'bankVersion'> {
  const version = useLearnerSession.getState().version;
  const current = assertSession(version);
  if (current.profile.selectedLicenseClass !== licenseClass) invalidStudy();
  return { version, userId: current.profile.id, licenseClass };
}

// A presentation-only search index of authenticated Practice GET responses.
// Never persisted; no progress or grades are calculated from this list.
export async function getBankQuestions(licenseClass: string, expectedBankVersion: string): Promise<BankQuestion[]> {
  const scope = currentStudyScope(licenseClass);
  await reloadLearnerProfile(); assertStudyScope(scope);
  const query = '?licenseClass=' + encodeURIComponent(licenseClass);
  const catalog = objectOf(await learnerRequest<unknown>('/api/practice/v1/questions/learning-catalog' + query));
  assertStudyScope(scope);
  if (catalog.licenseClass !== licenseClass || textOf(catalog.bankVersion) !== expectedBankVersion) invalidStudy();
  const chapters = listOf(catalog.chapters).map(objectOf).sort((a, b) => idOf(a.chapterId) - idOf(b.chapterId));
  if (new Set(chapters.map((chapter) => chapter.chapterId)).size !== chapters.length) invalidStudy();
  const groups = await Promise.all(chapters.map(async (chapter) => {
    const chapterId = idOf(chapter.chapterId);
    if (chapterId > 6) invalidStudy();
    const chapterName = textOf(chapter.chapterName);
    const rows = listOf(await learnerRequest<unknown>(`/api/practice/v1/questions/chapter/${chapterId}${query}`));
    assertStudyScope(scope);
    if (rows.length !== idOf(chapter.totalQuestions)) invalidStudy();
    return rows.map((row) => {
      if (objectOf(row).chapter !== chapterId) invalidStudy();
      return { question: questionOf(row), chapterId, chapterName };
    });
  }));
  assertStudyScope(scope);
  const questions = groups.flat(); uniqueIds(questions.map((row) => row.question));
  if (questions.length !== idOf(catalog.totalQuestions)) invalidStudy();
  return questions.map((row, index) => ({ ...row, position: index + 1 }));
}

export function searchQuestionText(rows: BankQuestion[], query: string): BankQuestion[] {
  const normalize = (value: string) => value.toLocaleLowerCase('vi-VN').normalize('NFD')
    .replace(/\p{M}/gu, '').replace(/đ/gu, 'd');
  const terms = normalize(query).trim().split(/\s+/u).filter(Boolean);
  return terms.length ? rows.filter((row) => terms.every((term) => normalize(row.question.text).includes(term))) : [];
}

