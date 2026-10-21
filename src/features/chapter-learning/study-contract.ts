import { DtsApiError } from '../../lib/api/http';
import type { StudyAnswer, StudyQuestion } from './study-types';

export function invalidStudy(): never {
  throw new DtsApiError('Dữ liệu học chưa đồng nhất. Vui lòng đọc lại từ máy chủ.');
}
export function objectOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidStudy();
  return value as Record<string, unknown>;
}
export function textOf(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) invalidStudy();
  return value;
}
export function countOf(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalidStudy();
  return value;
}
export function idOf(value: unknown): number {
  const result = countOf(value);
  if (result === 0) invalidStudy();
  return result;
}
export function listOf(value: unknown): unknown[] {
  if (!Array.isArray(value)) invalidStudy();
  return value;
}
export function uniqueIds(questions: StudyQuestion[]) {
  if (new Set(questions.map((question) => question.id)).size !== questions.length) invalidStudy();
}
export function questionOf(value: unknown, review = false): StudyQuestion {
  const raw = objectOf(value);
  let options = raw.options;
  if (typeof options === 'string') {
    try { options = JSON.parse(options); } catch { invalidStudy(); }
  }
  // Labels are IDs from Practice, never labels generated from array indexes.
  const choices = listOf(options).map((item) => {
    const option = objectOf(item);
    return { key: textOf(option.label).trim().toUpperCase(), text: textOf(option.text) };
  });
  if (choices.length < 2 || new Set(choices.map((choice) => choice.key)).size !== choices.length ||
      typeof raw.isCritical !== 'boolean') invalidStudy();
  const referenceAnswer = review ? null : textOf(raw.correctAnswer).trim().toUpperCase();
  if (referenceAnswer && !choices.some((choice) => choice.key === referenceAnswer)) invalidStudy();
  if (raw.imageUrl != null && typeof raw.imageUrl !== 'string') invalidStudy();
  if (raw.mediaFileId != null && typeof raw.mediaFileId !== 'string') invalidStudy();
  return {
    id: idOf(review ? raw.questionId : raw.id), text: textOf(raw.questionText), choices,
    chapterId: raw.chapterId == null && raw.chapter == null ? undefined : idOf(raw.chapterId ?? raw.chapter),
    isCritical: raw.isCritical, imageUrl: raw.imageUrl ? textOf(raw.imageUrl) : null,
    mediaFileId: raw.mediaFileId ? textOf(raw.mediaFileId) : null, referenceAnswer,
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
  };
}
export function answerOf(value: unknown, question: StudyQuestion, savedLearning = false): StudyAnswer {
  const raw = objectOf(value);
  const selectedAnswer = textOf(raw.selectedAnswer).trim().toUpperCase();
  const correctAnswer = savedLearning ? question.referenceAnswer : raw.correctAnswer;
  if (idOf(raw.questionId) !== question.id || typeof raw.isCorrect !== 'boolean' ||
      typeof correctAnswer !== 'string' || !question.choices.some((choice) => choice.key === correctAnswer) ||
      !question.choices.some((choice) => choice.key === selectedAnswer)) invalidStudy();
  return { questionId: question.id, selectedAnswer, isCorrect: raw.isCorrect,
    correctAnswer, explanation: savedLearning ? question.explanation : typeof raw.explanation === 'string' ? raw.explanation : '',
    answeredAt: textOf(savedLearning ? raw.lastAnsweredAt : raw.answeredAt) };
}

// References are allowed for learning/review, never for official exam sessions.
// Match the frozen question exactly before attaching a current-bank answer key.
export function withReferenceAnswers(questions: StudyQuestion[], references: StudyQuestion[]): StudyQuestion[] {
  uniqueIds(references);
  if (questions.length !== references.length) invalidStudy();
  return questions.map((question) => {
    const reference = references.find((item) => item.id === question.id);
    if (!reference || question.text !== reference.text || question.isCritical !== reference.isCritical ||
      (question.chapterId !== undefined && question.chapterId !== reference.chapterId) ||
      JSON.stringify(question.choices) !== JSON.stringify(reference.choices) ||
      question.imageUrl !== reference.imageUrl || question.mediaFileId !== reference.mediaFileId) invalidStudy();
    return { ...question, referenceAnswer: reference.referenceAnswer, explanation: reference.explanation };
  });
}
