import type { WrongQuestion } from '../wrong-service';
import { BottomSheet, QuestionGrid } from '../../shared/question-sheet';

export function WrongQuestionNavigator({ rows, currentId, open, close, disabled, onSelect }: {
  rows: WrongQuestion[]; currentId?: number; open: boolean; close: () => void; disabled?: boolean; onSelect: (id: number) => void;
}) {
  // These rows are the current server wrong-list for the selected tab. Opening
  // or choosing a question does not start a round or submit an answer.
  return <BottomSheet visible={open} title="Chọn câu hỏi" close={close}>
    <QuestionGrid items={rows.map((row) => ({ id: row.question.id, color: '#E35D68', label: 'sai', displayNumber: row.sourceNumber ?? row.question.id }))}
      currentId={currentId} disabled={disabled} onSelect={(id) => { close(); onSelect(id); }} />
  </BottomSheet>;
}
