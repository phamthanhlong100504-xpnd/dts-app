import type { ApiClient } from "../simulation-api";
import { ApiError } from "../simulation-api";
import type { SimulationScope } from "./simulation-learning-types";
import type { SimulationExamSource } from "./simulation-exam-source";
import { SimulationExamError } from "./simulation-exam-types";
import {
  validateExamPreparation,
  validateExamSession,
  validateExamResult,
  validateExamReview,
} from "./simulation-exam-validation";
import {
  examUuid,
  parseExamWire,
  wireExamPreparation,
  wireExamSession,
  wireExamActive,
  wireExamPlayback,
  wireExamResult,
  wireExamReview,
  wirePresetList,
  wirePresetDetail,
} from "./simulation-exam-wire";
import {
  examSessionModel,
  presetPageModel,
  presetPreparationModel,
} from "./simulation-preset-wire";
import { createShortcutPort } from "./simulation-shortcut-source";
const base = "/v1/simulation-exams";
export function examHttpError(error: unknown): SimulationExamError {
  if (error instanceof SimulationExamError) return error;
  const e = error instanceof ApiError ? error : null,
    c = e?.errorCode;
  const code =
    c === "SIMULATION_PRESET_VERSION_CHANGED"
      ? "PRESET_VERSION_CHANGED"
      : c === "SIMULATION_PRESET_MEDIA_UNAVAILABLE"
        ? "PRESET_UNAVAILABLE"
        : c === "ACTIVE_SESSION_EXISTS"
          ? "ACTIVE_SESSION_EXISTS"
          : c === "SIMULATION_EXAM_BANK_CHANGED"
            ? "BANK_CHANGED"
            : c === "NOT_COMPLETED"
              ? "NOT_COMPLETED"
              : c === "SIMULATION_EXAM_EVENT_CONFLICT"
                ? "EVENT_CONFLICT"
                : c &&
                    /RESTART_REQUIRED|NOT_PLAYING|INTERRUPTED|DISCONTINUITY|START_CHANGED|PLAYBACK_REQUIRED/.test(
                      c,
                    )
                  ? "RESTART_REQUIRED"
                  : c && /PLAYBACK_CHANGED|POSITION_CHANGED/.test(c)
                    ? "PLAYBACK_CHANGED"
                    : e?.status === 401 || e?.status === 403
                      ? "ACCESS_DENIED"
                      : e?.status === 400
                        ? "INVALID_REQUEST"
                        : e?.status === 503
                          ? "UNAVAILABLE"
                          : "UNKNOWN";
  return new SimulationExamError(
    code,
    e?.message ??
      "Không thể xác nhận dữ liệu bài thi. Vui lòng kiểm tra và thử lại.",
    undefined,
    e?.status,
    c,
    e?.traceId,
  );
}
export function createSimulationExamHttpSource(
  api: ApiClient,
  assertSession: (scope: SimulationScope, media?: boolean) => void,
  shortcutsEnabled = true,
): SimulationExamSource {
  const params = (s: SimulationScope) => ({ licenseClass: s.licenseClass });
  const id = (v: string) => parseExamWire(examUuid, v);
  const model = examSessionModel;
  async function get<T>(
    s: SimulationScope,
    path: string,
    schema: import("zod").ZodType<T>,
    media = false,
  ) {
    try {
      assertSession(s, media);
      const value = parseExamWire(
        schema,
        await api.get<unknown>(base + path, {
          params: params(s),
          headers: { "Cache-Control": "no-cache" },
        }),
      );
      assertSession(s, media);
      return value;
    } catch (e) {
      throw examHttpError(e);
    }
  }
  async function session(s: SimulationScope, sid: string) {
    const value = model(await get(s, `/sessions/${id(sid)}`, wireExamSession));
    validateExamSession(value, s, sid);
    return value;
  }
  async function active(s: SimulationScope) {
    const value = await get(s, "/sessions/active", wireExamActive);
    if (!value.session) return null;
    const a = model(value.session);
    validateExamSession(a, s);
    if (!["IN_PROGRESS", "READY_TO_SUBMIT"].includes(a.status))
      throw new Error("Phiên active không hợp lệ.");
    return a;
  }
  return {
    shortcuts: shortcutsEnabled
      ? createShortcutPort(api, "EXAM", assertSession, (raw, s, id) => {
          const value = model(raw.session!);
          validateExamSession(value, s, id);
          return value;
        })
      : undefined,
    active,
    presets: async (s) =>
      presetPageModel(await get(s, "/presets", wirePresetList), s),
    presetPreparation: async (s, presetId) => {
      try {
        return presetPreparationModel(
          await get(s, `/presets/${id(presetId)}`, wirePresetDetail),
          s,
          presetId,
        );
      } catch (error) {
        const e = examHttpError(error);
        if (e.status === 404)
          throw new SimulationExamError(
            "PRESET_UNAVAILABLE",
            "Bộ đề không còn được công bố. Hãy quay lại danh sách.",
            undefined,
            e.status,
            e.apiCode,
            e.traceId,
          );
        throw e;
      }
    },
    preparation: async (s) => {
      const raw = await get(s, "/preparation", wireExamPreparation);
      const value = {
        ...raw,
        activeSession: raw.activeSession ? model(raw.activeSession) : null,
      };
      validateExamPreparation(value, s);
      return value;
    },
    create: async (s, r) => {
      if (r.mode !== "RANDOM" && r.mode !== "PRESET")
        throw Error("Chế độ không hợp lệ.");
      if (r.mode === "PRESET") {
        id(r.presetSetId);
        id(r.presetVersionId);
      }
      id(r.idempotencyKey);
      if (r.bankVersion !== undefined && !r.bankVersion.trim())
        throw new Error("Bank không hợp lệ.");
      const body = {
        mode: r.mode,
        ...(r.mode === "PRESET"
          ? { presetSetId: r.presetSetId, presetVersionId: r.presetVersionId }
          : {}),
        licenseClass: s.licenseClass,
        ...(r.bankVersion ? { bankVersion: r.bankVersion } : {}),
      };
      assertSession(s, true);
      try {
        const next = model(
          parseExamWire(
            wireExamSession,
            await api.post<unknown>(base + "/sessions", body, {
              headers: { "Idempotency-Key": r.idempotencyKey },
            }),
          ),
        );
        assertSession(s, true);
        validateExamSession(next, s);
        if (
          next.mode !== r.mode ||
          (r.mode === "PRESET" &&
            (next.mode !== "PRESET" ||
              next.preset.presetSetId !== r.presetSetId ||
              next.preset.presetVersionId !== r.presetVersionId))
        )
          throw Error("Phiên tạo không khớp lựa chọn.");
        if (r.bankVersion && next.bankVersion !== r.bankVersion)
          throw new Error("Bank tạo phiên không khớp yêu cầu.");
        return next;
      } catch (e) {
        assertSession(s, true);
        const mapped = examHttpError(e);
        if (
          !mapped.status ||
          mapped.status >= 500 ||
          mapped.code === "ACTIVE_SESSION_EXISTS"
        ) {
          const current = await active(s);
          if (current)
            throw new SimulationExamError(
              "ACTIVE_SESSION_EXISTS",
              "Bạn đang có bài thi chưa hoàn thành.",
              current.sessionId,
              409,
              "ACTIVE_SESSION_EXISTS",
            );
        }
        throw mapped;
      }
    },
    session,
    playback: async (s, sid) => {
      const p = await get(
        s,
        `/sessions/${id(sid)}/current/playback`,
        wireExamPlayback,
        true,
      );
      if (p.sessionId !== sid)
        throw new Error("Video không thuộc phiên yêu cầu.");
      return p;
    },
    command: async (s, c) => {
      id(c.sessionId);
      id(c.eventId);
      const commandOnly = c.kind === "SUBMIT" || c.kind === "CANCEL";
      if (
        !commandOnly &&
        (!Number.isInteger(c.position) || c.position < 1 || c.position > 10)
      )
        throw new Error("Vị trí không hợp lệ.");
      if (!commandOnly) id(c.playbackEventId ?? "");
      const suffix = {
        START: "current/start",
        HEARTBEAT: "current/heartbeat",
        RESTART: "current/restart",
        REACTION: "reaction",
        COMPLETE_CURRENT: "complete-current",
        SUBMIT: "submit",
        CANCEL: "cancel",
      }[c.kind];
      if (!suffix) throw new Error("Lệnh không hợp lệ.");
      const timed = !commandOnly && c.kind !== "RESTART";
      if (
        timed &&
        (!Number.isSafeInteger(c.mediaTimeMs) ||
          c.mediaTimeMs! < 0 ||
          (c.kind === "START" && ![0, 10000].includes(c.mediaTimeMs!)))
      )
        throw new Error("Thiếu thời gian media thực tế.");
      const body = {
        eventId: c.eventId,
        ...(commandOnly
          ? {}
          : {
              position: c.position,
              playbackEventId: c.playbackEventId,
              ...(timed ? { mediaTimeMs: c.mediaTimeMs } : {}),
            }),
      };
      assertSession(s);
      try {
        const response =
          c.kind === "REACTION"
            ? await api.put<unknown>(
                `${base}/sessions/${c.sessionId}/${suffix}`,
                body,
                { params: params(s) },
              )
            : await api.post<unknown>(
                `${base}/sessions/${c.sessionId}/${suffix}`,
                body,
                { params: params(s) },
              );
        assertSession(s);
        const value = model(parseExamWire(wireExamSession, response));
        validateExamSession(value, s, c.sessionId);
        return value;
      } catch (e) {
        throw examHttpError(e);
      }
    },
    result: async (s, sid) => {
      const v = await get(s, `/sessions/${id(sid)}/result`, wireExamResult);
      if (v.passingScore !== v.policy.passingScore)
        throw new Error("Ngưỡng đạt không khớp chính sách.");
      validateExamResult(v, s, sid);
      return v;
    },
    review: async (s, sid) => {
      const v = await get(s, `/sessions/${id(sid)}/review`, wireExamReview);
      if (v.result.passingScore !== v.result.policy.passingScore)
        throw new Error("Ngưỡng đạt không khớp chính sách.");
      const mapped = {
        ...v,
        items: v.items.map((i) => ({
          ...i,
          firstResponseMs: i.firstResponseMs ?? null,
        })),
      };
      validateExamReview(mapped, s, sid);
      return mapped;
    },
    reviewPlayback: async (s, sid, p) => {
      if (!Number.isInteger(p) || p < 1 || p > 10)
        throw new Error("Vị trí xem lại không hợp lệ.");
      const value = await get(
        s,
        `/sessions/${id(sid)}/review/${p}/playback`,
        wireExamPlayback,
        true,
      );
      if (
        value.sessionId !== sid ||
        value.position !== p ||
        value.restartAtMs !== 0
      )
        throw new Error("Video xem lại không thuộc vị trí yêu cầu.");
      return value;
    },
  };
}
