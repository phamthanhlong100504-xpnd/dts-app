import type { SimulationScope } from "./simulation-learning-types";
import type {
  ExamCommand,
  ExamCreateRequest,
  ExamPlayback,
  ExamPreparation,
  ExamResult,
  ExamReview,
  ExamSession,
} from "./simulation-exam-types";
import type {
  SimulationPresetPage,
  SimulationPresetPreparation,
} from "./simulation-preset-types";
/** Owned Practice simulation sessions; independent from theory exam services. */
export interface SimulationExamSource {
  shortcuts?: import("./simulation-shortcut-source").ShortcutPort<ExamSession>;
  active?: (scope: SimulationScope) => Promise<ExamSession | null>;
  presets?: (scope: SimulationScope) => Promise<SimulationPresetPage>;
  presetPreparation?: (
    scope: SimulationScope,
    presetSetId: string,
  ) => Promise<SimulationPresetPreparation>;
  preparation: (scope: SimulationScope) => Promise<ExamPreparation>;
  create: (
    scope: SimulationScope,
    request: ExamCreateRequest,
  ) => Promise<ExamSession>;
  session: (scope: SimulationScope, sessionId: string) => Promise<ExamSession>;
  playback: (
    scope: SimulationScope,
    sessionId: string,
  ) => Promise<ExamPlayback>;
  command: (
    scope: SimulationScope,
    request: ExamCommand,
  ) => Promise<ExamSession>;
  result: (scope: SimulationScope, sessionId: string) => Promise<ExamResult>;
  review: (scope: SimulationScope, sessionId: string) => Promise<ExamReview>;
  reviewPlayback: (
    scope: SimulationScope,
    sessionId: string,
    position: number,
  ) => Promise<ExamPlayback>;
}
