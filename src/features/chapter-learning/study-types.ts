export type StudyMode = 'learn' | 'review';
export type StudyTarget = number | 'all' | 'critical' | 'wrong';
export type StudyQuestion = {
  id: number;
  chapterId?: number;
  previousWrongAnswer?: string | null;
  text: string;
  choices: { key: string; text: string }[];
  isCritical: boolean;
  imageUrl: string | null;
  mediaFileId: string | null;
  referenceAnswer: string | null;
  explanation: string;
};
export type StudyAnswer = {
  questionId: number;
  selectedAnswer: string;
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
  answeredAt: string;
};
export type StudyScope = {
  version: number;
  userId: string;
  licenseClass: string;
  bankVersion: string;
};
export type ChapterStudy = {
  scope: StudyScope;
  chapterId: number;
  chapterName: string;
  mode: StudyMode;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  reviewSessionId: string | null;
  questions: StudyQuestion[];
  answers: Record<number, StudyAnswer>;
  currentQuestionId: number;
  collection?: 'all' | 'critical' | 'wrong';
  chapters?: ChapterStudy[];
  criticalSessionId?: string;
  learnedQuestionIds?: number[];
  wrongSessionId?: string;
  wrongSummary?: { correctCount: number; wrongCount: number; unansweredCount: number; remainingCount: number };
};
