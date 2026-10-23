import type { ExamMode } from './exam-service';
export function modeLabel(mode: ExamMode) { return mode === 'EXAM' ? 'Chấm điểm sau khi nộp bài' : 'Chấm điểm từng câu'; }
export function clock(milliseconds: number | null) {
  if (milliseconds === null) return '—';
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
