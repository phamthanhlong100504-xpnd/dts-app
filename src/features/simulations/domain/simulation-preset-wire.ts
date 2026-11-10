import type { z } from "zod";
import {
  wireExamSession,
  wirePresetItem,
  wirePresetList,
  wirePresetDetail,
} from "./simulation-exam-wire";
import type { ExamSession, ExamPolicy } from "./simulation-exam-types";
import type { SimulationScope } from "./simulation-learning-types";
import type {
  SimulationPresetItem,
  SimulationPresetPage,
  SimulationPresetPreparation,
} from "./simulation-preset-types";
import { validateExamSession } from "./simulation-exam-validation";
import {
  validatePresetPage,
  validatePresetPreparation,
} from "./simulation-preset-validation";
// Versioned adapter: list/detail expose 10/50/35, not a full policy object.
// wirePresetItem validates those literals before this adapter is called.
const policy: ExamPolicy = {
  totalScenarios: 10,
  maxScenarioScore: 5,
  maxTotalScore: 50,
  passingScore: 35,
  policyVersion: "simulation-preset-10-v1-pass35",
};
export function examSessionModel(
  v: z.infer<typeof wireExamSession>,
): ExamSession {
  return { ...v, completedAt: v.completedAt ?? null };
}
function activeModel(
  v: z.infer<typeof wireExamSession> | null,
  scope: SimulationScope,
) {
  if (!v) return null;
  const s = examSessionModel(v);
  validateExamSession(s, scope);
  if (!["IN_PROGRESS", "READY_TO_SUBMIT"].includes(s.status))
    throw Error("Phiên đang làm không hợp lệ.");
  return s;
}
function itemModel(
  v: z.infer<typeof wirePresetItem>,
  active: ExamSession | null,
): SimulationPresetItem {
  const fields = [
    v.latestCompletedSessionId,
    v.latestCompletedScore,
    v.latestCompletedPassed,
    v.latestCompletedAt,
  ];
  if (
    v.hasCompletedAttempt
      ? fields.some((x) => x === null)
      : fields.some((x) => x !== null)
  )
    throw Error("Kết quả gần nhất không đầy đủ.");
  if (
    v.hasCompletedAttempt &&
    v.latestCompletedPassed !== v.latestCompletedScore! >= v.passingScore
  )
    throw Error("Kết quả gần nhất không khớp chính sách.");
  const match =
    active?.mode === "PRESET" &&
    active.preset.presetSetId === v.presetSetId &&
    active.preset.presetVersionId === v.presetVersionId;
  if (
    match &&
    (active.preset.title !== v.title ||
      active.preset.code !== v.code ||
      active.preset.displayOrder !== v.displayOrder)
  )
    throw Error("Metadata phiên đang làm không khớp bộ đề.");
  if (v.activeSessionId !== (match ? active.sessionId : null))
    throw Error("Phiên đang làm không khớp bộ đề.");
  const status = match
    ? "IN_PROGRESS"
    : v.hasCompletedAttempt
      ? v.latestCompletedPassed
        ? "PASSED"
        : "FAILED"
      : "NOT_STARTED";
  if (v.attemptStatus !== status) throw Error("Trạng thái bộ đề không khớp.");
  return {
    presetSetId: v.presetSetId,
    presetVersionId: v.presetVersionId,
    code: v.code,
    title: v.title,
    displayOrder: v.displayOrder,
    publicationStatus: v.status,
    policy: { ...policy },
    latestCompleted: v.hasCompletedAttempt
      ? {
          sessionId: v.latestCompletedSessionId!,
          presetVersionId: v.presetVersionId,
          score: v.latestCompletedScore!,
          maxTotalScore: v.maxTotalScore,
          passingScore: v.passingScore,
          passed: v.latestCompletedPassed!,
          resultStatus: v.latestCompletedPassed ? "PASSED" : "FAILED",
        }
      : null,
    activeSession: match
      ? {
          sessionId: active.sessionId,
          presetVersionId: v.presetVersionId,
          completedScenarios: active.completedScenarios,
          totalScenarios: active.policy.totalScenarios,
        }
      : null,
  };
}
export function presetPageModel(
  raw: z.infer<typeof wirePresetList>,
  scope: SimulationScope,
): SimulationPresetPage {
  const active = activeModel(raw.activeSession, scope);
  const p = {
    ...raw,
    items: raw.items.map((i) => itemModel(i, active)),
    activeSession: active,
  };
  if (raw.bankVersion !== raw.scope.bankVersion)
    throw Error("Ngân hàng bộ đề không khớp.");
  validatePresetPage(p, scope);
  return p;
}
export function presetPreparationModel(
  raw: z.infer<typeof wirePresetDetail>,
  scope: SimulationScope,
  id: string,
): SimulationPresetPreparation {
  const active = activeModel(raw.activeSession, scope),
    item = itemModel(raw.preset, active);
  if (
    active &&
    (raw.canStart || raw.unavailableReason !== "ACTIVE_SESSION_EXISTS")
  )
    throw Error("Phiên đang làm chưa được đối chiếu.");
  const p = {
    scope: raw.scope,
    bankVersion: raw.scope.bankVersion,
    policy: item.policy,
    preset: {
      presetSetId: item.presetSetId,
      presetVersionId: item.presetVersionId,
      title: item.title,
    },
    publicationStatus: item.publicationStatus,
    canStart: raw.canStart,
    unavailableReason: raw.unavailableReason,
    activeSession: active,
  };
  validatePresetPreparation(p, scope, id);
  return p;
}
