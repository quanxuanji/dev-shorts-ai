import type { StepStatus, StudioRuntimeData, StudioScene, Task } from "@/lib/types";

import type { ArtifactItem, StudioArtifacts, StudioAssetView, StudioSceneView } from "./studio-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function normalizeAssetUrl(url?: string | null) {
  if (!url) return url;
  if (url.includes("://")) return url;
  if (url.startsWith("/artifacts/")) return `${API_URL}${url}`;
  return url;
}

export function formatMs(ms?: number | null) {
  if (typeof ms !== "number" || Number.isNaN(ms)) return "pending";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export function durationLabel(scene: StudioScene) {
  const durationMs =
    scene.audio_duration_ms ??
    (typeof scene.speech_end_ms === "number" && typeof scene.speech_start_ms === "number" ? scene.speech_end_ms - scene.speech_start_ms : null);
  return typeof durationMs === "number" ? `${(durationMs / 1000).toFixed(1)}s` : "pending";
}

function parseScriptScenes(script: string): StudioSceneView[] {
  const parts = script
    .split(/\n{2,}|(?=第[一二三四五六七八九十]+[，,、])/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 10);

  return parts.map((part, index) => {
    const title = part
      .replace(/^第[一二三四五六七八九十]+[，,、]\s*/, "")
      .split(/[，,。.\n]/)[0]
      .trim();
    return {
      sceneIndex: index,
      rank: index + 1,
      title: title || `Scene ${index + 1}`,
      tag: "script",
      duration: "pending",
      start: "pending",
      summary: part.slice(0, 72),
      narration: part,
      growth: "",
      audioDurationMs: null
    };
  });
}

export function normalizeScenes(runtime: StudioRuntimeData | null, voiceScript: string): StudioSceneView[] {
  if (!runtime?.scenes?.length) return parseScriptScenes(voiceScript);
  return runtime.scenes.map((scene, index) => ({
    sceneIndex: scene.scene_index ?? index,
    rank: scene.rank ?? index + 1,
    title: scene.title || `Scene ${index + 1}`,
    tag: scene.tags?.[0] ?? (scene.rank ? "TOP PROJECT" : "Intro"),
    duration: durationLabel(scene),
    start: formatMs(scene.speech_start_ms ?? scene.visual_start_ms),
    summary: scene.summary || scene.caption || scene.narration || "Waiting for scene summary",
    narration: scene.narration || scene.summary || scene.caption || "",
    growth: scene.growth || "",
    audioDurationMs: scene.audio_duration_ms,
    fromFrame: scene.from_frame,
    visualStartMs: scene.visual_start_ms,
    speechStartMs: scene.speech_start_ms,
    visualEndMs: scene.visual_end_ms,
    speechEndMs: scene.speech_end_ms,
    silenceStartMs: scene.silence_start_ms,
    silenceEndMs: scene.silence_end_ms
  }));
}

export function normalizeAssets(runtime: StudioRuntimeData | null, artifacts: StudioArtifacts): StudioAssetView[] {
  const runtimeAssets =
    runtime?.assets?.map((asset) => ({
      name: asset.name,
      detail: asset.detail || (asset.exists ? "ready" : "pending"),
      kind: asset.kind,
      exists: asset.exists,
      url: normalizeAssetUrl(asset.url)
    })) ?? [];

  const byName = new Map(runtimeAssets.map((asset) => [asset.name, asset]));
  const fallbackAssets: StudioAssetView[] = [
    { name: "final.mp4", detail: artifacts.video.value || "waiting for export", kind: "video", exists: artifacts.video.kind === "real" },
    { name: "voice.wav", detail: artifacts.audio.value || "waiting for TTS", kind: "audio", exists: artifacts.audio.kind === "real" },
    { name: "subtitles.srt", detail: "waiting for subtitle generation", kind: "subtitle", exists: false },
    { name: "timeline.json", detail: "waiting for sync timeline", kind: "timeline", exists: false },
    { name: "script_sections.json", detail: artifacts.script.value ? "script ready" : "waiting for LLM", kind: "script", exists: artifacts.script.kind === "real" }
  ];

  return fallbackAssets.map((asset) => byName.get(asset.name) ?? asset).concat(runtimeAssets.filter((asset) => !fallbackAssets.some((item) => item.name === asset.name)));
}

export function getAsset(assets: StudioAssetView[], name: string) {
  return assets.find((asset) => asset.name === name);
}

export function hasReadyAsset(assets: StudioAssetView[], name: string) {
  return Boolean(getAsset(assets, name)?.exists);
}

export function deriveProgress(task: Task | null, artifacts: StudioArtifacts, runtime: StudioRuntimeData | null) {
  if (runtime?.progress != null) return Math.min(100, Math.max(0, runtime.progress));
  if (task?.progress != null) return Math.min(100, Math.max(0, task.progress));
  if (artifacts.video.kind === "real") return 100;
  if (artifacts.audio.kind === "real") return 50;
  if (artifacts.script.kind === "real") return 25;
  return 0;
}

function stepStatusFromTask(task: Task | null, ids: string[]): StepStatus | null {
  const step = task?.steps.find((item) => ids.some((id) => item.id.toLowerCase().includes(id) || item.label.toLowerCase().includes(id)));
  return step?.status ?? null;
}

function currentStepMatches(task: Task | null, runtime: StudioRuntimeData | null, ids: string[]) {
  const value = `${task?.current_step ?? ""} ${runtime?.current_step ?? ""}`.toLowerCase();
  return ids.some((id) => value.includes(id));
}

export function workflowStatus({
  id,
  task,
  artifacts,
  assets,
  scenes,
  isCreating,
  runtime
}: {
  id: string;
  task: Task | null;
  artifacts: StudioArtifacts;
  assets: StudioAssetView[];
  scenes: StudioSceneView[];
  isCreating: boolean;
  runtime?: StudioRuntimeData | null;
}): StepStatus {
  if (task?.status === "error") return "error";
  const taskStepStatus =
    id === "topic"
      ? stepStatusFromTask(task, ["reference", "source", "topic", "extract"])
      : id === "script"
        ? stepStatusFromTask(task, ["script", "rewrite", "llm"])
        : id === "tts"
          ? stepStatusFromTask(task, ["tts", "voice", "audio"])
          : id === "subtitle"
            ? stepStatusFromTask(task, ["subtitle", "srt"])
            : id === "render"
              ? stepStatusFromTask(task, ["render", "remotion", "video"])
              : id === "export"
                ? stepStatusFromTask(task, ["export", "ffmpeg", "final"])
                : null;
  if (taskStepStatus === "running" || taskStepStatus === "error") return taskStepStatus;

  if (id === "topic") return task || runtime?.topic || artifacts.script.value ? "success" : isCreating ? "running" : "pending";
  if (id === "script") return taskStepStatus === "success" || Boolean(runtime?.scenes?.length) || artifacts.script.kind === "real" ? "success" : currentStepMatches(task, runtime ?? null, ["script", "rewrite", "llm"]) || isCreating ? "running" : "pending";
  if (id === "tts") return taskStepStatus === "success" || artifacts.audio.kind === "real" || hasReadyAsset(assets, "voice.wav") ? "success" : currentStepMatches(task, runtime ?? null, ["tts", "voice", "audio"]) ? "running" : "pending";
  if (id === "subtitle") return hasReadyAsset(assets, "subtitles.srt") ? "success" : artifacts.video.kind === "real" ? "success" : "pending";
  if (id === "render") return taskStepStatus === "success" || artifacts.video.kind === "real" ? "success" : currentStepMatches(task, runtime ?? null, ["render", "remotion"]) ? "running" : "pending";
  if (id === "export") return hasReadyAsset(assets, "final.mp4") || artifacts.video.kind === "real" ? "success" : "pending";
  return "pending";
}

export function taskTitle(task: Task | null, runtime: StudioRuntimeData | null, topic: string) {
  return runtime?.topic || task?.topic || task?.title || topic || "Untitled AI video";
}

export function artifactKindLabel(item: ArtifactItem) {
  if (item.kind === "real") return "ready";
  if (item.kind === "fallback") return "fallback";
  if (item.kind === "provider") return "provider";
  return "pending";
}

export function timelineIsAvailable(runtime: StudioRuntimeData | null) {
  return Boolean(runtime?.timeline && Object.keys(runtime.timeline).length > 0 && runtime.scenes.some((scene) => typeof scene.visual_start_ms === "number"));
}

export function runtimeStatusLabel(task: Task | null, runtime: StudioRuntimeData | null, isCreating: boolean, createError: string) {
  if (createError) return "failed";
  if (isCreating) return "creating task";
  return runtime?.status || task?.status || "idle";
}
