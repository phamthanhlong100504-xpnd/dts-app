import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ChapterStudyModel, ChapterStudyState } from '../chapter-study-model';
import type { ChapterStudy } from '../study-types';
import { QuestionImage } from './question-image';

// Only lay out a numbered sequence (1., 2., ...). Keep decimals, road codes,
// standalone numbers and all backend wording/punctuation intact.
export function splitExplanationParagraphs(value: string): string[] {
  const markers = [...value.matchAll(/(?:^|\s+)([1-9]\d?)\.[ \t]+(?=\S)/gu)];
  const starts: number[] = [];
  let expected = 1;
  for (const marker of markers) {
    if (Number(marker[1]) !== expected) continue;
    starts.push(marker.index + marker[0].search(/\d/u));
    expected += 1;
  }
  const breaks = starts.length > 1 ? starts : [];
  const chunks = [0, ...breaks.filter((index) => index > 0), value.length];
  return chunks.slice(0, -1).flatMap((start, index) =>
    value.slice(start, chunks[index + 1]).split(/\r\n?|\n/u).map((line) => line.trim()).filter(Boolean));
}

// Keyed by the question/scope/recorded answer in the parent. Revealing feedback
// changes only this mounted view; it never submits an answer or changes progress.
export function ChapterQuestionContent({ data, state, model, canSkip, onSkip }: {
  data: ChapterStudy; state: ChapterStudyState; model: ChapterStudyModel;
  canSkip: boolean; onSkip: () => void;
}) {
  const [feedbackOverride, setFeedbackOverride] = useState<boolean | null>(null);
  const question = data.questions.find((item) => item.id === data.currentQuestionId)!;
  const position = data.questions.findIndex((item) => item.id === question.id);
  const grade = state.editing ? undefined : data.answers[question.id];
  const recorded = data.answers[question.id];
  // A canonical POST verdict takes priority over the question's reference key.
  // A separate Practice GET supplies a matching-bank reference for ungraded review questions.
  const correctAnswer = recorded?.correctAnswer ?? question.referenceAnswer;
  const explanation = recorded?.explanation ?? question.explanation;
  const feedbackOpen = !!correctAnswer && (feedbackOverride ?? !!grade);
  const locked = state.busy || state.needsReload;
  const readOnly = data.status === 'COMPLETED' && (data.mode === 'review' || data.collection === 'critical');

  return <>
    {question.isCritical && data.collection !== 'critical' && <View className="mb-4 rounded-xl bg-orange-50 px-4 py-3">
      <Text className="text-base font-semibold text-orange-800">CÂU ĐIỂM LIỆT</Text>
    </View>}
    <Text className="mb-4 text-gray-900" style={{ fontSize: 18, fontWeight: '600', lineHeight: 27 }}>
      Câu {position + 1}/{data.questions.length}: {question.text}
    </Text>
    <QuestionImage key={question.id} question={question} scope={data.scope} />
    {question.choices.map((choice) => {
      const selected = state.selectedAnswer === choice.key;
      const correctChoice = grade?.correctAnswer === choice.key || (feedbackOpen && correctAnswer === choice.key);
      const wrongChoice = !!grade && selected && !grade.isCorrect;
      return <Pressable key={choice.key} accessibilityRole="button"
        accessibilityState={{ disabled: locked || readOnly || !!grade, selected }} disabled={locked || readOnly || !!grade}
        onPress={() => model.select(choice.key)} className="mb-3 min-h-16 flex-row items-center rounded-xl px-4 py-3"
        style={{ backgroundColor: correctChoice ? '#DCFCE7' : wrongChoice ? '#FEE2E2' : selected ? '#EFF6FF' : '#F3F4F6',
          borderColor: correctChoice ? '#16A34A' : wrongChoice ? '#EF4444' : selected ? '#0877F9' : 'transparent', borderWidth: 1 }}>
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-white">
          <Text className="text-lg font-bold text-gray-900">{choice.key}</Text>
        </View>
        <Text className="flex-1 text-lg leading-7 text-gray-900">{choice.text}</Text>
      </Pressable>;
    })}
    <View className="mb-1 mt-1 flex-row items-center justify-between">
      <Pressable accessibilityRole="button" accessibilityLabel={feedbackOpen ? 'Ẩn đáp án' : 'Hiện đáp án'}
        accessibilityState={{ expanded: feedbackOpen, disabled: locked || !correctAnswer }}
        accessibilityHint={!correctAnswer ? 'Kiểm tra câu trả lời để xem đáp án và giải thích.' : undefined}
        disabled={locked || !correctAnswer} onPress={() => setFeedbackOverride(!feedbackOpen)}
        className="min-h-11 flex-row items-center" style={{ gap: 6, opacity: locked || !correctAnswer ? 0.45 : 1 }}>
        <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor="#16A34A" />
        <Text className="font-semibold text-green-600" style={{ fontSize: 15 }}>
          {feedbackOpen ? 'Ẩn đáp án' : 'Hiện đáp án'}
        </Text>
      </Pressable>
      {!grade && !readOnly && canSkip && <Pressable accessibilityRole="button" disabled={locked}
        accessibilityState={{ disabled: locked }} className="min-h-11 justify-center pl-4"
        style={{ opacity: locked ? 0.45 : 1 }} onPress={onSkip}>
        <Text className="font-semibold text-gray-900" style={{ fontSize: 15 }}>Bỏ qua</Text>
      </Pressable>}
    </View>
    {feedbackOpen && <View className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-4">
      <Text className="text-lg font-semibold leading-7 text-gray-900">
        Đáp án đúng: {correctAnswer}
      </Text>
      <Text className="mt-3 text-lg font-semibold leading-7 text-gray-900">Giải thích</Text>
      {splitExplanationParagraphs(explanation || 'Chưa có giải thích cho câu này.').map((paragraph, index) =>
        <Text key={index} className="text-lg leading-7 text-gray-800"
          style={{ marginTop: index === 0 ? 4 : 10 }}>{paragraph}</Text>)}
      {grade && !((data.mode === 'review' || data.collection === 'critical') && data.status === 'COMPLETED') && <Pressable accessibilityRole="button" disabled={locked}
        className="mt-2 min-h-11 items-center justify-center" onPress={() => model.edit()}>
        <Text className="text-center text-lg leading-7 text-gray-800">Trả lời lại câu này</Text>
      </Pressable>}
    </View>}
  </>;
}
