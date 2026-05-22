import express from "express";
// Vite import removed and moved to dynamic import inside startServer
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

import multer from "multer";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

import cors from "cors";

const JWT_SECRET = process.env.JWT_SECRET || "eduqcm-secret-key";

// --- AI Setup (Lazy) ---
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || "",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// --- Database Setup ---
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

let db = new Database("eduqcm.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const upload = multer({ dest: "uploads/" });

  // Initialize tables one by one for robustness
  const tables = [
    `CREATE TABLE IF NOT EXISTS filieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      niveau TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filiereId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(filiereId) REFERENCES filieres(id)
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      displayName TEXT NOT NULL,
      role TEXT CHECK(role IN ('student', 'teacher', 'admin')) NOT NULL,
      groupName TEXT,
      filiere TEXT,
      groupId INTEGER,
      filiereId INTEGER,
      registrationNumber TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(filiereId) REFERENCES filieres(id),
      FOREIGN KEY(groupId) REFERENCES groups(id)
    )`,
    `CREATE TABLE IF NOT EXISTS modules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      durationHours INTEGER DEFAULT 0,
      description TEXT,
      teacherId INTEGER NOT NULL,
      filiereId INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(teacherId) REFERENCES users(id),
      FOREIGN KEY(filiereId) REFERENCES filieres(id)
    )`,
    `CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      moduleId INTEGER NOT NULL,
      teacherId INTEGER NOT NULL,
      type TEXT DEFAULT 'controle-continu',
      durationMinutes INTEGER DEFAULT 30,
      questions TEXT NOT NULL, -- JSON string
      scheduledAt DATETIME,
      status TEXT DEFAULT 'draft',
      groupId INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(moduleId) REFERENCES modules(id),
      FOREIGN KEY(teacherId) REFERENCES users(id),
      FOREIGN KEY(groupId) REFERENCES groups(id)
    )`,
    `CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      examId INTEGER NOT NULL,
      studentId INTEGER NOT NULL,
      score INTEGER NOT NULL,
      totalQuestions INTEGER NOT NULL,
      totalPoints INTEGER NOT NULL DEFAULT 0,
      answers TEXT NOT NULL,
      questionResults TEXT,
      aiFeedback TEXT,
      completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(examId) REFERENCES exams(id),
      FOREIGN KEY(studentId) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      teacherId INTEGER NOT NULL,
      groupId INTEGER,
      type TEXT DEFAULT 'announcement',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(teacherId) REFERENCES users(id),
      FOREIGN KEY(groupId) REFERENCES groups(id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      orgName TEXT NOT NULL DEFAULT 'OFPPT',
      orgNameArabic TEXT NOT NULL DEFAULT 'مكتب التكوين المهني وإنعاش الشغل',
      orgNameFrench TEXT NOT NULL DEFAULT 'Office de la Formation Professionnelle et de la promotion du travail',
      regionalDirection TEXT NOT NULL DEFAULT 'Direction Régionale De BM-KH',
      institutionName TEXT NOT NULL DEFAULT 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem',
      orgSubName TEXT NOT NULL DEFAULT 'DRBMKH',
      orgLogoUrl TEXT,
      orgLogoUrlRight TEXT,
      footerText TEXT,
      showFooter INTEGER DEFAULT 1,
      regionName TEXT NOT NULL DEFAULT 'ROYAUME DU MAROC',
      academicYear TEXT NOT NULL DEFAULT '2024/2025',
      orgLogoBgColor TEXT NOT NULL DEFAULT '#059669',
      orgLogoTextColor TEXT NOT NULL DEFAULT '#ffffff',
      headerLines TEXT,
      headerColumns TEXT,
      showHeaderLines INTEGER DEFAULT 0,
      showFooterLines INTEGER DEFAULT 0,
      ccRules TEXT,
      defaultExamSettings TEXT,
      templates TEXT,
      footerColumns TEXT,
      footerTable TEXT,
      footerFontSize INTEGER DEFAULT 9,
      footerFontFamily TEXT DEFAULT 'Inter',
      watermarkText TEXT,
      showWatermark INTEGER DEFAULT 0,
      watermarkColor TEXT DEFAULT '#E0E0E0',
      watermarkOpacity INTEGER DEFAULT 3,
      showFooterText INTEGER DEFAULT 1,
      showFooterTable INTEGER DEFAULT 1,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_notifications (
      userId INTEGER NOT NULL,
      notificationId INTEGER NOT NULL,
      readAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, notificationId),
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(notificationId) REFERENCES notifications(id)
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id)
    )`
  ];

  for (const table of tables) {
    try { db.exec(table); } catch (e) { console.error("Table creation failed:", e); }
  }

  // Ensure columns exist for existing databases
  try { db.exec("ALTER TABLE users ADD COLUMN groupName TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE exams ADD COLUMN status TEXT DEFAULT 'draft'"); } catch (e) {}
  try { db.exec("ALTER TABLE exams ADD COLUMN groupId INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN filiere TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN filiereId INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN groupId INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN registrationNumber TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE modules ADD COLUMN filiereId INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE modules ADD COLUMN code TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE modules ADD COLUMN durationHours INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE exams RENAME COLUMN courseId TO moduleId"); } catch (e) {}
  try { db.exec("ALTER TABLE exams ADD COLUMN type TEXT DEFAULT 'controle-continu'"); } catch (e) {}
  try { db.exec("ALTER TABLE results ADD COLUMN totalPoints INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN headerColumns TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN orgLogoUrlRight TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN footerText TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN showFooter INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE results ADD COLUMN questionResults TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE exams ADD COLUMN scheduledAt DATETIME"); } catch (e) {}
  try { db.exec("ALTER TABLE filieres ADD COLUMN code TEXT"); } catch (e) {}
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_filieres_code ON filieres(code)"); } catch (e) {}
  try { db.exec("ALTER TABLE filieres ADD COLUMN description TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN groupId INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'announcement'"); } catch (e) {}
  try { db.exec("ALTER TABLE filieres ADD COLUMN niveau TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE results ADD COLUMN aiFeedback TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN orgLogoUrl TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN orgNameArabic TEXT DEFAULT 'مكتب التكوين المهني وإنعاش الشغل'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN orgNameFrench TEXT DEFAULT 'Office de la Formation Professionnelle et de la promotion du travail'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN regionalDirection TEXT DEFAULT 'Direction Régionale De BM-KH'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN institutionName TEXT DEFAULT 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN headerLines TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN showHeaderLines INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN showFooterLines INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN ccRules TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN footerTable TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN footerColumns TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN showFooterText INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN showFooterTable INTEGER DEFAULT 1"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN defaultExamSettings TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN footerFontSize INTEGER DEFAULT 9"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN footerFontFamily TEXT DEFAULT 'Inter'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN watermarkText TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN showWatermark INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN watermarkColor TEXT DEFAULT '#E0E0E0'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN watermarkOpacity INTEGER DEFAULT 3"); } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS exam_sessions (
        userId INTEGER NOT NULL,
        examId INTEGER NOT NULL,
        startTime INTEGER NOT NULL,
        PRIMARY KEY (userId, examId),
        FOREIGN KEY(userId) REFERENCES users(id),
        FOREIGN KEY(examId) REFERENCES exams(id)
      )
    `);
  } catch (e) {
    console.error("Exam sessions table creation failed:", e);
  }

  try {
    db.prepare(`
      INSERT OR IGNORE INTO settings (id, orgName, orgNameArabic, orgNameFrench, regionalDirection, institutionName, orgSubName, regionName, academicYear, orgLogoBgColor, orgLogoTextColor) 
      VALUES (1, 'OFPPT', 'مكتب التكوين المهني وإنعاش الشغل', 'Office de la Formation Professionnelle et de la promotion du travail', 'Direction Régionale De BM-KH', 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem', 'DRBMKH', 'ROYAUME DU MAROC', '2024/2025', '#059669', '#ffffff')
    `).run();
  } catch (e) {
    console.error("Default settings insertion failed:", e);
  }

// Update default logo if it's the default one and it's currently null
try {
  db.prepare("UPDATE settings SET orgLogoUrl = ? WHERE id = 1 AND (orgLogoUrl IS NULL OR orgLogoUrl = '')").run('https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/OFPPT_Logo.svg/1200px-OFPPT_Logo.svg.png');
} catch (e) {}

// Update default ccRules if null
try {
  const defaultCCRules = JSON.stringify([
    { min: 10, max: 20, count: 1 },
    { min: 20, max: 50, count: 2 },
    { min: 50, max: 9999, count: 3 }
  ]);
  db.prepare("UPDATE settings SET ccRules = ? WHERE id = 1 AND (ccRules IS NULL OR ccRules = '')").run(defaultCCRules);
} catch (e) {}

// --- Advanced Migration: Fix exams table foreign keys ---
try {
  const examsDDL = (db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='exams'").get() as any)?.sql || "";
  if (examsDDL.includes("REFERENCES courses") || examsDDL.includes("courseId")) {
    console.log("Old exams table detected. Migrating to new schema with correct foreign keys...");
    db.pragma("foreign_keys = OFF");
    try {
      db.transaction(() => {
        // 1. Create new table with correct schema
        db.exec(`
          CREATE TABLE IF NOT EXISTS exams_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            moduleId INTEGER NOT NULL,
            teacherId INTEGER NOT NULL,
            type TEXT DEFAULT 'controle-continu',
            durationMinutes INTEGER DEFAULT 30,
            questions TEXT NOT NULL,
            scheduledAt DATETIME,
            status TEXT DEFAULT 'draft',
            groupId INTEGER,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(moduleId) REFERENCES modules(id),
            FOREIGN KEY(teacherId) REFERENCES users(id),
            FOREIGN KEY(groupId) REFERENCES groups(id)
          );
        `);

        // 2. Copy data
        // Check if we have courseId or moduleId
        const tableInfo = db.prepare("PRAGMA table_info(exams)").all() as any[];
        
        const columns = tableInfo.map(c => c.name).join(', ');
        const targetColumns = tableInfo.map(c => c.name === 'courseId' ? 'moduleId' : c.name).join(', ');
        
        db.exec(`INSERT INTO exams_new (${targetColumns}) SELECT ${columns} FROM exams`);

        // 3. Swap tables
        db.exec("DROP TABLE exams");
        db.exec("ALTER TABLE exams_new RENAME TO exams");
        console.log("Migration successful.");
      })();
    } finally {
      db.pragma("foreign_keys = ON");
    }
  }
} catch (e) {
  console.error("Migration error (exams):", e);
}

// Ensure filieres NOT NULL constraints if possible (SQLite doesn't support this easily with ALTER TABLE, 
// but we least want to make sure 'code' and 'name' are treated meaningfully)

// --- Structured Memory Cache Strategy ---
class ServerMemoryCache {
  private cache = new Map<string, { data: any; expiry: number }>();

  get(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiry) {
      this.cache.delete(key);
      return null;
    }
    console.log(`[Cache Hit] Key: ${key}`);
    return cached.data;
  }

  set(key: string, data: any, ttlSeconds: number = 300): void {
    console.log(`[Cache Set] Key: ${key}, TTL: ${ttlSeconds}s`);
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidate(pattern: string | RegExp): void {
    if (typeof pattern === "string") {
      const deleted = this.cache.delete(pattern);
      if (deleted) console.log(`[Cache Invalidate] Exact: ${pattern}`);
    } else {
      let count = 0;
      for (const key of this.cache.keys()) {
        if (pattern.test(key)) {
          this.cache.delete(key);
          count++;
        }
      }
      if (count > 0) console.log(`[Cache Invalidate] Pattern: ${pattern.toString()}, ${count} items deleted`);
    }
  }

  clear(): void {
    this.cache.clear();
    console.log(`[Cache Clear] All cache invalidated`);
  }
}

const cacheManager = new ServerMemoryCache();

function clearCache(name: 'users' | 'results' | 'exams' | 'modules' | 'filieres' | 'groups' | 'all') {
  if (name === 'all') {
    cacheManager.clear();
    return;
  }
  cacheManager.invalidate(new RegExp(`^${name}:`));
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

  const ai = getAI();

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      // Verify user still exists in DB (prevents FK errors if DB was reset)
      const user = db.prepare(`
        SELECT u.*, g.name as groupNameResolved, f.name as filiereNameResolved
        FROM users u
        LEFT JOIN groups g ON u.groupId = g.id
        LEFT JOIN filieres f ON u.filiereId = f.id
        WHERE u.id = ?
      `).get(decoded.id) as any;
      
      if (!user) {
        res.clearCookie("token");
        return res.status(401).json({ error: "User no longer exists" });
      }
      
      const { password: _, groupNameResolved, filiereNameResolved, ...userWithoutPassword } = user;
      req.user = { 
        ...userWithoutPassword, 
        id: Number(userWithoutPassword.id),
        groupName: groupNameResolved || userWithoutPassword.groupName,
        filiere: filiereNameResolved || userWithoutPassword.filiere
      };
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // In-memory live exam supervision state
  const liveSessions: Record<number, Record<number, any>> = {};

  io.on("connection", (socket) => {
    socket.on("authenticate", (userData: any) => {
      if (!userData) return;
      
      // Leave all rooms except the default one (socket.id)
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.leave(room);
        }
      }
      
      // Join group room if student
      if (userData.role === 'student' && userData.groupId) {
        socket.join(`group-${userData.groupId}`);
      }
      
      // Join teachers room if teacher
      if (userData.role === 'teacher') {
        socket.join('teachers');
      }
      
      // Join individual user room for private notifs if needed
      socket.join(`user-${userData.id}`);
    });

    // Handle Teacher Supervision Subscription
    socket.on("exam:subscribe-supervision", ({ examId }) => {
      if (!examId) return;
      socket.join(`exam-${examId}-supervision-teachers`);
      
      // Send current live status of this exam immediately
      const sessions = liveSessions[examId] ? Object.values(liveSessions[examId]) : [];
      socket.emit("exam:live-update", { examId, sessions });
    });

    // Handle Student Progress update
    socket.on("exam:join-or-update", (data: any) => {
      const { examId, studentId, studentName, registrationNumber, answeredCount, totalQuestions, tabExitCount, status, lastUpdated, extraTimeMinutes, timeLeft } = data;
      if (!examId || !studentId) return;

      if (!liveSessions[examId]) {
        liveSessions[examId] = {};
      }

      const existingSession = liveSessions[examId][studentId] || { cheatAlerts: [] };

      liveSessions[examId][studentId] = {
        studentId,
        studentName,
        registrationNumber,
        answeredCount,
        totalQuestions,
        tabExitCount,
        status,
        lastUpdated,
        extraTimeMinutes: extraTimeMinutes || existingSession.extraTimeMinutes || 0,
        timeLeft: timeLeft || existingSession.timeLeft || 0,
        cheatAlerts: existingSession.cheatAlerts || []
      };

      // Broadcast to teachers
      io.to(`exam-${examId}-supervision-teachers`).emit("exam:live-update", {
        examId,
        sessions: Object.values(liveSessions[examId])
      });
    });

    // Handle Student Cheat alert
    socket.on("exam:cheat-alert", (data: any) => {
      const { examId, studentId, studentName, registrationNumber, type, details, timestamp } = data;
      if (!examId || !studentId) return;

      createLog(studentId, 'SEC_VIOLATION', `Examen #${examId} - ${studentName} (${registrationNumber}) : ${details}`);

      if (!liveSessions[examId]) {
        liveSessions[examId] = {};
      }

      if (!liveSessions[examId][studentId]) {
        liveSessions[examId][studentId] = {
          studentId,
          studentName,
          registrationNumber,
          answeredCount: 0,
          totalQuestions: 0,
          tabExitCount: 0,
          status: 'active',
          lastUpdated: timestamp,
          extraTimeMinutes: 0,
          timeLeft: 1800,
          cheatAlerts: []
        };
      }

      const session = liveSessions[examId][studentId];
      if (!session.cheatAlerts) session.cheatAlerts = [];
      
      session.cheatAlerts.push({ type, details, timestamp });
      if (type === 'tab-exit') {
        session.tabExitCount += 1;
      }

      // Broadcast update to teachers
      io.to(`exam-${examId}-supervision-teachers`).emit("exam:live-update", {
        examId,
        sessions: Object.values(liveSessions[examId])
      });

      // Broadcast alert message specifically for notification toast
      io.to(`exam-${examId}-supervision-teachers`).emit("exam:cheat-alert-toast", {
        studentId,
        studentName,
        type,
        details,
        timestamp
      });
    });

    // Handle Teacher Remote actions
    socket.on("exam:remote-action", (data: { examId: number; studentId: number; action: 'stop' | 'add-time'; amount?: number }) => {
      const { examId, studentId, action, amount } = data;
      if (!examId || !studentId) return;

      // Update in-memory session state
      if (liveSessions[examId] && liveSessions[examId][studentId]) {
        if (action === 'add-time') {
          liveSessions[examId][studentId].extraTimeMinutes = (liveSessions[examId][studentId].extraTimeMinutes || 0) + (amount || 10);
        } else if (action === 'stop') {
          liveSessions[examId][studentId].status = 'completed';
        }
        
        // Broadcast state update back to teachers
        io.to(`exam-${examId}-supervision-teachers`).emit("exam:live-update", {
          examId,
          sessions: Object.values(liveSessions[examId])
        });
      }

      // Emit action directly to the student
      io.to(`user-${studentId}`).emit("exam:remote-trigger", { examId, action, amount });
    });
  });

  const PORT = 3000;

  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (req.path !== '/api/health') {
        console.log(`[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- AI Routes ---
  app.post("/api/ai/generate-questions", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { topic, count, targetPoints, allowedTypes } = req.body;
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: req.body.prompt, // We'll pass the full prompt from the client proxy for now to minimize logic duplication, or better, re-assemble here.
        config: req.body.config
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/refine-question", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { question } = req.body;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Améliore cette question d'examen pour la rendre plus claire, professionnelle et sans ambiguïté.
        Conserve le même type de question et le même sens, mais améliore le style et la structure.
        
        Question actuelle: ${JSON.stringify(question)}
        
        Répond uniquement avec l'objet JSON de la question mise à jour.`,
        config: {
          responseMimeType: "application/json"
        }
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/evaluate-short-answer", authenticate, async (req: any, res) => {
    const { question, expectedAnswer, studentAnswer } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Évalue la réponse de l'étudiant par rapport à la réponse attendue pour la question donnée.
        Question : "${question}"
        Réponse attendue : "${expectedAnswer}"
        Réponse de l'étudiant : "${studentAnswer}"
        
        Donne un score entre 0 et 1 (0 = faux, 1 = parfait, entre les deux pour une réponse partiellement correcte).
        Sois indulgent sur l'orthographe si le sens est correct.
        Répond uniquement avec le nombre (ex: 0.5 ou 1).`,
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/analyze-results", authenticate, async (req: any, res) => {
    const { examTitle, totalScore, totalPoints, resultsSummary } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Tu es un conseiller pédagogique expert. Analyse les résultats d'un étudiant à l'examen "${examTitle}" et fournis un feedback constructif, motivant et personnalisé.

Score final : ${totalScore}/${totalPoints} (${Math.round((totalScore / totalPoints) * 100)}%)

Détails des questions :
${resultsSummary}

Instructions pour le feedback :
1. Commence par une félicitation ou un encouragement global selon le score.
2. Identifie 2 à 3 points forts (sujets ou types de questions réussis).
3. Identifie 2 à 3 axes d'amélioration précis basés sur les erreurs.
4. Donne un conseil concret pour la suite.
5. Sois bienveillant mais professionnel.
6. Ne cite pas les numéros de questions, parle des sujets ou des concepts.
7. Langue : Français.
8. Format: Texte fluide avec des paragraphes, sans markdown complexe (pas de tableaux), utilise des puces si nécessaire.`,
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai/generic", authenticate, async (req: any, res) => {
    const { prompt, model, config } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: model || "gemini-3-flash-preview",
        contents: prompt,
        config: config
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  const createLog = (userId: number, action: string, details: string) => {
    try {
      db.prepare("INSERT INTO audit_logs (userId, action, details) VALUES (?, ?, ?)").run(userId, action, details);
    } catch (e) {
      console.error("Failed to create audit log:", e);
    }
  };

  // --- Auth Routes ---
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, displayName, role, groupName, filiere, groupId, filiereId } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, displayName, role, groupName, filiere, groupId, filiereId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const result = stmt.run(email, hashedPassword, displayName, role, groupName || null, filiere || null, groupId || null, filiereId || null);
      
      const userId = Number(result.lastInsertRowid);
      const user = { id: userId, email, displayName, role, groupName, filiere, groupId, filiereId };
      const token = jwt.sign(user, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true });
      res.json({ user });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user: any = db.prepare(`
      SELECT u.*, g.name as groupNameResolved, f.name as filiereNameResolved
      FROM users u
      LEFT JOIN groups g ON u.groupId = g.id
      LEFT JOIN filieres f ON u.filiereId = f.id
      WHERE u.email = ?
    `).get(email);
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    
    const { password: _, groupNameResolved, filiereNameResolved, ...userWithoutPassword } = user;
    const userData = { 
      ...userWithoutPassword, 
      id: Number(userWithoutPassword.id),
      groupName: groupNameResolved || userWithoutPassword.groupName,
      filiere: filiereNameResolved || userWithoutPassword.filiere
    };
    
    const token = jwt.sign(userData, JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.json({ user: userData });
  });

  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });

  app.get("/api/auth/me", (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user = db.prepare(`
        SELECT u.*, g.name as groupNameResolved, f.name as filiereNameResolved
        FROM users u
        LEFT JOIN groups g ON u.groupId = g.id
        LEFT JOIN filieres f ON u.filiereId = f.id
        WHERE u.id = ?
      `).get(decoded.id) as any;
      
      if (!user) {
        res.clearCookie("token");
        return res.json({ user: null });
      }
      
      const { password: _, groupNameResolved, filiereNameResolved, ...userWithoutPassword } = user;
      const userData = { 
        ...userWithoutPassword, 
        id: Number(userWithoutPassword.id),
        groupName: groupNameResolved || userWithoutPassword.groupName,
        filiere: filiereNameResolved || userWithoutPassword.filiere
      };
      
      res.json({ user: userData });
    } catch (err) {
      console.error("JWT Auth error:", err);
      res.clearCookie("token");
      res.json({ user: null });
    }
  });

  app.put("/api/auth/update", authenticate, async (req: any, res) => {
    const { displayName, password } = req.body;
    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.prepare("UPDATE users SET displayName = ?, password = ? WHERE id = ?").run(displayName, hashedPassword, req.user.id);
      } else {
        db.prepare("UPDATE users SET displayName = ? WHERE id = ?").run(displayName, req.user.id);
      }
      
      const user = db.prepare(`
        SELECT u.*, g.name as groupNameResolved, f.name as filiereNameResolved
        FROM users u
        LEFT JOIN groups g ON u.groupId = g.id
        LEFT JOIN filieres f ON u.filiereId = f.id
        WHERE u.id = ?
      `).get(req.user.id) as any;
      
      const { password: _, groupNameResolved, filiereNameResolved, ...userWithoutPassword } = user;
      const userData = { 
        ...userWithoutPassword, 
        id: Number(userWithoutPassword.id),
        groupName: groupNameResolved || userWithoutPassword.groupName,
        filiere: filiereNameResolved || userWithoutPassword.filiere
      };
      
      const token = jwt.sign(userData, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true });
      res.json({ user: userData });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Data Routes ---
  app.get("/api/modules", authenticate, (req: any, res) => {
    const isTeacher = req.user.role === 'teacher';
    const cacheKey = isTeacher ? `modules:list:teacher:${req.user.id}` : `modules:list:student:${req.user.filiereId}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let modules;
    if (isTeacher) {
      modules = db.prepare(`
        SELECT m.*, (SELECT COUNT(*) FROM exams e WHERE e.moduleId = m.id) as examsCount
        FROM modules m 
        WHERE m.teacherId = ?
        ORDER BY m.createdAt DESC
      `).all(req.user.id);
    } else {
      // Students only see modules assigned to their filiere
      modules = db.prepare(`
        SELECT m.*, (SELECT COUNT(*) FROM exams e WHERE e.moduleId = m.id) as examsCount
        FROM modules m 
        WHERE m.filiereId = ?
        ORDER BY m.createdAt DESC
      `).all(req.user.filiereId);
    }
    
    const parsedModules = modules.map((m: any) => ({
      ...m,
      hasExams: m.examsCount > 0
    }));
    cacheManager.set(cacheKey, parsedModules, 300);
    res.json(parsedModules);
  });

  app.post("/api/modules", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const { code, name, durationHours, description, filiereId } = req.body;
      const fId = (filiereId && filiereId !== 0) ? filiereId : null;
      const stmt = db.prepare("INSERT INTO modules (code, name, durationHours, description, teacherId, filiereId) VALUES (?, ?, ?, ?, ?, ?)");
      const result = stmt.run(code, name, durationHours || 0, description, req.user.id, fId);
      clearCache('modules');
      res.json({ id: Number(result.lastInsertRowid), code, name, durationHours, description, teacherId: req.user.id, filiereId: fId });
    } catch (err: any) {
      console.error("Error creating module:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/modules/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const { code, name, durationHours, description, filiereId } = req.body;
      const { id } = req.params;
      const fId = (filiereId && filiereId !== 0) ? filiereId : null;
      const stmt = db.prepare("UPDATE modules SET code = ?, name = ?, durationHours = ?, description = ?, filiereId = ? WHERE id = ? AND teacherId = ?");
      const result = stmt.run(code, name, durationHours || 0, description, fId, id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Module not found or unauthorized" });
      clearCache('modules');
      res.json({ id: Number(id), code, name, durationHours, description, filiereId: fId });
    } catch (err: any) {
      console.error("Error updating module:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/modules/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const moduleId = Number(id);

    try {
      const module = db.prepare("SELECT name FROM modules WHERE id = ?").get(moduleId) as any;
      const moduleName = module ? module.name : "Unknown";

      // Anti-orphan logic: Delete all associated exams and their results
      const exams = db.prepare("SELECT id FROM exams WHERE moduleId = ?").all(moduleId) as any[];
      
      db.transaction(() => {
        for (const exam of exams) {
          // Delete results for this exam
          db.prepare("DELETE FROM results WHERE examId = ?").run(exam.id);
          
          // Delete notifications related to this exam (if any)
          db.prepare("DELETE FROM notifications WHERE type = 'exam' AND content LIKE ?").run(`%${exam.id}%`);
          
          // Cleanup word files from uploads if they exist (logic anti-orphelins)
          if (fs.existsSync("uploads")) {
            const files = fs.readdirSync("uploads");
            for (const file of files) {
              if (file.includes(`exam_${exam.id}`) && file.endsWith(".docx")) {
                try {
                  fs.unlinkSync(path.join("uploads", file));
                  console.log(`[DELETE] Deleted orphaned Word file: ${file}`);
                } catch (e) {
                  console.warn(`[DELETE] Failed to delete file ${file}:`, e);
                }
              }
            }
          }
          
          // Finally delete the exam
          db.prepare("DELETE FROM exams WHERE id = ?").run(exam.id);
        }
        
        // Delete the module itself
        const stmt = db.prepare("DELETE FROM modules WHERE id = ? AND teacherId = ?");
        const result = stmt.run(moduleId, req.user.id);
        
        if (result.changes === 0) throw new Error("Module not found or unauthorized");
      })();

      createLog(req.user.id, "DELETE_MODULE", `Suppression du module: ${moduleName} (ID: ${moduleId})`);
      clearCache('modules');
      clearCache('exams');
      clearCache('results');
      res.json({ success: true, message: `Module ${moduleId} and its ${exams.length} exams deleted.` });
    } catch (err: any) {
      console.error("Error deleting module:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/exams", authenticate, (req: any, res) => {
    const isTeacher = req.user.role === 'teacher';
    const cacheKey = isTeacher ? `exams:list:teacher:${req.user.id}` : `exams:list:student:${req.user.id}:${req.user.groupId}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let exams;
    if (isTeacher) {
      exams = db.prepare(`
        SELECT e.*, (SELECT COUNT(*) FROM results r WHERE r.examId = e.id) as resultsCount,
               g.name as groupName
        FROM exams e 
        LEFT JOIN groups g ON e.groupId = g.id
        WHERE e.teacherId = ?
        ORDER BY e.createdAt DESC
      `).all(req.user.id);
    } else {
      // Students only see exams for modules assigned to their filiere AND active for their group
      exams = db.prepare(`
        SELECT e.*, (SELECT COUNT(*) FROM results r WHERE r.examId = e.id) as resultsCount
        FROM exams e 
        JOIN modules m ON e.moduleId = m.id
        WHERE m.filiereId = ? AND e.status = 'active' AND e.groupId = ?
        ORDER BY e.createdAt DESC
      `).all(req.user.filiereId, req.user.groupId);
    }
    
    const parsedExams = exams.map((e: any) => ({ 
      ...e, 
      questions: JSON.parse(e.questions),
      hasResults: e.resultsCount > 0
    }));
    cacheManager.set(cacheKey, parsedExams, 300);
    res.json(parsedExams);
  });

  app.post("/api/exams", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const { title, description, moduleId, type, durationMinutes, questions, scheduledAt } = req.body;
      
      console.log("Creating exam with data:", { title, moduleId, type, teacherId: req.user.id });

      // Basic validation
      if (!moduleId) return res.status(400).json({ error: "Le module est requis." });
      
      // Secondary check for FK (moduleId must exist)
      const module = db.prepare("SELECT id FROM modules WHERE id = ?").get(moduleId);
      if (!module) {
        console.error("Module not found:", moduleId);
        return res.status(400).json({ error: "Le module sélectionné n'existe plus." });
      }

      // Check teacher exists
      const teacher = db.prepare("SELECT id FROM users WHERE id = ?").get(req.user.id);
      if (!teacher) {
        console.error("Teacher not found:", req.user.id);
        return res.status(400).json({ error: "Utilisateur non trouvé." });
      }

      const stmt = db.prepare("INSERT INTO exams (title, description, moduleId, type, teacherId, durationMinutes, questions, scheduledAt, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')");
      const result = stmt.run(title, description, moduleId, type || 'controle-continu', req.user.id, durationMinutes, JSON.stringify(questions), scheduledAt);
      clearCache('exams');
      res.json({ id: Number(result.lastInsertRowid), title, description, moduleId, type: type || 'controle-continu', teacherId: req.user.id, durationMinutes, questions, scheduledAt, status: 'draft' });
    } catch (err: any) {
      console.error("Error creating exam:", err);
      if (err.message && err.message.includes("FOREIGN KEY")) {
        // Try to identify which FK failed
        res.status(400).json({ error: "Erreur d'intégrité : Assurez-vous que le module sélectionné est valide. (Erreur technique: FK constraint failed)" });
      } else {
        res.status(500).json({ error: `Erreur lors de la création: ${err.message}` });
      }
    }
  });

  app.post("/api/exams/:id/publish", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const id = parseInt(req.params.id, 10);
    const { groupId } = req.body;
    const teacherId = Number(req.user.id);
    
    console.log(`Publishing exam ${id} for group ${groupId} by teacher ${teacherId}`);

    if (!groupId) return res.status(400).json({ error: "Group ID is required" });

    try {
      const stmt = db.prepare("UPDATE exams SET status = 'active', groupId = ? WHERE id = ? AND teacherId = ?");
      const result = stmt.run(Number(groupId), Number(id), teacherId);
      console.log(`Update result:`, result);
      if (result.changes === 0) {
        const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(id) as any;
        console.log(`Exam check:`, exam);
        return res.status(404).json({ error: "Exam not found or unauthorized" });
      }

      // Create a notification for the group
      try {
        const exam = db.prepare("SELECT e.*, m.name as moduleName FROM exams e JOIN modules m ON e.moduleId = m.id WHERE e.id = ?").get(id) as any;
        const notifTitle = `Nouvel Examen: ${exam.title}`;
        const notifBody = `Un nouvel examen pour le module "${exam.moduleName}" a été publié pour votre groupe.`;
        const notifStmt = db.prepare("INSERT INTO notifications (title, content, teacherId, groupId, type) VALUES (?, ?, ?, ?, ?)");
        const notifResult = notifStmt.run(notifTitle, notifBody, teacherId, Number(groupId), 'exam');
        
        const notif = { 
          id: Number(notifResult.lastInsertRowid), 
          title: notifTitle, 
          content: notifBody, 
          teacherId, 
          groupId: Number(groupId), 
          type: 'exam', 
          createdAt: new Date().toISOString() 
        };
        
        // Target specific group and all teachers
        io.to(`group-${groupId}`).to('teachers').emit("notification", notif);
      } catch (notifErr) {
        console.error("Error creating auto-notification:", notifErr);
        // Don't fail the publishing even if notification fails
      }

      io.emit("data-update");
      clearCache('exams');
      res.json({ success: true, status: 'active', groupId: Number(groupId) });
    } catch (err: any) {
      console.error("Error publishing exam:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/exams/:id/unpublish", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const id = parseInt(req.params.id, 10);
    const teacherId = Number(req.user.id);

    console.log(`Unpublishing exam ${id} for teacher ${teacherId}`);

    try {
      const stmt = db.prepare("UPDATE exams SET status = 'draft', groupId = NULL WHERE id = ? AND teacherId = ?");
      const result = stmt.run(Number(id), teacherId);
      console.log(`Update result:`, result);
      if (result.changes === 0) {
        // Double check if exam exists at all or if teacherId is different
        const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(id) as any;
        console.log(`Exam check:`, exam);
        return res.status(404).json({ error: "Exam not found or unauthorized" });
      }
      io.emit("data-update");
      clearCache('exams');
      res.json({ success: true, status: 'draft' });
    } catch (err: any) {
      console.error("Error unpublishing exam:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/exams/:id/time-sync", authenticate, (req: any, res) => {
    const examId = Number(req.params.id);
    const userId = Number(req.user.id);
    const now = Date.now();

    try {
      // Find the exam to verify its existence
      const exam = db.prepare("SELECT durationMinutes FROM exams WHERE id = ?").get(examId) as any;
      if (!exam) {
        return res.status(404).json({ error: "Examen non trouvé." });
      }

      // Check if session exists in DB
      let session = db.prepare("SELECT startTime FROM exam_sessions WHERE userId = ? AND examId = ?").get(userId, examId) as any;
      if (!session) {
        // Create session on first request (this maps to "Commencer l'examen" or resuming/loading start)
        db.prepare("INSERT INTO exam_sessions (userId, examId, startTime) VALUES (?, ?, ?)").run(userId, examId, now);
        session = { startTime: now };
      }

      res.json({
        success: true,
        startTime: session.startTime,
        serverTime: now,
        durationMinutes: exam.durationMinutes
      });
    } catch (err: any) {
      console.error("Error syncing exam time with server:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/exams/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    
    try {
      const { title, description, moduleId, type, durationMinutes, questions, scheduledAt } = req.body;
      
      console.log(`Updating exam ${id} with data:`, { title, moduleId, type, teacherId: req.user.id });

      // Basic validation
      if (!moduleId) return res.status(400).json({ error: "Le module est requis." });

      // Check if results exist
      const resultsCount = db.prepare("SELECT COUNT(*) as count FROM results WHERE examId = ?").get(id) as any;
      if (resultsCount.count > 0) {
        return res.status(400).json({ error: "Impossible de modifier un examen qui a déjà des résultats." });
      }

      // Check if module exists
      const module = db.prepare("SELECT id FROM modules WHERE id = ?").get(moduleId);
      if (!module) {
        console.error("Module not found:", moduleId);
        return res.status(400).json({ error: "Le module sélectionné n'existe plus." });
      }

      // Check if teacher exists
      const teacher = db.prepare("SELECT id FROM users WHERE id = ?").get(req.user.id);
      if (!teacher) {
        console.error("Teacher not found:", req.user.id);
        return res.status(400).json({ error: "Utilisateur non trouvé." });
      }

      const stmt = db.prepare("UPDATE exams SET title = ?, description = ?, moduleId = ?, type = ?, durationMinutes = ?, questions = ?, scheduledAt = ? WHERE id = ? AND teacherId = ?");
      const result = stmt.run(title, description, moduleId, type || 'controle-continu', durationMinutes, JSON.stringify(questions), scheduledAt, id, req.user.id);
      
      if (result.changes === 0) return res.status(404).json({ error: "Examen non trouvé ou non autorisé." });
      clearCache('exams');
      res.json({ id: Number(id), title, description, moduleId, type, durationMinutes, questions, scheduledAt });
    } catch (err: any) {
      console.error("Error updating exam:", err);
      if (err.message && err.message.includes("FOREIGN KEY")) {
        res.status(400).json({ error: "Erreur d'intégrité : Assurez-vous que le module sélectionné est valide. (Erreur technique: FK constraint failed on update)" });
      } else {
        res.status(500).json({ error: `Erreur lors de la modification: ${err.message}` });
      }
    }
  });

  app.delete("/api/exams/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const examId = Number(id);

    console.log(`[DELETE] Request to delete exam ${examId} by user ${req.user.id}`);

    try {
      db.transaction(() => {
        // Anti-orphan logic: Delete all associated results first
        const resultsResult = db.prepare("DELETE FROM results WHERE examId = ?").run(examId);
        console.log(`[DELETE] Deleted ${resultsResult.changes} results for exam ${examId}`);

        // Cleanup word files from uploads if they exist (logic anti-orphelins)
        // Even if files are primarily client-side, we check the server 'uploads' folder 
        // to ensure no orphaned exports remain if a server-side cache is ever used.
        if (fs.existsSync("uploads")) {
          const files = fs.readdirSync("uploads");
          for (const file of files) {
            // Check for files matching exam_${id} pattern
            if (file.includes(`exam_${examId}`) && file.endsWith(".docx")) {
              try {
                fs.unlinkSync(path.join("uploads", file));
                console.log(`[DELETE] Deleted orphaned Word file: ${file}`);
              } catch (e) {
                console.warn(`[DELETE] Failed to delete file ${file}:`, e);
              }
            }
          }
        }

        const stmt = db.prepare("DELETE FROM exams WHERE id = ? AND teacherId = ?");
        const result = stmt.run(examId, req.user.id);
        console.log(`[DELETE] Exam delete result:`, result);
        
        if (result.changes === 0) {
          const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(examId) as any;
          if (!exam) {
            throw new Error("Examen non trouvé.");
          } else {
            throw new Error(`Vous n'êtes pas autorisé à supprimer cet examen.`);
          }
        }
      })();

      console.log(`[DELETE] Exam ${examId} and its associated data deleted successfully`);
      clearCache('exams');
      clearCache('results');
      res.json({ success: true });
    } catch (err: any) {
      console.error("[DELETE] Error deleting exam:", err);
      res.status(500).json({ error: err.message || "Erreur serveur lors de la suppression." });
    }
  });

  // --- Bulk Import Endpoints ---
  app.post("/api/admin/bulk-import-students", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { students } = req.body; // Array of { email, displayName, password, groupName, filiereId, groupId, registrationNumber }
    
    if (!Array.isArray(students)) return res.status(400).json({ error: "Students array is required" });

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    const insertStmt = db.prepare("INSERT INTO users (email, password, displayName, role, groupName, groupId, filiereId, registrationNumber) VALUES (?, ?, ?, 'student', ?, ?, ?, ?)");
    
    const transaction = db.transaction((studentList) => {
      for (const student of studentList) {
        try {
          const hashedPassword = bcrypt.hashSync(student.password || "Ofppt2024", 10);
          insertStmt.run(
            student.email, 
            hashedPassword, 
            student.displayName, 
            student.groupName || null, 
            student.groupId || null, 
            student.filiereId || null,
            student.registrationNumber || null
          );
          results.success++;
        } catch (e: any) {
          results.failed++;
          results.errors.push(`${student.email}: ${e.message}`);
        }
      }
    });

    try {
      transaction(students);
      clearCache('users');
      clearCache('groups');
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/results", authenticate, (req: any, res) => {
    const isTeacher = req.user.role === 'teacher';
    const cacheKey = isTeacher ? "results:list:teacher" : `results:list:student:${req.user.id}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    let results;
    if (isTeacher) {
      results = db.prepare(`
        SELECT r.*, u.displayName as studentName, u.email as studentEmail, u.groupName, u.filiere
        FROM results r 
        JOIN users u ON r.studentId = u.id 
        ORDER BY r.completedAt DESC
      `).all();
    } else {
      results = db.prepare(`
        SELECT r.*, u.displayName as studentName, u.email as studentEmail, u.groupName, u.filiere
        FROM results r 
        JOIN users u ON r.studentId = u.id 
        WHERE r.studentId = ? 
        ORDER BY r.completedAt DESC
      `).all(req.user.id);
    }
    const parsedResults = results.map((r: any) => ({ 
      ...r, 
      answers: JSON.parse(r.answers),
      questionResults: r.questionResults ? JSON.parse(r.questionResults) : null 
    }));
    cacheManager.set(cacheKey, parsedResults, 300);
    res.json(parsedResults);
  });

  app.get("/api/exams/:id/results", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    
    const cacheKey = `results:exam:${id}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const results = db.prepare(`
      SELECT r.*, u.displayName as studentName, u.email as studentEmail, u.groupName, u.filiere
      FROM results r 
      JOIN users u ON r.studentId = u.id 
      WHERE r.examId = ?
      ORDER BY r.completedAt DESC
    `).all(id);
    
    const parsedResults = results.map((r: any) => ({ 
      ...r, 
      answers: JSON.parse(r.answers),
      questionResults: r.questionResults ? JSON.parse(r.questionResults) : null 
    }));
    cacheManager.set(cacheKey, parsedResults, 300);
    res.json(parsedResults);
  });

  app.get("/api/students/count", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    
    const cacheKey = "users:student_count";
    const cachedCount = cacheManager.get(cacheKey);
    if (cachedCount !== null) {
      return res.json({ count: cachedCount });
    }

    const count = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get() as any;
    cacheManager.set(cacheKey, count.count, 300);
    res.json({ count: count.count });
  });

  app.get("/api/teacher/dashboard-stats", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden" });
    }

    const cacheKey = "results:dashboard_stats";
    const cachedStats = cacheManager.get(cacheKey);
    if (cachedStats) {
      return res.json(cachedStats);
    }

    try {
      const studentCountRow = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get() as any;
      const studentCount = studentCountRow ? studentCountRow.count : 0;

      const resultRows = db.prepare("SELECT score, totalPoints FROM results").all() as any[];
      const totalResults = resultRows.length;
      
      let avg = 0;
      let successCount = 0;
      
      if (totalResults > 0) {
        const totalPct = resultRows.reduce((sum, r) => {
          const ratio = r.score / (r.totalPoints || 1);
          if (ratio >= 0.5) successCount++;
          return sum + ratio;
        }, 0);
        avg = totalPct / totalResults;
      }

      const resultsSummary = {
        avg: Math.round(avg * 100),
        success: totalResults > 0 ? Math.round((successCount / totalResults) * 100) : 0,
        total: totalResults,
        studentCount: studentCount
      };

      cacheManager.set(cacheKey, resultsSummary, 300);
      res.json(resultsSummary);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/results", authenticate, async (req: any, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const { examId, answers } = req.body;
      if (!examId || !answers) {
        return res.status(400).json({ error: "Les champs examId et answers sont requis pour la notation." });
      }

      console.log(`[API] Evaluation et notation securisees sur le serveur pour l'etudiant ${req.user.id}, exam ${examId}.`);

      const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(examId) as any;
      if (!exam) {
        return res.status(404).json({ error: "Examen non trouvé." });
      }

      const questions = JSON.parse(exam.questions);
      const totalQuestions = questions.length;
      const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 1), 0);

      const normalizeStr = (s: string) => {
        if (!s) return '';
        return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
      };

      const stripHtml = (html: string) => {
        if (!html) return '';
        return html.replace(/<[^>]*>/g, '');
      };

      const questionResults = [];
      const ai = getAI();

      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        const ans = answers[idx];
        if (!q) {
          questionResults.push({ isCorrect: false, pointsEarned: 0 });
          continue;
        }

        const points = q.points || 1;
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
              if (idx > 0) await new Promise(resolve => setTimeout(resolve, 1000));
              const aiResponse = await ai.models.generateContent({
                model: "gemini-3-flash-preview",
                contents: `Évalue la réponse de l'étudiant par rapport à la réponse attendue pour la question donnée.
                Question : "${stripHtml(q.text)}"
                Réponse attendue : "${expectedAns}"
                Réponse de l'étudiant : "${studentAns}"
                
                Donne un score entre 0 et 1 (0 = faux, 1 = parfait, entre les deux pour une réponse partiellement correcte).
                Sois indulgent sur l'orthographe si le sens est correct.
                Répond uniquement avec le nombre (ex: 0.5 ou 1).`,
              });
              const scoreText = aiResponse.text?.trim() || '0';
              const scoreMultiplier = parseFloat(scoreText);
              const multiplier = isNaN(scoreMultiplier) ? 0 : Math.max(0, Math.min(1, scoreMultiplier));
              pointsEarned = multiplier * points;
              isCorrect = multiplier >= 0.8;
            } catch (e) {
              console.error("Evaluation IA backend echouee pour reponse courte:", e);
              isCorrect = normalizeStr(studentAnsPlainText) === normalizeStr(expectedAns);
              pointsEarned = isCorrect ? points : 0;
            }
          }
        } else if (q.type === 'fill-in-the-blanks') {
          const totalBlanks = (q.correctAnswers || []).length;
          if (totalBlanks > 0) {
            const correctCount = (q.correctAnswers || []).filter((ca: string, i: number) => normalizeStr(ans?.[i]?.toString() || '') === normalizeStr(ca)).length;
            pointsEarned = (correctCount / totalBlanks) * points;
            isCorrect = correctCount === totalBlanks;
          }
        } else if (q.type === 'ordering') {
          const totalItems = (q.correctOrder || []).length;
          if (totalItems > 0) {
            const correctPositions = (q.correctOrder || []).filter((correctIdx: number, i: number) => ans?.[i] === correctIdx).length;
            pointsEarned = (correctPositions / totalItems) * points;
            isCorrect = correctPositions === totalItems;
          }
        } else if (q.type === 'matching') {
          const totalMatches = (q.correctMatches || []).length;
          if (totalMatches > 0) {
            const correctMatchesCount = (q.correctMatches || []).filter((correctRightIdx: number, i: number) => ans?.[i] === correctRightIdx).length;
            pointsEarned = (correctMatchesCount / totalMatches) * points;
            isCorrect = correctMatchesCount === totalMatches;
          }
        } else {
          isCorrect = ans !== null && ans !== undefined && q.options?.[ans as number]?.isCorrect === true;
          pointsEarned = isCorrect ? points : 0;
        }

        questionResults.push({ isCorrect, pointsEarned });
      }

      const score = questionResults.reduce((sum, res) => sum + res.pointsEarned, 0);

      let aiFeedback = "";
      try {
        const resultsSummary = questionResults.map((res, i) => {
          const q = questions[i];
          return `- Question: "${stripHtml(q.text)}" | Résultat: ${res.pointsEarned}/${q.points || 1} | Type: ${q.type}`;
        }).join('\n');

        const feedbackResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Tu es un conseiller pédagogique expert. Analyse les résultats d'un étudiant à l'examen "${exam.title}" et fournis un feedback constructif, motivant et personnalisé.

Score final : ${score}/${totalPoints} (${Math.round((score / totalPoints) * 100)}%)

Détails des questions :
${resultsSummary}

Instructions pour le feedback :
1. Commence par une félicitation ou un encouragement global selon le score.
2. Identifie 2 à 3 points forts (sujets ou types de questions réussis).
3. Identifie 2 à 3 axes d'amélioration précis basés sur les erreurs.
4. Donne un conseil concret pour la suite.
5. Sois bienveillant mais professionnel.
6. Ne cite pas les numéros de questions, parle des sujets ou des concepts.
7. Langue : Français.
8. Format: Texte fluide avec des paragraphes, sans markdown complexe (pas de tableaux), utilise des puces si nécessaire.`,
        });
        aiFeedback = feedbackResponse.text?.trim() || "";
      } catch (aiErr) {
        console.error("Feedback AI backend echoue:", aiErr);
      }

      const stmt = db.prepare("INSERT INTO results (examId, studentId, score, totalQuestions, totalPoints, answers, questionResults, aiFeedback) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const result = stmt.run(examId, req.user.id, score, totalQuestions, totalPoints, JSON.stringify(answers), JSON.stringify(questionResults), aiFeedback);

      // Clean up exam session upon completion
      try {
        db.prepare("DELETE FROM exam_sessions WHERE userId = ? AND examId = ?").run(req.user.id, examId);
      } catch (sessErr) {
        console.error("Failed to delete exam session on results submit:", sessErr);
      }

      console.log(`[API] Server-side result securely grading saved with db id ${result.lastInsertRowid}`);
      clearCache('results');
      io.emit("data-update");
      res.json({ id: Number(result.lastInsertRowid), examId, studentId: req.user.id, score, totalQuestions, totalPoints, answers, questionResults, aiFeedback });
    } catch (err: any) {
      console.error("[API] Error saving secure results:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/notifications", authenticate, (req: any, res) => {
    let notifs;
    if (req.user.role === 'teacher') {
      notifs = db.prepare(`
        SELECT n.*, (SELECT 1 FROM user_notifications un WHERE un.notificationId = n.id AND un.userId = ?) as isRead 
        FROM notifications n 
        ORDER BY n.createdAt DESC
      `).all(req.user.id);
    } else {
      // Students see global notifications (groupId NULL) or those targeted to their group
      notifs = db.prepare(`
        SELECT n.*, (SELECT 1 FROM user_notifications un WHERE un.notificationId = n.id AND un.userId = ?) as isRead
        FROM notifications n 
        WHERE n.groupId IS NULL OR n.groupId = ? 
        ORDER BY n.createdAt DESC
      `).all(req.user.id, req.user.groupId);
    }
    res.json(notifs.map((n: any) => ({ ...n, read: !!n.isRead })));
  });

  app.post("/api/notifications/read-all", authenticate, (req: any, res) => {
    try {
      let notifs;
      if (req.user.role === 'teacher') {
        notifs = db.prepare("SELECT id FROM notifications").all();
      } else {
        notifs = db.prepare("SELECT id FROM notifications WHERE groupId IS NULL OR groupId = ?").all(req.user.groupId);
      }
      
      const stmt = db.prepare("INSERT OR IGNORE INTO user_notifications (userId, notificationId) VALUES (?, ?)");
      const transaction = db.transaction((items: any[]) => {
        for (const item of items) {
          stmt.run(req.user.id, item.id);
        }
      });
      transaction(notifs);
      
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error marking all notifications as read:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/:id/read", authenticate, (req: any, res) => {
    const { id } = req.params;
    try {
      db.prepare("INSERT OR IGNORE INTO user_notifications (userId, notificationId) VALUES (?, ?)").run(req.user.id, id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const { title, content, groupId, type } = req.body;
      const stmt = db.prepare("INSERT INTO notifications (title, content, teacherId, groupId, type) VALUES (?, ?, ?, ?, ?)");
      const result = stmt.run(title, content, req.user.id, groupId || null, type || 'announcement');
      const notif = { 
        id: Number(result.lastInsertRowid), 
        title, 
        content, 
        teacherId: req.user.id, 
        groupId: groupId || null,
        type: type || 'announcement',
        createdAt: new Date().toISOString() 
      };

      if (groupId) {
        io.to(`group-${groupId}`).to('teachers').emit("notification", notif);
      } else {
        io.emit("notification", notif);
      }
      
      res.json(notif);
    } catch (err: any) {
      console.error("Error creating notification:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/notifications/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM user_notifications WHERE notificationId = ?").run(id);
      db.prepare("DELETE FROM notifications WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Filières & Groups Routes ---
  app.get("/api/filieres", (req, res) => {
    const cacheKey = "filieres:list";
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const filieres = db.prepare("SELECT * FROM filieres ORDER BY name ASC").all();
    cacheManager.set(cacheKey, filieres, 300);
    res.json(filieres);
  });

  app.post("/api/filieres", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { code, name, description, niveau } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO filieres (code, name, description, niveau) VALUES (?, ?, ?, ?)");
      const result = stmt.run(code, name, description, niveau);
      clearCache('filieres');
      res.json({ id: Number(result.lastInsertRowid), code, name, description, niveau });
    } catch (err: any) {
      console.error("Error creating filiere:", err);
      if (err.message && err.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Ce code de filière existe déjà." });
      } else {
        res.status(500).json({ error: `Erreur lors de la création: ${err.message}` });
      }
    }
  });

  app.put("/api/filieres/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const { code, name, description, niveau } = req.body;
    try {
      const result = db.prepare("UPDATE filieres SET code = ?, name = ?, description = ?, niveau = ? WHERE id = ?").run(code, name, description, niveau, id);
      if (result.changes === 0) return res.status(404).json({ error: "Filière non trouvée." });
      clearCache('filieres');
      res.json({ id: Number(id), code, name, description, niveau });
    } catch (err: any) {
      console.error("Error updating filiere:", err);
      if (err.message && err.message.includes("UNIQUE constraint failed")) {
        res.status(400).json({ error: "Ce code de filière est déjà utilisé." });
      } else {
        res.status(500).json({ error: `Erreur lors de la modification: ${err.message}` });
      }
    }
  });

  app.delete("/api/filieres/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    
    // Check if groups or users exist
    const groupsCount = db.prepare("SELECT COUNT(*) as count FROM groups WHERE filiereId = ?").get(id) as any;
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE filiereId = ?").get(id) as any;
    
    if (groupsCount.count > 0 || usersCount.count > 0) {
      return res.status(400).json({ error: "Impossible de supprimer une filière qui contient des groupes ou des étudiants." });
    }

    db.prepare("DELETE FROM filieres WHERE id = ?").run(id);
    clearCache('filieres');
    res.json({ success: true });
  });

  app.get("/api/groups", (req, res) => {
    const cacheKey = "groups:list";
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const groups = db.prepare(`
      SELECT g.*, (SELECT COUNT(*) FROM users u WHERE u.groupId = g.id AND u.role = 'student') as studentCount
      FROM groups g 
      ORDER BY g.name ASC
    `).all();
    cacheManager.set(cacheKey, groups, 300);
    res.json(groups);
  });

  app.get("/api/groups/:id/students", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    
    const cacheKey = `groups:students:${id}`;
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const students = db.prepare("SELECT id, email, displayName, createdAt FROM users WHERE groupId = ? AND role = 'student' ORDER BY displayName ASC").all(id);
    cacheManager.set(cacheKey, students, 300);
    res.json(students);
  });

  app.post("/api/groups", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { name, filiereId } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO groups (name, filiereId) VALUES (?, ?)");
      const result = stmt.run(name, filiereId);
      clearCache('groups');
      res.json({ id: Number(result.lastInsertRowid), name, filiereId });
    } catch (err: any) {
      res.status(400).json({ error: "Ce groupe existe déjà dans cette filière." });
    }
  });

  app.put("/api/groups/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const { name, filiereId } = req.body;
    try {
      db.prepare("UPDATE groups SET name = ?, filiereId = ? WHERE id = ?").run(name, filiereId, id);
      clearCache('groups');
      res.json({ id: Number(id), name, filiereId });
    } catch (err: any) {
      res.status(400).json({ error: "Nom de groupe déjà utilisé dans cette filière." });
    }
  });

  app.delete("/api/groups/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    
    // Check if users exist
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE groupId = ?").get(id) as any;
    if (usersCount.count > 0) {
      return res.status(400).json({ error: "Impossible de supprimer un groupe qui contient des étudiants." });
    }

    const group = db.prepare("SELECT name FROM groups WHERE id = ?").get(id) as any;
    const groupName = group ? group.name : "Unknown";

    db.transaction(() => {
      // Unpublish exams linked to this group
      db.prepare("UPDATE exams SET status = 'draft', groupId = NULL WHERE groupId = ?").run(id);
      
      // Delete the group
      db.prepare("DELETE FROM groups WHERE id = ?").run(id);
    })();
    
    createLog(req.user.id, "DELETE_GROUP", `Suppression du groupe: ${groupName} (ID: ${id})`);
    clearCache('groups');
    clearCache('exams');
    res.json({ success: true });
  });

  // --- Settings Routes ---
  app.get("/api/settings", (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
      if (!settings) {
        return res.json({
          id: 1,
          orgName: 'OFPPT',
          orgSubName: 'DRBMKH',
          regionName: 'ROYAUME DU MAROC',
          academicYear: '2024/2025',
          orgLogoBgColor: '#059669',
          orgLogoTextColor: '#ffffff',
          headerLines: [],
          showHeaderLines: false
        });
      }
      res.json({
        ...settings,
        headerLines: settings.headerLines ? JSON.parse(settings.headerLines) : [],
        headerColumns: settings.headerColumns ? JSON.parse(settings.headerColumns) : null,
        footerColumns: settings.footerColumns ? JSON.parse(settings.footerColumns) : null,
        ccRules: settings.ccRules ? JSON.parse(settings.ccRules) : [],
        footerTable: settings.footerTable ? JSON.parse(settings.footerTable) : { rows: [['', '', ''], ['', '', '']] },
        footerFontSize: settings.footerFontSize,
        footerFontFamily: settings.footerFontFamily,
        watermarkText: settings.watermarkText,
        watermarkColor: settings.watermarkColor,
        watermarkOpacity: settings.watermarkOpacity,
        showFooter: !!settings.showFooter,
        showFooterText: !!settings.showFooterText,
        showFooterTable: !!settings.showFooterTable,
        showHeaderLines: !!settings.showHeaderLines,
        showFooterLines: !!settings.showFooterLines,
        showWatermark: !!settings.showWatermark,
        defaultExamSettings: settings.defaultExamSettings ? JSON.parse(settings.defaultExamSettings) : null,
        templates: settings.templates ? JSON.parse(settings.templates) : [],
      });
    } catch (err) {
      console.error("Error fetching settings:", err);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { 
      orgName, orgNameArabic, orgNameFrench, regionalDirection, institutionName, 
      orgSubName, orgLogoUrl, orgLogoUrlRight, footerText, footerTable, showFooter,
      footerFontSize, footerFontFamily, watermarkText, showWatermark, watermarkColor, watermarkOpacity,
      showFooterText, showFooterTable,
      regionName, academicYear, orgLogoBgColor, orgLogoTextColor, 
      headerLines, headerColumns, footerColumns, showHeaderLines, showFooterLines, ccRules, templates, defaultExamSettings
    } = req.body;
    try {
      db.prepare(`
        UPDATE settings 
        SET orgName = ?, orgNameArabic = ?, orgNameFrench = ?, regionalDirection = ?, 
            institutionName = ?, orgSubName = ?, orgLogoUrl = ?, orgLogoUrlRight = ?,
            footerText = ?, footerTable = ?, showFooter = ?,
            footerFontSize = ?, footerFontFamily = ?, watermarkText = ?, showWatermark = ?, watermarkColor = ?, watermarkOpacity = ?,
            showFooterText = ?, showFooterTable = ?,
            regionName = ?, academicYear = ?, orgLogoBgColor = ?, orgLogoTextColor = ?, 
            headerLines = ?, headerColumns = ?, footerColumns = ?, showHeaderLines = ?, showFooterLines = ?, ccRules = ?, templates = ?, defaultExamSettings = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(
        orgName, orgNameArabic, orgNameFrench, regionalDirection, institutionName, 
        orgSubName, orgLogoUrl, orgLogoUrlRight, footerText, JSON.stringify(footerTable), showFooter ? 1 : 0,
        footerFontSize, footerFontFamily, watermarkText, showWatermark ? 1 : 0, watermarkColor, watermarkOpacity,
        showFooterText ? 1 : 0, showFooterTable ? 1 : 0,
        regionName, academicYear, orgLogoBgColor, orgLogoTextColor, 
        JSON.stringify(headerLines), JSON.stringify(headerColumns), JSON.stringify(footerColumns), showHeaderLines ? 1 : 0, showFooterLines ? 1 : 0, 
        JSON.stringify(ccRules), JSON.stringify(templates), JSON.stringify(defaultExamSettings)
      );
      
      const updated = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
      res.json({
        ...updated,
        headerLines: updated.headerLines ? JSON.parse(updated.headerLines) : [],
        headerColumns: updated.headerColumns ? JSON.parse(updated.headerColumns) : null,
        footerColumns: updated.footerColumns ? JSON.parse(updated.footerColumns) : null,
        ccRules: updated.ccRules ? JSON.parse(updated.ccRules) : [],
        footerTable: updated.footerTable ? JSON.parse(updated.footerTable) : { rows: [['', '', ''], ['', '', '']] },
        showFooter: !!updated.showFooter,
        showFooterText: !!updated.showFooterText,
        showFooterTable: !!updated.showFooterTable,
        showHeaderLines: !!updated.showHeaderLines,
        showFooterLines: !!updated.showFooterLines,
        showWatermark: !!updated.showWatermark,
        templates: updated.templates ? JSON.parse(updated.templates) : [],
        defaultExamSettings: updated.defaultExamSettings ? JSON.parse(updated.defaultExamSettings) : null
      });
      createLog(req.user.id, "UPDATE_SETTINGS", "Modification des paramètres de l'organisation");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // --- Backup & Restore ---
  app.get("/api/admin/backup", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const backupPath = `backup-${Date.now()}.db`;
    try {
      await db.backup(backupPath);
      createLog(req.user.id, "EXPORT_DB", "Exportation de la base de données");
      res.download(backupPath, "eduqcm-backup.db", (err) => {
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      });
    } catch (err: any) {
      console.error("Backup error:", err);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  app.post("/api/admin/restore", authenticate, upload.single("file"), async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const tempPath = req.file.path;
      console.log(`Starting database restore with file: ${tempPath}`);
      
      // Close current connection
      db.close();
      console.log("Database connection closed.");
      
      // Anti-orphan logic: Cleanup all exported docx files in uploads before restore
      if (fs.existsSync("uploads")) {
        const files = fs.readdirSync("uploads");
        for (const file of files) {
          // Don't delete the current upload file!
          if (file !== req.file.filename && (file.endsWith(".docx") || file.includes("exam_"))) {
            try { 
              fs.unlinkSync(path.join("uploads", file)); 
              console.log(`[RESTORE] Deleted orphaned file during restore: ${file}`);
            } catch (e) {
              console.warn(`[RESTORE] Failed to delete file ${file}:`, e);
            }
          }
        }
      }
      
      // SQLite WAL files cleanup
      const walFile = "eduqcm.db-wal";
      const shmFile = "eduqcm.db-shm";
      if (fs.existsSync(walFile)) {
        try { fs.unlinkSync(walFile); console.log("Deleted WAL file."); } catch (e) { console.warn("Could not delete WAL file:", e); }
      }
      if (fs.existsSync(shmFile)) {
        try { fs.unlinkSync(shmFile); console.log("Deleted SHM file."); } catch (e) { console.warn("Could not delete SHM file:", e); }
      }
      
      // Replace file
      fs.copyFileSync(tempPath, "eduqcm.db");
      fs.unlinkSync(tempPath);
      console.log("Database file replaced successfully.");
      
      // Re-init connection
      db = new Database("eduqcm.db");
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      console.log("Database connection re-opened.");
      
      createLog(req.user.id, "RESTORE_DB", "Restauration de la base de données");
      res.json({ success: true, message: "Base de données restaurée avec succès. Veuillez rafraîchir la page." });
    } catch (err: any) {
      console.error("Restore error:", err);
      // Try to recover by re-opening the original database if possible
      try {
        db = new Database("eduqcm.db");
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
      } catch (recoverErr) {
        console.error("Failed to recover database connection:", recoverErr);
      }
      res.status(500).json({ error: "Échec de la restauration de la base de données: " + err.message });
    }
  });

  // --- Admin User Management ---
  app.get("/api/admin/users", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const cacheKey = "users:admin_list";
    const cachedData = cacheManager.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }
    
    try {
      const users = db.prepare(`
        SELECT u.id, u.email, u.displayName, u.role, u.groupName, u.filiere, u.groupId, u.filiereId, u.registrationNumber, u.createdAt,
               g.name as groupNameResolved, f.name as filiereNameResolved
        FROM users u
        LEFT JOIN groups g ON u.groupId = g.id
        LEFT JOIN filieres f ON u.filiereId = f.id
        ORDER BY u.role DESC, u.displayName ASC
      `).all();
      cacheManager.set(cacheKey, users, 300);
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/users", authenticate, async (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { email, password, displayName, role, groupId, filiereId, registrationNumber } = req.body;
    if (!email || !password || !displayName || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare(`
        INSERT INTO users (email, password, displayName, role, groupId, filiereId, registrationNumber)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(email, hashedPassword, displayName, role, groupId || null, filiereId || null, registrationNumber || null);
      clearCache('users');
      res.json({ success: true });
    } catch (err: any) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(400).json({ error: "Email already exists" });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/admin/users/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { id } = req.params;
    const { email, displayName, role, password, groupId, filiereId, registrationNumber } = req.body;

    try {
      let hashedPassword: string | null = null;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
      }

      db.transaction(() => {
        if (email) db.prepare("UPDATE users SET email = ? WHERE id = ?").run(email, id);
        if (displayName) db.prepare("UPDATE users SET displayName = ? WHERE id = ?").run(displayName, id);
        if (role) db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, id);
        if (groupId !== undefined) db.prepare("UPDATE users SET groupId = ? WHERE id = ?").run(groupId, id);
        if (filiereId !== undefined) db.prepare("UPDATE users SET filiereId = ? WHERE id = ?").run(filiereId, id);
        if (registrationNumber !== undefined) db.prepare("UPDATE users SET registrationNumber = ? WHERE id = ?").run(registrationNumber, id);
        
        if (hashedPassword) {
          db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashedPassword, id);
        }
      })();
      clearCache('users');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/users/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    const { id } = req.params;
    if (Number(id) === req.user.id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    try {
      const userToDelete = db.prepare("SELECT email, displayName FROM users WHERE id = ?").get(id) as any;

      // Logic anti-orphelins: Cleanup related data if user is a student
      db.transaction(() => {
        db.prepare("DELETE FROM results WHERE studentId = ?").run(id);
        db.prepare("DELETE FROM user_notifications WHERE userId = ?").run(id);
        db.prepare("DELETE FROM users WHERE id = ?").run(id);
      })();

      if (userToDelete) {
        createLog(req.user.id, "DELETE_USER", `Suppression de l'utilisateur: ${userToDelete.displayName} (${userToDelete.email})`);
      }
      clearCache('users');
      clearCache('results');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/logs", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
      return res.status(403).json({ error: "Forbidden" });
    }

    try {
      const logs = db.prepare(`
        SELECT l.*, u.displayName as userName, u.email as userEmail
        FROM audit_logs l
        JOIN users u ON l.userId = u.id
        ORDER BY l.createdAt DESC
        LIMIT 200
      `).all();
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Vite / Static ---
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0'
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
  process.exit(1);
});
