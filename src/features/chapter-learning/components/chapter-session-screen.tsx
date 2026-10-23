import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudyAccess } from '../../session/components/study-access';
import { SymbolView } from 'expo-symbols';
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
    headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Chọn câu hỏi" disabled={state.loading || state.busy || state.needsReload || !data}
      accessibilityState={{ expanded: navigatorOpen }} onPress={() => setNavigatorOpen(true)} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: state.busy || state.needsReload ? 0.4 : 1 }}>
      <SymbolView name={{ ios: 'square.grid.3x3.fill', android: 'grid_view', web: 'grid_view' }} size={23} tintColor="#0877F9" />
    </Pressable> }} />;

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

  const studyMode = data.mode;
  const question = data.questions.find((item) => item.id === data.currentQuestionId)!;
  const position = data.questions.findIndex((item) => item.id === question.id);
  const grade = state.editing ? undefined : data.answers[question.id];
  const answers = Object.values(data.answers);
  const correct = answers.filter((answer) => answer.isCorrect).length;
  const learnedCount = data.learnedQuestionIds?.length ?? answers.length;
  const locked = state.busy || state.needsReload;
  const readOnly = data.status === 'COMPLETED' && (studyMode === 'review' || data.collection === 'critical');
  const canNavigate = !!grade || readOnly;
  const nextId = data.questions[position + 1]?.id;
  const unanswered = data.questions.find((item) => !data.answers[item.id] && !data.learnedQuestionIds?.includes(item.id));
  const canSkip = studyMode === 'learn' || !!nextId || (!!unanswered && unanswered.id !== question.id);
  async function next() {
    if (nextId) await model.move(nextId);
    else if (studyMode === 'review' && unanswered && !readOnly) await model.move(unanswered.id);
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
    <Text className="text-center text-2xl font-bold text-gray-900">{data.collection === 'wrong' ? 'Đã kết thúc lượt ôn câu sai' : studyMode === 'review' ? 'Đã hoàn thành vòng ôn tập' : 'Đã lưu tiến độ chương'}</Text>
    <Text className="mt-3 text-center text-lg text-gray-700">Đã trả lời {learnedCount}/{data.questions.length} câu</Text>
    <Text className="mt-2 text-center text-lg text-gray-700">Đúng {correct} · Sai {answers.length - correct} · Còn {data.questions.length - learnedCount}</Text>
    <Text className="mt-3 text-center text-base text-gray-600">{studyMode === 'review'
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
          style={{ minHeight: 44, maxWidth: '46%', flexDirection: 'row', gap: 5,
            alignItems: 'center', justifyContent: 'center',
            opacity: locked || position === 0 ? 0.4 : 1 }}
          onPress={() => { void model.move(data.questions[position - 1].id); }}>
          <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={16} tintColor="#111827" />
          <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#111827' }}>Câu trước</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={locked || (!canNavigate && !state.selectedAnswer)}
          accessibilityState={{ disabled: locked || (!canNavigate && !state.selectedAnswer) }} hitSlop={{ top: 2, bottom: 2 }}
          style={{ minHeight: 44, maxWidth: '46%', flexDirection: 'row', gap: 5,
            alignItems: 'center', justifyContent: 'center',
            opacity: locked || (!canNavigate && !state.selectedAnswer) ? 0.45 : 1 }}
          onPress={() => { if (canNavigate) void next(); else void model.submit(); }}>
          {state.busy ? <ActivityIndicator color="#0877F9" /> : <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: canNavigate ? '#111827' : '#16A34A' }}>
            {canNavigate ? nextId ? 'Câu tiếp' : studyMode === 'review' ? unanswered && !readOnly ? 'Câu tiếp' : 'Kết thúc' : 'Kết thúc' : 'Kiểm tra'}
          </Text>}
          {!state.busy && <SymbolView name={{ ios: canNavigate ? nextId ? 'chevron.right' : 'checkmark' : 'checkmark', android: canNavigate && nextId ? 'chevron_right' : 'check', web: canNavigate && nextId ? 'chevron_right' : 'check' }} size={16} tintColor={canNavigate ? '#111827' : '#16A34A'} />}
        </Pressable>
      </View>
    </View>
    <ChapterQuestionNavigator data={data} open={navigatorOpen} close={() => setNavigatorOpen(false)} disabled={locked}
      onSelect={(id) => { void model.move(id); }} />
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
