import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudyAccess } from '../../session/components/study-access';
import { useLearnerSession } from '../../session/session-store';
import { useLearnerResource } from '../../session/use-learner-resource';
import { AppButton, Message } from '../../shared/ui';
import { getExamLobby, getExamSetup, getExamSession, pauseOrResumeExam, startExam, type ActiveExam, type ExamMode, type Preset } from '../exam-service';
import { clock, modeLabel } from '../exam-format';
import { ExamIcon } from './exam-ui';

function openSession(id: string, title: string, presetId?: string | null) {
  router.push({ pathname: '/practice/exam/[examId]', params: { examId: id, title, ...(presetId ? { presetId } : {}) } });
}
export function ActiveAttemptCard({ active, onContinue }: { active: ActiveExam; onContinue?: () => void }) {
  return <View style={{ padding: 18, borderRadius: 16, backgroundColor: '#FFF6E5', borderWidth: 1, borderColor: '#F2E4C7', marginBottom: 26, gap: 10 }}>
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ExamIcon name="pause" color="#9A670C" /><Text style={{ fontSize: 17, fontWeight: '600', color: '#80530B' }}>{active.status === 'PAUSED' ? 'Đang tạm dừng' : 'Bài đang làm'}</Text></View>
    <Text style={{ fontSize: 17, lineHeight: 25, color: '#111827', fontWeight: '600' }}>{active.title}</Text>
    <Text style={{ fontSize: 14, lineHeight: 21, color: '#5C4F35' }}>{modeLabel(active.mode)}</Text>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Text style={{ fontSize: 15, color: '#374151' }}>Đang ở câu {active.currentPosition}/{active.totalQuestions}</Text><Text style={{ fontSize: 15, color: '#80530B', fontWeight: '600' }}>{clock(active.remainingTimeMs)}</Text></View>
    <View style={{ height: 7, borderRadius: 4, backgroundColor: '#E8DFCF', overflow: 'hidden' }}><View style={{ height: '100%', width: `${active.answeredCount * 100 / active.totalQuestions}%`, backgroundColor: '#0877F9' }} /></View>
    <Text style={{ fontSize: 14, color: '#5C4F35' }}>Đã trả lời {active.answeredCount}/{active.totalQuestions} câu</Text>
    {onContinue && <View style={{ alignSelf: 'center' }}><AppButton label="Tiếp tục" onPress={onContinue} /></View>}
  </View>;
}
export function ModeChoices({ value, disabled, onChange }: { value: ExamMode; disabled: boolean; onChange: (mode: ExamMode) => void }) {
  return <View style={{ gap: 12 }}>
    {([{ mode: 'EXAM', title: 'Chấm điểm sau khi nộp bài', description: 'Giống bài thi sát hạch' }, { mode: 'PRACTICE', title: 'Chấm điểm từng câu', description: 'Nhấn Kiểm tra để xem đáp án và giải thích' }] as const).map((item) => {
      const selected = value === item.mode;
      return <Pressable key={item.mode} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={() => onChange(item.mode)}
        style={{ borderWidth: selected ? 2 : 1, borderColor: selected ? '#0877F9' : '#DDE2E8', backgroundColor: selected ? '#EDF5FF' : '#F8F9FB', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}><Text style={{ fontSize: 17, lineHeight: 25, fontWeight: '600', color: disabled && !selected ? '#8B929C' : '#172338' }}>{item.title}</Text><Text style={{ fontSize: 14, lineHeight: 21, color: '#647083', marginTop: 5 }}>{item.description}</Text></View>
        <View style={{ width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: selected ? '#0877F9' : '#AAB3C0', alignItems: 'center', justifyContent: 'center' }}>{selected && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: '#0877F9' }} />}</View>
      </Pressable>;
    })}
  </View>;
}
function InformationContent({ presetId }: { presetId?: string }) {
  const license = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  const loader = useCallback(() => getExamSetup(license, presetId), [license, presetId]);
  const { data, error: loadError, loading, reload } = useLearnerResource('exam-setup:' + (presetId ?? 'random'), loader);
  const [mode, setMode] = useState<ExamMode>('EXAM'), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), alive = useRef(true), insets = useSafeAreaInsets();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const title = data?.preset?.title ?? (presetId ? 'Thông tin bộ đề' : `Đề ngẫu nhiên hạng ${license}`);
  const activeHere = !!data?.active && (presetId ? data.active.presetId === presetId : !data.active.presetId);
  const selectedMode = activeHere ? data!.active!.mode : mode;
  function refresh() { setError(null); setUncertain(false); reload(); }
  async function begin(resume = false) {
    if (lock.current || !data || uncertain) return;
    lock.current = true; setBusy(true); setError(null);
    const ensureCurrent = () => { if (!alive.current) throw new Error('Màn hình đã đóng.'); };
    try {
      if (resume && data.active) {
        let session = await getExamSession(data.active.examId, license); ensureCurrent();
        if (session.status === 'PAUSED') { session = await pauseOrResumeExam(session); ensureCurrent(); }
        if (session.status === 'COMPLETED' || session.status === 'TIMEOUT') router.push({ pathname: '/practice/result/[examId]', params: { examId: session.examId, title: data.active.title } });
        else openSession(session.examId, data.active.title, data.active.presetId);
      } else {
        if (data.active) return;
        const session = await startExam(license, selectedMode, presetId, ensureCurrent); ensureCurrent();
        openSession(session.examId, title, presetId);
      }
    } catch (failure) { if (alive.current) { setUncertain(true); setError((failure instanceof Error ? failure.message : 'Chưa xác nhận được thao tác.') + ' Đọc lại trạng thái trước khi thử tiếp.'); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  return <>
    <Stack.Screen options={{ title, headerShown: true, headerTitleAlign: 'center', headerTitleStyle: { fontSize: 18, fontWeight: '600' } }} />
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
        {loading && <ActivityIndicator color="#0877F9" />}
        {(loadError || error) && <><Message>{loadError || error}</Message><AppButton secondary label="Đọc lại trạng thái" disabled={busy} onPress={refresh} /></>}
        {data && <>
          {data.active && <ActiveAttemptCard active={data.active} onContinue={!activeHere ? () => { void begin(true); } : undefined} />}
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#536174', marginBottom: 12 }}>THÔNG TIN</Text>
          <View style={{ borderRadius: 16, backgroundColor: '#F3F4F6', paddingHorizontal: 16, marginBottom: 28 }}>
            {[
              ['Số lượng câu hỏi', `${data.preset?.totalQuestions ?? data.config.totalQuestions} CÂU`],
              ['Thời gian làm bài', `${data.preset ? data.preset.durationSeconds / 60 : data.config.durationMinutes} PHÚT`],
              ['Điểm đạt tối thiểu', `${data.config.passingScore} ĐIỂM`],
              ['Số câu điểm liệt (sai là trượt)', `${data.config.criticalQuestionCount} CÂU`],
            ].map(([label, value], index) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, borderBottomWidth: index === 3 ? 0 : 1, borderBottomColor: '#DEE2E8' }}><Text style={{ flex: 1, fontSize: 16, lineHeight: 24, color: '#253247' }}>{label}</Text><Text style={{ fontSize: 17, lineHeight: 25, color: '#1264C0', fontWeight: '700' }}>{value}</Text></View>)}
          </View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#536174', marginBottom: 12 }}>CHẾ ĐỘ CHẤM ĐIỂM</Text>
          <ModeChoices value={selectedMode} disabled={busy || activeHere} onChange={setMode} />
        </>}
      </ScrollView>
      <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: '#EEF0F4' }}>
        <AppButton label={activeHere ? 'TIẾP TỤC LÀM BÀI' : 'BẮT ĐẦU THI'} busy={busy} disabled={!data || loading || uncertain || (!!data.active && !activeHere)} onPress={() => { void begin(activeHere); }} />
      </View>
    </View>
  </>;
}
function PresetListContent() {
  const license = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  const loader = useCallback(() => getExamLobby(license, true), [license]);
  const { data, error, loading, reload } = useLearnerResource('preset-list', loader), insets = useSafeAreaInsets();
  const palettes: Record<string, { bg: string; status: string }> = { PASSED: { bg: '#DCF5E6', status: 'Đã đạt' }, FAILED: { bg: '#FDE6E8', status: 'Chưa đạt' }, IN_PROGRESS: { bg: '#E5F0FF', status: 'Đang làm' }, NOT_STARTED: { bg: '#F0F2F5', status: 'Chưa làm' } };
  function itemCard(item: Preset) { const palette = palettes[item.userStatus]; return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}, ${palette.status}`} onPress={() => router.push({ pathname: '/preset-exams/[presetId]', params: { presetId: item.id } })}
    style={{ flex: 1, minWidth: 0, minHeight: 116, borderRadius: 15, paddingHorizontal: 8, paddingVertical: 18, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: 16, lineHeight: 23, textAlign: 'center', fontWeight: '600', color: '#172338' }}>{item.title}</Text>
  </Pressable>; }
  return <><Stack.Screen options={{ title: `Đề thi hạng ${license}`, headerShown: true, headerTitleAlign: 'center' }} />
    <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      {loading && <ActivityIndicator color="#0877F9" />}{error && <><Message>{error}</Message><AppButton secondary label="Thử lại" onPress={reload} /></>}
      {data?.active && <ActiveAttemptCard active={data.active} onContinue={() => openSession(data.active!.examId, data.active!.title, data.active!.presetId)} />}
      {data && data.items.length === 0 && <Text style={{ fontSize: 16, lineHeight: 25, color: '#4B5563' }}>Hạng này chưa có bộ đề được phát hành.</Text>}
      {data && Array.from({ length: Math.ceil(data.items.length / 3) }, (_, row) => <View key={row} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>{Array.from({ length: 3 }, (_, col) => data.items[row * 3 + col] ? itemCard(data.items[row * 3 + col]) : <View key={`empty-${col}`} style={{ flex: 1 }} />)}</View>)}
    </ScrollView></>;
}
export function PresetExamInformationScreen() { const { presetId } = useLocalSearchParams<{ presetId: string }>(); return <StudyAccess><InformationContent presetId={presetId} /></StudyAccess>; }
export default function ExamLobbyScreen({ presets = false }: { presets?: boolean }) { return <StudyAccess>{presets ? <PresetListContent /> : <InformationContent />}</StudyAccess>; }
