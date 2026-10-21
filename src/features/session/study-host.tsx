import { createContext, useContext, type ReactNode } from 'react';

export type StudyHostActions = { openSignIn?: () => void };
const StudyHostContext = createContext<StudyHostActions>({});

// The common app shell supplies its own auth navigation after the team's merge.
// It must call signInLearner; this provider never accepts a mock/local user.
export function StudyHostProvider({ actions, children }: { actions: StudyHostActions; children: ReactNode }) {
  return <StudyHostContext.Provider value={actions}>{children}</StudyHostContext.Provider>;
}
export function useStudyHost(): StudyHostActions { return useContext(StudyHostContext); }
