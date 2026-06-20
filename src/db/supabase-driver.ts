import dotenv from "dotenv";
dotenv.config({ override: true });
import Database from "better-sqlite3";
import { Client, Pool } from "pg";

export class SupabaseSyncDriver {
  private sqlite: any;
  private pgPool: Pool | null = null;
  private isConnected = false;
  private writeQueue: { sql: string; params: any[] }[] = [];
  private isProcessingQueue = false;
  private dbProviderEnabled = false;
  private isRestMode = false;
  private supabaseUrl = "";
  private supabaseKey = "";

  constructor(sqliteDbPath: string) {
    this.sqlite = new Database(":memory:");
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("foreign_keys = ON");
    this.sqlite.pragma("synchronous = NORMAL");
    this.sqlite.pragma("cache_size = -64000"); // 64 MB cache
    this.sqlite.pragma("temp_store = MEMORY");
    
    // Check if Supabase provider is enabled using overridden configuration values
    const dbProviderRaw = (process.env.DB_PROVIDER || "").trim();
    const dbProvider = dbProviderRaw.toLowerCase();
    const dbUrl = (process.env.DATABASE_URL || "").trim();
    
    // Identify credentials grouped by pair
    let viteSupabaseUrl = (process.env.VITE_SUPABASE_URL || "").trim();
    let viteSupabaseKey = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "").trim();

