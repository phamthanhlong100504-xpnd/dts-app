import { userMessage } from '../../shared/user-message';
import { SymbolView } from 'expo-symbols';
import { Stack, router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StudyAccess } from '../../session/components/study-access';
import { StudyLicensePicker } from '../../session/components/study-license-picker';
import { useLearnerSession } from '../../session/session-store';
import { useLearnerResource } from '../../session/use-learner-resource';
import { getHistoryOverview, type HistoryActivity, type HistoryItem } from '../history-service';
import { historyCalendarDate, historyDate, historyDuration, historyTitle } from '../history-format';

function SummaryCell({ value, label, icon }: { value: number | null; label: string; icon: 'total' | 'passed' | 'failed' }) {
  const color = icon === 'total' ? '#0877F9' : icon === 'passed' ? '#16A34A' : '#EF4444';
  return <View className="flex-1 items-center justify-center px-1">
    <SymbolView name={icon === 'total' ? { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' } :
      icon === 'passed' ? { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' } :
        { ios: 'xmark.circle', android: 'cancel', web: 'cancel' }} size={26} tintColor={color} />
    <Text className="mt-2 text-xl font-semibold text-gray-900">{value ?? '—'}</Text>
    <Text className="mt-1 text-center text-base text-gray-900">{label}</Text>
  </View>;
}
function HistoryCard({ item }: { item: HistoryItem }) {
  const passed = item.result === 'PASSED';
  // History supplies the total and correct count, not an answered-wrong count.
  // This remainder includes unanswered questions, so label it "chưa đúng".
  const notCorrect = item.correctCount !== null && item.questionCount !== null ? item.questionCount - item.correctCount : null;
  return <Pressable accessibilityRole="button"
    onPress={() => router.push({ pathname: '/history/[resultId]', params: { resultId: item.id } })}
    accessibilityLabel={`${historyTitle(item)}, Hạng ${item.licenseClass}, ${passed ? 'Đạt' : 'Chưa đạt'}, ${historyDate(item.completedAt)}. Xem bài làm`}
    className="mb-3 rounded-2xl border border-blue-300 bg-white p-4">
    <View className="flex-row items-start">
      <View className="mr-3 pt-0.5">
        <SymbolView name={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }} size={25} tintColor="#0877F9" />
      </View>
      <View className="mr-2 flex-1">
        <Text className="text-lg font-semibold leading-6 text-gray-900">{historyTitle(item)}</Text>
        <Text className="mt-1 text-sm text-gray-700">Hạng {item.licenseClass}</Text>
      </View>
      <View className="rounded-full px-3 py-1" style={{ backgroundColor: passed ? '#DCFCE7' : '#FEE2E2' }}>
        <Text className="text-sm font-bold" style={{ color: passed ? '#15803D' : '#DC2626' }}>{passed ? 'ĐẠT' : 'CHƯA ĐẠT'}</Text>
      </View>
    </View>
    <View className="mt-4 flex-row items-center">
      <View className="flex-1 flex-row items-center">
        <SymbolView name={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }} size={21} tintColor="#16A34A" />
        <Text className="ml-2 flex-1 text-base text-gray-900">{item.correctCount ?? '—'} đúng</Text>
      </View>
      <View className="mr-2 flex-1 flex-row items-center">
        <SymbolView name={{ ios: 'xmark.circle', android: 'cancel', web: 'cancel' }} size={21} tintColor="#EF4444" />
        <Text className="ml-2 flex-1 text-base text-gray-900">{notCorrect ?? '—'} chưa đúng</Text>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={17} tintColor="#111827" />
    </View>
    <View className="mt-4 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <View className="flex-row items-center">
        <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={20} tintColor="#0877F9" />
        <Text className="ml-2 text-sm text-blue-600">{historyDuration(item.durationSeconds)}</Text>
      </View>
      <View className="flex-row items-center">
        <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={20} tintColor="#111827" />
        <Text className="ml-2 text-sm text-gray-900">{historyCalendarDate(item.completedAt)}</Text>
      </View>
    </View>
  </Pressable>;
}
function HistoryContent({ licenseClass }: { licenseClass: string }) {
  const [activity, setActivity] = useState<HistoryActivity>('RANDOM_EXAM');
  const [page, setPage] = useState(0);
  const key = JSON.stringify([activity, page]);
  const loader = useCallback(() => getHistoryOverview(licenseClass, { activity, outcome: 'ALL', period: 'ALL', page }), [licenseClass, activity, page]);
  const { data, loading, error, reload } = useLearnerResource('history:' + key, loader);
  return <>
    <Stack.Screen options={{ headerShown: true, title: 'Lịch sử làm bài', headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: true, headerRight: () => <StudyLicensePicker /> }} />
    <ScrollView key={key} className="flex-1 bg-white" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <View className="mb-4 flex-row items-center rounded-2xl bg-gray-100 px-3 py-5">
        <SummaryCell value={data?.summary.total ?? null} label="Lần thi" icon="total" />
        <View className="h-16 w-px bg-blue-300" />
        <SummaryCell value={data?.summary.passed ?? null} label="Đạt" icon="passed" />
        <View className="h-16 w-px bg-blue-300" />
        <SummaryCell value={data?.summary.failed ?? null} label="Chưa đạt" icon="failed" />
      </View>
      <View className="mb-4 flex-row rounded-xl bg-gray-100 p-1">
        {([['RANDOM_EXAM', 'Ngẫu nhiên'], ['PRESET_EXAM', 'Bộ đề có sẵn']] as const).map(([value, label]) =>
          <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: activity === value }}
            onPress={() => { setActivity(value); setPage(0); }} className="min-h-11 flex-1 items-center justify-center rounded-lg"
            style={{ backgroundColor: activity === value ? '#0877F9' : 'transparent' }}>
            <Text className="font-semibold" style={{ fontSize: 16.5, color: activity === value ? '#FFFFFF' : '#374151' }}>{label}</Text>
          </Pressable>)}
      </View>
      {loading && <ActivityIndicator color="#0877F9" />}
      {error && <View className="mb-3 rounded-xl bg-red-50 p-4"><Text selectable className="text-base text-red-700">{userMessage(error)}</Text>
        <Pressable accessibilityRole="button" onPress={reload} className="mt-2 min-h-11 justify-center"><Text className="text-base font-semibold text-blue-700">Thử lại</Text></Pressable></View>}
      {data && <>
        {!data.items.length && <View className="mt-4 items-center rounded-2xl bg-gray-100 p-6">
          <Text className="text-center text-lg font-semibold text-gray-900">Chưa có lịch sử phù hợp</Text>
          <Text className="mt-2 text-center text-base leading-6 text-gray-600">Các bài đã hoàn thành và được công bố kết quả sẽ xuất hiện tại đây.</Text>
        </View>}
        {data.items.map((item) => <HistoryCard key={item.id} item={item} />)}
        <View className="mt-3 flex-row items-center justify-between">
          <Pressable accessibilityRole="button" disabled={page === 0} onPress={() => setPage((value) => value - 1)}
            className="min-h-11 justify-center px-2" style={{ opacity: page === 0 ? 0.4 : 1 }}><Text className="text-base font-semibold text-blue-700">Trang trước</Text></Pressable>
          <Text className="text-base text-gray-700">{data.totalPages ? page + 1 : 0}/{data.totalPages}</Text>
          <Pressable accessibilityRole="button" disabled={page + 1 >= data.totalPages} onPress={() => setPage((value) => value + 1)}
            className="min-h-11 justify-center px-2" style={{ opacity: page + 1 >= data.totalPages ? 0.4 : 1 }}><Text className="text-base font-semibold text-blue-700">Trang tiếp</Text></Pressable>
        </View>
      </>}
    </ScrollView>
  </>;
}
function LicensedHistory() {
  const licenseClass = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  return <HistoryContent key={licenseClass} licenseClass={licenseClass} />;
}
export default function HistoryScreen() { return <StudyAccess><LicensedHistory /></StudyAccess>; }
