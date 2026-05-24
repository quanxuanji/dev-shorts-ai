import type { CreateTaskPayload, CreateVoicePayload, ModelStatus, RuntimeSettings, StudioRuntimeData, SystemStatus, Task, VoiceLibraryResponse, VoiceProfile } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...init?.headers
  } as Record<string, string>;
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
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

export async function getStudioRuntime(options: { taskId?: string; demo?: boolean } = {}) {
  const params = new URLSearchParams();
  if (options.taskId) params.set("task_id", options.taskId);
  if (options.demo) params.set("demo", "true");
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request<StudioRuntimeData>(`/api/studio/runtime${suffix}`);
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

export async function getVoiceLibrary() {
  return request<VoiceLibraryResponse>("/api/voices");
}

export async function createVoice(payload: CreateVoicePayload) {
  return request<VoiceProfile>("/api/voices", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function setDefaultVoice(voiceId: string) {
  return request<VoiceLibraryResponse>(`/api/voices/${voiceId}/default`, {
    method: "PUT"
  });
}
