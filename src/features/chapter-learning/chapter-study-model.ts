import { assertStudyScope } from './study-service';
import { finishTargetStudy, openStudyTarget, saveTargetCursor, submitTargetAnswer } from './study-collection-service';
import type { ChapterStudy, StudyMode, StudyTarget } from './study-types';

export type ChapterStudyState = {
  data: ChapterStudy | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  needsReload: boolean;
  selectedAnswer: string | null;
  editing: boolean;
  finished: boolean;
};

// This model holds only screen drafts and server responses. It never persists,
// grades answers, increments progress, or manufactures a completed exam.
export class ChapterStudyModel {
  private state: ChapterStudyState = { data: null, loading: true, busy: false, error: null,
    needsReload: false, selectedAnswer: null, editing: false, finished: false };
  private listeners = new Set<() => void>();
  private generation = 0;
  private pending = false;
  private queuedReload = false;
  private lastData: ChapterStudy | null = null;
  private initialQuestionOpened = false;
  constructor(private chapterId: StudyTarget, private mode: StudyMode, private licenseClass: string,
    private initialQuestionId?: number) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<ChapterStudyState>) {
    if (patch.data) this.lastData = patch.data;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  invalidate() { this.generation++; this.queuedReload = false; }
  private current(generation: number) { return generation === this.generation; }
  private afterOperation() {
    this.pending = false;
    if (this.queuedReload) { this.queuedReload = false; void this.load(); }
  }
  async load(): Promise<void> {
    if (this.pending) { this.queuedReload = true; return; }
    this.pending = true;
    const generation = ++this.generation;
    const existing = this.state.data ?? this.lastData;
    this.update({ loading: true, busy: false, error: null, needsReload: false });
    try {
      const ensureCurrent = () => {
        if (!this.current(generation)) throw new Error('Màn học đã thay đổi.');
      };
      let data = await openStudyTarget(this.chapterId, this.mode, this.licenseClass, existing, ensureCurrent,
        (partial) => { ensureCurrent(); this.lastData = partial; });
      ensureCurrent();
      if (this.initialQuestionId !== undefined && !this.initialQuestionOpened) {
        if (data.currentQuestionId !== this.initialQuestionId) data = await saveTargetCursor(data, this.initialQuestionId);
        ensureCurrent(); this.initialQuestionOpened = true;
      }
      if (this.current(generation)) this.update({ data, loading: false,
        selectedAnswer: data.answers[data.currentQuestionId]?.selectedAnswer ?? null,
        editing: false, finished: data.mode === 'review' && data.status === 'COMPLETED' });
    } catch (error) {
      if (this.current(generation)) this.update({ loading: false, data: null, error: this.message(error), needsReload: true });
    } finally { this.afterOperation(); }
  }
  private message(error: unknown) { return error instanceof Error ? error.message : 'Không thực hiện được yêu cầu.'; }
  private async run(operation: (data: ChapterStudy) => Promise<ChapterStudy>, finished = false, completeOnAnswer = false) {
    if (this.pending || this.state.loading || this.state.needsReload || !this.state.data) return;
    this.pending = true;
    const generation = this.generation;
    const data = this.state.data;
    this.update({ busy: true, error: null });
    try {
      assertStudyScope(data.scope);
      const next = await operation(data);
      assertStudyScope(next.scope);
      if (this.current(generation)) this.update({ data: next,
        selectedAnswer: next.answers[next.currentQuestionId]?.selectedAnswer ?? null, editing: false,
        finished: finished || (completeOnAnswer && next.mode === 'review' && next.status === 'COMPLETED') });
    } catch (error) {
      // A timed-out POST may already have committed. Require a GET reload before
      // another write; never invent a grade or automatically replay the POST.
      if (this.current(generation)) this.update({ error: this.message(error), needsReload: true });
    } finally {
      if (this.current(generation)) this.update({ busy: false });
      this.afterOperation();
    }
  }
  select(answer: string) {
    const data = this.state.data;
    if (!data || this.pending || this.state.needsReload ||
        (data.mode === 'review' && data.status === 'COMPLETED') ||
        (data.answers[data.currentQuestionId] && !this.state.editing)) return;
    const question = data.questions.find((item) => item.id === data.currentQuestionId);
    if (question?.choices.some((choice) => choice.key === answer)) this.update({ selectedAnswer: answer });
  }
  edit() {
    const data = this.state.data;
    if (!data || this.pending || this.state.needsReload ||
        ((data.mode === 'review' || data.collection === 'critical') && data.status === 'COMPLETED')) return;
    this.update({ editing: true, selectedAnswer: null });
  }
  async submit() {
    const data = this.state.data;
    const answer = this.state.selectedAnswer;
    if (!data || !answer || (data.mode === 'review' && data.status === 'COMPLETED') ||
      (data.answers[data.currentQuestionId] && !this.state.editing)) return;
    await this.run((current) => submitTargetAnswer(current, current.currentQuestionId, answer), false, true);
  }
  async move(questionId: number) {
    if (this.state.data?.currentQuestionId === questionId) return;
    await this.run((data) => saveTargetCursor(data, questionId));
  }
  async finish() { await this.run(finishTargetStudy, true); }
  viewAnswers() { if (!this.pending) this.update({ finished: false }); }
}
