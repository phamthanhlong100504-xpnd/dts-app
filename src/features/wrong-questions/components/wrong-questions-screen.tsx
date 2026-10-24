import { userMessage } from '../../shared/user-message';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { StudyAccess } from '../../session/components/study-access';
import { QuestionPickerButton } from '../../shared/question-sheet';
import { studyCardBodyText } from '../../shared/study-typography';
import { WrongQuestionNavigator } from './wrong-question-navigator';
import { useLearnerSession } from '../../session/session-store';
import { useLearnerResource } from '../../session/use-learner-resource';
import { filterWrongQuestions, getWrongOverview, isWrongFilter, type WrongFilter } from '../wrong-service';

const FILTERS: { key: WrongFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' }, { key: 'theory', label: 'Lý thuyết' }, { key: 'signs', label: 'Biển báo' },
  { key: 'situations', label: 'Sa hình' }, { key: 'critical', label: 'Điểm liệt' },
];
function WrongQuestionsContent({ licenseClass, initialFilter }: { licenseClass: string; initialFilter: WrongFilter }) {
  const [filter, setFilter] = useState<WrongFilter>(initialFilter);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const loader = useCallback(() => getWrongOverview(licenseClass), [licenseClass]);
  const { data, loading, error, reload } = useLearnerResource('wrong-questions', loader);
  const rows = data ? filterWrongQuestions(data.questions, filter) : [];
  function openQuestion(id: number) {
    router.push({ pathname: '/wrong-questions/[questionId]', params: { questionId: String(id), licenseClass, filter } });
  }
  return <>
    <Stack.Screen options={{ headerShown: true, title: 'Các câu đã sai', headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: true, headerRight: () => <QuestionPickerButton open={navigatorOpen} disabled={loading || !!error || !rows.length} onPress={() => setNavigatorOpen(true)} /> }} />
    <View className="flex-1 bg-white">
      <View style={{ paddingTop: 12, paddingBottom: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {FILTERS.map((item) => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: filter === item.key }}
            onPress={() => { setNavigatorOpen(false); setFilter(item.key); router.setParams({ filter: item.key }); }}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 15,
              backgroundColor: filter === item.key ? '#0877F9' : '#EFF6FF' }}>
            <Text className="text-base font-semibold" style={{ fontSize: 16, color: filter === item.key ? '#FFFFFF' : '#1D4ED8' }}>{item.label}</Text>
          </Pressable>)}
        </ScrollView>
      </View>
      <FlatList key={filter} className="flex-1" data={rows} keyExtractor={(row) => String(row.question.id)}
        refreshing={loading} onRefresh={reload} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 }}
        ListHeaderComponent={error ? <View className="mb-4 rounded-xl bg-red-50 p-4"><Text selectable className="text-base text-red-700">{userMessage(error)}</Text>
          <Pressable accessibilityRole="button" onPress={reload} className="mt-2 min-h-11 justify-center">
            <Text className="text-base font-semibold text-blue-700">Thử lại</Text>
          </Pressable></View> : null}
        ListEmptyComponent={loading ? <ActivityIndicator color="#0877F9" /> : !error && data ?
          <View className="mt-4 items-center rounded-2xl bg-gray-100 p-6">
            <Text className="text-center text-lg font-semibold text-gray-900">{data.total ? 'Không có câu nào trong bộ lọc này' : 'Bạn chưa có câu cần ôn'}</Text>
            <Text className="mt-2 text-center text-base leading-6 text-gray-600">Danh sách được cập nhật theo kết quả đã lưu trên hệ thống.</Text>
          </View> : null}
        renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Xem câu ${item.sourceNumber ?? item.question.id}`}
          onPress={() => openQuestion(item.question.id)}
          className="rounded-2xl border border-gray-200 bg-gray-100 p-4" style={{ marginBottom: 16 }}>
          <Text style={studyCardBodyText}>Câu {item.sourceNumber ?? item.question.id}: {item.question.text}</Text>
        </Pressable>} />
    </View>
    <WrongQuestionNavigator rows={rows} open={navigatorOpen} close={() => setNavigatorOpen(false)}
      disabled={loading || !!error} onSelect={openQuestion} />
  </>;
}
function LicensedWrongQuestions() {
  const licenseClass = useLearnerSession((state) => state.session!.profile.selectedLicenseClass!);
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  return <WrongQuestionsContent key={licenseClass} licenseClass={licenseClass} initialFilter={isWrongFilter(filter) ? filter : 'all'} />;
}
export default function WrongQuestionsScreen() { return <StudyAccess><LicensedWrongQuestions /></StudyAccess>; }
