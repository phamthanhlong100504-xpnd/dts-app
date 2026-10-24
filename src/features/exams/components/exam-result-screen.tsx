import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLearnerSession } from '../../session/session-store';
import { useLearnerResource } from '../../session/use-learner-resource';
import { StudyAccess } from '../../session/components/study-access';
import { QuestionImage } from '../../chapter-learning/components/question-image';
import { splitExplanationParagraphs } from '../../chapter-learning/components/chapter-question-content';
import { AppButton, Message } from '../../shared/ui';
import { getExamLobby, getExamResult, retryExam, type ExamResult } from '../exam-service';
import { clock } from '../exam-format';
import { ExamIcon, QuestionGrid, Sheet, TextAction } from './exam-ui';

export function ResultSummary({ data, title, onReview, onRetry, onHome, busy, retryDisabled }: { data: ExamResult; title: string; onReview: () => void; onRetry: () => void; onHome: () => void; busy: boolean; retryDisabled: boolean }) {
  const color = data.passed ? '#199B55' : '#E54859';
  return <>
    <View style={{ alignItems: 'center', paddingTop: 20, marginBottom: 24 }}>
      <View style={{ width: 116, height: 116, borderRadius: 58, backgroundColor: data.passed ? '#DFF5E7' : '#FFE5E8', alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 94, height: 94, borderRadius: 47, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}><ExamIcon name={data.passed ? 'check' : 'wrong'} size={62} color="#FFFFFF" /></View></View>
      <View style={{ minWidth: 138, marginTop: -13, borderRadius: 7, backgroundColor: color, paddingHorizontal: 20, paddingVertical: 7 }}><Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' }}>{data.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}</Text></View>
      <Text style={{ fontSize: 20, fontWeight: '600', color, textAlign: 'center', marginTop: 22 }}>{data.passed ? 'Chúc mừng bạn!' : 'Bạn chưa đạt bài thi!'}</Text>
      <Text style={{ fontSize: 15, lineHeight: 23, color: '#4B5563', textAlign: 'center', marginTop: 8 }}>{data.passed ? 'Tiếp tục ôn luyện để giữ vững kiến thức nhé!' : 'Xem lại đáp án và tiếp tục ôn luyện để cải thiện kết quả nhé!'}</Text>
      <Text style={{ fontSize: 15, lineHeight: 23, color: '#374151', textAlign: 'center', marginTop: 12 }}>{title}</Text>
      <Text style={{ fontSize: 22, lineHeight: 30, fontWeight: '700', color: '#172338', marginTop: 6 }}>{data.correct}/{data.total}</Text>
    </View>
    <View style={{ backgroundColor: '#F0F2F5', borderRadius: 16, paddingHorizontal: 18, marginBottom: 30 }}>
      {[
        { label: 'Số câu đúng', value: String(data.correct), color: '#199B55', icon: 'check' },
        { label: 'Số câu sai', value: String(data.wrong), color: '#E54859', icon: 'wrong' },
        { label: 'Chưa trả lời', value: String(data.unanswered), color: '#64748B', icon: 'list' },
        { label: 'Thời gian làm bài', value: clock(data.elapsedTimeMs ?? null), color: '#0877F9', icon: 'clock' },
        { label: 'Tổng số câu', value: String(data.total), color: '#172338', icon: 'list' },
      ].map((row) => <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 }}><ExamIcon name={row.icon} color={row.color} size={20} /><Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: '#253247' }}>{row.label}</Text><Text style={{ fontSize: 17, fontWeight: '600', color: row.color }}>{row.value}</Text></View>)}
    </View>
    <View style={{ gap: 12 }}><AppButton label="Xem lại đáp án" onPress={onReview} disabled={busy} /><AppButton secondary label="Làm lại bài thi" onPress={onRetry} busy={busy} disabled={retryDisabled} /><AppButton label="Về trang chủ" onPress={onHome} disabled={busy} /></View>
  </>;
}
function ResultContent({ id, title, presetId }: { id: string; title?: string; presetId?: string }) {
  const license = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  const loader = useCallback(() => getExamResult(id, license), [id, license]);
  const { data, loading, error, reload } = useLearnerResource('exam-result:' + id, loader), insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false), [retryError, setRetryError] = useState<string | null>(null), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const displayTitle = title || `Bài thi hạng ${license}`;
  const routeParams = { examId: id, title: displayTitle, ...(presetId ? { presetId } : {}) };
  async function retry() {
    if (lock.current || !data || uncertain) return; lock.current = true; setBusy(true); setRetryError(null);
    try {
      const session = await retryExam(data, () => { if (!alive.current) throw new Error('Màn hình đã đóng.'); });
      if (alive.current) router.replace({ pathname: '/practice/exam/[examId]', params: { ...routeParams, examId: session.examId } });
    } catch (failure) { if (alive.current) { setRetryError(failure instanceof Error ? failure.message : 'Chưa xác nhận được bài làm lại.'); setUncertain(true); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function recoverRetry() {
    if (lock.current) return; lock.current = true; setBusy(true);
    try {
      const lobby = await getExamLobby(license, true); if (!alive.current) return;
      if (lobby.active) router.replace({ pathname: '/practice/exam/[examId]', params: { examId: lobby.active.examId, title: lobby.active.title, ...(lobby.active.presetId ? { presetId: lobby.active.presetId } : {}) } });
      else { setRetryError(null); setUncertain(false); }
    } catch (failure) { if (alive.current) setRetryError(failure instanceof Error ? failure.message : 'Không đọc được bài đang dở.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <><Stack.Screen options={{ title: 'Kết quả bài thi', headerShown: true, headerTitleAlign: 'center', headerBackVisible: false, gestureEnabled: false }} />
    <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      {loading && <ActivityIndicator color="#0877F9" />}{error && <><Message>{error}</Message><AppButton secondary label="Thử lại" onPress={reload} /></>}
      {retryError && <><Message>{retryError}</Message><AppButton secondary label="Kiểm tra bài đang dở" busy={busy} onPress={() => { void recoverRetry(); }} /></>}
      {data && <ResultSummary data={data} title={displayTitle} busy={busy} retryDisabled={uncertain} onReview={() => router.push({ pathname: '/practice/result/[examId]/review', params: routeParams })} onRetry={() => { void retry(); }} onHome={() => router.dismissTo('/home')} />}
    </ScrollView></>;
}
export function ResultQuestion({ question, position, data }: { question: ExamResult['questions'][number]; position: number; data: ExamResult }) {
  return <>
    <Text style={{ fontSize: 18, lineHeight: 27, fontWeight: '600', color: '#111827', marginBottom: 18 }}>Câu {position}/{data.total}: {question.text}</Text>
    <QuestionImage question={question} scope={data.scope} />
    {question.choices.map((choice) => { const correct = choice.key === question.referenceAnswer, wrong = choice.key === question.selectedAnswer && !question.isCorrect;
      return <View key={choice.key} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, borderWidth: 1, borderColor: correct ? '#16A34A' : wrong ? '#EF4444' : 'transparent', backgroundColor: correct ? '#DCFCE7' : wrong ? '#FEE2E2' : '#F3F4F6', borderRadius: 12, padding: 14, marginBottom: 12 }}><Text style={{ fontSize: 18, lineHeight: 27, fontWeight: '600', color: '#111827', marginRight: 12 }}>{choice.key}.</Text><Text style={{ flex: 1, fontSize: 18, lineHeight: 27, color: '#111827' }}>{choice.text}</Text></View>;
    })}
    <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#DBEAFE', padding: 16, borderRadius: 12, marginTop: 6 }}><Text style={{ fontSize: 18, lineHeight: 27, color: '#111827', fontWeight: '600' }}>Đáp án đúng: {question.referenceAnswer}</Text><Text style={{ fontSize: 18, lineHeight: 27, color: '#111827', fontWeight: '600', marginTop: 12 }}>Giải thích</Text>{splitExplanationParagraphs(question.explanation || 'Chưa có giải thích cho câu này.').map((paragraph, i) => <Text key={i} style={{ fontSize: 18, lineHeight: 27, color: '#374151', marginTop: i === 0 ? 4 : 10 }}>{paragraph}</Text>)}</View>
  </>;
}
function ReviewContent({ id }: { id: string }) {
  const license = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  const loader = useCallback(() => getExamResult(id, license), [id, license]);
  const { data, loading, error, reload } = useLearnerResource('exam-review:' + id, loader), insets = useSafeAreaInsets();
  const [questionId, setQuestionId] = useState<number | null>(null);
  const index = data?.questions.findIndex((q) => q.id === questionId) ?? -1, question = data?.questions[index];
  return <><Stack.Screen options={{ title: 'Xem lại đáp án', headerShown: true, headerTitleAlign: 'center' }} />
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
        {loading && <ActivityIndicator color="#0877F9" />}{error && <><Message>{error}</Message><AppButton secondary label="Thử lại" onPress={reload} /></>}
        {data && <><QuestionGrid items={data.questions.map((q) => ({ id: q.id, color: q.isCorrect ? '#24A267' : q.selectedAnswer ? '#E35D68' : '#F3F4F6', label: q.isCorrect ? 'đúng' : q.selectedAnswer ? 'sai' : 'chưa trả lời' }))} onSelect={setQuestionId} /></>}
      </ScrollView>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) }}><AppButton label="Về trang chủ" onPress={() => router.dismissTo('/home')} /></View>
    </View>
    <Sheet visible={!!question} title="Xem lại câu hỏi" close={() => setQuestionId(null)}>
      {data && question && <><ResultQuestion question={question} position={index + 1} data={data} /><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}><TextAction label="Câu trước" icon="left" disabled={index <= 0} onPress={() => setQuestionId(data.questions[index - 1].id)} /><TextAction label="Câu tiếp" icon="right" disabled={index === data.questions.length - 1} onPress={() => setQuestionId(data.questions[index + 1].id)} /></View></>}
    </Sheet>
  </>;
}
export function ExamReviewScreen() { const { examId: id } = useLocalSearchParams<{ examId: string }>(); return <StudyAccess><ReviewContent id={id} /></StudyAccess>; }
export default function ExamResultScreen() { const params = useLocalSearchParams<{ examId: string; title?: string; presetId?: string }>(); return <StudyAccess><ResultContent id={params.examId} title={typeof params.title === 'string' ? params.title.slice(0, 100) : undefined} presetId={typeof params.presetId === 'string' ? params.presetId : undefined} /></StudyAccess>; }
