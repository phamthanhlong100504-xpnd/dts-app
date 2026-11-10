import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SimulationGlyph } from './simulation-ui';

export function SimulationModeCard({ kind, onPress }: { kind: 'random' | 'preset'; onPress: () => void }) {
  const [pressed, setPressed] = useState(false), random = kind === 'random';
  return <Pressable accessibilityRole="button" onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ padding: 18, minHeight: 124, borderRadius: 16, borderWidth: 1, borderColor: random ? '#D9E7FF' : '#E6DCFB', backgroundColor: random ? '#EAF2FF' : '#F1EBFF', flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.78 : 1 }}>
    <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><SimulationGlyph kind={kind} size={29} color={random ? '#2563EB' : '#7C3AED'} /></View>
    <View style={{ flex: 1, gap: 6 }}><Text style={{ fontSize: 17, lineHeight: 25, fontWeight: '600', color: '#172338' }}>{random ? 'Thi thử ngẫu nhiên' : 'Thi thử bộ đề'}</Text><Text style={{ fontSize: 15, lineHeight: 22, color: '#475569' }}>{random ? 'Luyện phản xạ với các tình huống được chọn ngẫu nhiên.' : 'Chọn một bộ đề để luyện tập.'}</Text></View>
    <SimulationGlyph kind="next" size={16} color={random ? '#2563EB' : '#7C3AED'} />
  </Pressable>;
}
export function SimulationExamInformation({ totalScenarios, maxScore, passingScore }: { totalScenarios: number; maxScore: number; passingScore: number }) {
  const rows = [['Số lượng tình huống', `${totalScenarios} TÌNH HUỐNG`], ['Điểm tối đa', `${maxScore} ĐIỂM`], ['Điểm đạt tối thiểu', `${passingScore} ĐIỂM`]];
  const steps = ['Xem video và chạm SPACE ngay khi phát hiện nguy hiểm. Mỗi tình huống ghi nhận phản ứng đầu tiên.', 'Có thể bỏ qua 10 giây đầu khi nút này hiển thị. Sau khi phản ứng được xác nhận, nhấn icon tiếp để sang tình huống mới.', 'Hoàn thành các tình huống rồi nộp bài để xem điểm và giải thích.'];
  return <>
    <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#536174', marginBottom: 12 }}>THÔNG TIN BÀI THI</Text>
    <View style={{ borderRadius: 16, backgroundColor: '#F3F4F6', paddingHorizontal: 16, marginBottom: 28 }}>
      {rows.map(([label, value], index) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: '#DEE2E8' }}><Text style={{ flex: 1, fontSize: 16, lineHeight: 24, color: '#253247' }}>{label}</Text><Text style={{ maxWidth: '48%', fontSize: 17, lineHeight: 25, fontWeight: '700', color: '#1264C0', textAlign: 'right' }}>{value}</Text></View>)}
    </View>
    <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: '600', color: '#536174', marginBottom: 12 }}>CÁCH LÀM BÀI</Text>
    <View style={{ borderRadius: 16, backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: '#E5E9EF', padding: 16, gap: 17 }}>
      {steps.map((text, index) => <View key={text} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}><View style={{ width: 25, height: 25, borderRadius: 8, backgroundColor: '#E7EFFB', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#176BD0' }}>{index + 1}</Text></View><Text style={{ flex: 1, fontSize: 16, lineHeight: 25, color: '#374151' }}>{text}</Text></View>)}
    </View>
  </>;
}
