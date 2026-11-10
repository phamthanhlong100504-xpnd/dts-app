import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppButton } from '../../shared/ui';
import { BottomSheet } from '../../shared/question-sheet';
import { SimulationExamController } from '../domain/simulation-exam-controller';
import type { SimulationContext } from '../simulation-context';
import { openSimulation, resultPath } from '../simulation-navigation';
import { observeSimulationAutoSubmit } from '../simulation-auto-submit';
import { SimulationVideoPlayer } from './simulation-video-player';
import { SimulationGate, SimulationGlyph, SimulationHeader, SimulationLoading, SimulationNotice, simulationStyles as s } from './simulation-ui';

function Workspace({ context, sessionId }: { context: SimulationContext; sessionId: string }) {
  const insets = useSafeAreaInsets();
  const model = useMemo(() => new SimulationExamController(context.exams, context.scope, sessionId), [context, sessionId]);
  const state = useSyncExternalStore(model.subscribe, model.snapshot);
  const [fullScreen, setFullScreen] = useState(false), [exit, setExit] = useState(false), [error, setError] = useState<unknown>(null);
  useFocusEffect(useCallback(() => {
    model.activate();
    setError(null);
    const submission = observeSimulationAutoSubmit(model, {
      onError: setError,
      onCompleted: id => openSimulation(resultPath(id), {}, true),
    });
    void model.load().then(() => submission.loaded());
    return () => { submission.stop(); model.mediaFault(); model.dispose(); };
  }, [model]));
  const action = useCallback(async (run: () => Promise<unknown>) => { setError(null); try { await run(); } catch (failure) { setError(failure); } }, []);
  const requestExit = useCallback(() => { model.mediaFault(); setExit(true); }, [model]);
  useFocusEffect(useCallback(() => {
    const event = BackHandler.addEventListener('hardwareBackPress', () => { if (fullScreen) setFullScreen(false); else requestExit(); return true; });
    return () => event.remove();
  }, [fullScreen, requestExit]));
  const workspace = state.status === 'ready' ? state.data : null;
  const session = workspace?.session;
  if (state.status === 'loading') return <View style={s.page}><SimulationHeader title="Thi thử mô phỏng" /><SimulationLoading label="Đang tải bài thi..." /></View>;
  if (state.status !== 'ready' || !workspace || !session) return <View style={s.page}><SimulationHeader title="Thi thử mô phỏng" /><View style={s.content}><SimulationNotice error={state.status === 'error' ? state.message : 'Không thể tải phiên thi.'} retry={() => { void model.load(); }} /></View></View>;
  const title = session.mode === 'PRESET' ? session.preset.title : 'Thi thử ngẫu nhiên';
  const expanded = fullScreen && session.status === 'IN_PROGRESS';
  const owner = { position: session.currentPosition, playbackEventId: session.playbackEventId };
  const active = ['playing', 'recorded', 'response-pending', 'response-error'].includes(workspace.phase) && !session.requiresRestart;
  const recovery = ['video-error', 'response-error', 'completion-error', 'submission-error'].includes(workspace.phase);
  const play = workspace.playback ? <SimulationVideoPlayer key={`${session.sessionId}:${owner.position}:${owner.playbackEventId}`}
    videoUrl={workspace.playback.videoUrl} expiresAt={workspace.playback.expiresAt} ownerKey={`${owner.position}:${owner.playbackEventId}`}
    durationMs={workspace.playback.durationMs} startAtMs={workspace.playback.restartAtMs} active={active} startLabel="Bắt đầu tình huống" busy={workspace.busy} responseLocked={workspace.phase === 'response-error'} needsRecovery={recovery} autoStart={workspace.autoStart}
    responseRecorded={session.responseRecorded} heartbeatIntervalMs={session.playbackPolicy.heartbeatIntervalMs} canSkip={!!workspace.shortcuts?.skip} canAdvance={!!workspace.shortcuts?.next}
    fullScreen={expanded} onFullScreen={() => setFullScreen(value => !value)}
    onStart={async () => { await model.start(owner); const fresh = model.snapshot(); return fresh.status === 'ready' && fresh.data.session.playbackEventId === owner.playbackEventId && fresh.data.session.currentPosition === owner.position && ['playing', 'recorded'].includes(fresh.data.phase); }}
    onRespond={(ms, eventId) => model.respond(ms, eventId, owner)} onHeartbeat={read => model.heartbeat(read, owner)} onEnded={ms => model.complete(ms, owner)}
    onFault={() => model.mediaFault(owner)} onSkip={ms => model.skipIntro(ms, owner)} onAdvance={() => model.advanceAfterReaction(owner)} onReload={() => { void action(() => model.retry()); }} onPrevious={requestExit} canPrevious previousIsExit /> : null;
  return <View style={[s.page, expanded && { backgroundColor: '#0B1220', paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }]}>
    <SimulationHeader title={title} hidden={expanded} onBack={requestExit} />
    <View style={expanded ? { flex: 1 } : session.status === 'IN_PROGRESS' ? { paddingHorizontal: 18, paddingTop: 14 } : { display: 'none' }}>{play}</View>
    <ScrollView style={expanded ? { display: 'none' } : { flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>

      {session.status === 'CANCELLED' ? <View style={[s.card, { gap: 14 }]}><Text style={s.title}>Bài thi đã hủy</Text><Text style={s.body}>Bài thi này không có kết quả hoàn thành.</Text><AppButton label="Về thi thử mô phỏng" onPress={() => openSimulation('/simulations/exams', {}, true)} /></View> : session.status === 'READY_TO_SUBMIT' ? error || workspace.phase === 'submission-error' ? <SimulationNotice error={error ?? 'Chưa nộp được bài. Kết quả các tình huống đã được giữ lại.'} retry={() => { void action(() => model.retry()); }} /> : <SimulationLoading label="Đang nộp bài..." /> : session.status === 'COMPLETED' ? <SimulationLoading label="Đang mở kết quả..." /> : <>
        {!play && <SimulationLoading label="Đang chuẩn bị tình huống tiếp theo..." />}
        {workspace.shortcutNotice && <Text style={s.small}>{workspace.shortcutNotice}</Text>}
        {recovery && <Text accessibilityLiveRegion="polite" style={s.small}>{workspace.phase === 'response-error' ? 'Chưa xác nhận được phản ứng. Nhấn icon tải lại ở giữa để kiểm tra trước khi tiếp tục.' : 'Lượt phát đã gián đoạn. Nhấn icon tải lại ở giữa để phát lại tình huống; phản ứng đã lưu vẫn giữ nguyên.'}</Text>}
      </>}
      {error && session.status !== 'READY_TO_SUBMIT' ? <SimulationNotice error={error} retry={() => { void action(() => model.retry()); }} /> : null}
      <View style={{ gap: 10 }}>{session.positions.map(position => {
        const completed = position.status === 'COMPLETED', current = position.status === 'CURRENT';
        const color = completed ? '#16834B' : current ? '#176BD0' : '#6B7280';
        return <View key={position.position} accessible accessibilityLabel={`Tình huống thứ ${position.position}, ${completed ? 'đã hoàn thành' : current ? 'đang xem' : 'chưa xem'}`}
          style={[s.card, { minHeight: 64, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: current ? '#CFE1FA' : '#E5E9EF', backgroundColor: current ? '#EFF6FF' : '#FFFFFF' }]}>
          <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: completed ? '#E7F6EE' : current ? '#DBEAFE' : '#F3F4F6' }}><Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color }}>{position.position}</Text></View>
          <Text style={[s.body, { flex: 1, color: '#111827' }]}>Tình huống thứ {position.position}</Text>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            {completed || current ? <SimulationGlyph kind={completed ? 'check' : 'play'} size={completed ? 22 : 17} color={color} /> : <View style={{ width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: '#D1D5DB' }} />}
          </View>
        </View>;
      })}</View>
    </ScrollView>
    <BottomSheet visible={exit} title="Rời bài thi?" close={() => setExit(false)} topInset={insets.top} contentContainerStyle={{ gap: 14 }}>
      <Text style={s.body}>Bài đang làm được giữ lại. Khi quay lại, tình huống đang xem sẽ phát lại từ đầu; phản ứng đã lưu vẫn giữ nguyên.</Text>
      <AppButton label="Tiếp tục làm bài" onPress={() => { setExit(false); void action(() => model.retry()); }} />
      <AppButton secondary label="Về sảnh thi thử" onPress={() => openSimulation('/simulations/exams', {}, true)} />
    </BottomSheet>
  </View>;
}
export default function SimulationExamScreen() {
  const params = useLocalSearchParams<{ sessionId: string }>();
  const valid = typeof params.sessionId === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(params.sessionId);
  return <SimulationGate title="Thi thử mô phỏng">{context => valid ? <Workspace context={context} sessionId={params.sessionId} /> : <View style={s.content}><Text style={s.body}>Đường dẫn bài thi chưa hợp lệ.</Text></View>}</SimulationGate>;
}
