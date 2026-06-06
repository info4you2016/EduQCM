import { io } from "socket.io-client";

const API_URL = "/api";

export const socket = io();

export let onDualSessionDetected: (() => void) | null = null;
export function setOnDualSessionDetected(cb: () => void) {
  onDualSessionDetected = cb;
}

// ==========================================
// --- FINE-GRAINED SURGICAL CACHE LAYER ---
// ==========================================

interface CacheEntry {
  data: any;
  timestamp: number;
}

// Stores actual cached responses
const cacheStore = new Map<string, CacheEntry>();

// Maps logical tags (e.g., "exams", "modules") to cached request keys
const tagRegistry = new Map<string, Set<string>>();

/**
 * Register a cache key under various invalidation tags.
 */
function registerCacheKeyWithTags(key: string, tags: string[]) {
  for (const tag of tags) {
    if (!tagRegistry.has(tag)) {
      tagRegistry.set(tag, new Set());
    }
    tagRegistry.get(tag)!.add(key);
  }
}

/**
 * Retrieve current metrics and entries for dashboard display.
 */
export function getCacheStats() {
  const keys = Array.from(cacheStore.keys());
  const tags = Array.from(tagRegistry.entries()).map(([tag, keySet]) => ({
    tag,
    keys: Array.from(keySet).filter(k => cacheStore.has(k))
  })).filter(t => t.keys.length > 0);
  
  return {
    totalEntries: cacheStore.size,
    keys,
    tags
  };
}

/**
 * Surgically invalidate cached entries matching specified tags.
 */
export function invalidateCacheTags(tags: string[]) {
  let count = 0;
  const deletedKeys: string[] = [];
  
  for (const tag of tags) {
    const keys = tagRegistry.get(tag);
    if (keys) {
      for (const key of keys) {
        if (cacheStore.has(key)) {
          cacheStore.delete(key);
          deletedKeys.push(key);
          count++;
        }
      }
      tagRegistry.delete(tag);
    }
  }
  
  if (deletedKeys.length > 0) {
    console.log(`[Cache Chirurgical] 🎯 Invalidation chirurgicale pour les tags [${tags.join(', ')}]. Clés éliminées :`, deletedKeys);
  }
  return count;
}

/**
 * Empty the entire cache store.
 */
export function clearAllCache() {
  const count = cacheStore.size;
  cacheStore.clear();
  tagRegistry.clear();
  console.log(`[Cache Chirurgical] 🧹 Vidage complet de l'espace cache (${count} entrées).`);
  return count;
}

// Setup a global clean hook on window for debuggers if needed
if (typeof window !== "undefined") {
  (window as any).__invalidateCacheTags = invalidateCacheTags;
  (window as any).__clearAllCache = clearAllCache;
  (window as any).__getCacheStats = getCacheStats;
}

// ==========================================
// ==========================================

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  const contentType = res.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  
  if (!res.ok) {
    let errorMessage = "Something went wrong";
    if (isJson) {
      const error = await res.json();
      errorMessage = error.error || errorMessage;
    } else {
      errorMessage = await res.text();
    }
    
    if (errorMessage === "DUAL_SESSION") {
      if (onDualSessionDetected) {
        onDualSessionDetected();
      }
    }
    
    throw new Error(errorMessage);
  }
  
  return isJson ? res.json() : res.text();
}

/**
 * Wrap GET requests with caching and dynamic tagging
 */
async function cachedRequest(
  path: string,
  options: RequestInit,
  tags: string[],
  ttlMs: number = 60000 // Default TTL of 60 seconds
): Promise<any> {
  const cacheKey = `${path}:${options.method || 'GET'}:${options.body || ''}`;
  const now = Date.now();
  
  const cached = cacheStore.get(cacheKey);
  if (cached && now - cached.timestamp < ttlMs) {
    // Return deep copy to prevent mutating cache reference directly
    return JSON.parse(JSON.stringify(cached.data));
  }
  
  const data = await request(path, options);
  
  cacheStore.set(cacheKey, {
    data,
    timestamp: now
  });
  
  registerCacheKeyWithTags(cacheKey, tags);
  return data;
}

