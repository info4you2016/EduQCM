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
import https from "https";
import AdmZip from "adm-zip";

const JWT_SECRET = process.env.JWT_SECRET || "eduqcm-secret-key";

// --- Local Assets Caching for Offline LAN setups ---
const OFPPT_LOGO_PATH = path.join("uploads", "ofppt-logo.png");
const AMIRI_FONT_PATH = path.join("uploads", "Amiri-Regular.ttf");

function cacheLocalAsset(url: string, dest: string, name: string) {
  if (fs.existsSync(dest)) {
    return;
  }
  
  const file = fs.createWriteStream(dest);
  const request = https.get(url, (response) => {
    if (response.statusCode === 200) {
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        console.log(`[Offline Mode] Successfully cached ${name} locally for intranet operations.`);
      });
    } else {
      file.close();
      fs.unlink(dest, () => {});
    }
  });

  request.on("error", (err) => {
    file.close();
    fs.unlink(dest, () => {});
    console.warn(`[Offline Mode] Failed to cache ${name} due to connection error (expected offline environment fallback):`, err.message);
  });
}

// Lazy asynchronous pre-caching after server start
setTimeout(() => {
  cacheLocalAsset("https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/OFPPT_Logo.svg/1200px-OFPPT_Logo.svg.png", OFPPT_LOGO_PATH, "OFPPT logo");
  cacheLocalAsset("https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf", AMIRI_FONT_PATH, "Amiri regular font");
}, 2500);

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

async function generateContentWithRetry(params: any, retries: number = 10, delay: number = 1000): Promise<any> {
  const ai = getAI();
  let attempt = 0;
  let currentModel = params.model || "gemini-3.5-flash";
  
  while (attempt < retries) {
    try {
      const currentParams = { ...params, model: currentModel };
      return await ai.models.generateContent(currentParams);
    } catch (err: any) {
      attempt++;
      
      const errStr = (err.message || "").toLowerCase();
      const isRateLimit = err.status === 429 || 
                          err.statusCode === 429 ||
                          (err.statusText && err.statusText.toLowerCase().includes("too many requests")) ||
                          errStr.includes("429") || 
                          errStr.includes("rate") || 
                          errStr.includes("exceeded") || 
                          errStr.includes("quota") || 
                          errStr.includes("limit") || 
                          errStr.includes("exhausted") ||
                          errStr.includes("resource") ||
                          errStr.includes("too many requests") ||
                          errStr.includes("dépassé");
                          
      if (isRateLimit) {
        console.warn(`[Gemini API] Rate Limit or Quota issue on attempt ${attempt}. Switching model if needed and applying backoff with jitter...`);
      } else {
        console.error(`[Gemini API] Error on attempt ${attempt}:`, err.message || err);
      }
      
      // If we failed with any issue and we are using gemini-3.5-flash, let's use the lite model on subsequent retries
      if (currentModel === "gemini-3.5-flash") {
        currentModel = "gemini-3.1-flash-lite";
      }
      
      // Wait for exponential backoff if there are retries left
      if (attempt < retries) {
        const baseDelay = isRateLimit ? 3000 : delay;
        // Exponential backoff capped at 15000ms plus a randomized jitter of 0 to 1500ms 
        // to prevent synchronized retries ("thundering herd" effect)
        const exponentialDelay = Math.min(15000, baseDelay * Math.pow(1.8, attempt - 1));
        const jitter = Math.random() * 1500;
        const totalDelay = exponentialDelay + jitter;
        
        console.log(`[Gemini API] Backing off for ${Math.round(totalDelay)}ms before attempt ${attempt + 1}...`);
        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      } else {
        throw err;
      }
    }
  }
}

