import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLearnerResource } from '../../session/use-learner-resource';
import { AppButton } from '../../shared/ui';
import type { SimulationContext } from '../simulation-context';
import { openSimulation, reviewPath } from '../simulation-navigation';
import { SimulationAnalysis, SimulationScenarioDescription } from './simulation-analysis';
import { SimulationVideoPlayer } from './simulation-video-player';
import { SimulationGate, SimulationGlyph, SimulationHeader, SimulationLoading, SimulationNotice, simulationStyles as s } from './simulation-ui';

function Result({ context, sessionId, fromHistory = false }: { context: SimulationContext; sessionId: string; fromHistory?: boolean }) {
  const insets = useSafeAreaInsets();
  const loader = useCallback(() => context.exams.result(context.scope, sessionId), [context, sessionId]);
  const resource = useLearnerResource('simulation-result:' + sessionId, loader);
  const result = resource.data;
  return <View style={s.page}><SimulationHeader title={fromHistory ? 'Xem bài làm' : 'Kết quả mô phỏng'} onBack={() => { if (fromHistory) { if (router.canGoBack()) router.back(); else router.replace('/history'); } else openSimulation('/simulations/exams', {}, true); }} />
    <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />}>
      {resource.loading && <SimulationLoading label="Đang tải kết quả..." />}
      {resource.error && <SimulationNotice error={resource.error} retry={resource.reload} />}
      {result && <>
        <View style={[s.card, { backgroundColor: '#EFF6FF', borderColor: '#D5E5FA', padding: 18, gap: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><SimulationGlyph kind="preset" size={24} color="#176BD0" /></View>
            <View style={{ flex: 1, gap: 3 }}><Text style={s.title}>{result.mode === 'PRESET' ? result.preset.title : 'Thi thử ngẫu nhiên'}</Text><Text style={s.small}>Mô phỏng · Hạng {result.scope.licenseClass}</Text></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <Text style={s.body}>Điểm bài thi</Text><Text style={[s.body, { fontWeight: '600', color: '#111827' }]}>{result.totalScore}/{result.policy.maxTotalScore}</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderColor: '#D5E5FA', paddingTop: 12, gap: 8 }}>
            <Text style={[s.title, { color: result.passed ? '#16834B' : '#374151' }]}>{result.passed ? 'Đạt' : 'Chưa đạt'}</Text>
            <Text style={s.small}>Mức đạt: {result.policy.passingScore} điểm · {result.completedScenarios}/{result.policy.totalScenarios} tình huống</Text>
          </View>
        </View>
        {result.items.map(item => <Pressable key={item.position} accessibilityRole="button" onPress={() => openSimulation(reviewPath(sessionId), { position: String(item.position), ...(fromHistory ? { from: 'history' } : {}) })}
          style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF' }]}>
          <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#0877F9', fontSize: 16, fontWeight: '600' }}>{item.position}</Text></View>
          <Text style={[s.body, { flex: 1 }]}>Tình huống thứ {item.position}</Text><Text style={[s.body, { fontWeight: '600', color: '#111827' }]}>{item.score}/{item.maxScore}</Text><SimulationGlyph kind="next" size={15} />
        </Pressable>)}
        {!fromHistory && <>
          <AppButton label="THI THỬ" onPress={() => openSimulation('/simulations/exams', {}, true)} />
          <AppButton secondary label="Ôn tập tình huống" onPress={() => openSimulation('/simulations', {}, true)} />
        </>}
      </>}
    </ScrollView>
  </View>;
}
function Review({ context, sessionId, initialPosition }: { context: SimulationContext; sessionId: string; initialPosition: number }) {
  const insets = useSafeAreaInsets();
  const [position, setPosition] = useState(initialPosition), [fullScreen, setFullScreen] = useState(false);
  const loader = useCallback(() => context.exams.review(context.scope, sessionId), [context, sessionId]);
  const resource = useLearnerResource('simulation-review:' + sessionId, loader);
  const review = resource.data, item = review?.items.find(value => value.position === position);
  const playbackLoader = useCallback(async () => {
    if (!item) return null;
    const value = await context.exams.reviewPlayback({ ...context.scope, bankVersion: review!.result.bankVersion }, sessionId, position);
    if (value.durationMs !== item.durationMs || value.responseRecorded !== item.responseRecorded) throw new Error('Video xem lại chưa khớp với kết quả đã lưu.');
    return value;
  }, [context, sessionId, position, item, review]);
  const playback = useLearnerResource(`simulation-review-video:${sessionId}:${position}`, playbackLoader);
  const video = playback.data;
  const player = video && <SimulationVideoPlayer key={`${sessionId}:${position}:${video.playbackEventId}:${video.expiresAt}`} videoUrl={video.videoUrl} expiresAt={video.expiresAt} ownerKey={video.playbackEventId}
    durationMs={video.durationMs} startAtMs={0} active={false} busy={false} readOnly responseRecorded={video.responseRecorded} fullScreen={fullScreen} onFullScreen={() => setFullScreen(value => !value)}
    onStart={async () => false} onRespond={async () => {}} onHeartbeat={async () => {}} onEnded={async () => {}} onFault={() => {}} onReload={playback.reload}
    onPrevious={() => setPosition(value => value - 1)} canPrevious={position > 1}
    onNextScenario={() => setPosition(value => value + 1)} canNextScenario={!!review && position < review.result.policy.totalScenarios} />;
  return <View style={[s.page, fullScreen && { backgroundColor: '#0B1220', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
    <SimulationHeader title="Xem lại tình huống" hidden={fullScreen} />
    <View style={fullScreen ? { flex: 1 } : { paddingHorizontal: 18, paddingTop: 16 }}>{player}</View>
    <ScrollView style={fullScreen ? { display: 'none' } : { flex: 1 }} contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 24 }]}>
      {resource.loading && <SimulationLoading label="Đang tải bài làm..." />}
      {resource.error && <SimulationNotice error={resource.error} retry={resource.reload} />}
      {review && !item && <SimulationNotice error="Không thể tải video xem lại ở vị trí này." />}
      {item && <>
        <SimulationScenarioDescription number={item.scenarioNumber} title={item.title} />
        {playback.loading && <SimulationLoading label="Đang tải video xem lại..." />}
        {playback.error && <SimulationNotice error={playback.error} retry={playback.reload} />}
        <SimulationAnalysis score={item.score} maxScore={item.maxScore} firstResponseMs={item.firstResponseMs} durationMs={item.durationMs} segments={item.scoringSegments} hazardSign={item.hazardSign} recognitionTip={item.recognitionTip} />
      </>}
    </ScrollView>
  </View>;
}
function validId(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value); }
export function SimulationResultScreen() {
  const { sessionId, from } = useLocalSearchParams<{ sessionId: string; from?: string }>();
  return <SimulationGate title="Kết quả mô phỏng" requireReady={false}>{context => validId(sessionId) ? <Result context={context} sessionId={sessionId} fromHistory={from === 'history'} /> : <View style={s.content}><Text style={s.body}>Đường dẫn bài làm chưa hợp lệ.</Text></View>}</SimulationGate>;
}
export function SimulationReviewScreen() {
  const { sessionId, position } = useLocalSearchParams<{ sessionId: string; position?: string }>();
  const selected = Number(position ?? 1);
  return <SimulationGate title="Xem lại mô phỏng" requireReady={false}>{context => validId(sessionId) && Number.isSafeInteger(selected) && selected > 0 ? <Review context={context} sessionId={sessionId} initialPosition={selected} /> : <View style={s.content}><Text style={s.body}>Đường dẫn bài làm chưa hợp lệ.</Text></View>}</SimulationGate>;
}