export const api = {
  auth: {
    signup: async (data: any) => {
      const res = await request("/auth/signup", { method: "POST", body: JSON.stringify(data) });
      invalidateCacheTags(["users", "students"]);
      return res;
    },
    login: async (data: any) => {
      clearAllCache();
      const res = await request("/auth/login", { method: "POST", body: JSON.stringify(data) });
      return res;
    },
    update: async (data: any) => {
      const res = await request("/auth/update", { method: "PUT", body: JSON.stringify(data) });
      invalidateCacheTags(["users", "students"]);
      return res;
    },
    logout: async () => {
      clearAllCache();
      return request("/auth/logout", { method: "POST" });
    },
    me: () => request("/auth/me"),
    getProfile: () => request("/auth/me"),
  },
  modules: {
    list: () => cachedRequest("/modules", {}, ["modules"]),
    create: async (data: any) => {
      const res = await request("/modules", { method: "POST", body: JSON.stringify(data) });
      invalidateCacheTags(["modules"]);
      return res;
    },
    update: async (id: number, data: any) => {
      const res = await request(`/modules/${id}`, { method: "PUT", body: JSON.stringify(data) });
      invalidateCacheTags(["modules", "exams"]);
      return res;
    },
    delete: async (id: number) => {
      const res = await request(`/modules/${id}`, { method: "DELETE" });
      invalidateCacheTags(["modules", "exams"]);
      return res;
    },
  },
  exams: {
    list: () => cachedRequest("/exams", {}, ["exams"]),
    getResults: (id: number) => cachedRequest(`/exams/${id}/results`, {}, [`results:${id}`, "results"]),
    create: async (data: any) => {
      const res = await request("/exams", { method: "POST", body: JSON.stringify(data) });
      invalidateCacheTags(["exams"]);
      return res;
    },
    update: async (id: number, data: any) => {
      const res = await request(`/exams/${id}`, { method: "PUT", body: JSON.stringify(data) });
      invalidateCacheTags(["exams"]);
      return res;
    },
    delete: async (id: number) => {
      const res = await request(`/exams/${id}`, { method: "DELETE" });
      invalidateCacheTags(["exams", `results:${id}`]);
      return res;
    },
    publish: async (id: number, groupId: number) => {
      const res = await request(`/exams/${id}/publish`, { method: "POST", body: JSON.stringify({ groupId }) });
      invalidateCacheTags(["exams"]);
      return res;
    },
    unpublish: async (id: number) => {
      const res = await request(`/exams/${id}/unpublish`, { method: "POST" });
      invalidateCacheTags(["exams"]);
      return res;
    },
    timeSync: (id: number) => request(`/exams/${id}/time-sync`, { method: "POST" }),
  },
  results: {
    list: () => cachedRequest("/results", {}, ["results"]),
    create: async (data: any) => {
      const res = await request("/results", { method: "POST", body: JSON.stringify(data) });
      invalidateCacheTags(["results", `results:${data.examId}`]);
      return res;
    },
  },
  students: {
    count: () => cachedRequest("/students/count", {}, ["students"]),
    bulkImport: async (students: any[]) => {
      const res = await request("/admin/bulk-import-students", { method: "POST", body: JSON.stringify({ students }) });
      invalidateCacheTags(["students", "users", "groups"]);
      return res;
    },
  },
  notifications: {
    list: () => cachedRequest("/notifications", {}, ["notifications"]),
    create: async (data: any) => {
      const res = await request("/notifications", { method: "POST", body: JSON.stringify(data) });
      invalidateCacheTags(["notifications"]);
      return res;
    },
    delete: async (id: number) => {
      const res = await request(`/notifications/${id}`, { method: "DELETE" });
      invalidateCacheTags(["notifications"]);
      return res;
    },
    markRead: async (id: number) => {
      const res = await request(`/notifications/${id}/read`, { method: "POST" });
      invalidateCacheTags(["notifications"]);
      return res;
    },
    markAllRead: async () => {
      const res = await request("/notifications/read-all", { method: "POST" });
      invalidateCacheTags(["notifications"]);
      return res;
    },
    togglePin: async (id: number) => {
      const res = await request(`/notifications/${id}/toggle-pin`, { method: "POST" });
      invalidateCacheTags(["notifications"]);
      return res;
    },
    react: async (id: number, reactionType: string) => {
      const res = await request(`/notifications/${id}/react`, { method: "POST", body: JSON.stringify({ reactionType }) });
      invalidateCacheTags(["notifications"]);
      return res;
    },
    addComment: async (id: number, content: string) => {
      const res = await request(`/notifications/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) });
      invalidateCacheTags(["notifications"]);
      return res;
    },
    deleteComment: async (commentId: number) => {
      const res = await request(`/notifications/comments/${commentId}`, { method: "DELETE" });
      invalidateCacheTags(["notifications"]);
      return res;
    },
  },
  admin: {
    getDiagnostic: () => cachedRequest("/admin/db-diagnostic", {}, ["admin"]),
    runVacuum: async () => {
      const res = await request("/admin/db-vacuum", { method: "POST" });
      invalidateCacheTags(["admin"]);
      return res;
    },
    backup: () => "/api/admin/backup", // This returns the URL for download
    backupZip: () => "/api/admin/backup?format=zip", // Zipped download
    getStudentCount: () => cachedRequest("/students/count", {}, ["students"]),
    listUsers: () => cachedRequest("/admin/users", {}, ["users"]),
    createUser: async (data: any) => {
      const res = await request("/admin/users", { method: "POST", body: JSON.stringify(data) });
      invalidateCacheTags(["users", "students"]);
      return res;
    },
    deleteUser: async (id: number) => {
      const res = await request(`/admin/users/${id}`, { method: "DELETE" });
      invalidateCacheTags(["users", "students"]);
      return res;
    },
    updateUser: async (id: number, data: any) => {
      const res = await request(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) });
      invalidateCacheTags(["users", "students"]);
      return res;
    },
    getLogs: () => cachedRequest("/admin/logs", {}, ["admin"]),
    getOnlineUsers: () => cachedRequest("/admin/online-users", {}, ["online-users"], 3000), // very low TTL for active presence
    getAutoBackups: () => cachedRequest("/admin/auto-backups", {}, ["autobackups"]),
    deleteAutoBackup: async (filename: string) => {
      const res = await request(`/admin/auto-backups/${filename}`, { method: "DELETE" });
      invalidateCacheTags(["autobackups"]);
      return res;
    },
    triggerAutoBackup: async () => {
      const res = await request("/admin/auto-backups/trigger", { method: "POST" });
      invalidateCacheTags(["autobackups"]);
      return res;
    },
    restoreAutoBackup: async (filename: string) => {
      const res = await request(`/admin/auto-backups/${filename}/restore`, { method: "POST" });
      clearAllCache();
      return res;
    },
    restore: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/restore", {
        method: "POST",
        body: formData,
        credentials: 'include',
      });
      
      const contentType = res.headers.get("content-type");
      const isJson = contentType && contentType.includes("application/json");
      
      if (!res.ok) {
        let errorMessage = "Restoration failed";
        if (isJson) {
          const error = await res.json();
          errorMessage = error.error || errorMessage;
        } else {
          errorMessage = await res.text();
        }
        throw new Error(errorMessage);
      }
      
      clearAllCache();
      return isJson ? res.json() : res.text();
    }
  },
  filieres: {
    list: () => cachedRequest("/filieres", {}, ["filieres"]),
    create: async (data: any) => {
      const res = await request("/filieres", { method: "POST", body: JSON.stringify(data) });
      invalidateCacheTags(["filieres"]);
      return res;
    },
    update: async (id: number, data: any) => {
      const res = await request(`/filieres/${id}`, { method: "PUT", body: JSON.stringify(data) });
      invalidateCacheTags(["filieres", "groups"]);
      return res;
    },
    delete: async (id: number) => {
      const res = await request(`/filieres/${id}`, { method: "DELETE" });
      invalidateCacheTags(["filieres", "groups"]);
      return res;
    },
  },
  groups: {
    list: () => cachedRequest("/groups", {}, ["groups"]),
    getStudents: (id: number) => cachedRequest(`/groups/${id}/students`, {}, [`group-students:${id}`]),
    create: async (data: any) => {
      const res = await request("/groups", { method: "POST", body: JSON.stringify(data) });
      invalidateCacheTags(["groups"]);
      return res;
    },
    update: async (id: number, data: any) => {
      const res = await request(`/groups/${id}`, { method: "PUT", body: JSON.stringify(data) });
      invalidateCacheTags(["groups", `group-students:${id}`]);
      return res;
    },
    delete: async (id: number) => {
      const res = await request(`/groups/${id}`, { method: "DELETE" });
      invalidateCacheTags(["groups", `group-students:${id}`]);
      return res;
    },
  },
  settings: {
    get: () => cachedRequest("/settings", {}, ["settings"]),
    update: async (data: any) => {
      const res = await request("/settings", { method: "PUT", body: JSON.stringify(data) });
      invalidateCacheTags(["settings"]);
      return res;
    },
  },
  chat: {
    getMessages: (channelType: string, groupId?: number) => {
      const q = new URLSearchParams();
      q.append("channelType", channelType);
      if (groupId) q.append("groupId", groupId.toString());
      return cachedRequest(`/chat/messages?${q.toString()}`, {}, ["chat"], 1500);
    }
  },
  cache: {
    getStats: getCacheStats,
    invalidate: invalidateCacheTags,
    clearAll: clearAllCache
  }
};
