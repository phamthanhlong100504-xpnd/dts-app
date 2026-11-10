import { userMessage } from '../../shared/user-message';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Modal, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { chooseLearnerLicense, getLicenseCatalog } from '../session-service';
import { useLearnerSession } from '../session-store';
import type { LicenseItem } from '../types';
import { canDragSheet, shouldDismissSheet } from '../../shared/sheet-swipe';

export function LicenseChoices({ onDone }: { onDone: () => void }) {
  const selected = useLearnerSession((state) => state.session?.profile.selectedLicenseClass);
  const [items, setItems] = useState<LicenseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    getLicenseCatalog().then((values) => { if (active) setItems(values); })
      .catch((failure) => { if (active) setError(failure instanceof Error ? failure.message : 'Không tải được hạng bằng.'); });
    return () => { active = false; };
  }, [retry]);
  async function select(code: string) {
    if (busy) return;
    if (code === selected) { onDone(); return; }
    setBusy(true); setError(null);
    try { await chooseLearnerLicense(code); onDone(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Không lưu được hạng bằng.'); }
    finally { setBusy(false); }
  }
  return <>
    {items === null && !error && <ActivityIndicator color="#0877F9" />}
    {error && <Text selectable className="mb-3 text-base text-red-700">{userMessage(error)}</Text>}
    {items === null && error && <Pressable accessibilityRole="button" className="min-h-11 justify-center" onPress={() => { setError(null); setRetry((n) => n + 1); }}>
      <Text className="text-base font-semibold text-blue-700">Thử lại</Text>
    </Pressable>}
    <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 8 }}>
      {items?.map((item) => <Pressable key={item.code} accessibilityRole="button"
        accessibilityState={{ selected: selected === item.code, disabled: busy }} disabled={busy}
        onPress={() => { void select(item.code); }} className="min-h-12 rounded-xl px-4 py-3"
        style={{ backgroundColor: selected === item.code ? '#0877F9' : '#F3F4F6', opacity: busy ? 0.6 : 1 }}>
        <Text className="font-semibold" style={{ fontSize: 17, color: selected === item.code ? '#FFFFFF' : '#374151' }}>
          {item.title}
        </Text>
        {item.description ? <Text className="mt-1" style={{ fontSize: 15, lineHeight: 21, color: selected === item.code ? '#EFF6FF' : '#4B5563' }}>{item.description}</Text> : null}
      </Pressable>)}
    </ScrollView>
    {busy && <ActivityIndicator className="mt-3" color="#0877F9" />}
  </>;
}

export function StudyLicensePicker() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const dismiss = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => canDragSheet(gesture, 0),
    onPanResponderRelease: (_, gesture) => { if (shouldDismissSheet(gesture)) close(); },
  }), [close]);
  const profile = useLearnerSession((state) => state.session?.profile);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Chọn hạng bằng" accessibilityState={{ expanded: open }}
      accessibilityValue={{ text: profile?.selectedLicenseClass || '' }} className="h-11 w-11 items-center justify-center rounded-xl"
      onPress={() => setOpen(true)}>
      <SymbolView name={{ ios: 'gearshape', android: 'settings', web: 'settings' }} size={24} tintColor="#1D4ED8" />
    </Pressable>
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6 py-8">
        <Pressable accessibilityRole="button" accessibilityLabel="Đóng bảng chọn hạng" className="absolute inset-0" onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal onAccessibilityEscape={close} className="w-full max-w-sm rounded-2xl bg-white p-5" style={{ maxHeight: '85%' }}>
          <View {...dismiss.panHandlers}><Text className="mb-4 text-center text-xl font-bold text-gray-900">Chọn bằng lái</Text></View>
          <LicenseChoices onDone={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </>;
}
