import type { SimulationScope } from "./simulation-learning-types";
import type {
  ExamPolicy,
  ExamPreparation,
  ExamSession,
} from "./simulation-exam-types";
/** A saved latest completion, not a best-score aggregate. Version/policy belong to that session. */
export interface PresetCompletion {
  sessionId: string;
  presetVersionId: string;
  score: number;
  maxTotalScore: number;
  passingScore: number;
  passed: boolean;
  resultStatus: "PASSED" | "FAILED";
}
export interface SimulationPresetItem {
  presetSetId: string;
  presetVersionId: string;
  code: string;
  title: string;
  displayOrder: number;
  publicationStatus: "PUBLISHED";
  policy: ExamPolicy;
  latestCompleted: PresetCompletion | null;
  activeSession: {
    sessionId: string;
    presetVersionId: string;
    completedScenarios: number;
    totalScenarios: number;
  } | null;
}
export interface SimulationPresetPage {
  scope: SimulationScope;
  bankVersion: string;
  totalPublishedSets: number;
  items: SimulationPresetItem[];
  activeSession?: ExamSession | null;
}
export interface SimulationPresetPreparation extends ExamPreparation {
  preset: NonNullable<ExamPreparation["preset"]>;
  publicationStatus: "PUBLISHED" | "ARCHIVED";
  canStart: boolean;
  unavailableReason: string | null;
}
