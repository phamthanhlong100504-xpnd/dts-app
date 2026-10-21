import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { ChapterStudy } from '../study-types';

export function ChapterQuestionNavigator({ data, open, close, onSelect }: {
  data: ChapterStudy; open: boolean; close: () => void; onSelect: (id: number) => void;
}) {
  const [gridWidth, setGridWidth] = useState(0);
  const gap = Math.min(12, Math.max(4, (gridWidth - 5 * 44) / 4));
  const squareSize = gridWidth > 0 ? Math.min(56, Math.max(1, (gridWidth - 4 * gap) / 5)) : 44;
  return <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
    <View className="flex-1 items-center justify-center bg-black/40 px-5 py-10">
      <Pressable accessibilityRole="button" accessibilityLabel="Đóng danh sách câu" className="absolute inset-0" onPress={close} />
      <View accessibilityViewIsModal className="w-full max-w-md rounded-2xl bg-white p-5" style={{ maxHeight: '85%' }}>
        <Text className="text-center text-xl font-bold text-gray-900">Chọn câu hỏi</Text>
        <View className="mb-4 mt-3 flex-row items-stretch">
          {[['Xanh: đúng', '#15803D'], ['Đỏ: sai', '#B91C1C'], ['Xám: chưa trả lời', '#4B5563']].map(([label, color]) =>
            <View key={label} className="min-h-11 flex-1 items-center justify-center px-1">
              <Text className="text-center font-medium" style={{ fontSize: 13, lineHeight: 18, color }}>{label}</Text>
            </View>)}
        </View>
        <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingBottom: 4 }}>
          <View onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)} style={{ gap: 10 }}>
            {Array.from({ length: Math.ceil(data.questions.length / 5) }, (_, row) =>
              <View key={row} className="flex-row justify-between">
                {Array.from({ length: 5 }, (_, column) => {
                  const index = row * 5 + column;
                  const question = data.questions[index];
                  if (!question) return <View key={`empty-${column}`} style={{ width: squareSize, height: squareSize }} />;
                  const answer = data.answers[question.id];
                  const current = data.currentQuestionId === question.id;
                  return <Pressable key={question.id} accessibilityRole="button"
                    accessibilityLabel={`Câu ${index + 1}${answer ? answer.isCorrect ? ', đúng' : ', sai' : ', chưa trả lời'}`}
                    accessibilityState={{ selected: current }} onPress={() => { close(); onSelect(question.id); }}
                    className="items-center justify-center rounded-xl"
                    style={{ width: squareSize, height: squareSize,
                      backgroundColor: answer ? answer.isCorrect ? '#DCFCE7' : '#FEE2E2' : '#F3F4F6',
                      borderWidth: current ? 2 : 1, borderColor: current ? '#0877F9' : '#E5E7EB' }}>
                    <Text className="text-base font-semibold text-gray-900">{index + 1}</Text>
                  </Pressable>;
                })}
              </View>)}
          </View>
        </ScrollView>
        <Pressable accessibilityRole="button" className="mt-5 min-h-11 self-center items-center justify-center rounded-xl border border-blue-100 bg-blue-50 px-7" onPress={close}>
          <Text className="text-base font-semibold text-blue-700">Đóng</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
