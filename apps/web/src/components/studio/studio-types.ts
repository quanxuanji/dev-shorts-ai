import type { RefObject } from "react";

import type { RuntimeSettings, SpeakingStyle, StudioRuntimeData, Task } from "@/lib/types";

export type RuntimeLine = {
  id: number;
  source: string;
  message: string;
  level: "info" | "success" | "warn";
};

export type StudioFormState = {
  sourceUrl: string;
  localFilePath: string;
  topic: string;
  targetStyle: string;
  speakingStyle: SpeakingStyle;
};

export type ArtifactKind = "real" | "provider" | "fallback" | "pending";

export type ArtifactItem = {
  value: string;
  kind: ArtifactKind;
};

export type StudioArtifacts = {
  transcript: ArtifactItem;
  script: ArtifactItem;
  audio: ArtifactItem;
  video: ArtifactItem;
};

export type StudioStyleChip = {
  value: SpeakingStyle;
  label: string;
  prompt: string;
};

export type StudioSceneView = {
  sceneIndex: number;
  rank: number;
  title: string;
  tag: string;
  duration: string;
  start: string;
  summary: string;
  narration: string;
  growth: string;
  audioDurationMs?: number | null;
  fromFrame?: number | null;
  visualStartMs?: number | null;
  speechStartMs?: number | null;
  visualEndMs?: number | null;
  speechEndMs?: number | null;
  silenceStartMs?: number | null;
  silenceEndMs?: number | null;
};

export type StudioAssetView = {
  name: string;
  detail: string;
  kind: string;
  exists: boolean;
  url?: string | null;
};

export type SelectedAsset = StudioAssetView | null;

export type StudioLayoutProps = {
  form: StudioFormState;
  setForm: (updater: StudioFormState | ((current: StudioFormState) => StudioFormState)) => void;
  styleChips: StudioStyleChip[];
  voiceScript: string;
  setVoiceScript: (value: string) => void;
  task: Task | null;
  settings: RuntimeSettings | null;
  historyTasks: Task[];
  artifacts: StudioArtifacts;
  audioUrl: string;
  videoUrl: string;
  providerWarning: string;
  providerLabel: string;
  runtimeLines: RuntimeLine[];
  consoleRef: RefObject<HTMLDivElement>;
  studioRuntime: StudioRuntimeData | null;
  isCreating: boolean;
  isScriptGenerating: boolean;
  createError: string;
  canRun: boolean;
  isHistoryLoading: boolean;
  historyError: string;
  onCreate: () => void;
  onNewVideo: () => void;
  onRegenerate: () => void;
  onRender: () => void;
  onApplyStyleChip: (chip: StudioStyleChip) => void;
  onRefreshSettings: () => void;
  onRefreshRuntime: () => void;
  onRefreshHistory: () => void;
  onSelectHistory: (task: Task) => void;
};
