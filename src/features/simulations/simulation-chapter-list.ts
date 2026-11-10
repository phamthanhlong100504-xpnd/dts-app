import type { SimulationLearningSource } from './domain/simulation-learning-source';
import type { SimulationScope, ScenarioListItem } from './domain/simulation-learning-types';

/** Fetch every server page for the expanded chapter; never invent rows/counts. */
export async function readAllChapterScenarios(source: SimulationLearningSource, scope: SimulationScope, chapterId: string, isCurrent: () => boolean) {
  const items: ScenarioListItem[] = [], ids = new Set<string>();
  let expectedCount: number | undefined, expectedPages: number | undefined, bank: string | undefined;
  for (let page = 0; ; page++) {
    if (!isCurrent()) return null;
    const value = await source.chapter(scope, chapterId, 'ALL', page);
    if (!isCurrent()) return null;
    if (value.page !== page || value.chapter.id !== chapterId || value.scope.userId !== scope.userId || value.scope.licenseClass !== scope.licenseClass || (scope.bankVersion && value.scope.bankVersion !== scope.bankVersion)) throw new Error('Danh sách tình huống không khớp nội dung đã mở.');
    expectedCount ??= value.filteredCount; expectedPages ??= value.totalPages; bank ??= value.scope.bankVersion;
    if (!Number.isSafeInteger(expectedCount) || expectedCount < 0 || !Number.isSafeInteger(expectedPages) || expectedPages < 0 || expectedPages > 10000 || value.filteredCount !== expectedCount || value.totalPages !== expectedPages || value.scope.bankVersion !== bank) throw new Error('Danh sách đã thay đổi. Vui lòng mở lại chương.');
    for (const item of value.items) {
      if (ids.has(item.id) || item.chapterId !== chapterId || (items.length > 0 && item.number <= items[items.length - 1].number)) throw new Error('Thứ tự tình huống đã thay đổi. Vui lòng tải lại.');
      ids.add(item.id); items.push(item);
    }
    if (page + 1 >= expectedPages) {
      if (items.length !== expectedCount) throw new Error('Chưa tải đủ danh sách tình huống. Vui lòng thử lại.');
      return items;
    }
    if (value.items.length === 0 || items.length >= expectedCount) throw new Error('Danh sách tình huống chưa đầy đủ. Vui lòng thử lại.');
  }
}
