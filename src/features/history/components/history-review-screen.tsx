import { Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { StudyAccess } from '../../session/components/study-access';
import { StudyLicensePicker } from '../../session/components/study-license-picker';
import { useLearnerSession } from '../../session/session-store';
import { useLearnerResource } from '../../session/use-learner-resource';
import { QuestionImage } from '../../chapter-learning/components/question-image';
import { splitExplanationParagraphs } from '../../chapter-learning/components/chapter-question-content';
import { getHistoryReview, type HistoryReview } from '../history-service';
import { historyDate, historyDuration, historyTitle } from '../history-format';

function ResultQuestion({ question, index, data }: {
  question: HistoryReview['questions'][number]; index: number; data: HistoryReview;
}) {
  return <View className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
    <Text className="mb-4 text-gray-900" style={{ fontSize: 18, fontWeight: '600', lineHeight: 27 }}>
      Câu {index + 1}/{data.questions.length}: {question.text}
    </Text>
    <QuestionImage question={question} scope={data.scope} />
    {question.choices.map((choice) => {
      const selected = question.selectedAnswer === choice.key;
      const correctChoice = question.referenceAnswer === choice.key;
      const wrongChoice = selected && !question.isCorrect;
      return <View key={choice.key} className="mb-3 min-h-16 flex-row items-center rounded-xl px-4 py-3"
        style={{ backgroundColor: correctChoice ? '#DCFCE7' : wrongChoice ? '#FEE2E2' : '#F3F4F6',
          borderWidth: 1, borderColor: correctChoice ? '#16A34A' : wrongChoice ? '#EF4444' : 'transparent' }}>
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
          <Text className="text-lg font-bold text-gray-900">{choice.key}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg leading-7 text-gray-900">{choice.text}</Text>
        </View>
      </View>;
    })}
    <View className="mt-1 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <Text className="text-lg font-semibold leading-7 text-gray-900">
        Đáp án đúng: {question.referenceAnswer}
      </Text>
      <Text className="mt-3 text-lg font-semibold leading-7 text-gray-900">Giải thích</Text>
      {splitExplanationParagraphs(question.explanation || 'Chưa có giải thích cho câu này.').map((paragraph, position) =>
        <Text key={position} className="text-lg leading-7 text-gray-800"
          style={{ marginTop: position === 0 ? 4 : 10 }}>{paragraph}</Text>)}
    </View>
  </View>;
}
function Count({ value, label }: { value: number; label: string }) {
  return <View className="flex-1 items-center px-1">
    <Text className="text-xl font-bold text-gray-900">{value}</Text>
    <Text className="mt-1 text-center text-base text-gray-700">{label}</Text>
  </View>;
}
function HistoryReviewSummary({ data }: { data: HistoryReview }) {
  return <View className="mb-5 rounded-2xl border border-blue-200 bg-white p-4">
    <Text className="text-center text-xl font-bold leading-7 text-gray-900">{historyTitle(data.history)}</Text>
    <Text className="mt-1 text-center text-base leading-6 text-gray-700">
      Hạng {data.scope.licenseClass} · {data.history.activityType === 'RANDOM_EXAM' ? 'Thi thử ngẫu nhiên' : 'Bộ đề có sẵn'}
    </Text>
    <View className="mt-4 flex-row items-center justify-between">
      <View>
        <Text className="text-sm text-gray-700">Điểm bài thi</Text>
        <Text className="mt-1 font-bold text-gray-900" style={{ fontSize: 16, lineHeight: 24 }}>
          {data.correct}/{data.questions.length}
        </Text>
      </View>
      <View className="rounded-full px-4 py-2" style={{ backgroundColor: data.passed ? '#DCFCE7' : '#FEE2E2' }}>
        <Text className="text-base font-bold" style={{ color: data.passed ? '#15803D' : '#DC2626' }}>{data.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}</Text>
      </View>
    </View>
    <View className="mt-4 flex-row items-center">
      <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={19} tintColor="#4B5563" />
      <Text className="ml-2 flex-1 text-base leading-6 text-gray-700">Hoàn thành: {historyDate(data.history.completedAt)}</Text>
    </View>
    <View className="mt-2 flex-row items-center">
      <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={19} tintColor="#0877F9" />
      <Text className="ml-2 flex-1 text-base leading-6 text-gray-700">Thời gian làm bài: {historyDuration(data.history.durationSeconds)}</Text>
    </View>
    <View className="mt-4 flex-row rounded-xl bg-gray-100 py-4"><Count value={data.correct} label="Câu đúng" />
      <Count value={data.wrong} label="Câu sai" /><Count value={data.unanswered} label="Chưa làm" /></View>
  </View>;
}
function ReviewContent({ resultId }: { resultId: string }) {
  const licenseClass = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  const loader = useCallback(() => getHistoryReview(resultId, licenseClass), [resultId, licenseClass]);
  const { data, loading, error, reload } = useLearnerResource('history-review:' + resultId, loader);
  return <>
    <Stack.Screen options={{ headerShown: true, title: 'Xem bài làm', headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: true, headerRight: () => <StudyLicensePicker /> }} />
    {loading && <View className="flex-1 items-center justify-center bg-white"><ActivityIndicator size="large" color="#0877F9" />
      <Text className="mt-3 text-base text-gray-600">Đang tải kết quả...</Text></View>}
    {error && <View className="flex-1 justify-center bg-white p-6"><Text selectable className="text-base leading-7 text-red-700">{error}</Text>
      <Pressable accessibilityRole="button" onPress={reload} className="mt-3 min-h-11 justify-center">
        <Text className="text-base font-semibold text-blue-700">Thử lại</Text></Pressable></View>}
    {data && <FlatList className="flex-1 bg-gray-50" data={data.questions} keyExtractor={(question) => String(question.id)}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }} refreshing={false} onRefresh={reload}
      ListHeaderComponent={<HistoryReviewSummary data={data} />}
      renderItem={({ item, index }) => <ResultQuestion question={item} index={index} data={data} />} />}
  </>;
}
export default function HistoryReviewScreen() {
  const { resultId } = useLocalSearchParams<{ resultId: string }>();
  const valid = typeof resultId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(resultId);
  return <StudyAccess>{valid ? <ReviewContent resultId={resultId} /> : <View className="flex-1 justify-center bg-white p-6">
    <Text className="text-lg text-gray-900">Đường dẫn bài làm chưa hợp lệ.</Text></View>}</StudyAccess>;
}
