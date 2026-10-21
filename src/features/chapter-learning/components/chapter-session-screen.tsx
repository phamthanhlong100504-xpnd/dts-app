import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudyAccess } from '../../session/components/study-access';
import { StudyLicensePicker } from '../../session/components/study-license-picker';
import { useLearnerSession } from '../../session/session-store';
import type { StudyMode, StudyTarget } from '../study-types';
import { useChapterStudy } from '../use-chapter-study';
import { ChapterQuestionContent } from './chapter-question-content';
import { ChapterQuestionNavigator } from './chapter-question-navigator';

function BackToChapters({ wrong = false }: { wrong?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={() => router.replace(wrong ? '/wrong-questions' : '/chapters')}
    className="mt-5 min-h-14 items-center justify-center rounded-xl bg-blue-600 px-5">
    <Text className="text-lg font-semibold text-white">{wrong ? 'Về danh sách câu sai' : 'Về danh sách chương'}</Text>
  </Pressable>;
}

function ChapterSessionContent({ chapterId, mode, licenseClass, initialQuestionId }: { chapterId: StudyTarget; mode: StudyMode; licenseClass: string; initialQuestionId?: number }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { state, model } = useChapterStudy(chapterId, mode, licenseClass, initialQuestionId);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const data = state.data;
  const questionId = data?.currentQuestionId;
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [questionId]);
  const chapterNumber = typeof chapterId === 'number' ? ['I', 'II', 'III', 'IV', 'V', 'VI'][chapterId - 1] ?? String(chapterId) : '';
  const chapterName = data?.chapterName.trim();
  const title = chapterId === 'wrong' ? 'Ôn câu đã sai' : chapterId === 'all' ? `Toàn bộ câu hỏi · Hạng ${licenseClass}` : chapterId === 'critical' ? 'Câu điểm liệt' : chapterName ? /^Chương\s/iu.test(chapterName) ? chapterName
    : `Chương ${chapterNumber}. ${chapterName}` : `Chương ${chapterNumber}`;
  const header = <Stack.Screen options={{ title, headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal',
    headerShown: true,
    headerLargeTitle: false, headerTransparent: false, headerShadowVisible: true,
    headerStyle: { backgroundColor: '#FFFFFF' }, headerTintColor: '#111827',
    headerTitleStyle: { fontSize: 18, fontWeight: '600' },
    headerTitle: () => <Text accessibilityRole="header" numberOfLines={1} ellipsizeMode="tail"
      style={{ maxWidth: Math.max(120, width - 144), fontSize: 18, lineHeight: 24,
        fontWeight: '600', color: '#111827', textAlign: 'center' }}>{title}</Text>,
    headerRight: () => <StudyLicensePicker /> }} />;

  if (state.loading) return <>{header}<View className="flex-1 items-center justify-center bg-white">
    <ActivityIndicator size="large" color="#0877F9" /><Text className="mt-3 text-base text-gray-600">Đang tải câu hỏi...</Text>
  </View></>;
  if (!data) return <>{header}<View className="flex-1 justify-center bg-white px-6">
    <Text className="text-lg font-semibold text-red-700">Chưa tải được dữ liệu câu hỏi.</Text>
    <Text selectable className="mt-3 text-base text-red-700">{state.error}</Text>
    <Pressable accessibilityRole="button" className="mt-4 min-h-12 justify-center" onPress={() => { void model.load(); }}>
      <Text className="text-base font-semibold text-blue-700">Thử đọc lại từ máy chủ</Text>
    </Pressable><BackToChapters wrong={chapterId === 'wrong'} />
  </View></>;

  const question = data.questions.find((item) => item.id === data.currentQuestionId)!;
  const position = data.questions.findIndex((item) => item.id === question.id);
  const grade = state.editing ? undefined : data.answers[question.id];
  const answers = Object.values(data.answers);
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const learnedCount = data.learnedQuestionIds?.length ?? answers.length;
  const locked = state.busy || state.needsReload;
  const readOnly = data.status === 'COMPLETED' && (mode === 'review' || data.collection === 'critical');
  const canNavigate = !!grade || readOnly;
  const nextId = data.questions[position + 1]?.id;
  const unanswered = data.questions.find((item) => !data.answers[item.id] && !data.learnedQuestionIds?.includes(item.id));
  const canSkip = mode === 'learn' || !!nextId || (!!unanswered && unanswered.id !== question.id);
  async function next() {
    if (nextId) await model.move(nextId);
    else if (mode === 'review' && unanswered && !readOnly) await model.move(unanswered.id);
    else await model.finish();
  }
  const errorPanel = state.error && <View className="mb-4 rounded-xl bg-red-50 p-4">
    <Text selectable className="text-base text-red-700">{state.error}</Text>
    <Text className="mt-2 text-sm text-gray-700">Đọc lại dữ liệu để xác nhận trạng thái đã lưu trước khi thao tác tiếp.</Text>
    <Pressable accessibilityRole="button" disabled={state.busy} className="mt-2 min-h-11 justify-center" onPress={() => { void model.load(); }}>
      <Text className="text-base font-semibold text-blue-700">Đọc lại từ máy chủ</Text>
    </Pressable>
  </View>;

  if (state.finished) return <>{header}<ScrollView className="flex-1 bg-white" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
    {errorPanel}
    <Text className="text-center text-2xl font-bold text-gray-900">{data.collection === 'wrong' ? 'Đã kết thúc lượt ôn câu sai' : mode === 'review' ? 'Đã hoàn thành vòng ôn tập' : 'Đã lưu tiến độ chương'}</Text>
    <Text className="mt-3 text-center text-lg text-gray-700">Đã trả lời {learnedCount}/{data.questions.length} câu</Text>
    <Text className="mt-2 text-center text-lg text-gray-700">Đúng {correct} · Sai {answers.length - correct} · Còn {data.questions.length - learnedCount}</Text>
    <Text className="mt-3 text-center text-base text-gray-600">{mode === 'review'
      ? 'Kết quả vòng ôn tập được lưu riêng tại Practice.'
      : 'Đáp án và vị trí học đã được đọc lại từ Practice. Các câu bỏ qua vẫn chưa được tính là đã học.'}</Text>
    {data.wrongSummary && <Text className="mt-3 text-center text-lg font-semibold text-blue-700">
      Hiện còn {data.wrongSummary.remainingCount} câu cần ôn
    </Text>}
    <BackToChapters wrong={chapterId === 'wrong'} />
    <Pressable accessibilityRole="button" className="mt-3 min-h-12 items-center justify-center" onPress={() => model.viewAnswers()}>
      <Text className="text-base font-semibold text-blue-700">Xem lại các câu hỏi</Text>
    </Pressable>
  </ScrollView></>;

  return <>{header}<View className="flex-1 bg-white">
    <View className="border-b border-gray-200 bg-white px-5 pb-4 pt-1">
      <View className="flex-row items-center justify-between">
        <Text className="flex-1 font-medium text-gray-600" style={{ fontSize: 14, lineHeight: 21 }}>
          Hạng {licenseClass} · Đã trả lời {learnedCount}/{data.questions.length}
        </Text>
        {data.collection === 'wrong' && !readOnly && <Pressable accessibilityRole="button" disabled={locked}
          accessibilityLabel="Kết thúc lượt ôn câu sai" onPress={() => { void model.finish(); }} className="min-h-11 justify-center pl-3">
          <Text className="font-semibold text-gray-700" style={{ fontSize: 14 }}>Kết thúc</Text>
        </Pressable>}
        <Pressable accessibilityRole="button" disabled={locked} accessibilityState={{ disabled: locked }}
          className="min-h-11 justify-center pl-3" onPress={() => setNavigatorOpen(true)}>
          <Text className="font-semibold text-blue-700" style={{ fontSize: 15 }}>Chọn câu</Text>
        </Pressable>
      </View>
      <View className="h-2 flex-row overflow-hidden rounded-full bg-gray-200">
        {learnedCount > 0 && <View className="h-full bg-green-500" style={{ flex: learnedCount }} />}
        {data.questions.length > learnedCount && <View className="h-full bg-gray-200" style={{ flex: data.questions.length - learnedCount }} />}
      </View>
    </View>
    <ScrollView ref={scroll} className="flex-1" contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{ padding: 20, paddingBottom: 24 }}>
      {errorPanel}
      <ChapterQuestionContent key={JSON.stringify([data.scope.version, data.scope.bankVersion, data.scope.licenseClass,
        data.reviewSessionId, data.criticalSessionId, data.wrongSessionId, question.id, data.answers[question.id]?.answeredAt, state.editing])}
        data={data} state={state} model={model} canSkip={canSkip} onSkip={() => { void next(); }} />
    </ScrollView>
    <View style={{ flexShrink: 0, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF',
      paddingHorizontal: 20, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 6) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <Pressable accessibilityRole="button" disabled={locked || position === 0}
          accessibilityState={{ disabled: locked || position === 0 }} hitSlop={{ top: 2, bottom: 2 }}
          style={{ height: 40, minWidth: 96, maxWidth: '46%', paddingHorizontal: 14, borderRadius: 10,
            borderWidth: 1, borderColor: '#0871E8',
            alignItems: 'center', justifyContent: 'center', backgroundColor: '#0877F9',
            opacity: locked || position === 0 ? 0.4 : 1 }}
          onPress={() => { void model.move(data.questions[position - 1].id); }}>
          <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: '#FFFFFF' }}>Câu trước</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={locked || (!canNavigate && !state.selectedAnswer)}
          accessibilityState={{ disabled: locked || (!canNavigate && !state.selectedAnswer) }} hitSlop={{ top: 2, bottom: 2 }}
          style={{ height: 40, minWidth: 96, maxWidth: '46%', paddingHorizontal: 14, borderRadius: 10,
            borderWidth: 1, borderColor: '#0871E8',
            alignItems: 'center', justifyContent: 'center', backgroundColor: '#0877F9',
            opacity: locked || (!canNavigate && !state.selectedAnswer) ? 0.45 : 1 }}
          onPress={() => { if (canNavigate) void next(); else void model.submit(); }}>
          {state.busy ? <ActivityIndicator color="white" /> : <Text style={{ fontSize: 15, lineHeight: 21, fontWeight: '600', color: '#FFFFFF' }}>
            {canNavigate ? nextId ? 'Câu tiếp' : mode === 'review' ? unanswered && !readOnly ? 'Câu tiếp' : 'Kết thúc' : 'Kết thúc' : 'Kiểm tra'}
          </Text>}
        </Pressable>
      </View>
    </View>
    <ChapterQuestionNavigator data={data} open={navigatorOpen} close={() => setNavigatorOpen(false)} onSelect={(id) => { void model.move(id); }} />
  </View></>;
}

