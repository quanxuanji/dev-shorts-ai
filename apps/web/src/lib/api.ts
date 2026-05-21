import type { CreateTaskPayload, ModelStatus, RuntimeSettings, SystemStatus, Task } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function getSystemStatus() {
  return request<SystemStatus>("/api/system/status");
}

export async function getModelStatus() {
  const response = await request<{ services: ModelStatus[] }>("/api/models/status");
  return response.services;
}

export async function getRecentTasks() {
  return request<Task[]>("/api/tasks/recent");
}

export async function createTask(payload: CreateTaskPayload) {
  return request<Task>("/api/tasks/create", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function getTask(taskId: string) {
  return request<Task>(`/api/tasks/${taskId}`);
}

export async function getRuntimeSettings() {
  return request<RuntimeSettings>("/api/settings");
}

export async function updateRuntimeSettings(payload: Partial<RuntimeSettings>) {
  return request<RuntimeSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}
