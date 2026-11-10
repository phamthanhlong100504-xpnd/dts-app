import { newSimulationEventId } from "../simulation-id";
import { SimulationExamError } from "./simulation-exam-types";
import type { SimulationScope } from "./simulation-learning-types";
import type { SimulationExamSource } from "./simulation-exam-source";
import type {
  ExamCommand,
  ExamMediaOwner,
  ExamPhase,
  ExamSession,
  ExamWorkspaceState,
} from "./simulation-exam-types";
import {
  validateExamPlayback,
  sameExamOrigin,
  sameExamPolicy,
  validateExamSession,
} from "./simulation-exam-validation";

import {
  shortcutView,
  type ShortcutState,
  type ShortcutIntent,
} from "./simulation-shortcut-source";

/** One ordered write coordinator. Native media owns its nonce; server ACKs own progression. */
export class SimulationExamController {
  state: ExamWorkspaceState = { status: "loading" };
  private listeners = new Set<() => void>();
  private disposed = false;
  private epoch = 0;
  private tail: Promise<unknown> = Promise.resolve();
  private queued = 0;
  private last: ExamSession | null = null;
  private started: string | null = null;
  private mediaLost = true;
  private failed: ExamCommand | null = null;
  private reaction: ExamCommand | null = null;
  private shortcutNotice: string | null = null;
  private shortcutsOptedIn = false;
  private shortcutState: ShortcutState<ExamSession> | null = null;
  private shortcutFailed: ShortcutIntent | null = null;
  private enableIntent: ShortcutIntent | null = null;
  private requests = new Map<string, ExamCommand>();
  constructor(
    private source: SimulationExamSource,
    private scope: SimulationScope,
    private id: string,
  ) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.state;
  activate() {
    this.disposed = false;
  }
  dispose() {
    this.disposed = true;
    this.epoch++;
    this.shortcutState = null;
    this.shortcutNotice = null;
    this.shortcutsOptedIn = false;
    this.shortcutFailed = null;
    this.enableIntent = null;
    this.started = null;
    this.mediaLost = true;
  }
  private live(epoch: number) {
    return !this.disposed && epoch === this.epoch;
  }
  private emit(state: ExamWorkspaceState) {
    if (this.disposed) return;
    if (state.status === "ready") {
      const c = this.shortcutState,
        session = state.data.session;
      const view =
        c &&
        c.position === session.currentPosition &&
        c.playbackEventId === session.playbackEventId
          ? shortcutView(c)
          : this.shortcutsOptedIn
            ? {
                enabled: true,
                skip: false,
                next: false,
                skipReason: "STATE_UNAVAILABLE",
                position: session.currentPosition,
                playbackEventId: session.playbackEventId,
                startAtMs: 0,
              }
            : undefined;
      state = {
        ...state,
        data: {
          ...state.data,
          shortcuts: view,
          shortcutNotice: this.shortcutNotice,
        },
      };
    }
    this.state = state;
    this.listeners.forEach((fn) => fn());
  }
  private phase(phase: ExamPhase, busy = false) {
    if (this.state.status === "ready")
      this.emit({ ...this.state, data: { ...this.state.data, phase, busy } });
  }
  private key(s: ExamMediaOwner) {
    return `${s.position}:${s.playbackEventId}`;
  }
  private owns(owner?: ExamMediaOwner) {
    return (
      !!owner &&
      !!this.last &&
      this.last.status === "IN_PROGRESS" &&
      this.key(owner) ===
        this.key({
          position: this.last.currentPosition,
          playbackEventId: this.last.playbackEventId,
        })
    );
  }
  private enqueue<T>(
    run: (epoch: number) => Promise<T>,
  ): Promise<T | undefined> {
    const epoch = this.epoch;
    this.queued++;
    const promise = this.tail.then(() =>
      this.live(epoch) ? run(epoch) : undefined,
    );
    this.tail = promise.catch(() => {});
    return promise.finally(() => {
      this.queued--;
    });
  }
  private accept(s: ExamSession) {
    validateExamSession(s, this.scope, this.id);
    if (this.last && !validTransition(this.last, s))
      throw Error("Snapshot phiên thi thay đổi hoặc trả về trạng thái cũ.");
  }
  private command(
    kind: ExamCommand["kind"],
    ms?: number,
    eventId?: string,
  ): ExamCommand {
    if (!this.last) throw Error("Phiên chưa sẵn sàng.");
    const s = this.last,
      terminal = kind === "SUBMIT" || kind === "CANCEL";
    const key = `${kind}:${terminal ? this.id : this.key({ position: s.currentPosition, playbackEventId: s.playbackEventId })}`;
    let request = this.requests.get(key);
    if (!request) {
      request = {
        kind,
        sessionId: this.id,
        position: s.currentPosition,
        playbackEventId: terminal ? null : s.playbackEventId,
        eventId: eventId ?? newSimulationEventId(),
        ...(ms === undefined ? {} : { mediaTimeMs: ms }),
      };
      this.requests.set(key, request);
      if (this.requests.size > 128)
        this.requests.delete(this.requests.keys().next().value!);
    }
    return request;
  }
  private async adopt(
    s: ExamSession,
    epoch: number,
    resolve = false,
    autoStart = false,
  ) {
    if (!this.live(epoch)) return;
    this.accept(s);
    const previous = this.state.status === "ready" ? this.state.data : null;
    const same =
      previous?.playback?.position === s.currentPosition &&
      previous.playback.playbackEventId === s.playbackEventId;
    if (
      this.last &&
      (this.last.currentPosition !== s.currentPosition ||
        this.last.playbackEventId !== s.playbackEventId)
    ) {
      this.started = null;
      this.reaction = null;
    }
    this.last = s;
    if (s.status !== "IN_PROGRESS") {
      this.started = null;
      this.mediaLost = true;
      this.failed = null;
      this.reaction = null;
      this.emit({
        status: "ready",
        data: {
          session: s,
          playback: null,
          phase: s.status === "READY_TO_SUBMIT" ? "finalizing" : "ready",
          busy: false,
        },
      });
      return;
    }
    const phase: ExamPhase = this.mediaLost
      ? "video-error"
      : s.responseRecorded
        ? this.started
          ? "recorded"
          : "ready"
        : this.failed?.kind === "REACTION"
          ? "response-error"
          : this.reaction
            ? "response-pending"
            : this.started
              ? "playing"
              : "ready";
    if (same && !resolve) {
      this.emit({
        status: "ready",
        data: {
          session: s,
          playback: {
            ...previous!.playback!,
            responseRecorded: s.responseRecorded,
          },
          phase,
          busy: false,
          autoStart: previous?.autoStart,
        },
      });
      return;
    }
    this.emit({
      status: "ready",
      data: { session: s, playback: null, phase: "transition", busy: true },
    });
    try {
      const p = await this.source.playback(this.scope, this.id);
      if (!this.live(epoch)) return;
      const checkpoint = this.shortcutState;
      const approved =
        checkpoint?.enabled &&
        checkpoint.position === s.currentPosition &&
        checkpoint.playbackEventId === s.playbackEventId &&
        s.playbackState !== "PLAYING"
          ? checkpoint.startAtMs
          : 0;
      validateExamPlayback(p, s, approved);
      this.emit({
        status: "ready",
        data: {
          session: s,
          playback: p,
          phase: this.mediaLost ? "video-error" : "ready",
          busy: false,
          autoStart,
        },
      });
    } catch {
      if (this.live(epoch)) {
        this.mediaLost = true;
        this.started = null;
        this.phase("video-error");
      }
    }
  }
  private confirmed(c: ExamCommand, s: ExamSession, before: ExamSession) {
    if (!sameSnapshot(before, s)) return false;
    if (c.kind === "SUBMIT") return s.status === "COMPLETED";
    if (c.kind === "CANCEL") return s.status === "CANCELLED";
    if (c.kind === "COMPLETE_CURRENT")
      return s.completedScenarios >= c.position && s.status !== "CANCELLED";
    if (s.status !== "IN_PROGRESS" || s.currentPosition !== c.position)
      return false;
    if (c.kind === "RESTART")
      return (
        s.playbackEventId !== c.playbackEventId &&
        (!before.responseRecorded || s.responseRecorded)
      );
    if (s.playbackEventId !== c.playbackEventId || s.requiresRestart)
      return false;
    if (c.kind === "REACTION") return s.responseRecorded;
    return s.playbackState === "PLAYING";
  }
  private async succeeded(
    c: ExamCommand,
    s: ExamSession,
    before: ExamSession,
    epoch: number,
  ) {
    if (!this.live(epoch)) return;
    this.accept(s);
    if (c.kind !== "HEARTBEAT") this.failed = null;
    if (c.kind === "START") {
      this.started = this.key({
        position: s.currentPosition,
        playbackEventId: s.playbackEventId,
      });
      this.mediaLost = false;
    }
    if (c.kind === "RESTART") {
      this.started = null;
      this.mediaLost = false;
      this.reaction = null;
    }
    if (c.kind === "REACTION") this.reaction = null;
    const advanced = s.currentPosition !== before.currentPosition;
    if (advanced) {
      this.started = null;
      this.mediaLost = false;
    }
    // Pin the acknowledged legacy snapshot before optional capability reads;
    // an older GET must never erase a committed first reaction or progression.
    this.last = s;
    if (
      this.source.shortcuts &&
      (c.kind === "REACTION" || c.kind === "RESTART" || advanced)
    ) {
      const state = await this.refreshShortcuts(epoch, true);
      if (!this.live(epoch)) return;
      if (state) {
        if (
          state.snapshot.status === "IN_PROGRESS" &&
          (state.playbackEventId !== s.playbackEventId ||
            state.position !== s.currentPosition)
        ) {
          this.mediaLost = true;
          this.started = null;
        }
        s = state.snapshot;
      }
    }
    await this.adopt(s, epoch, c.kind === "RESTART" || advanced, advanced);
  }
  private async send(c: ExamCommand, epoch: number): Promise<void> {
    if (!this.live(epoch) || !this.last) return;
    const before = this.last;
    if (
      !["SUBMIT", "CANCEL"].includes(c.kind) &&
      !this.owns({ position: c.position, playbackEventId: c.playbackEventId! })
    )
      return;
    if (c.kind !== "HEARTBEAT")
      this.phase(
        c.kind === "START"
          ? "starting"
          : c.kind === "RESTART"
            ? "restarting"
            : c.kind === "REACTION"
              ? "response-pending"
              : c.kind === "COMPLETE_CURRENT"
                ? "transition"
                : c.kind === "SUBMIT"
                  ? "finalizing"
                  : this.state.status === "ready"
                    ? this.state.data.phase
                    : "ready",
        true,
      );
    try {
      const next = await this.source.command(this.scope, c);
      if (!this.live(epoch)) return;
      this.accept(next);
      if (!this.confirmed(c, next, before))
        throw Error("Chưa xác nhận được đúng thao tác.");
      await this.succeeded(c, next, before, epoch);
    } catch (error) {
      if (!this.live(epoch)) return;
      try {
        const fresh = await this.source.session(this.scope, this.id);
        if (!this.live(epoch)) return;
        this.accept(fresh);
        // Confirm the requested operation first; READY alone is not a submit/cancel ACK.
        if (
          c.kind !== "START" &&
          c.kind !== "HEARTBEAT" &&
          this.confirmed(c, fresh, before)
        ) {
          await this.succeeded(c, fresh, before, epoch);
          return;
        }
        if (fresh.status === "COMPLETED" || fresh.status === "CANCELLED") {
          await this.adopt(fresh, epoch);
          return;
        }
        if (fresh.currentPosition !== c.position && c.kind !== "CANCEL") {
          this.failed = null;
          this.last = fresh;
          this.started = null;
          this.mediaLost = true;
          await this.restartTask(epoch, fresh);
          return;
        }
        if (
          c.kind === "START" ||
          c.kind === "HEARTBEAT" ||
          fresh.requiresRestart ||
          fresh.playbackState === "INTERRUPTED" ||
          (error instanceof SimulationExamError &&
            ["RESTART_REQUIRED", "PLAYBACK_CHANGED"].includes(error.code))
        ) {
          this.mediaLost = true;
          this.started = null;
        }
        if (fresh.status === "READY_TO_SUBMIT") {
          this.last = fresh;
          this.emit({
            status: "ready",
            data: {
              session: fresh,
              playback: null,
              phase: "submission-error",
              busy: false,
            },
          });
        } else await this.adopt(fresh, epoch);
      } catch {
        /* Keep last acknowledged snapshot, never fabricate progression. */
      }
      this.failed = c;
      if (
        c.kind === "SUBMIT" ||
        (c.kind === "CANCEL" && this.last?.status === "READY_TO_SUBMIT")
      ) {
        this.phase("submission-error");
      } else if (
        this.mediaLost ||
        c.kind === "START" ||
        c.kind === "HEARTBEAT" ||
        c.kind === "RESTART"
      ) {
        this.mediaLost = true;
        this.started = null;
        this.phase("video-error");
      } else
        this.phase(
          c.kind === "REACTION"
            ? "response-error"
            : c.kind === "COMPLETE_CURRENT"
              ? "completion-error"
              : this.state.status === "ready"
                ? this.state.data.phase
                : "video-error",
        );
      throw error;
    }
  }
  private async refreshShortcuts(epoch: number, soft = false) {
    if (!this.source.shortcuts) return null;
    try {
      const state = await this.source.shortcuts.read(this.scope, this.id);
      if (!this.live(epoch)) return null;
      this.accept(state.snapshot);
      this.shortcutState = state;
      this.shortcutsOptedIn = state.enabled;
      this.shortcutNotice = null;
      return state;
    } catch (error) {
      if (!this.live(epoch)) return null;
      this.shortcutState = null;
      this.shortcutNotice =
        "Chưa xác nhận được trạng thái các nút thao tác. Phản ứng đã lưu được giữ nguyên.";
      if (!soft) throw error;
      return null;
    }
  }
  refreshCapabilities() {
    return this.enqueue(async (epoch) => {
      const state = await this.refreshShortcuts(epoch, true);
      if (!this.live(epoch)) return;
      if (state) {
        if (
          state.snapshot.requiresRestart ||
          !this.owns({
            position: state.position,
            playbackEventId: state.playbackEventId,
          })
        ) {
          this.mediaLost = true;
          this.started = null;
        }
        await this.adopt(state.snapshot, epoch);
      } else if (this.state.status === "ready") this.emit(this.state);
    });
  }
  private async enableShortcuts(epoch: number) {
    if (!this.source.shortcuts) return;
    let state = await this.refreshShortcuts(epoch);
    if (!state || !this.live(epoch)) return;
    if (!this.enableIntent && state.canEnable)
      this.enableIntent = {
        operation: "ENABLE",
        eventId: newSimulationEventId(),
        position: state.position,
        playbackEventId: state.playbackEventId,
      };
    if (this.enableIntent) {
      state = await this.source.shortcuts.command(
        this.scope,
        this.id,
        this.enableIntent,
      );
      if (!this.live(epoch)) return;
      this.accept(state.snapshot);
      this.shortcutState = state;
      this.shortcutsOptedIn = state.enabled;
      this.shortcutNotice = null;
      this.enableIntent = null;
    }
    this.last = state.snapshot;
  }
  private async shortcutTask(intent: ShortcutIntent, epoch: number) {
    if (!this.source.shortcuts || !this.live(epoch))
      throw Error("Chưa có kết nối thao tác video.");
    const retrying = this.shortcutFailed?.eventId === intent.eventId;
    this.shortcutFailed = intent;
    this.phase("transition", true);
    this.started = null;
    this.mediaLost = true;
    try {
      // Also reconciles a lost ACK; always retain and repeat the original event/body/proof.
      if (retrying) await this.refreshShortcuts(epoch);
      const state = await this.source.shortcuts.command(
        this.scope,
        this.id,
        intent,
      );
      if (!this.live(epoch)) return;
      this.accept(state.snapshot);
      this.shortcutState = state;
      this.shortcutsOptedIn = state.enabled;
      this.shortcutNotice = null;
      this.shortcutFailed = null;
      this.failed = null;
      this.reaction = null;
      const next = state.snapshot;
      this.mediaLost =
        next.status === "IN_PROGRESS" &&
        !["NOT_STARTED", "READY"].includes(next.playbackState);
      await this.adopt(next, epoch, true, !this.mediaLost);
    } catch (error) {
      if (this.live(epoch)) {
        this.mediaLost = true;
        this.started = null;
        this.phase("video-error");
      }
      throw error;
    }
  }
  skipIntro(ms: number, owner: ExamMediaOwner) {
    return this.enqueue(async (epoch) => {
      const state = this.shortcutState;
      if (
        !this.owns(owner) ||
        this.mediaLost ||
        this.started !== this.key(owner) ||
        !state?.skipIntro.available ||
        this.last?.responseRecorded ||
        !Number.isSafeInteger(ms) ||
        ms < 0 ||
        ms >= 10000
      )
        throw Error("Không thể bỏ qua phần đầu video hiện tại.");
      await this.shortcutTask(
        {
          operation: "SKIP_INTRO",
          eventId: newSimulationEventId(),
          position: owner.position,
          playbackEventId: owner.playbackEventId,
          mediaTimeMs: ms,
        },
        epoch,
      );
    });
  }
  advanceAfterReaction(owner: ExamMediaOwner) {
    return this.enqueue(async (epoch) => {
      const state = this.shortcutState;
      if (
        !this.owns(owner) ||
        !this.last?.responseRecorded ||
        this.reaction ||
        !state?.advanceAfterReaction.available ||
        !state.reactionAcknowledgement ||
        state.position !== owner.position ||
        state.playbackEventId !== owner.playbackEventId
      )
        throw Error("Phản ứng chưa được máy chủ xác nhận.");
      await this.shortcutTask(
        {
          operation: "ADVANCE_AFTER_REACTION",
          eventId: newSimulationEventId(),
          position: owner.position,
          playbackEventId: owner.playbackEventId,
          reactionAcknowledgement: state.reactionAcknowledgement,
        },
        epoch,
      );
    });
  }
  async load() {
    return this.enqueue(async (epoch) => {
      try {
        const s = await this.source.session(this.scope, this.id);
        if (!this.live(epoch)) return;
        this.accept(s);
        if (s.status !== "IN_PROGRESS") {
          await this.adopt(s, epoch);
          return;
        }
        this.last = s;
        this.started = null;
        this.mediaLost = true;
        await this.enableShortcuts(epoch);
        if (!this.live(epoch)) return;
        const pending = this.shortcutState;
        if (
          pending?.enabled &&
          pending.startAtMs === 10000 &&
          ["NOT_STARTED", "READY"].includes(pending.snapshot.playbackState) &&
          !pending.snapshot.requiresRestart
        ) {
          this.mediaLost = false;
          await this.adopt(pending.snapshot, epoch, true);
        } else await this.restartTask(epoch, this.last ?? s);
      } catch {
        if (this.live(epoch))
          this.emit({
            status: "error",
            message:
              "Không thể tải phiên thi. Bài thi và phản ứng đã lưu được giữ nguyên.",
          });
      }
    });
  }
  private async restartTask(epoch: number, known?: ExamSession) {
    const s = known ?? (await this.source.session(this.scope, this.id));
    if (!this.live(epoch)) return;
    this.accept(s);
    if (s.status !== "IN_PROGRESS") {
      await this.adopt(s, epoch);
      return;
    }
    const pending = this.failed;
    if (
      pending?.kind === "RESTART" &&
      this.last &&
      this.confirmed(pending, s, this.last)
    ) {
      await this.succeeded(pending, s, this.last, epoch);
      return;
    }
    this.last = s;
    this.started = null;
    this.mediaLost = true;
    // Keep the same restart request when a read confirms its old nonce is still current.
    const c =
      pending?.kind === "RESTART" &&
      pending.position === s.currentPosition &&
      pending.playbackEventId === s.playbackEventId
        ? pending
        : this.command("RESTART");
    await this.send(c, epoch);
  }
  start(owner: ExamMediaOwner) {
    return this.enqueue(async (epoch) => {
      if (
        !this.owns(owner) ||
        this.mediaLost ||
        !this.last ||
        this.last.requiresRestart
      )
        throw Error("Video cần được khởi động lại trước khi phát.");
      if (this.started === this.key(owner)) return;
      const p = this.state.status === "ready" ? this.state.data.playback : null;
      const startAt = p?.restartAtMs ?? 0;
      if (
        startAt !== 0 &&
        (!this.shortcutState?.enabled ||
          this.shortcutState.playbackEventId !== owner.playbackEventId ||
          this.shortcutState.position !== owner.position ||
          this.shortcutState.startAtMs !== startAt)
      )
        throw Error("Vị trí phát chưa được máy chủ xác nhận.");
      await this.send(this.command("START", startAt), epoch);
      if (this.source.shortcuts && this.live(epoch))
        void this.refreshCapabilities().catch(() => {});
    });
  }
  respond(ms: number, eventId: string, owner: ExamMediaOwner) {
    if (
      !this.owns(owner) ||
      !this.last ||
      this.last.responseRecorded ||
      this.mediaLost ||
      this.started !== this.key(owner) ||
      !Number.isSafeInteger(ms) ||
      ms < 0
    )
      return Promise.resolve();
    if (this.reaction) return Promise.resolve();
    this.reaction = this.command("REACTION", ms, eventId);
    const c = this.reaction;
    this.phase("response-pending", true);
    return this.enqueue(async (epoch) => {
      if (this.owns(owner) && !this.mediaLost) await this.send(c, epoch);
    });
  }
  heartbeat(readMediaTime: () => number, owner: ExamMediaOwner) {
    if (
      this.queued ||
      !this.owns(owner) ||
      this.mediaLost ||
      this.started !== this.key(owner)
    )
      return Promise.resolve();
    return this.enqueue(async (epoch) => {
      if (!this.owns(owner) || this.mediaLost) return;
      const ms = readMediaTime();
      if (!Number.isSafeInteger(ms) || ms < 0) return;
      await this.send(
        {
          kind: "HEARTBEAT",
          sessionId: this.id,
          position: owner.position,
          playbackEventId: owner.playbackEventId,
          eventId: newSimulationEventId(),
          mediaTimeMs: ms,
        },
        epoch,
      );
    });
  }
  complete(ms: number, owner: ExamMediaOwner) {
    return this.enqueue(async (epoch) => {
      if (
        !this.owns(owner) ||
        this.mediaLost ||
        this.started !== this.key(owner) ||
        !Number.isSafeInteger(ms) ||
        ms < 0 ||
        !this.last ||
        (this.reaction && !this.last.responseRecorded)
      )
        return;
      await this.send(this.command("COMPLETE_CURRENT", ms), epoch);
    });
  }
  submit() {
    return this.enqueue(async (epoch) => {
      if (this.last?.status === "READY_TO_SUBMIT")
        await this.send(this.command("SUBMIT"), epoch);
    });
  }
  cancel() {
    return this.enqueue(async (epoch) => {
      if (
        this.last &&
        ["IN_PROGRESS", "READY_TO_SUBMIT"].includes(this.last.status)
      )
        await this.send(this.command("CANCEL"), epoch);
    });
  }
  async retry() {
    return this.enqueue(async (epoch) => {
      if (!this.last) return;
      if (this.shortcutFailed) {
        await this.shortcutTask(this.shortcutFailed, epoch);
        return;
      }
      const c = this.failed;
      const fresh = await this.source.session(this.scope, this.id);
      if (!this.live(epoch)) return;
      this.accept(fresh);
      if (
        c?.kind === "CANCEL" &&
        ["IN_PROGRESS", "READY_TO_SUBMIT"].includes(fresh.status)
      ) {
        this.last = fresh;
        await this.send(c, epoch);
        return;
      }
      if (fresh.status !== "IN_PROGRESS") {
        await this.adopt(fresh, epoch);
        if (fresh.status === "READY_TO_SUBMIT")
          await this.send(
            c?.kind === "SUBMIT" ? c : this.command("SUBMIT"),
            epoch,
          );
        return;
      }
      if (
        c &&
        !["START", "HEARTBEAT", "RESTART"].includes(c.kind) &&
        this.confirmed(c, fresh, this.last)
      ) {
        await this.succeeded(c, fresh, this.last, epoch);
        return;
      }
      this.last = fresh;
      if (
        c &&
        ["REACTION", "COMPLETE_CURRENT"].includes(c.kind) &&
        this.owns({
          position: c.position,
          playbackEventId: c.playbackEventId!,
        }) &&
        !this.mediaLost &&
        !fresh.requiresRestart &&
        fresh.playbackState === "PLAYING"
      ) {
        await this.send(c, epoch);
        return;
      }
      await this.restartTask(epoch, fresh);
    });
  }
  renewPlayback() {
    return this.enqueue((epoch) => this.restartTask(epoch));
  }
  mediaFault(owner?: ExamMediaOwner) {
    if (this.last?.status !== "IN_PROGRESS" || (owner && !this.owns(owner)))
      return;
    this.mediaLost = true;
    this.started = null;
    this.phase("video-error");
  }
}
function sameSnapshot(a: ExamSession, b: ExamSession) {
  return (
    sameExamOrigin(a, b) &&
    a.scope.userId === b.scope.userId &&
    a.scope.licenseClass === b.scope.licenseClass &&
    a.bankVersion === b.bankVersion &&
    a.scoringVersion === b.scoringVersion &&
    sameExamPolicy(a.policy, b.policy)
  );
}
function validTransition(a: ExamSession, b: ExamSession) {
  if (!sameSnapshot(a, b) || b.completedScenarios < a.completedScenarios)
    return false;
  if (
    a.currentPosition === b.currentPosition &&
    a.responseRecorded &&
    !b.responseRecorded &&
    b.status === "IN_PROGRESS"
  )
    return false;
  if (["COMPLETED", "CANCELLED"].includes(a.status) && a.status !== b.status)
    return false;
  if (a.status === "READY_TO_SUBMIT" && b.status === "IN_PROGRESS")
    return false;
  return true;
}
