import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ExamSessionModel } from './exam-session-model';
export function useExamSession(id: string, license: string) {
  const model = useMemo(() => new ExamSessionModel(id, license), [id, license]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => { focused.current = true; void model.load(); return () => { focused.current = false; model.invalidate(); }; }, [model]));
  useEffect(() => { const sub = AppState.addEventListener('change', (status) => { if (status === 'active' && focused.current) void model.load(); }); return () => sub.remove(); }, [model]);
  return { state, model };
}
