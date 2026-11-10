import { Text, View } from 'react-native';
import type { ScoringSegment } from '../domain/simulation-learning-types';
import { mediaClock } from '../simulation-navigation';
import { SimulationGlyph, simulationStyles as s } from './simulation-ui';

function paragraphs(value: string): string[] {
  return value.replace(/\r\n/g, '\n').replace(/\s+\|\s+/g, '\n').replace(/\s+(?=\d+\.\s)/g, '\n').split(/\n+/).map(text => text.trim()).filter(Boolean);
}
export function SimulationScenarioDescription({ number, title }: { number: number; title: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
    <View style={{ paddingTop: 2 }}><SimulationGlyph kind="question" size={25} color="#176BD0" /></View>
    <Text style={{ flex: 1, fontSize: 18, lineHeight: 27, color: '#374151' }}><Text style={{ fontWeight: '600', color: '#111827' }}>Tình huống {number}: </Text>{title}</Text>
  </View>;
}
export function SimulationHint({ hazardSign, recognitionTip }: { hazardSign: string; recognitionTip: string }) {
  const lines = [...new Set([...paragraphs(recognitionTip), ...paragraphs(hazardSign)])];
  if (!lines.length) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 11 }}>
    <View style={{ paddingTop: 2 }}><SimulationGlyph kind="hint" size={25} color="#176BD0" /></View>
    <View style={{ flex: 1, gap: 8 }}>{lines.map((text, index) => <Text key={index} style={{ fontSize: 18, lineHeight: 27, color: '#374151' }}>{index === 0 && <Text style={{ fontWeight: '600', color: '#111827' }}>Gợi ý: </Text>}{text}</Text>)}</View>
  </View>;
}
export function SimulationAnalysis({ score, maxScore, firstResponseMs, durationMs, segments, hazardSign, recognitionTip }: {
  score: number; maxScore: number; firstResponseMs: number | null; durationMs: number; segments: ScoringSegment[]; hazardSign: string; recognitionTip: string;
}) {
  const colors = ['#D1D5DB', '#FCA5A5', '#FDBA74', '#FCD34D', '#86EFAC', '#22C55E'];
  return <View style={{ gap: 14 }}>
    <SimulationHint hazardSign={hazardSign} recognitionTip={recognitionTip} />
    <View style={[s.card, { backgroundColor: '#F3F7FD', borderColor: '#DDE7F5', gap: 14 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><SimulationGlyph kind="check" size={22} color="#176BD0" /></View>
        <Text style={[s.title, { flex: 1 }]}>Kết quả tình huống</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Text style={s.body}>Điểm</Text><Text style={[s.body, { color: '#111827', fontWeight: '600' }]}>{score}/{maxScore} điểm</Text>
      </View>
      <View style={{ borderTopWidth: 1, borderColor: '#DDE7F5', paddingTop: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ paddingTop: 4 }}><SimulationGlyph kind="flag" size={17} color="#176BD0" /></View>
        <Text style={[s.body, { flex: 1 }]}>{firstResponseMs === null ? 'Chưa ghi nhận phản ứng trong lượt này.' : `Thời điểm phản ứng: ${mediaClock(firstResponseMs)} (${(firstResponseMs / 1000).toFixed(3)} giây)`}</Text>
      </View>
    </View>
    <View style={[s.card, { gap: 10 }]}><Text style={s.title}>Khoảng chấm điểm</Text>
      <View style={{ height: 16, borderRadius: 5, backgroundColor: '#F3F4F6', overflow: 'hidden' }}>
        {segments.map((segment, index) => <View key={index} style={{ position: 'absolute', top: 0, bottom: 0, left: `${segment.startMs * 100 / durationMs}%`, width: `${(segment.endMs - segment.startMs) * 100 / durationMs}%`, backgroundColor: colors[Math.min(segment.score, colors.length - 1)] }} />)}
      </View>
      {segments.map((segment, index) => <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: colors[Math.min(segment.score, colors.length - 1)] }} /><Text style={[s.small, { flex: 1 }]}>{(segment.startMs / 1000).toFixed(2)}–{(segment.endMs / 1000).toFixed(2)} giây</Text><Text style={[s.small, { fontWeight: '600', color: '#374151' }]}>{segment.score} điểm</Text></View>)}
    </View>
  </View>;
}
