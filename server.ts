import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

import multer from "multer";
import fs from "fs";

import cors from "cors";

const JWT_SECRET = process.env.JWT_SECRET || "eduqcm-secret-key";

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
      role TEXT CHECK(role IN ('student', 'teacher')) NOT NULL,
      groupName TEXT,
      filiere TEXT,
      groupId INTEGER,
      filiereId INTEGER,
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
      regionName TEXT NOT NULL DEFAULT 'ROYAUME DU MAROC',
      academicYear TEXT NOT NULL DEFAULT '2024/2025',
      orgLogoBgColor TEXT NOT NULL DEFAULT '#059669',
      orgLogoTextColor TEXT NOT NULL DEFAULT '#ffffff',
      headerLines TEXT,
      showHeaderLines INTEGER DEFAULT 0,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_notifications (
      userId INTEGER NOT NULL,
      notificationId INTEGER NOT NULL,
      readAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (userId, notificationId),
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(notificationId) REFERENCES notifications(id)
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
  try { db.exec("ALTER TABLE modules ADD COLUMN filiereId INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE modules ADD COLUMN code TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE modules ADD COLUMN durationHours INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE exams RENAME COLUMN courseId TO moduleId"); } catch (e) {}
  try { db.exec("ALTER TABLE exams ADD COLUMN type TEXT DEFAULT 'controle-continu'"); } catch (e) {}
  try { db.exec("ALTER TABLE results ADD COLUMN totalPoints INTEGER DEFAULT 0"); } catch (e) {}
  try { db.exec("ALTER TABLE results ADD COLUMN questionResults TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE exams ADD COLUMN scheduledAt DATETIME"); } catch (e) {}
  try { db.exec("ALTER TABLE filieres ADD COLUMN code TEXT"); } catch (e) {}
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_filieres_code ON filieres(code)"); } catch (e) {}
  try { db.exec("ALTER TABLE filieres ADD COLUMN description TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN groupId INTEGER"); } catch (e) {}
  try { db.exec("ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'announcement'"); } catch (e) {}
  try { db.exec("ALTER TABLE filieres ADD COLUMN niveau TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN orgLogoUrl TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN orgNameArabic TEXT DEFAULT 'مكتب التكوين المهني وإنعاش الشغل'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN orgNameFrench TEXT DEFAULT 'Office de la Formation Professionnelle et de la promotion du travail'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN regionalDirection TEXT DEFAULT 'Direction Régionale De BM-KH'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN institutionName TEXT DEFAULT 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem'"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN headerLines TEXT"); } catch (e) {}
  try { db.exec("ALTER TABLE settings ADD COLUMN showHeaderLines INTEGER DEFAULT 0"); } catch (e) {}

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

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);

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

  // --- Auth Middleware ---
  const authenticate = (req: any, res: any, next: any) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      
      // Verify user still exists in DB (prevents FK errors if DB was reset)
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id) as any;
      if (!user) {
        res.clearCookie("token");
        return res.status(401).json({ error: "User no longer exists" });
      }
      
      const { password: _, ...userWithoutPassword } = user;
      req.user = { ...userWithoutPassword, id: Number(userWithoutPassword.id) };
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid token" });
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
    const user: any = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const { password: _, ...userWithoutPassword } = user;
    const userData = { ...userWithoutPassword, id: Number(userWithoutPassword.id) };
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
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id);
      if (!user) {
        res.clearCookie("token");
        return res.json({ user: null });
      }
      const { password: _, ...userWithoutPassword } = user as any;
      res.json({ user: { ...userWithoutPassword, id: Number(userWithoutPassword.id) } });
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
      
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id) as any;
      const { password: _, ...userWithoutPassword } = user;
      const userData = { ...userWithoutPassword, id: Number(userWithoutPassword.id) };
      const token = jwt.sign(userData, JWT_SECRET);
      res.cookie("token", token, { httpOnly: true });
      res.json({ user: userData });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- Data Routes ---
  app.get("/api/modules", authenticate, (req: any, res) => {
    let modules;
    if (req.user.role === 'teacher') {
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
    res.json(parsedModules);
  });

  app.post("/api/modules", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    try {
      const { code, name, durationHours, description, filiereId } = req.body;
      const fId = (filiereId && filiereId !== 0) ? filiereId : null;
      const stmt = db.prepare("INSERT INTO modules (code, name, durationHours, description, teacherId, filiereId) VALUES (?, ?, ?, ?, ?, ?)");
      const result = stmt.run(code, name, durationHours || 0, description, req.user.id, fId);
      res.json({ id: Number(result.lastInsertRowid), code, name, durationHours, description, teacherId: req.user.id, filiereId: fId });
    } catch (err: any) {
      console.error("Error creating module:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/modules/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    try {
      const { code, name, durationHours, description, filiereId } = req.body;
      const { id } = req.params;
      const fId = (filiereId && filiereId !== 0) ? filiereId : null;
      const stmt = db.prepare("UPDATE modules SET code = ?, name = ?, durationHours = ?, description = ?, filiereId = ? WHERE id = ? AND teacherId = ?");
      const result = stmt.run(code, name, durationHours || 0, description, fId, id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Module not found or unauthorized" });
      res.json({ id: Number(id), code, name, durationHours, description, filiereId: fId });
    } catch (err: any) {
      console.error("Error updating module:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/modules/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;

    try {
      // Check if exams exist
      const examsCount = db.prepare("SELECT COUNT(*) as count FROM exams WHERE moduleId = ?").get(id) as any;
      if (examsCount.count > 0) {
        return res.status(400).json({ error: "Impossible de supprimer un module qui contient des examens." });
      }

      const stmt = db.prepare("DELETE FROM modules WHERE id = ? AND teacherId = ?");
      const result = stmt.run(id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Module not found or unauthorized" });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting module:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/exams", authenticate, (req: any, res) => {
    let exams;
    if (req.user.role === 'teacher') {
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
    res.json(parsedExams);
  });

  app.post("/api/exams", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
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
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
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

      res.json({ success: true, status: 'active', groupId: Number(groupId) });
    } catch (err: any) {
      console.error("Error publishing exam:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/exams/:id/unpublish", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
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
      res.json({ success: true, status: 'draft' });
    } catch (err: any) {
      console.error("Error unpublishing exam:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/exams/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
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
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const examId = Number(id);

    console.log(`[DELETE] Request to delete exam ${examId} by user ${req.user.id}`);

    try {
      // Check if results exist
      const resultsCount = db.prepare("SELECT COUNT(*) as count FROM results WHERE examId = ?").get(examId) as any;
      console.log(`[DELETE] Results count for exam ${examId}:`, resultsCount);
      
      if (resultsCount && resultsCount.count > 0) {
        return res.status(400).json({ error: "Impossible de supprimer un examen qui a déjà des résultats." });
      }

      const stmt = db.prepare("DELETE FROM exams WHERE id = ? AND teacherId = ?");
      const result = stmt.run(examId, req.user.id);
      console.log(`[DELETE] Delete result:`, result);
      
      if (result.changes === 0) {
        // Find why it failed
        const exam = db.prepare("SELECT * FROM exams WHERE id = ?").get(examId) as any;
        console.log(`[DELETE] Exam found for fallback check:`, exam);
        
        if (!exam) {
          return res.status(404).json({ error: "Examen non trouvé." });
        } else {
          return res.status(403).json({ error: `Vous n'êtes pas autorisé à supprimer cet examen (Propriétaire: ${exam.teacherId}, Vous: ${req.user.id}).` });
        }
      }
      console.log(`[DELETE] Exam ${examId} deleted successfully`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[DELETE] Error deleting exam:", err);
      res.status(500).json({ error: `Erreur serveur: ${err.message}` });
    }
  });

  app.get("/api/results", authenticate, (req: any, res) => {
    let results;
    if (req.user.role === 'teacher') {
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
    res.json(parsedResults);
  });

  app.get("/api/exams/:id/results", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    
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
    res.json(parsedResults);
  });

  app.get("/api/students/count", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const count = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get() as any;
    res.json({ count: count.count });
  });

  app.post("/api/results", authenticate, (req: any, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const { examId, score, totalQuestions, totalPoints, answers, questionResults } = req.body;
      console.log(`[API] Saving results for student ${req.user.id}, exam ${examId}. Score: ${score}/${totalPoints}`);
      
      const stmt = db.prepare("INSERT INTO results (examId, studentId, score, totalQuestions, totalPoints, answers, questionResults) VALUES (?, ?, ?, ?, ?, ?, ?)");
      const result = stmt.run(examId, req.user.id, score, totalQuestions, totalPoints || 0, JSON.stringify(answers), questionResults ? JSON.stringify(questionResults) : null);
      
      console.log(`[API] Result saved successfully with id ${result.lastInsertRowid}`);
      res.json({ id: Number(result.lastInsertRowid), examId, studentId: req.user.id, score, totalQuestions, totalPoints: totalPoints || 0, answers, questionResults });
    } catch (err: any) {
      console.error("[API] Error saving result:", err);
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
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
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
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM notifications WHERE id = ? AND teacherId = ?").run(id, req.user.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Filières & Groups Routes ---
  app.get("/api/filieres", (req, res) => {
    const filieres = db.prepare("SELECT * FROM filieres ORDER BY name ASC").all();
    res.json(filieres);
  });

  app.post("/api/filieres", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { code, name, description, niveau } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO filieres (code, name, description, niveau) VALUES (?, ?, ?, ?)");
      const result = stmt.run(code, name, description, niveau);
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
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const { code, name, description, niveau } = req.body;
    try {
      const result = db.prepare("UPDATE filieres SET code = ?, name = ?, description = ?, niveau = ? WHERE id = ?").run(code, name, description, niveau, id);
      if (result.changes === 0) return res.status(404).json({ error: "Filière non trouvée." });
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
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    
    // Check if groups or users exist
    const groupsCount = db.prepare("SELECT COUNT(*) as count FROM groups WHERE filiereId = ?").get(id) as any;
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE filiereId = ?").get(id) as any;
    
    if (groupsCount.count > 0 || usersCount.count > 0) {
      return res.status(400).json({ error: "Impossible de supprimer une filière qui contient des groupes ou des étudiants." });
    }

    db.prepare("DELETE FROM filieres WHERE id = ?").run(id);
    res.json({ success: true });
  });

  app.get("/api/groups", (req, res) => {
    const groups = db.prepare(`
      SELECT g.*, (SELECT COUNT(*) FROM users u WHERE u.groupId = g.id AND u.role = 'student') as studentCount
      FROM groups g 
      ORDER BY g.name ASC
    `).all();
    res.json(groups);
  });

  app.get("/api/groups/:id/students", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const students = db.prepare("SELECT id, email, displayName, createdAt FROM users WHERE groupId = ? AND role = 'student' ORDER BY displayName ASC").all(id);
    res.json(students);
  });

  app.post("/api/groups", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { name, filiereId } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO groups (name, filiereId) VALUES (?, ?)");
      const result = stmt.run(name, filiereId);
      res.json({ id: Number(result.lastInsertRowid), name, filiereId });
    } catch (err: any) {
      res.status(400).json({ error: "Ce groupe existe déjà dans cette filière." });
    }
  });

  app.put("/api/groups/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const { name, filiereId } = req.body;
    try {
      db.prepare("UPDATE groups SET name = ?, filiereId = ? WHERE id = ?").run(name, filiereId, id);
      res.json({ id: Number(id), name, filiereId });
    } catch (err: any) {
      res.status(400).json({ error: "Nom de groupe déjà utilisé dans cette filière." });
    }
  });

  app.delete("/api/groups/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    
    // Check if users exist
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE groupId = ?").get(id) as any;
    if (usersCount.count > 0) {
      return res.status(400).json({ error: "Impossible de supprimer un groupe qui contient des étudiants." });
    }

    db.prepare("DELETE FROM groups WHERE id = ?").run(id);
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
        showHeaderLines: !!settings.showHeaderLines
      });
    } catch (err) {
      console.error("Error fetching settings:", err);
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { orgName, orgNameArabic, orgNameFrench, regionalDirection, institutionName, orgSubName, orgLogoUrl, regionName, academicYear, orgLogoBgColor, orgLogoTextColor, headerLines, showHeaderLines } = req.body;
    try {
      db.prepare(`
        UPDATE settings 
        SET orgName = ?, orgNameArabic = ?, orgNameFrench = ?, regionalDirection = ?, institutionName = ?, orgSubName = ?, orgLogoUrl = ?, regionName = ?, academicYear = ?, orgLogoBgColor = ?, orgLogoTextColor = ?, headerLines = ?, showHeaderLines = ?, updatedAt = CURRENT_TIMESTAMP 
        WHERE id = 1
      `).run(orgName, orgNameArabic, orgNameFrench, regionalDirection, institutionName, orgSubName, orgLogoUrl, regionName, academicYear, orgLogoBgColor, orgLogoTextColor, JSON.stringify(headerLines), showHeaderLines ? 1 : 0);
      
      const settings = db.prepare("SELECT * FROM settings WHERE id = 1").get() as any;
      res.json({
        ...settings,
        headerLines: settings.headerLines ? JSON.parse(settings.headerLines) : [],
        showHeaderLines: !!settings.showHeaderLines
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // --- Backup & Restore ---
  app.get("/api/admin/backup", authenticate, async (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const backupPath = `backup-${Date.now()}.db`;
    try {
      await db.backup(backupPath);
      res.download(backupPath, "eduqcm-backup.db", (err) => {
        if (fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
      });
    } catch (err: any) {
      console.error("Backup error:", err);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  app.post("/api/admin/restore", authenticate, upload.single("file"), async (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    try {
      const tempPath = req.file.path;
      console.log(`Starting database restore with file: ${tempPath}`);
      
      // Close current connection
      db.close();
      console.log("Database connection closed.");
      
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

  // --- Vite / Static ---
  if (process.env.NODE_ENV !== "production") {
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
