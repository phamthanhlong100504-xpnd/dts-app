import type { HistoryItem } from './history-service';
export function historyTitle(item: HistoryItem) {
  return item.title ?? (item.activityType === 'RANDOM_EXAM' ? 'Thi thử ngẫu nhiên' : 'Bộ đề có sẵn');
}
export function historyDate(value: string) {
  const date = new Date(value), two = (number: number) => String(number).padStart(2, '0');
  return `${two(date.getHours())}:${two(date.getMinutes())} · ${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}
export function historyDuration(value: number | null) {
  return value === null ? '—' : `${Math.floor(value / 60)} phút ${String(value % 60).padStart(2, '0')} giây`;
}

export function historyCalendarDate(value: string) {
  const date = new Date(value), two = (number: number) => String(number).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}`;
}
