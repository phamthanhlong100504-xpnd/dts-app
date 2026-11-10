import type {
  SimulationChapterPage,
  SimulationOverview,
  SimulationScenarioPage,
} from "./simulation-learning-types";
function count(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`Số liệu ${label} không hợp lệ.`);
}
function percent(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100)
    throw new Error("Tiến độ mô phỏng không hợp lệ.");
}
export function validateOverview(value: SimulationOverview) {
  count(value.totalScenarios, "tổng tình huống");
  count(value.practicedScenarios, "đã luyện");
  percent(value.completionPercent);
  if (
    value.practicedScenarios > value.totalScenarios ||
    !Array.isArray(value.chapters)
  )
    throw new Error("Tổng quan mô phỏng không hợp lệ.");
  const ids = new Set<string>();
  for (const chapter of value.chapters) {
    if (
      !chapter.id ||
      ids.has(chapter.id) ||
      !chapter.name ||
      !["NOT_STARTED", "IN_PROGRESS", "COMPLETED"].includes(chapter.status)
    )
      throw new Error("Danh sách chương không hợp lệ.");
    ids.add(chapter.id);
    count(chapter.totalScenarios, "tổng chương");
    count(chapter.practicedScenarios, "đã luyện trong chương");
    percent(chapter.completionPercent);
    if (chapter.practicedScenarios > chapter.totalScenarios)
      throw new Error("Tiến độ chương không hợp lệ.");
  }
}
export function validateChapter(value: SimulationChapterPage) {
  if (
    !value.chapter?.id ||
    !value.chapter.name ||
    !Array.isArray(value.items) ||
    !value.filterCounts
  )
    throw new Error("Danh sách tình huống không hợp lệ.");
  count(value.page, "trang");
  count(value.totalPages, "số trang");
  count(value.filteredCount, "kết quả lọc");
  for (const filter of [
    "ALL",
    "UNPRACTICED",
    "PRACTICED",
    "BOOKMARKED",
  ] as const)
    count(value.filterCounts[filter], "bộ lọc");
  const ids = new Set<string>();
  for (const item of value.items) {
    if (
      !item.id ||
      ids.has(item.id) ||
      item.chapterId !== value.chapter.id ||
      !item.title ||
      typeof item.isPracticed !== "boolean" ||
      typeof item.isBookmarked !== "boolean" ||
      !Number.isFinite(item.durationMs) ||
      item.durationMs <= 0
    )
      throw new Error("Thông tin tình huống không hợp lệ.");
    ids.add(item.id);
    if (
      !Number.isFinite(item.maxScore) ||
      item.maxScore <= 0 ||
      (!item.isPracticed && item.bestScore !== null) ||
      (item.isPracticed &&
        (item.bestScore === null ||
          !Number.isFinite(item.bestScore) ||
          item.bestScore < 0 ||
          item.bestScore > item.maxScore))
    )
      throw new Error("Trạng thái luyện và điểm cao nhất không hợp lệ.");
  }
}
export function validateScenarioSnapshot(value: SimulationScenarioPage) {
  if (
    !value.scenario?.id ||
    !value.scenario.title ||
    !Number.isFinite(value.scenario.durationMs) ||
    value.scenario.durationMs <= 0 ||
    !value.policy
  )
    throw new Error("Thông tin video không hợp lệ.");
  if (
    ![
      "ready",
      "starting",
      "playing",
      "response-pending",
      "recorded",
      "completing",
      "completed",
      "video-error",
      "save-error",
    ].includes(value.phase)
  )
    throw new Error("Trạng thái lượt luyện không hợp lệ.");
  if (
    value.videoUrl &&
    !/^https?:\/\//i.test(value.videoUrl) &&
    !/^\/(?!\/)/.test(value.videoUrl)
  )
    throw new Error("Địa chỉ phát video không hợp lệ.");
  if (value.phase !== "completed") return;
  const r = value.result;
  if (
    !r ||
    r.status !== "COMPLETED" ||
    r.attemptId !== value.attemptId ||
    r.bankVersion !== value.scope.bankVersion ||
    !r.scoringVersion ||
    !Number.isFinite(r.score) ||
    !Number.isFinite(r.maxScore) ||
    r.maxScore <= 0 ||
    r.score < 0 ||
    r.score > r.maxScore ||
    !Number.isFinite(r.durationMs) ||
    r.durationMs <= 0 ||
    !Array.isArray(r.scoringSegments)
  )
    throw new Error(
      "Kết quả chưa được xác nhận theo đúng phiên bản lượt luyện.",
    );
  if (
    (r.responseRecorded && r.firstResponseMs === null) ||
    (!r.responseRecorded && r.firstResponseMs !== null) ||
    (r.firstResponseMs !== null &&
      (!Number.isFinite(r.firstResponseMs) ||
        r.firstResponseMs < 0 ||
        r.firstResponseMs > r.durationMs))
  )
    throw new Error("Thời điểm phản ứng không hợp lệ.");
  let last = 0;
  for (const s of r.scoringSegments) {
    if (
      !Number.isFinite(s.startMs) ||
      !Number.isFinite(s.endMs) ||
      s.startMs < last ||
      s.endMs <= s.startMs ||
      s.endMs > r.durationMs ||
      !Number.isFinite(s.score) ||
      s.score < 0 ||
      s.score > r.maxScore
    )
      throw new Error("Timeline kết quả không hợp lệ.");
    last = s.endMs;
  }
}
