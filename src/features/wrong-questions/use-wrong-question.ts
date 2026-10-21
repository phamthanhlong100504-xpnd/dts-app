import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { WrongQuestionModel } from './wrong-question-model';
import type { WrongFilter } from './wrong-service';

export function useWrongQuestion(questionId: number, licenseClass: string, filter: WrongFilter) {
  const model = useMemo(() => new WrongQuestionModel(questionId, licenseClass, filter), [questionId, licenseClass, filter]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true; void model.load();
    return () => { focused.current = false; model.invalidate(); };
  }, [model]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active' && focused.current) void model.load();
    });
    return () => subscription.remove();
  }, [model]);
  return { state, model };
}
