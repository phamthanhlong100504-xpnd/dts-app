import { SymbolView } from 'expo-symbols';
import { Stack, router } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StudyAccess } from '../../session/components/study-access';
import { StudyLicensePicker } from '../../session/components/study-license-picker';
import { useLearnerSession } from '../../session/session-store';
import { useLearnerResource } from '../../session/use-learner-resource';
import { SimulationHistoryList } from '../../simulations/components/simulation-history-list';
import { getHistoryOverview, type HistoryItem } from '../history-service';
import { historyCalendarDate, historyDate, historyDuration, historyTitle } from '../history-format';
import { HistoryEmpty, HistoryPagination, HistoryReadError, HistorySummary, HistoryTabs, type HistoryMode, type HistoryModule } from './history-presentation';

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
function TheoryHistoryList({ licenseClass, mode, controls }: { licenseClass: string; mode: HistoryMode; controls: ReactNode }) {
  const [page, setPage] = useState(0);
  const activity = mode === 'RANDOM' ? 'RANDOM_EXAM' : 'PRESET_EXAM';
  const loader = useCallback(() => getHistoryOverview(licenseClass, { activity, outcome: 'ALL', period: 'ALL', page }), [licenseClass, activity, page]);
  const { data, loading, error, reload } = useLearnerResource('history-theory:' + mode + ':' + page, loader);
  return <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
    <HistorySummary summary={data?.summary} />
    {controls}
    {loading && <ActivityIndicator color="#0877F9" />}
    {error && <HistoryReadError error={error} reload={reload} />}
    {data && <>
      {!data.items.length && <HistoryEmpty />}
      <View>{data.items.map(item => <HistoryCard key={item.id} item={item} />)}</View>
      <HistoryPagination page={page} totalPages={data.totalPages} previous={() => setPage(value => Math.max(0, value - 1))} next={() => setPage(value => value + 1)} />
    </>}
  </ScrollView>;
}
function HistoryContent({ licenseClass }: { licenseClass: string }) {
  const [module, setModule] = useState<HistoryModule>('THEORY'), [mode, setMode] = useState<HistoryMode>('RANDOM');
  const controls = <View style={{ gap: 10 }}>
    <HistoryTabs label="Nội dung lịch sử" options={[[ 'THEORY', 'Lý thuyết' ], [ 'SIMULATION', 'Mô phỏng' ]]} value={module} onSelect={setModule} />
    <HistoryTabs label="Hình thức thi" options={[[ 'RANDOM', 'Ngẫu nhiên' ], [ 'PRESET', 'Bộ đề có sẵn' ]]} value={mode} onSelect={setMode} />
  </View>;
  return <>
    <Stack.Screen options={{ headerShown: true, title: 'Lịch sử làm bài', headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: true, headerRight: () => <StudyLicensePicker /> }} />
    {module === 'THEORY' ? <TheoryHistoryList key={licenseClass + mode} licenseClass={licenseClass} mode={mode} controls={controls} /> :
      <SimulationHistoryList key={licenseClass + mode} mode={mode} controls={controls} />}
  </>;
}
function LicensedHistory() {
  const licenseClass = useLearnerSession(state => state.session!.profile.selectedLicenseClass!);
  return <HistoryContent key={licenseClass} licenseClass={licenseClass} />;
}
export default function HistoryScreen() { return <StudyAccess><LicensedHistory /></StudyAccess>; }
