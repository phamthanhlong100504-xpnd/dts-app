import type { SimulationScope } from "./simulation-learning-types";
import type {
  SimulationPresetPage,
  SimulationPresetPreparation,
  PresetCompletion,
} from "./simulation-preset-types";
import {
  validateExamOrigin,
  validateExamPolicy,
  validateExamScope,
  validateExamSession,
} from "./simulation-exam-validation";
function check(ok: unknown): asserts ok {
  if (!ok) throw Error("Dữ liệu bộ đề mô phỏng chưa hợp lệ.");
}
const text = (s: unknown) => typeof s === "string" && s.trim().length > 0;
const integer = (n: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(n) && n >= min && n <= max;
function noScenarioDisclosure(value: object) {
  for (const key of [
    "scenarioIds",
    "scenario_ids",
    "scenarios",
    "scoringSegments",
    "hazardSign",
    "recognitionTip",
    "items",
  ])
    check(!(key in value));
}
export function validatePresetCompletion(c: PresetCompletion) {
  check(
    c &&
      text(c.sessionId) &&
      text(c.presetVersionId) &&
      integer(c.score, 0, c.maxTotalScore) &&
      c.maxTotalScore === 50 &&
      integer(c.passingScore, 0, c.maxTotalScore) &&
      typeof c.passed === "boolean" &&
      c.resultStatus === (c.passed ? "PASSED" : "FAILED"),
  );
}
export function validatePresetPage(
  p: SimulationPresetPage,
  scope: SimulationScope,
) {
  check(p);
  validateExamScope(p.scope, scope);
  check(
    text(p.bankVersion) &&
      p.scope.bankVersion === p.bankVersion &&
      Array.isArray(p.items) &&
      integer(p.totalPublishedSets) &&
      p.totalPublishedSets === p.items.length,
  );
  const ids = new Set<string>(),
    codes = new Set<string>(),
    versions = new Set<string>(),
    completed = new Set<string>();
  let order = 0;
  const activeIds = new Set<string>();
  p.items.forEach((i) => {
    check(
      i &&
        text(i.presetSetId) &&
        text(i.presetVersionId) &&
        text(i.code) &&
        text(i.title) &&
        !ids.has(i.presetSetId) &&
        !versions.has(i.presetVersionId) &&
        !codes.has(i.code) &&
        integer(i.displayOrder, 1) &&
        i.displayOrder > order &&
        i.publicationStatus === "PUBLISHED",
    );
    ids.add(i.presetSetId);
    versions.add(i.presetVersionId);
    codes.add(i.code);
    order = i.displayOrder;
    validateExamPolicy(i.policy);
    noScenarioDisclosure(i);
    check(i.latestCompleted === null || typeof i.latestCompleted === "object");
    check(i.activeSession === null || typeof i.activeSession === "object");
    if (i.latestCompleted) {
      validatePresetCompletion(i.latestCompleted);
      check(i.latestCompleted.presetVersionId === i.presetVersionId);
      check(!completed.has(i.latestCompleted.sessionId));
      completed.add(i.latestCompleted.sessionId);
    }
    if (i.activeSession) {
      const s = i.activeSession;
      check(!activeIds.has(s.sessionId));
      activeIds.add(s.sessionId);
      check(
        text(s.sessionId) &&
          text(s.presetVersionId) &&
          s.presetVersionId === i.presetVersionId &&
          s.totalScenarios === 10 &&
          integer(s.completedScenarios, 0, s.totalScenarios) &&
          s.sessionId !== i.latestCompleted?.sessionId,
      );
    }
  });

  if (p.activeSession) {
    validateExamSession(p.activeSession, scope);
    check(["IN_PROGRESS", "READY_TO_SUBMIT"].includes(p.activeSession.status));
  }
  check(activeIds.size <= 1);
  for (const i of p.items)
    if (i.activeSession) check(!completed.has(i.activeSession.sessionId));
}
export function validatePresetPreparation(
  p: SimulationPresetPreparation,
  scope: SimulationScope,
  id: string,
) {
  check(p);
  validateExamScope(p.scope, scope);
  validateExamPolicy(p.policy);
  validateExamOrigin({ mode: "PRESET", preset: p.preset });
  check(
    p.preset.presetSetId === id &&
      text(p.bankVersion) &&
      p.scope.bankVersion === p.bankVersion &&
      ["PUBLISHED", "ARCHIVED"].includes(p.publicationStatus) &&
      typeof p.canStart === "boolean" &&
      (p.publicationStatus !== "ARCHIVED" || !p.canStart),
  );
  check(p.canStart ? p.unavailableReason === null : text(p.unavailableReason));
  noScenarioDisclosure(p);
  check(
    p.activeSession === null ||
      (!!p.activeSession && typeof p.activeSession === "object"),
  );
  if (p.activeSession) {
    validateExamSession(p.activeSession, scope);
    check(["IN_PROGRESS", "READY_TO_SUBMIT"].includes(p.activeSession.status));
  }
}
