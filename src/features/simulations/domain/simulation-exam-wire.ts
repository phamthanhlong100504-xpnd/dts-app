import { z } from "zod";
export const examUuid = z
  .string()
  .uuid()
  .refine((v) => v === v.toLowerCase());
const text = z.string().min(1);
const count = z.number().int().nonnegative().safe();
const positive = count.min(1);
const position = count.min(1).max(10);
const scope = z
  .object({
    userId: examUuid,
    licenseClass: z.enum([
      "B",
      "C1",
      "C",
      "D1",
      "D2",
      "D",
      "BE",
      "C1E",
      "CE",
      "D1E",
      "D2E",
      "DE",
    ]),
    bankVersion: text,
  })
  .strict();
const policy = z
  .object({
    totalScenarios: z.literal(10),
    maxScenarioScore: z.literal(5),
    maxTotalScore: z.literal(50),
    passingScore: count.max(50),
    policyVersion: text,
  })
  .strict();
const date = z.string().datetime({ offset: true });
const sessionShape = {
  scope,
  sessionId: examUuid,
  status: z.enum(["IN_PROGRESS", "READY_TO_SUBMIT", "COMPLETED", "CANCELLED"]),
  bankVersion: text,
  scoringVersion: text,
  policy,
  totalScenarios: z.literal(10),
  completedScenarios: count.max(10),
  currentPosition: position,
  maxTotalScore: z.literal(50),
  responseRecorded: z.boolean(),
  playbackEventId: examUuid,
  playbackState: z.enum([
    "NOT_STARTED",
    "READY",
    "PLAYING",
    "INTERRUPTED",
    "FINISHED",
  ]),
  requiresRestart: z.boolean(),
  playbackPolicy: z
    .object({
      allowPause: z.literal(false),
      allowSeek: z.literal(false),
      allowFullscreen: z.literal(true),
      allowHintsWhilePlaying: z.literal(false),
      heartbeatIntervalMs: positive,
      maxHeartbeatGapMs: positive,
    })
    .strict(),
  positions: z
    .array(
      z
        .object({
          position,
          status: z.enum(["NOT_STARTED", "CURRENT", "COMPLETED"]),
        })
        .strict(),
    )
    .length(10),
  startedAt: date,
  completedAt: date.nullable().optional(),
};
const presetRef = z
  .object({
    presetSetId: examUuid,
    presetVersionId: examUuid,
    code: text,
    title: text,
    displayOrder: positive,
    manifestSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sourceVersion: text,
    sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const presetOrigin = {
  mode: z.literal("PRESET"),
  preset: presetRef,
  presetSetId: examUuid,
  presetVersionId: examUuid,
  presetTitle: text,
};
function pinnedPreset(
  v: {
    mode: "RANDOM" | "PRESET";
    policy: z.infer<typeof policy>;
    preset?: z.infer<typeof presetRef>;
    presetSetId?: string;
    presetVersionId?: string;
    presetTitle?: string;
  },
  ctx: z.RefinementCtx,
) {
  if (
    v.mode === "PRESET" &&
    (v.presetSetId !== v.preset?.presetSetId ||
      v.presetVersionId !== v.preset?.presetVersionId ||
      v.presetTitle !== v.preset?.title ||
      v.policy.passingScore !== 35 ||
      v.policy.policyVersion !== "simulation-preset-10-v1-pass35")
  )
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Preset snapshot mismatch",
    });
}
export const wireExamSession = z
  .discriminatedUnion("mode", [
    z.object({ ...sessionShape, mode: z.literal("RANDOM") }).strict(),
    z.object({ ...sessionShape, ...presetOrigin }).strict(),
  ])
  .superRefine(pinnedPreset);
export const wireExamPreparation = z
  .object({
    scope,
    bankVersion: text,
    policy,
    activeSession: wireExamSession.nullable().optional(),
  })
  .strict();
export const wireExamActive = z
  .object({ session: wireExamSession.nullable().optional() })
  .strict();
export const wireExamPlayback = z
  .object({
    sessionId: examUuid,
    position,
    playbackEventId: examUuid,
    videoUrl: z
      .string()
      .url()
      .refine((v) => /^https?:\/\//i.test(v)),
    expiresAt: date,
    mimeType: z.literal("video/mp4"),
    durationMs: positive,
    responseRecorded: z.boolean(),
    restartAtMs: z.union([z.literal(0), z.literal(10000)]),
  })
  .strict();
const resultShape = {
  scope,
  sessionId: examUuid,
  status: z.literal("COMPLETED"),
  bankVersion: text,
  scoringVersion: text,
  policy,
  totalScenarios: z.literal(10),
  completedScenarios: z.literal(10),
  totalScore: count.max(50),
  maxTotalScore: z.literal(50),
  passingScore: count.max(50),
  passed: z.boolean(),
  resultStatus: z.enum(["PASSED", "FAILED"]),
  startedAt: date,
  completedAt: date,
  items: z
    .array(
      z
        .object({ position, score: count.max(5), maxScore: z.literal(5) })
        .strict(),
    )
    .length(10),
};
export const wireExamResult = z
  .discriminatedUnion("mode", [
    z.object({ ...resultShape, mode: z.literal("RANDOM") }).strict(),
    z.object({ ...resultShape, ...presetOrigin }).strict(),
  ])
  .superRefine(pinnedPreset);
export const wireExamReview = z
  .object({
    result: wireExamResult,
    items: z
      .array(
        z
          .object({
            position,
            scenarioId: examUuid,
            scenarioNumber: positive,
            title: text,
            chapterName: text,
            score: count.max(5),
            maxScore: z.literal(5),
            responseRecorded: z.boolean(),
            firstResponseMs: count.nullable().optional(),
            durationMs: positive,
            scoringSegments: z
              .array(
                z
                  .object({
                    startMs: count,
                    endMs: positive,
                    score: positive.max(5),
                    endInclusive: z.boolean(),
                  })
                  .strict(),
              )
              .length(5),
            hazardSign: text,
            recognitionTip: text,
            scoringVersion: text,
            playbackPath: text,
          })
          .strict(),
      )
      .length(10),
  })
  .strict();
export function parseExamWire<T>(schema: z.ZodType<T>, input: unknown): T {
  const value = schema.safeParse(input);
  if (!value.success)
    throw new Error(
      "Phản hồi thi thử mô phỏng không đúng hợp đồng đã bàn giao.",
    );
  return value.data;
}

export const wirePresetItem = z
  .object({
    presetSetId: examUuid,
    presetVersionId: examUuid,
    code: text,
    title: text,
    displayOrder: positive,
    status: z.literal("PUBLISHED"),
    totalScenarios: z.literal(10),
    maxTotalScore: z.literal(50),
    passingScore: z.literal(35),
    hasCompletedAttempt: z.boolean(),
    latestCompletedSessionId: examUuid.nullable(),
    latestCompletedScore: count.max(50).nullable(),
    latestCompletedPassed: z.boolean().nullable(),
    latestCompletedAt: date.nullable(),
    activeSessionId: examUuid.nullable(),
    attemptStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "PASSED", "FAILED"]),
  })
  .strict();
export const wirePresetList = z
  .object({
    scope,
    bankVersion: text,
    totalPublishedSets: count,
    items: z.array(wirePresetItem),
    activeSession: wireExamSession.nullable(),
  })
  .strict();
export const wirePresetDetail = z
  .object({
    scope,
    preset: wirePresetItem,
    mode: z.literal("PRESET"),
    maxScorePerScenario: z.literal(5),
    canStart: z.boolean(),
    unavailableReason: text.nullable(),
    activeSession: wireExamSession.nullable(),
  })
  .strict();