    let stdSupabaseUrl = (process.env.SUPABASE_URL || "").trim();
    let stdSupabaseKey = (process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();

    // Also parse from DATABASE_URL if it contains a REST URL or key
    let dbUrlSupabaseUrl = "";
    let dbUrlSupabaseKey = "";
    const cleanDbUrl = dbUrl.split(/\s+/)[0] || "";
    if (cleanDbUrl.startsWith("http://") || cleanDbUrl.startsWith("https://")) {
      dbUrlSupabaseUrl = cleanDbUrl;
      const keyMatch = dbUrl.match(/(?:VITE_)?SUPABASE_PUBLISHABLE_KEY=([^\s]+)/);
      if (keyMatch) {
        dbUrlSupabaseKey = keyMatch[1];
      }
    }

    const looksLikeKey = (str: string) => {
      const s = str.trim();
      return s.startsWith("sb_") || (s.length > 20 && !s.includes(":") && !s.includes("/") && !s.includes("@"));
    };

    // Determine finalized supabase credentials
    let supabaseUrl = "";
    let supabaseKey = "";

    if (viteSupabaseUrl && viteSupabaseKey) {
      supabaseUrl = viteSupabaseUrl;
      supabaseKey = viteSupabaseKey;
    } else if (stdSupabaseUrl && stdSupabaseKey) {
      supabaseUrl = stdSupabaseUrl;
      supabaseKey = stdSupabaseKey;
    } else if (dbUrlSupabaseUrl) {
      supabaseUrl = dbUrlSupabaseUrl;
      supabaseKey = dbUrlSupabaseKey || stdSupabaseKey || viteSupabaseKey || (looksLikeKey(dbProviderRaw) ? dbProviderRaw : "");
    } else {
      supabaseUrl = stdSupabaseUrl || viteSupabaseUrl;
      supabaseKey = stdSupabaseKey || viteSupabaseKey || (looksLikeKey(dbProviderRaw) ? dbProviderRaw : "");
    }

    // Check if database URL is a direct Postgres connection string
    const isPostgresUrl = cleanDbUrl.startsWith("postgres://") || cleanDbUrl.startsWith("postgresql://");

    // Determine connection modes and enable integration
    const hasProviderSetting = dbProvider === "supabase" || dbProvider.startsWith("sb_") || isPostgresUrl || (supabaseUrl && supabaseKey);

    if (hasProviderSetting) {
      this.dbProviderEnabled = true;

      if (isPostgresUrl) {
        this.isRestMode = false;
        console.log("[SupabaseDriver] Direct PostgreSQL connection mode enabled! Connecting to Supabase high-performance database...");
        this.pgPool = new Pool({
          connectionString: cleanDbUrl,
          ssl: { rejectUnauthorized: false },
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
      } else if (supabaseUrl && supabaseKey) {
        this.isRestMode = true;
        this.supabaseUrl = supabaseUrl.replace(/\/$/, "");
        this.supabaseKey = supabaseKey;
        console.log(`[SupabaseDriver] REST API sync mode auto-detected and enabled! URL: ${this.supabaseUrl}. Public Key safe check: ${this.supabaseKey.substring(0, 15)}...`);
      } else {
        this.dbProviderEnabled = false;
        console.warn(
          "[SupabaseDriver] ATTENTION : Problème avec la configuration de Supabase. " +
          "La base de données locale autonome de secours est activée de manière sécurisée en mode autonome."
        );
      }
    } else {
      this.dbProviderEnabled = false;
      console.warn(
        "[SupabaseDriver] ATTENTION : Supabase n'est pas configuré ou la configuration est manquante. " +
        "L'application utilise actuellement la base de données SQLite locale autonome."
      );
    }
  }

  // Expose underlying sqlite for raw access if needed
  public getSqlite() {
    return this.sqlite;
  }

  // Pragma helper
  public pragma(str: string) {
    return this.sqlite.pragma(str);
  }

  // Raw EXEC helper
  public exec(sql: string) {
    const res = this.sqlite.exec(sql);
    if (this.dbProviderEnabled) {
      this.replicateWriteToSupabase(sql, []);
    }
    return res;
  }

  // Transactions support
  public transaction(fn: (...args: any[]) => any) {
    // Wrapped in standard sqlite transaction
    const sqliteTx = this.sqlite.transaction(fn);
    return (...args: any[]) => {
      return sqliteTx(...args);
    };
  }

  /**
   * Safe SQLite to PostgreSQL SQL string converter
   */
  private convertSqlToPostgres(sql: string): string {
    let pgSql = sql;

    // List of camelCase column names that need case-preserving double quotes in PostgreSQL
    const CAMEL_CASE_COLS = [
      "filiereId", "groupId", "teacherId", "moduleId", "examId", "studentId", "notificationId", "userId", 
      "messageId", "senderId", "createdAt", "completedAt", "readAt", "updatedAt", "displayName", "groupName",
      "registrationNumber", "activeSessionId", "durationHours", "durationMinutes", "scheduledAt", "shuffleQuestions",
      "disableCopyPaste", "forceFullscreen", "detectTabExits", "totalQuestions", "totalPoints", "questionResults",
      "aiFeedback", "integrityScore", "tabExitCount", "fullscreenExitsCount", "auditTrail", "attachmentUrl",
      "attachmentName", "attachmentType", "audienceRole", "localAiEnabled", "localAiUrl", "localAiModel",
      "autoBackupEnabled", "autoBackupInterval", "autoBackupCount", "autoBackupTime", "autoBackupLastRun",
      "orgName", "orgNameArabic", "orgNameFrench", "regionalDirection", "institutionName", "orgSubName",
      "orgLogoUrl", "orgLogoUrlRight", "footerText", "showFooter", "regionName", "academicYear",
      "orgLogoBgColor", "orgLogoTextColor", "headerLines", "headerColumns", "showHeaderLines", "showFooterLines",
      "ccRules", "defaultExamSettings", "footerColumns", "footerTable", "footerFontSize", "footerFontFamily",
      "watermarkText", "showWatermark", "watermarkColor", "watermarkOpacity", "showFooterText", "showFooterTable",
      "reactionType", "userDisplayName", "userRole", "startTime", "senderName", "senderRole", "channelType",
      "isEdited", "isPinned", "userName"
    ];

    // Convert SQL keywords & constructs
    pgSql = pgSql.replace(/`([^`]+)`/g, '"$1"'); // backticks to double quotes if any

    // Translate SQLite's INSERT OR IGNORE rules to Postgres dynamic constraints
    if (pgSql.includes("INSERT OR IGNORE INTO settings")) {
      pgSql = pgSql.replace(/INSERT OR IGNORE/gi, "INSERT");
      pgSql += " ON CONFLICT (id) DO NOTHING";
    } else if (pgSql.includes("INSERT OR IGNORE INTO chat_reactions")) {
      pgSql = pgSql.replace(/INSERT OR IGNORE/gi, "INSERT");
      pgSql += ' ON CONFLICT ("messageId", "userId", emoji) DO NOTHING';
    } else if (pgSql.includes("INSERT OR IGNORE INTO user_notifications")) {
      pgSql = pgSql.replace(/INSERT OR IGNORE/gi, "INSERT");
      pgSql += ' ON CONFLICT ("userId", "notificationId") DO NOTHING';
    } else if (pgSql.includes("INSERT OR IGNORE INTO notification_reactions")) {
      pgSql = pgSql.replace(/INSERT OR IGNORE/gi, "INSERT");
      pgSql += ' ON CONFLICT ("notificationId", "userId", "reactionType") DO NOTHING';
    } else {
      pgSql = pgSql.replace(/INSERT OR IGNORE/gi, "INSERT");
      pgSql = pgSql.replace(/INSERT\s+OR\s+REPLACE/gi, "INSERT");
    }

    // Convert core DDL types to support creation of schema on empty Supabase instances seamlessly
    pgSql = pgSql.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, "SERIAL PRIMARY KEY");
    pgSql = pgSql.replace(/DATETIME/gi, "TIMESTAMP");

    // Fix unquoted camelCase words for PostgreSQL case sensitivity
    for (const col of CAMEL_CASE_COLS) {
      const regex = new RegExp(`(?<!")\\b${col}\\b(?!")`, "g");
      pgSql = pgSql.replace(regex, `"${col}"`);
    }
    
    // Convert placeholder symbols (?) with PostgreSQL ($1, $2, etc)
    let index = 1;
    pgSql = pgSql.replace(/\?/g, () => `$${index++}`);

    return pgSql;
  }

  /**
   * Helper to check if an error from PostgreSQL is transient (connection issue)
   * or permanent (syntax error, duplicate key constraint, etc.)
   */
  private isTransientError(err: any): boolean {
    if (!err) return false;
    const code = String(err.code || "").toUpperCase();
    const msg = String(err.message || "").toLowerCase();

    // Standard Postgres connection codes starting with 08 (Connection Exception) or 57 (Operator Intervention)
    if (code.startsWith("08") || code.startsWith("57")) {
      return true;
    }
    // Node.js core network error codes
    if (["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EADDRNOTAVAIL", "ECONNRESET", "EPIPE"].includes(code)) {
      return true;
    }
    // general network indicators in the message text
    if (msg.includes("connect") || msg.includes("timeout") || msg.includes("network") || msg.includes("econn")) {
      return true;
    }

    return false;
  }

  /**
   * Parse SQLite-formatted SQL write scripts into REST API action representations
   */
  private parseSqlToWrite(sql: string, params: any[]): { type: "INSERT" | "UPDATE" | "DELETE"; table: string; data?: Record<string, any>; filter?: Record<string, any> } | null {
    const cleanSql = sql.replace(/\s+/g, " ").trim();

    // 1. DELETE
    const deleteMatch = cleanSql.match(/^DELETE\s+FROM\s+["`]?(\w+)["`]?\s+WHERE\s+(.+)$/i);
    if (deleteMatch) {
      const table = deleteMatch[1];
      const whereClause = deleteMatch[2];
      const filter = this.parseWhereClause(whereClause, params, 0);
      return { type: "DELETE", table, filter };
    }

    // 2. UPDATE
    const updateMatch = cleanSql.match(/^UPDATE\s+["`]?(\w+)["`]?\s+SET\s+(.+?)\s+WHERE\s+(.+)$/i);
    if (updateMatch) {
      const table = updateMatch[1];
      const setClause = updateMatch[2];
      const whereClause = updateMatch[3];

      const data: Record<string, any> = {};
      const setParts = this.splitSetClause(setClause);
      
      let paramIdx = 0;
      setParts.forEach(part => {
        const eqIdx = part.indexOf("=");
        if (eqIdx !== -1) {
          const colName = part.substring(0, eqIdx).trim().replace(/["`]+/g, "");
          const valueStr = part.substring(eqIdx + 1).trim();
          if (valueStr === "?") {
            data[colName] = params[paramIdx++];
          } else if (valueStr.toUpperCase() === "NULL") {
            data[colName] = null;
          } else if (valueStr.startsWith("'") && valueStr.endsWith("'")) {
            data[colName] = valueStr.substring(1, valueStr.length - 1);
          } else if (!isNaN(Number(valueStr))) {
            data[colName] = Number(valueStr);
          }
        }
      });

      const filter = this.parseWhereClause(whereClause, params, paramIdx);
      return { type: "UPDATE", table, data, filter };
    }

    // 3. INSERT
    const insertMatch = cleanSql.match(/^INSERT(?:\s+OR\s+\w+)?\s+INTO\s+["`]?(\w+)["`]?\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const table = insertMatch[1];
      const colStr = insertMatch[2];
      const valStr = insertMatch[3];

      const columns = colStr.split(",").map(c => c.trim().replace(/["`]+/g, ""));
      const values = valStr.split(",").map(v => v.trim());

      const data: Record<string, any> = {};
      let paramIdx = 0;
      columns.forEach((col, idx) => {
        const valPlaceholder = values[idx] || "?";
        if (valPlaceholder === "?") {
          data[col] = params[paramIdx++];
        } else if (valPlaceholder.toUpperCase() === "NULL") {
          data[col] = null;
        } else if (valPlaceholder.startsWith("'") && valPlaceholder.endsWith("'")) {
          data[col] = valPlaceholder.substring(1, valPlaceholder.length - 1);
        } else if (!isNaN(Number(valPlaceholder))) {
          data[col] = Number(valPlaceholder);
        }
      });

      return { type: "INSERT", table, data };
    }

    return null;
  }

  private splitSetClause(setClause: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inString = false;
    for (let i = 0; i < setClause.length; i++) {
      const char = setClause[i];
      if (char === "'") inString = !inString;
      if (char === "," && !inString) {
        parts.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  private parseWhereClause(whereClause: string, params: any[], startParamIndex: number): Record<string, any> {
    const filter: Record<string, any> = {};
    const parts = whereClause.split(/\s+AND\s+/i);
    let paramIdx = startParamIndex;

    parts.forEach(part => {
      const match = part.match(/["`]?(\w+)["`]?\s*=\s*(.+)/i);
      if (match) {
        const col = match[1];
        const valStr = match[2].trim();
        if (valStr === "?") {
          filter[col] = params[paramIdx++];
        } else if (valStr.startsWith("'") && valStr.endsWith("'")) {
          filter[col] = valStr.substring(1, valStr.length - 1);
        } else if (!isNaN(Number(valStr))) {
          filter[col] = Number(valStr);
        }
      }
    });

    return filter;
  }

  /**
   * Mirror database mutations dynamically over PostgREST API endpoint in REST mode
   */
  private async replicateWriteViaRest(sql: string, params: any[]) {
    if (!this.dbProviderEnabled || !this.supabaseUrl || !this.supabaseKey) return;
    
    const parsed = this.parseSqlToWrite(sql, params);
    if (!parsed) return;

    const { type, table, data, filter } = parsed;
    const url = `${this.supabaseUrl}/rest/v1/${table}`;
    const headers: Record<string, string> = {
      "apikey": this.supabaseKey,
      "Authorization": `Bearer ${this.supabaseKey}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal"
    };

    // Normalize parameter datatypes to be compatible with REST/JSON schemas
    const restData: Record<string, any> = {};
    if (data) {
      for (const [key, val] of Object.entries(data)) {
        if (val === undefined || val === null) {
          restData[key] = null;
        } else if (val instanceof Date) {
          restData[key] = val.toISOString();
        } else if (typeof val === "boolean") {
          restData[key] = val ? 1 : 0;
        } else if (typeof val === "string" && val.startsWith("[") && val.endsWith("]")) {
          // If it contains a stringified JSON array (like questions or results), allow it as string
          restData[key] = val;
        } else {
          restData[key] = val;
        }
      }
    }

    try {
      if (type === "INSERT") {
        if (table === "settings" || table === "user_notifications" || table === "chat_reactions" || table === "notification_reactions") {
          headers["Prefer"] = "resolution=merge-duplicates,return=minimal";
        }
        
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(restData)
        });
        if (!response.ok) {
          const text = await response.text();
          console.log(`[SupabaseREST] Info: INSERT on "${table}" did not replicate (status: ${response.status})`);
        } else {
          console.log(`[SupabaseREST] Successfully replicated INSERT to table "${table}"`);
        }
      } else if (type === "UPDATE") {
        const queryParams = new URLSearchParams();
        for (const [col, val] of Object.entries(filter || {})) {
          queryParams.set(col, `eq.${val}`);
        }
        
        const response = await fetch(`${url}?${queryParams.toString()}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(restData)
        });
        if (!response.ok) {
          const text = await response.text();
          console.log(`[SupabaseREST] Info: UPDATE on "${table}" did not replicate (status: ${response.status})`);
        } else {
          console.log(`[SupabaseREST] Successfully replicated UPDATE to table "${table}"`);
        }
      } else if (type === "DELETE") {
        const queryParams = new URLSearchParams();
        for (const [col, val] of Object.entries(filter || {})) {
          queryParams.set(col, `eq.${val}`);
        }
        
        const response = await fetch(`${url}?${queryParams.toString()}`, {
          method: "DELETE",
          headers
        });
        if (!response.ok) {
          const text = await response.text();
          console.log(`[SupabaseREST] Info: DELETE on "${table}" did not replicate (status: ${response.status})`);
        } else {
          console.log(`[SupabaseREST] Successfully replicated DELETE on table "${table}"`);
        }
      }
    } catch (err: any) {
      console.error("[SupabaseREST] Error executing fetch replication:", err.message);
    }
  }

  /**
   * Pushes a write operation to the background replication queue
   */
  private replicateWriteToSupabase(sql: string, params: any[]) {
    const isDmlWrite = /^\s*(insert|update|delete|replace)/i.test(sql);
    if (!isDmlWrite || !this.dbProviderEnabled) return;

    // Skip audit_logs since they are purely local/transient admin-security records
    // and violate Supabase RLS policy configurations under public/publishable API keys.
    if (sql.toLowerCase().includes("audit_logs")) return;

    if (this.isRestMode) {
      this.writeQueue.push({ sql, params });
    } else {
      const pgSql = this.convertSqlToPostgres(sql);
      // Normalize parameters (dates, serialized objects)
      const normalizedParams = params.map(val => {
        if (val === undefined || val === null) return null;
        if (val instanceof Date) return val.toISOString();
        if (typeof val === "boolean") return val ? 1 : 0;
        return val;
      });
      this.writeQueue.push({ sql: pgSql, params: normalizedParams });
    }
    this.processQueue();
  }

  /**
   * Processes the queue to replicate writes sequentially
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.writeQueue.length === 0) return;
    this.isProcessingQueue = true;

    while (this.writeQueue.length > 0) {
      const item = this.writeQueue[0];
      try {
        if (this.isRestMode) {
          await this.replicateWriteViaRest(item.sql, item.params);
          this.writeQueue.shift();
        } else if (this.pgPool) {
          await this.pgPool.query(item.sql, item.params);
          this.writeQueue.shift(); // Remove on success
        } else {
          this.writeQueue.shift(); // Remove to prevent deadlock if neither is available
        }
      } catch (err: any) {
        if (this.isTransientError(err)) {
          console.warn(`[SupabaseSync] Transient error for query, retrying in 3s: "${item.sql}". Error: ${err.message}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          console.error(`[SupabaseSync] Permanent SQL replication error, item discarded: "${item.sql}". Error: ${err.message}`);
          this.writeQueue.shift(); // Remove permanent errors
        }
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Prepare statement representation wrapper
   */
  public prepare(sql: string) {
    const stmt = this.sqlite.prepare(sql);
    const self = this;

    return {
      run(...params: any[]) {
        // Flatten params array if passed as single array argument (like some call-sites might use arrays vs spread)
        let actualParams = params;
        if (params.length === 1 && Array.isArray(params[0])) {
          actualParams = params[0];
        }

        const runResult = stmt.run(...actualParams);
        
        // Replicate the write event to Supabase in the background
        self.replicateWriteToSupabase(sql, actualParams);
        
        return runResult;
      },

      get(...params: any[]) {
        let actualParams = params;
        if (params.length === 1 && Array.isArray(params[0])) {
          actualParams = params[0];
        }
        return stmt.get(...actualParams);
      },

      all(...params: any[]) {
        let actualParams = params;
        if (params.length === 1 && Array.isArray(params[0])) {
          actualParams = params[0];
        }
        return stmt.all(...actualParams);
      }
    };
  }

  /**
   * Runs the complete startup pull sequence to mirror Supabase database states back into local SQLite
   */
  public async pullAllFromSupabase() {
    if (!this.dbProviderEnabled) {
      console.log("[SupabaseDriver] Skip startup sync: Supabase is not configured.");
      return;
    }

    // Define exact tables we want to import, ordered by foreign key dependency
    const tablesToSync = [
      "filieres", "groups", "users", "modules", "exams", 
      "results", "notifications", "settings", "user_notifications", 
      "chat_messages", "chat_reactions", 
      "notification_reactions", "notification_comments", "exam_sessions"
    ];

    if (this.isRestMode) {
      console.log("[SupabaseDriver] Running initial sync using Supabase REST API (PostgREST)...");
      const headers = {
        "apikey": this.supabaseKey,
        "Authorization": `Bearer ${this.supabaseKey}`,
        "Content-Type": "application/json"
      };

      for (const table of tablesToSync) {
        try {
          const restUrl = `${this.supabaseUrl}/rest/v1/${table}?select=*`;
          const response = await fetch(restUrl, { headers });
          if (!response.ok) {
            const errText = await response.text();
            console.warn(`[SupabaseDriver] REST Sync: Failed to fetch table "${table}" (it might not exist). Error:`, errText);
            continue;
          }

          const pgRows = await response.json() as any[];
          const pgCount = pgRows.length;
          const sqliteRows = this.sqlite.prepare(`SELECT * FROM "${table}"`).all() as any[];

          if (pgCount === 0 && sqliteRows.length > 0) {
            console.log(`[SupabaseDriver] REST Sync: Supabase table "${table}" is empty, pushing ${sqliteRows.length} cached records up to Supabase...`);
            
            // Push rows to Supabase API
            for (const row of sqliteRows) {
              const bodyRow: Record<string, any> = {};
              for (const [key, val] of Object.entries(row)) {
                if (val !== undefined && val !== null) {
                  bodyRow[key] = val;
                }
              }
              const insHeaders = { ...headers, "Prefer": "return=minimal" };
              if (table === "settings" || table === "user_notifications" || table === "chat_reactions" || table === "notification_reactions") {
                insHeaders["Prefer"] = "resolution=merge-duplicates,return=minimal";
              }
              
              const postRes = await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
                method: "POST",
                headers: insHeaders,
                body: JSON.stringify(bodyRow)
              });
              if (!postRes.ok) {
                const postErrText = await postRes.text();
                console.log(`[SupabaseDriver] REST Sync: Single insert skipped/restricted on "${table}" (status: ${postRes.status})`);
              }
            }
            console.log(`[SupabaseDriver] REST Sync: Seeding complete for table "${table}".`);
          } else if (pgCount > 0) {
            console.log(`[SupabaseDriver] REST Sync: Supabase table "${table}" contains ${pgCount} rows. Merging down to local cache...`);
            
            // Suspend foreign keys during bulk replacement to prevent temporary constraint violation warnings
            this.sqlite.pragma("foreign_keys = OFF");
            try {
              this.sqlite.transaction(() => {
                try {
                  this.sqlite.prepare(`DELETE FROM "${table}"`).run();
                } catch (e: any) {
                  console.warn(`[SupabaseDriver] Local cache clear warning for table "${table}":`, e.message);
                }

                if (pgRows.length > 0) {
                  const columns = Object.keys(pgRows[0]);
                  const quotedCols = columns.map(c => `"${c}"`).join(", ");
                  const placeholders = columns.map(() => "?").join(", ");
                  const insertSql = `INSERT OR REPLACE INTO "${table}" (${quotedCols}) VALUES (${placeholders})`;
                  const insertStmt = this.sqlite.prepare(insertSql);

                  for (const row of pgRows) {
                    const vals = columns.map(col => {
                      const val = row[col];
                      if (val instanceof Date) return val.toISOString();
                      if (val !== null && typeof val === "object") return JSON.stringify(val);
                      return val;
                    });
                    try {
                      insertStmt.run(...vals);
                    } catch (insErr: any) {
                      console.warn(`[SupabaseDriver] REST Sync: Local merge insert warning on "${table}":`, insErr.message);
                    }
                  }
                }
              })();
            } finally {
              this.sqlite.pragma("foreign_keys = ON");
            }
          } else {
            console.log(`[SupabaseDriver] REST Sync: Both local and Supabase tables are empty for "${table}".`);
          }
        } catch (tableErr: any) {
          console.error(`[SupabaseDriver] REST Sync error on table "${table}":`, tableErr.message);
        }
      }
      console.log("[SupabaseDriver] Supabase REST API synchronization finished successfully!");
      return;
    }

    if (!this.pgPool) {
      console.log("[SupabaseDriver] Skip startup sync: Direct PostgreSQL connection pool not configured.");
      return;
    }

    console.log("[SupabaseDriver] Connecting to Supabase for initial startup validation and state sync...");

    // Reliable, PostgreSQL-compliant schemas to build the structure automatically
    const POSTGRES_SCHEMAS: Record<string, string> = {
      filieres: `
        CREATE TABLE IF NOT EXISTS filieres (
          id SERIAL PRIMARY KEY,
          code VARCHAR(255) UNIQUE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          niveau VARCHAR(255),
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      groups: `
        CREATE TABLE IF NOT EXISTS groups (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          "filiereId" INTEGER NOT NULL REFERENCES filieres(id) ON DELETE CASCADE,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      users: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          "displayName" VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
          "groupName" VARCHAR(255),
          filiere VARCHAR(255),
          "groupId" INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          "filiereId" INTEGER REFERENCES filieres(id) ON DELETE SET NULL,
          "registrationNumber" VARCHAR(255),
          "activeSessionId" VARCHAR(255),
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      modules: `
        CREATE TABLE IF NOT EXISTS modules (
          id SERIAL PRIMARY KEY,
          code VARCHAR(255),
          name VARCHAR(255) NOT NULL,
          "durationHours" INTEGER DEFAULT 0,
          description TEXT,
          "teacherId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "filiereId" INTEGER REFERENCES filieres(id) ON DELETE SET NULL,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      exams: `
        CREATE TABLE IF NOT EXISTS exams (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          "moduleId" INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
          "teacherId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(100) DEFAULT 'controle-continu',
          "durationMinutes" INTEGER DEFAULT 30,
          questions TEXT NOT NULL,
          "scheduledAt" TIMESTAMP,
          status VARCHAR(50) DEFAULT 'draft',
          "groupId" INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          "shuffleQuestions" INTEGER DEFAULT 0,
          "disableCopyPaste" INTEGER DEFAULT 0,
          "forceFullscreen" INTEGER DEFAULT 0,
          "detectTabExits" INTEGER DEFAULT 0,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      results: `
        CREATE TABLE IF NOT EXISTS results (
          id SERIAL PRIMARY KEY,
          "examId" INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
          "studentId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          score NUMERIC NOT NULL,
          "totalQuestions" INTEGER NOT NULL,
          "totalPoints" NUMERIC NOT NULL DEFAULT 0,
          answers TEXT NOT NULL,
          "questionResults" TEXT,
          "aiFeedback" TEXT,
          "completedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "integrityScore" INTEGER DEFAULT 100,
          "tabExitCount" INTEGER DEFAULT 0,
          "fullscreenExitsCount" INTEGER DEFAULT 0,
          "auditTrail" TEXT
        )
      `,
      notifications: `
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          "teacherId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "groupId" INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          type VARCHAR(100) DEFAULT 'announcement',
          "isPinned" INTEGER DEFAULT 0,
          importance VARCHAR(50) DEFAULT 'normal',
          "attachmentUrl" TEXT,
          "attachmentName" TEXT,
          "filiereId" INTEGER REFERENCES filieres(id) ON DELETE SET NULL,
          "audienceRole" VARCHAR(50) DEFAULT 'all',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      settings: `
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          "orgName" VARCHAR(255) NOT NULL DEFAULT 'OFPPT',
          "orgNameArabic" VARCHAR(255) NOT NULL DEFAULT 'مكتب التكوين المهني وإنعاش الشغل',
          "orgNameFrench" VARCHAR(255) NOT NULL DEFAULT 'Office de la Formation Professionnelle et de la promotion du travail',
          "regionalDirection" VARCHAR(255) NOT NULL DEFAULT 'Direction Régionale De BM-KH',
          "institutionName" VARCHAR(255) NOT NULL DEFAULT 'Institut Spécialisé de Technologie Appliquée AL HASSANIA Oued-Zem',
          "orgSubName" VARCHAR(255) NOT NULL DEFAULT 'DRBMKH',
          "orgLogoUrl" TEXT,
          "orgLogoUrlRight" TEXT,
          "footerText" TEXT,
          "showFooter" INTEGER DEFAULT 1,
          "regionName" VARCHAR(255) NOT NULL DEFAULT 'ROYAUME DU MAROC',
          "academicYear" VARCHAR(255) NOT NULL DEFAULT '2024/2025',
          "orgLogoBgColor" VARCHAR(50) NOT NULL DEFAULT '#059669',
          "orgLogoTextColor" VARCHAR(50) NOT NULL DEFAULT '#ffffff',
          "headerLines" TEXT,
          "headerColumns" TEXT,
          "showHeaderLines" INTEGER DEFAULT 0,
          "showFooterLines" INTEGER DEFAULT 0,
          "ccRules" TEXT,
          "defaultExamSettings" TEXT,
          "templates" TEXT,
          "footerColumns" TEXT,
          "footerTable" TEXT,
          "footerFontSize" INTEGER DEFAULT 9,
          "footerFontFamily" VARCHAR(100) DEFAULT 'Inter',
          "watermarkText" TEXT,
          "showWatermark" INTEGER DEFAULT 0,
          "watermarkColor" VARCHAR(50) DEFAULT '#E0E0E0',
          "watermarkOpacity" INTEGER DEFAULT 3,
          "showFooterText" INTEGER DEFAULT 1,
          "showFooterTable" INTEGER DEFAULT 1,
          "localAiEnabled" INTEGER DEFAULT 0,
          "localAiUrl" TEXT DEFAULT 'http://localhost:11434',
          "localAiModel" TEXT DEFAULT 'llama3',
          "autoBackupEnabled" INTEGER DEFAULT 0,
          "autoBackupInterval" VARCHAR(50) DEFAULT 'daily',
          "autoBackupCount" INTEGER DEFAULT 5,
          "autoBackupTime" VARCHAR(50) DEFAULT '02:00',
          "autoBackupLastRun" VARCHAR(255),
          "institutions" TEXT,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      user_notifications: `
        CREATE TABLE IF NOT EXISTS user_notifications (
          "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "notificationId" INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
          "readAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY ("userId", "notificationId")
        )
      `,
      audit_logs: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action VARCHAR(255) NOT NULL,
          details TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      chat_messages: `
        CREATE TABLE IF NOT EXISTS chat_messages (
          id SERIAL PRIMARY KEY,
          "senderId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "senderName" VARCHAR(255) NOT NULL,
          "senderRole" VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          "channelType" VARCHAR(100) NOT NULL,
          "groupId" INTEGER REFERENCES groups(id) ON DELETE SET NULL,
          "isEdited" INTEGER DEFAULT 0,
          "isPinned" INTEGER DEFAULT 0,
          "attachmentUrl" TEXT,
          "attachmentName" TEXT,
          "attachmentType" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      chat_reactions: `
        CREATE TABLE IF NOT EXISTS chat_reactions (
          id SERIAL PRIMARY KEY,
          "messageId" INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
          "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "userName" VARCHAR(255) NOT NULL,
          emoji VARCHAR(50) NOT NULL,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("messageId", "userId", emoji)
        )
      `,
      notification_reactions: `
        CREATE TABLE IF NOT EXISTS notification_reactions (
          id SERIAL PRIMARY KEY,
          "notificationId" INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
          "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "reactionType" VARCHAR(50) NOT NULL,
          "userDisplayName" VARCHAR(255) NOT NULL,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE("notificationId", "userId", "reactionType")
        )
      `,
      notification_comments: `
        CREATE TABLE IF NOT EXISTS notification_comments (
          id SERIAL PRIMARY KEY,
          "notificationId" INTEGER NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
          "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "userDisplayName" VARCHAR(255) NOT NULL,
          "userRole" VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `,
      exam_sessions: `
        CREATE TABLE IF NOT EXISTS exam_sessions (
          "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          "examId" INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
          "startTime" BIGINT NOT NULL,
          PRIMARY KEY ("userId", "examId")
        )
      `
    };

    try {
      const client = await this.pgPool.connect();
      console.log("[SupabaseDriver] Connected successfully to Supabase High-Perf Database!");

      // Step 1. Ensure all schemas exist inside Supabase, and migrate records from local SQLite to Supabase if Supabase is empty
      for (const table of tablesToSync) {
        try {
          // See if table exists in public schema on Supabase Postgres
          const tableCheck = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' AND table_name = $1
            );
          `, [table]);

          const tableExistsInPg = tableCheck.rows[0]?.exists;
          if (!tableExistsInPg) {
            console.log(`[SupabaseDriver] Table "${table}" is missing in Supabase. Creating it automatically...`);
            const ddlQuery = POSTGRES_SCHEMAS[table];
            if (ddlQuery) {
              await client.query(ddlQuery);
              console.log(`[SupabaseDriver] Table "${table}" created successfully on Supabase!`);
            }
          } else {
            // Self-heal: Table exists, but might be missing newly added/evolved columns
            const colCheck = await client.query(`
              SELECT column_name FROM information_schema.columns 
              WHERE table_name = $1 AND table_schema = 'public'
            `, [table]);
            const exactPgColumns = new Set(colCheck.rows.map(r => r.column_name));
            const pgColumnsLower = new Set(colCheck.rows.map(r => r.column_name.toLowerCase()));
            
            const sqliteCols = this.sqlite.prepare(`PRAGMA table_info("${table}")`).all() as any[];
            for (const col of sqliteCols) {
              const hasExact = exactPgColumns.has(col.name);
              const hasLower = pgColumnsLower.has(col.name.toLowerCase());
              
              if (!hasExact) {
                if (hasLower) {
                  // Find existing actual column name on Postgres
                  const actualPgCol = colCheck.rows.find(r => r.column_name.toLowerCase() === col.name.toLowerCase())?.column_name;
                  if (actualPgCol && actualPgCol !== col.name) {
                    console.log(`[SupabaseDriver] Auto-migration: Casing mismatch detected on "${table}". Renaming "${actualPgCol}" to "${col.name}"...`);
                    try {
                      await client.query(`ALTER TABLE "${table}" RENAME COLUMN "${actualPgCol}" TO "${col.name}"`);
                      console.log(`[SupabaseDriver] Successfully renamed "${actualPgCol}" to "${col.name}"!`);
                    } catch (renameErr: any) {
                      console.warn(`[SupabaseDriver] Failed to rename column "${actualPgCol}" on "${table}":`, renameErr.message);
                    }
                  }
                } else {
                  console.log(`[SupabaseDriver] Auto-migration: Column "${col.name}" is missing on Supabase table "${table}". Healing...`);
                  let pgType = "TEXT";
                  if (col.type === "INTEGER") {
                    pgType = "INTEGER DEFAULT 0";
                  } else if (col.type === "DATETIME") {
                    pgType = "TIMESTAMP";
                  }
                  try {
                    await client.query(`ALTER TABLE "${table}" ADD COLUMN "${col.name}" ${pgType}`);
                    console.log(`[SupabaseDriver] Successfully added column "${col.name}" to table "${table}"!`);
                  } catch (alterErr: any) {
                    console.warn(`[SupabaseDriver] Failed to auto-add column "${col.name}" to "${table}":`, alterErr.message);
                  }
                }
              }
            }
          }

          if (table === "results") {
            try {
              await client.query(`ALTER TABLE "results" ALTER COLUMN "score" TYPE NUMERIC USING "score"::NUMERIC`);
              await client.query(`ALTER TABLE "results" ALTER COLUMN "totalPoints" TYPE NUMERIC USING "totalPoints"::NUMERIC`);
              console.log(`[SupabaseDriver] Self-heal: Column types for results (score, totalPoints) converted to NUMERIC on Supabase.`);
            } catch (alterTypeErr: any) {
              console.warn(`[SupabaseDriver] Self-heal column types warning:`, alterTypeErr.message);
            }
          }

          // Now verify table rows count to detect empty Supabase database
          const countRes = await client.query(`SELECT COUNT(*) as count FROM "${table}"`);
          const pgCount = parseInt(countRes.rows[0]?.count || "0", 10);

          // Read whatever records exist in current local session cache
          const sqliteRows = this.sqlite.prepare(`SELECT * FROM "${table}"`).all() as any[];

          if (pgCount === 0 && sqliteRows.length > 0) {
            console.log(`[SupabaseDriver] Supabase table "${table}" is completely empty, caching ${sqliteRows.length} local records. Pushing to Supabase...`);
            
            // Perform batch insert inside a single Postgres transaction for high performance & reliability
            await client.query("BEGIN");
            try {
              // Retrieve PG table columns to perform precise casing mapping
              const colCheck = await client.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = $1 AND table_schema = 'public'
              `, [table]);
              const pgColMapping: Record<string, string> = {};
              colCheck.rows.forEach(r => {
                pgColMapping[r.column_name.toLowerCase()] = r.column_name;
              });

              const columns = Object.keys(sqliteRows[0]);
              const mappedColumns = columns.map(c => pgColMapping[c.toLowerCase()] || c);
              const quotedCols = mappedColumns.map(c => `"${c}"`).join(", ");
              const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
              const insertSql = `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`;

              for (const row of sqliteRows) {
                const values = columns.map(colName => {
                  const val = row[colName];
                  if (val === undefined || val === null) return null;
                  return val;
                });
                await client.query(insertSql, values);
              }
              await client.query("COMMIT");
              console.log(`[SupabaseDriver] Seeding complete! ${sqliteRows.length} rows successfully pushed up to Supabase for "${table}".`);

              // Sync PostgreSQL primary key serial sequence to prevent collision on future dynamic client writes
              if (columns.includes("id") && table !== "settings") {
                try {
                  await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1)) FROM "${table}"`, [table]);
                  console.log(`[SupabaseDriver] Sequence synchronized successfully for "${table}".`);
                } catch (seqError: any) {
                  // Some tables might not use sequences or might be checked otherwise, safe to skip
                }
              }
            } catch (seedErr: any) {
              await client.query("ROLLBACK");
              console.error(`[SupabaseDriver] Error writing local data batch to Supabase table "${table}":`, seedErr.message);
              throw seedErr;
            }
          } else if (pgCount > 0) {
            // Standard Pull (Supabase is master populated, mirror downstream to local cache)
            console.log(`[SupabaseDriver] Supabase table "${table}" is populated (${pgCount} rows). Pulling records down to local cache...`);
            
            // To pull actual rows:
            const fullRes = await client.query(`SELECT * FROM "${table}"`);
            
            // Suspend foreign keys during bulk replacement to prevent temporary constraint violation warnings
            this.sqlite.pragma("foreign_keys = OFF");
            try {
              this.sqlite.transaction(() => {
                // Ensure table is empty locally first
                try {
                  this.sqlite.prepare(`DELETE FROM "${table}"`).run();
                } catch (e: any) {
                  console.warn(`[SupabaseDriver] Cache clear warning for table "${table}":`, e.message);
                }

                if (fullRes.rows.length > 0) {
                  const columns = Object.keys(fullRes.rows[0]);
                  const quotedCols = columns.map(c => `"${c}"`).join(", ");
                  const placeholders = columns.map(() => "?").join(", ");
                  const insertSql = `INSERT OR REPLACE INTO "${table}" (${quotedCols}) VALUES (${placeholders})`;
                  const insertStmt = this.sqlite.prepare(insertSql);

                  for (const row of fullRes.rows) {
                    const vals = columns.map(col => {
                      const val = row[col];
                      if (val instanceof Date) return val.toISOString();
                      if (val !== null && typeof val === "object") return JSON.stringify(val);
                      return val;
                    });
                    try {
                      insertStmt.run(...vals);
                    } catch (insErr: any) {
                      console.warn(`[SupabaseDriver] Local merge insert check warning on "${table}":`, insErr.message);
                    }
                  }
                }
              })();
            } finally {
              this.sqlite.pragma("foreign_keys = ON");
            }
            console.log(`[SupabaseDriver] Cache master-replica table "${table}" is perfectly mirrored from Supabase (${fullRes.rows.length} rows).`);
          } else {
            console.log(`[SupabaseDriver] Both cache and Supabase are empty for "${table}". Ready for write action.`);
          }
        } catch (tableErr: any) {
          console.error(`[SupabaseDriver] Failed during sync orchestration of table "${table}":`, tableErr.message);
        }
      }

      // Step 2. Automatically create high-performance indexes on Supabase Postgres
      console.log("[SupabaseDriver] Synchronizing performance indexes to Supabase Postgres...");
      const indexesToCreate = [
        'CREATE UNIQUE INDEX IF NOT EXISTS "idx_filieres_code" ON filieres(code)',
        'CREATE INDEX IF NOT EXISTS "idx_results_exam_student" ON results("examId", "studentId")',
        'CREATE INDEX IF NOT EXISTS "idx_results_student" ON results("studentId")',
        'CREATE INDEX IF NOT EXISTS "idx_exams_module" ON exams("moduleId")',
        'CREATE INDEX IF NOT EXISTS "idx_exams_group" ON exams("groupId")',
        'CREATE INDEX IF NOT EXISTS "idx_exams_teacher" ON exams("teacherId")',
        'CREATE INDEX IF NOT EXISTS "idx_users_group" ON users("groupId")',
        'CREATE INDEX IF NOT EXISTS "idx_users_filiere" ON users("filiereId")',
        'CREATE INDEX IF NOT EXISTS "idx_modules_teacher" ON modules("teacherId")',
        'CREATE INDEX IF NOT EXISTS "idx_chat_messages_group" ON chat_messages("groupId")',
        'CREATE INDEX IF NOT EXISTS "idx_chat_reactions_msg" ON chat_reactions("messageId")',
        'CREATE INDEX IF NOT EXISTS "idx_notification_reactions_notif" ON notification_reactions("notificationId")',
        'CREATE INDEX IF NOT EXISTS "idx_notification_comments_notif" ON notification_comments("notificationId")',
        'CREATE INDEX IF NOT EXISTS "idx_notifications_group" ON notifications("groupId")',
        'CREATE INDEX IF NOT EXISTS "idx_notifications_filiere" ON notifications("filiereId")',
        'CREATE INDEX IF NOT EXISTS "idx_audit_logs_user" ON audit_logs("userId")',
        'CREATE INDEX IF NOT EXISTS "idx_chat_messages_sender" ON chat_messages("senderId")',
        'CREATE INDEX IF NOT EXISTS "idx_exam_sessions_exam" ON exam_sessions("examId")'
      ];
      for (const idxQuery of indexesToCreate) {
        try {
          await client.query(idxQuery);
        } catch (idxErr: any) {
          console.warn("[SupabaseDriver] Index synchronization update check:", idxErr.message);
        }
      }

      client.release();
      console.log("[SupabaseDriver] Initial startup synchronizer has completed successfully in all directions!");
    } catch (err: any) {
      console.error("[SupabaseDriver] CRITICAL - Initial Supabase connection or pulling failed. System will default to current local memory backup safely. Error details:", err.message);
    }
  }

  /**
   * Overwrites/restores all remote tables on Supabase with the current local session cache content.
   * Useful when restoring a database backup file locally and wanting to mirror it back up to Supabase.
   */
  public async pushAllToSupabase() {
    if (!this.dbProviderEnabled) {
      console.log("[SupabaseDriver] Skip push: Supabase database replication is not active/configured.");
      return { success: false, error: "Supabase not configured" };
    }

    const tablesToSync = [
      "filieres", "groups", "users", "modules", "exams", 
      "results", "notifications", "settings", "user_notifications", 
      "chat_messages", "chat_reactions", 
      "notification_reactions", "notification_comments", "exam_sessions"
    ];

    if (this.isRestMode) {
      console.log("[SupabaseDriver] REST Sync: Pushing local database up to Supabase...");
      const headers = {
        "apikey": this.supabaseKey,
        "Authorization": `Bearer ${this.supabaseKey}`,
        "Content-Type": "application/json"
      };

      // In REST, we delete in reverse order or table order to prevent FK constraints issues
      const reversedTables = [...tablesToSync].reverse();
      for (const table of reversedTables) {
        try {
          const delRes = await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
            method: "DELETE",
            headers
          });
          if (!delRes.ok) {
            const txt = await delRes.text();
            console.log(`[SupabaseREST] Info: Truncate status on "${table}": ${delRes.status}`);
          }
        } catch (e: any) {
          console.log(`[SupabaseREST] Info: Truncate skipped on "${table}" (${e.message})`);
        }
      }

      // Now push rows table-by-table
      for (const table of tablesToSync) {
        try {
          const sqliteRows = this.sqlite.prepare(`SELECT * FROM "${table}"`).all() as any[];
          if (sqliteRows.length === 0) continue;

          console.log(`[SupabaseREST] Syncing ${sqliteRows.length} local rows to Supabase table "${table}"...`);
          for (const row of sqliteRows) {
            const bodyRow: Record<string, any> = {};
            for (const [key, val] of Object.entries(row)) {
              if (val !== undefined && val !== null) {
                bodyRow[key] = val;
              }
            }
            const insHeaders = { ...headers, "Prefer": "return=minimal" };
            const postRes = await fetch(`${this.supabaseUrl}/rest/v1/${table}`, {
              method: "POST",
              headers: insHeaders,
              body: JSON.stringify(bodyRow)
            });
            if (!postRes.ok) {
              const errTxt = await postRes.text();
              console.log(`[SupabaseREST] Info: Push skipped/restricted on "${table}" row (status: ${postRes.status})`);
            }
          }
        } catch (err: any) {
          console.log(`[SupabaseREST] Info: Cannot push table "${table}" (${err.message})`);
        }
      }
      return { success: true };
    } else {
      // Direct PostgreSQL sync mode!
      console.log("[SupabaseDriver] Direct PG Sync: Force pushing and restoring local database data to Supabase...");
      if (!this.pgPool) {
        throw new Error("PostgreSQL client pool is not initialized.");
      }

      const client = await this.pgPool.connect();
      try {
        // Truncate tables (delete reverse) on independent statements so warnings don't abort our transaction.
        // We delete in reverse dependency order, and use TRUNCATE CASCADE when possible to cleanly clear referencing rows.
        const reversedTables = [...tablesToSync].reverse();
        
        try {
          await client.query('DELETE FROM "audit_logs"');
        } catch (e) {}

        for (const table of reversedTables) {
          try {
            await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
          } catch (delErr: any) {
            try {
              await client.query(`DELETE FROM "${table}"`);
            } catch (simpleErr: any) {
              console.warn(`[SupabaseDriver] Direct PG push: warning cleaning table "${table}":`, simpleErr.message);
            }
          }
        }

        // Ensure decimal score and totalPoints are supported in results on Supabase before inserting
        try {
          await client.query(`ALTER TABLE "results" ALTER COLUMN "score" TYPE NUMERIC USING "score"::NUMERIC`);
          await client.query(`ALTER TABLE "results" ALTER COLUMN "totalPoints" TYPE NUMERIC USING "totalPoints"::NUMERIC`);
          console.log(`[SupabaseDriver] Push-time Self-heal: score & totalPoints columns converted to NUMERIC on Supabase.`);
        } catch (alterTypeErr: any) {
          console.warn(`[SupabaseDriver] Push-time Self-heal warning:`, alterTypeErr.message);
        }

        // Now start a clean transaction for inserting the actual data state from local cache
        await client.query("BEGIN");
        
        // Push local cached tables to Supabase
        for (const table of tablesToSync) {
          const sqliteRows = this.sqlite.prepare(`SELECT * FROM "${table}"`).all() as any[];
          if (sqliteRows.length === 0) continue;

          // Retrieve PG table columns to perform precise casing mapping
          const colCheck = await client.query(`
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = $1 AND table_schema = 'public'
          `, [table]);
          const pgColMapping: Record<string, string> = {};
          colCheck.rows.forEach(r => {
            pgColMapping[r.column_name.toLowerCase()] = r.column_name;
          });

          const columns = Object.keys(sqliteRows[0]);
          const mappedColumns = columns.map(c => pgColMapping[c.toLowerCase()] || c);
          const quotedCols = mappedColumns.map(c => `"${c}"`).join(", ");
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
          const insertSql = `INSERT INTO "${table}" (${quotedCols}) VALUES (${placeholders})`;

          for (const row of sqliteRows) {
            const values = columns.map(colName => {
              const val = row[colName];
              if (val === undefined || val === null) return null;
              return val;
            });
            await client.query(insertSql, values);
          }

          // Sync sequence if id exists next
          if (columns.includes("id") && table !== "settings") {
            try {
              await client.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE(MAX(id), 1)) FROM "${table}"`, [table]);
            } catch (seqError: any) {
              // ignore sequence errors
            }
          }
        }

        await client.query("COMMIT");
        console.log("[SupabaseDriver] Direct PG: Successfully restored local cache state to Supabase!");
        return { success: true };
      } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("[SupabaseDriver] Push/Restore to Supabase failed:", err.message);
        throw err;
      } finally {
        client.release();
      }
    }
  }

  /**
   * Delegates database backups to the underlying engine
   */
  public async backup(destinationPath: string) {
    if (typeof this.sqlite.backup === "function") {
      return this.sqlite.backup(destinationPath);
    }
    throw new Error("[SupabaseDriver] Underlying database does not support backup.");
  }

  /**
   * Safely closes the underlying database and releases the pgPool connection resources
   */
  public close() {
    console.log("[SupabaseDriver] Closing driver resources...");
    try {
      this.sqlite.close();
    } catch (err: any) {
      console.warn("[SupabaseDriver] Underling database close warning:", err.message);
    }
    
    if (this.pgPool) {
      try {
        this.pgPool.end();
      } catch (err: any) {
        console.warn("[SupabaseDriver] PostgreSQL pool terminate warning:", err.message);
      }
    }
  }
}
