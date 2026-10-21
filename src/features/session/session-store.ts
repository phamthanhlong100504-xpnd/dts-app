import { create } from 'zustand';
import type { AuthSession, LearnerProfile } from './types';

type SessionState = {
  session: AuthSession | null;
  version: number;
  beginSignIn: () => number;
  acceptSignIn: (version: number, session: AuthSession) => void;
  updateTokens: (version: number, accessToken: string, refreshToken: string) => void;
  acceptProfile: (version: number, profile: LearnerProfile) => void;
  clear: () => void;
};

// Memory holds the latest server response only. No business data or credentials
// are persisted to AsyncStorage; a fresh app launch requires authentication.
export const useLearnerSession = create<SessionState>((set, get) => ({
  session: null,
  version: 0,
  beginSignIn: () => {
    const version = get().version + 1;
    set({ session: null, version });
    return version;
  },
  acceptSignIn: (version, session) => {
    if (get().version === version) set({ session });
  },
  updateTokens: (version, accessToken, refreshToken) => {
    const current = get();
    if (current.version === version && current.session) {
      set({ session: { ...current.session, accessToken, refreshToken } });
    }
  },
  acceptProfile: (version, profile) => {
    const current = get();
    if (current.version !== version || !current.session || current.session.profile.id !== profile.id) return;
    const changedLicense = current.session.profile.selectedLicenseClass !== profile.selectedLicenseClass;
    set({ session: { ...current.session, profile }, version: version + (changedLicense ? 1 : 0) });
  },
  clear: () => set((state) => ({ session: null, version: state.version + 1 })),
}));
