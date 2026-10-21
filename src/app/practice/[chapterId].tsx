import { Redirect, useLocalSearchParams } from 'expo-router';
import ChapterSessionScreen from '../../features/chapter-learning/components/chapter-session-screen';

// Preserve old links without entering a frozen wrong-review session.
export default function PracticeQuestionRoute() {
  const params = useLocalSearchParams<{ chapterId: string; questionId?: string; licenseClass?: string }>();
  if (params.chapterId !== 'wrong') return <ChapterSessionScreen />;
  if (typeof params.questionId === 'string' && /^\d+$/u.test(params.questionId) && Number(params.questionId) > 0) {
    return <Redirect href={{ pathname: '/wrong-questions/[questionId]', params: { questionId: params.questionId,
      filter: 'all', ...(typeof params.licenseClass === 'string' ? { licenseClass: params.licenseClass } : {}) } }} />;
  }
  return <Redirect href="/wrong-questions" />;
}
