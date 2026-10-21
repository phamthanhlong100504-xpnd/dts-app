import { useEffect, useState } from 'react';
import { useLearnerSession } from '../session/session-store';
import type { ChapterOverview } from './chapter-service';
import { getBankQuestions, searchQuestionText, type BankQuestion } from './question-catalog-service';

export function useQuestionSearch(query: string, overview: ChapterOverview | null) {
  const version = useLearnerSession((state) => state.version);
  const [snapshot, setSnapshot] = useState<{ key: string; rows: BankQuestion[] } | null>(null);
  const [failure, setFailure] = useState<{ key: string; attempt: number; message: string } | null>(null);
  const [retry, setRetry] = useState(0);
  const licenseClass = overview?.licenseClass;
  const bankVersion = overview?.bankVersion;
  const key = JSON.stringify([version, licenseClass, bankVersion]);
  const enabled = !!query.trim() && !!overview;
  useEffect(() => {
    if (!enabled || !licenseClass || !bankVersion || snapshot?.key === key ||
      (failure?.key === key && failure.attempt === retry)) return;
    let active = true;
    void getBankQuestions(licenseClass, bankVersion).then((rows) => {
      if (active && useLearnerSession.getState().version === version) {
        setSnapshot({ key, rows }); setFailure(null);
      }
    }).catch((error) => {
      if (active && useLearnerSession.getState().version === version) setFailure({ key, attempt: retry,
        message: error instanceof Error ? error.message : 'Không tìm được câu hỏi. Vui lòng thử lại.' });
    });
    return () => { active = false; };
  }, [enabled, licenseClass, bankVersion, key, version, retry, snapshot?.key, failure?.key, failure?.attempt]);
  const error = failure?.key === key && failure.attempt === retry ? failure.message : null;
  const rows = snapshot?.key === key ? snapshot.rows : null;
  return { results: rows ? searchQuestionText(rows, query) : [], error,
    loading: enabled && !rows && !error, reload: () => setRetry((value) => value + 1) };
}
