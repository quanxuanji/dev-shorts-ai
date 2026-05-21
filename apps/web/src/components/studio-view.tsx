"use client";

import type { ElementType, RefObject } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioWaveform,
  Check,
  Clapperboard,
  Download,
  ExternalLink,
  FileText,
  FolderInput,
  Link2,
  Loader2,
  Megaphone,
  Play,
  Radio,
  Rocket,
  Sparkles,
  Subtitles,
  Target,
  UserRound,
  WandSparkles
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { StatusLight } from "@/components/status-light";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createTask, getTask } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { CreateTaskPayload, SpeakingStyle, StepStatus, Task, TaskLog, TaskMode, WorkflowStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RuntimeLine {
  id: number;
  source: string;
  message: string;
  level: "info" | "success" | "warn";
}

interface StudioFormState {
  sourceUrl: string;
  localFilePath: string;
  topic: string;
  targetStyle: string;
  speakingStyle: SpeakingStyle;
}

interface ResultArtifacts {
  transcript: string;
  rewrittenScript: string;
  subtitlesPath: string;
  titleCoverPath: string;
  publishDraftPath: string;
  finalVideoPath: string;
}

function artifactUrl(path: string) {
  if (!path || path.includes("://")) return path;
  const normalized = path.replaceAll("\\", "/");
  const marker = "artifacts/outputs/";
  const index = normalized.indexOf(marker);
  if (index === -1) return path;
  const relative = normalized.slice(index + "artifacts/".length);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${apiUrl}/artifacts/${relative}`;
}

const speakingStyles: Array<{ value: SpeakingStyle; label: string; helper: string }> = [
  { value: "tech", label: "Tech", helper: "precise developer voice" },
  { value: "oral", label: "Oral", helper: "natural spoken pacing" },
  { value: "viral", label: "Viral", helper: "hook-first short video" }
];

const stepConfig: Record<string, { icon: ElementType; title: string; description: string; config: string[] }> = {
  prepare: {
    icon: FolderInput,
    title: "Prepare Video",
    description: "The backend copies a local file, downloads a URL with yt-dlp, or generates a fallback input clip.",
    config: ["Input: URL or local path", "Tool: yt-dlp optional", "Output: input.mp4", "Fallback: generated clip"]
  },
  inputVideo: {
    icon: FolderInput,
    title: "Input Video",
    description: "The backend copies a local file, downloads a URL with yt-dlp, or generates a fallback input clip.",
    config: ["Input: URL or local path", "Tool: yt-dlp optional", "Output: input.mp4", "Fallback: generated clip"]
  },
  audio: {
    icon: AudioWaveform,
    title: "Extract Audio",
    description: "FFmpeg extracts a mono WAV track for ASR. If ffmpeg is unavailable, the backend writes silence and logs the fallback.",
    config: ["Tool: ffmpeg", "Output: audio.wav", "Sample rate: 16k", "Fallback: silent wav"]
  },
  asr: {
    icon: FileText,
    title: "ASR Transcript",
    description: "Whisper CLI can transcribe audio when installed; otherwise the semi-real MVP uses a deterministic mock transcript.",
    config: ["Provider: mock / whisper_cli", "Output: transcript.txt", "Fallback: mock transcript", "Logs: explicit"]
  },
  transcript: {
    icon: FileText,
    title: "Transcript",
    description: "Whisper CLI can transcribe audio when installed; otherwise the semi-real MVP uses a deterministic mock transcript.",
    config: ["Provider: mock / whisper_cli", "Output: transcript.txt", "Fallback: mock transcript", "Logs: explicit"]
  },
  extract: {
    icon: FileText,
    title: "Extract Script",
    description: "ASR pulls a structured transcript from the video URL or local source path.",
    config: ["Input: URL or local path", "ASR: Whisper adapter", "Language: auto", "Output: transcript"]
  },
  rewrite: {
    icon: Sparkles,
    title: "Rewrite",
    description: "The script is tightened into a short-form narration shaped by topic, target style, and speaking style.",
    config: ["LLM: Qwen adapter", "Hook: enabled", "Target: configurable", "CTA: developer audience"]
  },
  rewrittenScript: {
    icon: Sparkles,
    title: "Rewritten Script",
    description: "The LLM provider rewrites the transcript into a punchy developer short-video voiceover.",
    config: ["Provider: mock / openai / ollama", "Output: rewritten_script.txt", "Style: configurable", "Fallback: mock rewrite"]
  },
  tts: {
    icon: AudioWaveform,
    title: "TTS",
    description: "Voice synthesis generates paced narration for a vertical AI builder short.",
    config: ["Voice: studio-default", "Speed: adaptive", "Emotion: confident", "Format: wav"]
  },
  voice: {
    icon: AudioWaveform,
    title: "Voice",
    description: "The TTS adapter generates voice.wav or a silent fallback audio track for stable rendering.",
    config: ["Provider: mock / edge_tts / FishSpeech", "Output: voice.wav", "Fallback: silence", "Render ready"]
  },
  "digital-human": {
    icon: UserRound,
    title: "Digital Human",
    description: "Avatar and lip-sync adapters are reserved for semi-real render handoff.",
    config: ["Avatar: cyber presenter", "Lip sync: adapter", "Canvas: 1080x1920", "FPS: 30"]
  },
  render: {
    icon: Clapperboard,
    title: "Render",
    description: "Renderer composes subtitles, narration, B-roll slots, and the final vertical video.",
    config: ["B-roll: manifest", "Subtitle burn: enabled", "Codec: h264", "Output: final.mp4"]
  },
  finalVideo: {
    icon: Clapperboard,
    title: "Final Video",
    description: "FFmpeg composes source video, generated voice, and subtitles into artifacts/outputs/{taskId}/final.mp4.",
    config: ["Tool: ffmpeg", "Output: final.mp4", "Subtitle burn: best effort", "Fallback: placeholder"]
  },
  titleCover: {
    icon: Megaphone,
    title: "Title & Cover",
    description: "Generates platform-ready title variants, hashtags, and cover prompts for the rendered short.",
    config: ["Output: title_cover.json", "Titles: 3 variants", "Cover: prompt draft", "Publish: draft-ready"]
  },
  cover: {
    icon: Subtitles,
    title: "Subtitle",
    description: "Subtitle and metadata artifacts are prepared for download, preview, and publish handoff.",
    config: ["Subtitle: SRT", "Title variants: 3", "Cover prompt: neon AI", "Tags: devtools"]
  },
  subtitles: {
    icon: Subtitles,
    title: "Generate Subtitles",
    description: "The backend splits the rewritten script into simple timed SRT cues.",
    config: ["Output: subtitles.srt", "Cue length: 2-4s", "Source: rewritten script", "Burn-in: ffmpeg render"]
  },
  publish: {
    icon: Megaphone,
    title: "Publish",
    description: "Publishing remains an assisted placeholder while retaining a clear manifest entry.",
    config: ["Platform: Douyin", "Publisher: Playwright placeholder", "Mode: assisted", "Status: ready"]
  },
  publishDraft: {
    icon: Megaphone,
    title: "Publish Draft",
    description: "Creates an assisted publishing manifest with the final video, title draft, cover prompts, and platform targets.",
    config: ["Output: publish_draft.json", "Platforms: Douyin/Bilibili/XHS", "Mode: manual confirm", "Publisher: Playwright reserved"]
  }
};

const defaultSteps: WorkflowStep[] = [
  { id: "extract", label: "Extract Script", status: "pending", progress: 0 },
  { id: "rewrite", label: "Rewrite", status: "pending", progress: 0 },
  { id: "tts", label: "TTS", status: "pending", progress: 0 },
  { id: "digital-human", label: "Digital Human", status: "pending", progress: 0 },
  { id: "render", label: "Render", status: "pending", progress: 0 },
  { id: "cover", label: "Subtitle", status: "pending", progress: 0 },
  { id: "publish", label: "Publish", status: "pending", progress: 0 }
];

const runtimeTemplates = [
  ["Whisper", "extracting transcript from source stream"],
  ["Whisper", "transcript completed, detected technical speech"],
  ["LLM", "rewriting viral hook and tightening CTA"],
  ["Qwen", "sampling short-video narration variants"],
  ["FishSpeech", "generating voice with studio-default timbre"],
  ["LatentSync", "syncing lips against generated waveform"],
  ["FFmpeg", "rendering subtitle layer and B-roll slots"],
  ["Renderer", "compositing vertical 9:16 preview frames"],
  ["Publisher", "preparing upload manifest"],
  ["Runtime", "heartbeat ok, queue workers active"]
] as const;

const mockArtifacts: ResultArtifacts = {
  transcript:
    "DevShorts AI turns long developer demos into structured short-video material: transcript, rewrite, voice, captions, and render manifest.",
  rewrittenScript:
    "Stop hand-editing every dev demo. Feed DevShorts AI a source clip, pick a style, and let the pipeline draft a punchy AI builder short with captions and a final render path.",
  subtitlesPath: "mock://artifacts/devshorts-demo.srt",
  titleCoverPath: "mock://artifacts/title-cover.json",
  publishDraftPath: "mock://artifacts/publish-draft.json",
  finalVideoPath: "mock://video/devshorts-final.mp4"
};

function normalizeLabel(step: WorkflowStep): WorkflowStep {
  return { ...step, label: stepConfig[step.id]?.title ?? step.label };
}

function statusClasses(status: StepStatus) {
  if (status === "success") return "border-emerald-300/45 bg-emerald-300/12 text-emerald-100 shadow-[0_0_26px_rgba(52,211,153,0.16)]";
  if (status === "running") return "border-violet-300/60 bg-violet-300/15 text-violet-50 shadow-[0_0_36px_rgba(167,139,250,0.28)]";
  if (status === "error") return "border-red-300/50 bg-red-400/15 text-red-100";
  return "border-white/10 bg-slate-950/65 text-slate-500";
}

function getActiveStep(steps: WorkflowStep[]) {
  return steps.find((step) => step.status === "running") ?? steps.find((step) => step.status === "pending") ?? steps[steps.length - 1];
}

function getStringArtifact(task: Task | null, keys: string[]) {
  if (!task) return "";

  for (const key of keys) {
    const value = task.artifacts[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return "";
}

function getResultArtifacts(task: Task | null): ResultArtifacts {
  const extractOutput = task?.steps.find((step) => step.id === "extract")?.output;
  const rewriteOutput = task?.steps.find((step) => step.id === "rewrite")?.output;

  return {
    transcript:
      getStringArtifact(task, ["transcript", "raw_transcript", "source_transcript", "script"]) ||
      (task?.mode === "mock" ? extractOutput : "") ||
      (task?.status === "success" ? mockArtifacts.transcript : ""),
    rewrittenScript:
      getStringArtifact(task, ["rewrittenScript", "rewritten_script", "rewrite", "final_script", "script_rewrite"]) ||
      rewriteOutput ||
      (task?.status === "success" ? mockArtifacts.rewrittenScript : ""),
    subtitlesPath:
      getStringArtifact(task, ["subtitles", "subtitles_path", "subtitle_path", "subtitle_url", "srt_path"]) ||
      (task?.status === "success" ? mockArtifacts.subtitlesPath : ""),
    titleCoverPath:
      getStringArtifact(task, ["titleCoverPath", "title_cover_path", "metadata_path"]) ||
      (task?.status === "success" ? mockArtifacts.titleCoverPath : ""),
    publishDraftPath:
      getStringArtifact(task, ["publishDraftPath", "publish_draft_path", "publish_manifest"]) ||
      (task?.status === "success" ? mockArtifacts.publishDraftPath : ""),
    finalVideoPath:
      getStringArtifact(task, ["finalVideo", "final_mp4_path", "final_video_path", "final_mp4", "render_url", "video_path"]) ||
      (task?.status === "success" ? mockArtifacts.finalVideoPath : "")
  };
}

function runtimeLineFromTaskLog(log: TaskLog, id: number): RuntimeLine {
  return {
    id,
    source: log.level === "error" ? "Backend" : "TaskLog",
    message: log.message,
    level: log.level === "error" ? "warn" : log.level === "warn" ? "warn" : "success"
  };
}

function buildPayload(mode: TaskMode, form: StudioFormState): CreateTaskPayload {
  const titlePrefix = mode === "mock" ? "Mock Demo" : "Semi-real MVP";
  const topic = form.topic.trim();
  const targetStyle = form.targetStyle.trim();
  const sourceUrl = form.sourceUrl.trim();
  const localFilePath = form.localFilePath.trim();

  return {
    mode,
    source_url: sourceUrl,
    local_file_path: localFilePath || undefined,
    topic: topic || undefined,
    target_style: targetStyle || undefined,
    speaking_style: form.speakingStyle,
    title: topic ? `${titlePrefix}: ${topic}` : `${titlePrefix}: DevShorts AI render`
  };
}

export function StudioView() {
  const { t } = useI18n();
  const [mode, setMode] = useState<TaskMode>("mock");
  const [form, setForm] = useState<StudioFormState>({
    sourceUrl: "https://www.douyin.com/video/mock-devshorts-demo",
    localFilePath: "",
    topic: "AI developer workflow",
    targetStyle: "vertical demo cutdown for AI builders",
    speakingStyle: "tech"
  });
  const [task, setTask] = useState<Task | null>(null);
  const [selectedStepId, setSelectedStepId] = useState("extract");
  const [isCreating, setIsCreating] = useState(false);
  const [runtimeLines, setRuntimeLines] = useState<RuntimeLine[]>([
    { id: 1, source: "Runtime", message: "booting DevShorts AI studio", level: "info" },
    { id: 2, source: "Scheduler", message: "waiting for pipeline task", level: "warn" }
  ]);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const demoCreatedRef = useRef(false);
  const seenLogKeysRef = useRef<Set<string>>(new Set());
  const logIdRef = useRef(3);
  const steps = (task?.steps ?? defaultSteps).map((step) => ({
    ...normalizeLabel(step),
    label: t.studio.steps[step.id as keyof typeof t.studio.steps] ?? normalizeLabel(step).label
  }));
  const activeStep = getActiveStep(steps);
  const resultArtifacts = useMemo(() => getResultArtifacts(task), [task]);
  const canCreate = Boolean(form.sourceUrl.trim() || form.localFilePath.trim());
  const isComplete = task?.status === "success";

  const selectedStep = useMemo(
    () => steps.find((step) => step.id === selectedStepId) ?? activeStep,
    [activeStep, selectedStepId, steps]
  );
  const selectedConfig = stepConfig[selectedStep.id] ?? stepConfig.extract;
  const SelectedIcon = selectedConfig.icon;

  useEffect(() => {
    if (mode !== "mock" || demoCreatedRef.current) return;
    demoCreatedRef.current = true;
    void handleCreateTask("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!task || task.status === "success" || task.status === "error") return;
    const timer = window.setInterval(async () => {
      const fresh = await getTask(task.id);
      setTask(fresh);
      const running = fresh.steps.find((step) => step.status === "running");
      if (running) setSelectedStepId(running.id);
    }, 900);
    return () => window.clearInterval(timer);
  }, [task]);

  useEffect(() => {
    if (mode !== "mock") return;
    const timer = window.setInterval(() => {
      const [source, message] = runtimeTemplates[Math.floor(Math.random() * runtimeTemplates.length)];
      const runningLabel = activeStep?.label ?? "Pipeline";
      const level: RuntimeLine["level"] = message.includes("completed") ? "success" : source === "Runtime" ? "warn" : "info";
      setRuntimeLines((current) => [
        ...current.slice(-48),
        {
          id: logIdRef.current++,
          source,
          message: `${message} :: ${runningLabel}`,
          level
        }
      ]);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeStep?.label, mode]);

  useEffect(() => {
    if (!task?.logs.length) return;

    const nextLines = task.logs.flatMap((log) => {
      const key = `${log.timestamp}-${log.message}`;
      if (seenLogKeysRef.current.has(key)) return [];
      seenLogKeysRef.current.add(key);
      return [runtimeLineFromTaskLog(log, logIdRef.current++)];
    });

    if (!nextLines.length) return;
    setRuntimeLines((current) => [...current.slice(-48), ...nextLines]);
  }, [task?.logs]);

  useEffect(() => {
    if (!consoleRef.current) return;
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [runtimeLines]);

  async function handleCreateTask(trigger: "auto" | "manual" = "manual") {
    setIsCreating(true);
    try {
      const payload = buildPayload(mode, form);
      const created = await createTask(payload);
      setTask(created);
      setSelectedStepId(created.steps[0]?.id ?? "extract");
      seenLogKeysRef.current = new Set();
      setRuntimeLines((current) => [
        ...current.slice(-42),
        {
          id: logIdRef.current++,
          source: "Scheduler",
          message: `${trigger === "auto" ? "auto-created" : "created"} ${payload.mode} task ${created.id.slice(0, 8)} with live monitor`,
          level: "success"
        }
      ]);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <AppShell active="/studio">
      <div className="space-y-5">
        <header className="relative overflow-hidden rounded-lg border border-violet-300/20 bg-slate-950/55 p-5 shadow-violet backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300 to-transparent" />
          <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full border border-cyan-300/20 bg-cyan-300/5 blur-xl md:block" />
          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs uppercase tracking-[0.28em] text-violet-200">{t.studio.eyebrow}</span>
                <span className="flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 font-mono text-xs text-emerald-200">
                  <StatusLight status={task?.status ?? "pending"} /> {t.studio.statusMode[mode]}
                </span>
              </div>
              <h1 className="mt-3 bg-gradient-to-r from-white via-cyan-100 to-violet-200 bg-clip-text text-3xl font-bold text-transparent md:text-5xl">
                {t.studio.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{t.studio.description}</p>
            </div>

            <div className="w-full xl:w-[580px]">
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-slate-950/70 p-1">
                {[
                  { value: "mock" as const, label: t.studio.mockDemo, icon: Radio },
                  { value: "semi_real" as const, label: t.studio.semiReal, icon: WandSparkles }
                ].map((option) => {
                  const Icon = option.icon;
                  const isSelected = mode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMode(option.value)}
                      className={cn(
                        "flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition",
                        isSelected ? "bg-cyan-300 text-slate-950 shadow-glow" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid gap-3">
                <LabeledInput
                  icon={Link2}
                  label={t.studio.videoUrl}
                  value={form.sourceUrl}
                  placeholder="https://..."
                  onChange={(value) => setForm((current) => ({ ...current, sourceUrl: value }))}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <LabeledInput
                    icon={FolderInput}
                    label={t.studio.localFilePath}
                    value={form.localFilePath}
                    placeholder="D:\\clips\\source.mp4"
                    onChange={(value) => setForm((current) => ({ ...current, localFilePath: value }))}
                  />
                  <LabeledInput
                    icon={Target}
                    label={t.studio.topic}
                    value={form.topic}
                    placeholder="AI agent demo"
                    onChange={(value) => setForm((current) => ({ ...current, topic: value }))}
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-[1fr_260px]">
                  <LabeledInput
                    icon={Sparkles}
                    label={t.studio.targetStyle}
                    value={form.targetStyle}
                    placeholder="fast oral explainer for builders"
                    onChange={(value) => setForm((current) => ({ ...current, targetStyle: value }))}
                  />
                  <div className="rounded-md border border-white/10 bg-slate-950/55 p-2">
                    <div className="mb-2 px-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{t.studio.speakingStyle}</div>
                    <div className="grid grid-cols-3 gap-1">
                      {speakingStyles.map((style) => (
                        <button
                          key={style.value}
                          type="button"
                          title={style.helper}
                          onClick={() => setForm((current) => ({ ...current, speakingStyle: style.value }))}
                          className={cn(
                            "h-9 rounded px-2 text-xs font-semibold transition",
                            form.speakingStyle === style.value
                              ? "bg-violet-300 text-slate-950"
                              : "bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-slate-100"
                          )}
                        >
                          {style.value === "tech" ? t.studio.tech : style.value === "oral" ? t.studio.oral : t.studio.viral}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <Button onClick={() => handleCreateTask()} disabled={isCreating || !canCreate} className="gap-2">
                  {isCreating ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Play className="h-4 w-4" />}
                  {mode === "mock" ? t.studio.createMock : t.studio.runSemiReal}
                </Button>
              </div>
            </div>
          </div>
        </header>

        <Card className="overflow-hidden border-violet-300/15">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Rocket className="h-4 w-4 text-cyan-200" /> {t.studio.timeline}</CardTitle>
            {task ? <span className="flex items-center gap-2 font-mono text-xs text-slate-500"><StatusLight status={task.status} /> {task.status}</span> : null}
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 lg:grid-cols-7">
              {steps.map((step, index) => {
                const Icon = stepConfig[step.id]?.icon ?? FileText;
                const isRunning = step.status === "running";
                const connectorIsActive = step.status === "success" || isRunning;
                return (
                  <div key={step.id} className="relative">
                    {index < steps.length - 1 ? (
                      <div
                        className={cn(
                          "absolute left-[calc(50%+28px)] right-[calc(-50%+28px)] top-7 z-0 hidden h-0.5 lg:block",
                          connectorIsActive ? "workflow-connector" : "bg-white/10"
                        )}
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedStepId(step.id)}
                      className={cn(
                        "relative z-10 flex h-full min-h-36 w-full flex-col items-start rounded-lg border p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/40 hover:shadow-glow",
                        statusClasses(step.status),
                        selectedStepId === step.id && "ring-2 ring-cyan-300/25",
                        isRunning && "animate-slow-glow"
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-slate-950/60">
                          {step.status === "success" ? <Check className="h-5 w-5" /> : isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
                        </span>
                        <span className="font-mono text-xs text-slate-500">0{index + 1}</span>
                      </div>
                      <div className="mt-4 text-sm font-semibold">{step.label}</div>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 transition-all duration-700" style={{ width: `${step.progress}%` }} />
                      </div>
                      <div className="mt-2 font-mono text-xs uppercase text-slate-500">{step.status} / {step.progress}%</div>
                    </button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SelectedIcon className="h-4 w-4 text-violet-200" />
                {selectedConfig.title} Node
              </CardTitle>
              <span className="flex items-center gap-2 font-mono text-xs uppercase text-slate-500">
                <StatusLight status={selectedStep.status} /> {selectedStep.status} / {selectedStep.progress}%
              </span>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-[1fr_300px]">
              <div>
                <p className="text-sm leading-6 text-slate-400">{selectedConfig.description}</p>
                <Textarea
                  className="mt-4 min-h-36 font-mono"
                  value={
                    selectedStep.output ??
                    `> ${selectedConfig.title} ${t.studio.adapterOnline}\n> ${t.studio.waitingArtifact}\n> ${mode} ${t.studio.streamAttached}`
                  }
                  readOnly
                />
              </div>
              <div className="rounded-md border border-white/10 bg-slate-950/55 p-4">
                <div className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-200">{t.studio.nodeConfig}</div>
                <div className="mt-4 space-y-3">
                  {selectedConfig.config.map((item) => (
                    <div key={item} className="rounded-md border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <RuntimeConsole lines={runtimeLines} consoleRef={consoleRef} mode={mode} />
        </div>

        <ResultPanel artifacts={resultArtifacts} isComplete={isComplete} mode={mode} />
      </div>
    </AppShell>
  );
}

function LabeledInput({
  icon: Icon,
  label,
  value,
  placeholder,
  onChange
}: {
  icon: ElementType;
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        <Icon className="h-3.5 w-3.5 text-cyan-300" />
        {label}
      </span>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ResultPanel({ artifacts, isComplete, mode }: { artifacts: ResultArtifacts; isComplete: boolean; mode: TaskMode }) {
  const { t } = useI18n();
  const resultItems = [
    { label: t.studio.transcript, value: artifacts.transcript, icon: FileText, multiline: true },
    { label: t.studio.rewrittenScript, value: artifacts.rewrittenScript, icon: Sparkles, multiline: true },
    { label: t.studio.subtitlesPath, value: artifacts.subtitlesPath, icon: Subtitles, multiline: false },
    { label: "Title & Cover Draft", value: artifacts.titleCoverPath, icon: Megaphone, multiline: false },
    { label: "Publish Draft", value: artifacts.publishDraftPath, icon: Rocket, multiline: false },
    { label: t.studio.finalVideo, value: artifacts.finalVideoPath, icon: Download, multiline: false }
  ];

  return (
    <Card className="overflow-hidden border-emerald-300/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clapperboard className="h-4 w-4 text-emerald-200" /> {t.studio.artifacts}</CardTitle>
        <span className={cn("font-mono text-xs", isComplete ? "text-emerald-200" : "text-slate-500")}>
          {isComplete ? `${t.studio.statusMode[mode]} ${t.studio.outputReady}` : t.studio.waitingCompletion}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-2">
          {resultItems.map((item) => {
            const Icon = item.icon;
            const value = item.value || "Pending artifact";
            return (
              <div key={item.label} className="rounded-md border border-white/10 bg-slate-950/50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <Icon className="h-4 w-4 text-cyan-200" />
                    {item.label}
                  </div>
                  {item.label.includes("final.mp4") && item.value ? (
                    <Button asChild variant="secondary" size="sm" className="gap-2">
                      <a href={artifactUrl(item.value)} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t.studio.preview}
                      </a>
                    </Button>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "mt-3 rounded border border-white/10 bg-black/20 p-3 font-mono text-xs leading-5",
                    item.value ? "text-slate-300" : "text-slate-600",
                    item.multiline ? "min-h-24 whitespace-pre-wrap" : "truncate"
                  )}
                >
                  {item.value ? value : t.studio.pendingArtifact}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function RuntimeConsole({
  lines,
  consoleRef,
  mode
}: {
  lines: RuntimeLine[];
  consoleRef: RefObject<HTMLDivElement>;
  mode: TaskMode;
}) {
  const { t } = useI18n();
  return (
    <Card className="overflow-hidden border-cyan-300/15">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Radio className="h-4 w-4 text-emerald-200" /> {t.studio.console}</CardTitle>
        <span className="flex items-center gap-2 font-mono text-xs text-emerald-200"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" /> {mode === "mock" ? t.studio.demoStream : t.studio.backendLogs}</span>
      </CardHeader>
      <CardContent>
        <div ref={consoleRef} className="terminal-scanline relative h-[420px] overflow-hidden overflow-y-auto rounded-md border border-cyan-300/10 bg-[#030711] p-4 font-mono text-xs shadow-inner">
          {lines.map((line) => (
            <div key={line.id} className="mb-2 grid grid-cols-[92px_1fr] gap-3">
              <span
                className={cn(
                  "uppercase",
                  line.level === "success" && "text-emerald-300",
                  line.level === "warn" && "text-amber-300",
                  line.level === "info" && "text-cyan-300"
                )}
              >
                [{line.source}]
              </span>
              <span className="text-slate-300">
                {line.message}
                <span className="ml-1 inline-flex w-5 animate-pulse text-violet-200">...</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
