import { useState, type ReactNode, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { userMessage, type MessageContext } from './user-message';
export const colors = { blue: '#0877F9', ink: '#111827', muted: '#4B5563', line: '#E5E7EB', surface: '#F3F4F6' };
export function AppIcon({ name, size = 24, color = colors.blue }: { name: string; size?: number; color?: string }) {
  const icons: Record<string, NonNullable<ComponentProps<typeof SymbolView>['name']>> = {
    edit: { ios: 'pencil', android: 'edit', web: 'edit' },
    user: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
    settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
    random: { ios: 'dice.fill', android: 'casino', web: 'casino' },
    preset: { ios: 'list.clipboard.fill', android: 'assignment', web: 'assignment' },
    study: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
    critical: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
    wrong: { ios: 'arrow.clockwise', android: 'replay', web: 'replay' },
    signs: { ios: 'signpost.right.fill', android: 'signpost', web: 'signpost' },
    tips: { ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' },
    history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
    progress: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
    eye: { ios: 'eye', android: 'visibility', web: 'visibility' },
    hidden: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
    lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
    mail: { ios: 'envelope.fill', android: 'mail', web: 'mail' },
  };
  return <SymbolView name={icons[name] ?? icons.study} size={size} tintColor={color} />;
}
export function AppButton({ label, onPress, busy, secondary, disabled }: { label: string; onPress: () => void; busy?: boolean; secondary?: boolean; disabled?: boolean }) {
  const [pressed, setPressed] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }} disabled={busy || disabled} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
      backgroundColor: secondary ? '#EFF6FF' : colors.blue, borderWidth: secondary ? 1 : 0, borderColor: '#DBEAFE', opacity: busy || disabled ? 0.55 : pressed ? 0.8 : 1 }}>
    {busy ? <ActivityIndicator color={secondary ? colors.blue : '#FFFFFF'} /> : <Text style={{ fontSize: 16, fontWeight: '600', textAlign: 'center', color: secondary ? colors.blue : '#FFFFFF' }}>{label}</Text>}
  </Pressable>;
}
export function Message({ children, kind = 'error', context = 'general' }: { children: ReactNode; kind?: 'error' | 'info'; context?: MessageContext }) {
  return <View accessibilityLiveRegion="polite" style={{ padding: 12, borderRadius: 10, backgroundColor: kind === 'error' ? '#FEF2F2' : '#EFF6FF', marginVertical: 8 }}>
    <Text selectable style={{ fontSize: 15, lineHeight: 22, color: kind === 'error' ? '#B91C1C' : '#1E40AF' }}>{kind === 'error' && (typeof children === 'string' || children instanceof Error) ? userMessage(children, context) : children}</Text>
  </View>;
}
