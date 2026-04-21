import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { 
  BookOpen, 
  GraduationCap, 
  LogOut, 
  Plus, 
  ClipboardList, 
  Bell, 
  User, 
  Users,
  CheckCircle2, 
  XCircle, 
  Clock, 
  BarChart3,
  Trash2,
  AlertCircle,
  Mail,
  Lock,
  UserPlus,
  Eye,
  Filter,
  ChevronLeft,
  ChevronRight,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Shuffle,
  Send,
  Star,
  Calendar,
  Edit2,
  FileText,
  Download,
  Search,
  Settings,
  LayoutDashboard,
  FileQuestion,
  History,
  Check,
  X,
  FileCode,
  Upload,
  Info,
  Sparkles,
  GripVertical,
  CircleHelp,
  ArrowRight,
  Target,
  Database
} from 'lucide-react';
import { api, socket } from './lib/api';
import { generateQuestions, GeneratedQuestion, evaluateShortAnswer } from './lib/gemini';
import { cn } from './lib/utils';
import { UserProfile, Course, Exam, Result, Notification, UserRole, Question, Filiere, Group, QuestionType } from './types';
import ReactQuill from 'react-quill-new';
import katex from 'katex';

// Set KaTeX on window for Quill formula support
if (typeof window !== 'undefined') {
  (window as any).katex = katex;
}
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  Legend
} from 'recharts';

const stripHtml = (html: string) => {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent || "").trim();
  } catch (e) {
    // Fallback for environments where DOMParser might fail
    let text = html.replace(/<[^>]*>/g, '');
    const entities: { [key: string]: string } = {
      '&nbsp;': ' ',
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&rsquo;': "'",
      '&lsquo;': "'",
      '&rdquo;': '"',
      '&ldquo;': '"'
    };
    Object.keys(entities).forEach(entity => {
      text = text.replace(new RegExp(entity, 'g'), entities[entity]);
    });
    return text.trim();
  }
};

const normalizeQuestion = (q: Question): Question => {
  if (!q) return q;
  
  // Ensure question has an ID
  const id = q.id || Math.random().toString(36).substr(2, 9);
  
  if (!q.options || !Array.isArray(q.options)) return { ...q, id };
  
  const normalizedOptions = q.options.map((opt, idx) => {
    let text = '';
    let isCorrect = false;

    if (typeof opt === 'string') {
      text = opt;
      isCorrect = idx === q.correctOptionIndex;
    } else {
      text = opt.text || '';
      // If isCorrect is explicitly defined on the object, use it.
      // Otherwise, fallback to correctOptionIndex if it matches this index.
      isCorrect = (opt.isCorrect !== undefined) ? !!opt.isCorrect : (idx === q.correctOptionIndex);
    }

    return { text, isCorrect };
  });

  return { ...q, id, options: normalizedOptions };
};

const getExamTotalPoints = (exam: Exam) => {
  if (!exam || !exam.questions) return 0;
  return exam.questions.reduce((sum, q) => sum + (normalizeQuestion(q).points || 1), 0);
};

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  className, 
  disabled,
  type = 'button',
  title
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'; 
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  title?: string;
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-subtle hover:shadow-polished',
    secondary: 'bg-amber-500 text-white hover:bg-amber-600 shadow-subtle hover:shadow-polished',
    outline: 'border-2 border-slate-100 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-200',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-subtle hover:shadow-polished'
  };

  const sizes = {
    sm: 'px-3.5 py-1.5 text-xs rounded-lg',
    md: 'px-6 py-2.5 text-sm rounded-xl',
    lg: 'px-8 py-3.5 text-base rounded-2xl'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center justify-center font-bold transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none gap-2',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void; key?: React.Key }) => (
  <div 
    onClick={onClick}
    className={cn(
      'bg-white rounded-[2rem] border border-slate-200/50 shadow-subtle transition-all duration-500',
      onClick && 'cursor-pointer hover:shadow-deep hover:-translate-y-1 active:scale-[0.99]',
      className
    )}
  >
    {children}
  </div>
);

const Input = ({ 
  label, 
  value, 
  onChange, 
  type = 'text', 
  placeholder,
  required = false,
  icon: Icon
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  type?: string;
  placeholder?: string;
  required?: boolean;
  icon?: any;
}) => (
  <div className="space-y-1.5">
    <label className="text-xs font-black uppercase tracking-widest text-slate-400 px-1">{label}</label>
    <div className="relative">
      {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={cn(
          "w-full px-4 py-3 bg-slate-50 border-2 border-transparent rounded-2xl focus:outline-none focus:bg-white focus:border-indigo-500/30 ring-indigo-500/10 focus:ring-4 transition-all duration-300 font-medium placeholder:text-slate-300",
          Icon && "pl-11"
        )}
      />
    </div>
  </div>
);

const EDITOR_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'align': [] }],
    ['link', 'formula', 'code-block'],
    ['clean']
  ],
};

const QUIZ_MODULES = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['formula'],
    ['clean']
  ],
};

const RichTextEditor = React.memo(({ label, value, onChange, className, theme = "snow", placeholder = "Saisissez votre texte ici..." }: { label?: string; value: string; onChange: (val: string) => void; className?: string; theme?: string; placeholder?: string }) => {
  const [localValue, setLocalValue] = useState(value || '');
  const lastValueRef = useRef(value || '');

  // Choose modules based on context (label or theme)
  const isQuizMode = !label?.toLowerCase().includes('annonce') && !label?.toLowerCase().includes('description') && !label?.toLowerCase().includes('contenu');
  const modules = isQuizMode ? QUIZ_MODULES : EDITOR_MODULES;

  // Update local value when prop changes, but only if it's different from what we last sent
  useEffect(() => {
    if (value !== lastValueRef.current) {
      setLocalValue(value || '');
      lastValueRef.current = value || '';
    }
  }, [value]);

  const handleChange = useCallback((val: string) => {
    if (val === lastValueRef.current) return;
    setLocalValue(val);
    lastValueRef.current = val;
    // Use startTransition for the external update to lower its priority
    React.startTransition(() => {
      onChange(val);
    });
  }, [onChange]);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
        <ReactQuill 
          theme={theme} 
          value={localValue} 
          onChange={handleChange}
          modules={modules}
          placeholder={placeholder}
          className={cn(
            "w-full",
            theme === 'snow' ? "min-h-[120px]" : "min-h-0"
          )}
        />
      </div>
    </div>
  );
});

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'exam' | 'results' | 'notifications' | 'classes' | 'analytics'>('dashboard');
  const [activeExam, setActiveExam] = useState<Exam | null>(null);

  // Data states
  const [courses, setCourses] = useState<Course[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [studentCount, setStudentCount] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user } = await api.auth.me();
        setUser(user);
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Data fetching
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const promises: Promise<any>[] = [
          api.courses.list(),
          api.exams.list(),
          api.results.list(),
          api.notifications.list(),
          api.filieres.list(),
          api.groups.list()
        ];
        
        if (user.role === 'teacher') {
          promises.push(api.students.count());
        }

        const resolved = await Promise.all(promises);
        
        setCourses(resolved[0]);
        setExams(resolved[1]);
        setResults(resolved[2]);
        setNotifications(resolved[3]);
        setFilieres(resolved[4]);
        setGroups(resolved[5]);
        
        if (user.role === 'teacher' && resolved[6]) {
          setStudentCount(resolved[6].count);
        }
      } catch (err: any) {
        console.error("Error fetching data:", err);
        if (err.message === "User no longer exists" || err.message === "Unauthorized" || err.message === "Invalid token") {
          setUser(null);
        }
      }
    };

    fetchData();

    socket.on("notification", (notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    return () => {
      socket.off("notification");
    };
  }, [user]);

  const handleLogout = async () => {
    await api.auth.logout();
    React.startTransition(() => {
      setUser(null);
      setView('dashboard');
    });
  };

  const handleRefreshTeacher = useCallback(async () => {
    const [c, e, s] = await Promise.all([
      api.courses.list(), 
      api.exams.list(),
      api.students.count()
    ]);
    setCourses(c);
    setExams(e);
    setStudentCount(s.count);
  }, []);

  const handleStartExam = useCallback((exam: Exam) => {
    React.startTransition(() => {
      setActiveExam(exam);
      setView('exam');
    });
  }, []);

  const handleExamComplete = useCallback(async () => {
    const r = await api.results.list();
    React.startTransition(() => {
      setResults(r);
      setActiveExam(null);
      setView('results');
    });
  }, []);

  const handleExamCancel = useCallback(() => {
    React.startTransition(() => {
      setActiveExam(null);
      setView('dashboard');
    });
  }, []);

  const handleRefreshNotifications = useCallback(async () => {
    const n = await api.notifications.list();
    setNotifications(n);
  }, []);

  const handleRefreshClasses = useCallback(async () => {
    const [f, g] = await Promise.all([api.filieres.list(), api.groups.list()]);
    setFilieres(f);
    setGroups(g);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthView onAuth={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-200/60 sticky top-0 h-screen z-50">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('dashboard')}>
            <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-deep group-hover:scale-110 transition-transform duration-500">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter font-display uppercase">EduQCM</h1>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-1.5 overflow-y-auto">
          <div className="px-3 mb-4">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Principal</span>
          </div>
          <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<BookOpen className="w-4 h-4" />}>Tableau de bord</NavButton>
          
          <div className="px-3 mb-4 pt-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gestion</span>
          </div>
          {user.role === 'teacher' && (
            <NavButton active={view === 'classes'} onClick={() => setView('classes')} icon={<Users className="w-4 h-4" />}>Classes & Groupes</NavButton>
          )}
          {user.role === 'teacher' && (
            <NavButton active={view === 'analytics'} onClick={() => setView('analytics')} icon={<LayoutDashboard className="w-4 h-4" />}>Analytique</NavButton>
          )}
          <NavButton active={view === 'results'} onClick={() => setView('results')} icon={<BarChart3 className="w-4 h-4" />}>Résultats</NavButton>
          
          <div className="px-3 mb-4 pt-6">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Communication</span>
          </div>
          <NavButton active={view === 'notifications'} onClick={() => setView('notifications')} icon={<Bell className="w-4 h-4" />}>Annonces</NavButton>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-slate-200/60 shadow-subtle">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900 truncate tracking-tight">{user.displayName}</p>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{user.role === 'teacher' ? 'Enseignant' : 'Étudiant'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all font-bold text-sm group"
          >
            <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200/60 p-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center gap-2" onClick={() => setView('dashboard')}>
            <GraduationCap className="text-indigo-600 w-6 h-6" />
            <h1 className="text-lg font-black text-slate-900 tracking-tighter uppercase font-display">EduQCM</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView('notifications')} className="p-2 text-slate-400 hover:text-slate-600">
              <Bell className="w-5 h-5" />
            </button>
            <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-500">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Mobile Nav - Bottom Bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200/60 px-6 py-3 flex items-center justify-between z-40 shadow-up">
          <button onClick={() => setView('dashboard')} className={cn("p-2 rounded-xl transition-all", view === 'dashboard' ? "text-indigo-600 bg-indigo-50" : "text-slate-400")}>
            <BookOpen className="w-6 h-6" />
          </button>
          <button onClick={() => setView('results')} className={cn("p-2 rounded-xl transition-all", view === 'results' ? "text-indigo-600 bg-indigo-50" : "text-slate-400")}>
            <BarChart3 className="w-6 h-6" />
          </button>
          {user.role === 'teacher' && (
            <button onClick={() => setView('classes')} className={cn("p-2 rounded-xl transition-all", view === 'classes' ? "text-indigo-600 bg-indigo-50" : "text-slate-400")}>
              <Users className="w-6 h-6" />
            </button>
          )}
          <button onClick={() => setView('notifications')} className={cn("p-2 rounded-xl transition-all", view === 'notifications' ? "text-indigo-600 bg-indigo-50" : "text-slate-400")}>
            <Bell className="w-6 h-6" />
          </button>
        </nav>

        <main className="flex-1 px-4 py-8 md:px-10 md:py-12 pb-24 md:pb-12 max-w-[1400px] mx-auto w-full">
          <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {user.role === 'teacher' ? (
                <TeacherDashboard 
                  courses={courses} 
                  exams={exams} 
                  results={results} 
                  notifications={notifications}
                  filieres={filieres}
                  studentCount={studentCount}
                  user={user}
                  onRefresh={handleRefreshTeacher}
                  groups={groups}
                />
              ) : (
                <StudentDashboard 
                  exams={exams} 
                  results={results} 
                  notifications={notifications}
                  user={user}
                  onStartExam={handleStartExam}
                  courses={courses}
                />
              )}
            </motion.div>
          )}

          {view === 'exam' && activeExam && (
            <motion.div
              key="exam"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="max-w-3xl mx-auto"
            >
              <ExamView 
                exam={activeExam} 
                onComplete={handleExamComplete}
                onCancel={handleExamCancel}
                user={user}
                courseName={courses.find(c => c.id === activeExam.courseId)?.name}
              />
            </motion.div>
          )}

          {view === 'results' && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ResultsView results={results} exams={exams} user={user} filieres={filieres} groups={groups} courses={courses} />
            </motion.div>
          )}

          {view === 'notifications' && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <NotificationsView 
                notifications={notifications} 
                user={user} 
                onRefresh={handleRefreshNotifications}
              />
            </motion.div>
          )}

          {view === 'classes' && user.role === 'teacher' && (
            <motion.div
              key="classes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <FiliereGroupManagement 
                filieres={filieres} 
                groups={groups} 
                onRefresh={handleRefreshClasses} 
              />
            </motion.div>
          )}

          {view === 'analytics' && user.role === 'teacher' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AnalyticsView 
                results={results}
                courses={courses}
                exams={exams}
                filieres={filieres}
                groups={groups}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div>
    </div>
  );
}

// --- Sub-Views ---

function AnalyticsView({ results, courses, exams, filieres, groups }: { 
  results: Result[]; 
  courses: Course[]; 
  exams: Exam[]; 
  filieres: Filiere[];
  groups: Group[];
}) {
  const courseStats = useMemo(() => {
    return courses.map(course => {
      const courseExams = exams.filter(e => e.courseId === course.id);
      const examIds = courseExams.map(e => e.id);
      const courseResults = results.filter(r => examIds.includes(r.examId));
      
      const average = courseResults.length > 0
        ? courseResults.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)) * 100, 0) / courseResults.length
        : 0;
        
      return {
        name: course.name,
        average: Math.round(average),
        examCount: courseExams.length,
        resultCount: courseResults.length
      };
    }).filter(c => c.resultCount > 0);
  }, [courses, exams, results]);

  const groupStats = useMemo(() => {
    return groups.map(group => {
      const groupResults = results.filter(r => r.groupName === group.name);
      const average = groupResults.length > 0
        ? groupResults.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)) * 100, 0) / groupResults.length
        : 0;
      return {
        name: group.name,
        average: Math.round(average),
        count: groupResults.length
      };
    }).filter(g => g.count > 0);
  }, [groups, results]);

  if (results.length === 0) {
    return <EmptyState message="Pas assez de données pour générer des analyses." />;
  }

  return (
    <div className="space-y-8 pb-12">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Analytique Globale</h2>
          <p className="text-slate-500">Visualisez les performances à travers tous les cours et groupes.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <Card className="p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Moyenne par Cours (%)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="average" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </Card>

         <Card className="p-6 space-y-6">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Moyenne par Groupe (%)
            </h3>
             <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groupStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={100} fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="average" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
         </Card>
      </div>
    </div>
  );
}

