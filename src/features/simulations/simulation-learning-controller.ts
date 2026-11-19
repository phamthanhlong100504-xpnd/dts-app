import { newSimulationEventId } from './simulation-id';
import type { SimulationContext } from './simulation-context';
import type { SimulationCommand, SimulationScenarioPage, SimulationInterruptReason } from './domain/simulation-learning-types';
import { parseWire, wireDetail } from './domain/simulation-wire';

export type LearningState = { loading: boolean; data: SimulationScenarioPage | null; busy: boolean; playRequested: boolean; active: boolean; error: unknown };
/** One queue per owned attempt. No client score, fabricated media sample or persisted progress. */
export class MobileSimulationLearning {
  private state: LearningState = { loading: true, data: null, busy: false, playRequested: false, active: false, error: null };
  private listeners = new Set<() => void>();
  private epoch = 0;
  private disposed = false;
  private tail: Promise<unknown> = Promise.resolve();
  private queued = 0;
  private failed: SimulationCommand | null = null;
  private inReaction = false;
  constructor(readonly context: SimulationContext, readonly scenarioId: string, private requestedAttempt?: string) {}
  snapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  activate() { this.disposed = false; }
  dispose() { this.disposed = true; this.epoch++; this.inReaction = false; this.state = { ...this.state, active: false, playRequested: false }; }
  private live(epoch: number) { return !this.disposed && epoch === this.epoch; }
  private emit(partial: Partial<LearningState>) { if (!this.disposed) { this.state = { ...this.state, ...partial }; this.listeners.forEach(fn => fn()); } }
  private enqueue(run: (epoch: number) => Promise<void>) {
    const epoch = this.epoch; this.queued++;
    const task = this.tail.then(async () => { if (this.live(epoch)) { this.context.assertCurrent(); await run(epoch); } });
    this.tail = task.catch(() => {});
    return task.finally(() => { this.queued--; });
  }
  private scope() { return { ...this.context.scope, ...(this.state.data ? { bankVersion: this.state.data.scope.bankVersion } : {}) }; }
  private intent(kind: SimulationCommand['kind'], mediaTimeMs?: number): SimulationCommand {
    const data = this.state.data;
    return { kind, scenarioId: this.scenarioId, attemptId: data?.attemptId ?? null, playbackEventId: data?.playbackEventId ?? null,
      eventId: newSimulationEventId(), ...(mediaTimeMs === undefined ? {} : { mediaTimeMs }) };
  }
  private async command(input: SimulationCommand, epoch: number) {
    const before = this.state.data;
    this.failed = input;
    try {
      const next = await this.context.learning.command(this.scope(), input);
      if (!this.live(epoch)) return;
      if (next.scenario.id !== this.scenarioId || (before && next.scope.bankVersion !== before.scope.bankVersion)) throw new Error('Nội dung đã thay đổi. Hãy mở lại danh sách.');
      if (before?.responseRecorded && next.attemptId === before.attemptId && !next.responseRecorded) throw new Error('Phản hồi cũ chưa được phép thay kết quả đã xác nhận.');
      this.failed = null; this.requestedAttempt = next.attemptId ?? undefined;
      this.emit({ data: next, error: null });
    } catch (error) {
      if (this.live(epoch)) this.emit({ error, active: false, playRequested: false });
      throw error;
    }
  }
  load() { return this.enqueue(async epoch => {
    this.emit({ loading: true, active: false, playRequested: false, error: null });
    try {
      let attempt = this.requestedAttempt;
      if (!attempt) {
        const raw = await this.context.api.get<unknown>(`/v1/simulations/scenarios/${this.scenarioId}`, { params: { licenseClass: this.context.scope.licenseClass, bankVersion: this.context.scope.bankVersion } });
        const detail = parseWire(wireDetail, raw);
        if (detail.scope.userId !== this.context.scope.userId || detail.scope.licenseClass !== this.context.scope.licenseClass || detail.scenario.scenarioId !== this.scenarioId || (this.context.scope.bankVersion && detail.scope.bankVersion !== this.context.scope.bankVersion)) throw new Error('Nội dung không khớp tài khoản hoặc phiên bản đã chọn.');
        attempt = detail.latestAttempt?.status !== 'CANCELLED' ? detail.latestAttempt?.attemptId : undefined;
      }
      const data = await this.context.learning.scenario(this.context.scope, this.scenarioId, attempt);
      if (this.live(epoch)) { this.requestedAttempt = data.attemptId ?? undefined; this.failed = null; this.emit({ loading: false, data, busy: false }); }
    } catch (error) { if (this.live(epoch)) this.emit({ loading: false, error, busy: false }); }
  }); }
  prepare(fresh = false) { return this.enqueue(async epoch => {
    if (!this.state.data) return;
    this.emit({ busy: true, active: false, playRequested: false, error: null });
    try {
      const data = this.state.data;
      const kind = fresh || !data.attemptId ? 'NEW_ATTEMPT' : 'RENEW_PLAYBACK';
      const request = this.failed?.kind === kind ? this.failed : this.intent(kind);
      await this.command(request, epoch);
      if (this.live(epoch)) this.emit({ busy: false, playRequested: true });
    } finally { if (this.live(epoch)) this.emit({ busy: false }); }
  }); }
  start(owner: string, ms: number) { return this.enqueue(async epoch => {
    const data = this.state.data;
    if (!data || data.readOnly || !this.state.playRequested || owner !== data.playbackEventId || Math.abs(ms - (data.resumeAtMs ?? 0)) > 200) throw new Error('Vị trí phát chưa sẵn sàng.');
    this.emit({ busy: true });
    try {
      await this.command(this.intent('START', data.resumeAtMs ?? 0), epoch);
      if (this.live(epoch) && this.state.data?.playbackEventId === owner) this.emit({ active: true, busy: false, playRequested: false });
      // Refresh only the capability snapshot, without starting another video segment.
      if (this.live(epoch) && this.state.active) void this.enqueue(async nextEpoch => {
        if (this.state.active && this.state.data?.playbackEventId === owner) {
          // A capability read must not delay START acknowledgment or stop a valid player.
          try {
            const next = await this.context.learning.command(this.scope(), this.intent('REFRESH_SHORTCUTS'));
            if (this.live(nextEpoch) && this.state.data?.playbackEventId === owner && next.playbackEventId === owner) this.emit({ data: next });
          } catch { /* Playback remains valid without optional shortcuts. */ }
        }
      }).catch(() => {});
    } finally { if (this.live(epoch)) this.emit({ busy: false }); }
  }); }
  heartbeat(read: () => number, owner: string) {
    if (this.queued || !this.state.active) return Promise.resolve();
    return this.enqueue(async epoch => {
      if (!this.state.active || this.state.data?.playbackEventId !== owner) return;
      await this.command(this.intent('HEARTBEAT', read()), epoch);
    });
  }
  respond(ms: number, owner: string) {
    if (this.inReaction || !this.state.active || this.state.data?.responseRecorded || this.state.data?.playbackEventId !== owner) return Promise.resolve();
    this.inReaction = true; const input = this.intent('RESPONSE', ms); this.emit({ busy: true });
    return this.enqueue(async epoch => {
      try { await this.command(input, epoch); }
      finally { this.inReaction = false; if (this.live(epoch)) this.emit({ busy: false }); }
    });
  }
  skipIntro(ms: number, owner: string) {
    const data = this.state.data;
    if (!this.state.active || !data?.shortcuts?.skip || data.playbackEventId !== owner || data.responseRecorded || ms >= 10000) return Promise.reject(new Error('Chưa thể bỏ qua phần mở đầu.'));
    const input = this.intent('SKIP_INTRO', ms);
    this.emit({ active: false, busy: true, playRequested: false });
    return this.enqueue(async epoch => {
      try { await this.command(input, epoch); if (this.live(epoch)) this.emit({ playRequested: true }); }
      finally { if (this.live(epoch)) this.emit({ busy: false }); }
    });
  }
  complete(ms: number, owner: string) {
    if (!this.state.active || this.state.data?.playbackEventId !== owner) return Promise.resolve();
    this.emit({ active: false, playRequested: false, busy: true });
    const safeMs = typeof this.state.data?.scenario.durationMs === 'number'
      ? Math.min(ms, this.state.data.scenario.durationMs)
      : ms;
    return this.enqueue(async epoch => {
      try { await this.command(this.intent('COMPLETE', safeMs), epoch); }
      finally { if (this.live(epoch)) this.emit({ busy: false }); }
    });
  }
  fault(reason: SimulationInterruptReason = 'VIDEO_ERROR', owner?: string) {
    if (!this.state.active || (owner && this.state.data?.playbackEventId !== owner)) return Promise.resolve();
    const input = { ...this.intent('INTERRUPT'), reason };
    this.emit({ active: false, playRequested: false, error: new Error('Video cần được tải lại để tiếp tục đúng vị trí đã lưu.') });
    return this.enqueue(async epoch => { try { await this.command(input, epoch); } catch { /* The next owned read recovers an interrupted lease. */ } });
  }
  retry() { return this.enqueue(async epoch => {
    this.emit({ busy: true, active: false, playRequested: false });
    try {
      if (this.failed && ['NEW_ATTEMPT', 'SKIP_INTRO'].includes(this.failed.kind)) {
        const pending = this.failed;
        await this.command(pending, epoch);
      }
      if (!this.live(epoch) || !this.state.data?.attemptId) return;
      await this.command(this.intent('RENEW_PLAYBACK'), epoch);
      if (this.live(epoch)) this.emit({ playRequested: !this.state.data?.readOnly });
    } finally { if (this.live(epoch)) this.emit({ busy: false }); }
  }); }
}
