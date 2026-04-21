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

const JWT_SECRET = process.env.JWT_SECRET || "eduqcm-secret-key";

// --- Database Setup ---
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

let db = new Database("eduqcm.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const upload = multer({ dest: "uploads/" });

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    displayName TEXT NOT NULL,
    role TEXT CHECK(role IN ('student', 'teacher')) NOT NULL,
    groupName TEXT,
    filiere TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    teacherId INTEGER NOT NULL,
    filiereId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacherId) REFERENCES users(id),
    FOREIGN KEY(filiereId) REFERENCES filieres(id)
  );

  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    courseId INTEGER NOT NULL,
    teacherId INTEGER NOT NULL,
    durationMinutes INTEGER DEFAULT 30,
    questions TEXT NOT NULL, -- JSON string
    scheduledAt DATETIME,
    status TEXT DEFAULT 'draft', -- draft, active
    groupId INTEGER,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(courseId) REFERENCES courses(id),
    FOREIGN KEY(teacherId) REFERENCES users(id),
    FOREIGN KEY(groupId) REFERENCES groups(id)
  );

  CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    examId INTEGER NOT NULL,
    studentId INTEGER NOT NULL,
    score INTEGER NOT NULL,
    totalQuestions INTEGER NOT NULL,
    totalPoints INTEGER NOT NULL DEFAULT 0,
    answers TEXT NOT NULL, -- JSON string
    questionResults TEXT, -- JSON string [{isCorrect: boolean, points: number}]
    completedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(examId) REFERENCES exams(id),
    FOREIGN KEY(studentId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    teacherId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(teacherId) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS filieres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    filiereId INTEGER NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(filiereId) REFERENCES filieres(id)
  );
