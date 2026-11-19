import { newSimulationEventId } from '../simulation-id';
import type { ApiClient } from "../simulation-api";
import { ApiError } from "../simulation-api";
import type { SimulationLearningSource } from "./simulation-learning-source";
import type {
  SimulationScope,
  SimulationDataScope,
  SimulationScenarioPage,
  SimulationCommand,
} from "./simulation-learning-types";
import {
  validateChapter,
  validateOverview,
  validateScenarioSnapshot,
} from "./simulation-learning-validation";
import {
  parseWire,
  requireUuid,
  wireAttempt,
  wireChapter,
  wireDetail,
  wireOverview,
  wirePlayback,
  wireResult,
  wireReplay,
  type WireAttempt,
  type WirePlayback,
} from "./simulation-wire";

import {
  createShortcutPort,
  shortcutView,
  type ShortcutState,
  type ShortcutIntent,
} from "./simulation-shortcut-source";

const base = "/v1/simulations";
function check(
  ok: unknown,
  message = "Dữ liệu không khớp lượt luyện hoặc phiên bản ngân hàng.",
): asserts ok {
  if (!ok) throw new Error(message);
}
function chapterModel(c: {
  chapterId: number;
  chapterNumber: number;
  chapterName: string;
  totalScenarios: number;
  practicedScenarios: number;
  completionPercent: number;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
}) {
  return {
    id: String(c.chapterId),
    number: c.chapterNumber,
    name: c.chapterName,
    totalScenarios: c.totalScenarios,
    practicedScenarios: c.practicedScenarios,
    completionPercent: c.completionPercent,
    status: c.status,
  };
}
export function createSimulationHttpSource(
  api: ApiClient,
  assertSession: (scope: SimulationScope) => void = () => {},
  assertLearn: (scope: SimulationScope) => void = () => {},
  shortcutsEnabled = true,
): SimulationLearningSource & { clear: () => void } {
  // Short-lived grants only. No local progress/results, persisted tickets or example JSON.
  const shortcutStates = new Map<string, ShortcutState<WireAttempt>>();
  const uncertainSkips = new Set<string>();
  const enableIntents = new Map<string, ShortcutIntent>();
  const shortcutPort = createShortcutPort(
    api,
    "LEARNING",
    (s) => {
      assertSession(s);
      assertLearn(s);
    },
    (raw, s, id) => {
      const a = raw.attempt!;
      check(
        a.attemptId === id &&
          (!s.bankVersion || a.bankVersion === s.bankVersion),
      );
      check(
        a.responseRecorded === (a.firstResponseMs !== null) &&
          a.resumeAtMs <= a.videoDurationMs,
      );
      return a;
    },
  );
  async function readShortcuts(s: SimulationScope, a: WireAttempt) {
    const state = await shortcutPort.read(s, a.attemptId);
    check(
      state.snapshot.scenarioId === a.scenarioId &&
        state.snapshot.bankVersion === a.bankVersion &&
        state.snapshot.scoringVersion === a.scoringVersion &&
        state.snapshot.videoDurationMs === a.videoDurationMs,
    );
    shortcutStates.set(attemptKey(s, a.attemptId), state);
    return state;
  }
  async function prepareShortcuts(s: SimulationScope, a: WireAttempt) {
    if (!shortcutsEnabled) return;
    const key = attemptKey(s, a.attemptId);
    let state = await readShortcuts(s, a);
    let intent = enableIntents.get(key);
    if (!intent && state.canEnable) {
      intent = {
        operation: "ENABLE",
        eventId: newSimulationEventId(),
        position: 1,
        playbackEventId: state.playbackEventId,
      };
      enableIntents.set(key, intent);
    }
    if (intent) {
      state = await shortcutPort.command(s, a.attemptId, intent);
      check(
        state.snapshot.scenarioId === a.scenarioId &&
          state.snapshot.bankVersion === a.bankVersion &&
          state.snapshot.scoringVersion === a.scoringVersion,
      );
      shortcutStates.set(key, state);
      enableIntents.delete(key);
    }
  }
  const grants = new Map<string, WirePlayback>();
  const replays = new Map<string, import("zod").infer<typeof wireReplay>>();
  // Validated server snapshots scoped to this session; never persisted or graded locally.
  const contexts = new Map<string, SimulationScenarioPage>();
  const attempts = new Map<string, WireAttempt>();
  const contextKey = (
    s: SimulationScope,
    scenarioId: string,
    bankVersion: string,
  ) => `${s.userId}:${s.licenseClass}:${bankVersion}:${scenarioId}`;
  const attemptKey = (s: SimulationScope, id: string) =>
    `${s.userId}:${s.licenseClass}:${id}`;
  const grantKey = (s: SimulationScope, a: WireAttempt) =>
    `${s.userId}:${s.licenseClass}:${a.bankVersion}:${a.attemptId}`;
  const scoped = (scope: SimulationScope) => ({
    licenseClass: scope.licenseClass,
    ...(scope.bankVersion ? { bankVersion: scope.bankVersion } : {}),
  });
  async function get<T>(
    scope: SimulationScope,
    path: string,
    schema: Parameters<typeof parseWire<T>>[0],
    params?: Record<string, string | number | undefined>,
  ) {
    assertSession(scope);
    const value = parseWire(
      schema,
      await api.get<unknown>(base + path, {
        params,
        headers: { "Cache-Control": "no-cache" },
      }),
    );
    assertSession(scope);
    return value;
  }
  function match(scope: SimulationScope, actual: SimulationDataScope) {
    check(
      actual.userId === scope.userId &&
        actual.licenseClass === scope.licenseClass &&
        (!scope.bankVersion || actual.bankVersion === scope.bankVersion),
      "Dữ liệu mô phỏng không khớp tài khoản, hạng hoặc ngân hàng.",
    );
  }
  async function attempt(
    scope: SimulationScope,
    id: string,
    scenarioId: string,
  ) {
    const a = await get(scope, `/attempts/${requireUuid(id)}`, wireAttempt);
    check(a.scenarioId === scenarioId && a.attemptId === id);
    check(
      a.resumeAtMs <= a.videoDurationMs &&
        (!a.responseRecorded
          ? a.firstResponseMs === null
          : a.firstResponseMs !== null),
    );
    if (attempts.size >= 64) attempts.delete(attempts.keys().next().value!);
    attempts.set(attemptKey(scope, id), a);
    return a;
  }
  async function playback(scope: SimulationScope, a: WireAttempt) {
    const p = await get(
      scope,
      `/attempts/${a.attemptId}/playback`,
      wirePlayback,
    );
    check(
      p.attemptId === a.attemptId &&
        p.bankVersion === a.bankVersion &&
        p.playbackEventId === a.playbackEventId &&
        p.durationMs === a.videoDurationMs &&
        p.resumeAtMs <= p.durationMs &&
        Date.parse(p.expiresAt) > Date.now(),
    );
    if (grants.size >= 32) grants.delete(grants.keys().next().value!);
    grants.set(grantKey(scope, a), p);
    return p;
  }
  async function snapshot(
    scope: SimulationScope,
    scenarioId: string,
    a?: WireAttempt | null,
    grant?: WirePlayback | null,
    skipReplay = false,
  ): Promise<SimulationScenarioPage> {
    const pinned = a ? { ...scope, bankVersion: a.bankVersion } : scope;
    const d = await get(
      pinned,
      `/scenarios/${requireUuid(scenarioId)}`,
      wireDetail,
      scoped(pinned),
    );
    match(pinned, d.scope);
    check(d.scenario.scenarioId === scenarioId);
    // latestAttempt is latest-created, never assumed latest-completed.
    const selected = a === undefined ? d.latestAttempt : a;
    if (selected)
      check(
        selected.scenarioId === scenarioId &&
          selected.bankVersion === d.scope.bankVersion &&
          selected.videoDurationMs === d.scenario.durationMs,
      );
    const o = await source.overview({
      ...scope,
      bankVersion: d.scope.bankVersion,
    });
    const c = o.chapters.find((x) => x.id === String(d.scenario.chapterId));
    check(c);
    let p = grant ?? (selected ? grants.get(grantKey(scope, selected)) : null);
    if (
      p &&
      (p.playbackEventId !== selected?.playbackEventId ||
        Date.parse(p.expiresAt) <= Date.now())
    )
      p = null;
    let result = selected?.result ?? null;
    if (selected?.status === "COMPLETED" && !result)
      result = await get(
        scope,
        `/attempts/${selected.attemptId}/result`,
        wireResult,
      );
    if (result)
      check(
        selected?.status === "COMPLETED" &&
          result.attemptId === selected.attemptId &&
          result.scenarioId === scenarioId &&
          result.bankVersion === selected.bankVersion &&
          result.scoringVersion === selected.scoringVersion,
      );
    const phase =
      !selected || selected.status === "CREATED"
        ? "ready"
        : selected.status === "COMPLETED"
          ? "completed"
          : selected.status === "PLAYING" && !selected.requiresResume
            ? selected.responseRecorded
              ? "recorded"
              : "playing"
            : "video-error";
    const model: SimulationScenarioPage = {
      scope: d.scope,
      scenario: {
        id: scenarioId,
        number: d.scenario.scenarioNumber,
        title: d.scenario.title,
        chapterId: String(d.scenario.chapterId),
        chapterNumber: c.number,
        chapterName: c.name,
        positionLabel: `Tình huống ${String(d.scenario.scenarioNumber).padStart(3, "0")}`,
        durationMs: d.scenario.durationMs,
        isBookmarked: d.scenario.isBookmarked,
      },
      phase,
      attemptId: selected?.attemptId ?? null,
      playbackEventId: selected?.playbackEventId ?? null,
      videoUrl: p?.videoUrl ?? null,
      playbackExpiresAt: p?.expiresAt ?? null,
      resumeAtMs: p?.resumeAtMs ?? selected?.resumeAtMs ?? 0,
      readOnly: selected?.status === "COMPLETED",
      posterUrl: d.scenario.thumbnailUrl,
      responseRecorded: selected?.responseRecorded ?? false,
      firstResponseMs: selected?.firstResponseMs ?? null,
      result: result ? { ...result, durationMs: result.videoDurationMs } : null,
      policy: selected?.policy ?? d.policy,
      hintPreview: d.hintPreview,
      previousScenarioId: d.previousScenarioId,
      nextScenarioId: d.nextScenarioId,
    };
    validateScenarioSnapshot(model);
    if (contexts.size >= 32) contexts.delete(contexts.keys().next().value!);
    contexts.set(contextKey(scope, scenarioId, model.scope.bankVersion), model);
    if (selected) attempts.set(attemptKey(scope, selected.attemptId), selected);
    return selected?.status === "COMPLETED" && !skipReplay
      ? attachReplay(scope, selected, model)
      : model;
  }
  async function attachReplay(
    scope: SimulationScope,
    a: WireAttempt,
    model: SimulationScenarioPage,
    force = false,
  ): Promise<SimulationScenarioPage> {
    check(a.status === "COMPLETED" && model.result?.attemptId === a.attemptId);
    try {
      let value = force ? undefined : replays.get(grantKey(scope, a));
      if (!value || Date.parse(value.expiresAt) <= Date.now() + 2000)
        value = await get(scope, `/attempts/${a.attemptId}/replay`, wireReplay);
      check(
        value.attemptId === a.attemptId &&
          value.scenarioId === a.scenarioId &&
          value.bankVersion === a.bankVersion &&
          value.scoringVersion === a.scoringVersion &&
          value.durationMs === a.videoDurationMs &&
          Date.parse(value.expiresAt) > Date.now(),
      );
      if (replays.size >= 32) replays.delete(replays.keys().next().value!);
      replays.set(grantKey(scope, a), value);
      return {
        ...model,
        readOnly: true,
        replayUnavailable: false,
        replayError: undefined,
        videoUrl: value.videoUrl,
        playbackExpiresAt: value.expiresAt,
        policy: { ...model.policy, ...value.policy },
      };
    } catch {
      assertSession(scope);
      // A media dependency failure must not turn an already saved result into an unsaved attempt.
      return {
        ...model,
        readOnly: true,
        replayUnavailable: true,
        videoUrl: null,
        replayError:
          "Không thể tải video xem lại. Kết quả đã lưu được giữ nguyên; hãy thử tải lại video.",
      };
    }
  }
  async function fromAttempt(
    scope: SimulationScope,
    a: WireAttempt,
    grant?: WirePlayback | null,
    skipReplay = false,
  ): Promise<SimulationScenarioPage> {
    const context = contexts.get(
      contextKey(scope, a.scenarioId, a.bankVersion),
    );
    if (!context) return snapshot(scope, a.scenarioId, a, grant, skipReplay);
    check(context.scenario.durationMs === a.videoDurationMs);
    let result = a.result;
    if (a.status === "COMPLETED" && !result)
      result = await get(scope, `/attempts/${a.attemptId}/result`, wireResult);
    if (result)
      check(
        a.status === "COMPLETED" &&
          result.attemptId === a.attemptId &&
          result.scenarioId === a.scenarioId &&
          result.bankVersion === a.bankVersion &&
          result.scoringVersion === a.scoringVersion &&
          result.responseRecorded === a.responseRecorded &&
          result.firstResponseMs === a.firstResponseMs &&
          result.videoDurationMs === a.videoDurationMs,
      );
    let p = grant ?? grants.get(grantKey(scope, a));
    if (
      p &&
      (p.playbackEventId !== a.playbackEventId ||
        Date.parse(p.expiresAt) <= Date.now())
    )
      p = undefined;
    const model: SimulationScenarioPage = {
      ...context,
      attemptId: a.attemptId,
      playbackEventId: a.playbackEventId,
      phase:
        a.status === "CREATED"
          ? "ready"
          : a.status === "COMPLETED"
            ? "completed"
            : a.status === "PLAYING" && !a.requiresResume
              ? a.responseRecorded
                ? "recorded"
                : "playing"
              : "video-error",
      videoUrl: p?.videoUrl ?? null,
      playbackExpiresAt: p?.expiresAt ?? null,
      resumeAtMs: p?.resumeAtMs ?? a.resumeAtMs,
      readOnly: a.status === "COMPLETED",
      shortcuts:
        a.status !== "COMPLETED" &&
        shortcutStates.get(attemptKey(scope, a.attemptId))?.playbackEventId ===
          a.playbackEventId
          ? shortcutView(shortcutStates.get(attemptKey(scope, a.attemptId)))
          : undefined,
      replayUnavailable: false,
      replayError: undefined,
      responseRecorded: a.responseRecorded,
      firstResponseMs: a.firstResponseMs,
      result: result ? { ...result, durationMs: result.videoDurationMs } : null,
      policy: a.policy,
    };
    validateScenarioSnapshot(model);
    if (attempts.size >= 64) attempts.delete(attempts.keys().next().value!);
    attempts.set(attemptKey(scope, a.attemptId), a);
    return a.status === "COMPLETED" && !skipReplay
      ? attachReplay(scope, a, model)
      : model;
  }
  async function mutate(
    scope: SimulationScope,
    path: string,
    body: object,
    method: "post" | "put" = "post",
  ) {
    assertSession(scope);
    assertLearn(scope);
    const a = parseWire(
      wireAttempt,
      await api[method]<unknown>(base + path, body),
    );
    assertSession(scope);
    return a;
  }
  const source: SimulationLearningSource & { clear: () => void } = {
    clear: () => {
      grants.clear();
      replays.clear();
      contexts.clear();
      attempts.clear();
      shortcutStates.clear();
      enableIntents.clear();
      uncertainSkips.clear();
    },
    overview: async (scope) => {
      const o = await get(scope, "/overview", wireOverview, scoped(scope));
      match(scope, o.scope);
      const model = { ...o, chapters: o.chapters.map(chapterModel) };
      validateOverview(model);
      return model;
    },
    chapter: async (scope, chapterId, filter, page) => {
      check(
        /^[1-6]$/.test(chapterId) &&
          Number.isSafeInteger(page) &&
          page >= 0 &&
          page <= 10000,
      );
      const p = await get(
        scope,
        `/chapters/${chapterId}/scenarios`,
        wireChapter,
        { ...scoped(scope), filter, sort: "SCENARIO_ASC", page, size: 12 },
      );
      match(scope, p.scope);
      check(String(p.chapter.chapterId) === chapterId && p.page === page);
      const model = {
        ...p,
        chapter: chapterModel(p.chapter),
        items: p.items.map((i) => ({
          id: i.scenarioId,
          number: i.scenarioNumber,
          title: i.title,
          chapterId: String(i.chapterId),
          durationMs: i.durationMs,
          thumbnailUrl: i.thumbnailUrl,
          thumbnailExpiresAt: i.thumbnailExpiresAt,
          isPracticed: i.isPracticed,
          bestScore: i.bestScore,
          maxScore: i.maxScore,
          isBookmarked: i.isBookmarked,
        })),
      };
      validateChapter(model);
      return model;
    },
    scenario: async (scope, scenarioId, attemptId) => {
      if (!attemptId) return snapshot(scope, scenarioId, null);
      const a = await attempt(scope, attemptId, scenarioId);
      const p =
        a.status === "CREATED" || a.status === "INTERRUPTED"
          ? await playback(scope, a)
          : null;
      const model = await snapshot(scope, scenarioId, a, p);
      // A remount must interrupt/resume an existing PLAYING segment before playback.
      return a.status === "PLAYING"
        ? { ...model, phase: "video-error" }
        : model;
    },
    command: async (scope, input: SimulationCommand) => {
      requireUuid(input.eventId);
      requireUuid(input.scenarioId);
      if (input.kind === "NEW_ATTEMPT") {
        check(
          scope.bankVersion,
          "Chưa xác nhận phiên bản ngân hàng cho lượt mới.",
        );
        const a = await mutate(scope, "/attempts", {
          eventId: input.eventId,
          scenarioId: input.scenarioId,
          ...scoped(scope),
        });
        check(
          a.scenarioId === input.scenarioId &&
            a.bankVersion === scope.bankVersion,
        );
        return fromAttempt(
          scope,
          a,
          a.status === "CREATED" ? await playback(scope, a) : null,
        );
      }
      check(input.attemptId);
      let a = [
        "RENEW_PLAYBACK",
        "RECONCILE_RESULT",
        "INTERRUPT",
        "CANCEL",
      ].includes(input.kind)
        ? await attempt(scope, input.attemptId, input.scenarioId)
        : (attempts.get(attemptKey(scope, input.attemptId)) ??
          (await attempt(scope, input.attemptId, input.scenarioId)));
      check(
        a.attemptId === input.attemptId && a.scenarioId === input.scenarioId,
      );
      check(!scope.bankVersion || a.bankVersion === scope.bankVersion);
      if (input.kind === "REFRESH_SHORTCUTS") {
        if (!shortcutsEnabled || ["COMPLETED", "CANCELLED"].includes(a.status))
          return fromAttempt(scope, a);
        const state = await readShortcuts(scope, a);
        return fromAttempt(scope, state.snapshot);
      }
      if (input.kind === "SKIP_INTRO") {
        check(
          shortcutsEnabled &&
            input.playbackEventId &&
            Number.isSafeInteger(input.mediaTimeMs),
        );
        // Read first for uncertain writes, then retry the exact original event/body, even if its nonce is now old.
        const intentKey = `${attemptKey(scope, a.attemptId)}:${input.eventId}`;
        if (uncertainSkips.has(intentKey)) await readShortcuts(scope, a);
        uncertainSkips.add(intentKey);
        const state = await shortcutPort.command(scope, a.attemptId, {
          operation: "SKIP_INTRO",
          eventId: input.eventId,
          position: 1,
          playbackEventId: input.playbackEventId,
          mediaTimeMs: input.mediaTimeMs,
        });
        uncertainSkips.delete(intentKey);
        const next = state.snapshot;
        check(
          next.scenarioId === a.scenarioId &&
            next.bankVersion === a.bankVersion &&
            next.scoringVersion === a.scoringVersion &&
            next.videoDurationMs === a.videoDurationMs,
        );
        shortcutStates.set(attemptKey(scope, a.attemptId), state);
        if (next.status === "COMPLETED" || next.status === "CANCELLED")
          return fromAttempt(scope, next);
        // A fresh state that has already STARTed is not a pending checkpoint; recover continuity normally.
        check(
          next.status === "INTERRUPTED" &&
            next.resumeAtMs === 10000 &&
            !next.responseRecorded,
          "Cần tải lại lượt phát để khôi phục trạng thái hiện tại.",
        );
        const model = await fromAttempt(
          scope,
          next,
          await playback(scope, next),
        );
        return { ...model, phase: "ready" };
      }
      if (input.kind === "START") await prepareShortcuts(scope, a);
      if (input.kind === "RECONCILE_RESULT") return fromAttempt(scope, a);
      if (input.kind === "RENEW_PLAYBACK") {
        if (a.status === "COMPLETED")
          return attachReplay(
            scope,
            a,
            await fromAttempt(scope, a, undefined, true),
            true,
          );
        check(
          a.status !== "CANCELLED",
          "Lượt luyện đã hủy không có video kết quả để xem lại.",
        );
        if (a.status === "PLAYING")
          a = await mutate(scope, `/attempts/${a.attemptId}/interrupt`, {
            eventId: input.eventId,
            playbackEventId: a.playbackEventId,
            reason: "VIDEO_ERROR",
          });
        const p = await playback(scope, a);
        const model = await fromAttempt(scope, a, p);
        return { ...model, phase: "ready" };
      }
      if (input.kind === "CANCEL") {
        a = await mutate(scope, `/attempts/${a.attemptId}/cancel`, {
          eventId: input.eventId,
        });
      } else if (input.kind === "INTERRUPT") {
        if (a.status === "PLAYING")
          a = await mutate(scope, `/attempts/${a.attemptId}/interrupt`, {
            eventId: input.eventId,
            playbackEventId: a.playbackEventId,
            reason: input.reason ?? "VIDEO_ERROR",
          });
      } else {
        // Reconciliation never creates/replays an attempt, and never substitutes a client score.
        if (a.status === "COMPLETED") return fromAttempt(scope, a);
        check(a.status !== "CANCELLED");
        let mediaTimeMs = input.mediaTimeMs;
        if (
          typeof mediaTimeMs === "number" &&
          mediaTimeMs > a.videoDurationMs &&
          mediaTimeMs <= a.videoDurationMs + 3000
        ) {
          mediaTimeMs = a.videoDurationMs;
        }
        check(
          Number.isSafeInteger(mediaTimeMs) &&
            mediaTimeMs! >= 0 &&
            mediaTimeMs! <= a.videoDurationMs,
          "Thiếu vị trí video thực của thao tác.",
        );
        check(input.playbackEventId === a.playbackEventId);
        const action = {
          START: "start",
          RESPONSE: "response",
          COMPLETE: "complete",
          HEARTBEAT: "heartbeat",
        }[input.kind];
        check(action);
        try {
          a = await mutate(
            scope,
            `/attempts/${a.attemptId}/${action}`,
            {
              eventId: input.eventId,
              playbackEventId: input.playbackEventId,
              mediaTimeMs,
            },
            input.kind === "RESPONSE" ? "put" : "post",
          );
        } catch (error) {
          // Lost ACK: read server state. Retry keeps the exact event/body in the controller.
          if (
            !(error instanceof ApiError) ||
            !error.status ||
            error.status >= 500
          ) {
            const reconciled = await attempt(
              scope,
              a.attemptId,
              input.scenarioId,
            );
            if (
              reconciled.status === "COMPLETED" ||
              (input.kind === "RESPONSE" &&
                reconciled.responseRecorded &&
                reconciled.firstResponseMs === mediaTimeMs) ||
              (input.kind === "START" &&
                reconciled.status === "PLAYING" &&
                !reconciled.requiresResume)
            )
              return fromAttempt(scope, reconciled);
          }
          throw error;
        }
      }
      check(
        a.attemptId === input.attemptId && a.scenarioId === input.scenarioId,
      );
      return fromAttempt(scope, a);
    },
  };
  return source;
}
