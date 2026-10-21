import { assertStudyScope } from '../chapter-learning/study-service';
import type { StudyAnswer } from '../chapter-learning/study-types';
import { filterWrongQuestions, getWrongOverview, submitWrongQuestionAnswer, type WrongAnswerSession, type WrongFilter, type WrongQuestion, type WrongReading } from './wrong-service';

type State = { data: WrongReading | null; row: WrongQuestion | null; grade: StudyAnswer | null;
  availableIds: number[]; loading: boolean; busy: boolean; resolved: boolean; needsReload: boolean; error: string | null };
export class WrongQuestionModel {
  private state: State = { data: null, row: null, grade: null, availableIds: [], loading: true, busy: false, resolved: false, needsReload: false, error: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private pending = false;
  private queuedReload = false;
  private reviewSession: WrongAnswerSession | null = null;
  private currentId: number;
  constructor(questionId: number, private licenseClass: string, private filter: WrongFilter) { this.currentId = questionId; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private set(patch: Partial<State>) { this.state = { ...this.state, ...patch }; this.listeners.forEach((listener) => listener()); }
  invalidate() { this.generation++; this.queuedReload = false; }
  async load() {
    if (this.pending) { this.queuedReload = true; return; }
    const generation = ++this.generation;
    this.set({ loading: true, error: null });
    try {
      const overview = await getWrongOverview(this.licenseClass);
      if (generation !== this.generation) return;
      const questions = filterWrongQuestions(overview.questions, this.filter);
      const fresh = questions.find((row) => row.question.id === this.currentId);
      const previous = this.state.data?.scope;
      const sameScope = previous && previous.version === overview.scope.version && previous.userId === overview.scope.userId &&
        previous.licenseClass === overview.scope.licenseClass && previous.bankVersion === overview.scope.bankVersion;
      const knownRow = sameScope ? this.state.row : null;
      const row = fresh ?? knownRow;
      if (!row) throw new Error('Câu này không còn trong danh sách cần ôn. Vui lòng quay lại danh sách.');
      // Retain only the displayed card after a server-confirmed removal, so its
      // verdict remains visible. Membership and the next card use the fresh GET.
      // Keep the current card's place when a GET confirms its removal. This
      // lets both swipe directions continue from the question just answered.
      const current = new Map(questions.map((item) => [item.question.id, item]));
      const queue = sameScope ? this.state.data!.questions.flatMap((item) => {
        const updated = current.get(item.question.id);
        return updated ? [updated] : item.question.id === this.currentId ? [row] : [];
      }) : questions;
      const queuedIds = new Set(queue.map((item) => item.question.id));
      for (const item of questions) if (!queuedIds.has(item.question.id)) queue.push(item);
      this.set({ data: { scope: overview.scope, filter: this.filter, questions: queue, initialQuestionId: this.currentId },
        row, availableIds: questions.map((item) => item.question.id), grade: sameScope ? this.state.grade : null,
        resolved: !fresh, loading: false, busy: false, needsReload: false });
    } catch (error) {
      if (generation === this.generation) this.set({ loading: false, busy: false, needsReload: true,
        error: error instanceof Error ? error.message : 'Không đọc được kết quả từ máy chủ.' });
    }
  }
  async answer(selectedAnswer: string) {
    const { data, row, resolved, needsReload } = this.state;
    if (this.pending || this.state.loading || !data || !row || resolved || needsReload) return;
    this.pending = true;
    const generation = this.generation;
    this.set({ busy: true, error: null });
    try {
      assertStudyScope(data.scope);
      const ensureCurrent = () => { if (generation !== this.generation) throw new Error('Màn ôn đã thay đổi.'); assertStudyScope(data.scope); };
      const { grade } = await submitWrongQuestionAnswer(data, row, selectedAnswer, this.reviewSession,
        (session) => { ensureCurrent(); this.reviewSession = session; }, ensureCurrent);
      if (generation !== this.generation) return;
      this.set({ grade });
      const overview = await getWrongOverview(this.licenseClass);
      assertStudyScope(data.scope);
      if (generation !== this.generation) return;
      if (overview.scope.bankVersion !== data.scope.bankVersion) throw new Error('Bộ câu hỏi đã thay đổi. Vui lòng mở lại danh sách.');
      const questions = filterWrongQuestions(overview.questions, this.filter);
      const remains = questions.some((item) => item.question.id === row.question.id);
      // Membership still comes from the current server list, never a local
      // decrement. A concurrent change must be read again, not overwritten.
      const needsReload = grade.isCorrect && remains;
      this.set({ availableIds: questions.map((item) => item.question.id), resolved: !remains,
        busy: false, needsReload,
        error: needsReload ? 'Kết quả đã được lưu nhưng danh sách chưa cập nhật. Vui lòng đọc lại kết quả.' : null });
    } catch (error) {
      if (generation === this.generation) this.set({ busy: false, needsReload: true,
        error: error instanceof Error ? error.message : 'Chưa xác nhận được kết quả. Đọc lại từ máy chủ trước khi trả lời tiếp.' });
    } finally {
      this.pending = false;
      if (this.queuedReload) { this.queuedReload = false; void this.load(); }
    }
  }
  move(direction: 1 | -1): boolean {
    if (this.pending || this.state.loading || this.state.needsReload) return false;
    const data = this.state.data;
    if (!data) return false;
    try { assertStudyScope(data.scope); }
    catch (error) {
      this.set({ needsReload: true, error: error instanceof Error ? error.message : 'Phiên học đã thay đổi.' });
      return false;
    }
    const index = data.questions.findIndex((row) => row.question.id === this.currentId);
    if (index < 0) return false;
    for (let nextIndex = index + direction; nextIndex >= 0 && nextIndex < data.questions.length; nextIndex += direction) {
      const next = data.questions[nextIndex];
      // Only the fresh server list determines which cards still need review.
      if (!this.state.availableIds.includes(next.question.id)) continue;
      this.currentId = next.question.id;
      this.set({ row: next, grade: null, resolved: false, error: null });
      return true;
    }
    return false;
  }
  skip(): boolean {
    if (this.pending || this.state.loading || this.state.needsReload) return true;
    const moved = this.move(1);
    // Skip keeps its existing return-to-list behavior at the end. Swiping
    // calls move directly and stays on the last/first card instead.
    return moved || this.state.needsReload;
  }
}
