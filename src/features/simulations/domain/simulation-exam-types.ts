import type {
  LearningLoadState,
  ScoringSegment,
  SimulationScope,
} from "./simulation-learning-types";
/** Internal view models. The delivered OpenAPI must be mapped at the source boundary. */
export interface ExamPolicy {
  totalScenarios: number;
  maxScenarioScore: number;
  maxTotalScore: number;
  passingScore: number;
  policyVersion: string;
}
export interface ExamPresetIdentity {
  presetSetId: string;
  presetVersionId: string;
  title: string;
  code?: string;
  displayOrder?: number;
  manifestSha256?: string;
  sourceVersion?: string;
  sourceSha256?: string;
}
export type ExamOrigin =
  | { mode: "RANDOM"; preset?: null }
  | { mode: "PRESET"; preset: ExamPresetIdentity };
export type ExamCreateRequest = {
  idempotencyKey: string;
  bankVersion?: string;
} & (
  | { mode: "RANDOM" }
  | { mode: "PRESET"; presetSetId: string; presetVersionId: string }
);
export interface ExamPreparation {
  preset?: ExamPresetIdentity;
  scope: SimulationScope;
  bankVersion: string;
  policy: ExamPolicy;
  activeSession: ExamSession | null;
}
export type ExamStatus =
  "IN_PROGRESS" | "READY_TO_SUBMIT" | "COMPLETED" | "CANCELLED";
export type ExamSession = ExamOrigin & {
  scope: SimulationScope;
  sessionId: string;
  status: ExamStatus;
  bankVersion: string;
  policy: ExamPolicy;
  scoringVersion: string;
  playbackEventId: string;
  playbackState:
    "NOT_STARTED" | "READY" | "PLAYING" | "INTERRUPTED" | "FINISHED";
  requiresRestart: boolean;
  playbackPolicy: {
    allowPause: boolean;
    allowSeek: boolean;
    allowFullscreen: boolean;
    allowHintsWhilePlaying: boolean;
    heartbeatIntervalMs: number;
    maxHeartbeatGapMs: number;
  };
  startedAt: string;
  completedAt: string | null;
  completedScenarios: number;
  currentPosition: number;
  responseRecorded: boolean;
  positions: {
    position: number;
    status: "NOT_STARTED" | "CURRENT" | "COMPLETED";
  }[];
};
export interface ExamPlayback {
  sessionId: string;
  position: number;
  playbackEventId: string;
  videoUrl: string;
  expiresAt: string;
  mimeType: "video/mp4";
  durationMs: number;
  responseRecorded: boolean;
  restartAtMs: 0 | 10000;
}
export type ExamResult = ExamOrigin & {
  scope: SimulationScope;
  sessionId: string;
  status: "COMPLETED";
  bankVersion: string;
  scoringVersion: string;
  policy: ExamPolicy;
  completedScenarios: number;
  totalScore: number;
  passed: boolean;
  resultStatus: "PASSED" | "FAILED";
  startedAt: string;
  completedAt: string;
  items: { position: number; score: number; maxScore: number }[];
};
export interface ExamReviewItem {
  position: number;
  scenarioId: string;
  scenarioNumber: number;
  title: string;
  chapterName: string;
  score: number;
  maxScore: number;
  responseRecorded: boolean;
  firstResponseMs: number | null;
  durationMs: number;
  scoringSegments: ScoringSegment[];
  hazardSign: string;
  recognitionTip: string;
  scoringVersion: string;
  playbackPath: string;
}
export interface ExamReview {
  result: ExamResult;
  items: ExamReviewItem[];
}
export type ExamPhase =
  | "ready"
  | "starting"
  | "restarting"
  | "playing"
  | "response-pending"
  | "recorded"
  | "response-error"
  | "transition"
  | "video-error"
  | "completion-error"
  | "finalizing"
  | "submission-error";
export interface ExamWorkspace {
  session: ExamSession;
  playback: ExamPlayback | null;
  phase: ExamPhase;
  busy: boolean;
  autoStart?: boolean;
  shortcuts?: import("./simulation-shortcut-source").ShortcutView;
  shortcutNotice?: string | null;
}
export type ExamWorkspaceState = LearningLoadState<ExamWorkspace>;
export type ExamCommand = {
  kind:
    | "START"
    | "HEARTBEAT"
    | "RESTART"
    | "REACTION"
    | "COMPLETE_CURRENT"
    | "SUBMIT"
    | "CANCEL";
  sessionId: string;
  position: number;
  playbackEventId: string | null;
  eventId: string;
  mediaTimeMs?: number;
};
export class SimulationExamError extends Error {
  constructor(
    public code:
      | "ACTIVE_SESSION_EXISTS"
      | "NOT_COMPLETED"
      | "ACCESS_DENIED"
      | "CANCELLED"
      | "UNAVAILABLE"
      | "PRESET_UNAVAILABLE"
      | "PRESET_VERSION_CHANGED"
      | "INVALID_REQUEST"
      | "BANK_CHANGED"
      | "PLAYBACK_CHANGED"
      | "RESTART_REQUIRED"
      | "EVENT_CONFLICT"
      | "UNKNOWN",
    message: string,
    public sessionId?: string,
    public status?: number,
    public apiCode?: string,
    public traceId?: string,
  ) {
    super(message);
    this.name = "SimulationExamError";
  }
}
export interface ExamMediaOwner {
  position: number;
  playbackEventId: string;
}
