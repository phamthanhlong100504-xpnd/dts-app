import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useLearnerSession } from './session-store';

// Read-only server snapshots. Scope changes hide the previous response at once.
export function useLearnerResource<T>(resourceKey: string, loader: () => Promise<T>) {
  const version = useLearnerSession((state) => state.version);
  const license = useLearnerSession((state) => state.session?.profile.selectedLicenseClass);
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([version, license, resourceKey, retry]);
  const [snapshot, setSnapshot] = useState<{ key: string; data: T | null; error: string | null; loading: boolean } | null>(null);
  const focused = useRef(false);
  const reload = useCallback(() => setRetry((value) => value + 1), []);
  useFocusEffect(useCallback(() => {
    let active = true; focused.current = true;
    async function read() {
      setSnapshot({ key, data: null, error: null, loading: true });
      try {
        const data = await loader();
        if (active && useLearnerSession.getState().version === version) setSnapshot({ key, data, error: null, loading: false });
      } catch (error) {
        if (active && useLearnerSession.getState().version === version) setSnapshot({ key, data: null,
          error: error instanceof Error ? error.message : 'Không tải được dữ liệu. Vui lòng thử lại.', loading: false });
      }
    }
    void read();
    return () => { active = false; focused.current = false; };
  }, [key, version, loader]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active' && focused.current) reload();
    });
    return () => subscription.remove();
  }, [reload]);
  return { data: snapshot?.key === key ? snapshot.data : null,
    error: snapshot?.key === key ? snapshot.error : null, loading: snapshot?.key !== key || snapshot.loading, reload };
}
