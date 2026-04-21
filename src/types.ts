export type UserRole = 'student' | 'teacher';

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  groupName?: string;
  filiere?: string;
  groupId?: number;
  filiereId?: number;
  createdAt: string;
}

export interface Filiere {
  id: number;
  name: string;
  createdAt: string;
}

export interface Group {
  id: number;
  name: string;
  filiereId: number;
  createdAt: string;
  studentCount?: number;
}

export interface Course {
  id: number;
  name: string;
  description: string;
  teacherId: number;
  filiereId?: number;
  createdAt: string;
  hasExams?: boolean;
}

export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-in-the-blanks' | 'ordering' | 'matching';

export interface QuestionOption {
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
  matchOptions?: string[];
  correctOptionIndex?: number; // Deprecated for MCQs but kept for compatibility/other types if needed
  correctAnswer?: string;
  correctAnswers?: string[];
  correctOrder?: number[];
  correctMatches?: number[];
  points: number;
  shuffleOptions?: boolean;
}

export interface Exam {
  id: number;
  title: string;
  description: string;
  courseId: number;
  teacherId: number;
  questions: Question[];
  durationMinutes: number;
  shuffleQuestions?: boolean;
  scheduledAt?: string;
  status: 'draft' | 'active';
  groupId?: number;
  groupName?: string;
  createdAt: string;
  hasResults?: boolean;
}

export interface Result {
  id: number;
  examId: number;
  studentId: number;
  score: number;
  totalQuestions: number;
  totalPoints: number;
  answers: (number | string | null)[];
  questionResults?: { isCorrect: boolean; pointsEarned: number }[];
  completedAt: string;
  studentName?: string;
  studentEmail?: string;
  groupName?: string;
  filiere?: string;
}

export interface Notification {
  id: number;
  title: string;
  content: string;
  teacherId: number;
  createdAt: string;
}
