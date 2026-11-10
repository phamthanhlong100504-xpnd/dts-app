import type { SimulationExamController } from './domain/simulation-exam-controller';

/** Screen lifecycle only; submission, UUID reuse and reconciliation stay in the coordinator. */
export function observeSimulationAutoSubmit(model: SimulationExamController, callbacks: {
  onError: (error: unknown) => void;
  onCompleted: (sessionId: string) => void;
}) {
  let loaded = false, stopped = false, requested = false, navigated = false;
  const observe = () => {
    if (!loaded || stopped) return;
    const state = model.snapshot();
    if (state.status !== 'ready') return;
    const { session, busy } = state.data;
    if (session.status === 'COMPLETED') {
      if (!navigated) { navigated = true; callbacks.onCompleted(session.sessionId); }
      return;
    }
    if (requested || busy || session.status !== 'READY_TO_SUBMIT'
      || session.completedScenarios !== session.policy.totalScenarios
      || session.positions.length !== session.policy.totalScenarios
      || !session.positions.every(position => position.status === 'COMPLETED')) return;
    requested = true;
    void model.submit().catch(error => { if (!stopped) callbacks.onError(error); });
  };
  const unsubscribe = model.subscribe(observe);
  return {
    // Call only after this focus's owned GET load; never act on a cached screen snapshot.
    loaded() { if (!stopped) { loaded = true; observe(); } },
    stop() { stopped = true; unsubscribe(); },
  };
}