// --- Local Offline AI handler (Ollama/LM Studio etc.) ---
async function generateWithOllama(ollamaUrl: string, model: string, prompt: string, configSchema: any) {
  const cleanUrl = ollamaUrl.endsWith('/') ? ollamaUrl.slice(0, -1) : ollamaUrl;
  const endpoint = `${cleanUrl}/api/chat`;
  
  const payload = {
    model: model,
    messages: [
      {
        role: "system",
        content: "Tu es un expert pédagogique. Réponds exclusivement avec un tableau d'objets ou un objet JSON valide représentant des questions d'examen ou résultats pédagogiques conformes au schéma demandé."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    format: "json",
    stream: false,
    options: {
      temperature: 0.7
    }
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Ollama local a retourné le code : ${response.status}`);
  }

  const result = await response.json() as any;
  const content = result.message?.content || result.response || "";
  return content;
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
      activeSessionId TEXT,
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
    )`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER NOT NULL,
      senderName TEXT NOT NULL,
      senderRole TEXT NOT NULL,
      content TEXT NOT NULL,
      channelType TEXT NOT NULL,
      groupId INTEGER,
      isEdited INTEGER DEFAULT 0,
      isPinned INTEGER DEFAULT 0,
      attachmentUrl TEXT,
      attachmentName TEXT,
      attachmentType TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(senderId) REFERENCES users(id)
    )`,
    `CREATE TABLE IF NOT EXISTS chat_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      messageId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      userName TEXT NOT NULL,
      emoji TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(messageId) REFERENCES chat_messages(id) ON DELETE CASCADE,
      UNIQUE(messageId, userId, emoji)
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
  try { db.exec("ALTER TABLE results ADD COLUMN integrityScore INTEGER DEFAULT 100"); } catch (e) {}
  try { db.exec("ALTER TABLE results ADD COLUMN tabExitCount INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE results ADD COLUMN fullscreenExitsCount INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE results ADD COLUMN auditTrail TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE users ADD COLUMN activeSessionId TEXT"); } catch (e) {}
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
  try { db.exec("ALTER TABLE settings ADD COLUMN localAiEnabled INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN localAiUrl TEXT DEFAULT 'http://localhost:11434'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN localAiModel TEXT DEFAULT 'llama3'"); } catch (e) {}

  // Migrations for Premium Chat Features
  try { db.exec("ALTER TABLE chat_messages ADD COLUMN isEdited INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE chat_messages ADD COLUMN isPinned INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE chat_messages ADD COLUMN attachmentUrl TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE chat_messages ADD COLUMN attachmentName TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE chat_messages ADD COLUMN attachmentType TEXT"); } catch (e) {}
  
  // Migrations for Scheduled Automatic Backups
  try { db.exec("ALTER TABLE settings ADD COLUMN autoBackupEnabled INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN autoBackupInterval TEXT DEFAULT 'daily'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN autoBackupCount INTEGER DEFAULT 5"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN autoBackupTime TEXT DEFAULT '02:00'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN autoBackupLastRun TEXT"); } catch (e) {}

  // Migrations for interactive and enriched announcements
  try { db.exec("ALTER TABLE notifications ADD COLUMN isPinned INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN importance TEXT DEFAULT 'normal'"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN attachmentUrl TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN attachmentName TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN filiereId INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN audienceRole TEXT DEFAULT 'all'"); } catch (e) {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_reactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notificationId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        reactionType TEXT NOT NULL,
        userDisplayName TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(notificationId, userId, reactionType),
        FOREIGN KEY(notificationId) REFERENCES notifications(id) ON DELETE CASCADE,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (e) {
    console.error("Notification reactions table failed:", e);
  }

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notification_comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notificationId INTEGER NOT NULL,
        userId INTEGER NOT NULL,
        userDisplayName TEXT NOT NULL,
        userRole TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(notificationId) REFERENCES notifications(id) ON DELETE CASCADE,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  } catch (e) {
    console.error("Notification comments table failed:", e);
  }

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

  // --- Online Users tracking ---
  const onlineUsers = new Map<number, {
    id: number;
    displayName: string;
    email: string;
    role: string;
    lastActive: number;
  }>();

  const updateOnlineUser = (user: any) => {
    if (user && user.id) {
      onlineUsers.set(user.id, {
        id: user.id,
        displayName: user.displayName || "Utilisateur sans nom",
        email: user.email || '',
        role: user.role || 'student',
        lastActive: Date.now()
      });
    }
  };

  const createLog = (userId: number, action: string, details: string) => {
    try {
      db.prepare("INSERT INTO audit_logs (userId, action, details) VALUES (?, ?, ?)").run(userId, action, details);
    } catch (e) {
      console.error("Failed to create audit log:", e);
    }
  };

  const auditLogger = (req: any, res: any, next: any) => {
    res.on('finish', () => {
      if (req.user && res.statusCode < 400) {
        let action = '';
        let details = '';
        const method = req.method;
        const url = req.originalUrl || req.url;

        // Skip logging audit endpoints to minimize clutter
        if (
          url.includes('/api/admin/logs') || 
          url.includes('/api/admin/online-users') || 
          url.includes('/api/admin/log-client-action')
        ) {
          return;
        }

        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          if (url.includes('/api/auth/login')) {
            action = 'CONNEXION';
            details = `Connexion réussie de l'utilisateur ${req.user.displayName}.`;
          } else if (url.includes('/api/auth/signup')) {
            action = 'INSCRIPTION';
            details = `Création de compte initial : ${req.body?.email || ''}`;
          } else if (url.includes('/api/auth/logout')) {
            action = 'DECONNEXION';
            details = 'Déconnexion.';
          } else if (url.includes('/api/exams') && method === 'POST') {
            action = 'CREATION_EXAMEN';
            details = `Création de l'évaluation "${req.body?.title || 'Sans titre'}".`;
          } else if (url.includes('/publish') && method === 'POST') {
            action = 'PUBLICATION_EXAMEN';
            details = `Mise en ligne de l'évaluation pour les étudiants.`;
          } else if (url.includes('/unpublish') && method === 'POST') {
            action = 'DEPUBLICATION_EXAMEN';
            details = `Désactivation de l'accès public à l'évaluation.`;
          } else if (url.includes('/api/results') && method === 'POST') {
            action = 'SOUMISSION_EXAMEN';
            details = `L'étudiant a finalisé et soumis sa copie d'évaluation.`;
          } else if (url.includes('/api/modules') && method === 'POST') {
            action = 'CREATION_MODULE';
            details = `Création d'un module d'apprentissage : ${req.body?.name || ''}`;
          } else if (url.includes('/api/admin/bulk-import-students')) {
            action = 'IMPORT_ETUDIANTS';
            details = `Importation en masse de profils d'étudiants.`;
          } else if (url.includes('/api/admin/db-vacuum')) {
            action = 'OPTIMISATIONS_BD';
            details = `Compactage de la base de données (VACUUM).`;
          } else if (url.includes('/api/admin/users') && method === 'POST') {
            action = 'CREATION_UTILISATEUR';
            details = `Ajout d'un nouvel utilisateur : ${req.body?.email || ''}`;
          } else if (url.includes('/api/admin/users') && method === 'DELETE') {
            action = 'SUPPRESSION_UTILISATEUR';
            details = `Suppression d'un compte utilisateur.`;
          } else if (url.includes('/api/settings') && method === 'PUT') {
            action = 'EDITION_PARAMETRES';
            details = `Changement de la configuration globale de l'école.`;
          } else {
            action = `${method}_SYSTEME`;
            details = `Action effectuée sur l'URL : ${url}`;
          }

          if (action) {
            createLog(req.user.id, action, details);
          }
        }
      }
    });
    next();
  };

  app.use(auditLogger);

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
        res.clearCookie("token", { httpOnly: true, secure: true, sameSite: 'none' });
        return res.status(401).json({ error: "User no longer exists" });
      }

      // Check for dual concurrent session for students
      if (user.role === 'student' && user.activeSessionId && decoded.sessionId !== user.activeSessionId) {
        res.clearCookie("token", { httpOnly: true, secure: true, sameSite: 'none' });
        return res.status(401).json({ error: "DUAL_SESSION" });
      }
      
      const { password: _, groupNameResolved, filiereNameResolved, ...userWithoutPassword } = user;
      req.user = { 
        ...userWithoutPassword, 
        id: Number(userWithoutPassword.id),
        groupName: groupNameResolved || userWithoutPassword.groupName,
        filiere: filiereNameResolved || userWithoutPassword.filiere,
        activeSessionId: user.activeSessionId
      };
      
      // Track that this user is online and active
      updateOnlineUser(req.user);

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
      
      // Join general room for public announcements & general chat
      socket.join('general');

      // Join group room if student
      if (userData.role === 'student' && userData.groupId) {
        socket.join(`group-${userData.groupId}`);
      }
      
      // Join teachers room if teacher or admin
      if (userData.role === 'teacher' || userData.role === 'admin') {
        socket.join('teachers');
      }
      
      // Join individual user room for private notifs if needed
      socket.join(`user-${userData.id}`);
    });

    // --- REALTIME CHAT SYSTEM HANDLERS ---
    socket.on("chat:message:send", (msgData: { 
      channelType: string; 
      groupId?: number; 
      content: string; 
      senderId: number; 
      senderName: string; 
      senderRole: string;
      attachmentUrl?: string;
      attachmentName?: string;
      attachmentType?: string;
    }) => {
      if (!msgData || (!msgData.content && !msgData.attachmentUrl) || !msgData.senderId) return;

      try {
        const stmt = db.prepare(`
          INSERT INTO chat_messages (senderId, senderName, senderRole, content, channelType, groupId, attachmentUrl, attachmentName, attachmentType)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
          msgData.senderId,
          msgData.senderName,
          msgData.senderRole,
          msgData.content || "",
          msgData.channelType,
          msgData.groupId || null,
          msgData.attachmentUrl || null,
          msgData.attachmentName || null,
          msgData.attachmentType || null
        );

        const createdMessage = {
          id: result.lastInsertRowid,
          senderId: msgData.senderId,
          senderName: msgData.senderName,
          senderRole: msgData.senderRole,
          content: msgData.content || "",
          channelType: msgData.channelType,
          groupId: msgData.groupId || null,
          isEdited: 0,
          isPinned: 0,
          attachmentUrl: msgData.attachmentUrl || null,
          attachmentName: msgData.attachmentName || null,
          attachmentType: msgData.attachmentType || null,
          createdAt: new Date().toISOString(),
          reactions: []
        };

        // Determine target room
        let targetRoom = 'general';
        if (msgData.channelType === 'teachers') {
          targetRoom = 'teachers';
        } else if (msgData.channelType === 'group' && msgData.groupId) {
          targetRoom = `group-${msgData.groupId}`;
        }

        // Broadcast to clients subscribed to target room
        io.to(targetRoom).emit("chat:message:received", createdMessage);
      } catch (e) {
        console.error("Failed to write & broadcast real-time chat message:", e);
      }
    });

    socket.on("chat:message:edit", (data: { id: number; content: string; channelType: string; groupId?: number; userId: number }) => {
      if (!data || !data.id || !data.content) return;
      try {
        const currentMsg = db.prepare("SELECT senderId FROM chat_messages WHERE id = ?").get(data.id) as any;
        if (!currentMsg || currentMsg.senderId !== data.userId) return;

        db.prepare("UPDATE chat_messages SET content = ?, isEdited = 1 WHERE id = ?").run(data.content, data.id);

        let targetRoom = 'general';
        if (data.channelType === 'teachers') {
          targetRoom = 'teachers';
        } else if (data.channelType === 'group' && data.groupId) {
          targetRoom = `group-${data.groupId}`;
        }

        io.to(targetRoom).emit("chat:message:edited", {
          id: data.id,
          content: data.content,
          isEdited: 1
        });
      } catch (err) {
        console.error("Failed to edit chat message:", err);
      }
    });

    socket.on("chat:message:delete", (data: { id: number; channelType: string; groupId?: number; userId: number; userRole: string }) => {
      if (!data || !data.id) return;
      try {
        const currentMsg = db.prepare("SELECT senderId FROM chat_messages WHERE id = ?").get(data.id) as any;
        if (!currentMsg) return;

        const canDelete = currentMsg.senderId === data.userId || data.userRole === 'teacher' || data.userRole === 'admin';
        if (!canDelete) return;

        db.prepare("DELETE FROM chat_messages WHERE id = ?").run(data.id);

        let targetRoom = 'general';
        if (data.channelType === 'teachers') {
          targetRoom = 'teachers';
        } else if (data.channelType === 'group' && data.groupId) {
          targetRoom = `group-${data.groupId}`;
        }

        io.to(targetRoom).emit("chat:message:deleted", { id: data.id });
      } catch (err) {
        console.error("Failed to delete chat message:", err);
      }
    });

    socket.on("chat:message:pin", (data: { id: number; isPinned: boolean; channelType: string; groupId?: number; userRole: string }) => {
      if (!data || !data.id) return;
      try {
        if (data.userRole !== 'teacher' && data.userRole !== 'admin') return;

        db.prepare("UPDATE chat_messages SET isPinned = ? WHERE id = ?").run(data.isPinned ? 1 : 0, data.id);

        let targetRoom = 'general';
        if (data.channelType === 'teachers') {
          targetRoom = 'teachers';
        } else if (data.channelType === 'group' && data.groupId) {
          targetRoom = `group-${data.groupId}`;
        }

        io.to(targetRoom).emit("chat:message:pinned:updated", {
          id: data.id,
          isPinned: data.isPinned ? 1 : 0
        });
      } catch (err) {
        console.error("Failed to pin/unpin message:", err);
      }
    });

    socket.on("chat:join-group", (data: { groupId: number }) => {
      if (!data || !data.groupId) return;
      socket.join(`group-${data.groupId}`);
    });

    socket.on("chat:typing:status", (data: { channelType: string; groupId?: number; isTyping: boolean; userId: number; userName: string }) => {
      if (!data) return;
      let targetRoom = 'general';
      if (data.channelType === 'teachers') {
        targetRoom = 'teachers';
      } else if (data.channelType === 'group' && data.groupId) {
        targetRoom = `group-${data.groupId}`;
      }
      
      // Broadcast who is typing to everyone else in this room
      socket.to(targetRoom).emit("chat:typing:update", {
        channelType: data.channelType,
        groupId: data.groupId,
        isTyping: data.isTyping,
        userId: data.userId,
        userName: data.userName
      });
    });

    socket.on("chat:reaction:toggle", (data: { messageId: number; channelType: string; groupId?: number; emoji: string; userId: number; userName: string }) => {
      if (!data || !data.messageId || !data.emoji || !data.userId) return;
      
      try {
        // Check if user already put this emoji on this message
        const existing = db.prepare("SELECT id FROM chat_reactions WHERE messageId = ? AND userId = ? AND emoji = ?")
          .get(data.messageId, data.userId, data.emoji) as any;
          
        if (existing) {
          db.prepare("DELETE FROM chat_reactions WHERE id = ?").run(existing.id);
        } else {
          db.prepare("INSERT OR IGNORE INTO chat_reactions (messageId, userId, userName, emoji) VALUES (?, ?, ?, ?)")
            .run(data.messageId, data.userId, data.userName, data.emoji);
        }
        
        // Fetch all present reactions for this message to broadcast unified state
        const updatedReactions = db.prepare("SELECT * FROM chat_reactions WHERE messageId = ?").all(data.messageId);
        
        let targetRoom = 'general';
        if (data.channelType === 'teachers') {
          targetRoom = 'teachers';
        } else if (data.channelType === 'group' && data.groupId) {
          targetRoom = `group-${data.groupId}`;
        }
        
        io.to(targetRoom).emit("chat:reaction:updated", {
          messageId: data.messageId,
          reactions: updatedReactions
        });
      } catch (err) {
        console.error("Failed to toggle real-time chat reaction:", err);
      }
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

  // --- Local Offline Assets Routes ---
  app.get("/api/fonts/Amiri-Regular.ttf", (req, res) => {
    if (fs.existsSync(AMIRI_FONT_PATH)) {
      return res.sendFile(path.resolve(AMIRI_FONT_PATH));
    }
    res.status(404).send("Le fichier de police n'est pas encore mis en cache. Veuillez connecter le serveur à Internet ponctuellement ou le configurer.");
  });

  app.get("/api/assets/default-logo.png", (req, res) => {
    if (fs.existsSync(OFPPT_LOGO_PATH)) {
      res.setHeader("Content-Type", "image/png");
      return res.sendFile(path.resolve(OFPPT_LOGO_PATH));
    }
    // Fallback offline SVG layout
    res.setHeader("Content-Type", "image/svg+xml");
    res.send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <rect width="100" height="100" rx="20" fill="#059669"/>
      <circle cx="50" cy="45" r="20" fill="none" stroke="white" stroke-width="8"/>
      <path d="M35 70 L50 45 L65 70 Z" fill="white"/>
      <text x="50" y="85" text-anchor="middle" fill="white" font-family="sans-serif" font-weight="extrabold" font-size="12">OFPPT</text>
    </svg>`);
  });

  // --- AI Routes ---
  app.post("/api/ai/generate-questions", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    
    try {
      const settings = db.prepare("SELECT localAiEnabled, localAiUrl, localAiModel FROM settings WHERE id = 1").get() as any;
      if (settings && settings.localAiEnabled) {
        const localAiUrl = settings.localAiUrl || 'http://localhost:11434';
        const localAiModel = settings.localAiModel || 'llama3';
        console.log(`[Offline Local AI] Directing generate-questions to Ollama model ${localAiModel} on ${localAiUrl}`);
        const text = await generateWithOllama(localAiUrl, localAiModel, req.body.prompt, req.body.config);
        return res.json({ text });
      }

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: req.body.prompt,
        config: req.body.config
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Error:", err);
      const isNetwork = err.message?.includes("ENOTFOUND") || err.message?.includes("fetch failed") || !process.env.GEMINI_API_KEY;
      if (isNetwork) {
        res.status(503).json({ 
          error: "Ce serveur n'est pas connecté à Internet ou la clé API Gemini est absente. " +
                 "Pour utiliser l'intelligence artificielle hors-ligne à 100%, " +
                 "veuillez configurer un serveur d'IA local (Ollama / LocalAI) dans l'onglet 'Extra' des paramètres de l'organisation." 
        });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/ai/refine-question", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { question } = req.body;

    try {
      const settings = db.prepare("SELECT localAiEnabled, localAiUrl, localAiModel FROM settings WHERE id = 1").get() as any;
      if (settings && settings.localAiEnabled) {
        const localAiUrl = settings.localAiUrl || 'http://localhost:11434';
        const localAiModel = settings.localAiModel || 'llama3';
        const prompt = `Améliore cette question d'examen pour la rendre plus claire, professionnelle et sans ambiguïté.
Conserve le même type de question et le même sens, mais améliore le style et la structure.

Question actuelle: ${JSON.stringify(question)}

Répond uniquement avec l'objet JSON de la question mise à jour.`;
        const text = await generateWithOllama(localAiUrl, localAiModel, prompt, { responseMimeType: "application/json" });
        return res.json({ text });
      }

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
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
      const isNetwork = err.message?.includes("ENOTFOUND") || err.message?.includes("fetch failed") || !process.env.GEMINI_API_KEY;
      if (isNetwork) {
        res.status(503).json({ 
          error: "Serveur hors-ligne. Veuillez activer l'IA locale (Ollama / LocalAI) dans l'onglet 'Extra' des paramètres."
        });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/ai/evaluate-short-answer", authenticate, async (req: any, res) => {
    const { question, expectedAnswer, studentAnswer } = req.body;
    try {
      const settings = db.prepare("SELECT localAiEnabled, localAiUrl, localAiModel FROM settings WHERE id = 1").get() as any;
      if (settings && settings.localAiEnabled) {
        const localAiUrl = settings.localAiUrl || 'http://localhost:11434';
        const localAiModel = settings.localAiModel || 'llama3';
        const prompt = `Évalue la réponse de l'étudiant par rapport à la réponse attendue pour la question donnée.
Question : "${question}"
Réponse attendue : "${expectedAnswer}"
Réponse de l'étudiant : "${studentAnswer}"

Donne un score entre 0 et 1 (0 = faux, 1 = parfait, entre les deux pour une réponse partiellement correcte).
Répond exclusivement sous ce format JSON : {"score": 0.8}`;
        const text = await generateWithOllama(localAiUrl, localAiModel, prompt, { responseMimeType: "application/json" });
        return res.json({ text });
      }

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
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
      const isNetwork = err.message?.includes("ENOTFOUND") || err.message?.includes("fetch failed") || !process.env.GEMINI_API_KEY;
      if (isNetwork) {
        res.status(503).json({ 
          error: "Serveur hors-ligne. Veuillez activer l'IA locale (Ollama / LocalAI) dans l'onglet 'Extra' des paramètres."
        });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/ai/analyze-results", authenticate, async (req: any, res) => {
    const { examTitle, totalScore, totalPoints, resultsSummary } = req.body;
    try {
      const settings = db.prepare("SELECT localAiEnabled, localAiUrl, localAiModel FROM settings WHERE id = 1").get() as any;
      if (settings && settings.localAiEnabled) {
        const localAiUrl = settings.localAiUrl || 'http://localhost:11434';
        const localAiModel = settings.localAiModel || 'llama3';
        const prompt = `Tu es un conseiller pédagogique expert. Analyse les résultats d'un étudiant à l'examen "${examTitle}" et fournis un feedback constructif, motivant et personnalisé.
Score final : ${totalScore}/${totalPoints} (${Math.round((totalScore / totalPoints) * 100)}%)
Détails des questions :
${resultsSummary}
Rend un commentaire d'évaluation en français structuré sous format JSON : {"text": "..."}`;
        const text = await generateWithOllama(localAiUrl, localAiModel, prompt, { responseMimeType: "application/json" });
        return res.json({ text });
      }

      const response = await generateContentWithRetry({
        model: "gemini-3.5-flash",
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
      const isNetwork = err.message?.includes("ENOTFOUND") || err.message?.includes("fetch failed") || !process.env.GEMINI_API_KEY;
      if (isNetwork) {
        res.status(503).json({ 
          error: "Serveur hors-ligne. Veuillez activer l'IA locale (Ollama / LocalAI) dans l'onglet 'Extra' des paramètres."
        });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  app.post("/api/ai/generic", authenticate, async (req: any, res) => {
    const { prompt, model, config } = req.body;
    try {
      const settings = db.prepare("SELECT localAiEnabled, localAiUrl, localAiModel FROM settings WHERE id = 1").get() as any;
      if (settings && settings.localAiEnabled) {
        const localAiUrl = settings.localAiUrl || 'http://localhost:11434';
        const localAiModel = settings.localAiModel || 'llama3';
        const text = await generateWithOllama(localAiUrl, localAiModel, prompt, config);
        return res.json({ text });
      }

      const response = await generateContentWithRetry({
        model: model || "gemini-3.5-flash",
        contents: prompt,
        config: config
      });
      res.json({ text: response.text });
    } catch (err: any) {
      console.error("AI Error:", err);
      const isNetwork = err.message?.includes("ENOTFOUND") || err.message?.includes("fetch failed") || !process.env.GEMINI_API_KEY;
      if (isNetwork) {
        res.status(503).json({ 
          error: "Serveur hors-ligne. Veuillez activer l'IA locale (Ollama / LocalAI) dans l'onglet 'Extra' des paramètres."
        });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // --- Auth Routes ---
  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, displayName, role, groupName, filiere, groupId, filiereId } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (email, password, displayName, role, groupName, filiere, groupId, filiereId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const result = stmt.run(email, hashedPassword, displayName, role, groupName || null, filiere || null, groupId || null, filiereId || null);
      
      const userId = Number(result.lastInsertRowid);
      let sessionId = null;
      if (role === 'student') {
        sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        db.prepare("UPDATE users SET activeSessionId = ? WHERE id = ?").run(sessionId, userId);
      }
      
      const user = { id: userId, email, displayName, role, groupName, filiere, groupId, filiereId, sessionId };
      const token = jwt.sign(user, JWT_SECRET);
      
      createLog(userId, "INSCRIPTION", `Nouvelle inscription : ${displayName} (${role}).`);
      updateOnlineUser(user);

      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
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
    
    let sessionId = null;
    if (user.role === 'student') {
      sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      db.prepare("UPDATE users SET activeSessionId = ? WHERE id = ?").run(sessionId, user.id);
    }

    const userData = { 
      ...userWithoutPassword, 
      id: Number(userWithoutPassword.id),
      groupName: groupNameResolved || userWithoutPassword.groupName,
      filiere: filiereNameResolved || userWithoutPassword.filiere,
      sessionId
    };
    
    const token = jwt.sign(userData, JWT_SECRET);
    
    createLog(userData.id, "CONNEXION", `Connexion réussie : ${userData.displayName} (${userData.role}).`);
    updateOnlineUser(userData);

    res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
    res.json({ user: userData });
  });

  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies.token;
    if (token) {
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        createLog(decoded.id, "DECONNEXION", "Déconnexion de la plateforme.");
        // Remove from online users immediately
        onlineUsers.delete(decoded.id);
      } catch (err) {}
    }
    res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "none" });
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
        res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "none" });
        return res.json({ user: null });
      }

      // Check for dual session for student
      if (user.role === 'student' && user.activeSessionId && decoded.sessionId !== user.activeSessionId) {
        res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "none" });
        return res.status(401).json({ error: "DUAL_SESSION" });
      }
      
      const { password: _, groupNameResolved, filiereNameResolved, ...userWithoutPassword } = user;
      const userData = { 
        ...userWithoutPassword, 
        id: Number(userWithoutPassword.id),
        groupName: groupNameResolved || userWithoutPassword.groupName,
        filiere: filiereNameResolved || userWithoutPassword.filiere,
        sessionId: decoded.sessionId
      };
      
      res.json({ user: userData });
    } catch (err) {
      console.error("JWT Auth error:", err);
      res.clearCookie("token", { httpOnly: true, secure: true, sameSite: "none" });
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
        filiere: filiereNameResolved || userWithoutPassword.filiere,
        sessionId: req.user.activeSessionId
      };
      
      const token = jwt.sign(userData, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
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
      // Students see modules assigned to their filiere OR general modules (filiereId IS NULL)
      modules = db.prepare(`
        SELECT m.*, (SELECT COUNT(*) FROM exams e WHERE e.moduleId = m.id) as examsCount
        FROM modules m 
        WHERE m.filiereId = ? OR m.filiereId IS NULL
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
               g.name as groupName, m.name as moduleName
        FROM exams e 
        LEFT JOIN groups g ON e.groupId = g.id
        LEFT JOIN modules m ON e.moduleId = m.id
        WHERE e.teacherId = ?
        ORDER BY e.createdAt DESC
      `).all(req.user.id);
    } else {
      // Students see active exams for their assigned group, including modules that are specific to filiere OR common (null filiereId)
      exams = db.prepare(`
        SELECT e.*, (SELECT COUNT(*) FROM results r WHERE r.examId = e.id) as resultsCount,
               m.name as moduleName, es.startTime as sessionStartTime
        FROM exams e 
        JOIN modules m ON e.moduleId = m.id
        LEFT JOIN exam_sessions es ON es.examId = e.id AND es.userId = ?
        WHERE (m.filiereId = ? OR m.filiereId IS NULL) AND e.status = 'active' AND e.groupId = ?
        ORDER BY e.createdAt DESC
      `).all(req.user.id, req.user.filiereId, req.user.groupId);
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
        clearCache('exams'); // Invalidate student-level exams list cache to reflect the ongoing session
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
      questionResults: r.questionResults ? JSON.parse(r.questionResults) : null,
      auditTrail: r.auditTrail ? (r.auditTrail.startsWith('[') || r.auditTrail.startsWith('{') ? JSON.parse(r.auditTrail) : []) : []
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
      questionResults: r.questionResults ? JSON.parse(r.questionResults) : null,
      auditTrail: r.auditTrail ? (r.auditTrail.startsWith('[') || r.auditTrail.startsWith('{') ? JSON.parse(r.auditTrail) : []) : []
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
      const { examId, answers, integrityScore, tabExitCount, fullscreenExitsCount, auditTrail } = req.body;
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

      // Batch evaluate short-answer questions to prevent API rate limits and speed up submission
      const pendingShortAnswers: any[] = [];
      const evaluatedScores = new Map<number, number>();

      for (let idx = 0; idx < questions.length; idx++) {
        const q = questions[idx];
        if (!q) continue;
        const ans = answers[idx];
        if (q.type === 'short-answer') {
          const studentAns = ans?.toString().trim() || '';
          const studentAnsPlainText = stripHtml(studentAns);
          const expectedAns = stripHtml(q.correctAnswer || '').trim();
          
          if (normalizeStr(studentAnsPlainText) !== normalizeStr(expectedAns) && studentAnsPlainText && expectedAns) {
            pendingShortAnswers.push({
              idx,
              questionText: stripHtml(q.text || ''),
              expectedAnswer: expectedAns,
              studentAnswer: studentAns
            });
          }
        }
      }

      if (pendingShortAnswers.length > 0) {
        try {
          console.log(`[API] Deferring ${pendingShortAnswers.length} short-answer questions for batch AI grading.`);
          let prompt = "Évalue ces réponses d'étudiants par rapport aux réponses attendues pour chaque question d'examen.\n";
          prompt += "Donne pour chaque question un score de validation entre 0 et 1 (0 = faux, 1 = parfait, entre les deux pour une réponse partiellement correcte).\n";
          prompt += "Sois indulgent sur l'orthographe ou de légères fautes de frappe si le sens général est correct.\n\n";
          prompt += "Liste des réponses à évaluer :\n";
          
          pendingShortAnswers.forEach((item, index) => {
            prompt += `--- Question ${index + 1} (ID unique: ${item.idx}) ---\n`;
            prompt += `Question : "${item.questionText}"\n`;
            prompt += `Réponse attendue : "${item.expectedAnswer}"\n`;
            prompt += `Réponse de l'étudiant : "${item.studentAnswer}"\n\n`;
          });
          
          prompt += "Réponds impérativement au format JSON strict avec un tableau d'objets, chaque objet contenant 'idx' (le nombre ID unique correspondant) et 'score' (un nombre ou flotant entre 0 et 1).\n";
          prompt += "Format attendu :\n";
          prompt += "[\n";
          prompt += "  { \"idx\": 2, \"score\": 0.8 },\n";
          prompt += "  { \"idx\": 5, \"score\": 0.0 }\n";
          prompt += "]\n";
          prompt += "Ne mets aucun texte en dehors du format JSON.";

          const aiResponse = await generateContentWithRetry({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              responseMimeType: "application/json"
            }
          });
          
          const responseText = aiResponse.text?.trim() || "[]";
          const scoresArray = JSON.parse(responseText);
          if (Array.isArray(scoresArray)) {
            scoresArray.forEach((item: any) => {
              if (item && typeof item.idx === 'number' && typeof item.score === 'number') {
                evaluatedScores.set(item.idx, Math.max(0, Math.min(1, item.score)));
              }
            });
          }
        } catch (err) {
          console.error("[API] Error during batch AI evaluation, will fallback to individual question requests:", err);
        }
      }

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
            if (evaluatedScores.has(idx)) {
              const multiplier = evaluatedScores.get(idx)!;
              pointsEarned = multiplier * points;
              isCorrect = multiplier >= 0.8;
            } else {
              try {
                if (idx > 0) await new Promise(resolve => setTimeout(resolve, 1000));
                const aiResponse = await generateContentWithRetry({
                  model: "gemini-3.5-flash",
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

        const feedbackResponse = await generateContentWithRetry({
          model: "gemini-3.5-flash",
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
        // Fallback pedagogical feedback if Gemini services are congested/unreachable
        const pct = Math.round((score / totalPoints) * 100);
        let feedbackIntro = "";
        let feedbackPositives = "";
        let feedbackImprovements = "";
        let feedbackNext = "";

        if (pct >= 85) {
          feedbackIntro = "Félicitations pour cet excellent résultat ! Vous avez démontré une maîtrise remarquable des sujets abordés dans cet examen.";
          feedbackPositives = "- Excellente compréhension globale de la matière.\n- Bonne précision sur l'ensemble des questions.";
          feedbackImprovements = "- Continuez à maintenir ce niveau d'excellence.\n- Prêtez attention aux détails subtils pour atteindre la perfection.";
          feedbackNext = "Continuez ainsi, vous êtes sur la excellente voie !";
        } else if (pct >= 60) {
          feedbackIntro = "Bon travail ! C'est un résultat satisfaisant qui démontre une bonne assimilation générale des notions essentielles.";
          feedbackPositives = "- Solide compréhension des bases du cours.\n- Capacité à répondre correctement à la majorité des questions.";
          feedbackImprovements = "- Révision nécessaire sur certaines questions spécifiques non validées.\n- Consolidation des concepts intermédiaires pour améliorer le score.";
          feedbackNext = "Un effort ciblé sur vos erreurs vous permettra d'atteindre le niveau supérieur très rapidement.";
        } else {
          feedbackIntro = "Ne vous découragez pas ! Ce résultat montre que certains concepts clés nécessitent d'être revus et consolidés.";
          feedbackPositives = "- Volonté visible de compléter l'intégralité du test.\n- Quelques questions bien maîtrisées qui prouvent votre potentiel.";
          feedbackImprovements = "- Reprendre le cours théorique pour mieux assimiler les bases.\n- S'exercer de manière répétée sur les types d'exercices échoués.";
          feedbackNext = "Rapprochez-vous de votre formateur pour éclaircir les zones d'ombre. Avec du travail régulier, vous progressez !";
        }

        aiFeedback = `${feedbackIntro}\n\n**Points forts :**\n${feedbackPositives}\n\n**Axes d'amélioration :**\n${feedbackImprovements}\n\n**Conseil pour la suite :**\n${feedbackNext}`;
      }

      const stmt = db.prepare("INSERT INTO results (examId, studentId, score, totalQuestions, totalPoints, answers, questionResults, aiFeedback, integrityScore, tabExitCount, fullscreenExitsCount, auditTrail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      const iScore = integrityScore !== undefined ? integrityScore : 100;
      const tExits = tabExitCount !== undefined ? tabExitCount : 0;
      const fsExits = fullscreenExitsCount !== undefined ? fullscreenExitsCount : 0;
      const aTrail = auditTrail ? (typeof auditTrail === 'string' ? auditTrail : JSON.stringify(auditTrail)) : '[]';

      const result = stmt.run(
        examId, 
        req.user.id, 
        score, 
        totalQuestions, 
        totalPoints, 
        JSON.stringify(answers), 
        JSON.stringify(questionResults), 
        aiFeedback,
        iScore,
        tExits,
        fsExits,
        aTrail
      );

      // Log student integrity result in standard audit_logs
      if (iScore < 100) {
        createLog(
          req.user.id, 
          'SEC_VIOLATION_RESULT', 
          `Intégrité d'examen #${examId} : ${iScore}% (Sorties d'onglet: ${tExits}, Plein écran quitté: ${fsExits})`
        );
      } else {
        createLog(
          req.user.id, 
          'EXAM_COMPLETED_SECURE', 
          `Examen #${examId} terminé avec succès en mode sécurisé. Intégrité 100%`
        );
      }

      // Clean up exam session upon completion
      try {
        db.prepare("DELETE FROM exam_sessions WHERE userId = ? AND examId = ?").run(req.user.id, examId);
      } catch (sessErr) {
        console.error("Failed to delete exam session on results submit:", sessErr);
      }

      console.log(`[API] Server-side result securely grading saved with db id ${result.lastInsertRowid}`);
      clearCache('exams');
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
    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      notifs = db.prepare(`
        SELECT n.*, (SELECT 1 FROM user_notifications un WHERE un.notificationId = n.id AND un.userId = ?) as isRead 
        FROM notifications n 
        ORDER BY n.isPinned DESC, n.createdAt DESC
      `).all(req.user.id);
    } else {
      // Students see notifications matching their audience role and targeted to their scope (global, filiere, or group)
      notifs = db.prepare(`
        SELECT n.*, (SELECT 1 FROM user_notifications un WHERE un.notificationId = n.id AND un.userId = ?) as isRead
        FROM notifications n 
        WHERE (n.audienceRole IS NULL OR n.audienceRole = 'all' OR n.audienceRole = 'students')
          AND (
            (n.groupId IS NULL AND n.filiereId IS NULL)
            OR (n.groupId = ?)
            OR (n.filiereId = ? AND n.groupId IS NULL)
          )
        ORDER BY n.isPinned DESC, n.createdAt DESC
      `).all(req.user.id, req.user.groupId, req.user.filiereId);
    }

    // Attach comments, reactions and readers for full interactive and content enrichment
    const enrichedNotifs = notifs.map((n: any) => {
      let reactions: any[] = [];
      let comments: any[] = [];
      let readers: any[] = [];
      
      try { reactions = db.prepare("SELECT * FROM notification_reactions WHERE notificationId = ?").all(n.id); } catch(e){}
      try { comments = db.prepare("SELECT * FROM notification_comments WHERE notificationId = ? ORDER BY createdAt ASC").all(n.id); } catch(e){}
      
      let readCountValue = 0;
      if (req.user.role === 'teacher' || req.user.role === 'admin') {
        try {
          readers = db.prepare(`
            SELECT u.id, u.displayName, u.email, un.readAt 
            FROM user_notifications un 
            JOIN users u ON un.userId = u.id 
            WHERE un.notificationId = ?
          `).all(n.id);
          readCountValue = readers.length;
        } catch (e){}
      } else {
        try {
          const row = db.prepare("SELECT count(*) as count FROM user_notifications WHERE notificationId = ?").get(n.id) as any;
          readCountValue = row?.count || 0;
        } catch (e){}
      }

      return {
        ...n,
        read: !!n.isRead,
        isPinned: !!n.isPinned,
        reactions,
        comments,
        readers,
        readCount: readCountValue
      };
    });

    res.json(enrichedNotifs);
  });

  app.post("/api/notifications/read-all", authenticate, (req: any, res) => {
    try {
      let notifs;
      if (req.user.role === 'teacher' || req.user.role === 'admin') {
        notifs = db.prepare("SELECT id FROM notifications").all();
      } else {
        notifs = db.prepare(`
          SELECT id FROM notifications 
          WHERE (audienceRole IS NULL OR audienceRole = 'all' OR audienceRole = 'students')
            AND (
              (groupId IS NULL AND filiereId IS NULL)
              OR (groupId = ?)
              OR (filiereId = ? AND groupId IS NULL)
            )
        `).all(req.user.groupId, req.user.filiereId);
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
      const { title, content, groupId, filiereId, audienceRole, type, isPinned, importance, attachmentUrl, attachmentName } = req.body;
      const stmt = db.prepare(`
        INSERT INTO notifications (title, content, teacherId, groupId, filiereId, audienceRole, type, isPinned, importance, attachmentUrl, attachmentName) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        title, 
        content, 
        req.user.id, 
        groupId || null,
        filiereId || null,
        audienceRole || 'all',
        type || 'announcement', 
        isPinned ? 1 : 0, 
        importance || 'normal',
        attachmentUrl || null,
        attachmentName || null
      );
      const notif = { 
        id: Number(result.lastInsertRowid), 
        title, 
        content, 
        teacherId: req.user.id, 
        groupId: groupId || null,
        filiereId: filiereId || null,
        audienceRole: audienceRole || 'all',
        type: type || 'announcement',
        isPinned: isPinned ? 1 : 0,
        importance: importance || 'normal',
        attachmentUrl: attachmentUrl || null,
        attachmentName: attachmentName || null,
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

  app.post("/api/notifications/:id/toggle-pin", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    try {
      const notif = db.prepare("SELECT isPinned FROM notifications WHERE id = ?").get(id) as any;
      if (!notif) return res.status(404).json({ error: "Notification introuvable" });
      const newPinValue = notif.isPinned ? 0 : 1;
      db.prepare("UPDATE notifications SET isPinned = ? WHERE id = ?").run(newPinValue, id);
      res.json({ success: true, isPinned: !!newPinValue });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/:id/react", authenticate, (req: any, res) => {
    const { id } = req.params;
    const { reactionType } = req.body;
    try {
      const row = db.prepare("SELECT id FROM notification_reactions WHERE notificationId = ? AND userId = ? AND reactionType = ?").get(id, req.user.id, reactionType);
      if (row) {
        db.prepare("DELETE FROM notification_reactions WHERE id = ?").run((row as any).id);
        res.json({ success: true, action: 'removed' });
      } else {
        db.prepare(`
          INSERT INTO notification_reactions (notificationId, userId, reactionType, userDisplayName) 
          VALUES (?, ?, ?, ?)
        `).run(id, req.user.id, reactionType, req.user.displayName);
        res.json({ success: true, action: 'added' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/notifications/:id/comments", authenticate, (req: any, res) => {
    const { id } = req.params;
    const { content } = req.body;
    try {
      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Content is required" });
      }
      db.prepare(`
        INSERT INTO notification_comments (notificationId, userId, userDisplayName, userRole, content) 
        VALUES (?, ?, ?, ?, ?)
      `).run(id, req.user.id, req.user.displayName, req.user.role, content);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/notifications/comments/:commentId", authenticate, (req: any, res) => {
    const { commentId } = req.params;
    try {
      const comment = db.prepare("SELECT * FROM notification_comments WHERE id = ?").get(commentId) as any;
      if (!comment) return res.status(404).json({ error: "Commentaire introuvable" });
      if (req.user.role === 'teacher' || req.user.role === 'admin' || comment.userId === req.user.id) {
        db.prepare("DELETE FROM notification_comments WHERE id = ?").run(commentId);
        res.json({ success: true });
      } else {
        res.status(403).json({ error: "Interdit" });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/notifications/:id", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM user_notifications WHERE notificationId = ?").run(id);
      db.prepare("DELETE FROM notification_reactions WHERE notificationId = ?").run(id);
      db.prepare("DELETE FROM notification_comments WHERE notificationId = ?").run(id);
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
          showHeaderLines: false,
          localAiEnabled: false,
          localAiUrl: 'http://localhost:11434',
          localAiModel: 'llama3'
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
        localAiEnabled: !!settings.localAiEnabled,
        localAiUrl: settings.localAiUrl || 'http://localhost:11434',
        localAiModel: settings.localAiModel || 'llama3',
        autoBackupEnabled: !!settings.autoBackupEnabled,
        autoBackupInterval: settings.autoBackupInterval || 'daily',
        autoBackupCount: settings.autoBackupCount !== null && settings.autoBackupCount !== undefined ? settings.autoBackupCount : 5,
        autoBackupTime: settings.autoBackupTime || '02:00',
        autoBackupLastRun: settings.autoBackupLastRun || null
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
      headerLines, headerColumns, footerColumns, showHeaderLines, showFooterLines, ccRules, templates, defaultExamSettings,
      localAiEnabled, localAiUrl, localAiModel,
      autoBackupEnabled, autoBackupInterval, autoBackupCount, autoBackupTime
    } = req.body;
    try {
      const current = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
      const autoBackupEnabled_val = autoBackupEnabled !== undefined ? (autoBackupEnabled ? 1 : 0) : (current ? current.autoBackupEnabled : 0);
      const autoBackupInterval_val = autoBackupInterval !== undefined ? autoBackupInterval : (current ? current.autoBackupInterval : 'daily');
      const autoBackupCount_val = autoBackupCount !== undefined ? Number(autoBackupCount) : (current ? current.autoBackupCount : 5);
      const autoBackupTime_val = autoBackupTime !== undefined ? autoBackupTime : (current ? current.autoBackupTime : '02:00');

      db.prepare(`
        UPDATE settings 
        SET orgName = ?, orgNameArabic = ?, orgNameFrench = ?, regionalDirection = ?, 
            institutionName = ?, orgSubName = ?, orgLogoUrl = ?, orgLogoUrlRight = ?,
            footerText = ?, footerTable = ?, showFooter = ?,
            footerFontSize = ?, footerFontFamily = ?, watermarkText = ?, showWatermark = ?, watermarkColor = ?, watermarkOpacity = ?,
            showFooterText = ?, showFooterTable = ?,
            regionName = ?, academicYear = ?, orgLogoBgColor = ?, orgLogoTextColor = ?, 
            headerLines = ?, headerColumns = ?, footerColumns = ?, showHeaderLines = ?, showFooterLines = ?, ccRules = ?, templates = ?, defaultExamSettings = ?,
            localAiEnabled = ?, localAiUrl = ?, localAiModel = ?,
            autoBackupEnabled = ?, autoBackupInterval = ?, autoBackupCount = ?, autoBackupTime = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(
        orgName, orgNameArabic, orgNameFrench, regionalDirection, institutionName, 
        orgSubName, orgLogoUrl, orgLogoUrlRight, footerText, JSON.stringify(footerTable), showFooter ? 1 : 0,
        footerFontSize, footerFontFamily, watermarkText, showWatermark ? 1 : 0, watermarkColor, watermarkOpacity,
        showFooterText ? 1 : 0, showFooterTable ? 1 : 0,
        regionName, academicYear, orgLogoBgColor, orgLogoTextColor, 
        JSON.stringify(headerLines), JSON.stringify(headerColumns), JSON.stringify(footerColumns), showHeaderLines ? 1 : 0, showFooterLines ? 1 : 0, 
        JSON.stringify(ccRules), JSON.stringify(templates), JSON.stringify(defaultExamSettings),
        localAiEnabled ? 1 : 0, localAiUrl, localAiModel,
        autoBackupEnabled_val, autoBackupInterval_val, autoBackupCount_val, autoBackupTime_val
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
        defaultExamSettings: updated.defaultExamSettings ? JSON.parse(updated.defaultExamSettings) : null,
        localAiEnabled: !!updated.localAiEnabled,
        localAiUrl: updated.localAiUrl,
        localAiModel: updated.localAiModel,
        autoBackupEnabled: !!updated.autoBackupEnabled,
        autoBackupInterval: updated.autoBackupInterval || 'daily',
        autoBackupCount: updated.autoBackupCount !== null && updated.autoBackupCount !== undefined ? updated.autoBackupCount : 5,
        autoBackupTime: updated.autoBackupTime || '02:00',
        autoBackupLastRun: updated.autoBackupLastRun || null
      });
      createLog(req.user.id, "UPDATE_SETTINGS", "Modification des paramètres de l'organisation");
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Backup & Restore & Diagnostics ---
  app.get("/api/admin/db-diagnostic", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const pragmaCheck = db.prepare("PRAGMA integrity_check").get() as any;
      const integrityFlag = pragmaCheck ? Object.values(pragmaCheck)[0] as string : "unknown";
      
      let dbSize = 0;
      if (fs.existsSync("eduqcm.db")) {
        dbSize = fs.statSync("eduqcm.db").size;
      }
      
      const counts = {
        users: 0,
        groups: 0,
        modules: 0,
        exams: 0,
        questions: 0,
        results: 0,
        logs: 0
      };
      
      const tables = [
        { key: "users", table: "users" },
        { key: "groups", table: "groups" },
        { key: "modules", table: "modules" },
        { key: "exams", table: "exams" },
        { key: "questions", table: "exam_questions" },
        { key: "results", table: "exam_results" },
        { key: "logs", table: "audit_logs" }
      ];
      
      for (const t of tables) {
        try {
          const row = db.prepare(`SELECT COUNT(*) as count FROM ${t.table}`).get() as any;
          if (row) counts[t.key] = row.count;
        } catch (e) {}
      }
      
      res.json({
        integrity: integrityFlag,
        size: dbSize,
        counts
      });
    } catch (err: any) {
      console.error("Diagnostic error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/db-vacuum", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      createLog(req.user.id, "OPTIMIZE_DB", "Optimisation de la base de données (VACUUM)");
      db.pragma("vacuum");
      db.pragma("optimize");
      
      let dbSize = 0;
      if (fs.existsSync("eduqcm.db")) {
        dbSize = fs.statSync("eduqcm.db").size;
      }
      
      res.json({ success: true, size: dbSize, message: "La base de données a été compactée et optimisée avec succès !" });
    } catch (err: any) {
      console.error("Vacuum error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/backup", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const format = req.query.format;
    
    if (format === "zip") {
      const backupDbPath = `db-${Date.now()}.db`;
      try {
        db.pragma("optimize");
        await db.backup(backupDbPath);
        
        const users = db.prepare("SELECT id, email, displayName, role, groupName, filiere, groupId, filiereId, badge, points, createdAt FROM users").all() || [];
        const groups = db.prepare("SELECT * FROM groups").all() || [];
        const modules = db.prepare("SELECT * FROM modules").all() || [];
        const exams = db.prepare("SELECT id, title, description, moduleId, teacherId, isOnline, isLive, duration, totalPoints, status, successScore, createdAt FROM exams").all() || [];
        const questions = db.prepare("SELECT * FROM exam_questions").all() || [];
        const results = db.prepare("SELECT * FROM exam_results").all() || [];
        const logs = db.prepare("SELECT * FROM audit_logs").all() || [];
        
        const convertToCSV = (arr: any[]) => {
          if (!arr || arr.length === 0) return "";
          const headers = Object.keys(arr[0]);
          const csvLines = [headers.join(",")];
          for (const item of arr) {
            const values = headers.map(header => {
              const val = item[header];
              if (val === null || val === undefined) return '""';
              const strVal = String(val).replace(/"/g, '""');
              if (strVal.includes(",") || strVal.includes("\n") || strVal.includes('"')) {
                return `"${strVal}"`;
              }
              return strVal;
            });
            csvLines.push(values.join(","));
          }
          return csvLines.join("\n");
        };

        const zip = new AdmZip();
        zip.addLocalFile(backupDbPath, "", "eduqcm-backup.db");
        
        zip.addFile("csv/utilisateurs.csv", Buffer.from(convertToCSV(users), "utf-8"));
        zip.addFile("csv/groupes.csv", Buffer.from(convertToCSV(groups), "utf-8"));
        zip.addFile("csv/modules.csv", Buffer.from(convertToCSV(modules), "utf-8"));
        zip.addFile("csv/examens.csv", Buffer.from(convertToCSV(exams), "utf-8"));
        zip.addFile("csv/questions.csv", Buffer.from(convertToCSV(questions), "utf-8"));
        zip.addFile("csv/resultats_examens.csv", Buffer.from(convertToCSV(results), "utf-8"));
        zip.addFile("csv/journaux_audit.csv", Buffer.from(convertToCSV(logs), "utf-8"));
        
        const metadata = {
          exportDate: new Date().toISOString(),
          exportedBy: req.user.email,
          records: {
            users: users.length,
            groups: groups.length,
            modules: modules.length,
            exams: exams.length,
            questions: questions.length,
            results: results.length,
            logs: logs.length
          },
          system: "EduQCM Intranet Node-Engine"
        };
        zip.addFile("backup-metadata.json", Buffer.from(JSON.stringify(metadata, null, 2), "utf-8"));
        
        const buildInteractiveHTML = () => {
          return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EduQCM - Dashboard de Consultation Hors-ligne</title>
  <style>
    :root {
      --primary: #059669;
      --primary-hover: #047857;
      --indigo: #4f46e5;
      --indigo-hover: #4338ca;
      --slate-50: #f8fafc;
      --slate-100: #f1f5f9;
      --slate-200: #e2e8f0;
      --slate-700: #334155;
      --slate-800: #1e293b;
      --slate-900: #0f172a;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      padding: 24px;
    }

    header {
      background: white;
      padding: 24px;
      border-radius: 20px;
      margin-bottom: 24px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
      border: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .title-group h1 {
      font-size: 24px;
      font-weight: 800;
      color: var(--slate-900);
      letter-spacing: -0.025em;
    }

    .title-group p {
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }

    .badge-lan {
      background: #ecfdf5;
      color: #047857;
      padding: 6px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid #a7f3d0;
    }

    .grid-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgb(0 0 0 / 0.02);
    }

    .stat-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 6px;
    }

    .stat-val {
      font-size: 28px;
      font-weight: 900;
      color: var(--slate-900);
    }

    .main-card {
      background: white;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
      overflow: hidden;
    }

    .tabs {
      display: flex;
      background: var(--slate-50);
      border-bottom: 1px solid #e2e8f0;
      overflow-x: auto;
    }

    .tab-btn {
      padding: 16px 24px;
      border: none;
      background: none;
      font-size: 13px;
      font-weight: 700;
      color: #64748b;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      border-bottom: 2px solid transparent;
    }

    .tab-btn:hover {
      color: var(--indigo);
      background: #f1f5f9;
    }

    .tab-btn.active {
      color: var(--indigo);
      border-bottom-color: var(--indigo);
      background: white;
    }

    .search-panel {
      padding: 20px;
      border-bottom: 1px solid #e2e8f0;
      background: #fbfcfd;
      display: flex;
      gap: 12px;
    }

    .search-input {
      flex: 1;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      outline: none;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: var(--indigo);
    }

    .table-container {
      overflow-x: auto;
      max-height: 600px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: var(--slate-50);
      padding: 14px 20px;
      font-weight: 700;
      color: #475569;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--slate-200);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    td {
      padding: 14px 20px;
      border-bottom: 1px solid var(--slate-100);
      color: #334155;
    }

    tr:hover td {
      background: var(--slate-50);
    }

    .score-badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
    }

    .badge-success { background: #d1fae5; color: #065f46; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-neutral { background: #f1f5f9; color: #475569; }

    .role-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
    }
    .role-admin { background: #fee2e2; color: #991b1b; }
    .role-teacher { background: #e0e7ff; color: #3730a3; }
    .role-student { background: #f0fdf4; color: #166534; }
  </style>
</head>
<body>

  <header>
    <div class="title-group">
      <h1>EduQCM - Portail de Consultation Hors-ligne</h1>
      <p>Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")} • Exporté par : ${req.user.email}</p>
    </div>
    <span class="badge-lan">Mode Intranet / Archive</span>
  </header>

  <div class="grid-stats">
    <div class="stat-card">
      <div class="stat-label">Utilisateurs</div>
      <div class="stat-val">\${stats.users}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Groupes</div>
      <div class="stat-val">\${stats.groups}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Modules</div>
      <div class="stat-val">\${stats.modules}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Examens</div>
      <div class="stat-val">\${stats.exams}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Questions</div>
      <div class="stat-val">\${stats.questions}</div>
    </div>
  </div>

  <div class="main-card">
    <div class="tabs">
      <button class="tab-btn active" onclick="switchTab('exams')">Examens (\${stats.exams})</button>
      <button class="tab-btn" onclick="switchTab('users')">Utilisateurs (\${stats.users})</button>
      <button class="tab-btn" onclick="switchTab('groups')">Groupes (\${stats.groups})</button>
      <button class="tab-btn" onclick="switchTab('logs')">Journaux d'Audit (\${stats.logs})</button>
    </div>

    <div class="search-panel">
      <input type="text" id="searchBar" class="search-input" placeholder="Filtrer et rechercher instantanément..." oninput="filterData()" />
    </div>

    <div class="table-container">
      <table id="dataTable">
        <thead id="tableHead"></thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>
  </div>

  <script>
    const stats = ${JSON.stringify(metadata.records)};
    const users = ${JSON.stringify(users)};
    const groups = ${JSON.stringify(groups)};
    const exams = ${JSON.stringify(exams)};
    const logs = ${JSON.stringify(logs)};

    let currentTab = 'exams';

    function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById('searchBar').value = '';
      renderTable();
    }

    function renderTable() {
      const head = document.getElementById('tableHead');
      const body = document.getElementById('tableBody');
      head.innerHTML = '';
      body.innerHTML = '';

      if (currentTab === 'exams') {
        head.innerHTML = \`
          <tr>
            <th>ID</th>
            <th>Titre</th>
            <th>Description</th>
            <th>Note Max</th>
            <th>Durée</th>
            <th>Statut</th>
          </tr>
        \`;
        exams.forEach(x => {
          body.innerHTML += \`
            <tr>
              <td style="font-weight:bold;">#\${x.id}</td>
              <td style="font-weight:bold;">\${x.title || ''}</td>
              <td>\${x.description || 'Sans'}</td>
              <td style="font-weight:bold;">\${x.totalPoints} pts</td>
              <td>\${x.duration} min</td>
              <td>
                <span class="score-badge \${x.status === 'publie' || x.status === 'active' ? 'badge-success' : 'badge-neutral'}">
                  \${x.status}
                </span>
              </td>
            </tr>
          \`;
        });
      } else if (currentTab === 'users') {
        head.innerHTML = \`
          <tr>
            <th>ID</th>
            <th>Email</th>
            <th>Nom Complet</th>
            <th>Rôle</th>
            <th>Groupe</th>
            <th>Points</th>
          </tr>
        \`;
        users.forEach(u => {
          let roleBadge = 'role-student';
          if (u.role === 'admin') roleBadge = 'role-admin';
          if (u.role === 'teacher') roleBadge = 'role-teacher';
          
          body.innerHTML += \`
            <tr>
              <td>#\${u.id}</td>
              <td style="font-weight:bold;">\${u.email}</td>
              <td style="font-weight:bold;">\${u.displayName || ''}</td>
              <td><span class="role-badge \${roleBadge}">\${u.role}</span></td>
              <td>\${u.groupName || 'Aucun'}</td>
              <td>\${u.points || 0} pts</td>
            </tr>
          \`;
        });
      } else if (currentTab === 'groups') {
        head.innerHTML = \`
          <tr>
            <th>ID</th>
            <th>Nom de Groupe</th>
            <th>Niveau</th>
            <th>Filière de formation</th>
          </tr>
        \`;
        groups.forEach(g => {
          body.innerHTML += \`
            <tr>
              <td>#\${g.id}</td>
              <td style="font-weight:bold;">\${g.name}</td>
              <td>\${g.level || ''}</td>
              <td>\${g.schoolBranch || ''}</td>
            </tr>
          \`;
        });
      } else if (currentTab === 'logs') {
        head.innerHTML = \`
          <tr>
            <th>ID</th>
            <th>User ID</th>
            <th>Action</th>
            <th>Détails</th>
            <th>Horodatage</th>
          </tr>
        \`;
        logs.reverse().forEach(l => {
          body.innerHTML += \`
            <tr>
              <td>#\${l.id}</td>
              <td>Utilisateur #\${l.userId}</td>
              <td style="font-weight:bold;color:var(--indigo);">\${l.action}</td>
              <td>\${l.details || ''}</td>
              <td>\${new Date(l.timestamp).toLocaleString()}</td>
            </tr>
          \`;
        });
      }
    }

    function filterData() {
      const q = document.getElementById('searchBar').value.toLowerCase();
      const rows = document.querySelectorAll('#dataTable tbody tr');
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    }

    renderTable();
  </script>
</body>
</html>`;
        };

        zip.addFile("index.html", Buffer.from(buildInteractiveHTML(), "utf-8"));
        const zipBuffer = zip.toBuffer();
        
        if (fs.existsSync(backupDbPath)) fs.unlinkSync(backupDbPath);
        
        createLog(req.user.id, "EXPORT_DB_COMPLET", "Exportation complète de la base de données au format ZIP d'intranet.");
        
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", "attachment; filename=eduqcm-complete-export.zip");
        return res.send(zipBuffer);
        
      } catch (err: any) {
        console.error("ZIP Complete export failed:", err);
        if (fs.existsSync(backupDbPath)) fs.unlinkSync(backupDbPath);
        return res.status(500).json({ error: "Échec de la génération de l'archive complète ZIP." });
      }
    }
    
    // Normal binary download
    const backupPath = `backup-${Date.now()}.db`;
    try {
      await db.backup(backupPath);
      createLog(req.user.id, "EXPORT_DB", "Exportation simple de la base de données (.db)");
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

    const tempPath = req.file.path;
    const isZip = req.file.originalname.toLowerCase().endsWith(".zip") || req.file.mimetype === "application/zip";

    try {
      console.log(`Starting database restore with file: ${tempPath} (ZIP: ${isZip})`);

      if (isZip) {
        const zip = new AdmZip(tempPath);
        const zipEntries = zip.getEntries();
        const dbEntry = zipEntries.find(entry => entry.entryName === "eduqcm-backup.db");
        
        if (!dbEntry) {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
          return res.status(400).json({ error: "Cette archive ZIP est incompatible ou ne contient pas de fichier eduqcm-backup.db à restaurer." });
        }
        
        // Save the raw DB file to a temporary location
        const extractedTempDb = `extracted-${Date.now()}.db`;
        fs.writeFileSync(extractedTempDb, dbEntry.getData());
        
        // Safely close connection before overwrite
        db.close();
        console.log("Database connection closed for ZIP restore.");
        
        // Remove WAL/SHM file
        const walFile = "eduqcm.db-wal";
        const shmFile = "eduqcm.db-shm";
        if (fs.existsSync(walFile)) { try { fs.unlinkSync(walFile); } catch (e) {} }
        if (fs.existsSync(shmFile)) { try { fs.unlinkSync(shmFile); } catch (e) {} }
        
        // Overwrite
        fs.copyFileSync(extractedTempDb, "eduqcm.db");
        fs.unlinkSync(extractedTempDb);
        fs.unlinkSync(tempPath);
      } else {
        // Simple raw database overwrite
        db.close();
        console.log("Database connection closed for SQLITE restore.");
        
        const walFile = "eduqcm.db-wal";
        const shmFile = "eduqcm.db-shm";
        if (fs.existsSync(walFile)) { try { fs.unlinkSync(walFile); } catch (e) {} }
        if (fs.existsSync(shmFile)) { try { fs.unlinkSync(shmFile); } catch (e) {} }
        
        fs.copyFileSync(tempPath, "eduqcm.db");
        fs.unlinkSync(tempPath);
      }

      // Re-init connection
      db = new Database("eduqcm.db");
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      console.log("Database connection re-opened after restore.");
      
      createLog(req.user.id, "RESTORE_DB", `Restauration de la base de données effectuée (${isZip ? 'Archive ZIP' : 'Binaire DB'})`);
      res.json({ success: true, message: "La base de données a été restaurée avec succès." });
    } catch (err: any) {
      console.error("Restore error:", err);
      try {
        db = new Database("eduqcm.db");
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
      } catch (recoverErr) {
        console.error("Failed to recover database connection:", recoverErr);
      }
      res.status(500).json({ error: "Échec de l'import : " + err.message });
    }
  });

  // --- Scheduled Automatic Backups: System Functions & Routes ---

  // Custom helper to perform the actual SQLite auto backup with rotation retention
  async function performAutoBackup() {
    try {
      const settings = db.prepare("SELECT autoBackupEnabled, autoBackupInterval, autoBackupCount, autoBackupTime FROM settings WHERE id = 1").get() as any;
      if (!settings || !settings.autoBackupEnabled) return;

      const backupDir = path.join(process.cwd(), "autobackups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Format timestamp without colons or dots for filename safety
      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const HH = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      
      const backupFileName = `backup-auto-${YYYY}-${MM}-${DD}_${HH}-${mm}-${ss}.db`;
      const backupFilePath = path.join(backupDir, backupFileName);

      db.pragma("optimize");
      await db.backup(backupFilePath);
      console.log(`[AUTO-BACKUP] Created automatic backup: ${backupFileName}`);

      // Update the settings table with run datetime
      db.prepare("UPDATE settings SET autoBackupLastRun = ? WHERE id = 1").run(now.toISOString());

      // Find and rotate previous automatic backups
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith("backup-auto-") && f.endsWith(".db"))
        .map(f => {
          const fp = path.join(backupDir, f);
          return { name: f, path: fp, mtime: fs.statSync(fp).mtime.getTime() };
        });

      // Sort chronological ascending (oldest first)
      files.sort((a, b) => a.mtime - b.mtime);

      const countToKeep = settings.autoBackupCount || 5;
      while (files.length > countToKeep) {
        const oldest = files.shift();
        if (oldest) {
          try {
            fs.unlinkSync(oldest.path);
            console.log(`[AUTO-BACKUP] Rotated (deleted) old backup: ${oldest.name}`);
          } catch (e) {
            console.error(`[AUTO-BACKUP] Rotation failed to delete ${oldest.name}:`, e);
          }
        }
      }
    } catch (err) {
      console.error("[AUTO-BACKUP] Error running automatic backup process:", err);
    }
  }

  // Scheduler evaluation function
  async function checkAutoBackupSchedule() {
    try {
      const settings = db.prepare("SELECT autoBackupEnabled, autoBackupInterval, autoBackupCount, autoBackupTime, autoBackupLastRun FROM settings WHERE id = 1").get() as any;
      if (!settings || !settings.autoBackupEnabled) return;

      const now = new Date();
      const lastRun = settings.autoBackupLastRun ? new Date(settings.autoBackupLastRun) : null;
      
      const [targetHour, targetMin] = (settings.autoBackupTime || "02:00").split(":").map(Number);
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();

      // Check if current time of day is >= scheduled time
      const timeTriggerMet = (currentHour > targetHour) || (currentHour === targetHour && currentMin >= targetMin);

      let shouldBackup = false;

      if (!lastRun) {
        shouldBackup = timeTriggerMet;
      } else {
        const diffMs = now.getTime() - lastRun.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (settings.autoBackupInterval === 'daily') {
          const isNewDay = now.getDate() !== lastRun.getDate() || now.getMonth() !== lastRun.getMonth() || now.getFullYear() !== lastRun.getFullYear();
          shouldBackup = isNewDay && timeTriggerMet;
        } else if (settings.autoBackupInterval === 'weekly') {
          shouldBackup = (diffDays >= 7) && timeTriggerMet;
        } else if (settings.autoBackupInterval === 'monthly') {
          const isNewMonth = now.getMonth() !== lastRun.getMonth() || now.getFullYear() !== lastRun.getFullYear();
          shouldBackup = isNewMonth && timeTriggerMet;
        }
      }

      if (shouldBackup) {
        console.log(`[AUTO-BACKUP] Trigger condition met. Last run: ${settings.autoBackupLastRun || 'Never'}. Running auto-backup now...`);
        await performAutoBackup();
      }
    } catch (err) {
      console.error("[AUTO-BACKUP] Error during evaluation of scheduler conditions:", err);
    }
  }

  // Setup periodic scheduler (evaluates once every 5 minutes)
  setInterval(checkAutoBackupSchedule, 5 * 60 * 1000);
  
  // Also run a check 10 seconds post server start to process any missed backup
  setTimeout(checkAutoBackupSchedule, 10000);

  // Auto-backup configuration API routes

  // 1. Get list of all auto-backups on disk
  app.get("/api/admin/auto-backups", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const backupDir = path.join(process.cwd(), "autobackups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith("backup-auto-") && f.endsWith(".db"))
        .map(f => {
          const fp = path.join(backupDir, f);
          const stat = fs.statSync(fp);
          return {
            filename: f,
            size: stat.size,
            createdAt: stat.mtime.toISOString()
          };
        });
      
      // Newest first
      files.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(files);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Download specific auto-backup file
  app.get("/api/admin/auto-backups/:filename", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { filename } = req.params;
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Nom de fichier invalide" });
    }
    const filePath = path.join(process.cwd(), "autobackups", filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier de sauvegarde introuvable" });
    }
    res.download(filePath, filename);
  });

  // 3. Delete specific auto-backup file
  app.delete("/api/admin/auto-backups/:filename", authenticate, (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { filename } = req.params;
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Nom de fichier invalide" });
    }
    const filePath = path.join(process.cwd(), "autobackups", filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier de sauvegarde introuvable" });
    }
    try {
      fs.unlinkSync(filePath);
      createLog(req.user.id, "DELETE_AUTO_BACKUP", `Suppression de la sauvegarde automatique : ${filename}`);
      res.json({ success: true, message: "Sauvegarde automatique supprimée avec succès !" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Trigger manual creation of auto-backup
  app.post("/api/admin/auto-backups/trigger", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const backupDir = path.join(process.cwd(), "autobackups");
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      const HH = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      
      const backupFileName = `backup-auto-${YYYY}-${MM}-${DD}_${HH}-${mm}-${ss}.db`;
      const backupFilePath = path.join(backupDir, backupFileName);

      db.pragma("optimize");
      await db.backup(backupFilePath);
      console.log(`[AUTO-BACKUP] Manually triggered auto backup: ${backupFileName}`);

      db.prepare("UPDATE settings SET autoBackupLastRun = ? WHERE id = 1").run(now.toISOString());

      // Standard rotations
      const settings = db.prepare("SELECT autoBackupCount FROM settings WHERE id = 1").get() as any;
      const countToKeep = settings?.autoBackupCount || 5;

      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith("backup-auto-") && f.endsWith(".db"))
        .map(f => {
          const fp = path.join(backupDir, f);
          return { name: f, path: fp, mtime: fs.statSync(fp).mtime.getTime() };
        });

      files.sort((a, b) => a.mtime - b.mtime);

      while (files.length > countToKeep) {
        const oldest = files.shift();
        if (oldest) {
          try { fs.unlinkSync(oldest.path); } catch (e) {}
        }
      }

      createLog(req.user.id, "TRIGGER_AUTO_BACKUP", "Déclenchement manuel d'une sauvegarde automatique");
      res.json({ success: true, message: "Sauvegarde générée avec succès dans l'espace automatique !" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 5. Restore from specific auto-backup file
  app.post("/api/admin/auto-backups/:filename/restore", authenticate, async (req: any, res) => {
    if (req.user.role === 'student') return res.status(403).json({ error: "Forbidden" });
    const { filename } = req.params;
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return res.status(400).json({ error: "Nom de fichier invalide" });
    }
    const filePath = path.join(process.cwd(), "autobackups", filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Fichier de sauvegarde introuvable" });
    }
    try {
      console.log(`[AUTO-RESTORE] Closing SQLite database connection for restoration : ${filename}`);
      db.close();

      const walFile = "eduqcm.db-wal";
      const shmFile = "eduqcm.db-shm";
      if (fs.existsSync(walFile)) { try { fs.unlinkSync(walFile); } catch (e) {} }
      if (fs.existsSync(shmFile)) { try { fs.unlinkSync(shmFile); } catch (e) {} }

      fs.copyFileSync(filePath, "eduqcm.db");
      console.log("[AUTO-RESTORE] Database file overwritten successfully.");

      db = new Database("eduqcm.db");
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");
      console.log("[AUTO-RESTORE] Database connection re-established.");

      createLog(req.user.id, "RESTORE_DB", `Restauration effectuée depuis la sauvegarde automatique : ${filename}`);
      res.json({ success: true, message: "La base de données a été restaurée avec succès à partir de la sauvegarde automatique !" });
    } catch (err: any) {
      console.error("[AUTO-RESTORE] Critical restore error:", err);
      try {
        db = new Database("eduqcm.db");
        db.pragma("journal_mode = WAL");
        db.pragma("foreign_keys = ON");
      } catch (recoverErr) {
        console.error("[AUTO-RESTORE] Failed to recover database connection:", recoverErr);
      }
      res.status(500).json({ error: "Échec de la restauration : " + err.message });
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

  app.get("/api/admin/online-users", authenticate, (req: any, res) => {
    const now = Date.now();
    // Prune users inactive for over 2 minutes
    for (const [id, user] of onlineUsers.entries()) {
      if (now - user.lastActive > 120000) {
        onlineUsers.delete(id);
      }
    }
    res.json(Array.from(onlineUsers.values()));
  });

  app.get("/api/chat/messages", authenticate, (req: any, res) => {
    const { channelType, groupId } = req.query;
    if (!channelType) return res.status(400).json({ error: "channelType is required" });
    
    try {
      let stmt;
      let params: any[] = [];
      
      if (channelType === 'general') {
        stmt = db.prepare("SELECT * FROM chat_messages WHERE channelType = 'general' ORDER BY id ASC LIMIT 100");
      } else if (channelType === 'teachers') {
        if (req.user.role !== 'teacher' && req.user.role !== 'admin') {
          return res.status(403).json({ error: "Forbidden" });
        }
        stmt = db.prepare("SELECT * FROM chat_messages WHERE channelType = 'teachers' ORDER BY id ASC LIMIT 100");
      } else if (channelType === 'group') {
        if (!groupId) return res.status(400).json({ error: "groupId is required for group channel" });
        
        // Allow student of same group or teacher/admin
        if (req.user.role === 'student' && req.user.groupId !== Number(groupId)) {
          return res.status(403).json({ error: "Forbidden" });
        }
        
        stmt = db.prepare("SELECT * FROM chat_messages WHERE channelType = 'group' AND groupId = ? ORDER BY id ASC LIMIT 100");
        params = [groupId];
      } else {
        return res.status(400).json({ error: "Invalid channelType" });
      }
      
      const messages = stmt.all(...params) as any[];
      if (messages.length > 0) {
        const messageIds = messages.map(m => m.id);
        const placeholders = messageIds.map(() => "?").join(",");
        const reactions = db.prepare(`SELECT * FROM chat_reactions WHERE messageId IN (${placeholders})`).all(...messageIds) as any[];
        
        // Group reactions under their messages
        messages.forEach(msg => {
          msg.reactions = reactions.filter(r => r.messageId === msg.id);
        });
      }
      res.json(messages);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/log-client-action", authenticate, (req: any, res) => {
    const { action, details } = req.body;
    if (!action) return res.status(400).json({ error: "Action is required" });
    createLog(req.user.id, action.toUpperCase(), details || "Action enregistrée depuis le client.");
    res.json({ success: true });
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
