import { Stack, router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { StudyAccess } from '../../session/components/study-access';
import { StudyLicensePicker } from '../../session/components/study-license-picker';
import { useChapterOverview } from '../use-chapter-overview';
import { useQuestionSearch } from '../use-question-search';
import type { StudyTarget } from '../study-types';

const ROMAN: Record<number, string> = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
function ProgressBar({ correct, wrong, total }: { correct: number; wrong: number; total: number }) {
  const remaining = total - correct - wrong;
  return <View className="mt-4 h-3 flex-row overflow-hidden rounded-md bg-gray-300">
    {correct > 0 && <View style={{ flex: correct, backgroundColor: '#50C878' }} />}
    {wrong > 0 && <View style={{ flex: wrong, backgroundColor: '#F36B6B' }} />}
    {remaining > 0 && <View style={{ flex: remaining, backgroundColor: '#BEC3C9' }} />}
  </View>;
}
function Stat({ label, value, color }: { label: string; value: number | null; color: string }) {
  return <View className="flex-row items-center" style={{ columnGap: 6 }}>
    <View className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
    <Text className="text-base font-semibold" style={{ color }}>{label} {value ?? '—'}</Text>
  </View>;
}
function Stats({ correct, wrong, total }: { correct: number; wrong: number; total: number }) {
  return <View className="mt-4 flex-row flex-wrap items-center justify-between" style={{ columnGap: 8, rowGap: 8 }}>
    {correct + wrong > 0 ? <>
      <Stat label="Đúng" value={correct} color="#228B56" />
      <Stat label="Sai" value={wrong} color="#D95353" />
    </> : <Text className="text-base text-gray-600">Chưa làm câu nào</Text>}
    <Stat label="Còn" value={total - correct - wrong} color="#66707C" />
  </View>;
}
function actionLabel(learned: number, total: number) {
  return total === 0 ? 'Chưa có câu hỏi' : learned === total ? 'Ôn tập lại' : learned > 0 ? 'Tiếp tục học' : 'Bắt đầu học';
}
function ActionLabel({ learned, total }: { learned: number; total: number }) {
  return <Text className="mt-3 min-h-11 self-end py-3 text-base font-semibold text-blue-600">{actionLabel(learned, total)} ›</Text>;
}
function ChaptersContent() {
  const { data, loading, error, reload } = useChapterOverview();
  const [query, setQuery] = useState('');
  const search = useQuestionSearch(query, data);
  function open(target: StudyTarget, learned: number, total: number, questionId?: number) {
    if (!data || total === 0) return;
    router.push({ pathname: '/practice/[chapterId]', params: { chapterId: String(target), licenseClass: data.licenseClass,
      mode: questionId ? 'learn' : learned === total ? 'review' : 'learn',
      ...(questionId ? { questionId: String(questionId) } : {}) } });
  }
  return <>
    <Stack.Screen options={{ headerShown: true, title: 'Danh sách chương', headerTitleAlign: 'center', headerBackButtonDisplayMode: 'minimal',
      headerShadowVisible: true, headerRight: () => <StudyLicensePicker /> }} />
    <View className="flex-1 bg-white">
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 12,
          paddingHorizontal: 12, gap: 8, backgroundColor: '#F3F4F6' }}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor="#6B7280" />
          <TextInput accessibilityLabel="Tìm kiếm nội dung câu hỏi" placeholder="Tìm kiếm nội dung câu hỏi"
            placeholderTextColor="#6B7280" value={query} onChangeText={setQuery} editable={!loading && !!data}
            autoCapitalize="none" autoCorrect={false} returnKeyType="search" underlineColorAndroid="transparent"
            style={{ flex: 1, minHeight: 44, fontSize: 16, color: '#111827', paddingVertical: 8 }} />
          {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => setQuery('')}
            style={{ width: 32, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={18} tintColor="#6B7280" />
          </Pressable>}
        </View>
      </View>
      {!loading && !error && data && query.trim() ?
        <FlatList data={search.results} keyExtractor={(row) => String(row.question.id)} keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
          ListHeaderComponent={<Text className="mb-3 text-base font-semibold text-gray-700">
            {search.loading ? 'Đang tìm trong bộ câu hỏi...' : search.error ? 'Chưa tìm được câu hỏi' : `${search.results.length} câu phù hợp · Hạng ${data.licenseClass}`}
          </Text>}
          ListEmptyComponent={search.loading ? <ActivityIndicator color="#0877F9" /> : search.error ?
            <View className="rounded-xl bg-red-50 p-4"><Text className="text-base text-red-700">{search.error}</Text>
              <Pressable accessibilityRole="button" onPress={search.reload} className="mt-2 min-h-11 justify-center">
                <Text className="text-base font-semibold text-blue-700">Thử tìm lại</Text>
              </Pressable></View> : <Text className="text-base leading-6 text-gray-600">Không có câu hỏi phù hợp. Thử từ khóa khác.</Text>}
          renderItem={({ item }) => <Pressable accessibilityRole="button"
            accessibilityLabel={`Mở câu ${item.position}: ${item.question.text}`}
            onPress={() => open(item.chapterId, 0, 1, item.question.id)} className="mb-3 rounded-2xl bg-gray-100 p-4">
            <Text className="mb-2 text-sm font-semibold text-blue-700">Câu {item.position} · Chương {ROMAN[item.chapterId] ?? item.chapterId}</Text>
            <Text className="text-lg leading-7 text-gray-900">{item.question.text}</Text>
          </Pressable>} /> :
        <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {loading ? <ActivityIndicator size="large" color="#0877F9" /> : error ?
            <View className="rounded-2xl bg-red-50 p-4">
              <Text selectable className="text-base text-red-700">{error}</Text>
              <Pressable accessibilityRole="button" className="mt-3 min-h-11 justify-center" onPress={reload}>
                <Text className="text-base font-semibold text-blue-700">Thử lại</Text>
              </Pressable>
            </View> : data ? <>
              <Pressable accessibilityRole="button" accessibilityLabel="Mở toàn bộ câu hỏi" disabled={data.total === 0}
                onPress={() => open('all', data.learned, data.total)} className="mb-3 rounded-2xl bg-gray-100 p-4">
                <Text className="text-lg font-bold text-gray-900">Hạng {data.licenseClass} · {data.total} câu hỏi</Text>
                <ProgressBar correct={data.correct} wrong={data.wrong} total={data.total} />
                <Stats correct={data.correct} wrong={data.wrong} total={data.total} />
                <ActionLabel learned={data.learned} total={data.total} />
              </Pressable>
              {data.chapters.map((chapter) => <Pressable key={chapter.id} accessibilityRole="button"
                accessibilityLabel={`Mở chương ${chapter.id}`} onPress={() => open(chapter.id, chapter.learned, chapter.total)}
                className="mb-3 rounded-2xl bg-gray-100 p-4">
                <View className="flex-row items-start">
                  <Text className="flex-1 text-lg font-bold leading-7 text-gray-900">Chương {ROMAN[chapter.id] ?? chapter.id}. {chapter.name}</Text>
                  <Text className="ml-2 text-base font-semibold text-gray-700">{chapter.learned}/{chapter.total}</Text>
                </View>
                <ProgressBar correct={chapter.correct} wrong={chapter.wrong} total={chapter.total} />
                <Stats correct={chapter.correct} wrong={chapter.wrong} total={chapter.total} />
                <ActionLabel learned={chapter.learned} total={chapter.total} />
              </Pressable>)}
              {data.chapters.length === 0 && <Text className="text-base text-gray-600">Bộ câu hỏi chưa có chương nào.</Text>}
              <Pressable accessibilityRole="button" accessibilityLabel="Mở câu điểm liệt" disabled={data.critical.total === 0}
                onPress={() => open('critical', data.critical.learned, data.critical.total)} className="mt-1 rounded-2xl bg-gray-100 p-4">
                <View className="flex-row items-start">
                  <Text className="flex-1 text-lg font-bold leading-7 text-gray-900">{data.critical.total} câu hỏi về xử lý tình huống mất an toàn giao thông nghiêm trọng</Text>
                  <Text className="ml-2 text-base font-semibold text-gray-700">{data.critical.learned}/{data.critical.total}</Text>
                </View>
                <View className="mt-4 h-3 flex-row overflow-hidden rounded-md bg-gray-300">
                  {data.critical.learned > 0 && <View style={{ flex: data.critical.learned, backgroundColor: '#3B82F6' }} />}
                  {data.critical.total > data.critical.learned && <View style={{ flex: data.critical.total - data.critical.learned, backgroundColor: '#BEC3C9' }} />}
                </View>
                <View className="mt-4 flex-row flex-wrap items-center justify-between" style={{ columnGap: 8, rowGap: 8 }}>
                  {data.critical.learned === 0 ? <Text className="text-base text-gray-600">Chưa làm câu nào</Text> :
                    <Text className="text-base font-semibold text-gray-700">Đã học {data.critical.learned}/{data.critical.total}</Text>}
                  <Stat label="Còn" value={data.critical.total - data.critical.learned} color="#66707C" />
                </View>
                <ActionLabel learned={data.critical.learned} total={data.critical.total} />
              </Pressable>
            </> : null}
        </ScrollView>}
    </View>
  </>;
}
export default function ChaptersScreen() {
  return <StudyAccess><ChaptersContent /></StudyAccess>;
}
