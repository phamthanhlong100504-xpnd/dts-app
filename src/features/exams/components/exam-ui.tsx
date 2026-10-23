import { SymbolView } from 'expo-symbols';
import { Pressable, Text } from 'react-native';
import type { ComponentProps } from 'react';
const symbols: Record<string, NonNullable<ComponentProps<typeof SymbolView>['name']>> = {
  list: { ios: 'square.grid.3x3.fill', android: 'grid_view', web: 'grid_view' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  wrong: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
  left: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  right: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  pause: { ios: 'pause.circle.fill', android: 'pause_circle', web: 'pause_circle' },
  retry: { ios: 'arrow.clockwise', android: 'replay', web: 'replay' },
  home: { ios: 'house', android: 'home', web: 'home' },
  submit: { ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' },
};
export function ExamIcon({ name, color = '#0877F9', size = 22 }: { name: string; color?: string; size?: number }) { return <SymbolView name={symbols[name] ?? symbols.list} tintColor={color} size={size} />; }
export function TextAction({ label, icon, disabled = false, onPress, color = '#111827' }: { label: string; icon?: string; disabled?: boolean; onPress: () => void; color?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={{ minHeight: 44, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: disabled ? 0.4 : 1 }}>
    {icon === 'left' && <ExamIcon name={icon} color={color} size={17} />}
    <Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color }}>{label}</Text>
    {icon && icon !== 'left' && <ExamIcon name={icon} color={color} size={17} />}
  </Pressable>;
}
export { BottomSheet as Sheet, QuestionGrid } from '../../shared/question-sheet';
