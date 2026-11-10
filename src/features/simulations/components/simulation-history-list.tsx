import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { HistoryEmpty, HistoryPagination, HistoryReadError, SimulationHistoryCard, HistorySummary, type HistoryMode } from '../../history/components/history-presentation';
import { useLearnerResource } from '../../session/use-learner-resource';
import { useSimulationContext } from '../simulation-context';
import { getSimulationHistoryOverview, simulationHistorySessionId, type SimulationHistoryPin } from '../simulation-history-service';
import { openSimulation, resultPath } from '../simulation-navigation';

export function SimulationHistoryList({ mode, controls }: { mode: HistoryMode; controls: ReactNode }) {
  const context = useSimulationContext();
  const [cursor, setCursor] = useState<{ page: number; pin?: SimulationHistoryPin }>({ page: 0 });
  const activity = mode === 'RANDOM' ? 'SIM_RANDOM_EXAM' : 'SIM_PRESET_EXAM';
  const loader = useCallback(async () => {
    if (!context) throw new Error('Vui lòng đăng nhập lại để xem lịch sử.');
    return getSimulationHistoryOverview(context, activity, cursor.page, cursor.pin);
  }, [context, activity, cursor.page, cursor.pin]);
  const { data, loading, error, reload } = useLearnerResource('history-simulation:' + JSON.stringify([mode, cursor]), loader);
  const refresh = () => { setCursor({ page: 0 }); reload(); };
  return <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 14 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
    <HistorySummary summary={data?.summary} />
    {controls}
    {loading && <ActivityIndicator color="#0877F9" />}
    {error && <HistoryReadError error={error} reload={refresh} />}
    {data && <>
      {!data.enabled ? <HistoryEmpty message={`Hạng ${context?.scope.licenseClass ?? ''} không có nội dung mô phỏng.`} /> : <>
        {data.updating && <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 23, color: '#4B5563' }}>Lịch sử đang được cập nhật. Bạn có thể kéo xuống để tải lại các bài vừa hoàn thành.</Text>}
        {!data.items.length && <HistoryEmpty message={data.updating ? 'Đang cập nhật lịch sử. Vui lòng tải lại sau.' : 'Các bài mô phỏng đã nộp sẽ xuất hiện sau khi cập nhật xong.'} />}
        <View>{data.items.map(item => {
          const sourceId = simulationHistorySessionId(item);
          return <SimulationHistoryCard key={item.sessionId} title={item.displayTitle} licenseClass={item.licenseClass} passed={item.result === 'PASSED'}
            metric={`${item.score}/${item.maxScore}`} completedAt={item.completedAt} disabled={!sourceId}
            onPress={() => { if (sourceId) openSimulation(resultPath(sourceId), { from: 'history' }); }} />;
        })}</View>
        <HistoryPagination page={data.page} totalPages={data.totalPages}
          previous={() => { if (data.pin) setCursor({ page: Math.max(0, data.page - 1), pin: data.pin }); }}
          next={() => { if (data.pin && data.totalPages !== null && data.page + 1 < data.totalPages) setCursor({ page: data.page + 1, pin: data.pin }); }} />
      </>}
    </>}
  </ScrollView>;
}
