import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLearnerResource } from '../../session/use-learner-resource';
import { AppButton } from '../../shared/ui';
import type { SimulationContext } from '../simulation-context';
import type { ExamCreateRequest, ExamPreparation, ExamSession } from '../domain/simulation-exam-types';
import type { SimulationPresetPreparation } from '../domain/simulation-preset-types';
import { newSimulationEventId } from '../simulation-id';
import { openSimulation, presetPath, sessionPath } from '../simulation-navigation';
import { SimulationExamInformation, SimulationModeCard } from './simulation-exam-sections';
import { SimulationGate, SimulationGlyph, SimulationHeader, SimulationLoading, SimulationNotice, simulationStyles as s } from './simulation-ui';

export function SimulationActiveExam({ context, session, reload }: { context: SimulationContext; session: ExamSession; reload: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null);
  const cancelEvent = useRef<string | null>(null);
  async function cancel() {
    if (busy) return; setBusy(true); setError(null);
    try {
      cancelEvent.current ??= newSimulationEventId();
      const next = await context.exams.command(context.scope, { kind: 'CANCEL', sessionId: session.sessionId, position: session.currentPosition, playbackEventId: null, eventId: cancelEvent.current });
      if (next.status !== 'CANCELLED') throw new Error('Chưa xác nhận hủy bài.');
      reload();
    } catch (failure) { setError(failure); } finally { setBusy(false); }
  }
  return <View style={{ padding: 16, borderRadius: 18, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#D5E5FA', gap: 14 }}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><SimulationGlyph kind="pause" color="#176BD0" size={20} /></View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 17, lineHeight: 25, fontWeight: '600', color: '#123C70' }}>Bài đang làm</Text>
        <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '500', color: '#172338' }}>{session.mode === 'PRESET' ? session.preset.title : 'Thi thử ngẫu nhiên'}</Text>
        <Text style={{ fontSize: 14, lineHeight: 21, color: '#475569' }}>Mô phỏng · Hạng {context.scope.licenseClass}</Text>
      </View>
    </View>
    {session.status === 'READY_TO_SUBMIT' && <Text style={{ alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: '#DFECFF', fontSize: 14, lineHeight: 20, fontWeight: '500', color: '#245D9C' }}>Chờ nộp bài</Text>}
    <View accessibilityRole="progressbar" accessibilityLabel="Tiến độ bài mô phỏng đang làm" accessibilityValue={{ min: 0, max: session.policy.totalScenarios, now: session.completedScenarios }} style={{ height: 5, backgroundColor: '#D8E5F7', borderRadius: 3, overflow: 'hidden' }}><View style={{ height: '100%', width: `${session.completedScenarios * 100 / session.policy.totalScenarios}%`, backgroundColor: '#0877F9' }} /></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Tiếp tục bài đang làm" accessibilityState={{ disabled: busy }} disabled={busy} onPress={() => openSimulation(sessionPath(session.sessionId))}
        style={{ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#0877F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: busy ? 0.55 : 1 }}><Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#FFFFFF' }}>Tiếp tục</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Hủy bài đang làm" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => Alert.alert('Hủy bài thi?', 'Bài này sẽ không có kết quả hoàn thành. Bạn có thể giữ lại để tiếp tục sau.', [
        { text: 'Giữ bài', style: 'cancel' }, { text: 'Hủy bài', style: 'destructive', onPress: () => { void cancel(); } },
      ])} style={{ flex: 1, minWidth: 0, minHeight: 44, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: '#D7E3F2', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: busy ? 0.55 : 1 }}>
        <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '500', color: '#B44954' }}>Hủy bài</Text>
      </Pressable>
    </View>
    {error ? <SimulationNotice error={error} retry={() => { void cancel(); }} /> : null}
  </View>;
}

