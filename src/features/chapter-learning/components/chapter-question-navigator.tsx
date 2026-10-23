import type { ChapterStudy } from '../study-types';
import { BottomSheet, QuestionGrid } from '../../shared/question-sheet';

export function ChapterQuestionNavigator({ data, open, close, onSelect, disabled }: {
  data: ChapterStudy; open: boolean; close: () => void; onSelect: (id: number) => void; disabled?: boolean;
}) {
  return <BottomSheet visible={open} title="Chọn câu hỏi" close={close}>
    <QuestionGrid items={data.questions.map((question) => {
      const answer = data.answers[question.id];
      return { id: question.id, color: answer ? answer.isCorrect ? '#24A267' : '#E35D68' : '#F3F4F6',
        label: answer ? answer.isCorrect ? 'đúng' : 'sai' : 'chưa trả lời' };
    })} currentId={data.currentQuestionId} disabled={disabled} onSelect={(id) => { close(); onSelect(id); }} />
  </BottomSheet>;
}