function AuthView({ onAuth }: { onAuth: (user: UserProfile) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [filiereId, setFiliereId] = useState<string>('');
  const [groupId, setGroupId] = useState<string>('');
  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [role, setRole] = useState<UserRole>('student');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLogin) {
      const fetchLists = async () => {
        try {
          const [f, g] = await Promise.all([api.filieres.list(), api.groups.list()]);
          setFilieres(f);
          setGroups(g);
        } catch (err) {
          console.error("Error fetching lists:", err);
        }
      };
      fetchLists();
    }
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        const { user } = await api.auth.login({ email, password });
        onAuth(user);
      } else {
        const fId = filiereId === '' ? undefined : Number(filiereId);
        const gId = groupId === '' ? undefined : Number(groupId);
        const { user } = await api.auth.signup({ 
          email, 
          password, 
          displayName, 
          role,
          filiereId: role === 'student' ? fId : undefined,
          groupId: role === 'student' ? gId : undefined,
          filiere: role === 'student' ? filieres.find(f => f.id === fId)?.name : undefined,
          groupName: role === 'student' ? groups.find(g => g.id === gId)?.name : undefined
        });
        onAuth(user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="bg-indigo-600 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isLogin ? 'Connexion à EduQCM' : 'Créer un compte'}
          </h1>
          <p className="text-slate-500 text-sm">
            {isLogin ? 'Accédez à votre espace personnel' : 'Rejoignez la plateforme EduQCM'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <Input label="Nom complet" value={displayName} onChange={setDisplayName} required icon={User} />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Rôle</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('student')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                      role === 'student' ? "bg-indigo-50 border-indigo-600 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Étudiant
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                      role === 'teacher' ? "bg-indigo-50 border-indigo-600 text-indigo-600" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    Enseignant
                  </button>
                </div>
              </div>
              {role === 'student' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Filière</label>
                    <select 
                      value={filiereId} 
                      onChange={(e) => {
                        setFiliereId(e.target.value);
                        setGroupId('');
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      required
                    >
                      <option value="">Sélectionnez une filière</option>
                      {filieres.map(f => <option key={f.id} value={f.id.toString()}>{f.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-700">Groupe</label>
                    <select 
                      value={groupId} 
                      onChange={(e) => setGroupId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      required
                      disabled={!filiereId}
                    >
                      <option value="">Sélectionnez un groupe</option>
                      {groups.filter(g => g.filiereId === Number(filiereId)).map(g => <option key={g.id} value={g.id.toString()}>{g.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
          <Input label="Email" type="email" value={email} onChange={setEmail} required icon={Mail} />
          <Input label="Mot de passe" type="password" value={password} onChange={setPassword} required icon={Lock} />
          
          <Button type="submit" disabled={loading} className="w-full py-2.5">
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'S\'inscrire'}
          </Button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-indigo-600 hover:underline font-medium"
          >
            {isLogin ? "Pas encore de compte ? S'inscrire" : "Déjà un compte ? Se connecter"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function NavButton({ children, active, onClick, icon }: { children: React.ReactNode; active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black transition-all duration-300 group relative",
        active 
          ? "bg-indigo-600 text-white shadow-polished" 
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
      )}
    >
      <span className={cn(
        "transition-transform duration-300",
        active ? "scale-110" : "group-hover:scale-110"
      )}>
        {icon}
      </span>
      <span className="flex-1 text-left">{children}</span>
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute left-[-1.5rem] w-1.5 h-6 bg-indigo-600 rounded-r-full"
        />
      )}
    </button>
  );
}

function DatabaseManagement() {
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = () => {
    window.location.href = api.admin.backup();
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Êtes-vous sûr de vouloir restaurer la base de données ? Les données actuelles seront remplacées.")) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsRestoring(true);
    try {
      await api.admin.restore(file);
      alert("Base de données restaurée avec succès. La page va s'actualiser.");
      window.location.reload();
    } catch (error) {
      console.error("Restore failed:", error);
      alert("Échec de la restauration.");
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <h3 className="text-xl font-black text-slate-900 tracking-tight">Système</h3>
        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
          <Database className="w-4 h-4 text-slate-300" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <Card className="p-5 border-2 border-slate-50 hover:bg-slate-50 transition-colors">
          <div className="flex flex-col gap-4">
            <div>
              <h4 className="font-black text-slate-900 text-sm mb-1 uppercase tracking-tight">Base de données</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Gérez la sauvegarde et la restauration de vos données.</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleBackup}
                variant="outline"
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50"
              >
                <Download className="w-3 h-3 mr-2" /> Sauvegarder
              </Button>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest"
              >
                {isRestoring ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Upload className="w-3 h-3 mr-2" /> Restaurer
                  </>
                )}
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleRestore} 
                className="hidden" 
                accept=".db"
              />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

// --- Teacher Dashboard ---

const ExamPreviewModal = React.memo(({ exam, onClose, courseName }: { exam: Exam; onClose: () => void; courseName?: string }) => {
  const totalPoints = useMemo(() => {
    return exam.questions.reduce((sum, q) => sum + (normalizeQuestion(q).points || 1), 0);
  }, [exam.questions]);

  return (
    <Modal title={`Aperçu de l'examen - ${exam.title}`} onClose={onClose} maxWidth="max-w-4xl">
      <div className="space-y-6 pr-2 w-full overflow-hidden">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-slate-900">{exam.title}</h4>
              {courseName && (
                <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full uppercase tracking-widest">
                  {courseName}
                </span>
              )}
              <span className="text-[10px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase tracking-widest">
                {totalPoints} point{totalPoints > 1 ? 's' : ''} au total
              </span>
            </div>
            <p className="text-sm text-slate-500">{exam.description}</p>
            <div className="flex gap-2 mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-[10px] h-7 gap-1.5 font-bold uppercase tracking-wider"
                onClick={() => {
                  const data = exam.questions.map(q => {
                    const nq = normalizeQuestion(q);
                    const exportQ: any = {
                      type: nq.type,
                      text: stripHtml(nq.text),
                      points: nq.points,
                      shuffleOptions: nq.shuffleOptions,
                    };
                    if (nq.type === 'multiple-choice' || nq.type === 'true-false') {
                      exportQ.options = nq.options?.map(o => stripHtml(o.text));
                      exportQ.correctOptionIndex = nq.options?.findIndex(o => o.isCorrect);
                    } else if (nq.type === 'short-answer') {
                      exportQ.correctAnswer = stripHtml(nq.correctAnswer || '');
                    } else if (nq.type === 'fill-in-the-blanks') {
                      exportQ.correctAnswers = nq.correctAnswers?.map(ans => stripHtml(ans));
                    } else if (nq.type === 'ordering') {
                      exportQ.options = nq.options?.map(o => stripHtml(o.text));
                      exportQ.correctOrder = nq.correctOrder;
                    } else if (nq.type === 'matching') {
                      exportQ.options = nq.options?.map(o => stripHtml(o.text));
                      exportQ.matchOptions = nq.matchOptions?.map(opt => stripHtml(opt));
                      exportQ.correctMatches = nq.correctMatches;
                    }
                    return exportQ;
                  });
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  saveAs(blob, `questions_${stripHtml(exam.title).replace(/\s+/g, '_')}.json`);
                }}
              >
                <FileCode className="w-3.5 h-3.5" /> JSON
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                className="text-[10px] h-7 gap-1.5 font-bold uppercase tracking-wider"
                onClick={() => {
                  const data = exam.questions.map(q => {
                    const nq = normalizeQuestion(q);
                    const row: any = {
                      type: nq.type,
                      text: stripHtml(nq.text),
                      points: nq.points,
                      shuffleOptions: nq.shuffleOptions,
                    };
                    if (nq.type === 'multiple-choice' || nq.type === 'true-false') {
                      row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
                      row.correctOptionIndex = nq.options?.findIndex(o => o.isCorrect);
                    } else if (nq.type === 'short-answer') {
                      row.correctAnswer = stripHtml(nq.correctAnswer || '');
                    } else if (nq.type === 'fill-in-the-blanks') {
                      row.correctAnswers = nq.correctAnswers?.map(ans => stripHtml(ans)).join('|');
                    } else if (nq.type === 'ordering') {
                      row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
                      row.correctOrder = nq.correctOrder?.join('|');
                    } else if (nq.type === 'matching') {
                      row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
                      row.matchOptions = nq.matchOptions?.map(opt => stripHtml(opt)).join('|');
                      row.correctMatches = nq.correctMatches?.join('|');
                    }
                    return row;
                  });
                  const csv = Papa.unparse(data);
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  saveAs(blob, `questions_${stripHtml(exam.title).replace(/\s+/g, '_')}.csv`);
                }}
              >
                <FileText className="w-3.5 h-3.5" /> CSV
              </Button>
            </div>
          </div>
          <div className="text-right space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase justify-end">
              <Clock className="w-3.5 h-3.5" /> {exam.durationMinutes} minutes
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase justify-end">
              <ClipboardList className="w-3.5 h-3.5" /> {exam.questions.length} questions
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-500 uppercase justify-end">
              <Plus className="w-3.5 h-3.5" /> {exam.questions.reduce((acc, q) => acc + (q.points || 1), 0)} points total
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h5 className="font-bold text-slate-900 flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600" />
            Contenu de l'examen
          </h5>
          <div className="space-y-6 w-full overflow-hidden">
            {exam.questions.map((rawQ, idx) => {
              const q = normalizeQuestion(rawQ);
              return (
                <div key={q.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm shadow-indigo-100">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest w-fit mb-1">
                          {q.type === 'multiple-choice' ? 'Choix multiple' : 
                           q.type === 'true-false' ? 'Vrai / Faux' : 
                           q.type === 'short-answer' ? 'Réponse courte' : 
                           q.type === 'fill-in-the-blanks' ? 'Texte à trous' : 
                           q.type === 'ordering' ? 'Mise en ordre' : 'Association'}
                        </span>
                        <div className="prose prose-base max-w-none font-semibold text-slate-950 leading-relaxed break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: q.text }} />
                      </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                      {q.points} pt{q.points > 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="space-y-3 ml-11">
                    {(q.type === 'multiple-choice' || q.type === 'true-false') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options?.map((opt, oIdx) => (
                          <div key={oIdx} className={cn(
                            "px-4 py-2.5 rounded-xl text-xs border flex items-center justify-between transition-all",
                            opt.isCorrect 
                              ? "bg-emerald-50 border-emerald-200 text-emerald-700 font-bold ring-2 ring-emerald-500/10" 
                              : "bg-slate-50 border-slate-100 text-slate-600"
                          )}>
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                                opt.isCorrect ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                              )}>
                                {opt.isCorrect && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                              <div dangerouslySetInnerHTML={{ __html: opt.text }} />
                            </div>
                            {opt.isCorrect && <span className="text-[9px] font-black uppercase tracking-tighter text-emerald-600 bg-white px-1.5 py-0.5 rounded border border-emerald-100">Correct</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.type === 'ordering' && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Ordre correct :</p>
                        <div className="flex flex-col gap-2">
                          {q.correctOrder?.map((origIdx, orderIdx) => {
                            const opt = q.options?.[origIdx];
                            return (
                              <div key={orderIdx} className="flex items-center gap-3 p-2 bg-emerald-50 border border-emerald-100 rounded-xl">
                                <span className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                                  {orderIdx + 1}
                                </span>
                                <div className="text-xs font-bold text-emerald-700" dangerouslySetInnerHTML={{ __html: typeof opt === 'string' ? opt : (opt?.text || '') }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {q.type === 'matching' && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Associations correctes :</p>
                        <div className="grid grid-cols-1 gap-2">
                          {q.options?.map((opt, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 font-medium" dangerouslySetInnerHTML={{ __html: typeof opt === 'string' ? opt : (opt?.text || '') }} />
                              <div className="text-emerald-500">
                                <ChevronRight className="w-5 h-5" />
                              </div>
                              <div className="flex-1 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs font-bold text-emerald-700">
                                {q.matchOptions?.[q.correctMatches?.[i] ?? -1] || '---'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {q.type === 'short-answer' && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4">
                        <div className="bg-emerald-500 p-2 rounded-xl text-white">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Réponse attendue</p>
                          <div className="text-sm font-bold text-emerald-700 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: q.correctAnswer || '' }} />
                        </div>
                      </div>
                    )}

                    {q.type === 'fill-in-the-blanks' && (
                      <div className="space-y-3">
                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Aperçu avec réponses :</p>
                          <div className="text-sm leading-relaxed text-slate-700 flex flex-wrap items-center gap-x-1">
                            {q.text.split(/\[blank\]/).map((part, i, arr) => (
                              <React.Fragment key={i}>
                                <span dangerouslySetInnerHTML={{ __html: part }} />
                                {i < arr.length - 1 && (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-bold border border-emerald-200">
                                    {q.correctAnswers?.[i] || '___'}
                                  </span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {q.correctAnswers?.map((ans, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                              <span className="text-[10px] font-black text-emerald-400">#{i + 1}</span>
                              <span className="text-xs font-bold text-emerald-700">{ans}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
});

const ExamPublishModal = ({ exam, groups, onClose, onComplete }: { exam: Exam; groups: Group[]; onClose: () => void; onComplete: () => void }) => {
  const [selectedGroupId, setSelectedGroupId] = useState<number | string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePublish = async () => {
    if (!selectedGroupId) return;
    setIsSubmitting(true);
    try {
      await api.exams.publish(exam.id, Number(selectedGroupId));
      onComplete();
    } catch (err: any) {
      alert("Erreur lors de l'activation de l'examen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
        <p className="text-sm font-medium text-indigo-700">Sélectionnez le groupe d'étudiants qui pourra passer cet examen.</p>
      </div>
      
      <div className="space-y-2">
        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Groupe Cible</label>
        <select 
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
        >
          <option value="">Sélectionner un groupe...</option>
          {groups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl text-xs uppercase tracking-widest font-black">Annuler</Button>
        <Button onClick={handlePublish} disabled={!selectedGroupId || isSubmitting} className="flex-1 h-12 rounded-xl text-xs uppercase tracking-widest font-black">
          {isSubmitting ? "Activation..." : "Activer l'Examen"}
        </Button>
      </div>
    </div>
  );
};

function TeacherDashboard({ courses, exams, results, notifications, filieres, studentCount, user, onRefresh, groups }: { 
  courses: Course[]; 
  exams: Exam[]; 
  results: Result[]; 
  notifications: Notification[];
  filieres: Filiere[];
  studentCount: number;
  user: UserProfile;
  onRefresh: () => void;
  groups: Group[];
}) {
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [isAddingExam, setIsAddingExam] = useState(false);
  const [isAddingNotification, setIsAddingNotification] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [publishingExam, setPublishingExam] = useState<Exam | null>(null);
  const [courseSearch, setCourseSearch] = useState('');
  const [examSearch, setExamSearch] = useState('');
  const [examSortBy, setExamSortBy] = useState<'createdAt' | 'title'>('createdAt');

  const filteredCourses = useMemo(() => {
    return courses.filter(c => 
      c.name.toLowerCase().includes(courseSearch.toLowerCase()) || 
      c.description.toLowerCase().includes(courseSearch.toLowerCase())
    );
  }, [courses, courseSearch]);

  const filteredExams = useMemo(() => {
    return exams
      .filter(e => 
        e.title.toLowerCase().includes(examSearch.toLowerCase()) || 
        e.description.toLowerCase().includes(examSearch.toLowerCase())
      )
      .sort((a, b) => {
        if (examSortBy === 'createdAt') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.title.localeCompare(b.title);
      });
  }, [exams, examSearch, examSortBy]);

  const upcomingExams = useMemo(() => {
    const now = new Date();
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);
    
    return exams
      .filter(e => {
        if (!e.scheduledAt) return false;
        const examDate = new Date(e.scheduledAt);
        return examDate >= now && examDate <= next7Days;
      })
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  }, [exams]);

  const generalAverage = useMemo(() => {
    if (results.length === 0) return 0;
    const totalPercentage = results.reduce((acc, r) => {
      const total = r.totalPoints || 1;
      return acc + (r.score / total) * 100;
    }, 0);
    return Math.round(totalPercentage / results.length);
  }, [results]);

  const participationRate = useMemo(() => {
    if (exams.length === 0 || studentCount === 0) return 0;
    const totalExpected = exams.length * studentCount;
    return Math.round((results.length / totalExpected) * 100);
  }, [exams.length, results.length, studentCount]);

  const handleDeleteCourse = async (id: number) => {
    const course = courses.find(c => c.id === id);
    if (course?.hasExams) {
      alert("Impossible de supprimer ce cours car il contient des examens. Supprimez d'abord les examens liés.");
      return;
    }
    if (!confirm("Voulez-vous vraiment supprimer ce cours ?")) return;
    try {
      await api.courses.delete(id);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la suppression du cours.");
      console.error("Error deleting course:", err);
    }
  };

  const handleDeleteExam = async (id: number) => {
    const exam = exams.find(e => e.id === id);
    if (exam?.hasResults) {
      alert("Impossible de supprimer cet examen car il a déjà été passé par des étudiants.");
      return;
    }
    if (!confirm("Voulez-vous vraiment supprimer cet examen ?")) return;
    try {
      await api.exams.delete(id);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || "Erreur lors de la suppression de l'examen.");
      console.error("Error deleting exam:", err);
    }
  };

  const handleUnpublish = async (e: React.MouseEvent, examId: number) => {
    e.stopPropagation();
    if (!confirm("Voulez-vous désactiver cet examen ? Il ne sera plus visible par les étudiants.")) return;
    try {
      await api.exams.unpublish(examId);
      onRefresh();
    } catch (err) {
      alert("Erreur lors de la désactivation.");
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tableau de bord Enseignant</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight font-display">Bienvenue, Prof. {user.displayName.split(' ')[0]}</h2>
          <p className="text-slate-500 font-medium">Vous avez <span className="text-indigo-600 font-bold">{upcomingExams.length} examens</span> prévus pour cette semaine.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setIsAddingCourse(true)} variant="outline" className="h-14 px-8">
            <Plus className="w-5 h-5" /> Cours
          </Button>
          <Button onClick={() => setIsAddingExam(true)} className="h-14 px-8">
            <Plus className="w-5 h-5" /> Examen
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Étudiants Inscrits" 
          value={studentCount.toString()} 
          subValue="+12% ce mois"
          icon={<Users className="w-6 h-6 text-indigo-600" />} 
          color="indigo"
        />
        <StatCard 
          title="Examens Créés" 
          value={exams.length.toString()} 
          subValue={`${filieres.length} Filières`}
          icon={<ClipboardList className="w-6 h-6 text-amber-600" />} 
          color="amber"
        />
        <StatCard 
          title="Moyenne de Classe" 
          value={`${generalAverage}%`} 
          subValue="Sur tous les résultats"
          icon={<BarChart3 className="w-6 h-6 text-emerald-600" />} 
          color="emerald"
        />
        <StatCard 
          title="Taux de Participation" 
          value={`${participationRate}%`} 
          subValue="Activité globale"
          icon={<History className="w-6 h-6 text-violet-600" />} 
          color="violet"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          {upcomingExams.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Prochainement</h3>
                </div>
                <button className="text-xs font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest px-3 py-1 rounded-full hover:bg-indigo-50 transition-all">Voir tout</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcomingExams.map(exam => {
                  const examDate = new Date(exam.scheduledAt!);
                  const daysToVal = Math.ceil((examDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <Card key={exam.id} className="p-1 group overflow-hidden border-2 border-slate-100">
                      <div className="p-5 flex flex-col h-full bg-white rounded-[1.75rem] transition-colors group-hover:bg-slate-50/50">
                        <div className="flex justify-between items-start mb-4">
                          <div className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider",
                            daysToVal <= 1 ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-600"
                          )}>
                            {daysToVal === 0 ? "Aujourd'hui" : daysToVal === 1 ? "Demain" : `Dans ${daysToVal} jours`}
                          </div>
                          <div className="text-slate-300 group-hover:text-indigo-400 transition-colors">
                            <ArrowUp className="w-4 h-4 rotate-45" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-black text-slate-900 text-lg mb-1 leading-tight group-hover:text-indigo-600 transition-colors">{exam.title}</h4>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            {courses.find(c => c.id === exam.courseId)?.name}
                          </p>
                        </div>
                        <div className="mt-6 flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            {examDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {examDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Vos Examens</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="Filtrer..." 
                    value={examSearch}
                    onChange={(e) => setExamSearch(e.target.value)}
                    className="w-40 pl-9 pr-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                  />
                </div>
                <select 
                  value={examSortBy}
                  onChange={(e) => setExamSortBy(e.target.value as 'createdAt' | 'title')}
                  className="px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none text-slate-600"
                >
                  <option value="createdAt">Date (Récent)</option>
                  <option value="title">Titre (A-Z)</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredExams.length === 0 ? (
                <EmptyState message={examSearch ? "Aucun examen trouvé." : "Commencez par créer un examen."} />
              ) : (
                filteredExams.map(exam => (
                  <Card 
                    key={exam.id} 
                    className="p-5 hover:border-indigo-100 group shadow-subtle hover:shadow-polished"
                    onClick={() => setEditingExam(exam)}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <h4 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">{exam.title}</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{courses.find(c => c.id === exam.courseId)?.name}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300" />
                          <span className="text-[10px] font-bold text-indigo-500">{exam.questions.length} Questions</span>
                        </div>
                      </div>
                      {exam.status === 'active' ? (
                        <div className="flex flex-col items-end gap-1">
                          <div className="px-2 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-wider rounded-lg border border-emerald-100/50 flex items-center gap-1">
                            <Check className="w-3 h-3" /> Activé
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Groupe: {exam.groupName || 'Inconnu'}</span>
                        </div>
                      ) : (
                        <div className="px-2 py-1 bg-slate-50 text-slate-400 text-[9px] font-black uppercase tracking-wider rounded-lg border border-slate-100">Brouillon</div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-6">
                      <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center overflow-hidden">
                            <User className="w-3 h-3 text-slate-300" />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        {exam.status === 'draft' ? (
                          <button 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors text-[10px] font-black uppercase tracking-widest border border-indigo-100/50 shadow-sm"
                            onClick={(e) => { e.stopPropagation(); setPublishingExam(exam); }}
                          >
                            <Target className="w-3 h-3" /> Activer
                          </button>
                        ) : (
                          <button 
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-colors text-[10px] font-black uppercase tracking-widest border border-slate-100/50"
                            onClick={(e) => handleUnpublish(e, exam.id)}
                            title="Désactiver (Passer en brouillon)"
                          >
                            <X className="w-3 h-3" /> Désactiver
                          </button>
                        )}
                        <button 
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                          onClick={(e) => { e.stopPropagation(); setPreviewExam(exam); }}
                          title="Aperçu"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className={cn(
                            "p-2 rounded-lg transition-colors",
                            exam.hasResults ? "text-slate-200 cursor-not-allowed" : "text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                          )}
                          onClick={(e) => { e.stopPropagation(); !exam.hasResults && handleDeleteExam(exam.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
              <button 
                onClick={() => setIsAddingExam(true)}
                className="col-span-full py-5 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
              >
                <Plus className="w-4 h-4" /> Créer un nouvel examen
              </button>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-10">
          <section className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Vos Cours</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="text" 
                  placeholder="Rechercher..." 
                  value={courseSearch}
                  onChange={(e) => setCourseSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                />
              </div>
            </div>
            
            <div className="space-y-3">
              {filteredCourses.map(course => (
                <Card 
                  key={course.id} 
                  className="p-4 group border-2 border-slate-50 hover:border-indigo-100 transition-all cursor-pointer"
                  onClick={() => setEditingCourse(course)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                      <BookOpen className="w-6 h-6 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-slate-900 text-sm truncate uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{course.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">{course.code || 'COURS'}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </Card>
              ))}
              <button 
                onClick={() => setIsAddingCourse(true)}
                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Ajouter un cours
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Annonces</h3>
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                <Bell className="w-4 h-4 text-slate-300" />
              </div>
            </div>
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <EmptyState message="Aucune nouvelle annonce." />
              ) : (
                notifications.slice(0, 4).map(notif => (
                  <Card key={notif.id} className="p-5 border-2 border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => {/* navigate to notifications */}}>
                    <div className="flex items-center gap-2 text-indigo-600 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                    </div>
                    <h4 className="font-black text-slate-900 text-sm mb-1 leading-tight">{notif.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{stripHtml(notif.content)}</p>
                  </Card>
                ))
              )}
              <button 
                onClick={() => setIsAddingNotification(true)}
                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
              >
                <Plus className="w-4 h-4" /> Publier une annonce
              </button>
            </div>
          </section>

          <section className="bg-indigo-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-deep">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full transform translate-x-12 -translate-y-12" />
            <Sparkles className="w-8 h-8 text-indigo-300 mb-6" />
            <h3 className="text-xl font-black tracking-tight mb-2">Aperçu Intelligent</h3>
            <p className="text-indigo-200 text-sm font-medium mb-6">La filière <span className="text-white font-bold">Informatique</span> montre une progression de <span className="text-emerald-400 font-black">+14%</span> cette semaine.</p>
            <div className="space-y-4">
              <div className="h-1.5 w-full bg-indigo-950 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 w-[65%]" />
              </div>
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-indigo-300/60">
                <span>Objectif de réussite</span>
                <span>65% atteint</span>
              </div>
            </div>
          </section>

          <DatabaseManagement />
        </aside>
      </div>

      <AnimatePresence>
        {publishingExam && (
          <Modal title={`Activer l'examen: ${publishingExam.title}`} onClose={() => setPublishingExam(null)} maxWidth="max-w-md">
            <ExamPublishModal 
              exam={publishingExam} 
              groups={groups} 
              onClose={() => setPublishingExam(null)} 
              onComplete={() => { setPublishingExam(null); onRefresh(); }} 
            />
          </Modal>
        )}
        {isAddingCourse && (
          <Modal title="Ajouter un Cours" onClose={() => setIsAddingCourse(false)}>
            <AddCourseForm filieres={filieres} onComplete={() => { setIsAddingCourse(false); onRefresh(); }} user={user} />
          </Modal>
        )}
        {editingCourse && (
          <Modal title="Modifier le Cours" onClose={() => setEditingCourse(null)}>
            <AddCourseForm 
              filieres={filieres}
              onComplete={() => { setEditingCourse(null); onRefresh(); }} 
              user={user} 
              initialData={editingCourse} 
            />
          </Modal>
        )}
        {isAddingExam && (
          <Modal title="Créer un Examen QCM" onClose={() => setIsAddingExam(false)} maxWidth="max-w-4xl">
            <AddExamForm courses={courses} onComplete={() => { setIsAddingExam(false); onRefresh(); }} user={user} />
          </Modal>
        )}
        {editingExam && (
          <Modal title="Modifier l'Examen" onClose={() => setEditingExam(null)} maxWidth="max-w-4xl">
            <AddExamForm 
              courses={courses} 
              onComplete={() => { setEditingExam(null); onRefresh(); }} 
              user={user} 
              initialData={editingExam} 
            />
          </Modal>
        )}
        {previewExam && (
          <ExamPreviewModal 
            exam={previewExam} 
            onClose={() => setPreviewExam(null)} 
            courseName={courses.find(c => c.id === previewExam.courseId)?.name}
          />
        )}
        {isAddingNotification && (
          <Modal title="Nouvelle Annonce" onClose={() => setIsAddingNotification(false)}>
            <AddNotificationForm onComplete={() => { setIsAddingNotification(false); onRefresh(); }} user={user} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Student Dashboard ---

function StudentDashboard({ exams, results, notifications, onStartExam, user, courses }: { 
  exams: Exam[]; 
  results: Result[]; 
  notifications: Notification[];
  onStartExam: (exam: Exam) => void;
  user: UserProfile;
  courses: Course[];
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'title'>('createdAt');

  const examsWithStatus = useMemo(() => {
    return exams
      .filter(e => 
        e.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        courses.find(c => c.id === e.courseId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .map(exam => ({
        ...exam,
        hasTaken: results.some(r => r.examId === exam.id)
      }))
      .sort((a, b) => {
        if (sortBy === 'createdAt') {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.title.localeCompare(b.title);
      });
  }, [exams, results, searchQuery, courses, sortBy]);

  const stats = useMemo(() => {
    const totalTaken = results.length;
    const averageScore = results.length > 0 
      ? Math.round(results.reduce((acc, r) => acc + (r.score / (r.totalPoints || 1)) * 100, 0) / results.length)
      : 0;
    const pendingExams = examsWithStatus.filter(e => !e.hasTaken).length;
    
    return { totalTaken, averageScore, pendingExams };
  }, [results, examsWithStatus]);

  return (
    <div className="space-y-12">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600">
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tableau de bord Étudiant</span>
          </div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight font-display">Salut, {user.displayName.split(' ')[0]} 👋</h2>
          <p className="text-slate-500 font-medium">Vous avez <span className="text-indigo-600 font-bold">{stats.pendingExams} examens</span> en attente.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-3 rounded-[1.5rem] border border-slate-200/60 shadow-subtle min-w-[240px]">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
            <BookOpen className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Votre Classe</p>
            <p className="text-sm font-black text-slate-900 truncate tracking-tight">{user.filiere} • {user.groupName}</p>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-subtle group hover:shadow-polished transition-all duration-500">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Passés</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">{stats.totalTaken}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-subtle group hover:shadow-polished transition-all duration-500">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Moyenne</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight">{stats.averageScore}%</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-subtle group hover:shadow-polished transition-all duration-500">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">En attente</p>
            <h4 className="text-3xl font-black text-slate-900 tracking-tight font-display">{stats.pendingExams}</h4>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Examens Disponibles</h3>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="Rechercher..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 pl-9 pr-4 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none"
                  />
                </div>
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'title')}
                  className="px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-xs font-bold transition-all outline-none text-slate-600"
                >
                  <option value="createdAt">Date (Récent)</option>
                  <option value="title">Titre (A-Z)</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {examsWithStatus.length === 0 ? (
                <div className="col-span-full"><EmptyState message={searchQuery ? "Aucun examen trouvé." : "Aucun examen disponible."} /></div>
              ) : (
                examsWithStatus.map(exam => {
                  const totalPoints = getExamTotalPoints(exam);
                  const examResult = results.find(r => r.examId === exam.id);
                  return (
                    <Card key={exam.id} className="p-1 group overflow-hidden border-2 border-slate-100 hover:border-indigo-100">
                      <div className="p-6 flex flex-col h-full bg-white rounded-[1.75rem] transition-colors group-hover:bg-slate-50/50">
                        <div className="flex items-start justify-between mb-4">
                          <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                            {courses.find(c => c.id === exam.courseId)?.name || 'Cours inconnu'}
                          </span>
                          <span className="text-[10px] font-black text-amber-600 flex items-center gap-1 uppercase tracking-widest bg-amber-50 px-2 py-1 rounded-lg">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {totalPoints} PTS
                          </span>
                        </div>
                        
                        <div className="flex-1">
                          <h4 className="font-black text-slate-900 text-xl leading-tight group-hover:text-indigo-600 transition-colors mb-2">{exam.title}</h4>
                          <p className="text-xs font-medium text-slate-400 line-clamp-2 leading-relaxed mb-6">{exam.description || 'Pas de description fournie.'}</p>
                          
                          <div className="flex items-center gap-4 py-4 border-y border-slate-100 mb-6">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Durée</span>
                              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mt-0.5">
                                <Clock className="w-3.5 h-3.5 text-slate-400" /> {exam.durationMinutes} min
                              </span>
                            </div>
                            <div className="w-px h-6 bg-slate-100" />
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Questions</span>
                              <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 mt-0.5">
                                <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> {exam.questions.length} Qs
                              </span>
                            </div>
                          </div>
                        </div>

                        {exam.hasTaken ? (
                          <div className="space-y-3 mt-auto">
                            <div className="flex items-center justify-center gap-2 py-4 bg-emerald-50 text-emerald-600 rounded-2xl font-black text-xs uppercase tracking-widest border border-emerald-100/50">
                              <CheckCircle2 className="w-4 h-4" /> Terminé
                            </div>
                            {examResult && (
                              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Score Obtenu</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-xl font-black text-indigo-600 tracking-tighter">{examResult.score}</span>
                                  <span className="text-xs text-slate-300 font-black">/ {examResult.totalPoints || totalPoints}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Button onClick={() => onStartExam(exam)} className="w-full h-14 rounded-2xl text-xs uppercase tracking-[0.2em] font-black mt-auto">
                            Commencer <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside className="lg:col-span-4 space-y-10">
          <section className="space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Annonces</h3>
              <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center">
                <Bell className="w-4 h-4 text-slate-300" />
              </div>
            </div>
            <div className="space-y-4">
              {notifications.length === 0 ? (
                <EmptyState message="Aucune nouvelle annonce." />
              ) : (
                notifications.slice(0, 4).map(notif => (
                  <Card key={notif.id} className="p-5 border-2 border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-2 text-indigo-600 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                      <span className="text-[10px] font-black uppercase tracking-widest">{new Date(notif.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                    </div>
                    <h4 className="font-black text-slate-900 text-sm mb-1 leading-tight">{notif.title}</h4>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{notif.content}</p>
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Promotion Card */}
          <section className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-deep">
             <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
             <div className="relative z-10">
               <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mb-6">
                 <Target className="w-6 h-6 text-white" />
               </div>
               <h3 className="text-xl font-black mb-2 tracking-tight">Préparez vos examens</h3>
               <p className="text-indigo-100 text-sm font-medium mb-6">Restez à jour avec vos cours et assurez une révision régulière.</p>
               <button className="w-full py-3 bg-white text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 transition-colors">Explorer les ressources</button>
             </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// --- Exam View ---

function ExamView({ exam, onComplete, onCancel, user, courseName }: { 
  exam: Exam; 
  onComplete: () => void; 
  onCancel: () => void;
  user: UserProfile;
  courseName?: string;
}) {
  // Runtime questions with stable mapping for shuffled options
  const [questions] = useState(() => {
    let qs = exam.questions.map((rawQ, idx) => {
      const q = normalizeQuestion(rawQ);
      // Ensure ID is stable even if missing in DB
      if (!q.id) q.id = `q-${idx}`;
      
      const runtimeQ = { 
        ...q,
        // Store options with their original indices to make shuffling robust
        runtimeOptions: q.options?.map((opt, oIdx) => ({ ...opt, idx: oIdx })) || [],
        runtimeMatchOptions: q.matchOptions?.map((text, mIdx) => ({ text, idx: mIdx })) || []
      };

      if (q.shuffleOptions) {
        if (q.type === 'multiple-choice' || q.type === 'true-false' || q.type === 'ordering') {
          runtimeQ.runtimeOptions = [...runtimeQ.runtimeOptions].sort(() => Math.random() - 0.5);
        }
        if (q.type === 'matching') {
          runtimeQ.runtimeMatchOptions = [...runtimeQ.runtimeMatchOptions].sort(() => Math.random() - 0.5);
        }
      }
      return runtimeQ;
    });

    if (exam.shuffleQuestions) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }
    return qs;
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Initialize answers using original indices
  const [answers, setAnswers] = useState<any[]>(() => {
    return questions.map(q => {
      if (q.type === 'ordering') {
        // For ordering, the answer is the sequence of original indices
        return q.runtimeOptions.map(opt => opt.idx);
      }
      if (q.type === 'matching') {
        // For matching with drag and drop, the answer is the order of right-side indices
        return q.runtimeMatchOptions.map(mOpt => mOpt.idx);
      }
      if (q.type === 'fill-in-the-blanks') {
        return new Array(q.correctAnswers?.length || 0).fill('');
      }
      return null;
    });
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiGrading, setIsAiGrading] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [isAutoSubmitted, setIsAutoSubmitted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [timeLeft, setTimeLeft] = useState(exam.durationMinutes * 60);
  const [startTime] = useState(() => {
    const saved = localStorage.getItem(`exam_start_${exam.id}_${user.id}`);
    if (saved) return parseInt(saved);
    const now = Date.now();
    localStorage.setItem(`exam_start_${exam.id}_${user.id}`, now.toString());
    return now;
  });

  const currentQuestion = questions[currentQuestionIndex];

  const handleSubmit = useCallback(async (isAutoArg: any = false, force = false) => {
    const isAuto = isAutoArg === true;
    if (isSubmitting || showCompletion) return;

    if (!isAuto && !force && answers.some(a => a === null || (Array.isArray(a) && a.some(v => v === -1)))) {
      setShowConfirmModal(true);
      return;
    }

    if (isAuto) setIsAutoSubmitted(true);
    else setIsAutoSubmitted(false);

    const hasShortAnswers = questions.some(q => q.type === 'short-answer');
    if (hasShortAnswers) setIsAiGrading(true);
    setIsSubmitting(true);
    localStorage.removeItem(`exam_start_${exam.id}_${user.id}`);
    let totalScore = 0;
    let totalPossiblePoints = 0;
    const finalQuestionResults: { isCorrect: boolean; pointsEarned: number }[] = [];

    const normalizeStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

    for (let idx = 0; idx < questions.length; idx++) {
      const q = questions[idx];
      const ans = answers[idx];
      if (!q) continue;
      
      const points = q.points || 1;
      totalPossiblePoints += points;
      
      let pointsEarned = 0;
      let isCorrect = false;

      if (q.type === 'short-answer') {
        const studentAns = ans?.toString().trim() || '';
        const studentAnsPlainText = stripHtml(studentAns);
        const expectedAns = stripHtml(q.correctAnswer || '').trim();
        
        if (normalizeStr(studentAnsPlainText) === normalizeStr(expectedAns)) {
          isCorrect = true;
          pointsEarned = points;
        } else if (studentAnsPlainText && expectedAns) {
          try {
            // We pass the raw studentAns (potentially with HTML/Math) to Gemini for smarter evaluation
            const scoreMultiplier = await evaluateShortAnswer(stripHtml(q.text), expectedAns, studentAns);
            pointsEarned = scoreMultiplier * points;
            isCorrect = scoreMultiplier >= 0.8; 
          } catch (e) {
            isCorrect = normalizeStr(studentAnsPlainText) === normalizeStr(expectedAns);
            pointsEarned = isCorrect ? points : 0;
          }
        }
      } else if (q.type === 'fill-in-the-blanks') {
        const totalBlanks = (q.correctAnswers || []).length;
        if (totalBlanks > 0) {
          const correctCount = (q.correctAnswers || []).filter((ca, i) => normalizeStr(ans?.[i]?.toString() || '') === normalizeStr(ca)).length;
          pointsEarned = (correctCount / totalBlanks) * points;
          isCorrect = correctCount === totalBlanks;
        }
      } else if (q.type === 'ordering') {
        const totalItems = (q.correctOrder || []).length;
        if (totalItems > 0) {
          const correctPositions = (q.correctOrder || []).filter((correctIdx, i) => ans?.[i] === correctIdx).length;
          pointsEarned = (correctPositions / totalItems) * points;
          isCorrect = correctPositions === totalItems;
        }
      } else if (q.type === 'matching') {
        const totalMatches = (q.correctMatches || []).length;
        if (totalMatches > 0) {
          const correctMatches = (q.correctMatches || []).filter((correctRightIdx, i) => ans?.[i] === correctRightIdx).length;
          pointsEarned = (correctMatches / totalMatches) * points;
          isCorrect = correctMatches === totalMatches;
        }
      } else {
        isCorrect = ans !== null && ans !== undefined && q.options?.[ans as number]?.isCorrect === true;
        pointsEarned = isCorrect ? points : 0;
      }

      totalScore += pointsEarned;
      finalQuestionResults.push({ isCorrect, pointsEarned });
    }

    try {
      await api.results.create({
        examId: exam.id,
        score: totalScore,
        totalQuestions: questions.length,
        totalPoints: totalPossiblePoints,
        answers: exam.questions.map((originalQ, origIdx) => {
          const qId = originalQ.id || `q-${origIdx}`;
          const shuffledIdx = questions.findIndex(q => q.id === qId);
          return shuffledIdx !== -1 ? answers[shuffledIdx] : null;
        }),
        questionResults: exam.questions.map((originalQ, origIdx) => {
          const qId = originalQ.id || `q-${origIdx}`;
          const shuffledIdx = questions.findIndex(q => q.id === qId);
          return shuffledIdx !== -1 ? finalQuestionResults[shuffledIdx] : { isCorrect: false, pointsEarned: 0 };
        })
      });
      setShowCompletion(true);
      setTimeout(() => {
        onComplete();
      }, 3000);
    } catch (error) {
      console.error("Error submitting result:", error);
    } finally {
      setIsSubmitting(false);
      setIsAiGrading(false);
    }
  }, [isSubmitting, showCompletion, answers, questions, exam, onComplete]);

  // Countdown timer logic
  useEffect(() => {
    if (showCompletion || isSubmitting) return;

    const totalSeconds = exam.durationMinutes * 60;
    
    const updateTimer = () => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, totalSeconds - elapsedSeconds);
      
      setTimeLeft(remaining);

      if (remaining <= 0) {
        handleSubmit(true);
        return false;
      }
      return true;
    };

    // Initial update
    if (!updateTimer()) return;

    const timer = setInterval(() => {
      if (!updateTimer()) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime, exam.durationMinutes, showCompletion, isSubmitting, handleSubmit]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleAnswer = useCallback((answer: any) => {
    React.startTransition(() => {
      setAnswers(prev => {
        const newAnswers = [...prev];
        newAnswers[currentQuestionIndex] = answer;
        return newAnswers;
      });
    });
  }, [currentQuestionIndex]);

  if (!currentQuestion) return null;

  return (
    <div className="space-y-6 relative w-full overflow-hidden">
      <AnimatePresence>
        {showConfirmModal && (
          <Modal title="Confirmer la soumission" onClose={() => setShowConfirmModal(false)}>
            <div className="p-6">
              <div className="flex items-center gap-4 text-amber-600 mb-4">
                <AlertCircle className="w-8 h-8" />
                <p className="font-medium">Vous n'avez pas répondu à toutes les questions.</p>
              </div>
              <p className="text-slate-600 mb-6">
                Voulez-vous vraiment terminer l'examen maintenant ? Vos réponses non remplies seront comptées comme incorrectes.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
                  Continuer l'examen
                </Button>
                <Button onClick={() => {
                  setShowConfirmModal(false);
                  handleSubmit(false, true);
                }}>
                  Terminer quand même
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showCompletion && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 rounded-2xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center mb-6",
                isAutoSubmitted ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
              )}
            >
              {isAutoSubmitted ? <Clock className="w-10 h-10" /> : <CheckCircle2 className="w-10 h-10" />}
            </motion.div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {isAutoSubmitted ? "Temps écoulé !" : "Examen terminé !"}
            </h3>
            <p className="text-slate-600 mb-6">
              {isAutoSubmitted 
                ? "Votre examen a été soumis automatiquement car le temps est imparti." 
                : "Vos réponses ont été enregistrées avec succès."}
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="w-4 h-4" />
              Redirection vers vos résultats...
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="space-y-4 flex-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">{exam.title}</h2>
                {courseName && (
                  <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg uppercase tracking-widest border border-indigo-100">
                    {courseName}
                  </span>
                )}
                <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg uppercase tracking-widest border border-amber-100">
                  {questions.reduce((sum, q) => sum + (q.points || 1), 0)} points au total
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium flex items-center gap-2">
                Question <span className="text-slate-900 font-black">{currentQuestionIndex + 1}</span> sur <span className="text-slate-900 font-black">{questions.length}</span>
                <span className="text-slate-300">•</span>
                <span className="font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{currentQuestion.points || 1} point{ (currentQuestion.points || 1) > 1 ? 's' : '' }</span>
              </p>
            </div>
            <div className="md:hidden">
              <div className={cn(
                "px-4 py-2 rounded-2xl border flex items-center gap-2 font-mono text-xl font-black shadow-sm",
                timeLeft < 60 ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse" : "bg-white border-slate-200 text-slate-900"
              )}>
                <Clock className="w-5 h-5" />
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-1.5">
            {questions.map((_, idx) => {
              const ans = answers[idx];
              const isAnswered = ans !== null && 
                                (Array.isArray(ans) 
                                  ? ans.length > 0 && ans.every((v: any) => v !== -1 && v !== '')
                                  : ans !== undefined && ans !== '');
              
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={cn(
                    "w-9 h-9 rounded-xl text-[10px] font-black transition-all duration-300 border-2",
                    currentQuestionIndex === idx 
                      ? "bg-indigo-600 border-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200" 
                      : isAnswered 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-600" 
                        : "bg-white border-slate-100 text-slate-400 hover:border-slate-300"
                  )}
                  title={`Aller à la question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <div className={cn(
              "px-6 py-4 rounded-[2rem] border-2 flex flex-col items-center gap-1 font-mono shadow-xl transition-all duration-500",
              timeLeft < 60 ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse scale-110" : "bg-white border-slate-100 text-slate-900"
            )}>
              <span className="text-[10px] font-black uppercase tracking-widest opacity-50">Temps restant</span>
              <div className="flex items-center gap-2 text-3xl font-black">
                <Clock className={cn("w-6 h-6", timeLeft < 60 ? "text-rose-500" : "text-slate-400")} />
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="gap-2 shadow-lg shadow-indigo-100 min-w-[120px]">
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isAiGrading ? 'Graduation IA...' : 'Envoi...'}
                </div>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Terminer
                </>
              )}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={isSubmitting} className="text-slate-400 hover:text-rose-500 text-xs">
              Quitter
            </Button>
          </div>
        </div>
      </div>

      {/* Timer Progress Bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-400">
          <span>Progression de l'examen</span>
          <span>{Math.round((timeLeft / (exam.durationMinutes * 60)) * 100)}% restant</span>
        </div>
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/50">
          <motion.div 
            className={cn(
              "h-full transition-colors duration-500",
              timeLeft < 60 ? "bg-rose-500" : timeLeft < 300 ? "bg-amber-500" : "bg-indigo-600"
            )}
            initial={{ width: "100%" }}
            animate={{ width: `${(timeLeft / (exam.durationMinutes * 60)) * 100}%` }}
          />
        </div>
      </div>

      <Card className="p-4 md:p-8 space-y-6 md:space-y-8 overflow-hidden">
        <div className="prose prose-indigo prose-base md:prose-lg max-w-none text-slate-950 font-medium leading-relaxed break-normal overflow-x-auto">
          {currentQuestion.type === 'fill-in-the-blanks' ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-4 leading-relaxed text-base md:text-lg text-slate-950">
              {currentQuestion.text.split(/\[blank\]/).map((part, i, arr) => (
                <React.Fragment key={i}>
                  <span dangerouslySetInnerHTML={{ __html: part }} />
                  {i < arr.length - 1 && (
                    <input 
                      type="text"
                      value={answers[currentQuestionIndex]?.[i] || ''}
                      onChange={(e) => {
                        const newAns = [...(answers[currentQuestionIndex] || [])];
                        newAns[i] = e.target.value;
                        handleAnswer(newAns);
                      }}
                      className="px-2 py-1 border-b-2 border-indigo-300 focus:border-indigo-600 outline-none min-w-[100px] text-center font-medium"
                      placeholder="..."
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: currentQuestion.text }} />
          )}
        </div>
        
        {currentQuestion.type === 'short-answer' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Votre réponse</label>
            <RichTextEditor 
              value={answers[currentQuestionIndex] as string || ''}
              onChange={(val) => handleAnswer(val)}
              className="bg-white border border-slate-200 rounded-xl min-h-[150px]"
              placeholder="Tapez votre réponse ici..."
            />
          </div>
        )}

        {currentQuestion.type === 'ordering' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500 italic">Faites glisser les éléments pour les mettre dans le bon ordre.</p>
              <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Drag & Drop Actif</span>
              </div>
            </div>
            
            <Reorder.Group 
              axis="y" 
              values={answers[currentQuestionIndex] || []} 
              onReorder={handleAnswer}
              className="space-y-3"
            >
              {(answers[currentQuestionIndex] || []).map((originalIdx: number, i: number) => (
                <Reorder.Item 
                  key={originalIdx} 
                  value={originalIdx}
                  className="group"
                >
                  <Card className={cn(
                    "flex items-center gap-2 md:gap-3 p-3 md:p-4 bg-white border-2 border-slate-100 rounded-xl cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md hover:border-indigo-100",
                    "select-none touch-none"
                  )}>
                    <div className="flex items-center gap-2 md:gap-3 flex-1">
                      <div className="flex flex-col items-center gap-1 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <span className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center bg-indigo-50 text-indigo-700 rounded-full font-black text-xs md:text-sm shrink-0 border border-indigo-100">
                        {i + 1}
                      </span>
                      <div 
                        className="flex-1 text-slate-700 font-bold text-sm md:text-base break-normal overflow-x-auto" 
                        dangerouslySetInnerHTML={{ __html: currentQuestion.options?.[originalIdx]?.text || '' }} 
                      />
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (i === 0) return;
                          const newOrder = [...answers[currentQuestionIndex]];
                          [newOrder[i], newOrder[i-1]] = [newOrder[i-1], newOrder[i]];
                          handleAnswer(newOrder);
                        }}
                        disabled={i === 0}
                        className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Monter"
                      >
                        <ChevronLeft className="w-4 h-4 rotate-90" />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (i === (currentQuestion.options?.length || 0) - 1) return;
                          const newOrder = [...answers[currentQuestionIndex]];
                          [newOrder[i], newOrder[i+1]] = [newOrder[i+1], newOrder[i]];
                          handleAnswer(newOrder);
                        }}
                        disabled={i === (currentQuestion.options?.length || 0) - 1}
                        className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Descendre"
                      >
                        <ChevronRight className="w-4 h-4 rotate-90" />
                      </button>
                    </div>
                  </Card>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        )}

        {currentQuestion.type === 'matching' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500 italic">Réorganisez la colonne de droite pour l'aligner avec celle de gauche.</p>
              <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                <GripVertical className="w-3 h-3 text-indigo-500 animate-pulse" />
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Association Drag & Drop</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 relative">
              {/* Left Column - Locked */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Éléments Fixes</p>
                {(currentQuestion.options || []).map((opt, i) => (
                  <div 
                    key={i} 
                    className="h-[4.5rem] flex items-center px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold text-slate-700 shadow-sm"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <span className="w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black shrink-0 uppercase">#{i + 1}</span>
                      <div className="prose prose-sm max-w-none break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: opt.text }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Connecting Visual - Only visible on MD+ */}
              <div className="hidden md:absolute md:left-1/2 md:top-[2.5rem] md:bottom-0 md:flex flex-col justify-around py-4 -translate-x-1/2 pointer-events-none opacity-20">
                {(currentQuestion.options || []).map((_, i) => (
                  <div key={i} className="flex items-center justify-center h-[4.5rem]">
                    <div className="w-8 h-0.5 bg-gradient-to-r from-slate-400 to-indigo-400 rounded-full" />
                  </div>
                ))}
              </div>

              {/* Right Column - Draggable */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">À Associer (Glisser)</p>
                <Reorder.Group 
                  axis="y" 
                  values={answers[currentQuestionIndex] || []} 
                  onReorder={handleAnswer}
                  className="space-y-3"
                >
                  {(answers[currentQuestionIndex] || []).map((rightIdx: number, i: number) => {
                    const matchOpt = (currentQuestion as any).runtimeMatchOptions.find((m: any) => m.idx === rightIdx);
                    return (
                      <Reorder.Item 
                        key={rightIdx} 
                        value={rightIdx}
                        className="group"
                      >
                        <Card className="h-[4.5rem] flex items-center gap-3 p-4 bg-white border-2 border-slate-100 rounded-2xl cursor-grab active:cursor-grabbing hover:border-indigo-200 hover:shadow-md transition-all">
                          <GripVertical className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 shrink-0" />
                          <div className="flex-1 text-sm font-black text-slate-900 line-clamp-2 md:line-clamp-1 prose prose-sm max-w-none break-normal overflow-x-auto">
                            <span dangerouslySetInnerHTML={{ __html: matchOpt?.text || '' }} />
                          </div>
                          <div className="w-6 h-6 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black shrink-0 border border-indigo-100 opacity-0 group-hover:opacity-100 transition-opacity">
                            #{i+1}
                          </div>
                        </Card>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              </div>
            </div>
          </div>
        )}

        {(currentQuestion.type === 'multiple-choice' || currentQuestion.type === 'true-false' || !currentQuestion.type) && (
          <div className="grid grid-cols-1 gap-3">
            {((currentQuestion as any).runtimeOptions || []).map((option: any) => (
              <button
                key={option.idx}
                onClick={() => handleAnswer(option.idx)}
                className={cn(
                  "p-3 md:p-5 rounded-xl border-2 text-left transition-all flex items-start justify-between group gap-3 md:gap-4",
                  answers[currentQuestionIndex] === option.idx 
                    ? "border-indigo-600 bg-indigo-50 text-indigo-950" 
                    : "border-slate-100 hover:border-slate-200 text-slate-800"
                )}
              >
                <div className="prose prose-sm md:prose-base max-w-none flex-1 min-w-0 text-sm md:text-base font-medium leading-relaxed text-slate-900 break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: option.text }} />
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 mt-0.5",
                  answers[currentQuestionIndex] === option.idx 
                    ? "border-indigo-600 bg-indigo-600" 
                    : "border-slate-200 group-hover:border-slate-300"
                )}>
                  {answers[currentQuestionIndex] === option.idx && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
          disabled={currentQuestionIndex === 0 || isSubmitting}
        >
          Précédent
        </Button>
        
        {currentQuestionIndex === exam.questions.length - 1 ? (
          <Button onClick={() => handleSubmit()} disabled={isSubmitting} className="px-8 min-w-[140px]">
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {isAiGrading ? 'Graduation...' : 'Envoi...'}
              </div>
            ) : 'Terminer l\'examen'}
          </Button>
        ) : (
          <Button onClick={() => setCurrentQuestionIndex(prev => prev + 1)} disabled={isSubmitting}>
            Suivant
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Results View ---

const ResultDetailModal = React.memo(({ result, exam, onClose, courseName }: { result: Result; exam: Exam; onClose: () => void; courseName?: string }) => {
  const totalPossible = result.totalPoints || getExamTotalPoints(exam) || 1;
  const scorePercentage = Math.round((result.score / totalPossible) * 100);
  
  const questionResults = useMemo(() => {
    return exam.questions.map((rawQ, qIdx) => {
      const question = normalizeQuestion(rawQ);
      // Ensure ID is stable
      if (!question.id) question.id = `q-${qIdx}`;
      
      const studentAnswer = result.answers?.[qIdx];
      let isCorrect = false;
      let qPointsEarned = 0;
      const qTotalPoints = question.points ?? 1;

      if (result.questionResults?.[qIdx]) {
        isCorrect = result.questionResults[qIdx].isCorrect;
        qPointsEarned = result.questionResults[qIdx].pointsEarned;
      } else {
        // Fallback for old results
        if (question.type === 'short-answer') {
          isCorrect = studentAnswer?.toString().trim().toLowerCase() === stripHtml(question.correctAnswer || '').trim().toLowerCase();
        } else if (question.type === 'fill-in-the-blanks') {
          const correctCount = (question.correctAnswers || []).filter((ca, i) => studentAnswer?.[i]?.toString().trim().toLowerCase() === ca.trim().toLowerCase()).length;
          isCorrect = correctCount === (question.correctAnswers || []).length;
        } else if (question.type === 'ordering') {
          isCorrect = JSON.stringify(studentAnswer) === JSON.stringify(question.correctOrder);
        } else if (question.type === 'matching') {
          isCorrect = JSON.stringify(studentAnswer) === JSON.stringify(question.correctMatches);
        } else {
          isCorrect = studentAnswer !== null && studentAnswer !== undefined && question.options?.[studentAnswer as number]?.isCorrect === true;
        }
        qPointsEarned = isCorrect ? qTotalPoints : 0;
      }
      
      return { question, studentAnswer, isCorrect, pointsEarned: qPointsEarned, totalPoints: qTotalPoints };
    });
  }, [exam.questions, result.answers]);

  const exportToWord = async () => {
    try {
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              text: `Rapport de Résultat: ${exam.title}`,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 }
            }),
            
            // Student Info Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
              },
              rows: [
                new TableRow({
                  children: [
                    { label: "Étudiant", value: result.studentName || result.studentId },
                    { label: "Email", value: result.studentEmail || "--" },
                    { label: "Cours", value: courseName || "--" },
                    { label: "Filière", value: result.filiere || "--" },
                    { label: "Groupe", value: result.groupName || "--" },
                    { label: "Points obtenus", value: `${result.score}/${totalPossible} (${scorePercentage}%)` }
                  ].map(item => new TableCell({
                    children: [
                      new Paragraph({ 
                        children: [new TextRun({ text: item.label, bold: true, size: 18 })]
                      }),
                      new Paragraph({ 
                        children: [new TextRun({ text: item.value.toString(), size: 20 })]
                      })
                    ],
                    shading: { fill: "F8FAFC" },
                    verticalAlign: AlignmentType.CENTER
                  }))
                })
              ]
            }),
            
            new Paragraph({ text: "", spacing: { after: 300 } }),
            
            new Paragraph({
              text: "Détail des Réponses",
              heading: HeadingLevel.HEADING_2,
              spacing: { after: 200 }
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
              },
              rows: [
                new TableRow({
                  children: [
                    "N°", "Question", "Votre Réponse", "Réponse Correcte", "Statut", "Points"
                  ].map(h => new TableCell({
                    shading: { fill: "F1F5F9" },
                    children: [new Paragraph({ 
                      children: [new TextRun({ text: h, bold: true, size: 18 })]
                    })]
                  }))
                }),
                ...questionResults.map((qr, idx) => {
                  const qText = stripHtml(qr.question.text);
                  
                  let studentAnsText = "";
                  if (qr.studentAnswer === null || qr.studentAnswer === undefined || qr.studentAnswer === '') {
                    studentAnsText = "(vide)";
                  } else if (qr.question.type === 'ordering') {
                    studentAnsText = (qr.studentAnswer as number[]).map(i => stripHtml(qr.question.options?.[i]?.text || '')).join(' > ');
                  } else if (qr.question.type === 'matching') {
                    studentAnsText = (qr.studentAnswer as number[]).map((sa, i) => 
                      `${stripHtml(qr.question.options?.[i]?.text || '')} -> ${stripHtml(qr.question.matchOptions?.[sa] || '?')}`
                    ).join(', ');
                  } else if (qr.question.type === 'fill-in-the-blanks') {
                    studentAnsText = (qr.studentAnswer as string[]).join(', ');
                  } else if (qr.question.type === 'multiple-choice' || qr.question.type === 'true-false') {
                    studentAnsText = stripHtml(qr.question.options?.[qr.studentAnswer as number]?.text || '');
                  } else {
                    studentAnsText = qr.studentAnswer.toString();
                  }

                  let correctAnsText = "";
                  if (qr.question.type === 'short-answer') {
                    correctAnsText = stripHtml(qr.question.correctAnswer || '');
                  } else if (qr.question.type === 'fill-in-the-blanks') {
                    correctAnsText = (qr.question.correctAnswers || []).join(', ');
                  } else if (qr.question.type === 'ordering') {
                    correctAnsText = (qr.question.correctOrder || []).map(i => stripHtml(qr.question.options?.[i]?.text || '')).join(' > ');
                  } else if (qr.question.type === 'matching') {
                    correctAnsText = (qr.question.options || []).map((opt, i) => 
                      `${stripHtml(opt.text)} -> ${stripHtml(qr.question.matchOptions?.[qr.question.correctMatches?.[i] ?? -1] || '?')}`
                    ).join(', ');
                  } else {
                    correctAnsText = stripHtml(qr.question.options?.find(o => o.isCorrect)?.text || '');
                  }

                  return new TableRow({
                    children: [
                      (idx + 1).toString(),
                      qText,
                      studentAnsText,
                      correctAnsText,
                      qr.isCorrect ? 'Correct' : 'Incorrect',
                      `${qr.pointsEarned}/${qr.totalPoints}`
                    ].map((text, colIdx) => new TableCell({
                      shading: colIdx === 4 ? { fill: qr.isCorrect ? "DCFCE7" : "FEE2E2" } : undefined,
                      children: [new Paragraph({ 
                        children: [new TextRun({ 
                          text: text.toString(), 
                          size: 18,
                          color: colIdx === 4 ? (qr.isCorrect ? "166534" : "991B1B") : undefined,
                          bold: colIdx === 4
                        })]
                      })]
                    }))
                  });
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Généré le ${new Date().toLocaleString()} par EduQCM`,
                  size: 14,
                  italics: true,
                  color: "64748B"
                })
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 400 }
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `resultat_${result.studentName || result.studentId}_${exam.title}.docx`);
    } catch (error) {
      console.error("Error exporting individual result to Word:", error);
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(18);
      doc.text(`Rapport de Résultat: ${exam.title}`, pageWidth / 2, 15, { align: 'center' });
      
      // Student Info
      doc.setFontSize(10);
      doc.setTextColor(100);
      const studentInfo = [
        [`Étudiant: ${result.studentName || result.studentId}`, `Email: ${result.studentEmail || "--"}`],
        [`Cours: ${courseName || "--"}`, `Date: ${new Date(result.completedAt).toLocaleString()}`],
        [`Filière: ${result.filiere || "--"}`, `Groupe: ${result.groupName || "--"}`],
        [`Points obtenus: ${result.score}/${totalPossible} (${scorePercentage}%)`, ""]
      ];
      
      autoTable(doc, {
        startY: 25,
        head: [],
        body: studentInfo,
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 2 },
        columnStyles: { 0: { cellWidth: pageWidth / 2 - 15 }, 1: { cellWidth: pageWidth / 2 - 15 } }
      });

      // Detailed Results Table
      const tableData = questionResults.map((qr, idx) => {
        const qText = stripHtml(qr.question.text);
        
        let studentAnsText = "";
        if (qr.studentAnswer === null || qr.studentAnswer === undefined || qr.studentAnswer === '') {
          studentAnsText = "(vide)";
        } else if (qr.question.type === 'ordering') {
          studentAnsText = (qr.studentAnswer as number[]).map(i => stripHtml(qr.question.options?.[i]?.text || '')).join(' > ');
        } else if (qr.question.type === 'matching') {
          studentAnsText = (qr.studentAnswer as number[]).map((sa, i) => 
            `${stripHtml(qr.question.options?.[i]?.text || '')} -> ${stripHtml(qr.question.matchOptions?.[sa] || '?')}`
          ).join(', ');
        } else if (qr.question.type === 'fill-in-the-blanks') {
          studentAnsText = (qr.studentAnswer as string[]).join(', ');
        } else if (qr.question.type === 'multiple-choice' || qr.question.type === 'true-false') {
          studentAnsText = stripHtml(qr.question.options?.[qr.studentAnswer as number]?.text || '');
        } else {
          studentAnsText = qr.studentAnswer.toString();
        }

        let correctAnsText = "";
        if (qr.question.type === 'short-answer') {
          correctAnsText = stripHtml(qr.question.correctAnswer || '');
        } else if (qr.question.type === 'fill-in-the-blanks') {
          correctAnsText = (qr.question.correctAnswers || []).join(', ');
        } else if (qr.question.type === 'ordering') {
          correctAnsText = (qr.question.correctOrder || []).map(i => stripHtml(qr.question.options?.[i]?.text || '')).join(' > ');
        } else if (qr.question.type === 'matching') {
          correctAnsText = (qr.question.options || []).map((opt, i) => 
            `${stripHtml(opt.text)} -> ${stripHtml(qr.question.matchOptions?.[qr.question.correctMatches?.[i] ?? -1] || '?')}`
          ).join(', ');
        } else {
          correctAnsText = stripHtml(qr.question.options?.find(o => o.isCorrect)?.text || '');
        }

        return [
          (idx + 1).toString(),
          qText,
          studentAnsText,
          correctAnsText,
          qr.isCorrect ? 'Correct' : 'Incorrect',
          `${qr.pointsEarned}/${qr.totalPoints}`
        ];
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["N°", "Question", "Votre Réponse", "Réponse Correcte", "Statut", "Points"]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] }, // indigo-600
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 50 },
          2: { cellWidth: 40 },
          3: { cellWidth: 40 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 }
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const isCorrect = data.cell.raw === 'Correct';
            data.cell.styles.textColor = isCorrect ? [22, 101, 52] : [153, 27, 27];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = isCorrect ? [220, 252, 231] : [254, 226, 226];
          }
        }
      });

      // Footer
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i} sur ${totalPages} - Généré par EduQCM le ${new Date().toLocaleString()}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`resultat_${result.studentName || result.studentId}_${exam.title}.pdf`);
    } catch (error) {
      console.error("Error exporting individual result to PDF:", error);
    }
  };

  return (
    <Modal 
      title={`Détails du résultat - ${exam.title}`} 
      onClose={onClose} 
      maxWidth="max-w-4xl"
      headerActions={
        <div className="flex items-center gap-1 sm:gap-2">
          {courseName && (
            <span className="hidden sm:inline-block text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-indigo-100 mr-2">
              {courseName}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToWord}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
            title="Exporter en Word"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Word</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToPDF}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3"
            title="Exporter en PDF"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-8 pr-2 w-full overflow-x-hidden">
        {/* Header Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 border-none shadow-xl shadow-slate-200/40 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Points obtenus</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-indigo-600 tracking-tighter">{result.score}</span>
              <span className="text-slate-300 font-bold text-lg">/ {result.totalPoints}</span>
            </div>
            <div className={cn(
              "mt-4 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest",
              scorePercentage >= 50 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
            )}>
              {scorePercentage}% de réussite
            </div>
          </Card>

          <Card className="p-6 border-none shadow-xl shadow-slate-200/40 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Étudiant</p>
            <div className="bg-indigo-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3">
              <User className="w-6 h-6 text-indigo-600" />
            </div>
            <p className="font-black text-slate-900 text-lg leading-tight line-clamp-1">{result.studentName || `ID: ${result.studentId}`}</p>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{result.filiere} <span className="text-slate-200 mx-1">•</span> {result.groupName}</p>
          </Card>

          <Card className="p-6 border-none shadow-xl shadow-slate-200/40 flex flex-col items-center justify-center text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Complété le</p>
            <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-slate-400" />
            </div>
            <div className="font-black text-slate-900 text-lg">
              {new Date(result.completedAt).toLocaleDateString()}
            </div>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{new Date(result.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </Card>
        </div>

        {/* Question Map */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            Aperçu des questions
          </h4>
          <div className="flex flex-wrap gap-2">
                  {questionResults.map((qr, idx) => {
                    const isPartial = !qr.isCorrect && qr.pointsEarned > 0;
                    return (
                      <a 
                        key={idx}
                        href={`#question-${idx}`}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all border-2",
                          qr.isCorrect 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100" 
                            : isPartial
                              ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100"
                              : "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                        )}
                        title={`Question ${idx + 1}: ${qr.isCorrect ? 'Correct' : isPartial ? 'Partiel' : 'Incorrect'}`}
                      >
                        {idx + 1}
                      </a>
                    );
                  })}
          </div>
        </div>

        {/* Detailed Answers */}
        <div className="space-y-6 w-full overflow-hidden">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-600" />
            Réponses détaillées
          </h4>
          
            {questionResults.map((qr, qIdx) => {
              const { question, studentAnswer, isCorrect, pointsEarned, totalPoints } = qr;
              const isPartial = !isCorrect && pointsEarned > 0;

              return (
                <div 
                  key={question.id} 
                  id={`question-${qIdx}`}
                  className={cn(
                    "p-5 rounded-2xl border-2 transition-all scroll-mt-6 shadow-sm",
                    isCorrect ? "border-emerald-100 bg-white" : isPartial ? "border-amber-100 bg-white" : "border-rose-100 bg-white"
                  )}
                >
                  <div className="flex justify-between items-start gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                          isCorrect ? "bg-emerald-100 text-emerald-600" : isPartial ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"
                        )}>
                          Question {qIdx + 1} • {isCorrect ? 'Correct' : isPartial ? 'Partiel' : 'Incorrect'}
                        </span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider">
                          {question.type === 'multiple-choice' ? 'QCM' : 
                           question.type === 'true-false' ? 'Vrai/Faux' :
                           question.type === 'short-answer' ? 'Réponse courte' :
                           question.type === 'fill-in-the-blanks' ? 'Texte à trous' :
                           question.type === 'ordering' ? 'Mise en ordre' : 'Association'}
                        </span>
                      </div>
                      <div className="prose prose-indigo prose-base max-w-none font-semibold text-slate-950 leading-relaxed break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: question.text }} />
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn(
                        "px-3 py-1 rounded-lg text-sm font-black",
                        isCorrect ? "bg-emerald-50 text-emerald-600" : isPartial ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                      )}>
                        {pointsEarned.toFixed(1)} / {totalPoints} pt{ totalPoints > 1 ? 's' : '' }
                      </div>
                    </div>
                  </div>
                
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
                  {question.type === 'short-answer' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Votre réponse</p>
                        <p className={cn("text-sm font-bold break-normal overflow-x-auto", isCorrect ? "text-emerald-600" : "text-rose-600")}>
                          {studentAnswer || '(vide)'}
                        </p>
                      </div>
                      {!isCorrect && (
                        <div>
                          <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Réponse correcte</p>
                          <div className="text-sm font-bold text-emerald-600 prose prose-sm max-w-none break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: question.correctAnswer || '' }} />
                        </div>
                      )}
                    </div>
                  )}

                  {question.type === 'fill-in-the-blanks' && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Réponses aux trous</p>
                      <div className="flex flex-wrap gap-3">
                        {(question.correctAnswers || []).map((ca, i) => {
                          const sa = studentAnswer?.[i];
                          const correct = sa?.toString().trim().toLowerCase() === ca.trim().toLowerCase();
                          return (
                            <div key={i} className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 font-medium">Trou #{i + 1}</span>
                              <div className={cn(
                                "px-3 py-1.5 rounded-lg border text-sm font-bold flex items-center gap-2 break-normal overflow-x-auto",
                                correct ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                              )}>
                                {sa || '(vide)'}
                                {!correct && <span className="text-slate-400 font-normal mx-1">→</span>}
                                {!correct && <span className="text-emerald-600">{ca}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {question.type === 'ordering' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Votre ordre</p>
                        <div className="space-y-1.5">
                          {((studentAnswer as any) || []).map((optIdx: number, i: number) => {
                            const isCorrectPos = question.correctOrder?.[i] === optIdx;
                            return (
                              <div key={i} className={cn(
                                "px-3 py-2 rounded-lg text-xs font-medium border flex items-center gap-3",
                                isCorrectPos ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                              )}>
                                <span className="w-5 h-5 rounded-full bg-white/50 flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                                <div className="break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: question.options?.[optIdx]?.text || '' }} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {!isCorrect && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">Ordre correct</p>
                          <div className="space-y-1.5 opacity-80">
                            {(question.correctOrder || []).map((optIdx, i) => (
                              <div key={i} className="px-3 py-2 rounded-lg text-xs font-medium border border-emerald-100 bg-emerald-50 text-emerald-700 flex items-center gap-3">
                                <span className="w-5 h-5 rounded-full bg-white/50 flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                                <div className="break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: question.options?.[optIdx]?.text || '' }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {question.type === 'matching' && (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Associations</p>
                      <div className="grid grid-cols-1 gap-2">
                        {(question.options || []).map((opt, i) => {
                          const saIdx = studentAnswer?.[i];
                          const caIdx = question.correctMatches?.[i];
                          const correct = saIdx === caIdx;
                          return (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-2 rounded-lg bg-white border border-slate-100">
                              <div className="flex-1 text-xs font-bold text-slate-700 break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: opt.text }} />
                              <div className="hidden sm:block text-slate-300">→</div>
                              <div className="flex-1 flex items-center gap-2">
                                <div className={cn(
                                  "flex-1 px-3 py-1.5 rounded-lg border text-xs font-bold break-normal overflow-x-auto",
                                  correct ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                                )}>
                                  {saIdx !== -1 ? question.matchOptions?.[saIdx] : '(non associé)'}
                                </div>
                                {!correct && (
                                  <div className="flex-1 px-3 py-1.5 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 text-xs font-bold opacity-60 break-normal overflow-x-auto">
                                    {question.matchOptions?.[caIdx!]}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(question.type === 'multiple-choice' || question.type === 'true-false' || !question.type) && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Options</p>
                      <div className="grid grid-cols-1 gap-2">
                        {(question.options || []).map((option, oIdx) => {
                          const isStudentChoice = studentAnswer === oIdx;
                          const isCorrectChoice = option.isCorrect;

                          return (
                            <div 
                              key={oIdx}
                              className={cn(
                                "px-4 py-3 rounded-xl text-sm flex items-center justify-between transition-all",
                                isCorrectChoice 
                                  ? "bg-emerald-100 text-emerald-900 font-bold border-2 border-emerald-200" 
                                  : isStudentChoice 
                                    ? "bg-rose-100 text-rose-900 font-bold border-2 border-rose-200"
                                    : "bg-white text-slate-600 border border-slate-200 opacity-60"
                              )}
                            >
                              <div className="prose prose-sm max-w-none break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: option.text }} />
                              <div className="flex items-center gap-2">
                                {isCorrectChoice && (
                                  <div className="flex items-center gap-1 text-[10px] font-black uppercase bg-emerald-200 px-2 py-0.5 rounded">
                                    <CheckCircle2 className="w-3 h-3" /> Correct
                                  </div>
                                )}
                                {isStudentChoice && !isCorrectChoice && (
                                  <div className="flex items-center gap-1 text-[10px] font-black uppercase bg-rose-200 px-2 py-0.5 rounded">
                                    <XCircle className="w-3 h-3" /> Votre choix
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
});

const ExamStatisticsModal = React.memo(({ exam, results, onClose, courseName }: { exam: Exam; results: Result[]; onClose: () => void; courseName?: string }) => {
  const examResults = useMemo(() => results.filter(r => r.examId === exam.id), [results, exam.id]);
  const totalExamPoints = useMemo(() => getExamTotalPoints(exam), [exam]);
  
  const stats = useMemo(() => {
    if (examResults.length === 0) return null;

    const scores = examResults.map(r => (r.score / (r.totalPoints || totalExamPoints || 1)) * 100);
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median = sortedScores.length % 2 === 0 
      ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2 
      : sortedScores[Math.floor(sortedScores.length / 2)];

    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    const passRate = (scores.filter(s => s >= 50).length / scores.length) * 100;

    // Distribution
    const distribution = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
    scores.forEach(s => {
      const idx = Math.min(Math.floor(s / 20), 4);
      distribution[idx]++;
    });

    // Missed questions analysis
    const normalizeStr = (s: string) => s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");

    const questionMissCount = exam.questions.map((rawQ, idx) => {
      const q = normalizeQuestion(rawQ);
      const misses = examResults.filter(r => {
        const studentAnswer = r.answers?.[idx];
        if (studentAnswer === null || studentAnswer === undefined || studentAnswer === '') return true;
        
        if (q.type === 'short-answer') {
          return normalizeStr(studentAnswer?.toString() || '') !== normalizeStr(stripHtml(q.correctAnswer || ''));
        } else if (q.type === 'fill-in-the-blanks') {
          const correctCount = (q.correctAnswers || []).filter((ca, i) => normalizeStr(studentAnswer?.[i]?.toString() || '') === normalizeStr(ca)).length;
          return correctCount !== (q.correctAnswers || []).length;
        } else if (q.type === 'ordering') {
          return JSON.stringify(studentAnswer) !== JSON.stringify(q.correctOrder);
        } else if (q.type === 'matching') {
          return JSON.stringify(studentAnswer) !== JSON.stringify(q.correctMatches);
        } else {
          // Multiple choice
          return q.options?.[studentAnswer as number]?.isCorrect !== true;
        }
      }).length;
      return { index: idx, text: q.text, misses };
    }).sort((a, b) => b.misses - a.misses);

    return { average, median, bestScore, worstScore, passRate, distribution, questionMissCount };
  }, [examResults, exam.questions]);

  if (!stats) {
    return (
      <Modal title={`Statistiques - ${exam.title}`} onClose={onClose}>
        <div className="text-center py-12 text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>Aucun résultat disponible pour cet examen.</p>
        </div>
      </Modal>
    );
  }

  const { average, median, bestScore, worstScore, passRate, distribution, questionMissCount } = stats;

  return (
    <Modal 
      title={`Statistiques - ${exam.title}`} 
      onClose={onClose} 
      maxWidth="max-w-4xl"
      headerActions={
        <div className="flex items-center gap-2 mr-2">
          {courseName && (
            <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-indigo-100">
              {courseName}
            </span>
          )}
          <span className="text-[10px] font-black bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl uppercase tracking-widest border border-amber-100">
            {totalExamPoints} points au total
          </span>
        </div>
      }
    >
      <div className="space-y-8 pr-2 w-full overflow-x-hidden">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-5 border-none shadow-lg shadow-indigo-100/50 text-center">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Moyenne</p>
            <p className="text-3xl font-black text-indigo-600 tracking-tighter">{Math.round(average)}%</p>
          </Card>
          <Card className="p-5 border-none shadow-lg shadow-emerald-100/50 text-center">
            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Taux de Réussite</p>
            <p className="text-3xl font-black text-emerald-600 tracking-tighter">{Math.round(passRate)}%</p>
          </Card>
          <Card className="p-5 border-none shadow-lg shadow-amber-100/50 text-center">
            <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Meilleur Score</p>
            <p className="text-3xl font-black text-amber-600 tracking-tighter">{Math.round(bestScore)}%</p>
          </Card>
          <Card className="p-5 border-none shadow-lg shadow-slate-100/50 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Participants</p>
            <p className="text-3xl font-black text-slate-900 tracking-tighter">{examResults.length}</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Score Distribution */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              Distribution des scores (%)
            </h4>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution.map((count, i) => {
                  const labels = ["0-20", "20-40", "40-60", "60-80", "80-100"];
                  return { name: labels[i], count };
                })}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index < 2 ? "#fb7185" : index < 3 ? "#fbbf24" : "#34d399"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Taux de Réussite vs Échec
            </h4>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-72 flex flex-col items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Réussite', value: passRate },
                      { name: 'Échec', value: 100 - passRate }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#34d399" />
                    <Cell fill="#fb7185" />
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${Math.round(value)}%`, '']}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-10 translate-y-3">
                <span className="text-2xl font-black text-slate-900">{Math.round(passRate)}%</span>
              </div>
            </div>
          </div>
        </div>

          {/* Additional Stats */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-600" />
              Analyse détaillée
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                <span className="text-sm text-slate-500">Médiane</span>
                <span className="font-bold text-slate-900">{Math.round(median)}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                <span className="text-sm text-slate-500">Score le plus bas</span>
                <span className="font-bold text-rose-600">{Math.round(worstScore)}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                <span className="text-sm text-slate-500">Écart-type (approx)</span>
                <span className="font-bold text-slate-900">{Math.round(bestScore - worstScore)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Most Missed Questions */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            Points critiques (Questions les plus échouées)
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {questionMissCount.slice(0, 4).map((q, i) => (
              <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between gap-4 hover:border-rose-200 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-rose-500 uppercase">Question {q.index + 1}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {Math.round((q.misses / examResults.length) * 100)}% d'échec
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 font-medium break-normal overflow-x-auto" dangerouslySetInnerHTML={{ __html: q.text }} />
                </div>
                <div className="shrink-0">
                  <div className="w-10 h-10 rounded-full border-4 border-rose-100 flex items-center justify-center">
                    <span className="text-xs font-black text-rose-600">{q.misses}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    );
  }
);

function ResultsView({ results, exams, user, filieres, groups, courses }: { results: Result[]; exams: Exam[]; user: UserProfile; filieres: Filiere[]; groups: Group[]; courses: Course[] }) {
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);
  const [selectedStatsExam, setSelectedStatsExam] = useState<Exam | null>(null);
  const [filterFiliereId, setFilterFiliereId] = useState<number>(0);
  const [filterGroupId, setFilterGroupId] = useState<number>(0);
  const [filterExamId, setFilterExamId] = useState<number>(0);
  const [studentSearch, setStudentSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredResults = useMemo(() => {
    return results.filter(result => {
      const searchMatch = !studentSearch || (result.studentName || '').toLowerCase().includes(studentSearch.toLowerCase());
      if (!searchMatch) return false;

      if (user.role !== 'teacher') return true;
      
      const filiereMatch = !filterFiliereId || result.filiere === filieres.find(f => f.id === filterFiliereId)?.name;
      const groupMatch = !filterGroupId || result.groupName === groups.find(g => g.id === filterGroupId)?.name;
      const examMatch = !filterExamId || result.examId === filterExamId;
      
      return filiereMatch && groupMatch && examMatch;
    });
  }, [results, user.role, filterFiliereId, filterGroupId, filterExamId, filieres, groups, studentSearch]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterFiliereId, filterGroupId, filterExamId, studentSearch]);

  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = useMemo(() => {
    return filteredResults.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredResults, currentPage, itemsPerPage]);

  const groupedResults = useMemo(() => {
    const groups: Record<string, Result[]> = {};
    paginatedResults.forEach(result => {
      const exam = exams.find(e => e.id === result.examId);
      const courseId = exam?.courseId?.toString() || 'unknown';
      if (!groups[courseId]) groups[courseId] = [];
      groups[courseId].push(result);
    });
    return groups;
  }, [paginatedResults, exams]);

  const exportToCSV = () => {
    if (filteredResults.length === 0) return;

    const headers = ["Examen", "Cours", "Étudiant", "Email", "Filière", "Groupe", "Points obtenus", "Total Points", "Pourcentage", "Date"];
    const rows = filteredResults.map(r => {
      const exam = exams.find(e => e.id === r.examId);
      const course = courses.find(c => c.id === exam?.courseId);
      const total = r.totalPoints || 1;
      return [
        stripHtml(exam?.title || 'Inconnu'),
        stripHtml(course?.name || 'Inconnu'),
        stripHtml(r.studentName || `ID: ${r.studentId}`),
        stripHtml(r.studentEmail || '--'),
        stripHtml(r.filiere || '--'),
        stripHtml(r.groupName || '--'),
        r.score,
        total,
        `${Math.round((r.score / total) * 100)}%`,
        new Date(r.completedAt).toLocaleDateString()
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `resultats_examens_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportToWord = async () => {
    if (filteredResults.length === 0) return;
    setIsExporting(true);

    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: "Rapport des Résultats d'Examens",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
              },
              rows: [
                new TableRow({
                  children: [
                    "Examen", "Étudiant", "Email", "Filière", "Groupe", "Score", "Total", "%", "Date"
                  ].map(h => new TableCell({
                    shading: { fill: "F1F5F9" },
                    children: [new Paragraph({ 
                      children: [new TextRun({ text: h, bold: true })]
                    })]
                  }))
                }),
                ...filteredResults.map(r => {
                  const exam = exams.find(e => e.id === r.examId);
                  const total = r.totalPoints || 1;
                  const percentage = Math.round((r.score / total) * 100);
                  const isPass = percentage >= 50;
                  
                  return new TableRow({
                    children: [
                      exam?.title || 'Inconnu',
                      r.studentName || `ID: ${r.studentId}`,
                      r.studentEmail || '--',
                      r.filiere || '--',
                      r.groupName || '--',
                      r.score.toString(),
                      total.toString(),
                      `${percentage}%`,
                      new Date(r.completedAt).toLocaleDateString()
                    ].map((text, colIdx) => new TableCell({
                      shading: colIdx === 7 ? { fill: isPass ? "DCFCE7" : "FEE2E2" } : undefined,
                      children: [new Paragraph({ 
                        children: [new TextRun({ 
                          text: text.toString(),
                          color: colIdx === 7 ? (isPass ? "166534" : "991B1B") : undefined,
                          bold: colIdx === 7
                        })]
                      })]
                    }))
                  });
                })
              ]
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Rapport généré le ${new Date().toLocaleString()} par EduQCM`,
                  size: 14,
                  italics: true,
                  color: "64748B"
                })
              ],
              alignment: AlignmentType.RIGHT,
              spacing: { before: 400 }
            })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `resultats_examens_${new Date().toISOString().split('T')[0]}.docx`);
    } catch (error) {
      console.error("Error exporting to Word:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportAllToPDF = () => {
    if (filteredResults.length === 0) return;
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      doc.setFontSize(18);
      doc.setTextColor(30);
      doc.text("Rapport Global des Résultats d'Examens", pageWidth / 2, 15, { align: 'center' });

      // Add filter information to header if applicable
      let subtitle = `Généré le ${new Date().toLocaleString()}`;
      if (filterExamId || filterFiliereId || filterGroupId || studentSearch) {
        const parts = [];
        if (filterExamId) parts.push(`Examen: ${exams.find(e => e.id === filterExamId)?.title}`);
        if (filterFiliereId) parts.push(`Filière: ${filieres.find(f => f.id === filterFiliereId)?.name}`);
        if (filterGroupId) parts.push(`Groupe: ${groups.find(g => g.id === filterGroupId)?.name}`);
        if (studentSearch) parts.push(`Recherche: "${studentSearch}"`);
        subtitle += `\n(${parts.join(' | ')})`;
      }

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(subtitle, pageWidth / 2, 22, { align: 'center', lineHeightFactor: 1.2 });
      
      const tableData = filteredResults.map(r => {
        const exam = exams.find(e => e.id === r.examId);
        const total = r.totalPoints || 1;
        const percentage = Math.round((r.score / total) * 100);
        return [
          exam?.title || 'Inconnu',
          r.studentName || `ID: ${r.studentId}`,
          r.studentEmail || '--',
          r.filiere || '--',
          r.groupName || '--',
          r.score.toString(),
          total.toString(),
          `${percentage}%`,
          new Date(r.completedAt).toLocaleDateString()
        ];
      });

      autoTable(doc, {
        startY: subtitle.includes('\n') ? 35 : 30,
        head: [["Examen", "Étudiant", "Email", "Filière", "Groupe", "Score", "Total", "%", "Date"]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        styles: { fontSize: 7, cellPadding: 2 },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 7) {
            const val = parseInt(data.cell.raw as string);
            const isPass = val >= 50;
            data.cell.styles.textColor = isPass ? [22, 101, 52] : [153, 27, 27];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = isPass ? [220, 252, 231] : [254, 226, 226];
          }
        }
      });

      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i} sur ${totalPages} - Généré par EduQCM le ${new Date().toLocaleString()}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`resultats_examens_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error exporting all to PDF:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Historique des Résultats</h2>
          <p className="text-slate-500">
            {user.role === 'teacher' ? 'Consultez les performances de tous vos étudiants.' : 'Suivez vos notes et votre progression.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user.role === 'teacher' && filteredResults.length > 0 && (
            <div className="flex items-center gap-2 mr-4 border-r border-slate-200 pr-4">
              <Button 
                variant="outline" 
                onClick={exportToCSV} 
                className="text-xs py-1.5 h-auto flex items-center gap-2"
                title="Exporter en CSV"
              >
                <FileCode className="w-3.5 h-3.5" />
                CSV
              </Button>
              <Button 
                variant="outline" 
                onClick={exportToWord} 
                disabled={isExporting}
                className="text-xs py-1.5 h-auto flex items-center gap-2"
                title="Exporter en Word"
              >
                <FileText className="w-3.5 h-3.5" />
                {isExporting ? '...' : 'Word'}
              </Button>
              <Button 
                variant="outline" 
                onClick={exportAllToPDF} 
                className="text-xs py-1.5 h-auto flex items-center gap-2"
                title="Exporter en PDF"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </Button>
            </div>
          )}

          {user.role === 'teacher' && (
            <div className="flex flex-wrap gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Chercher un étudiant..." 
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-10 pr-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-48"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select 
                  value={filterExamId} 
                  onChange={(e) => setFilterExamId(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={0}>Tous les examens</option>
                  {exams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </div>
              {filterExamId > 0 && (
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedStatsExam(exams.find(e => e.id === filterExamId) || null)}
                  className="text-xs py-1.5 h-auto flex items-center gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Statistiques
                </Button>
              )}
              <select 
                value={filterFiliereId} 
                onChange={(e) => {
                  setFilterFiliereId(Number(e.target.value));
                  setFilterGroupId(0);
                }}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value={0}>Toutes les filières</option>
                {filieres.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <select 
                value={filterGroupId} 
                onChange={(e) => setFilterGroupId(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                disabled={!filterFiliereId}
              >
                <option value={0}>Tous les groupes</option>
                {groups.filter(g => g.filiereId === filterFiliereId).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {Object.keys(groupedResults).length === 0 ? (
          <Card className="p-12 text-center text-slate-400">Aucun résultat trouvé.</Card>
        ) : (
          Object.keys(groupedResults)
            .sort((a, b) => {
              const courseA = courses.find(c => c.id.toString() === a)?.name || '';
              const courseB = courses.find(c => c.id.toString() === b)?.name || '';
              return courseA.localeCompare(courseB);
            })
            .map(courseId => {
            const courseResults = groupedResults[courseId];
            const course = courses.find(c => c.id.toString() === courseId);
            return (
              <div key={courseId} className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm shadow-indigo-200">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {course?.name || 'Cours inconnu'}
                    <span className="ml-2 text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                      {courseResults.length} résultat{courseResults.length > 1 ? 's' : ''}
                    </span>
                  </h3>
                </div>
                
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Examen</th>
                          {user.role === 'teacher' && (
                            <>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Étudiant</th>
                              <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Filière / Groupe</th>
                            </>
                          )}
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Points obtenus</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {courseResults.map(result => {
                          const exam = exams.find(e => e.id === result.examId);
                          const total = result.totalPoints || (exam ? getExamTotalPoints(exam) : 1);
                          const percentage = Math.round((result.score / total) * 100);
                          return (
                            <tr 
                              key={result.id} 
                              className="hover:bg-slate-50 transition-colors cursor-pointer group"
                              onClick={() => setSelectedResult(result)}
                            >
                              <td className="px-6 py-4 font-medium text-slate-900">
                                <div className="flex items-center gap-2">
                                  {exam?.title || 'Examen inconnu'}
                                  <Eye className="w-4 h-4 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </td>
                              {user.role === 'teacher' && (
                                <>
                                  <td className="px-6 py-4 text-slate-600 font-medium">{result.studentName || `ID: ${result.studentId}`}</td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-medium text-slate-900">{result.filiere || '--'}</span>
                                      <span className="text-xs text-slate-500">{result.groupName || '--'}</span>
                                    </div>
                                  </td>
                                </>
                              )}
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-baseline gap-2">
                                    <span className={cn(
                                      "font-black text-xl tracking-tighter",
                                      percentage >= 70 ? "text-emerald-600" : percentage >= 40 ? "text-amber-600" : "text-rose-600"
                                    )}>
                                      {result.score}
                                    </span>
                                    <span className="text-xs text-slate-300 font-black">/ {total}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">({percentage}%)</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-500 text-sm">
                                {new Date(result.completedAt).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-5">
                                {percentage >= 50 ? (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-100">
                                    <CheckCircle2 className="w-3 h-3" /> Réussi
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-100">
                                    <XCircle className="w-3 h-3" /> Échec
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            );
          })
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 pt-6 border-t border-slate-100">
            <div className="text-sm text-slate-500">
              Affichage de <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredResults.length)}</span> sur <span className="font-bold text-slate-900">{filteredResults.length}</span> résultats
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 h-auto"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const page = i + 1;
                  if (totalPages > 5 && (page < currentPage - 1 || page > currentPage + 1) && page !== 1 && page !== totalPages) {
                    if (page === currentPage - 2 || page === currentPage + 2) return <span key={page} className="px-1 text-slate-400">...</span>;
                    return null;
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "w-8 h-8 rounded-lg text-xs font-bold transition-all",
                        currentPage === page 
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" 
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <Button 
                variant="outline" 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 h-auto"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedResult && (
          <ResultDetailModal 
            result={selectedResult} 
            exam={exams.find(e => e.id === selectedResult.examId)!} 
            onClose={() => setSelectedResult(null)} 
            courseName={courses.find(c => c.id === exams.find(e => e.id === selectedResult.examId)?.courseId)?.name}
          />
        )}

        {selectedStatsExam && (
          <ExamStatisticsModal 
            exam={selectedStatsExam} 
            results={results} 
            onClose={() => setSelectedStatsExam(null)} 
            courseName={courses.find(c => c.id === selectedStatsExam.courseId)?.name}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Notifications View ---

function NotificationsView({ notifications, user, onRefresh }: { notifications: Notification[]; user: UserProfile; onRefresh: () => void }) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Annonces & Notifications</h2>
          <p className="text-slate-500">Restez informé des dernières mises à jour.</p>
        </div>
        {user.role === 'teacher' && (
          <Button onClick={() => setIsAdding(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Publier une annonce
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {notifications.length === 0 ? (
          <EmptyState message="Aucune annonce pour le moment." />
        ) : (
          notifications.map(notif => (
            <Card key={notif.id} className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">{notif.title}</h3>
                <span className="text-xs text-slate-400">{new Date(notif.createdAt).toLocaleDateString()}</span>
              </div>
              <div 
                className="text-slate-600 leading-relaxed prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: notif.content }}
              />
            </Card>
          ))
        )}
      </div>

      {user.role === 'teacher' && (
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full py-6 border-2 border-dashed border-slate-200 rounded-[2rem] text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-4"
        >
          <Plus className="w-4 h-4" /> Publier une nouvelle annonce
        </button>
      )}

      <AnimatePresence>
        {isAdding && (
          <Modal title="Nouvelle Annonce" onClose={() => setIsAdding(false)}>
            <AddNotificationForm onComplete={() => { setIsAdding(false); onRefresh(); }} user={user} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Forms & Modals ---

function Modal({ title, children, onClose, maxWidth = "max-w-lg", headerActions }: { title: string; children: React.ReactNode; onClose: () => void; maxWidth?: string; headerActions?: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn("bg-white rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.2)] w-full overflow-hidden flex flex-col max-h-[90vh]", maxWidth)}
      >
        <div className="px-6 sm:px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 truncate pr-4">
            <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">{title}</h3>
            {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
          </div>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all active:scale-90 shrink-0"
          >
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 sm:p-8 overflow-y-auto w-full overflow-x-hidden custom-scrollbar">
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddCourseForm({ filieres, onComplete, user, initialData }: { filieres: Filiere[]; onComplete: () => void; user: UserProfile; initialData?: Course }) {
  const [name, setName] = useState(initialData?.name || '');
  const [desc, setDesc] = useState(initialData?.description || '');
  const [filiereId, setFiliereId] = useState<string>(initialData?.filiereId?.toString() || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fId = filiereId === '' ? null : Number(filiereId);
      if (initialData) {
        await api.courses.update(initialData.id, { name, description: desc, filiereId: fId });
      } else {
        await api.courses.create({ name, description: desc, filiereId: fId });
      }
      onComplete();
    } catch (error) {
      console.error("Error saving course:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <Input 
          label="Nom du cours" 
          value={name} 
          onChange={setName} 
          required 
          placeholder="ex: Algorithmique et Structure de Données" 
        />
        <RichTextEditor 
          label="Description"
          value={desc}
          onChange={setDesc}
          placeholder="Décrivez brièvement le contenu du cours..."
        />
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-widest text-[10px]">Filière concernée</label>
          <div className="relative">
            <select 
              value={filiereId} 
              onChange={(e) => setFiliereId(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-sm appearance-none cursor-pointer"
              required
            >
              <option value="">Sélectionnez une filière</option>
              {filieres.map(f => <option key={f.id} value={f.id.toString()}>{f.name}</option>)}
            </select>
            <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>
      
      <div className="pt-6 flex gap-4 border-t border-slate-100">
        <Button variant="ghost" onClick={onComplete} className="flex-1 h-12 text-slate-400 hover:text-slate-600">Annuler</Button>
        <Button type="submit" disabled={loading} className="flex-[2] h-12 shadow-lg shadow-indigo-100">
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Traitement...
            </div>
          ) : initialData ? 'Enregistrer les modifications' : 'Créer le nouveau cours'}
        </Button>
      </div>
    </form>
  );
}

function ImportPreviewModal({ 
  pendingQuestions, 
  onConfirm, 
  onCancel,
  onUpdateQuestion,
  onRemoveQuestion
}: { 
  pendingQuestions: { question: Question, isValid: boolean, errors: string[] }[];
  onConfirm: () => void;
  onCancel: () => void;
  onUpdateQuestion: (idx: number, updates: Partial<Question>) => void;
  onRemoveQuestion: (idx: number) => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const validCount = pendingQuestions.filter(p => p.isValid).length;
  const invalidCount = pendingQuestions.length - validCount;

  return (
    <Modal title="Aperçu de l'importation" onClose={onCancel} maxWidth="max-w-4xl">
      <div className="flex flex-col max-h-[85vh]">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm font-medium text-slate-600">{validCount} valides</span>
            </div>
            {invalidCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-sm font-medium text-slate-600">{invalidCount} à corriger</span>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{pendingQuestions.length} questions au total</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {pendingQuestions.map((item, idx) => (
            <div 
              key={idx} 
              className={cn(
                "p-4 rounded-xl border transition-all",
                item.isValid ? "bg-white border-slate-200" : "bg-rose-50/50 border-rose-200 shadow-sm"
              )}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-5">#{idx + 1}</span>
                  <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                    {item.question.type}
                  </span>
                  {!item.isValid && (
                    <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Invalide
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => onRemoveQuestion(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-white rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm text-slate-700 font-medium line-clamp-2" dangerouslySetInnerHTML={{ __html: item.question.text || '<span class="italic text-slate-400">Pas d\'énoncé</span>' }} />
                
                {!item.isValid && (
                  <div className="space-y-1 mt-2">
                    {item.errors.map((err, eIdx) => (
                      <div key={eIdx} className="flex items-center gap-1.5 text-rose-600 text-[10px] font-bold uppercase tracking-wide">
                        <AlertCircle className="w-3 h-3" />
                        {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {editingIdx === idx && (
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
                  <RichTextEditor 
                    label="Énoncé" 
                    value={item.question.text} 
                    onChange={(val) => onUpdateQuestion(idx, { text: val })} 
                  />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase">Points</label>
                      <input 
                        type="number" 
                        value={item.question.points} 
                        onChange={(e) => onUpdateQuestion(idx, { points: Number(e.target.value) })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-xs font-bold text-slate-400 uppercase">Type</label>
                       <select 
                        value={item.question.type} 
                        onChange={(e) => onUpdateQuestion(idx, { type: e.target.value as QuestionType })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm"
                       >
                         <option value="multiple-choice">Choix multiple</option>
                         <option value="true-false">Vrai / Faux</option>
                         <option value="short-answer">Réponse courte</option>
                         <option value="fill-in-the-blanks">Texte à trous</option>
                         <option value="ordering">Mise en ordre</option>
                         <option value="matching">Association</option>
                       </select>
                    </div>
                  </div>

                  {item.question.type === 'short-answer' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-400 uppercase">Réponse attendue</label>
                      <RichTextEditor 
                        theme="bubble"
                        value={item.question.correctAnswer || ''} 
                        onChange={(val) => onUpdateQuestion(idx, { correctAnswer: val })}
                        className="bg-white border border-slate-200 rounded-lg min-h-[60px]"
                      />
                    </div>
                  )}

                  {(item.question.type === 'multiple-choice' || item.question.type === 'true-false') && (
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase">Options</label>
                       {(item.question.options || []).map((opt, oIdx) => (
                         <div key={oIdx} className="flex items-center gap-2">
                           <input 
                            type="radio" 
                            name={`correct-preview-${idx}`}
                            checked={opt.isCorrect} 
                            onChange={() => {
                              const newOpts = [...(item.question.options || [])].map((o, i) => ({ ...o, isCorrect: i === oIdx }));
                              onUpdateQuestion(idx, { options: newOpts });
                            }}
                           />
                           <div className="flex-1">
                             <RichTextEditor 
                              theme="bubble"
                              value={opt.text} 
                              onChange={(val) => {
                                const newOpts = [...(item.question.options || [])];
                                newOpts[oIdx] = { ...newOpts[oIdx], text: val };
                                onUpdateQuestion(idx, { options: newOpts });
                              }}
                              className="bg-white border border-slate-200 rounded-lg min-h-[40px]"
                             />
                           </div>
                         </div>
                       ))}
                    </div>
                  )}

                  {item.question.type === 'ordering' && (
                    <div className="space-y-2">
                       <label className="text-xs font-bold text-slate-400 uppercase">Éléments</label>
                       {(item.question.options || []).map((opt, oIdx) => (
                         <div key={oIdx} className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">{oIdx + 1}</div>
                           <div className="flex-1">
                             <RichTextEditor 
                              theme="bubble"
                              value={opt.text} 
                              onChange={(val) => {
                                const newOpts = [...(item.question.options || [])];
                                newOpts[oIdx] = { ...newOpts[oIdx], text: val };
                                onUpdateQuestion(idx, { options: newOpts });
                              }}
                              className="bg-white border border-slate-200 rounded-lg min-h-[40px]"
                             />
                           </div>
                         </div>
                       ))}
                    </div>
                  )}

                  {item.question.type === 'matching' && (
                    <div className="space-y-3">
                       <label className="text-xs font-bold text-slate-400 uppercase">Paires (G / D)</label>
                       {(item.question.options || []).map((opt, oIdx) => (
                         <div key={oIdx} className="grid grid-cols-2 gap-2 text-xs">
                           <RichTextEditor 
                             theme="bubble"
                             value={opt.text} 
                             onChange={(val) => {
                               const newOpts = [...(item.question.options || [])];
                               newOpts[oIdx] = { ...newOpts[oIdx], text: val };
                               onUpdateQuestion(idx, { options: newOpts });
                             }}
                             className="bg-white border border-slate-200 rounded-lg min-h-[40px]"
                           />
                           <RichTextEditor 
                             theme="bubble"
                             value={item.question.matchOptions?.[oIdx] || ''} 
                             onChange={(val) => {
                               const newMatch = [...(item.question.matchOptions || [])];
                               newMatch[oIdx] = val;
                               onUpdateQuestion(idx, { matchOptions: newMatch });
                             }}
                             className="bg-white border border-indigo-100 rounded-lg min-h-[40px]"
                           />
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white flex justify-end gap-3 rounded-b-2xl">
          <Button variant="outline" type="button" onClick={onCancel}>Tout annuler</Button>
          <Button 
            type="button"
            onClick={onConfirm} 
            disabled={pendingQuestions.length === 0 || invalidCount > 0}
            className="gap-2"
          >
            {invalidCount > 0 ? (
              <>Corrigez les {invalidCount} erreurs pour continuer</>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Importer {pendingQuestions.length} questions
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function AddExamForm({ courses, onComplete, user, initialData }: { courses: Course[]; onComplete: () => void; user: UserProfile; initialData?: Exam }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [courseId, setCourseId] = useState<string>(initialData?.courseId?.toString() || courses[0]?.id?.toString() || '');
  const [duration, setDuration] = useState(initialData?.durationMinutes.toString() || '30');
  const [shuffleQuestions, setShuffleQuestions] = useState(initialData?.shuffleQuestions || false);
  const [scheduledAt, setScheduledAt] = useState(initialData?.scheduledAt ? new Date(initialData.scheduledAt).toISOString().substring(0, 16) : '');
  const [questions, setQuestions] = useState<Question[]>(initialData?.questions || [
    { id: '1', type: 'multiple-choice', text: '', options: [
      { text: '', isCorrect: true },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ], points: 1 }
  ]);
  const [collapsedQuestions, setCollapsedQuestions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [showImportInfo, setShowImportInfo] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [pendingImport, setPendingImport] = useState<{question: Question, isValid: boolean, errors: string[]}[] | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleGenerateWithAI = async () => {
    if (!aiTopic.trim()) {
      alert("Veuillez entrer un sujet pour la génération.");
      return;
    }
    setIsGeneratingAI(true);
    try {
      const generated = await generateQuestions(aiTopic);
      const formatted: Question[] = generated.map(q => ({
        id: Math.random().toString(36).substr(2, 9),
        type: q.type as QuestionType,
        text: q.text,
        points: q.points,
        options: q.options,
        correctAnswer: q.correctAnswer
      }));
      setQuestions(prev => {
        const isInitialEmpty = prev.length === 1 && !prev[0].text;
        return isInitialEmpty ? formatted : [...prev, ...formatted];
      });
      setShowAiInput(false);
      setAiTopic('');
    } catch (error: any) {
      alert(error.message || "Erreur lors de la génération par l'IA.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { 
      id: Math.random().toString(36).substr(2, 9), 
      type: 'multiple-choice',
      text: '', 
      options: [
        { text: '', isCorrect: true }, 
        { text: '', isCorrect: false }, 
        { text: '', isCorrect: false }, 
        { text: '', isCorrect: false }
      ], 
      points: 1
    }]);
  };

  const validateAndNormalize = (q: any): { question: Question, isValid: boolean, errors: string[] } => {
    const errors: string[] = [];
    if (!q || typeof q !== 'object') {
      return { 
        question: { id: Date.now().toString(), type: 'multiple-choice', text: 'Structure invalide', points: 0 },
        isValid: false,
        errors: ['Structure de donnée invalide']
      };
    }

    const text = q.text || q.question || '';
    if (!text) errors.push('Énoncé manquant');

    const rawType = (q.type || q.questionType || 'multiple-choice').toLowerCase();
    let type: QuestionType = 'multiple-choice';
    if (['multiple-choice', 'qcm', 'mcq'].includes(rawType)) type = 'multiple-choice';
    else if (['true-false', 'vrai-faux', 'tf'].includes(rawType)) type = 'true-false';
    else if (['short-answer', 'reponse-courte', 'sa'].includes(rawType)) type = 'short-answer';
    else if (['fill-in-the-blanks', 'trous', 'fib'].includes(rawType)) type = 'fill-in-the-blanks';
    else if (['ordering', 'ordre'].includes(rawType)) type = 'ordering';
    else if (['matching', 'association'].includes(rawType)) type = 'matching';
    else errors.push(`Type de question inconnu: ${rawType}`);

    const points = (q.points !== undefined && !isNaN(Number(q.points))) ? Number(q.points) : 1;
    const shuffleOptions = q.shuffleOptions === true || q.shuffleOptions === 'true' || q.shuffleOptions === 1 || q.shuffleOptions === '1';

    const parseList = (val: any): any[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string' && val.trim()) return val.split('|').map(s => s.trim());
      return [];
    };

    const base: Question = {
      id: q.id || Math.random().toString(36).substr(2, 9),
      type,
      text,
      points,
      shuffleOptions
    };

    switch (type) {
      case 'multiple-choice':
      case 'true-false': {
        const optList = parseList(q.options);
        const finalOptions = optList.length > 0 ? optList : (type === 'true-false' ? ['Vrai', 'Faux'] : []);
        
        if (finalOptions.length === 0) errors.push('Options manquantes');
        
        const correctIdx = q.correctOptionIndex !== undefined ? Number(q.correctOptionIndex) : (q.correctAnswerIndex !== undefined ? Number(q.correctAnswerIndex) : -1);
        
        const question: Question = {
          ...base,
          options: finalOptions.map((opt: any, idx: number) => {
            if (typeof opt === 'string') {
              return { text: opt, isCorrect: idx === correctIdx };
            }
            return {
              text: opt.text || opt.label || '',
              isCorrect: opt.isCorrect !== undefined ? (opt.isCorrect === true || opt.isCorrect === 'true') : (idx === correctIdx)
            };
          })
        };

        if (question.options && question.options.length > 0 && !question.options.some(o => o.isCorrect)) errors.push('Aucune option correcte définie');
        if (question.options?.some(o => !o.text)) errors.push('Certaines options sont vides');

        return { question, isValid: errors.length === 0, errors };
      }
      case 'short-answer': {
        const question: Question = {
          ...base,
          correctAnswer: String(q.correctAnswer || q.answer || '')
        };
        if (!question.correctAnswer) errors.push('Réponse attendue manquante');
        return { question, isValid: errors.length === 0, errors };
      }
      case 'fill-in-the-blanks': {
        const answers = parseList(q.correctAnswers || q.answers).map(String);
        const question: Question = {
          ...base,
          correctAnswers: answers
        };
        const blanksCount = (text.match(/\[blank\]/g) || []).length;
        if (blanksCount === 0) errors.push("L'énoncé doit contenir '[blank]'");
        if (answers.length < blanksCount) errors.push(`Il manque des réponses (${blanksCount} attendus, ${answers.length} fournis)`);
        return { question, isValid: errors.length === 0, errors };
      }
      case 'ordering': {
        const ordOpts = parseList(q.options);
        const question: Question = {
          ...base,
          options: ordOpts.map(opt => ({ text: typeof opt === 'string' ? opt : (opt.text || opt.label || '') })),
          correctOrder: Array.isArray(q.correctOrder) ? q.correctOrder.map(Number) : (typeof q.correctOrder === 'string' ? q.correctOrder.split('|').map(Number) : ordOpts.map((_, i) => i))
        };
        if (question.options?.length === 0) errors.push('Éléments à ordonner manquants');
        if (question.options?.some(o => !o.text)) errors.push('Certains éléments sont vides');
        return { question, isValid: errors.length === 0, errors };
      }
      case 'matching': {
        const mLeft = parseList(q.options);
        const mRight = parseList(q.matchOptions);
        const question: Question = {
          ...base,
          options: mLeft.map(opt => ({ text: typeof opt === 'string' ? opt : (opt.text || opt.label || '') })),
          matchOptions: mRight.map(String),
          correctMatches: Array.isArray(q.correctMatches) ? q.correctMatches.map(Number) : (typeof q.correctMatches === 'string' ? q.correctMatches.split('|').map(Number) : mLeft.map((_, i) => i))
        };
        if (question.options?.length === 0) errors.push('Options de gauche manquantes');
        if (question.matchOptions?.length === 0) errors.push('Options de droite manquantes');
        if (question.options?.length !== question.matchOptions?.length) errors.push('Le nombre d\'options de gauche et de droite doit être identique');
        return { question, isValid: errors.length === 0, errors };
      }
      default:
        return { question: base, isValid: false, errors: ['Type de question non supporté'] };
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        setImportProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    reader.onload = (event) => {
      setImportProgress(100);
      const content = event.target?.result as string;
      
      setTimeout(() => {
        if (file.name.endsWith('.json')) {
          try {
            const imported = JSON.parse(content);
            if (Array.isArray(imported)) {
              const validated = imported.map(validateAndNormalize);
              setPendingImport(validated);
            }
          } catch (err) {
            alert("Erreur lors de la lecture du fichier JSON.");
          }
        } else if (file.name.endsWith('.csv')) {
          Papa.parse(content, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const validated = results.data.map(validateAndNormalize);
              setPendingImport(validated);
              setImportProgress(null);
            },
            error: () => {
              alert("Erreur lors de la lecture du fichier CSV.");
              setImportProgress(null);
            }
          });
          return;
        }
        setImportProgress(null);
      }, 500);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onConfirmImport = () => {
    if (!pendingImport) return;
    const importedQs = pendingImport.filter(p => p.isValid).map(p => p.question);
    setQuestions(prev => {
      const isInitialEmpty = prev.length === 1 && !prev[0].text;
      return isInitialEmpty ? importedQs : [...prev, ...importedQs];
    });
    setPendingImport(null);
  };

  const onUpdatePendingQuestion = (idx: number, updates: Partial<Question>) => {
    if (!pendingImport) return;
    const newPending = [...pendingImport];
    const updatedQ = { ...newPending[idx].question, ...updates };
    newPending[idx] = validateAndNormalize(updatedQ);
    setPendingImport(newPending);
  };

  const onRemovePendingQuestion = (idx: number) => {
    if (!pendingImport) return;
    const newPending = pendingImport.filter((_, i) => i !== idx);
    setPendingImport(newPending.length > 0 ? newPending : null);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    const newQs = questions.filter((_, i) => i !== idx);
    setQuestions(newQs);
  };

  const duplicateQuestion = (idx: number) => {
    const q = questions[idx];
    const newQ = { 
      ...q, 
      id: Math.random().toString(36).substr(2, 9) 
    };
    const newQs = [...questions];
    newQs.splice(idx + 1, 0, newQ);
    setQuestions(newQs);
  };

  const moveQuestion = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === questions.length - 1) return;
    
    const newQs = [...questions];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newQs[idx], newQs[targetIdx]] = [newQs[targetIdx], newQs[idx]];
    setQuestions(newQs);
  };

  const toggleCollapse = (id: string) => {
    setCollapsedQuestions(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const exportToJSON = () => {
    const data = questions.map(q => {
      const nq = normalizeQuestion(q);
      const exportQ: any = {
        type: nq.type,
        text: stripHtml(nq.text),
        points: nq.points,
        shuffleOptions: nq.shuffleOptions,
      };
      if (nq.type === 'multiple-choice' || nq.type === 'true-false') {
        exportQ.options = nq.options?.map(o => stripHtml(o.text));
        exportQ.correctOptionIndex = nq.options?.findIndex(o => o.isCorrect);
      } else if (nq.type === 'short-answer') {
        exportQ.correctAnswer = stripHtml(nq.correctAnswer || '');
      } else if (nq.type === 'fill-in-the-blanks') {
        exportQ.correctAnswers = nq.correctAnswers?.map(ans => stripHtml(ans));
      } else if (nq.type === 'ordering') {
        exportQ.options = nq.options?.map(o => stripHtml(o.text));
        exportQ.correctOrder = nq.correctOrder;
      } else if (nq.type === 'matching') {
        exportQ.options = nq.options?.map(o => stripHtml(o.text));
        exportQ.matchOptions = nq.matchOptions?.map(opt => stripHtml(opt));
        exportQ.correctMatches = nq.correctMatches;
      }
      return exportQ;
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    saveAs(blob, `questions_${stripHtml(title).replace(/\s+/g, '_') || 'export'}.json`);
  };

  const exportToCSV = () => {
    const data = questions.map(q => {
      const nq = normalizeQuestion(q);
      const row: any = {
        type: nq.type,
        text: stripHtml(nq.text),
        points: nq.points,
        shuffleOptions: nq.shuffleOptions,
      };
      if (nq.type === 'multiple-choice' || nq.type === 'true-false') {
        row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
        row.correctOptionIndex = nq.options?.findIndex(o => o.isCorrect);
      } else if (nq.type === 'short-answer') {
        row.correctAnswer = stripHtml(nq.correctAnswer || '');
      } else if (nq.type === 'fill-in-the-blanks') {
        row.correctAnswers = nq.correctAnswers?.map(ans => stripHtml(ans)).join('|');
      } else if (nq.type === 'ordering') {
        row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
        row.correctOrder = nq.correctOrder?.join('|');
      } else if (nq.type === 'matching') {
        row.options = nq.options?.map(o => stripHtml(o.text)).join('|');
        row.matchOptions = nq.matchOptions?.map(opt => stripHtml(opt)).join('|');
        row.correctMatches = nq.correctMatches?.join('|');
      }
      return row;
    });
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `questions_${stripHtml(title).replace(/\s+/g, '_') || 'export'}.csv`);
  };

  const updateQuestion = (id: string, fieldOrUpdates: keyof Question | Partial<Question>, value?: any) => {
    React.startTransition(() => {
      setQuestions(prev => prev.map(q => {
        if (q.id !== id) return q;
        if (typeof fieldOrUpdates === 'string') {
          return { ...q, [fieldOrUpdates]: value };
        }
        return { ...q, ...fieldOrUpdates };
      }));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialData?.hasResults) {
      alert("Impossible de modifier un examen qui a déjà des résultats.");
      return;
    }
    if (!courseId) return alert("Veuillez sélectionner un cours.");
    
    // Validation
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text || q.text === '<p><br></p>') {
        alert(`La question ${i + 1} n'a pas d'énoncé.`);
        setCollapsedQuestions(prev => ({ ...prev, [q.id]: false }));
        return;
      }
      if ((q.type === 'multiple-choice' || !q.type) && (q.options || []).some(o => !o || o === '<p><br></p>')) {
        alert(`Toutes les options de la question ${i + 1} doivent être remplies.`);
        setCollapsedQuestions(prev => ({ ...prev, [q.id]: false }));
        return;
      }
      if (q.type === 'short-answer' && !q.correctAnswer) {
        alert(`La question ${i + 1} n'a pas de réponse correcte définie.`);
        setCollapsedQuestions(prev => ({ ...prev, [q.id]: false }));
        return;
      }
    }

    setLoading(true);
    try {
      const examData = {
        title,
        courseId: Number(courseId),
        durationMinutes: parseInt(duration),
        shuffleQuestions,
        questions,
        scheduledAt: scheduledAt || null
      };
      if (initialData) {
        await api.exams.update(initialData.id, examData);
      } else {
        await api.exams.create(examData);
      }
      onComplete();
    } catch (error) {
      console.error("Error saving exam:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 px-1">
      <AnimatePresence>
        {pendingImport && (
          <ImportPreviewModal 
            pendingQuestions={pendingImport}
            onConfirm={onConfirmImport}
            onCancel={() => setPendingImport(null)}
            onUpdateQuestion={onUpdatePendingQuestion}
            onRemoveQuestion={onRemovePendingQuestion}
          />
        )}
      </AnimatePresence>

      {initialData?.hasResults && (
        <div className="bg-amber-50 border-2 border-amber-200/50 p-5 rounded-[2rem] flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <p className="text-sm text-amber-800 font-medium leading-relaxed">
            Cet examen a déjà été passé par des étudiants. Il ne peut plus être modifié pour préserver l'intégrité des résultats.
          </p>
        </div>
      )}
      
      <div className={cn("space-y-8", initialData?.hasResults && "opacity-60 pointer-events-none")}>
        {/* Basic Config Section */}
        <section className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-subtle space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <h4 className="text-xl font-black text-slate-900 tracking-tight">Configuration de base</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Titre de l'examen" value={title} onChange={setTitle} required placeholder="ex: Examen Final - Semestre 1" />
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cours associé</label>
              <div className="relative">
                <select 
                  value={courseId} 
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full pl-4 pr-10 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none appearance-none cursor-pointer"
                  required
                >
                  <option value="">Sélectionnez un cours</option>
                  {courses.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
                </select>
                <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 rotate-90 pointer-events-none" />
              </div>
            </div>
            
            <Input label="Durée (minutes)" value={duration} onChange={setDuration} type="number" icon={Clock} />
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Programmation</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="datetime-local" 
                  value={scheduledAt} 
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-2xl text-sm font-bold transition-all outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-indigo-100 transition-all cursor-pointer group" onClick={() => setShuffleQuestions(!shuffleQuestions)}>
            <div className={cn(
              "w-10 h-6 rounded-full transition-all flex items-center px-1",
              shuffleQuestions ? "bg-indigo-600 justify-end" : "bg-slate-300 justify-start"
            )}>
              <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Shuffle className={cn("w-4 h-4", shuffleQuestions ? "text-indigo-600" : "text-slate-400")} />
              <span className="text-sm font-bold text-slate-700">Mélanger l'ordre des questions pour chaque étudiant</span>
            </div>
          </div>
        </section>

        {/* Questions Section */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-1">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-[1.25rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <CircleHelp className="w-6 h-6 text-white" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-2xl font-black text-slate-900 tracking-tight">Questions <span className="text-indigo-600">({questions.length})</span></h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{questions.reduce((acc, q) => acc + (q.points || 1), 0)} points au total</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center flex-wrap gap-2">
              <div className="flex items-center bg-white p-1 rounded-2xl border border-slate-200 shadow-subtle">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => setShowAiInput(!showAiInput)}
                  className={cn("h-10 px-4 rounded-xl gap-2", showAiInput && "bg-indigo-50 text-indigo-600")}
                  title="Générer avec IA"
                >
                  <Sparkles className={cn("w-4 h-4", isGeneratingAI ? "animate-pulse text-amber-500" : "text-indigo-500")} />
                  <span className="text-xs font-black uppercase tracking-widest">IA</span>
                </Button>
                <div className="w-px h-6 bg-slate-100 mx-1" />
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-10 px-4 rounded-xl gap-2 text-indigo-600"
                  title="Importer"
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Import</span>
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleImport} accept=".csv,.json" className="hidden" />
              </div>

              <Button type="button" onClick={addQuestion} className="h-12 px-6 rounded-2xl shadow-lg shadow-indigo-100">
                <Plus className="w-5 h-5" /> Question
              </Button>
            </div>
          </div>

          <AnimatePresence>
            {showAiInput && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-6 bg-indigo-900 text-white border-none shadow-deep relative overflow-hidden mb-8">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full transform translate-x-12 -translate-y-12" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
                    <div className="w-16 h-16 rounded-[2rem] bg-white/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-8 h-8 text-indigo-300" />
                    </div>
                    <div className="flex-1 space-y-2 text-center md:text-left">
                      <h4 className="text-xl font-black">Génération Intelligente</h4>
                      <p className="text-indigo-200 text-sm font-medium">L'IA de Gemini va générer des questions variées et pertinentes en fonction de votre sujet.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <input 
                        type="text" 
                        placeholder="Sujet de l'examen..." 
                        value={aiTopic}
                        onChange={(e) => setAiTopic(e.target.value)}
                        className="flex-1 md:w-64 bg-white/10 border border-white/20 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:bg-white/20 placeholder:text-indigo-300 transition-all font-bold"
                        disabled={isGeneratingAI}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleGenerateWithAI())}
                      />
                      <Button 
                        type="button" 
                        onClick={handleGenerateWithAI} 
                        disabled={isGeneratingAI || !aiTopic.trim()}
                        className="bg-white text-indigo-600 hover:bg-indigo-50 h-12 px-6 rounded-2xl"
                      >
                        {isGeneratingAI ? <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> : 'Générer'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <div className="flex items-center gap-4">
                 <Button 
                   type="button"
                   variant="ghost"
                   onClick={() => {
                     const allCollapsed = questions.every(q => collapsedQuestions[q.id]);
                     const newState: Record<string, boolean> = {};
                     questions.forEach(q => newState[q.id] = !allCollapsed);
                     setCollapsedQuestions(newState);
                   }}
                   className="text-[10px] text-slate-400 uppercase font-black tracking-widest hover:text-indigo-600 h-8"
                 >
                   {questions.every(q => collapsedQuestions[q.id]) ? 'Tout déplier' : 'Tout replier'}
                 </Button>
               </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={exportToJSON} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Export JSON"><FileCode className="w-5 h-5" /></button>
                  <button type="button" onClick={exportToCSV} className="text-slate-400 hover:text-indigo-600 transition-colors" title="Export CSV"><FileText className="w-5 h-5" /></button>
                </div>
             </div>

           <div className="space-y-4">

          {importProgress !== null && (
            <div className="px-1 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-indigo-600 uppercase">
                <span>Importation en cours...</span>
                <span>{importProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${importProgress}%` }}
                  className="h-full bg-indigo-600"
                />
              </div>
            </div>
          )}

          {showImportInfo && (
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl space-y-4 text-sm text-indigo-900">
              <div className="space-y-2">
                <p className="font-bold border-b border-indigo-200 pb-1">Format d'importation :</p>
                <p><strong>JSON :</strong> Un tableau d'objets Question.</p>
                <p><strong>CSV :</strong> Colonnes supportées : <code>type</code>, <code>text</code>, <code>options</code>, <code>matchOptions</code>, <code>correctOptionIndex</code>, <code>correctAnswer</code>, <code>correctAnswers</code>, <code>correctOrder</code>, <code>correctMatches</code>, <code>points</code>, <code>shuffleOptions</code>.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div className="space-y-1">
                    <p className="font-bold text-[11px] uppercase text-indigo-400">Types de questions :</p>
                    <ul className="text-[11px] list-disc list-inside opacity-80">
                      <li>multiple-choice (QCM)</li>
                      <li>true-false (Vrai/Faux)</li>
                      <li>short-answer (Réponse courte)</li>
                      <li>fill-in-the-blanks (Trous)</li>
                      <li>ordering (Mise en ordre)</li>
                      <li>matching (Association)</li>
                    </ul>
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-[11px] uppercase text-indigo-400">Notes CSV :</p>
                    <ul className="text-[11px] list-disc list-inside opacity-80">
                      <li>Séparez les listes par un pipe <code>|</code></li>
                      <li><code>points</code>: nombre (ex: 1.5)</li>
                      <li><code>shuffleOptions</code>: true ou false</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-indigo-200">
                <p className="font-bold">Exemples CSV :</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-indigo-400 mb-1">QCM & Vrai/Faux</p>
                    <pre className="bg-white p-2 rounded border border-indigo-100 overflow-x-auto text-[10px] leading-tight">
                      type,text,options,correctOptionIndex,points,shuffleOptions{"\n"}
                      multiple-choice,"Capitale de la France?","Paris|Lyon|Lille",0,1,true{"\n"}
                      true-false,"La lune est un fromage.",,1,0.5,false
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-indigo-400 mb-1">Association & Ordre</p>
                    <pre className="bg-white p-2 rounded border border-indigo-100 overflow-x-auto text-[10px] leading-tight">
                      type,text,options,matchOptions,correctMatches,correctOrder{"\n"}
                      matching,"Associez les pays","France|Italie","Paris|Rome","0|1",{"\n"}
                      ordering,"Ordre alphabétique","B|A|C",,,"1|0|2"
                    </pre>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase text-indigo-400 mb-1">Format JSON</p>
                    <pre className="bg-white p-2 rounded border border-indigo-100 overflow-x-auto text-[10px] leading-tight">
                      {"["}{"\n"}
                      {"  "}{"{"}{"\n"}
                      {"    "}"type": "multiple-choice",{"\n"}
                      {"    "}"text": "Capitale de la France?",{"\n"}
                      {"    "}"options": [ {"\n"}
                      {"      "}{"{"} "text": "Paris", "isCorrect": true {"}"},{"\n"}
                      {"      "}{"{"} "text": "Lyon", "isCorrect": false {"}"}{"\n"}
                      {"    "}],{"\n"}
                      {"    "}"points": 1,{"\n"}
                      {"    "}"shuffleOptions": true{"\n"}
                      {"  "}{"}"}{"\n"}
                      {"]"}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {questions.map((q, qIdx) => (
            <div key={q.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden transition-all">
              <div 
                className={cn(
                  "p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition-colors",
                  !collapsedQuestions[q.id] && "border-b border-slate-200 bg-slate-100/30"
                )}
                onClick={() => toggleCollapse(q.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveQuestion(qIdx, 'up'); }}
                      disabled={qIdx === 0}
                      className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); moveQuestion(qIdx, 'down'); }}
                      disabled={qIdx === questions.length - 1}
                      className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-xs font-bold text-slate-500 w-6">{qIdx + 1}</span>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        {q.type === 'multiple-choice' ? 'QCM' : 
                         q.type === 'true-false' ? 'Vrai/Faux' : 
                         q.type === 'short-answer' ? 'Réponse' : 
                         q.type === 'fill-in-the-blanks' ? 'Trous' : 
                         q.type === 'ordering' ? 'Ordre' : 'Assoc.'}
                      </span>
                      <div 
                        className="text-sm font-medium text-slate-700 truncate max-w-[300px]" 
                        dangerouslySetInnerHTML={{ __html: q.text || '<span class="text-slate-300 italic">Sans énoncé...</span>' }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1 mr-2 px-2 py-1 bg-white border border-slate-200 rounded-lg">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Pts:</span>
                    <input 
                      type="number" 
                      min="0.25"
                      step="0.25"
                      value={q.points || 1}
                      onChange={(e) => updateQuestion(q.id, 'points', Number(e.target.value))}
                      className="w-10 text-xs font-bold text-indigo-600 focus:outline-none bg-transparent"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => duplicateQuestion(qIdx)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    title="Dupliquer"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {questions.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => removeQuestion(qIdx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button 
                    type="button"
                    onClick={() => toggleCollapse(q.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-all"
                  >
                    {collapsedQuestions[q.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-180" />}
                  </button>
                </div>
              </div>

              {!collapsedQuestions[q.id] && (
                <div className="p-4 space-y-4 bg-white">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-400 uppercase">Type</label>
                      <select 
                        value={q.type || 'multiple-choice'} 
                        onChange={(e) => {
                          const type = e.target.value as QuestionType;
                          const newQs = [...questions];
                          newQs[qIdx] = { 
                            ...newQs[qIdx], 
                            type,
                            options: type === 'true-false' 
                              ? [{ text: 'Vrai', isCorrect: true }, { text: 'Faux', isCorrect: false }] 
                              : (type === 'ordering' || type === 'matching') 
                                ? [{ text: '' }, { text: '' }, { text: '' }] 
                                : (type === 'short-answer' || type === 'fill-in-the-blanks') 
                                  ? undefined 
                                  : [
                                      { text: '', isCorrect: true }, 
                                      { text: '', isCorrect: false }, 
                                      { text: '', isCorrect: false }, 
                                      { text: '', isCorrect: false }
                                    ],
                            matchOptions: type === 'matching' ? ['', '', ''] : undefined,
                            correctOptionIndex: undefined,
                            correctAnswer: type === 'short-answer' ? '' : undefined,
                            correctAnswers: type === 'fill-in-the-blanks' ? [] : undefined,
                            correctOrder: type === 'ordering' ? [0, 1, 2] : undefined,
                            correctMatches: type === 'matching' ? [0, 1, 2] : undefined
                          };
                          setQuestions(newQs);
                        }}
                        className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="multiple-choice">Choix multiple</option>
                        <option value="true-false">Vrai / Faux</option>
                        <option value="short-answer">Réponse courte</option>
                        <option value="fill-in-the-blanks">Texte à trous</option>
                        <option value="ordering">Mise en ordre</option>
                        <option value="matching">Association</option>
                      </select>
                    </div>

                    {(q.type === 'multiple-choice' || q.type === 'ordering' || q.type === 'matching') && (
                      <div className="flex items-center gap-2 ml-auto">
                        <input 
                          type="checkbox" 
                          id={`shuffle-${q.id}`}
                          checked={q.shuffleOptions || false}
                          onChange={(e) => updateQuestion(q.id, 'shuffleOptions', e.target.checked)}
                          className="w-3 h-3 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
                        />
                        <label htmlFor={`shuffle-${q.id}`} className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer">
                          Mélanger les options
                        </label>
                      </div>
                    )}
                  </div>

                  <RichTextEditor 
                    label="Énoncé de la question"
                    value={q.text} 
                    onChange={(val) => updateQuestion(q.id, 'text', val)} 
                  />

                  {(q.type === 'multiple-choice' || !q.type) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Options</label>
                  {(q.options || []).map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input 
                        type="radio" 
                        checked={opt.isCorrect} 
                        onChange={() => {
                          const newOpts = (q.options || []).map((o, i) => ({ ...o, isCorrect: i === oIdx }));
                          updateQuestion(q.id, 'options', newOpts);
                        }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex-1">
                        <RichTextEditor 
                          theme="bubble"
                          value={opt.text}
                          onChange={(val) => {
                            const newOpts = [...(q.options || [])];
                            newOpts[oIdx] = { ...newOpts[oIdx], text: val };
                            updateQuestion(q.id, 'options', newOpts);
                          }}
                          className="bg-white border border-slate-200 rounded-lg min-h-[40px]"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={() => {
                          const newOpts = (q.options || []).filter((_, i) => i !== oIdx);
                          // If we removed the correct one, make the first one correct
                          if (opt.isCorrect && newOpts.length > 0) {
                            newOpts[0] = { ...newOpts[0], isCorrect: true };
                          }
                          updateQuestion(q.id, 'options', newOpts);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500"
                        disabled={(q.options || []).length <= 2}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <Button 
                    type="button"
                    variant="ghost" 
                    onClick={() => {
                      const newOpts = [...(q.options || []), { text: '', isCorrect: false }];
                      updateQuestion(q.id, 'options', newOpts);
                    }}
                    className="text-xs text-indigo-600 p-1 h-auto"
                  >
                    + Ajouter une option
                  </Button>
                </div>
              )}

              {q.type === 'true-false' && (
                <div className="flex gap-6 p-2">
                  {(q.options || []).map((opt, oIdx) => (
                    <label key={oIdx} className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="radio" 
                        checked={opt.isCorrect} 
                        onChange={() => {
                          const newOpts = (q.options || []).map((o, i) => ({ ...o, isCorrect: i === oIdx }));
                          updateQuestion(q.id, 'options', newOpts);
                        }}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">{opt.text}</span>
                    </label>
                  ))}
                </div>
              )}

                            {q.type === 'short-answer' && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Réponse attendue (Correction exacte)</label>
                                <RichTextEditor 
                                  value={q.correctAnswer || ''}
                                  onChange={(val) => updateQuestion(q.id, 'correctAnswer', val)}
                                />
                                <p className="text-[10px] text-slate-400 italic">Note: L'IA sera utilisée pour évaluer sémantiquement la réponse de l'étudiant par rapport à celle-ci.</p>
                              </div>
                            )}

                            {q.type === 'fill-in-the-blanks' && (
                              <div className="space-y-4">
                                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
                                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-indigo-700 font-medium">
                                    Utilisez la balise <code>[blank]</code> dans l'énoncé ci-dessus pour chaque trou à remplir. Spécifiez ensuite les réponses attendues ci-dessous.
                                  </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  {Array.from({ length: (q.text?.match(/\[blank\]/g) || []).length }).map((_, bIdx) => (
                                    <div key={bIdx} className="space-y-1.5">
                                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Trou #{bIdx + 1}</label>
                                      <input 
                                        value={Array.isArray(q.correctAnswers) ? (q.correctAnswers[bIdx] as string || '') : ''}
                                        onChange={(e) => {
                                          const newAns = [...(Array.isArray(q.correctAnswers) ? q.correctAnswers : [])];
                                          newAns[bIdx] = e.target.value;
                                          updateQuestion(q.id, 'correctAnswers', newAns);
                                        }}
                                        placeholder="Réponse attendue..."
                                        className="w-full px-4 py-2.5 bg-slate-50 border-2 border-transparent focus:border-indigo-500/20 focus:bg-white rounded-xl text-sm font-bold outline-none transition-all"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {q.type === 'ordering' && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Éléments à ordonner</label>
                                  <span className="text-[10px] text-slate-400 italic">Saisissez-les dans le bon ordre</span>
                                </div>
                                <div className="space-y-2">
                                  {(q.options || []).map((opt, oIdx) => (
                                    <div key={oIdx} className="group/opt flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border-2 border-transparent hover:border-slate-100 transition-all">
                                      <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-slate-400 text-[10px] shrink-0">
                                        {oIdx + 1}
                                      </div>
                                      <div className="flex-1">
                                        <RichTextEditor 
                                          theme="bubble"
                                          value={typeof opt === 'string' ? opt : (opt.text || '')}
                                          onChange={(val) => {
                                            const newOpts = [...(q.options || [])];
                                            newOpts[oIdx] = { text: val };
                                            updateQuestion(q.id, 'options', newOpts);
                                          }}
                                          placeholder={`Élément ${oIdx + 1}...`}
                                          className="bg-transparent border-none min-h-[40px]"
                                        />
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const newOpts = (q.options || []).filter((_, i) => i !== oIdx);
                                          updateQuestion(q.id, {
                                            options: newOpts,
                                            correctOrder: newOpts.map((_, i) => i)
                                          });
                                        }}
                                        className="p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover/opt:opacity-100 transition-opacity"
                                        disabled={(q.options || []).length <= 2}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  ))}
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newOpts = [...(q.options || []), { text: '' }];
                                      updateQuestion(q.id, {
                                        options: newOpts,
                                        correctOrder: [...(q.correctOrder || []), newOpts.length - 1]
                                      });
                                    }}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 mt-2"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Ajouter un élément
                                  </button>
                                </div>
                              </div>
                            )}

                            {q.type === 'matching' && (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Paires d'association</label>
                                  <span className="text-[10px] text-slate-400 italic">Éléments correspondants côte à côte</span>
                                </div>
                                <div className="space-y-2">
                                  {(q.options || []).map((opt, oIdx) => (
                                    <div key={oIdx} className="group/opt grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-[1.5rem] border-2 border-transparent hover:border-slate-100 transition-all relative">
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                          <div className="w-1.5 h-1.5 rounded-full bg-slate-200" /> Élément Gauche
                                        </label>
                                        <RichTextEditor 
                                          theme="bubble"
                                          value={typeof opt === 'string' ? opt : (opt.text || '')}
                                          onChange={(val) => {
                                            const newOpts = [...(q.options || [])];
                                            newOpts[oIdx] = { text: val };
                                            updateQuestion(q.id, 'options', newOpts);
                                          }}
                                          placeholder="Ex: Paris"
                                          className="bg-white border border-slate-200 rounded-xl min-h-[40px]"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-1.5 ml-1">
                                          <div className="w-1.5 h-1.5 rounded-full bg-indigo-200" /> Élément Droit
                                        </label>
                                        <RichTextEditor 
                                          theme="bubble"
                                          value={q.matchOptions?.[oIdx] || ''}
                                          onChange={(val) => {
                                            const newMatch = [...(q.matchOptions || [])];
                                            newMatch[oIdx] = val;
                                            updateQuestion(q.id, 'matchOptions', newMatch);
                                          }}
                                          placeholder="Ex: France"
                                          className="bg-white border border-indigo-100 rounded-xl min-h-[40px]"
                                        />
                                      </div>
                                      <button 
                                        type="button"
                                        onClick={() => {
                                          const newOpts = (q.options || []).filter((_, i) => i !== oIdx);
                                          const newMatch = (q.matchOptions || []).filter((_, i) => i !== oIdx);
                                          updateQuestion(q.id, {
                                            options: newOpts,
                                            matchOptions: newMatch,
                                            correctMatches: newOpts.map((_, i) => i)
                                          });
                                        }}
                                        className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 bg-white border border-slate-200 rounded-full text-slate-300 hover:text-rose-500 shadow-sm opacity-0 group-hover/opt:opacity-100 transition-opacity z-10"
                                        disabled={(q.options || []).length <= 2}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      const newOpts = [...(q.options || []), { text: '' }];
                                      const newMatch = [...(q.matchOptions || []), ''];
                                      updateQuestion(q.id, {
                                        options: newOpts,
                                        matchOptions: newMatch,
                                        correctMatches: [...(q.correctMatches || []), newOpts.length - 1]
                                      });
                                    }}
                                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 mt-2"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Ajouter une paire
                                  </button>
                                </div>
                              </div>
                            )}
                  </div>
                )}
              </div>
            ))}
            </div>
          </div>
        </section>
      </div>

      <div className="pt-12 flex gap-4 py-8 border-t border-slate-100 px-1">
        <Button 
          type="button" 
          variant="ghost" 
          onClick={onComplete} 
          className="flex-1 h-14 text-slate-400 hover:text-slate-600 font-bold"
        >
          Annuler
        </Button>
        {!initialData?.hasResults && (
          <Button 
            type="submit" 
            disabled={loading} 
            className="flex-[2] h-14 shadow-xl shadow-indigo-200/50 font-black text-lg"
          >
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                Finalisation...
              </div>
            ) : initialData ? 'Mettre à jour l\'examen' : 'Publier l\'examen QCM'}
          </Button>
        )}
      </div>
    </form>
  );
}

const NOTIFICATION_MODULES = {
  toolbar: [
    [{ 'header': [1, 2, false] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    ['link', 'clean']
  ],
};

function AddNotificationForm({ onComplete, user }: { onComplete: () => void; user: UserProfile }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || content === '<p><br></p>') {
      alert("Le contenu de l'annonce ne peut pas être vide.");
      return;
    }
    setLoading(true);
    try {
      await api.notifications.create({ title, content });
      onComplete();
    } catch (error) {
      console.error("Error creating notification:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Titre de l'annonce" value={title} onChange={setTitle} required />
      <RichTextEditor 
        label="Contenu"
        value={content} 
        onChange={setContent}
        className="min-h-[200px]"
      />
      <div className="pt-4 flex gap-3">
        <Button variant="outline" onClick={onComplete} className="flex-1">Annuler</Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Publication...' : 'Publier'}
        </Button>
      </div>
    </form>
  );
}

// --- Helpers ---

function StatCard({ title, value, subValue, icon, color = 'indigo' }: { title: string; value: string; subValue?: string; icon: React.ReactNode; color?: 'indigo' | 'amber' | 'emerald' | 'violet' | 'rose' }) {
  const colors = {
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    violet: 'bg-violet-50 border-violet-100 text-violet-600',
    rose: 'bg-rose-50 border-rose-100 text-rose-600'
  };

  return (
    <Card className="p-6 relative overflow-hidden group border-none shadow-xl shadow-slate-200/40">
      <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 transition-transform duration-700 group-hover:scale-150", colors[color])} />
      <div className="relative flex items-center gap-5">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border-2 shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6", colors[color])}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <h4 className="text-2xl font-black text-slate-900 tracking-tight font-display">{value}</h4>
          </div>
          {subValue && (
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{subValue}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function EmptyState({ message, icon: Icon = AlertCircle }: { message: string; icon?: any }) {
  return (
    <div className="p-12 text-center border-2 border-dashed border-slate-200/60 rounded-[2rem] bg-white/50 backdrop-blur-sm flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-slate-500 font-medium max-w-[200px] leading-relaxed">{message}</p>
    </div>
  );
}

const StudentListModal = React.memo(({ group, onClose }: { group: Group; onClose: () => void }) => {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await api.groups.getStudents(group.id);
        setStudents(data);
      } catch (err: any) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [group.id]);

  return (
    <Modal title={`Étudiants - ${group.name}`} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
          </div>
        ) : students.length === 0 ? (
          <EmptyState message="Aucun étudiant dans ce groupe." />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {students.map(student => (
              <Card key={student.id} className="p-4 flex items-center gap-4 border-none shadow-md shadow-slate-100 bg-slate-50/50">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-100">
                  <User className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-slate-900">{student.displayName}</h4>
                  <p className="text-xs text-slate-500">{student.email}</p>
                </div>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-white px-2 py-0.5 rounded-lg border border-slate-100">
                  Inscrit le {new Date(student.createdAt).toLocaleDateString()}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
});

function FiliereGroupManagement({ filieres, groups, onRefresh }: { filieres: Filiere[]; groups: Group[]; onRefresh: () => void }) {
  const [isAddingFiliere, setIsAddingFiliere] = useState(false);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [editingFiliere, setEditingFiliere] = useState<Filiere | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [viewingGroupStudents, setViewingGroupStudents] = useState<Group | null>(null);

  const groupsWithFiliere = useMemo(() => {
    return groups.map(g => ({
      ...g,
      filiere: filieres.find(f => f.id === g.filiereId)
    }));
  }, [groups, filieres]);

  const handleDeleteFiliere = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer cette filière ?")) return;
    try {
      await api.filieres.delete(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm("Voulez-vous vraiment supprimer ce groupe ?")) return;
    try {
      await api.groups.delete(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 font-serif italic tracking-tight">Gestion des Filières & Groupes</h2>
          <p className="text-slate-500 mt-1">Configurez les structures académiques pour vos étudiants.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Filières Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 font-serif italic">Filières</h3>
            <Button onClick={() => setIsAddingFiliere(true)} variant="outline" className="gap-2 text-xs uppercase tracking-widest font-black py-3 px-4">
              <Plus className="w-4 h-4" /> Ajouter
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {filieres.length === 0 ? (
              <EmptyState message="Aucune filière créée." />
            ) : (
              filieres.map(f => (
                <Card key={f.id} className="p-5 flex items-center justify-between group border-none shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-all duration-300">
                  <div className="cursor-pointer flex-1" onClick={() => setEditingFiliere(f)}>
                    <h4 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{f.name}</h4>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1">Créée le {new Date(f.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditingFiliere(f)}
                      className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteFiliere(f.id)}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
            <button 
              onClick={() => setIsAddingFiliere(true)}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-2"
            >
              <Plus className="w-4 h-4" /> Ajouter une filière
            </button>
          </div>
        </section>

        {/* Groupes Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 font-serif italic">Groupes</h3>
            <Button onClick={() => setIsAddingGroup(true)} variant="outline" className="gap-2 text-xs uppercase tracking-widest font-black py-3 px-4" disabled={filieres.length === 0}>
              <Plus className="w-4 h-4" /> Ajouter
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {groupsWithFiliere.length === 0 ? (
              <EmptyState message="Aucun groupe créé." />
            ) : (
              groupsWithFiliere.map(g => (
                <Card key={g.id} className="p-5 flex items-center justify-between group border-none shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-all duration-300">
                  <div className="cursor-pointer flex-1" onClick={() => setViewingGroupStudents(g)}>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{g.name}</h4>
                      <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg uppercase tracking-widest">
                        {g.filiere?.name || 'Filière inconnue'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Créé le {new Date(g.createdAt).toLocaleDateString()}</p>
                      <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        <Users className="w-3 h-3" /> {g.studentCount || 0} étudiants • Cliquer pour voir
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 pl-4 border-l border-slate-50 ml-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setEditingGroup(g)}
                      className="text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                      title="Modifier"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDeleteGroup(g.id)}
                      className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
            <button 
              onClick={() => setIsAddingGroup(true)}
              disabled={filieres.length === 0}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" /> Ajouter un groupe
            </button>
          </div>
        </section>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(isAddingFiliere || editingFiliere) && (
          <Modal title={editingFiliere ? "Modifier la Filière" : "Ajouter une Filière"} onClose={() => { setIsAddingFiliere(false); setEditingFiliere(null); }}>
            <FiliereForm initialData={editingFiliere} onComplete={() => { setIsAddingFiliere(false); setEditingFiliere(null); onRefresh(); }} />
          </Modal>
        )}

        {(isAddingGroup || editingGroup) && (
          <Modal title={editingGroup ? "Modifier le Groupe" : "Ajouter un Groupe"} onClose={() => { setIsAddingGroup(false); setEditingGroup(null); }}>
            <GroupForm filieres={filieres} initialData={editingGroup} onComplete={() => { setIsAddingGroup(false); setEditingGroup(null); onRefresh(); }} />
          </Modal>
        )}

        {viewingGroupStudents && (
          <StudentListModal group={viewingGroupStudents} onClose={() => setViewingGroupStudents(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

function FiliereForm({ initialData, onComplete }: { initialData: Filiere | null; onComplete: () => void }) {
  const [name, setName] = useState(initialData?.name || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (initialData) {
        await api.filieres.update(initialData.id, { name });
      } else {
        await api.filieres.create({ name });
      }
      onComplete();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom de la filière" value={name} onChange={setName} required placeholder="ex: Informatique de Gestion" />
      <div className="pt-4 flex gap-3">
        <Button variant="outline" onClick={onComplete} className="flex-1">Annuler</Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}

function GroupForm({ filieres, initialData, onComplete }: { filieres: Filiere[]; initialData: Group | null; onComplete: () => void }) {
  const [name, setName] = useState(initialData?.name || '');
  const [filiereId, setFiliereId] = useState(initialData?.filiereId || filieres[0]?.id || 0);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filiereId) return alert("Veuillez sélectionner une filière.");
    setLoading(true);
    try {
      if (initialData) {
        await api.groups.update(initialData.id, { name, filiereId });
      } else {
        await api.groups.create({ name, filiereId });
      }
      onComplete();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nom du groupe" value={name} onChange={setName} required placeholder="ex: G1-A" />
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-slate-700">Filière associée</label>
        <select 
          value={filiereId} 
          onChange={(e) => setFiliereId(Number(e.target.value))}
          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          required
        >
          <option value="">Sélectionnez une filière</option>
          {filieres.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>
      <div className="pt-4 flex gap-3">
        <Button variant="outline" onClick={onComplete} className="flex-1">Annuler</Button>
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
