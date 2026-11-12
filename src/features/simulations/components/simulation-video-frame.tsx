import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SimulationGlyph } from './simulation-ui';
import { mediaClock } from '../simulation-navigation';

type NavigationAction = { label: string; disabled?: boolean; onPress: () => void; exit?: boolean };
export type SimulationVideoFrameProps = {
  children: ReactNode; durationMs: number; timeMs: number; fullScreen: boolean; onFullScreen: () => void;
  loading?: boolean; centerLabel: string; centerKind?: 'play' | 'pause' | 'retry'; centerDisabled?: boolean; busy?: boolean; onCenter: () => void;
  previous?: NavigationAction; next?: NavigationAction; onSkip?: () => void; canSkip?: boolean;
  readOnly?: boolean; responseRecorded?: boolean; canReact?: boolean; onReact?: () => void;
};
/** Presentation only. Player/controller callbacks retain every existing server check. */
export function SimulationVideoFrame(props: SimulationVideoFrameProps) {
  const [pressed, setPressed] = useState(false);
  const progress = Math.min(100, Math.max(0, props.timeMs * 100 / props.durationMs));
  return <View style={props.fullScreen ? { flex: 1, backgroundColor: '#0B1220' } : { gap: 10 }}>
    <View style={props.fullScreen ? { flex: 1, minHeight: 160, backgroundColor: '#050A12' } : { width: '100%', aspectRatio: 16 / 9, borderRadius: 14, overflow: 'hidden', backgroundColor: '#050A12' }}>
      {props.children}
      {!props.readOnly && <View pointerEvents="none" style={{ position: 'absolute', left: 12, top: 12, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 7, backgroundColor: '#00000066' }}><Text style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '500' }}>{mediaClock(props.timeMs)}/{mediaClock(props.durationMs)}</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={props.fullScreen ? 'Thu nhỏ video' : 'Phóng to video'} onPress={props.onFullScreen} style={{ position: 'absolute', right: 8, top: 6, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><SimulationGlyph kind={props.fullScreen ? 'collapse' : 'expand'} color="#FFFFFF" size={22} /></Pressable>
      {props.loading && <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#050A1299' }}><ActivityIndicator color="#FFFFFF" /><Text style={{ color: '#FFFFFF', fontSize: 15 }}>Đang tải video...</Text></View>}
      {props.onSkip && props.canSkip && <Pressable accessibilityRole="button" accessibilityLabel="Bỏ qua 10 giây đầu video" disabled={props.busy} onPress={props.onSkip}
        style={{ position: 'absolute', right: 20, bottom: 38, minHeight: 44, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', opacity: props.busy ? 0.5 : 1 }}><Text style={{ fontSize: 14, lineHeight: 21, color: '#FFFFFF', fontWeight: '600', textShadowColor: '#000000', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>Bỏ qua 10s</Text></Pressable>}
      {!props.readOnly && <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: '#FFFFFF33' }}><View style={{ width: `${progress}%`, height: 3, backgroundColor: '#77BEFF' }} /></View>}
    </View>
    <View style={{ paddingHorizontal: props.fullScreen ? 14 : 0, paddingBottom: props.fullScreen ? 10 : 0, gap: 10 }}>
      <View style={{ height: 50, borderRadius: 12, borderWidth: 1, borderColor: '#E5E9EF', backgroundColor: '#F8F9FB', paddingHorizontal: 10, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TransportAction action={props.previous} side="previous" busy={props.busy} />
        <Pressable accessibilityRole="button" accessibilityLabel={props.centerLabel} accessibilityState={{ disabled: props.centerDisabled || props.busy }} disabled={props.centerDisabled || props.busy} onPress={props.onCenter}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: props.centerDisabled ? 0.45 : 1 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#DCE3EC', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          {props.busy ? <ActivityIndicator color="#0877F9" /> : <SimulationGlyph kind={props.centerKind ?? 'play'} size={19} />}
          </View>
        </Pressable>
        <TransportAction action={props.next} side="next" busy={props.busy} />
      </View>
      {!props.readOnly && <Pressable accessibilityRole="button" accessibilityLabel={props.responseRecorded ? 'Phản ứng đã được ghi nhận' : 'SPACE: ghi nhận thời điểm phát hiện nguy hiểm'} accessibilityState={{ disabled: !props.canReact }} disabled={!props.canReact} onPress={props.onReact} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
        style={{ minHeight: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: props.responseRecorded ? '#E7F6EE' : '#0877F9', opacity: props.responseRecorded ? 1 : !props.canReact ? 0.45 : pressed ? 0.8 : 1 }}>
        <Text style={{ fontSize: 17, lineHeight: 25, fontWeight: '600', letterSpacing: 1.6, color: props.responseRecorded ? '#23734C' : '#FFFFFF' }}>SPACE</Text>
      </Pressable>}
    </View>
  </View>;
}
function TransportAction({ action, side, busy }: { action?: NavigationAction; side: 'previous' | 'next'; busy?: boolean }) {
  if (!action) return <View style={{ width: 44, height: 44 }} />;
  const disabled = action.disabled || busy;
  return <Pressable accessibilityRole="button" accessibilityLabel={action.label} accessibilityState={{ disabled }} disabled={disabled} onPress={action.onPress}
    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}><SimulationGlyph kind={action.exit ? 'exit' : side === 'previous' ? 'previousScene' : 'nextScene'} size={18} /></Pressable>;
}