`);

// Ensure columns exist for existing databases
try { db.exec("ALTER TABLE users ADD COLUMN groupName TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE exams ADD COLUMN status TEXT DEFAULT 'draft'"); } catch (e) {}
try { db.exec("ALTER TABLE exams ADD COLUMN groupId INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN filiere TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN filiereId INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE users ADD COLUMN groupId INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE courses ADD COLUMN filiereId INTEGER"); } catch (e) {}
try { db.exec("ALTER TABLE results ADD COLUMN totalPoints INTEGER DEFAULT 0"); } catch (e) {}
try { db.exec("ALTER TABLE results ADD COLUMN questionResults TEXT"); } catch (e) {}
try { db.exec("ALTER TABLE exams ADD COLUMN scheduledAt DATETIME"); } catch (e) {}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

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
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id);
      if (!user) {
        res.clearCookie("token");
        return res.status(401).json({ error: "User no longer exists" });
      }
      
      req.user = { ...decoded, id: Number(decoded.id) };
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
      res.json({ user: null });
    }
  });

  // --- Data Routes ---
  app.get("/api/courses", authenticate, (req: any, res) => {
    let courses;
    if (req.user.role === 'teacher') {
      courses = db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM exams e WHERE e.courseId = c.id) as examsCount
        FROM courses c 
        WHERE c.teacherId = ?
        ORDER BY c.createdAt DESC
      `).all(req.user.id);
    } else {
      // Students only see courses assigned to their filiere
      courses = db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM exams e WHERE e.courseId = c.id) as examsCount
        FROM courses c 
        WHERE c.filiereId = ?
        ORDER BY c.createdAt DESC
      `).all(req.user.filiereId);
    }
    
    const parsedCourses = courses.map((c: any) => ({
      ...c,
      hasExams: c.examsCount > 0
    }));
    res.json(parsedCourses);
  });

  app.post("/api/courses", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    try {
      const { name, description, filiereId } = req.body;
      const fId = (filiereId && filiereId !== 0) ? filiereId : null;
      const stmt = db.prepare("INSERT INTO courses (name, description, teacherId, filiereId) VALUES (?, ?, ?, ?)");
      const result = stmt.run(name, description, req.user.id, fId);
      res.json({ id: Number(result.lastInsertRowid), name, description, teacherId: req.user.id, filiereId: fId });
    } catch (err: any) {
      console.error("Error creating course:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/courses/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    try {
      const { name, description, filiereId } = req.body;
      const { id } = req.params;
      const fId = (filiereId && filiereId !== 0) ? filiereId : null;
      const stmt = db.prepare("UPDATE courses SET name = ?, description = ?, filiereId = ? WHERE id = ? AND teacherId = ?");
      const result = stmt.run(name, description, fId, id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Course not found or unauthorized" });
      res.json({ id: Number(id), name, description, filiereId: fId });
    } catch (err: any) {
      console.error("Error updating course:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/courses/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;

    try {
      // Check if exams exist
      const examsCount = db.prepare("SELECT COUNT(*) as count FROM exams WHERE courseId = ?").get(id) as any;
      if (examsCount.count > 0) {
        return res.status(400).json({ error: "Impossible de supprimer un cours qui contient des examens." });
      }

      const stmt = db.prepare("DELETE FROM courses WHERE id = ? AND teacherId = ?");
      const result = stmt.run(id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Course not found or unauthorized" });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting course:", err);
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
      // Students only see exams for courses assigned to their filiere AND active for their group
      exams = db.prepare(`
        SELECT e.*, (SELECT COUNT(*) FROM results r WHERE r.examId = e.id) as resultsCount
        FROM exams e 
        JOIN courses c ON e.courseId = c.id
        WHERE c.filiereId = ? AND e.status = 'active' AND e.groupId = ?
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
      const { title, description, courseId, durationMinutes, questions, scheduledAt } = req.body;
      const stmt = db.prepare("INSERT INTO exams (title, description, courseId, teacherId, durationMinutes, questions, scheduledAt, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft')");
      const result = stmt.run(title, description, courseId, req.user.id, durationMinutes, JSON.stringify(questions), scheduledAt);
      res.json({ id: Number(result.lastInsertRowid), title, description, courseId, teacherId: req.user.id, durationMinutes, questions, scheduledAt, status: 'draft' });
    } catch (err: any) {
      console.error("Error creating exam:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/exams/:id/publish", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const { groupId } = req.body;
    
    if (!groupId) return res.status(400).json({ error: "Group ID is required" });

    try {
      const stmt = db.prepare("UPDATE exams SET status = 'active', groupId = ? WHERE id = ? AND teacherId = ?");
      const result = stmt.run(groupId, id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Exam not found or unauthorized" });
      res.json({ success: true, status: 'active', groupId });
    } catch (err: any) {
      console.error("Error publishing exam:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/exams/:id/unpublish", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;

    try {
      const stmt = db.prepare("UPDATE exams SET status = 'draft', groupId = NULL WHERE id = ? AND teacherId = ?");
      const result = stmt.run(id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Exam not found or unauthorized" });
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
      // Check if results exist
      const resultsCount = db.prepare("SELECT COUNT(*) as count FROM results WHERE examId = ?").get(id) as any;
      if (resultsCount.count > 0) {
        return res.status(400).json({ error: "Impossible de modifier un examen qui a déjà des résultats." });
      }

      const { title, description, courseId, durationMinutes, questions, scheduledAt } = req.body;
      const stmt = db.prepare("UPDATE exams SET title = ?, description = ?, courseId = ?, durationMinutes = ?, questions = ?, scheduledAt = ? WHERE id = ? AND teacherId = ?");
      const result = stmt.run(title, description, courseId, durationMinutes, JSON.stringify(questions), scheduledAt, id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Exam not found or unauthorized" });
      res.json({ id: Number(id), title, description, courseId, durationMinutes, questions, scheduledAt });
    } catch (err: any) {
      console.error("Error updating exam:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/exams/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;

    try {
      // Check if results exist
      const resultsCount = db.prepare("SELECT COUNT(*) as count FROM results WHERE examId = ?").get(id) as any;
      if (resultsCount.count > 0) {
        return res.status(400).json({ error: "Impossible de supprimer un examen qui a déjà des résultats." });
      }

      const stmt = db.prepare("DELETE FROM exams WHERE id = ? AND teacherId = ?");
      const result = stmt.run(id, req.user.id);
      if (result.changes === 0) return res.status(404).json({ error: "Exam not found or unauthorized" });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting exam:", err);
      res.status(500).json({ error: err.message });
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

  app.get("/api/students/count", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const count = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get() as any;
    res.json({ count: count.count });
  });

  app.post("/api/results", authenticate, (req: any, res) => {
    if (req.user.role !== 'student') return res.status(403).json({ error: "Forbidden" });
    try {
      const { examId, score, totalQuestions, totalPoints, answers, questionResults } = req.body;
      const stmt = db.prepare("INSERT INTO results (examId, studentId, score, totalQuestions, totalPoints, answers, questionResults) VALUES (?, ?, ?, ?, ?, ?, ?)");
      const result = stmt.run(examId, req.user.id, score, totalQuestions, totalPoints || 0, JSON.stringify(answers), questionResults ? JSON.stringify(questionResults) : null);
      res.json({ id: result.lastInsertRowid, examId, studentId: req.user.id, score, totalQuestions, totalPoints: totalPoints || 0, answers, questionResults });
    } catch (err: any) {
      console.error("Error saving result:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/notifications", authenticate, (req, res) => {
    const notifs = db.prepare("SELECT * FROM notifications ORDER BY createdAt DESC").all();
    res.json(notifs);
  });

  app.post("/api/notifications", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    try {
      const { title, content } = req.body;
      const stmt = db.prepare("INSERT INTO notifications (title, content, teacherId) VALUES (?, ?, ?)");
      const result = stmt.run(title, content, req.user.id);
      const notif = { id: result.lastInsertRowid, title, content, teacherId: req.user.id, createdAt: new Date().toISOString() };
      io.emit("notification", notif);
      res.json(notif);
    } catch (err: any) {
      console.error("Error creating notification:", err);
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
    const { name } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO filieres (name) VALUES (?)");
      const result = stmt.run(name);
      res.json({ id: result.lastInsertRowid, name });
    } catch (err: any) {
      res.status(400).json({ error: "Cette filière existe déjà." });
    }
  });

  app.put("/api/filieres/:id", authenticate, (req: any, res) => {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
    const { id } = req.params;
    const { name } = req.body;
    try {
      db.prepare("UPDATE filieres SET name = ? WHERE id = ?").run(name, id);
      res.json({ id, name });
    } catch (err: any) {
      res.status(400).json({ error: "Nom de filière déjà utilisé." });
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
      res.json({ id: result.lastInsertRowid, name, filiereId });
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
      res.json({ id, name, filiereId });
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
        host: '0.0.0.0',
        port: 3000
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
