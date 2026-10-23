import { useLearnerSession } from '../session/session-store';
import { answerExam, finishExam, getExamSession, moveExam, pauseOrResumeExam, type ExamResult, type ExamSession } from './exam-service';

export type ExamSessionState = { data: ExamSession | null; selectedAnswer: string | null; loading: boolean; busy: boolean; needsReload: boolean; error: string | null };
export class ExamSessionModel {
  private state: ExamSessionState = { data: null, selectedAnswer: null, loading: true, busy: false, needsReload: false, error: null };
  private listeners = new Set<() => void>();
  private generation = 0;
  private pending = false;
  private reloadQueued = false;
  constructor(private id: string, private license: string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(change: Partial<ExamSessionState>) { this.state = { ...this.state, ...change }; for (const listener of this.listeners) listener(); }
  private current(generation: number, version: number) {
    const current = useLearnerSession.getState();
    return generation === this.generation && version === current.version && current.session?.profile.selectedLicenseClass === this.license;
  }
  private accept(data: ExamSession) { this.update({ data, selectedAnswer: data.answers[String(data.currentQuestionId)] ?? null }); }
  invalidate() { this.generation++; this.reloadQueued = false; }
  async load() {
    if (this.pending) { this.reloadQueued = true; return; }
    const generation = ++this.generation, version = useLearnerSession.getState().version;
    this.update({ loading: true, busy: false, error: null });
    try { const data = await getExamSession(this.id, this.license); if (this.current(generation, version)) { this.accept(data); this.update({ needsReload: false }); } }
    catch (error) { if (this.current(generation, version)) this.update({ error: error instanceof Error ? error.message : 'Không đọc được bài làm.', needsReload: true }); }
    finally { if (this.current(generation, version)) this.update({ loading: false }); }
  }
  private async run<T>(action: (data: ExamSession, ensureCurrent: () => void) => Promise<T>, accept: (value: T) => void): Promise<T | null> {
    if (this.pending || this.state.loading || this.state.needsReload || !this.state.data) return null;
    const generation = this.generation, version = useLearnerSession.getState().version;
    if (!this.current(generation, version)) return null;
    const ensureCurrent = () => { if (!this.current(generation, version)) throw new Error('Phiên làm bài đã thay đổi.'); };
    this.pending = true; this.update({ busy: true, error: null });
    try { const value = await action(this.state.data, ensureCurrent); ensureCurrent(); accept(value); return value; }
    catch (error) { if (this.current(generation, version)) this.update({ error: error instanceof Error ? error.message : 'Chưa xác nhận được thao tác.', needsReload: true }); return null; }
    finally { this.pending = false; if (this.current(generation, version)) this.update({ busy: false }); if (this.reloadQueued) { this.reloadQueued = false; void this.load(); } }
  }
  async select(answer: string) {
    const data = this.state.data;
    if (!data || this.pending || this.state.loading || this.state.needsReload || data.status !== 'IN_PROGRESS') return;
    const question = data.questions.find((q) => q.id === data.currentQuestionId);
    if (!question?.choices.some((choice) => choice.key === answer)) return;
    this.update({ selectedAnswer: answer });
    if (data.mode === 'EXAM' && data.answers[String(data.currentQuestionId)] !== answer) {
      await this.run((current) => answerExam(current, current.currentQuestionId, answer), (next) => this.accept(next));
    }
  }
  async check() {
    const answer = this.state.selectedAnswer;
    if (!answer || this.state.data?.mode !== 'PRACTICE' || this.state.data.status !== 'IN_PROGRESS') return;
    await this.run((data) => answerExam(data, data.currentQuestionId, answer), (next) => this.accept(next));
  }
  async move(questionId: number) {
    if (this.state.data?.status !== 'IN_PROGRESS' || this.state.data.currentQuestionId === questionId) return;
    // An unconfirmed PRACTICE selection is a UI draft, never a learned answer.
    await this.run((data) => moveExam(data, questionId), (next) => this.accept(next));
  }
  private async flushDraft(data: ExamSession, ensureCurrent: () => void) {
    const answer = this.state.selectedAnswer;
    if (data.status === 'IN_PROGRESS' && answer && answer !== data.answers[String(data.currentQuestionId)]) {
      const next = await answerExam(data, data.currentQuestionId, answer); ensureCurrent(); return next;
    }
    return data;
  }
  async pauseAndExit() {
    return this.run(async (data, ensureCurrent) => {
      if (data.status === 'PAUSED') return data;
      const next = await this.flushDraft(data, ensureCurrent); ensureCurrent();
      return ['COMPLETED', 'TIMEOUT'].includes(next.status) ? next : pauseOrResumeExam(next);
    }, (next) => this.accept(next));
  }
  async resume() {
    if (this.state.data?.status !== 'PAUSED') return null;
    return this.run((data) => pauseOrResumeExam(data), (next) => this.accept(next));
  }
  async finish(): Promise<ExamResult | null> {
    if (this.state.data?.status !== 'IN_PROGRESS') return null;
    return this.run(async (data, ensureCurrent) => {
      const next = await this.flushDraft(data, ensureCurrent); ensureCurrent(); return finishExam(next);
    }, (result) => { if (this.state.data) this.update({ data: { ...this.state.data, status: result.status, remainingTimeMs: 0 } }); });
  }
}
