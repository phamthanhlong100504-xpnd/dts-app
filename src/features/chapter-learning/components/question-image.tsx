import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { getQuestionImage } from '../question-image-service';
import type { StudyQuestion, StudyScope } from '../study-types';

function QuestionImageResource({ question, scope, retry, onRetry }: {
  question: StudyQuestion; scope: StudyScope; retry: number; onRetry: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getQuestionImage(question, scope).then((value) => {
      if (active) { setUrl(value); if (!value) setLoading(false); }
    }).catch((failure) => {
      if (active) { setError(failure instanceof Error ? failure.message : 'Không tải được ảnh.'); setLoading(false); }
    });
    return () => { active = false; };
  }, [question, scope, retry]);
  if (!question.imageUrl && !question.mediaFileId) return null;
  return <View className="mb-5 h-52 w-full items-center justify-center rounded-xl bg-gray-50">
    {url && !error && <Image key={`${url}:${retry}`} source={{ uri: url }} contentFit="contain"
      accessibilityLabel={`Hình minh họa câu hỏi ${question.id}`} style={{ width: '100%', height: '100%' }}
      onLoad={() => setLoading(false)} onError={(failure) => {
        setLoading(false);
        setError('Chưa tải được ảnh câu hỏi.');
        if (__DEV__) {
          const reason = failure.error.replace(/https?:\/\/[^\s"'<>]+/gi, '[image URL]')
            .replace(/(X-Amz-[\w-]+=)[^&\s]+/gi, '$1[redacted]');
          console.warn('[DTS QuestionImage]', { questionId: question.id, origin: new URL(url).origin, reason });
        }
      }} />}
    {loading && !error && <ActivityIndicator color="#0877F9" style={{ position: 'absolute' }} />}
    {error && <View className="items-center px-4">
      <Text className="text-center text-sm text-gray-600">{error}</Text>
      <Pressable accessibilityRole="button" className="mt-2 min-h-11 justify-center" onPress={onRetry}>
        <Text className="text-base font-semibold text-blue-700">Tải lại ảnh</Text>
      </Pressable>
    </View>}
  </View>;
}

export function QuestionImage({ question, scope }: { question: StudyQuestion; scope: StudyScope }) {
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([question.id, question.imageUrl, question.mediaFileId,
    scope.userId, scope.licenseClass, scope.bankVersion, scope.version, retry]);
  return <QuestionImageResource key={key} question={question} scope={scope} retry={retry}
    onRetry={() => setRetry((value) => value + 1)} />;
}
