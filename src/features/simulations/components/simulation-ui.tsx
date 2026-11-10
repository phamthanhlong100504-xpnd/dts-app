import { type ReactNode, useCallback } from 'react';
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StudyAccess } from '../../session/components/study-access';
import { useLearnerResource } from '../../session/use-learner-resource';
import { AppButton } from '../../shared/ui';
import { loadSimulationCapability, useSimulationContext, type SimulationCapability, type SimulationContext } from '../simulation-context';
import { simulationMessage } from '../simulation-api';

export const simulationColors = { blue: '#0877F9', ink: '#111827', body: '#374151', muted: '#4B5563', line: '#E5E7EB', soft: '#EFF6FF', green: '#16834B' };
export const simulationStyles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 18, gap: 16, paddingBottom: 30 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', padding: 16 },
  title: { fontSize: 17, lineHeight: 25, color: '#111827', fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 26, color: '#374151' },
  small: { fontSize: 15, lineHeight: 22, color: '#4B5563' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
export function SimulationHeader({ title, hidden = false, onBack }: { title: string; hidden?: boolean; onBack?: () => void }) {
  return <Stack.Screen options={{ title, headerShown: !hidden, headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal', headerStyle: { backgroundColor: '#FFFFFF' }, headerTintColor: '#111827', headerTitleStyle: { fontSize: 18, fontWeight: '600' }, ...(onBack ? { gestureEnabled: false, headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center' }}><SimulationGlyph kind="back" size={23} color="#111827" /></Pressable> } : {}) }} />;
}
export function SimulationLoading({ label = 'Đang tải nội dung mô phỏng...' }: { label?: string }) {
  return <View style={{ padding: 28, alignItems: 'center', gap: 12 }}><ActivityIndicator color="#0877F9" /><Text style={simulationStyles.body}>{label}</Text></View>;
}
export function SimulationNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  return <View accessibilityLiveRegion="polite" style={{ gap: 4, alignItems: 'flex-start' }}>
    <Text style={[simulationStyles.small, { color: '#991B1B' }]}>{simulationMessage(error)}</Text>
    {retry && <SimulationTextAction label="Thử lại" onPress={retry} />}
  </View>;
}
export function SimulationTextAction({ label, onPress, disabled = false, danger = false }: { label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
    <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: danger ? '#B91C1C' : '#0877F9', textAlign: 'center' }}>{label}</Text>
  </Pressable>;
}
export function SimulationGlyph({ kind = 'video', color = '#0877F9', size = 26 }: { kind?: 'video' | 'play' | 'pause' | 'flag' | 'random' | 'preset' | 'expand' | 'collapse' | 'next' | 'back' | 'previousScene' | 'nextScene' | 'retry' | 'check' | 'hint' | 'question' | 'skip' | 'exit'; color?: string; size?: number }) {
  const names = {
    video: { ios: 'play.rectangle.fill', android: 'video_library', web: 'video_library' },
    play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
    pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
    flag: { ios: 'flag.fill', android: 'flag', web: 'flag' },
    random: { ios: 'dice.fill', android: 'casino', web: 'casino' },
    preset: { ios: 'list.clipboard.fill', android: 'assignment', web: 'assignment' },
    expand: { ios: 'arrow.up.left.and.arrow.down.right', android: 'fullscreen', web: 'fullscreen' },
    collapse: { ios: 'arrow.down.right.and.arrow.up.left', android: 'fullscreen_exit', web: 'fullscreen_exit' },
    next: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
    back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
    previousScene: { ios: 'backward.end.fill', android: 'skip_previous', web: 'skip_previous' },
    nextScene: { ios: 'forward.end.fill', android: 'skip_next', web: 'skip_next' },
    retry: { ios: 'arrow.clockwise', android: 'replay', web: 'replay' },
    check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
    hint: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
    question: { ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' },
    skip: { ios: 'goforward.10', android: 'forward_10', web: 'forward_10' },
    exit: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  } as const;
  return <SymbolView name={names[kind]} size={size} tintColor={color} />;
}
function GateContent({ title, children, requireReady = true }: { title: string; requireReady?: boolean; children: (context: SimulationContext, capability: SimulationCapability) => ReactNode }) {
  const context = useSimulationContext();
  const loader = useCallback(async () => { if (!context) throw new Error('Chưa có phiên đăng nhập.'); return loadSimulationCapability(context); }, [context]);
  const resource = useLearnerResource('simulation-capability', loader);
  if (!context) return null;
  if (resource.loading) return <><SimulationHeader title={title} /><SimulationLoading /></>;
  if (resource.error || !resource.data) return <View style={simulationStyles.page}><SimulationHeader title={title} /><View style={simulationStyles.content}><SimulationNotice error={resource.error} retry={resource.reload} /></View></View>;
  if (!resource.data.simulationEnabled || (requireReady && !resource.data.simulationReady)) return <View style={simulationStyles.page}><SimulationHeader title={title} /><View style={[simulationStyles.content, { flex: 1, justifyContent: 'center' }]}>
    <Text style={simulationStyles.title}>{resource.data.simulationEnabled ? 'Mô phỏng đang chưa sẵn sàng' : `Hạng ${context.scope.licenseClass} chưa có phần mô phỏng`}</Text>
    <Text style={simulationStyles.body}>{resource.data.simulationEnabled ? 'Vui lòng thử tải lại sau. Các nội dung lý thuyết vẫn có thể sử dụng bình thường.' : 'Bạn có thể tiếp tục ôn luyện lý thuyết từ Trang chủ.'}</Text>
    {resource.data.simulationEnabled && <AppButton label="Tải lại" onPress={resource.reload} />}
    <AppButton secondary label="Về Trang chủ" onPress={() => router.replace('/home')} />
  </View></View>;
  return children(context, resource.data);
}
export function SimulationGate(props: { title: string; requireReady?: boolean; children: (context: SimulationContext, capability: SimulationCapability) => ReactNode }) {
  return <StudyAccess><GateContent {...props} /></StudyAccess>;
}
