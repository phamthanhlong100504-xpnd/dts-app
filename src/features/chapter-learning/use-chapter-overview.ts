import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { reloadLearnerProfile } from '../session/session-service';
import { useLearnerSession } from '../session/session-store';
import { getChapterOverview, type ChapterOverview } from './chapter-service';

export function useChapterOverview() {
  const version = useLearnerSession((state) => state.version);
  const licenseClass = useLearnerSession((state) => state.session?.profile.selectedLicenseClass);
  const [data, setData] = useState<ChapterOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const requestNumber = useRef(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    requestNumber.current = retry;
    const isCurrent = () => active && requestNumber.current === retry && useLearnerSession.getState().version === version;
    async function load() {
      setLoading(true); setError(null); setData(null);
      try {
        const profile = await reloadLearnerProfile();
        if (!isCurrent() || !licenseClass || profile.selectedLicenseClass !== licenseClass) return;
        const overview = await getChapterOverview(licenseClass);
        if (isCurrent()) setData(overview);
      } catch (failure) {
        if (isCurrent()) setError(failure instanceof Error ? failure.message : 'Không tải được danh sách chương.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [licenseClass, version, retry]));
  return { data, error, loading, reload: () => setRetry((value) => value + 1) };
}
