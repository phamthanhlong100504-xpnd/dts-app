import type { ScenarioFilter, SimulationCommand, SimulationChapterPage, SimulationOverview, SimulationScenarioPage, SimulationScope } from './simulation-learning-types';
export interface SimulationLearningSource {
  overview(scope: SimulationScope): Promise<SimulationOverview>;
  chapter(scope: SimulationScope, chapterId: string, filter: ScenarioFilter, page: number): Promise<SimulationChapterPage>;
  scenario(scope: SimulationScope, scenarioId: string, attemptId?: string): Promise<SimulationScenarioPage>;
  command(scope: SimulationScope, command: SimulationCommand): Promise<SimulationScenarioPage>;
}
