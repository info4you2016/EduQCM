export type UserRole = 'student' | 'teacher' | 'admin';

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  role: UserRole;
  groupName?: string;
  filiere?: string;
  groupId?: number;
  filiereId?: number;
  registrationNumber?: string;
  createdAt: string;
}

export type FiliereLevel = 'spécialisation' | 'qualification' | 'technicien' | 'technicien spécialisé';

export interface Filiere {
  id: number;
  code: string;
  name: string;
  description: string;
  niveau?: FiliereLevel;
  createdAt: string;
}

export interface Group {
  id: number;
  name: string;
  filiereId: number;
  createdAt: string;
  studentCount?: number;
}

export interface Module {
  id: number;
  code: string;
  name: string;
  durationHours: number;
  description: string;
  teacherId: number;
  filiereId?: number;
  createdAt: string;
  hasExams?: boolean;
}

export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'fill-in-the-blanks' | 'ordering' | 'matching' | 'practical';

export interface QuestionOption {
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  options?: QuestionOption[];
  matchOptions?: string[];
  correctOptionIndex?: number; // Deprecated for MCQs but kept for compatibility/other types if needed
  correctAnswer?: string;
  correctAnswers?: string[];
  correctOrder?: number[];
  correctMatches?: number[];
  columnAHeader?: string;
  columnBHeader?: string;
  points: number;
  shuffleOptions?: boolean;
  section?: string;
}

export type ExamType = 'controle-continu' | 'fin-de-module';

export interface Exam {
  id: number;
  title: string;
  description: string;
  moduleId: number;
  teacherId: number;
  type: ExamType;
  questions: Question[];
  durationMinutes: number;
  shuffleQuestions?: boolean;
  disableCopyPaste?: boolean; // Added
  scheduledAt?: string;
  status: 'draft' | 'active';
  groupId?: number;
  groupName?: string;
  moduleName?: string;
  sessionStartTime?: number;
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
  aiFeedback?: string;
  integrityScore?: number;
  tabExitCount?: number;
  fullscreenExitsCount?: number;
  auditTrail?: { type: string; details: string; timestamp: number }[];
}

export interface Notification {
  id: number;
  title: string;
  content: string;
  teacherId: number;
  groupId?: number;
  filiereId?: number;
  audienceRole?: 'all' | 'students' | 'teachers';
  type?: 'announcement' | 'exam';
  read?: boolean;
  isPinned?: boolean;
  importance?: 'normal' | 'low' | 'high';
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  reactions?: { id: number; userId: number; reactionType: string; userDisplayName: string }[];
  comments?: { id: number; userId: number; userDisplayName: string; userRole: string; content: string; createdAt: string }[];
  readers?: { id: number; displayName: string; email: string; readAt: string }[];
  readCount?: number;
  createdAt: string;
}

export interface HeaderLine {
  id: string;
  type?: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  fontSize?: number;
  isBold?: boolean;
  isItalic?: boolean;
  alignment?: 'left' | 'center' | 'right';
  fontFamily?: string;
  logoSource?: 'gauche' | 'droit' | 'custom';
}

export interface HeaderColumn {
  id: string;
  width: number; // percentage (1-100)
  lines: HeaderLine[];
  borderRight?: boolean;
  borderLeft?: boolean;
  bgColor?: string;
  textColor?: string;
}

export interface CCRule {
  min: number;
  max: number;
  count: number;
}

export interface DefaultExamSettings {
  durationMinutes: number;
  shuffleQuestions: boolean;
  disableCopyPaste: boolean;
}

export interface WordTemplate {
  id: string;
  name: string;
  headerColumns: HeaderColumn[];
  showHeaderLines?: boolean;
  showFooter?: boolean;
  showFooterText?: boolean;
  showFooterTable?: boolean;
  footerText?: string;
  footerFontSize?: number;
  footerFontFamily?: string;
  footerTable?: FooterTable;
  footerColumns?: HeaderColumn[];
}

export interface FooterTable {
  rows: string[][];
}

export interface OrganizationSettings {
  id?: number;
  orgName: string;
  orgNameArabic: string;
  orgNameFrench: string;
  regionalDirection: string;
  institutionName: string;
  orgSubName: string;
  orgLogoUrl?: string;
  orgLogoUrlRight?: string;
  footerText?: string;
  footerFontSize?: number;
  footerFontFamily?: string;
  footerTable?: FooterTable;
  footerColumns?: HeaderColumn[];
  showFooter?: boolean;
  showFooterText?: boolean;
  showFooterTable?: boolean;
  regionName: string;
  academicYear: string;
  orgLogoBgColor: string;
  orgLogoTextColor: string;
  showHeaderLines?: boolean;
  showFooterLines?: boolean;
  headerLines?: HeaderLine[];
  headerColumns?: HeaderColumn[];
  ccRules?: CCRule[];
  defaultExamSettings?: DefaultExamSettings;
  templates?: WordTemplate[];
  watermarkText?: string;
  showWatermark?: boolean;
  watermarkColor?: string;
  watermarkOpacity?: number;
  localAiEnabled?: boolean;
  localAiUrl?: string;
  localAiModel?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: number;
  userId: number;
  action: string;
  details: string;
  createdAt: string;
  userName?: string;
  userEmail?: string;
}

export interface LiveStudentSession {
  studentId: number;
  studentName: string;
  registrationNumber: string;
  answeredCount: number;
  totalQuestions: number;
  tabExitCount: number;
  status: 'active' | 'completed';
  lastUpdated: number;
  extraTimeMinutes?: number;
  timeLeft?: number;
  cheatAlerts?: Array<{ type: string; details: string; timestamp: number }>;
  hasPendingDecision?: boolean;
  pendingDecisionTime?: number;
}

export interface CheatAlertLog {
  id: string;
  studentId: number;
  studentName: string;
  type: string;
  details: string;
  timestamp: number;
}

export interface ChatReaction {
  id: number;
  messageId: number;
  userId: number;
  userName: string;
  emoji: string;
  createdAt: string;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderRole: string;
  content: string;
  channelType: 'general' | 'teachers' | 'group';
  groupId?: number;
  createdAt: string;
  reactions?: ChatReaction[];
  isEdited?: number;
  isPinned?: number;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
}
