import { z } from "zod";
import type { ApiClient } from "../simulation-api";
import type { SimulationScope } from "./simulation-learning-types";
import { wireAttempt, requireUuid, parseWire } from "./simulation-wire";
import { wireExamSession } from "./simulation-exam-wire";

const integer = z.number().int().nonnegative().safe();
const uuid = z.string().uuid();
const hex = z.string().regex(/^[a-f0-9]{64}$/);
const reason = z.string().min(1).nullable();
const completion = z.enum(["ENDED", "ADVANCE_AFTER_REACTION"]);
const stateSchema = z
  .object({
    targetKind: z.enum(["LEARNING", "EXAM"]),
    targetId: uuid,
    licenseClass: z.string().min(1),
    supported: z.boolean(),
    enabled: z.boolean(),
    canEnable: z.boolean(),
    protocolVersion: z.enum(["legacy-v1", "video-shortcuts-v1"]),
    reason,
    shortcutRevision: integer,
    stateFingerprint: hex,
    position: z.number().int().min(1).max(10),
    playbackEventId: uuid,
    startAtMs: integer,
    skipIntro: z
      .object({
        available: z.boolean(),
        targetMs: z.literal(10000),
        maxSafeTargetMs: integer.max(10000),
        reason,
      })
      .strict(),
    advanceAfterReaction: z.object({ available: z.boolean(), reason }).strict(),
    reactionAcknowledgement: hex.nullable(),
    completionReason: completion.nullable(),
    completionReasons: z.record(z.string().regex(/^(?:[1-9]|10)$/), completion),
    attempt: wireAttempt.strict().nullable(),
    session: wireExamSession.nullable(),
  })
  .strict();
