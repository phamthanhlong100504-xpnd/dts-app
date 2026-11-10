import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLearnerResource } from '../../session/use-learner-resource';
import { loadSimulationCapability, useSimulationContext } from '../simulation-context';
import { openSimulation } from '../simulation-navigation';
import { SimulationGlyph } from './simulation-ui';

export function SimulationHomeCard() {
  const context = useSimulationContext();
  const loader = useCallback(async () => {
    if (!context) return null;
    const capability = await loadSimulationCapability(context);
    const overview = capability.simulationEnabled && capability.simulationReady
      ? await context.learning.overview({ ...context.scope, bankVersion: capability.simulationBankVersion! }).catch(() => null) : null;
    return { capability, total: overview?.totalScenarios ?? null };
  }, [context]);
  const resource = useLearnerResource('home-simulation-card', loader);
  if (!context || !resource.data || !resource.data.capability.simulationEnabled) return null;
  return <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 18, marginBottom: 18 }}>
    <SimulationHomeTile total={resource.data.total} onPress={() => openSimulation('/simulations')} />
    <View style={{ flex: 1, minWidth: 0 }} />
  </View>;
}
export function SimulationHomeTile({ total, onPress }: { total: number | null; onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityLabel="Mở tình huống mô phỏng giao thông" onPress={onPress}
      onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
      style={{ flex: 1, minWidth: 0, minHeight: 188, paddingHorizontal: 10, paddingVertical: 20, borderRadius: 18, borderWidth: 1, borderColor: '#E0E8C7', backgroundColor: '#F1F6DF', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.78 : 1 }}>
      <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}><SimulationGlyph size={32} color="#748B35" /></View>
      <Text style={{ fontSize: 16, lineHeight: 23, fontWeight: '600', color: '#172338', textAlign: 'center', marginTop: 18 }}>{total === null ? 'Tình huống mô phỏng' : `${total} tình huống mô phỏng`}</Text>
      <Text style={{ fontSize: 13, lineHeight: 19, color: '#475569', textAlign: 'center', marginTop: 6 }}>Luyện phản xạ giao thông</Text>
    </Pressable>;
}
