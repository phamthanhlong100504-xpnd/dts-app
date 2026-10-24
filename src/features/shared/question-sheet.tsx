import { SymbolView } from 'expo-symbols';
import { Animated, Modal, PanResponder, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { canDragSheet, shouldDismissSheet } from './sheet-swipe';

function sheetGestureHandlers(translateY: Animated.Value, close: () => void) {
  const restore = () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
  return {
    onStartShouldSetPanResponder: () => false,
    onPanResponderGrant: () => translateY.stopAnimation(),
    onPanResponderMove: (_: unknown, gesture: { dy: number }) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_: unknown, gesture: { dx: number; dy: number; vy: number }) => {
      if (shouldDismissSheet(gesture)) { translateY.setValue(0); close(); }
      else restore();
    },
    onPanResponderTerminate: restore,
  };
}

export function BottomSheet({ visible, title, close, children, topInset = 0, panelStyle, contentContainerStyle }: {
  visible: boolean; title?: string; close: () => void; children: ReactNode;
  topInset?: number; panelStyle?: StyleProp<ViewStyle>; contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const [atTop, setAtTop] = useState(true), [translateY] = useState(() => new Animated.Value(0));
  useEffect(() => { if (visible) translateY.setValue(0); }, [visible, translateY]);
  const responders = useMemo(() => ({
    body: PanResponder.create({ ...sheetGestureHandlers(translateY, close),
      onMoveShouldSetPanResponderCapture: (_, gesture) => canDragSheet(gesture, atTop ? 0 : 1) }),
    header: PanResponder.create({ ...sheetGestureHandlers(translateY, close),
      onMoveShouldSetPanResponderCapture: (_, gesture) => canDragSheet(gesture, 0) }),
  }), [close, translateY, atTop]);
  return <Modal transparent visible={visible} animationType="slide" onRequestClose={close} onShow={() => setAtTop(true)}>
    <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end', paddingTop: topInset }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Đóng hộp thoại" onPress={close} style={{ flex: 1 }} />
      <Animated.View accessibilityViewIsModal onAccessibilityEscape={close} {...responders.body.panHandlers}
        style={[{ maxHeight: '82%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FFFFFF', padding: 22, paddingBottom: 30 }, panelStyle, { transform: [{ translateY }] }]}>
        {title && <View {...responders.header.panHandlers}>
          <View style={{ width: 42, height: 5, backgroundColor: '#D1D5DB', borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ fontSize: 21, lineHeight: 28, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 18 }}>{title}</Text>
        </View>}
        <ScrollView bounces={false} scrollEventThrottle={16} onScroll={(event) => setAtTop(event.nativeEvent.contentOffset.y <= 0)}
          style={{ flexGrow: 0 }} contentContainerStyle={contentContainerStyle}>{children}</ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
export function QuestionGrid({ items, currentId, onSelect, disabled = false }: { items: { id: number; color: string; label?: string; displayNumber?: number }[]; currentId?: number; onSelect: (id: number) => void; disabled?: boolean }) {
  return <View style={{ gap: 14 }}>
    {Array.from({ length: Math.ceil(items.length / 5) }, (_, row) => <View key={row} style={{ flexDirection: 'row', gap: 12 }}>
      {Array.from({ length: 5 }, (_, column) => { const index = row * 5 + column, item = items[index];
        return item ? <Pressable accessibilityRole="button" key={item.id} accessibilityLabel={`Câu ${item.displayNumber ?? index + 1}${item.label ? ', ' + item.label : ''}`} accessibilityState={{ selected: currentId === item.id, disabled }} disabled={disabled} onPress={() => onSelect(item.id)}
          style={{ flex: 1, aspectRatio: 1, minWidth: 0, borderRadius: 10, borderWidth: currentId === item.id ? 2 : 1, borderColor: currentId === item.id ? '#111827' : item.color, backgroundColor: item.color, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: item.color === '#F3F4F6' ? '#374151' : '#FFFFFF' }}>{item.displayNumber ?? index + 1}</Text>
        </Pressable> : <View key={`empty-${column}`} style={{ flex: 1, aspectRatio: 1 }} />;
      })}
    </View>)}
  </View>;
}

export function QuestionPickerButton({ open, onPress, disabled = false }: { open: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Chọn câu hỏi"
    accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={onPress}
    style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}>
    <SymbolView name={{ ios: 'square.grid.3x3.fill', android: 'grid_view', web: 'grid_view' }} size={23} tintColor="#0877F9" />
  </Pressable>;
}
