import { io } from "socket.io-client";

const API_URL = "/api";

export const socket = io();

export let onDualSessionDetected: (() => void) | null = null;
export function setOnDualSessionDetected(cb: () => void) {
  onDualSessionDetected = cb;
}

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

export const api = {
  auth: {
    signup: (data: any) => request("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
    login: (data: any) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    update: (data: any) => request("/auth/update", { method: "PUT", body: JSON.stringify(data) }),
    logout: () => request("/auth/logout", { method: "POST" }),
    me: () => request("/auth/me"),
    getProfile: () => request("/auth/me"),
  },
  modules: {
    list: () => request("/modules"),
    create: (data: any) => request("/modules", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/modules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request(`/modules/${id}`, { method: "DELETE" }),
  },
  exams: {
    list: () => request("/exams"),
    getResults: (id: number) => request(`/exams/${id}/results`),
    create: (data: any) => request("/exams", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/exams/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request(`/exams/${id}`, { method: "DELETE" }),
    publish: (id: number, groupId: number) => request(`/exams/${id}/publish`, { method: "POST", body: JSON.stringify({ groupId }) }),
    unpublish: (id: number) => request(`/exams/${id}/unpublish`, { method: "POST" }),
    timeSync: (id: number) => request(`/exams/${id}/time-sync`, { method: "POST" }),
  },
  results: {
    list: () => request("/results"),
    create: (data: any) => request("/results", { method: "POST", body: JSON.stringify(data) }),
  },
  students: {
    count: () => request("/students/count"),
    bulkImport: (students: any[]) => request("/admin/bulk-import-students", { method: "POST", body: JSON.stringify({ students }) }),
  },
  notifications: {
    list: () => request("/notifications"),
    create: (data: any) => request("/notifications", { method: "POST", body: JSON.stringify(data) }),
    delete: (id: number) => request(`/notifications/${id}`, { method: "DELETE" }),
    markRead: (id: number) => request(`/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () => request("/notifications/read-all", { method: "POST" }),
    togglePin: (id: number) => request(`/notifications/${id}/toggle-pin`, { method: "POST" }),
    react: (id: number, reactionType: string) => request(`/notifications/${id}/react`, { method: "POST", body: JSON.stringify({ reactionType }) }),
    addComment: (id: number, content: string) => request(`/notifications/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
    deleteComment: (commentId: number) => request(`/notifications/comments/${commentId}`, { method: "DELETE" }),
  },
  admin: {
    getDiagnostic: () => request("/admin/db-diagnostic"),
    runVacuum: () => request("/admin/db-vacuum", { method: "POST" }),
    backup: () => "/api/admin/backup", // This returns the URL for download
    backupZip: () => "/api/admin/backup?format=zip", // Zipped download
    getStudentCount: () => request("/students/count"),
    listUsers: () => request("/admin/users"),
    createUser: (data: any) => request("/admin/users", { method: "POST", body: JSON.stringify(data) }),
    deleteUser: (id: number) => request(`/admin/users/${id}`, { method: "DELETE" }),
    updateUser: (id: number, data: any) => request(`/admin/users/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    getLogs: () => request("/admin/logs"),
    getOnlineUsers: () => request("/admin/online-users"),
    getAutoBackups: () => request("/admin/auto-backups"),
    deleteAutoBackup: (filename: string) => request(`/admin/auto-backups/${filename}`, { method: "DELETE" }),
    triggerAutoBackup: () => request("/admin/auto-backups/trigger", { method: "POST" }),
    restoreAutoBackup: (filename: string) => request(`/admin/auto-backups/${filename}/restore`, { method: "POST" }),
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
      
      return isJson ? res.json() : res.text();
    }
  },
  filieres: {
    list: () => request("/filieres"),
    create: (data: any) => request("/filieres", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/filieres/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request(`/filieres/${id}`, { method: "DELETE" }),
  },
  groups: {
    list: () => request("/groups"),
    getStudents: (id: number) => request(`/groups/${id}/students`),
    create: (data: any) => request("/groups", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request(`/groups/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request(`/groups/${id}`, { method: "DELETE" }),
  },
  settings: {
    get: () => request("/settings"),
    update: (data: any) => request("/settings", { method: "PUT", body: JSON.stringify(data) }),
  },
  chat: {
    getMessages: (channelType: string, groupId?: number) => {
      const q = new URLSearchParams();
      q.append("channelType", channelType);
      if (groupId) q.append("groupId", groupId.toString());
      return request(`/chat/messages?${q.toString()}`);
    }
  },
};
