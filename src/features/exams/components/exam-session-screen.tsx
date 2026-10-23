import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLearnerSession } from '../../session/session-store';
import { StudyAccess } from '../../session/components/study-access';
import { QuestionImage } from '../../chapter-learning/components/question-image';
import { splitExplanationParagraphs } from '../../chapter-learning/components/chapter-question-content';
import { AppButton, Message } from '../../shared/ui';
import { useExamSession } from '../use-exam-session';
import { clock } from '../exam-format';
import { ExamIcon, QuestionGrid, Sheet, TextAction } from './exam-ui';
import type { ExamSession } from '../exam-service';

export function answerColor(data: ExamSession, id: number) {
  if (data.mode === 'PRACTICE' && data.feedback[String(id)]) return data.feedback[String(id)].isCorrect ? '#24A267' : '#E35D68';
  return data.answers[String(id)] ? '#0877F9' : '#F3F4F6';
}
export function ExamQuestion({ data, selected, locked, onSelect }: { data: ExamSession; selected: string | null; locked: boolean; onSelect: (answer: string) => void }) {
  const index = data.questions.findIndex((q) => q.id === data.currentQuestionId), question = data.questions[index];
  const savedFeedback = data.mode === 'PRACTICE' ? data.feedback[String(question.id)] : null;
  const feedback = savedFeedback?.selectedAnswer === selected ? savedFeedback : null;
  return <>
    {data.mode === 'PRACTICE' && question.isCritical && <Text style={{ fontSize: 14, color: '#9A670C', marginBottom: 10 }}>Câu điểm liệt</Text>}
    <Text style={{ fontSize: 18, lineHeight: 27, fontWeight: '600', color: '#111827', marginBottom: 18 }}>Câu {index + 1}/{data.totalQuestions}: {question.text}</Text>
    <QuestionImage question={question} scope={data.scope} />
    {question.choices.map((choice) => {
      const correct = feedback?.correctAnswer === choice.key, wrong = !!feedback && feedback.selectedAnswer === choice.key && !feedback.isCorrect;
      return <Pressable key={choice.key} accessibilityRole="button" accessibilityLabel={`Chọn đáp án ${choice.key}`} accessibilityState={{ selected: selected === choice.key, disabled: locked }} disabled={locked} onPress={() => onSelect(choice.key)}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1,
          backgroundColor: correct ? '#DCFCE7' : wrong ? '#FEE2E2' : selected === choice.key ? '#EFF6FF' : '#F3F4F6', borderColor: correct ? '#16A34A' : wrong ? '#EF4444' : selected === choice.key ? '#0877F9' : 'transparent' }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', marginRight: 12 }}><Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>{choice.key}</Text></View>
        <Text style={{ flex: 1, fontSize: 18, lineHeight: 27, color: '#111827' }}>{choice.text}</Text>
      </Pressable>;
    })}
    {feedback && <View style={{ padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: '#EFF6FF', marginTop: 8 }}>
      <Text style={{ fontSize: 18, lineHeight: 27, fontWeight: '600', color: '#111827' }}>Đáp án đúng: {feedback.correctAnswer}</Text>
      <Text style={{ fontSize: 18, lineHeight: 27, fontWeight: '600', color: '#111827', marginTop: 12 }}>Giải thích</Text>
      {splitExplanationParagraphs(feedback.explanation || 'Chưa có giải thích cho câu này.').map((paragraph, i) => <Text key={i} style={{ fontSize: 18, lineHeight: 27, color: '#374151', marginTop: i === 0 ? 4 : 10 }}>{paragraph}</Text>)}
    </View>}
  </>;
}
function ExamContent({ id, title, presetId }: { id: string; title?: string; presetId?: string }) {
  const license = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  const { state, model } = useExamSession(id, license), { data } = state;
  const [exitOpen, setExitOpen] = useState(false), [navigator, setNavigator] = useState(false), [now, setNow] = useState(() => Date.now());
  const insets = useSafeAreaInsets(), scroll = useRef<ScrollView>(null), strip = useRef<ScrollView>(null), expiredRead = useRef<number | null>(null);
  const index = data?.questions.findIndex((q) => q.id === data.currentQuestionId) ?? -1;
  const displayTitle = title || `Bài thi hạng ${license}`;
  const locked = state.busy || state.loading || state.needsReload;
  const remaining = data?.remainingTimeMs == null ? null : Math.max(0, data.remainingTimeMs - (data.status === 'IN_PROGRESS' ? now - data.observedAt : 0));
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useFocusEffect(useCallback(() => { const subscription = BackHandler.addEventListener('hardwareBackPress', () => { setExitOpen(true); return true; }); return () => subscription.remove(); }, []));
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); strip.current?.scrollTo({ x: Math.max(0, (index - 3) * 38), animated: true }); }, [data?.currentQuestionId, index]);
  useEffect(() => { if (data && ['COMPLETED', 'TIMEOUT'].includes(data.status)) router.replace({ pathname: '/practice/result/[examId]', params: { examId: id, title: displayTitle, ...(presetId ? { presetId } : {}) } }); }, [data, id, displayTitle, presetId]);
  useEffect(() => { if (data?.status === 'IN_PROGRESS' && remaining === 0 && !locked && expiredRead.current !== data.observedAt) { expiredRead.current = data.observedAt; void model.load(); } }, [remaining, data, locked, model]);
  async function pauseAndLeave() {
    const next = await model.pauseAndExit();
    if (!next || next.status === 'COMPLETED' || next.status === 'TIMEOUT') return;
    if (presetId) router.dismissTo({ pathname: '/preset-exams/[presetId]', params: { presetId } });
    else router.dismissTo('/exams');
  }
  const feedback = data?.mode === 'PRACTICE' ? data.feedback[String(data.currentQuestionId)] : null;
  const checked = !!feedback && feedback.selectedAnswer === state.selectedAnswer;
  const canNext = data?.mode === 'EXAM' || checked;
  const nextQuestion = data?.questions[index + 1];
  return <><Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ minWidth: 82 }}><Text style={{ fontSize: 11, color: '#536174', marginBottom: 2 }}>Còn lại</Text><Text style={{ fontSize: 16, color: remaining !== null && remaining < 60000 ? '#C23D4B' : '#0877F9', fontWeight: '700' }}>{clock(remaining)}</Text></View>
        <Text numberOfLines={2} style={{ flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#111827', textAlign: 'center' }}>{displayTitle}</Text>
        <TextAction label="Nộp bài" icon="submit" disabled={!data || locked} onPress={() => setExitOpen(true)} color="#0877F9" />
      </View>
      {data && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF0F4', paddingHorizontal: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Câu trước" disabled={locked || index <= 0 || data.status !== 'IN_PROGRESS'} onPress={() => { void model.move(data.questions[index - 1].id); }} style={{ width: 30, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: index <= 0 ? 0.35 : 1 }}><ExamIcon name="left" size={17} color="#374151" /></Pressable>
        <ScrollView horizontal ref={strip} showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
          {data.questions.map((q, i) => { const color = answerColor(data, q.id); return <Pressable key={q.id} accessibilityRole="button" accessibilityLabel={`Câu ${i + 1}`} accessibilityState={{ selected: q.id === data.currentQuestionId, disabled: locked }} disabled={locked || data.status !== 'IN_PROGRESS'} onPress={() => { void model.move(q.id); }}
            style={{ width: 32, height: 34, borderRadius: 8, borderWidth: q.id === data.currentQuestionId ? 2 : 1, borderColor: q.id === data.currentQuestionId ? '#0877F9' : color, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14, color: color === '#F3F4F6' ? '#374151' : '#FFFFFF', fontWeight: '600' }}>{i + 1}</Text></Pressable>; })}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Chọn câu hỏi" disabled={locked} onPress={() => setNavigator(true)} style={{ width: 34, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><ExamIcon name="list" size={19} /></Pressable>
      </View>}
      {state.loading && <ActivityIndicator color="#0877F9" style={{ marginTop: 24 }} />}
      {state.error && <View style={{ padding: 16 }}><Message>{state.error}</Message><AppButton secondary disabled={state.busy} label="Đọc lại bài làm" onPress={() => { void model.load(); }} /></View>}
      {data?.status === 'PAUSED' ? <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 18 }}><Text style={{ fontSize: 22, fontWeight: '600', color: '#80530B', textAlign: 'center' }}>Đang tạm dừng</Text><Text style={{ fontSize: 16, lineHeight: 25, textAlign: 'center', color: '#4B5563' }}>Đã lưu {Object.keys(data.answers).length}/{data.totalQuestions} câu. Thời gian còn lại {clock(data.remainingTimeMs)}.</Text><View style={{ alignSelf: 'center' }}><AppButton label="Tiếp tục" busy={state.busy} disabled={state.needsReload} onPress={() => { void model.resume(); }} /></View></View> : data && <>
        <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 20 }}>
          <ExamQuestion data={data} selected={state.selectedAnswer} locked={locked || data.status !== 'IN_PROGRESS'} onSelect={(answer) => { void model.select(answer); }} />
          {data.mode === 'PRACTICE' && !checked && <View style={{ alignItems: 'flex-end' }}><TextAction label="Bỏ qua" disabled={locked} onPress={() => { if (nextQuestion) void model.move(nextQuestion.id); else setExitOpen(true); }} /></View>}
        </ScrollView>
        <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 10), borderTopWidth: 1, borderTopColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TextAction label="Câu trước" icon="left" disabled={locked || index <= 0} onPress={() => { void model.move(data.questions[index - 1].id); }} />
          {state.busy && <ActivityIndicator color="#0877F9" accessibilityLabel={data.mode === 'EXAM' ? 'Đang lưu đáp án' : 'Đang xử lý'} />}
          <TextAction label={canNext ? nextQuestion ? 'Câu tiếp' : 'Nộp bài' : 'Kiểm tra'} icon={canNext ? nextQuestion ? 'right' : 'submit' : 'check'} color={canNext ? '#111827' : '#16A34A'} disabled={locked || (!canNext && !state.selectedAnswer)} onPress={() => { if (!canNext) void model.check(); else if (nextQuestion) void model.move(nextQuestion.id); else setExitOpen(true); }} />
        </View>
      </>}
    </SafeAreaView>
    <Sheet visible={exitOpen} title="Kết thúc bài thi?" close={() => { if (!state.busy) setExitOpen(false); }}>
      <View style={{ gap: 12 }}>
        <Text style={{ fontSize: 15, color: '#4B5563', lineHeight: 23, textAlign: 'center', marginBottom: 4 }}>Đã lưu {data ? Object.keys(data.answers).length : 0}/{data?.totalQuestions ?? '—'} câu. Lựa chọn hiện tại sẽ được lưu khi nộp hoặc tạm dừng.</Text>
        <AppButton label="Nộp bài và chấm điểm" busy={state.busy} disabled={locked || data?.status !== 'IN_PROGRESS'} onPress={() => { void model.finish(); }} />
        <AppButton secondary label="Lưu tạm và thoát" disabled={locked} onPress={() => { void pauseAndLeave(); }} />
        <AppButton secondary label="Tiếp tục làm bài" disabled={state.busy} onPress={() => { if (data?.status === 'PAUSED') void model.resume().then((next) => { if (next) setExitOpen(false); }); else setExitOpen(false); }} />
      </View>
    </Sheet>
    <Sheet visible={navigator} title="Chọn câu hỏi" close={() => setNavigator(false)}>
      {data && <QuestionGrid items={data.questions.map((q) => ({ id: q.id, color: answerColor(data, q.id) }))} currentId={data.currentQuestionId} disabled={locked || data.status !== 'IN_PROGRESS'} onSelect={(questionId) => { setNavigator(false); void model.move(questionId); }} />}
    </Sheet>
  </>;
}
export default function ExamSessionScreen() {
  const params = useLocalSearchParams<{ examId: string; title?: string; presetId?: string }>();
  return <StudyAccess><ExamContent id={params.examId} title={typeof params.title === 'string' ? params.title.slice(0, 100) : undefined} presetId={typeof params.presetId === 'string' ? params.presetId : undefined} /></StudyAccess>;
}
