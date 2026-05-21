export type StepStatus = "pending" | "running" | "success" | "error";
export type TaskStatus = "queued" | "running" | "success" | "error";
export type ModelState = "online" | "standby" | "mock" | "offline" | "error";
export type TaskMode = "mock" | "semi_real";
export type SpeakingStyle = "tech" | "oral" | "viral";

export interface WorkflowStep {
  id: string;
  label: string;
  status: StepStatus;
  progress: number;
  output?: string | null;
}

export interface TaskLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface Task {
  id: string;
  title: string;
  source_url: string;
  local_file_path?: string | null;
  topic?: string | null;
  target_style?: string | null;
  speaking_style?: string | null;
  mode: TaskMode;
  status: TaskStatus;
  current_step?: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
  steps: WorkflowStep[];
  logs: TaskLog[];
  artifacts: Record<string, unknown>;
}

export interface CreateTaskPayload {
  mode: TaskMode;
  source_url?: string;
  local_file_path?: string;
  topic?: string;
  target_style?: string;
  speaking_style?: SpeakingStyle;
  title?: string;
}

export interface RuntimeSettings {
  llm_provider: "mock" | "openai" | "openai_compatible" | "ollama";
  openai_api_key: string;
  openai_base_url: string;
  openai_model: string;
  ollama_base_url: string;
  ollama_model: string;
  asr_provider: "mock" | "whisper_cli" | "faster_whisper";
  whisper_model: string;
  whisper_language: string;
  tts_provider: "mock" | "edge_tts" | "fishspeech";
  edge_tts_voice: string;
  fishspeech_base_url: string;
  fishspeech_api_key: string;
  fishspeech_voice: string;
  fishspeech_timeout_seconds: number;
  video_resolution: string;
  subtitle_style: string;
}

export interface ModelStatus {
  name: string;
  kind: string;
  state: ModelState;
  latency_ms: number;
  provider: string;
  note: string;
  tokens_per_second?: number;
  queue?: number;
  gpu_percent?: number;
}

export interface SystemStatus {
  cpu_percent: number;
  ram_percent: number;
  gpu_percent: number;
  gpu_memory_percent: number;
  inference_latency_ms?: number;
  tokens_per_second?: number;
  active_models?: number;
  queue_depth: number;
  active_tasks: number;
  uptime: string;
}
