import { learnerRequest } from '../session/session-service';
import { useLearnerSession } from '../session/session-store';
import { currentStudyScope } from '../chapter-learning/question-catalog-service';
import { assertStudyScope } from '../chapter-learning/study-service';
import { countOf, idOf, invalidStudy, listOf, objectOf, textOf } from '../chapter-learning/study-contract';
import { resolveQuestionImage } from '../chapter-learning/question-image-service';
export type Sign = { id: string; code: string; name: string; groupCode: string; groupName: string; mediaFileId: string; meaning: string; memoryTip: string | null };
function signOf(value: unknown): Sign { const s = objectOf(value); return { id: textOf(s.id), code: textOf(s.code), name: textOf(s.name), groupCode: textOf(s.groupCode), groupName: textOf(s.groupName), mediaFileId: textOf(s.mediaFileId), meaning: textOf(s.meaning), memoryTip: typeof s.memoryTip === 'string' ? s.memoryTip : null }; }
function scope() { const license = useLearnerSession.getState().session?.profile.selectedLicenseClass; if (!license) invalidStudy(); return currentStudyScope(license); }
export async function getSigns(group: string, query: string, page: number) {
  const current = scope(); if (!Number.isSafeInteger(page) || page < 0) invalidStudy();
  const params = new URLSearchParams({ page: String(page), size: '20' }); if (group) params.set('group', group); if (query.trim()) params.set('q', query.trim());
  const raw = objectOf(await learnerRequest('/api/practice/v1/traffic-signs?' + params)); assertStudyScope(current);
  const items = listOf(raw.items).map(signOf), total = countOf(raw.totalElements), pages = countOf(raw.totalPages);
  if (raw.page !== page || raw.size !== 20 || items.length > 20 || new Set(items.map((s) => s.id)).size !== items.length || pages !== Math.ceil(total / 20) || group && items.some((s) => s.groupCode !== group)) invalidStudy();
  const groups = listOf(raw.groups).map((value) => { const g = objectOf(value); return { code: textOf(g.groupCode), name: textOf(g.groupName), total: countOf(g.totalElements) }; });
  return { items, total, pages, groups, page, bankVersion: textOf(raw.bankVersion) };
}
export async function getSign(id: string) { const current = scope(), value = signOf(await learnerRequest('/api/practice/v1/traffic-signs/' + encodeURIComponent(id))); assertStudyScope(current); if (value.id !== id) invalidStudy(); return value; }
export async function getMediaImage(id: string) { const current = scope(); const raw = objectOf(await learnerRequest('/api/v1/media/' + encodeURIComponent(id), {}, 'plain')); assertStudyScope(current); if (raw.mediaId !== id || raw.status !== 'READY' || raw.mediaType !== 'IMAGE') invalidStudy(); return resolveQuestionImage(textOf(raw.url)); }
export type Tip = { id: string; title: string; quickRule: string; explanation: string };
export async function getTips() { const current = scope(); const raw = objectOf(await learnerRequest('/api/practice/v1/memory-tips')); assertStudyScope(current);
  const items: Tip[] = listOf(raw.items).map((value) => { const t = objectOf(value); idOf(t.sourceTipId); return { id: textOf(t.id), title: textOf(t.title), quickRule: textOf(t.quickRule), explanation: textOf(t.explanation) }; });
  if (items.length !== countOf(raw.totalElements) || new Set(items.map((t) => t.id)).size !== items.length) invalidStudy(); return items;
}
