import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLearnerResource } from '../../session/use-learner-resource';
import { AppButton } from '../../shared/ui';
import { type SimulationContext } from '../simulation-context';
import type { ScenarioListItem, SimulationChapter } from '../domain/simulation-learning-types';
import { readAllChapterScenarios } from '../simulation-chapter-list';
import { openSimulation, scenarioPath } from '../simulation-navigation';
import { SimulationGate, SimulationGlyph, SimulationHeader, SimulationLoading, SimulationNotice, simulationStyles as s } from './simulation-ui';

export function SimulationScenarioCard({ item, onPress }: { item: ScenarioListItem; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Tình huống ${item.number}: ${item.title}`} onPress={onPress} onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
    style={{ borderRadius: 14, borderWidth: 1, borderColor: '#E0E5EC', backgroundColor: pressed ? '#F6F9FD' : '#FFFFFF', padding: 16, gap: 12, shadowColor: '#152C50', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.035, shadowRadius: 5, elevation: 1 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#EDF4FF', alignItems: 'center', justifyContent: 'center' }}><SimulationGlyph kind="video" size={19} /></View>
      <Text style={{ flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '600', color: '#172338' }}>Tình huống {item.number}</Text>
      {item.isPracticed ? <View style={{ paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: '#EAF6EF', flexDirection: 'row', alignItems: 'center', gap: 5 }}><SimulationGlyph kind="check" size={15} color="#25734C" /><Text style={{ fontSize: 14, lineHeight: 20, color: '#25734C', fontWeight: '600' }}>{item.bestScore}/{item.maxScore} điểm</Text></View> : <SimulationGlyph kind="next" size={15} color="#758196" />}
    </View>
    <Text style={{ fontSize: 17, lineHeight: 25, color: '#253247' }}>{item.title}</Text>
  </Pressable>;
}
function ChapterItems({ context, chapter, bankVersion }: { context: SimulationContext; chapter: SimulationChapter; bankVersion: string }) {
  const epoch = useRef(0);
  useFocusEffect(useCallback(() => () => { epoch.current++; }, []));
  const loader = useCallback(async () => {
    const generation = ++epoch.current;
    const items = await readAllChapterScenarios(context.learning, { ...context.scope, bankVersion }, chapter.id, () => generation === epoch.current);
    if (!items) throw new Error('Màn hình đã đóng.');
    return items;
  }, [context, chapter.id, bankVersion]);
  const resource = useLearnerResource(`simulation-chapter-all:${bankVersion}:${chapter.id}`, loader);
  return <View style={{ gap: 12, paddingTop: 12 }}>
    {resource.loading && <SimulationLoading label="Đang tải các tình huống..." />}
    {resource.error ? <SimulationNotice error={resource.error} retry={resource.reload} /> : null}
    {resource.data?.map(item => <SimulationScenarioCard key={item.id} item={item} onPress={() => openSimulation(scenarioPath(item.id), { bankVersion })} />)}
  </View>;
}

function Catalog({ context, bankVersion }: { context: SimulationContext; bankVersion: string }) {
  const insets = useSafeAreaInsets();
  const loader = useCallback(() => context.learning.overview({ ...context.scope, bankVersion }), [context, bankVersion]);
  const resource = useLearnerResource('simulation-overview:' + bankVersion, loader);
  const [expanded, setExpanded] = useState<string | null>(null);
  const overview = resource.data;
  return <View style={s.page}><SimulationHeader title={overview ? `${overview.totalScenarios} tình huống mô phỏng` : 'Tình huống mô phỏng'} />
    <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: 24 }} refreshControl={<RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />}>
      {resource.error && <SimulationNotice error={resource.error} retry={resource.reload} />}
      {!overview && resource.loading && <SimulationLoading />}
      {overview?.chapters.map(chapter => {
        const open = expanded === chapter.id;
        return <View key={chapter.id}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? null : chapter.id)}
            style={{ padding: 16, minHeight: 84, borderWidth: 1, borderColor: '#E1E6ED', borderRadius: 15, flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: '#F3F5F8' }}>
            <View style={{ flex: 1, gap: 7 }}><Text style={{ fontSize: 17, lineHeight: 25, fontWeight: '600', color: '#172338' }}>{chapter.name}</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: '#374151', fontWeight: '500' }}>{chapter.practicedScenarios}/{chapter.totalScenarios} tình huống đã luyện</Text></View>
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: '#E5EDFA', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 23, lineHeight: 27, fontWeight: '400', color: '#176BD0' }}>{open ? '−' : '+'}</Text></View>
          </Pressable>
          {open && <ChapterItems context={context} chapter={chapter} bankVersion={overview.scope.bankVersion} />}
        </View>;
      })}
    </ScrollView>
    <View style={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: 1, borderColor: '#EEF0F4', backgroundColor: '#FFFFFF' }}>
      <AppButton label="THI THỬ" onPress={() => openSimulation('/simulations/exams')} />
    </View>
  </View>;
}
export default function SimulationCatalogScreen() {
  return <SimulationGate title="Tình huống mô phỏng">{(context, capability) => <Catalog context={context} bankVersion={capability.simulationBankVersion!} />}</SimulationGate>;
}
