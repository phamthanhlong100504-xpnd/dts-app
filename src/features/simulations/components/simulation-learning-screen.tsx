import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { BackHandler, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SimulationContext } from '../simulation-context';
import { MobileSimulationLearning } from '../simulation-learning-controller';
import { openSimulation, scenarioPath } from '../simulation-navigation';
import { SimulationVideoPlayer } from './simulation-video-player';
import { SimulationVideoFrame } from './simulation-video-frame';
import { SimulationAnalysis, SimulationHint, SimulationScenarioDescription } from './simulation-analysis';
import { SimulationGate, SimulationHeader, SimulationLoading, SimulationNotice, simulationStyles as s } from './simulation-ui';

function Learning({ context, scenarioId, bankVersion }: { context: SimulationContext; scenarioId: string; bankVersion?: string }) {
  const insets = useSafeAreaInsets();
  const pinned = useMemo(() => ({ ...context, scope: { ...context.scope, ...(bankVersion ? { bankVersion } : {}) } }), [context, bankVersion]);
  const model = useMemo(() => new MobileSimulationLearning(pinned, scenarioId), [pinned, scenarioId]);
  const state = useSyncExternalStore(model.subscribe, model.snapshot);
  const [fullScreen, setFullScreen] = useState(false);
  useFocusEffect(useCallback(() => {
    model.activate(); void model.load();
    return () => { void model.fault('PAGE_EXIT'); model.dispose(); };
  }, [model]));
  useFocusEffect(useCallback(() => {
    const event = BackHandler.addEventListener('hardwareBackPress', () => { if (!fullScreen) return false; setFullScreen(false); return true; });
    return () => event.remove();
  }, [fullScreen]));
  const data = state.data, result = data?.result;
  const title = data ? `Tình huống ${data.scenario.number}` : 'Ôn tập tình huống';
  if (state.loading) return <View style={s.page}><SimulationHeader title={title} /><SimulationLoading /></View>;
  if (!data) return <View style={s.page}><SimulationHeader title={title} /><View style={s.content}><SimulationNotice error={state.error} retry={() => { void model.load(); }} /></View></View>;
  const owner = data.playbackEventId;
  const recover = !!(state.error || data.phase === 'video-error' || data.phase === 'save-error' || data.replayUnavailable);
  const previous = () => { if (data.previousScenarioId) openSimulation(scenarioPath(data.previousScenarioId), { bankVersion: data.scope.bankVersion }, true); };
  const next = () => { if (data.nextScenarioId) openSimulation(scenarioPath(data.nextScenarioId), { bankVersion: data.scope.bankVersion }, true); };
  const prepare = () => model.prepare();
  const retry = () => { void model.retry().catch(() => {}); };
  const play = data.videoUrl && owner ? <SimulationVideoPlayer key={`${data.attemptId}:${owner}:${data.readOnly ? 'review' : 'learn'}`}
    videoUrl={data.videoUrl} expiresAt={data.playbackExpiresAt} ownerKey={owner} durationMs={data.scenario.durationMs} startAtMs={data.readOnly ? 0 : data.resumeAtMs ?? 0}
    active={state.active} busy={state.busy} autoStart={state.playRequested} readOnly={data.readOnly} responseRecorded={data.responseRecorded}
    heartbeatIntervalMs={data.policy.heartbeatIntervalMs} canSkip={!!data.shortcuts?.skip} fullScreen={fullScreen} onFullScreen={() => setFullScreen(value => !value)}
    onStart={async ms => { await model.start(owner, ms); const fresh = model.snapshot(); return fresh.active && fresh.data?.playbackEventId === owner; }}
    onRespond={ms => model.respond(ms, owner)} onHeartbeat={read => model.heartbeat(read, owner)} onEnded={ms => model.complete(ms, owner)}
    onFault={reason => { void model.fault(reason, owner); }} onSkip={ms => model.skipIntro(ms, owner)} onReload={retry} onPrepare={prepare} onPracticeAgain={() => model.prepare(true)} needsRecovery={recover}
    onPrevious={previous} canPrevious={!!data.previousScenarioId} onNextScenario={next} canNextScenario={!!data.nextScenarioId} /> : null;
  return <View style={[s.page, fullScreen && { backgroundColor: '#0B1220', paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }]}>
    <SimulationHeader title={title} hidden={fullScreen} />
    <View style={fullScreen ? { flex: 1 } : { paddingHorizontal: 18, paddingTop: 14 }}>{play ?? <SimulationVideoFrame durationMs={data.scenario.durationMs} timeMs={0}
      fullScreen={fullScreen} onFullScreen={() => setFullScreen(value => !value)} centerLabel={recover ? 'Tải lại video' : 'Bắt đầu luyện tập'} centerKind={recover ? 'retry' : 'play'} busy={state.busy}
      onCenter={() => { if (recover) retry(); else void prepare().catch(() => {}); }}
      previous={{ label: 'Tình huống trước', disabled: !data.previousScenarioId, onPress: previous }} next={{ label: 'Tình huống tiếp', disabled: !data.nextScenarioId, onPress: next }}>
      <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: 20 }}><Text style={{ fontSize: 15, lineHeight: 23, color: '#E5EDF8', textAlign: 'center' }}>Nhấn nút phát để bắt đầu luyện tập</Text></View>
    </SimulationVideoFrame>}</View>
    <ScrollView style={fullScreen ? { display: 'none' } : { flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>

      <SimulationScenarioDescription number={data.scenario.number} title={data.scenario.title} />
      {recover && <SimulationNotice error={state.error ?? data.replayError ?? 'Video cần được tải lại để tiếp tục đúng vị trí đã lưu.'} />}
      {!state.active && !state.playRequested && !data.readOnly && data.hintPreview && <SimulationHint {...data.hintPreview} />}
      {result && <SimulationAnalysis score={result.score} maxScore={result.maxScore} firstResponseMs={result.firstResponseMs} durationMs={result.durationMs} segments={result.scoringSegments} hazardSign={result.hazardSign} recognitionTip={result.recognitionTip} />}
    </ScrollView>
  </View>;
}
export default function SimulationLearningScreen() {
  const params = useLocalSearchParams<{ scenarioId: string; bankVersion?: string }>();
  const valid = typeof params.scenarioId === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(params.scenarioId);
  return <SimulationGate title="Ôn tập tình huống">{context => valid ? <Learning context={context} scenarioId={params.scenarioId} bankVersion={params.bankVersion} /> : <View style={s.content}><Text style={s.body}>Đường dẫn tình huống chưa hợp lệ.</Text></View>}</SimulationGate>;
}
