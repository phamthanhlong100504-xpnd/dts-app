import { answerText, explanationText, questionText } from '../../shared/question-text';
import { userMessage } from '../../shared/user-message';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudyAccess } from '../../session/components/study-access';
import { QuestionPickerButton } from '../../shared/question-sheet';
import { WrongQuestionNavigator } from './wrong-question-navigator';
import { useLearnerSession } from '../../session/session-store';
import { useWrongQuestion } from '../use-wrong-question';
import { createWrongQuestionSwipe } from '../wrong-question-swipe';
import type { StudyAnswer } from '../../chapter-learning/study-types';
import { QuestionImage } from '../../chapter-learning/components/question-image';
import { splitExplanationParagraphs } from '../../chapter-learning/components/chapter-question-content';
import { isWrongFilter, type WrongFilter, type WrongQuestion, type WrongReading } from '../wrong-service';

export function WrongQuestionContent({ row, data, grade, busy, resolved, needsReload, error, onAnswer, onReload, onSkip, onMove }: {
  row: WrongQuestion; data: WrongReading; grade: StudyAnswer | null; busy: boolean; resolved: boolean;
  needsReload: boolean; error: string | null; onAnswer: (key: string) => void; onReload: () => void; onSkip: () => void; onMove: (direction: 1 | -1) => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const insets = useSafeAreaInsets();
  const panHandlers = useMemo(() => createWrongQuestionSwipe(busy || needsReload, onMove), [busy, needsReload, onMove]);
  const question = row.question;
  const correctAnswer = grade?.correctAnswer ?? question.referenceAnswer;
  const explanation = grade?.explanation ?? question.explanation;
  return <View className="flex-1 bg-white">
    <View className="flex-1" {...panHandlers}>
    <ScrollView className="flex-1" contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ padding: 20, paddingBottom: 16 }}>
      <Text className="mb-4 text-gray-900" style={{ ...questionText, fontWeight: '600', lineHeight: 27 }}>
        Câu {row.sourceNumber ?? question.id}: {question.text}
      </Text>
      <QuestionImage question={question} scope={data.scope} />
      {question.choices.map((choice) => {
        const correct = (revealed || !!grade) && correctAnswer === choice.key;
        const wrong = grade?.selectedAnswer === choice.key && !grade.isCorrect;
        return <Pressable key={choice.key} accessibilityRole="button" accessibilityLabel={`Chọn đáp án ${choice.key}`}
          accessibilityState={{ disabled: busy || resolved || needsReload, selected: grade?.selectedAnswer === choice.key }}
          disabled={busy || resolved || needsReload} onPress={() => onAnswer(choice.key)} className="mb-3 min-h-16 flex-row items-center rounded-xl px-4 py-3"
          style={{ backgroundColor: wrong ? '#FEE2E2' : correct ? '#DCFCE7' : '#F3F4F6', borderWidth: 1,
            borderColor: wrong ? '#DC2626' : correct ? '#16A34A' : 'transparent' }}>
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
            <Text className="text-lg font-bold text-gray-900" style={answerText}>{choice.key}</Text>
          </View>
          <Text className="flex-1 text-lg leading-7 text-gray-900" style={answerText}>{choice.text}</Text>
        </Pressable>;
      })}
      {busy && <ActivityIndicator color="#0877F9" accessibilityLabel="Đang chấm đáp án" />}
      {resolved && !grade && <Text className="my-2 text-base leading-6 text-gray-900">Câu này không còn trong danh sách cần ôn.</Text>}
      {error && <View className="my-2"><Text selectable className="text-base leading-6 text-red-700">{userMessage(error)}</Text>
        <Pressable accessibilityRole="button" onPress={onReload} className="mt-2 min-h-11 justify-center"><Text className="text-base font-semibold text-blue-700">Đọc lại kết quả</Text></Pressable>
      </View>}
      {revealed && <View className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <Text className="text-lg font-semibold leading-7 text-gray-900" style={answerText}>Đáp án đúng: {correctAnswer}</Text>
        <Text className="mt-3 text-lg font-semibold leading-7 text-gray-900" style={answerText}>Giải thích</Text>
        {splitExplanationParagraphs(explanation || 'Chưa có giải thích cho câu này.').map((paragraph, index) =>
          <Text key={index} className="text-lg leading-7 text-gray-800"
            style={{ ...explanationText, marginTop: index === 0 ? 4 : 10 }}>{paragraph}</Text>)}
      </View>}
    </ScrollView>
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10), backgroundColor: '#FFFFFF' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={revealed ? 'Ẩn đáp án' : 'Hiện đáp án'}
        accessibilityState={{ expanded: revealed }} onPress={() => setRevealed((value) => !value)}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 12 }}>
        <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={18} tintColor="#16A34A" />
        <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#16A34A' }}>{revealed ? 'Ẩn đáp án' : 'Hiện đáp án'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Bỏ qua câu đang xem" disabled={busy || needsReload} onPress={onSkip}
        style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 16 }}>
        <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#111827' }}>Bỏ qua</Text>
      </Pressable>
    </View>
  </View>;
}
function backToList(filter: WrongFilter) {
  router.dismissTo({ pathname: '/wrong-questions', params: { filter } });
}
function ReadingResource({ questionId, filter, licenseClass }: { questionId: number; filter: WrongFilter; licenseClass: string }) {
  const { state, model } = useWrongQuestion(questionId, licenseClass, filter);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const rows = state.data?.questions.filter((row) => state.availableIds.includes(row.question.id)) ?? [];
  const locked = state.loading || state.busy || state.needsReload;
  return <>
    <Stack.Screen options={{ headerShown: true, title: 'Ôn câu đã sai', headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: true, gestureEnabled: false, headerRight: () => <QuestionPickerButton open={navigatorOpen} disabled={locked || !rows.length} onPress={() => setNavigatorOpen(true)} /> }} />
    {state.loading ? <View className="flex-1 items-center justify-center bg-white"><ActivityIndicator size="large" color="#0877F9" />
      <Text className="mt-3 text-base text-gray-600">Đang tải câu hỏi...</Text></View> : state.data && state.row ?
      <WrongQuestionContent key={state.row.question.id} row={state.row} data={state.data} grade={state.grade}
        busy={state.busy} resolved={state.resolved} needsReload={state.needsReload} error={state.error}
        onAnswer={(answer) => { void model.answer(answer); }} onReload={() => { void model.load(); }}
        onSkip={() => { if (!model.skip()) backToList(filter); }} onMove={(direction) => { model.move(direction); }} /> :
      <View className="flex-1 justify-center bg-white p-6"><Text selectable className="text-base leading-7 text-red-700">{userMessage(state.error)}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void model.load(); }} className="mt-3 min-h-11 justify-center"><Text className="text-base font-semibold text-blue-700">Thử lại</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => backToList(filter)} className="mt-2 min-h-11 justify-center"><Text className="text-base font-semibold text-blue-700">Về danh sách câu sai</Text></Pressable>
      </View>}
    <WrongQuestionNavigator rows={rows} currentId={state.row?.question.id} open={navigatorOpen}
      close={() => setNavigatorOpen(false)} disabled={locked} onSelect={(id) => { model.selectQuestion(id); }} />
  </>;
}
function LicensedReading({ questionId, filter, expectedLicense }: { questionId: number; filter: WrongFilter; expectedLicense?: string }) {
  const version = useLearnerSession((state) => state.version);
  const licenseClass = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  if (expectedLicense && expectedLicense !== licenseClass) return <View className="flex-1 justify-center bg-white p-6">
    <Text className="text-lg leading-7 text-gray-900">Hạng bằng đã thay đổi. Về danh sách để chọn câu cần ôn.</Text>
    <Pressable accessibilityRole="button" onPress={() => backToList(filter)} className="mt-3 min-h-11 justify-center">
      <Text className="text-base font-semibold text-blue-700">Về danh sách câu sai</Text></Pressable>
  </View>;
  return <ReadingResource key={`${version}:${licenseClass}:${filter}:${questionId}`} questionId={questionId} filter={filter} licenseClass={licenseClass} />;
}
export default function WrongQuestionScreen() {
  const params = useLocalSearchParams<{ questionId: string; filter?: string; licenseClass?: string }>();
  const questionId = Number(params.questionId), filter = params.filter ?? 'all';
  const valid = typeof params.questionId === 'string' && /^\d+$/u.test(params.questionId) && Number.isSafeInteger(questionId) && questionId > 0 &&
    isWrongFilter(filter) && (params.licenseClass === undefined || typeof params.licenseClass === 'string');
  return <StudyAccess>{valid ? <LicensedReading questionId={questionId} filter={filter} expectedLicense={params.licenseClass} /> :
    <View className="flex-1 justify-center bg-white p-6"><Text className="text-lg text-gray-900">Đường dẫn câu hỏi chưa hợp lệ.</Text></View>}</StudyAccess>;
}
