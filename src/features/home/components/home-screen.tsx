import { useCallback, useState } from 'react';
import { Stack, router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLearnerSession } from '../../session/session-store';
import { StudyAccess } from '../../session/components/study-access';
import { getChapterOverview } from '../../chapter-learning/chapter-service';
import { useLearnerResource } from '../../session/use-learner-resource';
import { reloadLearnerProfile } from '../../session/session-service';
import { AppButton, AppIcon, Message } from '../../shared/ui';
const cards = [
  { title: 'Đề ngẫu nhiên', icon: 'random', route: '/exams', color: '#2563EB', bg: '#EAF2FF', border: '#D9E7FF', description: 'Thi thử theo hạng bằng' },
  { title: 'Thi theo bộ đề', icon: 'preset', route: '/preset-exams', color: '#7C3AED', bg: '#F1EBFF', border: '#E6DCFB', description: 'Luyện từng bộ đề có sẵn' },
  { title: 'Ôn tập câu hỏi', icon: 'study', route: '/chapters', color: '#059669', bg: '#E8F7EF', border: '#D7EDDF', description: 'Học và ôn theo chương' },
  { title: 'Câu điểm liệt', icon: 'critical', route: '/practice/critical', color: '#C97908', bg: '#FFF3DE', border: '#F6E6C7', description: 'Nắm chắc câu quan trọng' },
  { title: 'Các câu bị sai', icon: 'wrong', route: '/wrong-questions', color: '#D34B56', bg: '#FDEDEF', border: '#F5DDE2', description: 'Ôn lại câu đã trả lời sai' },
  { title: 'Các biển báo', icon: 'signs', route: '/traffic-signs', color: '#0B8DA5', bg: '#E7F6FA', border: '#D2EBF1', description: 'Tra cứu biển báo giao thông' },
  { title: 'Mẹo ghi nhớ', icon: 'tips', route: '/memory-tips', color: '#A044BD', bg: '#F8EAF8', border: '#EDD9EF', description: 'Ghi nhớ kiến thức dễ hơn' },
  { title: 'Lịch sử làm bài', icon: 'history', route: '/history', color: '#526680', bg: '#EDF1F7', border: '#DEE5EF', description: 'Xem lại bài và kết quả' },
] as const;
function HomeFeatureCard({ card }: { card: (typeof cards)[number] }) {
  const [pressed, setPressed] = useState(false);
  return <Pressable accessibilityRole="button" onPress={() => router.push(card.route as Href)}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ flex: 1, minWidth: 0, minHeight: 188, paddingHorizontal: 10, paddingVertical: 20, borderRadius: 18,
      borderWidth: 1, borderColor: card.border, backgroundColor: card.bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.78 : 1 }}>
    <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
      <AppIcon name={card.icon} size={32} color={card.color} />
    </View>
    <Text style={{ fontSize: 16, lineHeight: 23, fontWeight: '600', color: '#172338', textAlign: 'center', marginTop: 18 }}>{card.title}</Text>
    <Text style={{ fontSize: 13, lineHeight: 19, color: '#475569', textAlign: 'center', marginTop: 6 }}>{card.description}</Text>
  </Pressable>;
}
function HomeContent() {
  const profile = useLearnerSession((state) => state.session?.profile), insets = useSafeAreaInsets();
  const license = profile?.selectedLicenseClass ?? '';
  const loader = useCallback(async () => { await reloadLearnerProfile(); return getChapterOverview(license); }, [license]);
  const { data, loading, error, reload } = useLearnerResource('home-overview:' + license, loader);
  const percent = data && data.total > 0 ? Math.round(data.learned * 100 / data.total) : null;
  return <>
    <Stack.Screen options={{ title: 'Trang chủ', headerShown: true, headerTitleAlign: 'center', headerBackVisible: false,
      headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Mở hồ sơ cá nhân" onPress={() => router.push('/profile')} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="user" size={30} /></Pressable> }} />
    <ScrollView style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 24, paddingBottom: insets.bottom + 24 }} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}>
      <Text style={{ fontSize: 22, lineHeight: 30, color: '#111827', fontWeight: '700', textAlign: 'center', marginBottom: 36 }}>{data ? `${data.total} câu GPLX` : 'Ôn luyện GPLX'} Hạng {profile?.selectedLicenseClass}</Text>
      <View style={{ backgroundColor: '#F3F4F6', borderRadius: 18, padding: 16, marginBottom: 36 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <AppIcon name="progress" size={22} />
          <Text style={{ flex: 1, fontSize: 16, lineHeight: 23, color: '#111827', fontWeight: '600' }}>Tiến độ học tập</Text>
          <Text style={{ fontSize: 16, color: '#111827', fontWeight: '600' }}>{data ? `${data.learned}/${data.total}` : '—'}</Text>
        </View>
        {loading ? <ActivityIndicator color="#0877F9" style={{ marginVertical: 18 }} /> : error ? <><Message>{error}</Message><AppButton label="Thử lại" secondary onPress={reload} /></> : <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 15 }}><View style={{ flex: 1, height: 9, backgroundColor: '#D1D5DB', borderRadius: 6, overflow: 'hidden' }}>{percent !== null && <View style={{ width: `${percent}%`, height: '100%', backgroundColor: '#0877F9' }} />}</View><Text style={{ fontSize: 14, color: '#374151', fontWeight: '500' }}>{percent === null ? '—' : `${percent}%`}</Text></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 13 }}><Text style={{ fontSize: 15, color: '#228B56', fontWeight: '500' }}>● Đúng {data?.correct ?? '—'}</Text><Text style={{ fontSize: 15, color: '#D95353', fontWeight: '500' }}>● Sai {data?.wrong ?? '—'}</Text></View>
        </>}
      </View>
      {[0, 2, 4, 6].map((start) => <View key={start} style={{ flexDirection: 'row', alignItems: 'stretch', gap: 18, marginBottom: 18 }}>
        {cards.slice(start, start + 2).map((card) => <HomeFeatureCard key={card.title} card={card} />)}
      </View>)}
    </ScrollView>
  </>;
}
export default function HomeScreen() { return <StudyAccess><HomeContent /></StudyAccess>; }