function LicensedSession({ chapterId, mode, expectedLicense, initialQuestionId }: { chapterId: StudyTarget; mode: StudyMode; expectedLicense?: string; initialQuestionId?: number }) {
  const licenseClass = useLearnerSession((state) => state.session?.profile.selectedLicenseClass);
  if (!licenseClass || (expectedLicense && licenseClass !== expectedLicense)) return <View className="flex-1 justify-center bg-white px-6">
    <Text className="text-lg font-semibold text-gray-900">Hạng bằng đã thay đổi. Chọn lại chương để tiếp tục.</Text><BackToChapters wrong={chapterId === 'wrong'} />
  </View>;
  return <ChapterSessionContent chapterId={chapterId} mode={mode} licenseClass={licenseClass} initialQuestionId={initialQuestionId} />;
}

export default function ChapterSessionScreen() {
  const params = useLocalSearchParams<{ chapterId: string; mode?: string; licenseClass?: string; questionId?: string }>();
  const chapterId: StudyTarget = params.chapterId === 'all' || params.chapterId === 'critical' || params.chapterId === 'wrong' ? params.chapterId : Number(params.chapterId);
  const initialQuestionId = params.questionId === undefined ? undefined : Number(params.questionId);
  const mode = params.mode ?? 'learn';
  const valid = typeof params.chapterId === 'string' && (chapterId === 'all' || chapterId === 'critical' || chapterId === 'wrong' ||
    (/^\d+$/.test(params.chapterId) && Number.isInteger(chapterId) && chapterId >= 1 && chapterId <= 6)) &&
    (mode === 'learn' || mode === 'review') &&
    (params.licenseClass === undefined || typeof params.licenseClass === 'string') &&
    (params.questionId === undefined || (typeof params.questionId === 'string' && /^\d+$/.test(params.questionId) &&
      Number.isSafeInteger(initialQuestionId) && initialQuestionId! > 0));
  return <StudyAccess>{valid ? <LicensedSession chapterId={chapterId} mode={mode as StudyMode} expectedLicense={params.licenseClass} initialQuestionId={initialQuestionId} /> :
    <View className="flex-1 justify-center bg-white px-6"><Text className="text-lg text-gray-900">Đường dẫn học theo chương chưa hợp lệ.</Text><BackToChapters wrong={chapterId === 'wrong'} /></View>}
  </StudyAccess>;
}
