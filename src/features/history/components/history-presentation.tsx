import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { userMessage } from '../../shared/user-message';
import { historyCalendarDate } from '../history-format';

export type HistoryModule = 'THEORY' | 'SIMULATION';
export type HistoryMode = 'RANDOM' | 'PRESET';
export function HistoryTabs<T extends string>({ label, options, value, onSelect }: {
  label: string; options: readonly (readonly [T, string])[]; value: T; onSelect: (value: T) => void;
}) {
  return <View accessibilityLabel={label} style={{ flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: '#F3F4F6', gap: 4 }}>
    {options.map(([option, text]) => <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: value === option }} onPress={() => onSelect(option)}
      style={{ flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 8, paddingVertical: 9, borderRadius: 9, backgroundColor: value === option ? '#0877F9' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 16.5, lineHeight: 24, fontWeight: '600', color: value === option ? '#FFFFFF' : '#374151', textAlign: 'center' }}>{text}</Text>
    </Pressable>)}
  </View>;
}
export function HistorySummary({ summary }: { summary?: { total: number | null; passed: number | null; failed: number | null } }) {
  return <View style={{ borderRadius: 18, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 20, flexDirection: 'row', alignItems: 'center' }}>
    {([['total', 'Lần thi'], ['passed', 'Đạt'], ['failed', 'Chưa đạt']] as const).map(([key, text], index) => <View key={key} style={{ flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4, borderLeftWidth: index ? 1 : 0, borderColor: '#B9D7FC' }}>
      <SymbolView name={key === 'total' ? { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' } : key === 'passed' ? { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' } : { ios: 'xmark.circle', android: 'cancel', web: 'cancel' }} size={25} tintColor={key === 'total' ? '#0877F9' : key === 'passed' ? '#16A34A' : '#EF4444'} />
      <Text style={{ fontSize: 20, lineHeight: 27, fontWeight: '600', color: '#111827' }}>{summary?.[key] ?? '—'}</Text>
      <Text style={{ fontSize: 16, lineHeight: 23, color: '#111827', textAlign: 'center' }}>{text}</Text>
    </View>)}
  </View>;
}
export function SimulationHistoryCard({ title, licenseClass, passed, metric, completedAt, disabled = false, onPress }: {
  title: string; licenseClass: string; passed: boolean; metric: string;
  completedAt: string; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    accessibilityLabel={`Mô phỏng, ${title}, Hạng ${licenseClass}, ${passed ? 'Đạt' : 'Chưa đạt'}, ${metric} điểm, ${historyCalendarDate(completedAt)}. ${disabled ? 'Chưa có kết quả để xem' : 'Xem bài làm'}`}
    className="mb-3 rounded-2xl border border-blue-300 bg-white p-4" style={{ opacity: disabled ? 0.6 : 1 }}>
    <View className="flex-row items-start">
      <View className="mr-3 pt-0.5"><SymbolView name={{ ios: 'play.rectangle', android: 'video_library', web: 'video_library' }} size={25} tintColor="#0877F9" /></View>
      <View className="mr-2 flex-1"><Text className="text-lg font-semibold leading-6 text-gray-900">{title}</Text><Text className="mt-1 text-sm text-gray-700">Hạng {licenseClass}</Text></View>
      <View className="rounded-full px-3 py-1" style={{ backgroundColor: passed ? '#DCFCE7' : '#FEE2E2' }}><Text className="text-sm font-bold" style={{ color: passed ? '#15803D' : '#DC2626' }}>{passed ? 'ĐẠT' : 'CHƯA ĐẠT'}</Text></View>
    </View>
    <View className="mt-4 flex-row items-center">
      <View className="flex-1 flex-row items-center"><SymbolView name={{ ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' }} size={21} tintColor="#0877F9" /><Text className="ml-2 flex-1 text-base text-gray-900">Điểm: <Text className="font-semibold">{metric}</Text></Text></View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={17} tintColor="#111827" />
    </View>
    <View className="mt-4 flex-row items-center"><SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={20} tintColor="#111827" /><Text className="ml-2 text-sm text-gray-900">{historyCalendarDate(completedAt)}</Text></View>
  </Pressable>;
}
export function HistoryPagination({ page, totalPages, previous, next }: { page: number; totalPages: number | null; previous: () => void; next: () => void }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
    <Pressable accessibilityRole="button" disabled={page === 0} accessibilityState={{ disabled: page === 0 }} onPress={previous} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, opacity: page === 0 ? 0.4 : 1 }}><Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#1D4ED8' }}>Trang trước</Text></Pressable>
    <Text style={{ fontSize: 15, lineHeight: 22, color: '#4B5563' }}>{totalPages === null ? '—' : `${totalPages ? page + 1 : 0}/${totalPages}`}</Text>
    <Pressable accessibilityRole="button" disabled={totalPages === null || page + 1 >= totalPages} accessibilityState={{ disabled: totalPages === null || page + 1 >= totalPages }} onPress={next} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, opacity: totalPages === null || page + 1 >= totalPages ? 0.4 : 1 }}><Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#1D4ED8' }}>Trang tiếp</Text></Pressable>
  </View>;
}
export function HistoryReadError({ error, reload }: { error: unknown; reload: () => void }) {
  return <View style={{ gap: 4, alignItems: 'flex-start' }}><Text style={{ fontSize: 16, lineHeight: 24, color: '#991B1B' }}>{userMessage(error)}</Text><Pressable accessibilityRole="button" onPress={reload} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#1D4ED8' }}>Thử lại</Text></Pressable></View>;
}
export function HistoryEmpty({ message = 'Các bài đã hoàn thành sẽ xuất hiện tại đây.' }: { message?: string }) {
  return <View style={{ borderRadius: 16, backgroundColor: '#F8FAFC', padding: 22, alignItems: 'center', gap: 8 }}><Text style={{ fontSize: 17, lineHeight: 25, fontWeight: '600', color: '#111827', textAlign: 'center' }}>Chưa có lịch sử phù hợp</Text><Text style={{ fontSize: 16, lineHeight: 24, color: '#4B5563', textAlign: 'center' }}>{message}</Text></View>;
}
