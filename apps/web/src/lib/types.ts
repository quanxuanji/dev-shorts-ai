export type {
  ModelState,
  ModelStatus,
  StepStatus,
  SystemStatus,
  StudioRuntimeData,
  StudioScene,
  StudioAsset,
  StudioSubtitle,
  TaskLog,
  TaskStatus,
  TtsProvider,
  WorkflowStep,
  RuntimeSettings,
  VoiceLibraryResponse,
  VoiceProfile,
  CreateVoicePayload
} from "@devshorts/shared";

import type { Task as SharedTask } from "@devshorts/shared";

export type TaskMode = "mock" | "semi_real";
export type SpeakingStyle = "tech" | "oral" | "viral";

export interface Task extends Omit<SharedTask, "current_step" | "mode" | "progress" | "speaking_style" | "target_style"> {
  local_file_path?: string | null;
  topic?: string | null;
  target_style?: string | null;
  speaking_style?: SpeakingStyle | string | null;
  mode?: TaskMode;
  current_step?: string | null;
  progress?: number;
}

export interface CreateTaskPayload {
  source_url?: string;
  local_file_path?: string;
  title?: string;
  mode: TaskMode;
  topic?: string;
  target_style?: string;
  speaking_style?: SpeakingStyle;
  reference_text?: string;
  script_prompt?: string;
  script?: string;
  voice?: string;
}