function Choices({ context }: { context: SimulationContext }) {
  const insets = useSafeAreaInsets();
  const loader = useCallback(() => context.exams.preparation(context.scope), [context]);
  const resource = useLearnerResource('simulation-exam-options', loader);
  return <ScrollView style={s.page} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />}>
    <SimulationHeader title="Thi thử mô phỏng" />
    {resource.data?.activeSession && <SimulationActiveExam context={context} session={resource.data.activeSession} reload={resource.reload} />}
    <SimulationModeCard kind="random" onPress={() => openSimulation('/simulations/exams/random')} />
    <SimulationModeCard kind="preset" onPress={() => openSimulation('/simulations/exams/presets')} />
    {resource.error && <SimulationNotice error={resource.error} retry={resource.reload} />}
  </ScrollView>;
}
function Presets({ context }: { context: SimulationContext }) {
  const insets = useSafeAreaInsets();
  const loader = useCallback(async () => { if (!context.exams.presets) throw new Error('Bộ đề chưa sẵn sàng.'); return context.exams.presets(context.scope); }, [context]);
  const resource = useLearnerResource('simulation-presets', loader), items = resource.data?.items ?? [];
  return <ScrollView style={s.page} contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 24 }} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />}>
    <SimulationHeader title={`Bộ đề mô phỏng hạng ${context.scope.licenseClass}`} />
    {resource.loading && !resource.data && <SimulationLoading />}
    {resource.error && <SimulationNotice error={resource.error} retry={resource.reload} />}
    {resource.data && !items.length && <Text style={s.body}>Chưa có bộ đề mô phỏng để luyện tập.</Text>}
    {Array.from({ length: Math.ceil(items.length / 3) }, (_, row) => <View key={row} style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
      {Array.from({ length: 3 }, (_, col) => {
        const item = items[row * 3 + col];
        if (!item) return <View key={`empty-${col}`} style={{ flex: 1 }} />;
        const bg = item.activeSession ? '#E5F0FF' : item.latestCompleted ? item.latestCompleted.passed ? '#DCF5E6' : '#FDE6E8' : '#F0F2F5';
        return <Pressable key={item.presetSetId} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => openSimulation(presetPath(item.presetSetId), { version: item.presetVersionId })}
          style={{ flex: 1, minWidth: 0, minHeight: 116, borderRadius: 15, paddingHorizontal: 8, paddingVertical: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, lineHeight: 23, fontWeight: '600', color: '#172338', textAlign: 'center' }}>{item.title}</Text>
        </Pressable>;
      })}
    </View>)}
  </ScrollView>;
}
function Preparation({ context, presetId, expectedVersion }: { context: SimulationContext; presetId?: string; expectedVersion?: string }) {
  const insets = useSafeAreaInsets(), alive = useRef(0), starting = useRef(false);
  const intent = useRef<ExamCreateRequest | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(null), [recoveredActive, setRecoveredActive] = useState<ExamSession | null>(null);
  const loader = useCallback(async (): Promise<ExamPreparation | SimulationPresetPreparation> => {
    if (presetId) { if (!context.exams.presetPreparation) throw new Error('Bộ đề chưa sẵn sàng.'); return context.exams.presetPreparation(context.scope, presetId); }
    return context.exams.preparation(context.scope);
  }, [context, presetId]);
  const resource = useLearnerResource('simulation-preparation:' + (presetId ?? 'random'), loader);
  useFocusEffect(useCallback(() => { alive.current++; return () => { alive.current++; }; }, []));
  const data = resource.data;
  const active = data?.activeSession ?? recoveredActive;
  const preset = data && 'preset' in data ? data.preset : undefined;
  const title = preset?.title ?? (presetId ? 'Thông tin bộ đề' : 'Thi thử ngẫu nhiên');
  const versionChanged = !!(expectedVersion && preset && expectedVersion !== preset.presetVersionId);
  const unavailable = !!(data && 'canStart' in data && !data.canStart);
  async function create() {
    if (!data || active || versionChanged || unavailable || starting.current) return;
    starting.current = true; setBusy(true); setError(null); const generation = alive.current;
    try {
      if (!intent.current) intent.current = preset ? { mode: 'PRESET', presetSetId: preset.presetSetId, presetVersionId: preset.presetVersionId, bankVersion: data.bankVersion, idempotencyKey: newSimulationEventId() } :
        { mode: 'RANDOM', bankVersion: data.bankVersion, idempotencyKey: newSimulationEventId() };
      const session = await context.exams.create(context.scope, intent.current);
      if (generation === alive.current) openSimulation(sessionPath(session.sessionId), {}, true);
    } catch (failure) {
      if (generation !== alive.current) return;
      setError(failure);
      try { const current = await context.exams.active?.(context.scope); if (generation === alive.current && current) setRecoveredActive(current); } catch { /* A read error never becomes a fabricated active session. */ }
    } finally { starting.current = false; if (generation === alive.current) setBusy(false); }
  }
  return <View style={s.page}>
    <SimulationHeader title={title} />
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />}>
      {resource.loading && !data && <SimulationLoading />}
      {resource.error && <SimulationNotice error={resource.error} retry={resource.reload} />}
      {data && <>
        <SimulationExamInformation totalScenarios={data.policy.totalScenarios} maxScore={data.policy.maxTotalScore} passingScore={data.policy.passingScore} />
        {versionChanged && <Text style={[s.body, { color: '#9A670C', marginTop: 16 }]}>Bộ đề vừa được cập nhật. Hãy quay lại danh sách để chọn phiên bản đang được công bố.</Text>}
        {error ? <View style={{ marginTop: 16 }}><SimulationNotice error={error} /></View> : null}
      </>}
    </ScrollView>
    <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderTopColor: '#EEF0F4' }}>
      {active ? <AppButton label="Về sảnh Thi thử" onPress={() => openSimulation('/simulations/exams', {}, true)} /> :
        <AppButton label={error ? 'THỬ BẮT ĐẦU LẠI' : 'BẮT ĐẦU THI'} busy={busy} disabled={!data || resource.loading || versionChanged || unavailable} onPress={() => { void create(); }} />}
    </View>
  </View>;
}
export function SimulationExamChoicesScreen() { return <SimulationGate title="Thi thử mô phỏng">{context => <Choices context={context} />}</SimulationGate>; }
export function SimulationPresetListScreen() { return <SimulationGate title="Bộ đề mô phỏng">{context => <Presets context={context} />}</SimulationGate>; }
export function SimulationRandomPreparationScreen() { return <SimulationGate title="Thi thử ngẫu nhiên">{context => <Preparation context={context} />}</SimulationGate>; }
export function SimulationPresetPreparationScreen() {
  const params = useLocalSearchParams<{ presetSetId: string; version?: string }>();
  return <SimulationGate title="Thông tin bộ đề">{context => <Preparation context={context} presetId={params.presetSetId} expectedVersion={params.version} />}</SimulationGate>;
}