const receiptSchema = z
  .object({
    eventId: uuid,
    operation: z.enum(["ENABLE", "SKIP_INTRO", "ADVANCE_AFTER_REACTION"]),
    targetKind: z.enum(["LEARNING", "EXAM"]),
    targetId: uuid,
    position: z.number().int().min(1).max(10),
    playbackEventId: uuid,
    resultingPlaybackEventId: uuid,
    checkpointMs: z.union([z.literal(0), z.literal(10000)]),
    appliedRevision: integer,
    appliedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export type ShortcutIntent = {
  operation: "ENABLE" | "SKIP_INTRO" | "ADVANCE_AFTER_REACTION";
  eventId: string;
  position: number;
  playbackEventId: string;
  mediaTimeMs?: number;
  reactionAcknowledgement?: string;
};
export type ShortcutState<T> = Omit<
  z.infer<typeof stateSchema>,
  "attempt" | "session"
> & { snapshot: T };
export interface ShortcutPort<T> {
  read: (scope: SimulationScope, id: string) => Promise<ShortcutState<T>>;
  command: (
    scope: SimulationScope,
    id: string,
    intent: ShortcutIntent,
  ) => Promise<ShortcutState<T>>;
}
/** Separate capability protocol. Proofs stay in this port/coordinator's memory, never URL/storage/logs. */
export function createShortcutPort<T>(
  api: ApiClient,
  kind: "LEARNING" | "EXAM",
  assertSession: (s: SimulationScope) => void,
  snapshot: (
    raw: z.infer<typeof stateSchema>,
    s: SimulationScope,
    id: string,
  ) => T,
): ShortcutPort<T> {
  const path = (id: string) => {
    requireUuid(id);
    return kind === "EXAM"
      ? `/v1/simulation-exams/sessions/${id}/shortcuts`
      : `/v1/simulations/attempts/${id}/shortcuts`;
  };
  const options = (s: SimulationScope) => ({
    params: { licenseClass: s.licenseClass },
    headers: { "Cache-Control": "no-cache" },
  });
  function bind(
    raw: z.infer<typeof stateSchema>,
    s: SimulationScope,
    id: string,
  ): ShortcutState<T> {
    if (
      raw.targetKind !== kind ||
      raw.targetId !== id ||
      raw.licenseClass !== s.licenseClass ||
      (kind === "LEARNING"
        ? !raw.attempt || raw.session !== null || raw.position !== 1
        : !raw.session || raw.attempt !== null) ||
      raw.enabled !== (raw.protocolVersion === "video-shortcuts-v1") ||
      (raw.canEnable && (!raw.supported || raw.enabled)) ||
      ((raw.skipIntro.available || raw.advanceAfterReaction.available) &&
        (!raw.enabled || !raw.supported)) ||
      (raw.skipIntro.available &&
        (raw.skipIntro.maxSafeTargetMs !== 10000 ||
          raw.skipIntro.reason !== null)) ||
      (raw.advanceAfterReaction.available &&
        (kind !== "EXAM" ||
          !raw.session?.responseRecorded ||
          !raw.reactionAcknowledgement ||
          raw.advanceAfterReaction.reason !== null)) ||
      (!raw.advanceAfterReaction.available &&
        raw.reactionAcknowledgement !== null)
    )
      throw Error("Trạng thái thao tác video không khớp phiên yêu cầu.");
    const { attempt, session, ...capabilities } = raw;
    if (
      kind === "EXAM"
        ? session!.currentPosition !== raw.position ||
          session!.playbackEventId !== raw.playbackEventId ||
          ![0, 10000].includes(raw.startAtMs)
        : attempt!.playbackEventId !== raw.playbackEventId ||
          attempt!.resumeAtMs !== raw.startAtMs
    )
      throw Error("Vị trí hoặc mã lượt phát không khớp xác nhận video.");
    return { ...capabilities, snapshot: snapshot(raw, s, id) };
  }
  return {
    read: async (s, id) => {
      assertSession(s);
      const raw = parseWire(
        stateSchema,
        await api.get<unknown>(path(id), options(s)),
      );
      assertSession(s);
      return bind(raw, s, id);
    },
    command: async (s, id, intent) => {
      assertSession(s);
      requireUuid(intent.eventId);
      requireUuid(intent.playbackEventId);
      if (
        !Number.isSafeInteger(intent.position) ||
        intent.position < 1 ||
        intent.position > (kind === "EXAM" ? 10 : 1)
      )
        throw Error("Vị trí thao tác không hợp lệ.");
      const { operation, eventId, position, playbackEventId } = intent;
      const suffix = {
        ENABLE: "enable",
        SKIP_INTRO: "skip-intro",
        ADVANCE_AFTER_REACTION: "advance-after-reaction",
      }[operation];
      if (
        !suffix ||
        (operation === "ADVANCE_AFTER_REACTION" &&
          (kind !== "EXAM" ||
            !hex.safeParse(intent.reactionAcknowledgement).success)) ||
        (operation === "SKIP_INTRO" &&
          (!Number.isSafeInteger(intent.mediaTimeMs) ||
            intent.mediaTimeMs! < 0 ||
            intent.mediaTimeMs! >= 10000))
      )
        throw Error("Thiếu xác nhận hoặc thời điểm video thực tế.");
      const body = {
        eventId,
        position,
        playbackEventId,
        ...(operation === "SKIP_INTRO"
          ? { mediaTimeMs: intent.mediaTimeMs }
          : {}),
        ...(operation === "ADVANCE_AFTER_REACTION"
          ? { reactionAcknowledgement: intent.reactionAcknowledgement }
          : {}),
      };
      const ack = parseWire(
        z.object({ receipt: receiptSchema, state: stateSchema }).strict(),
        await api.post<unknown>(`${path(id)}/${suffix}`, body, options(s)),
      );
      assertSession(s);
      const r = ack.receipt;
      if (
        r.eventId !== eventId ||
        r.operation !== operation ||
        r.targetKind !== kind ||
        r.targetId !== id ||
        r.position !== position ||
        r.playbackEventId !== playbackEventId ||
        r.appliedRevision > ack.state.shortcutRevision ||
        r.checkpointMs !== (operation === "SKIP_INTRO" ? 10000 : 0)
      )
        throw Error("Biên nhận thao tác video không khớp yêu cầu.");
      // A retried receipt may be old; only its fresh state owns the current nonce/position/checkpoint.
      return bind(ack.state, s, id);
    },
  };
}
export function shortcutView<T>(s: ShortcutState<T> | null | undefined) {
  return s
    ? {
        enabled: s.enabled,
        skipReason: s.skipIntro.reason,
        skip: s.skipIntro.available,
        next: s.advanceAfterReaction.available && !!s.reactionAcknowledgement,
        position: s.position,
        playbackEventId: s.playbackEventId,
        startAtMs: s.startAtMs,
      }
    : undefined;
}
export type ShortcutView = ReturnType<typeof shortcutView>;
