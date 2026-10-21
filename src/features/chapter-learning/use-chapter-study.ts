import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChapterStudyModel } from './chapter-study-model';
import type { StudyMode, StudyTarget } from './study-types';

export function useChapterStudy(chapterId: StudyTarget, mode: StudyMode, licenseClass: string, initialQuestionId?: number) {
  const model = useMemo(() => new ChapterStudyModel(chapterId, mode, licenseClass, initialQuestionId), [chapterId, mode, licenseClass, initialQuestionId]);
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void model.load();
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
