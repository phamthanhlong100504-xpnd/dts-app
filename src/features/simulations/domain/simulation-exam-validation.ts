import type { SimulationScope } from "./simulation-learning-types";
import type {
  ExamPlayback,
  ExamOrigin,
  ExamPolicy,
  ExamPreparation,
  ExamResult,
  ExamReview,
  ExamSession,
} from "./simulation-exam-types";
function check(ok: unknown): asserts ok {
  if (!ok) throw new Error("Dữ liệu bài thi mô phỏng chưa hợp lệ.");
}
const integer = (n: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(n) && n >= min && n <= max;
const text = (s: unknown) => typeof s === "string" && s.trim().length > 0;
export function validateExamScope(
  actual: SimulationScope,
  expected: SimulationScope,
) {
  check(
    actual &&
      actual.userId === expected.userId &&
      actual.licenseClass === expected.licenseClass,
  );
}
export function validateExamPolicy(p: ExamPolicy) {
  check(
    p &&
      p.totalScenarios === 10 &&
      p.maxScenarioScore === 5 &&
      p.maxTotalScore === 50 &&
      integer(p.passingScore, 0, p.maxTotalScore) &&
      text(p.policyVersion),
  );
}
export function validateExamOrigin(value: ExamOrigin) {
  check(
    value &&
      (value.mode === "RANDOM"
        ? value.preset == null
        : value.mode === "PRESET" &&
          value.preset &&
          text(value.preset.presetSetId) &&
          text(value.preset.presetVersionId) &&
          text(value.preset.title)),
  );
}
export function sameExamOrigin(a: ExamOrigin, b: ExamOrigin) {
  return (
    a.mode === b.mode &&
    (a.mode === "RANDOM" ||
      (b.mode === "PRESET" &&
        a.preset.presetSetId === b.preset.presetSetId &&
        a.preset.presetVersionId === b.preset.presetVersionId &&
        a.preset.title === b.preset.title &&
        (
          [
            "code",
            "displayOrder",
            "manifestSha256",
            "sourceVersion",
            "sourceSha256",
          ] as const
        ).every((key) => a.preset[key] === b.preset[key])))
  );
}
export function sameExamPolicy(a: ExamPolicy, b: ExamPolicy) {
  return (
    a.policyVersion === b.policyVersion &&
    a.totalScenarios === b.totalScenarios &&
    a.maxScenarioScore === b.maxScenarioScore &&
    a.maxTotalScore === b.maxTotalScore &&
    a.passingScore === b.passingScore
  );
}
export function validateExamSession(
  s: ExamSession,
  scope: SimulationScope,
  id?: string,
) {
  check(s);
  validateExamScope(s.scope, scope);
  validateExamPolicy(s.policy);
  validateExamOrigin(s);
  check(
    text(s.sessionId) && (!id || s.sessionId === id) && text(s.bankVersion),
  );
  check(
    s.scope.bankVersion === s.bankVersion &&
      text(s.scoringVersion) &&
      text(s.playbackEventId) &&
      ["NOT_STARTED", "READY", "PLAYING", "INTERRUPTED", "FINISHED"].includes(
        s.playbackState,
      ) &&
      typeof s.requiresRestart === "boolean" &&
      s.playbackPolicy &&
      s.playbackPolicy.allowPause === false &&
      s.playbackPolicy.allowSeek === false &&
      s.playbackPolicy.allowHintsWhilePlaying === false &&
      s.playbackPolicy.allowFullscreen === true &&
      integer(s.playbackPolicy.heartbeatIntervalMs, 1) &&
      integer(
        s.playbackPolicy.maxHeartbeatGapMs,
        s.playbackPolicy.heartbeatIntervalMs,
      ) &&
      Number.isFinite(Date.parse(s.startedAt)),
  );
  check(
    ["IN_PROGRESS", "READY_TO_SUBMIT", "COMPLETED", "CANCELLED"].includes(
      s.status,
    ) &&
      integer(s.completedScenarios, 0, 10) &&
      integer(s.currentPosition, 1, 10) &&
      typeof s.responseRecorded === "boolean",
  );
  check(Array.isArray(s.positions) && s.positions.length === 10);
  const count = s.completedScenarios;
  s.positions.forEach((p, i) =>
    check(
      p.position === i + 1 &&
        p.status ===
          (i < count
            ? "COMPLETED"
            : s.status === "IN_PROGRESS" && i === count
              ? "CURRENT"
              : "NOT_STARTED"),
    ),
  );
  if (s.status === "IN_PROGRESS")
    check(count < 10 && s.currentPosition === count + 1);
  if (s.status === "READY_TO_SUBMIT" || s.status === "COMPLETED")
    check(count === 10 && s.currentPosition === 10);
  if (s.status === "COMPLETED")
    check(
      !!s.completedAt && Date.parse(s.completedAt) >= Date.parse(s.startedAt),
    );
  // Active payloads must not carry teaching/scoring details. Map a strict projection in the adapter.
  for (const p of [s, ...s.positions])
    for (const key of [
      "scenarioId",
      "scenarioNumber",
      "title",
      "chapterName",
      "hazardSign",
      "recognitionTip",
      "scoringSegments",
      "score",
      "totalScore",
      "passed",
    ])
      check(!(key in p));
}
export function validateExamPreparation(
  p: ExamPreparation,
  scope: SimulationScope,
) {
  check(p);
  validateExamScope(p.scope, scope);
  validateExamPolicy(p.policy);
  check(
    text(p.bankVersion) &&
      p.bankVersion === p.scope.bankVersion &&
      p.preset == null,
  );
  if (p.activeSession) {
    validateExamSession(p.activeSession, scope);
    check(["IN_PROGRESS", "READY_TO_SUBMIT"].includes(p.activeSession.status));
  }
}
export function validateExamPlayback(
  p: ExamPlayback,
  s: ExamSession,
  approvedStartAtMs = 0,
) {
  check(
    p &&
      p.sessionId === s.sessionId &&
      p.position === s.currentPosition &&
      text(p.playbackEventId) &&
      p.mimeType === "video/mp4" &&
      integer(p.durationMs, 1) &&
      typeof p.responseRecorded === "boolean" &&
      p.responseRecorded === s.responseRecorded,
  );
  check(
    p.restartAtMs === approvedStartAtMs &&
      (!s.playbackEventId || p.playbackEventId === s.playbackEventId),
  );
  let url: URL;
  try {
    url = new URL(p.videoUrl);
  } catch {
    throw new Error("Video chưa có địa chỉ phát hợp lệ.");
  }
  check(url.protocol === "https:" || url.protocol === "http:");
  check(
    Number.isFinite(Date.parse(p.expiresAt)) &&
      Date.parse(p.expiresAt) > Date.now(),
  );
  for (const key of [
    "scenarioId",
    "title",
    "chapterName",
    "scoringSegments",
    "score",
    "hazardSign",
    "recognitionTip",
  ])
    check(!(key in p));
}
export function validateExamResult(
  r: ExamResult,
  scope: SimulationScope,
  id: string,
) {
  check(r);
  validateExamScope(r.scope, scope);
  validateExamPolicy(r.policy);
  validateExamOrigin(r);
  check(
    r.sessionId === id &&
      r.status === "COMPLETED" &&
      text(r.bankVersion) &&
      r.bankVersion === r.scope.bankVersion &&
      text(r.scoringVersion) &&
      r.completedScenarios === 10 &&
      integer(r.totalScore, 0, r.policy.maxTotalScore) &&
      typeof r.passed === "boolean" &&
      r.resultStatus === (r.passed ? "PASSED" : "FAILED"),
  );
  check(
    Number.isFinite(Date.parse(r.startedAt)) &&
      Number.isFinite(Date.parse(r.completedAt)) &&
      Date.parse(r.completedAt) >= Date.parse(r.startedAt),
  );
  check(Array.isArray(r.items) && r.items.length === 10);
  r.items.forEach((i, n) =>
    check(
      i.position === n + 1 &&
        i.maxScore === r.policy.maxScenarioScore &&
        integer(i.score, 0, i.maxScore),
    ),
  );
  check(r.items.reduce((n, i) => n + i.score, 0) === r.totalScore);
  // Display the backend's passed/passingScore. Never derive a pass/fail decision here.
}
export function validateExamReview(
  r: ExamReview,
  scope: SimulationScope,
  id: string,
) {
  check(r);
  validateExamResult(r.result, scope, id);
  check(Array.isArray(r.items) && r.items.length === 10);
  const ids = new Set<string>();
  r.items.forEach((i, n) => {
    check(i.position === n + 1 && text(i.scenarioId) && !ids.has(i.scenarioId));
    ids.add(i.scenarioId);
    check(
      integer(i.scenarioNumber, 1) &&
        text(i.title) &&
        text(i.chapterName) &&
        text(i.scoringVersion) &&
        i.score === r.result.items[n].score &&
        i.maxScore === r.result.items[n].maxScore &&
        integer(i.durationMs, 1),
    );
    check(
      typeof i.responseRecorded === "boolean" &&
        (i.responseRecorded
          ? i.firstResponseMs !== null &&
            integer(i.firstResponseMs, 0, i.durationMs)
          : i.firstResponseMs === null),
    );
    check(Array.isArray(i.scoringSegments) && i.scoringSegments.length === 5);
    let end = -1;
    const scores = new Set<number>();
    i.scoringSegments.forEach((s) => {
      check(
        integer(s.startMs, 0, i.durationMs) &&
          integer(s.endMs, 1, i.durationMs) &&
          s.endMs > s.startMs &&
          s.startMs >= end &&
          integer(s.score, 1, 5) &&
          !scores.has(s.score),
      );
      end = s.endMs;
      scores.add(s.score);
    });
    check(text(i.hazardSign) && text(i.recognitionTip));
    check(
      i.scoringVersion === r.result.scoringVersion &&
        (i.playbackPath ===
          `/api/v1/simulation-exams/sessions/${id}/review/${i.position}/playback` ||
          i.playbackPath ===
            `/api/practice/v1/simulation-exams/sessions/${id}/review/${i.position}/playback`),
    );
  });
}
