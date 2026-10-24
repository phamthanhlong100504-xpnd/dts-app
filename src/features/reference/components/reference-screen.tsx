import { BottomSheet } from '../../shared/question-sheet';
import { useCallback, useState } from 'react';
import { Stack } from 'expo-router';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useSignFilters } from '../use-sign-filters';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudyAccess } from '../../session/components/study-access';
import { useLearnerResource } from '../../session/use-learner-resource';
import { AppButton, Message } from '../../shared/ui';
import { studyCardBodyText, studyCardTitleText } from '../../shared/study-typography';
import { getMediaImage, getSign, getSigns, getTips, type Sign } from '../reference-service';
function SignImage({ id }: { id: string }) {
  const loader = useCallback(() => getMediaImage(id), [id]); const { data, loading, error, reload } = useLearnerResource('sign-media:' + id, loader); const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = !!data && failedUrl === data;
  return <View style={{ width: '100%', height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
    {loading && <ActivityIndicator color="#0877F9" />}
    {data && !failed && <Image source={{ uri: data }} contentFit="contain" style={{ width: '100%', height: '100%' }} onError={() => setFailedUrl(data)} accessibilityLabel="Ảnh biển báo giao thông" />}
    {(error || failed) && <Pressable accessibilityRole="button" onPress={() => { setFailedUrl(null); reload(); }} style={{ padding: 10 }}><Text style={{ fontSize: 13, color: '#4B5563', textAlign: 'center' }}>Chưa tải được ảnh. Bấm để thử lại.</Text></Pressable>}
  </View>;
}
function SignDetail({ id, close }: { id: string; close: () => void }) {
  const loader = useCallback(() => getSign(id), [id]), resource = useLearnerResource('sign-detail:' + id, loader), insets = useSafeAreaInsets();
  return <BottomSheet visible close={close} topInset={insets.top + 30}
    panelStyle={{ maxHeight: '95%', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 0, paddingBottom: 0 }}
    contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
    {resource.loading && <ActivityIndicator color="#0877F9" />}{resource.error && <><Message>{resource.error}</Message><AppButton secondary label="Thử lại" onPress={resource.reload} /></>}
    {resource.data && <><SignImage id={resource.data.mediaFileId} /><Text style={{ marginTop: 16, fontSize: 21, fontWeight: '600', color: '#111827' }}>{resource.data.code} · {resource.data.name}</Text><Text style={{ marginTop: 8, color: '#4B5563', fontSize: 15 }}>{resource.data.groupName}</Text><Text style={{ marginTop: 20, fontSize: 17, color: '#111827', fontWeight: '600' }}>Ý nghĩa</Text><Text style={{ fontSize: 16, color: '#374151', lineHeight: 26, marginTop: 8 }}>{resource.data.meaning}</Text>{resource.data.memoryTip && <><Text style={{ fontSize: 17, fontWeight: '600', color: '#111827', marginTop: 18 }}>Mẹo ghi nhớ</Text><Text style={{ fontSize: 16, lineHeight: 26, color: '#4B5563', marginTop: 8 }}>{resource.data.memoryTip}</Text></>}</>}
  </BottomSheet>;
}
function SignsContent() {
  const { group, query, setQuery, search, page, chooseGroup, choosePage } = useSignFilters();
  const [selected, setSelected] = useState<string | null>(null);
  const loader = useCallback(() => getSigns(group, search, page), [group, search, page]), resource = useLearnerResource(JSON.stringify(['signs', group, search, page]), loader), insets = useSafeAreaInsets();
  const data = resource.data;
  const render = ({ item }: { item: Sign }) => <Pressable accessibilityRole="button" onPress={() => setSelected(item.id)} style={{ flex: 1, maxWidth: '49%', borderWidth: 1, borderColor: '#D0D5DD', backgroundColor: '#FFFFFF', borderRadius: 15, padding: 12, marginBottom: 12 }}><SignImage id={item.mediaFileId} /><Text style={{ fontSize: 14, color: '#0877F9', fontWeight: '600', textAlign: 'center', marginTop: 10 }}>{item.code}</Text><Text style={{ fontSize: 16, color: '#111827', lineHeight: 24, textAlign: 'center', marginTop: 7 }}>{item.name}</Text></Pressable>;
  return <>
    <Stack.Screen options={{ title: 'Các biển báo', headerShown: true, headerTitleAlign: 'center' }} />
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
        <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 12, gap: 8, backgroundColor: '#F3F4F6' }}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor="#6B7280" />
          <TextInput accessibilityLabel="Tìm biển báo" placeholder="Tìm tên hoặc mã biển báo" placeholderTextColor="#6B7280"
            value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} returnKeyType="search" underlineColorAndroid="transparent"
            style={{ flex: 1, minHeight: 44, fontSize: 16, color: '#111827', paddingVertical: 8 }} />
          {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm" onPress={() => setQuery('')}
            style={{ width: 32, height: 40, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolView name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={18} tintColor="#6B7280" />
          </Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
          {[{ code: '', name: 'Tất cả' }, ...(data?.groups ?? [])].map((g) => <Pressable key={g.code} accessibilityRole="button"
            accessibilityState={{ selected: group === g.code }} onPress={() => chooseGroup(g.code)}
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingHorizontal: 15,
              backgroundColor: group === g.code ? '#0877F9' : '#EFF6FF' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: group === g.code ? '#FFFFFF' : '#1D4ED8' }}>{g.name}</Text>
          </Pressable>)}
        </ScrollView>
      </View>
      {resource.error && <View style={{ padding: 16 }}><Message>{resource.error}</Message><AppButton secondary label="Thử lại" onPress={resource.reload} /></View>}
      <FlatList data={data?.items ?? []} numColumns={2} columnWrapperStyle={{ gap: 12 }} keyExtractor={(item) => item.id} renderItem={render} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20, flexGrow: 1 }} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />}
        ListHeaderComponent={data ? <Text style={{ fontSize: 14, color: '#4B5563', marginBottom: 12 }}>{data.total} biển báo</Text> : null}
        ListEmptyComponent={resource.loading ? <ActivityIndicator color="#0877F9" /> : !resource.error ? <Text style={{ fontSize: 16, color: '#4B5563' }}>Không có biển báo phù hợp.</Text> : null}
        ListFooterComponent={data && data.pages > 1 ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}><AppButton secondary label="Trước" disabled={page === 0} onPress={() => choosePage(page - 1)} /><Text style={{ fontSize: 14, color: '#374151' }}>{page + 1}/{data.pages}</Text><AppButton secondary label="Tiếp" disabled={page + 1 >= data.pages} onPress={() => choosePage(page + 1)} /></View> : null} />
    </View>{selected && <SignDetail id={selected} close={() => setSelected(null)} />}
  </>;
}
export function formatTipText(value: string) {
  return value.replace(/\s*\|\s*/gu, '\n').replace(/\s+(?=\d+[.)]\s)/gu, '\n');
}
function TipsContent() {
  const loader = useCallback(() => getTips(), []), resource = useLearnerResource('memory-tips', loader), [open, setOpen] = useState<string | null>(null), insets = useSafeAreaInsets();
  return <><Stack.Screen options={{ title: 'Mẹo ghi nhớ', headerShown: true, headerTitleAlign: 'center' }} /><ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />}>
    {resource.error && <><Message>{resource.error}</Message><AppButton secondary label="Thử lại" onPress={resource.reload} /></>}{resource.loading && <ActivityIndicator color="#0877F9" />}
    {resource.data?.length === 0 && <Text style={{ fontSize: 16, color: '#4B5563' }}>Chưa có mẹo ghi nhớ được phát hành.</Text>}
    {resource.data?.map((tip) => <View key={tip.id} style={{ borderWidth: 1, borderColor: '#DDE2E8', borderRadius: 15, backgroundColor: '#FFFFFF', marginBottom: 14, overflow: 'hidden' }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: open === tip.id }} onPress={() => setOpen(open === tip.id ? null : tip.id)} style={{ padding: 16 }}><Text style={studyCardTitleText}>{tip.title}</Text><Text style={{ ...studyCardBodyText, marginTop: 9 }}>{formatTipText(tip.quickRule)}</Text></Pressable>{open === tip.id && <View style={{ padding: 16, paddingTop: 0 }}><Text style={studyCardBodyText}>{formatTipText(tip.explanation)}</Text></View>}</View>)}
  </ScrollView></>;
}
export default function ReferenceScreen({ kind }: { kind: 'signs' | 'tips' }) { return <StudyAccess>{kind === 'signs' ? <SignsContent /> : <TipsContent />}</StudyAccess>; }
