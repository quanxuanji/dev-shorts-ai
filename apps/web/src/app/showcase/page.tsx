"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AudioLines,
  BadgeCheck,
  Boxes,
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Download,
  FileAudio,
  FileJson,
  FileText,
  Film,
  Github,
  Layers3,
  ListChecks,
  Loader2,
  Mic2,
  MonitorPlay,
  Play,
  RadioTower,
  Scissors,
  Server,
  SlidersHorizontal,
  Sparkles,
  Stars,
  Subtitles,
  Terminal,
  Timer,
  WandSparkles,
  Waves
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getStudioRuntime } from "@/lib/api";
import type { StudioAsset, StudioRuntimeData, StudioScene } from "@/lib/types";

type Shot = "cover" | "topic" | "script" | "voice" | "scenes" | "export" | "summary";

type ShowcasePageProps = {
  searchParams?: {
    shot?: string;
  };
};

const shotOrder: Shot[] = ["cover", "topic", "script", "voice", "scenes", "export", "summary"];

const shotMeta: Record<Shot, { index: string; label: string }> = {
  cover: { index: "01", label: "Studio Overview" },
  topic: { index: "02", label: "Topic Input" },
  script: { index: "03", label: "LLM Script" },
  voice: { index: "04", label: "Voice Config" },
  scenes: { index: "05", label: "Scene Timeline" },
  export: { index: "06", label: "Export Result" },
  summary: { index: "07", label: "Production Studio" }
};

type RuntimeScene = {
  rank: number;
  title: string;
  tag: string;
  duration: string;
  start: string;
  summary: string;
  growth: string;
  narration: string;
  sceneIndex: number;
  audioDurationMs?: number | null;
  fromFrame?: number | null;
  visualStartMs?: number | null;
  speechStartMs?: number | null;
};

type RuntimeFile = {
  name: string;
  detail: string;
  icon: LucideIcon;
  exists: boolean;
  url?: string | null;
};

const fallbackScenes = [
  {
    rank: 1,
    title: "Claude Code",
    tag: "AI Agent",
    duration: "04.2s",
    start: "00:00.0",
    summary: "终端级 AI 编程助手，读项目、改代码、执行命令。",
    growth: "+12.8k"
  },
  {
    rank: 2,
    title: "OpenHands",
    tag: "Coding",
    duration: "03.8s",
    start: "00:04.7",
    summary: "开源 AI 软件工程师 Agent，自动处理 issue 和开发任务。",
    growth: "+8.4k"
  },
  {
    rank: 3,
    title: "FastMCP",
    tag: "MCP",
    duration: "03.9s",
    start: "00:09.0",
    summary: "快速搭建 MCP 工具服务，把业务系统接给大模型。",
    growth: "+6.9k"
  },
  {
    rank: 4,
    title: "Mem0",
    tag: "Memory",
    duration: "03.6s",
    start: "00:13.4",
    summary: "给 AI 应用长期记忆，让 Agent 理解持续上下文。",
    growth: "+5.7k"
  },
  {
    rank: 5,
    title: "Cursor Tools",
    tag: "Cursor",
    duration: "03.7s",
    start: "00:17.5",
    summary: "围绕 Cursor 的插件和脚手架生态，提高编辑器自动化效率。",
    growth: "+4.8k"
  },
  {
    rank: 6,
    title: "Ollama",
    tag: "Local LLM",
    duration: "03.5s",
    start: "00:21.7",
    summary: "本地大模型运行入口，适合私有 AI 内容工作台。",
    growth: "+4.2k"
  },
  {
    rank: 7,
    title: "ComfyUI",
    tag: "AI Video",
    duration: "03.8s",
    start: "00:25.7",
    summary: "节点式视觉工作流，图像和视频创作者都在用。",
    growth: "+3.9k"
  },
  {
    rank: 8,
    title: "Dify",
    tag: "Workflow",
    duration: "03.5s",
    start: "00:30.0",
    summary: "把 LLM、工具调用、知识库编排成可上线应用。",
    growth: "+3.5k"
  }
] as const;

const fallbackLogs = [
  ["14:08:11", "LLM", "rewrite segments: 8 scenes, 736 chars"],
  ["14:08:16", "FishSpeech", "scene-0.wav generated, duration=4.2s"],
  ["14:08:29", "Timeline", "visualStartMs <= speechStartMs for all scenes"],
  ["14:08:51", "Remotion", "render completed from timeline.json"],
  ["14:09:03", "FFmpeg", "mux final.mp4 + voice.wav + subtitles.srt"],
  ["14:09:06", "Export", "artifacts/github-weekly-top8/final.mp4 passed"]
] as const;

const fallbackFiles = [
  { name: "final.mp4", detail: "1080x1920 / 42.6s", icon: Film, exists: true },
  { name: "voice.wav", detail: "fixed tech-host-01 voice", icon: FileAudio, exists: true },
  { name: "subtitles.srt", detail: "24 timed subtitle blocks", icon: FileText, exists: true },
  { name: "timeline.json", detail: "8 scene sync records", icon: FileJson, exists: true },
  { name: "scene-0.wav", detail: "04.2s segmented TTS", icon: Waves, exists: true }
] as const;

const RuntimeContext = createContext<StudioRuntimeData | null>(null);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function useRuntime() {
  return useContext(RuntimeContext);
}

function formatMs(ms?: number | null) {
  if (typeof ms !== "number" || Number.isNaN(ms)) return "00:00.0";
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

function durationLabel(scene: StudioScene) {
  const ms = scene.audio_duration_ms ?? (typeof scene.speech_end_ms === "number" && typeof scene.speech_start_ms === "number" ? scene.speech_end_ms - scene.speech_start_ms : null);
  return typeof ms === "number" ? `${(ms / 1000).toFixed(1)}s` : "pending";
}

function normalizeScenes(runtime: StudioRuntimeData | null): RuntimeScene[] {
  if (!runtime?.scenes.length) {
    return fallbackScenes.map((scene, index) => ({
      ...scene,
      narration: scene.summary,
      sceneIndex: index,
      audioDurationMs: Math.round(Number.parseFloat(scene.duration) * 1000)
    }));
  }
  return runtime.scenes.map((scene, index) => ({
    rank: scene.rank ?? index + 1,
    title: scene.title,
    tag: scene.tags[0] ?? (scene.rank ? "TOP PROJECT" : "Intro"),
    duration: durationLabel(scene),
    start: formatMs(scene.speech_start_ms ?? scene.visual_start_ms),
    summary: scene.summary || scene.caption || scene.narration,
    narration: scene.narration || scene.summary || scene.caption,
    growth: scene.growth,
    sceneIndex: scene.scene_index,
    audioDurationMs: scene.audio_duration_ms,
    fromFrame: scene.from_frame,
    visualStartMs: scene.visual_start_ms,
    speechStartMs: scene.speech_start_ms
  }));
}

function useRuntimeScenes() {
  const runtime = useRuntime();
  return useMemo(() => normalizeScenes(runtime), [runtime]);
}

function fileIcon(name: string, kind: string): LucideIcon {
  if (kind === "video" || name.endsWith(".mp4")) return Film;
  if (kind.includes("audio") || name.endsWith(".wav")) return FileAudio;
  if (name.endsWith(".srt") || kind === "subtitle") return FileText;
  if (name.endsWith(".json")) return FileJson;
  return Waves;
}

function normalizeFiles(runtime: StudioRuntimeData | null): RuntimeFile[] {
  if (!runtime?.assets.length) return [...fallbackFiles];
  return runtime.assets
    .filter((asset) => asset.exists)
    .slice(0, 10)
    .map((asset) => ({
      name: asset.name,
      detail: asset.detail || `${Math.round(asset.size_bytes / 1024)} KB`,
      icon: fileIcon(asset.name, asset.kind),
      exists: asset.exists,
      url: asset.url ? `${API_URL}${asset.url}` : null
    }));
}

function useRuntimeFiles() {
  const runtime = useRuntime();
  return useMemo(() => normalizeFiles(runtime), [runtime]);
}

function useRuntimeLogs() {
  const runtime = useRuntime();
  return useMemo(() => {
    if (!runtime?.logs.length) return [...fallbackLogs];
    return runtime.logs.slice(-8).map((log) => {
      const date = new Date(log.timestamp);
      const time = Number.isNaN(date.getTime())
        ? "--:--:--"
        : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
      const match = log.message.match(new RegExp("^\\[([^\\]]+)\\]\\s*(.*)$"));
      return [time, match?.[1] ?? log.level.toUpperCase(), match?.[2] ?? log.message] as const;
    });
  }, [runtime]);
}

function getShot(value?: string): Shot {
  return shotOrder.includes(value as Shot) ? (value as Shot) : "cover";
}

export default function ShowcasePage({ searchParams }: ShowcasePageProps) {
  const shot = getShot(searchParams?.shot);
  const meta = shotMeta[shot];
  const [runtime, setRuntime] = useState<StudioRuntimeData | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStudioRuntime({ demo: true })
      .then((data) => {
        if (!cancelled) setRuntime(data);
      })
      .catch(() => {
        if (!cancelled) setRuntime(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RuntimeContext.Provider value={runtime}>
      <main data-runtime-loaded={runtime ? "true" : "false"} className="h-screen w-screen overflow-hidden bg-[#08080A] text-[#F5F5F7]">
        <div className="relative h-full w-full overflow-hidden">
          <Background />
          <div className="relative z-10 grid h-full grid-rows-[78px_minmax(0,1fr)_190px] gap-3 p-4">
            <TopBar shot={shot} meta={meta} />
            <div className="grid min-h-0 grid-cols-[350px_minmax(0,1fr)_410px] gap-3">
              <LeftStudio shot={shot} />
              <CenterStudio shot={shot} />
              <RightStudio shot={shot} />
            </div>
            <BottomRuntime shot={shot} />
          </div>
        </div>
      </main>
    </RuntimeContext.Provider>
  );
}

function Background() {
  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_8%,rgba(124,92,255,0.16),transparent_28rem),radial-gradient(circle_at_82%_10%,rgba(93,226,255,0.12),transparent_30rem),linear-gradient(180deg,#101114_0%,#08080A_54%,#0B0B0C_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:52px_52px] opacity-20" />
    </>
  );
}

function TopBar({ shot, meta }: { shot: Shot; meta: (typeof shotMeta)[Shot] }) {
  const runtime = useRuntime();
  const totalFrames = typeof runtime?.timeline.totalFrames === "number" ? runtime.timeline.totalFrames : undefined;
  const progress = runtime?.progress ?? (shot === "export" || shot === "summary" ? 100 : 0);
  const status = runtime?.status ?? "running";
  const statusLabel = runtime?.current_step || (status === "success" ? "export passed" : status);
  return (
    <header className="grid grid-cols-[350px_minmax(0,1fr)_410px] gap-3">
      <Panel className="flex items-center justify-between px-5 py-0">
        <div>
          <div className="flex items-center gap-2 text-sm text-[#9EA3AE]">
            <Sparkles className="h-4 w-4 text-[#5DE2FF]" />
            DevShorts AI
          </div>
          <div className="mt-1 text-xl font-semibold">{runtime?.title || "GitHub Weekly Top8 Studio"}</div>
        </div>
        <div className="rounded-2xl border border-[#5DE2FF]/25 bg-[#5DE2FF]/10 px-3 py-2 text-sm text-[#5DE2FF]">
          shot {meta.index}
        </div>
      </Panel>
      <Panel className="flex items-center gap-5 px-5 py-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-normal">{meta.label}</h1>
            <StatusPill>{statusLabel}</StatusPill>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
            <div className="h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#5DE2FF]" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <TopMetric label="progress" value={`${progress}%`} />
        <TopMetric label="frames" value={totalFrames ? String(totalFrames) : "from timeline"} />
        <TopMetric label="export" value={status === "success" ? "passed" : status} />
      </Panel>
      <Panel className="flex items-center justify-between px-5 py-0">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-[#5DE2FF]" />
          <div>
            <div className="text-sm text-[#9EA3AE]">Runtime</div>
            <div className="font-mono text-sm">{runtime?.mode === "demo" ? "real artifacts / demo task" : "real runtime"}</div>
          </div>
        </div>
        <button className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black">
          <Play className="h-4 w-4" />
          Preview
        </button>
      </Panel>
    </header>
  );
}

function LeftStudio({ shot }: { shot: Shot }) {
  const scenes = useRuntimeScenes();
  return (
    <aside className="grid min-h-0 grid-rows-[200px_minmax(0,1fr)_172px] gap-3">
      <Panel className="p-4">
        <PanelTitle icon={ListChecks} title="Workflow" right="8 tasks" />
        <div className="mt-3 space-y-2">
          <WorkflowItem active={shot === "topic"} done label="Topic Brief" sub="keywords + style + platform" />
          <WorkflowItem active={shot === "script"} done label="LLM Rewrite" sub="8 script sections" />
          <WorkflowItem active={shot === "voice"} done label="FishSpeech TTS" sub="segmented voice queue" />
          <WorkflowItem active={shot === "scenes"} done label="Scene Timeline" sub="subtitle + visual sync" />
          <WorkflowItem active={shot === "export"} done={shot === "export" || shot === "summary"} label="Final Export" sub="ffmpeg mux passed" />
        </div>
      </Panel>
      <Panel className="min-h-0 p-4">
        <PanelTitle icon={Layers3} title="Scenes" right="00:33.5" />
        <div className="mt-3 grid gap-2">
          {scenes.map((scene) => (
            <div
              key={scene.rank}
              className={`grid grid-cols-[38px_1fr_auto] items-center gap-3 rounded-2xl border px-3 py-2 ${
                scene.rank === 3 || (shot === "cover" && scene.rank === 1)
                  ? "border-[#7C5CFF]/45 bg-[#7C5CFF]/14"
                  : "border-white/8 bg-black/18"
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-black text-black">#{scene.rank}</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{scene.title}</div>
                <div className="truncate text-xs text-[#8E95A3]">
                  {scene.start} / {scene.duration}
                </div>
              </div>
              <div className="text-xs text-[#5DE2FF]">{scene.growth}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="p-4">
        <PanelTitle icon={Boxes} title="Task Queue" right="3 active" />
        <QueueItem label="scene-4.wav" status="generating" progress={66} />
        <QueueItem label="subtitles.srt" status="waiting" progress={32} />
        <QueueItem label="final.mp4" status="rendering" progress={shot === "export" ? 100 : 78} />
      </Panel>
    </aside>
  );
}

function CenterStudio({ shot }: { shot: Shot }) {
  return (
    <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_214px] gap-3">
      <Panel className="min-h-0 p-4">
        {shot === "cover" && <OverviewWorkspace />}
        {shot === "topic" && <TopicWorkspace />}
        {shot === "script" && <ScriptWorkspace />}
        {shot === "voice" && <VoiceWorkspace />}
        {shot === "scenes" && <SceneWorkspace />}
        {shot === "export" && <ExportWorkspace />}
        {shot === "summary" && <SummaryWorkspace />}
      </Panel>
      <Panel className="p-4">
        <Timeline shot={shot} />
      </Panel>
    </section>
  );
}

function RightStudio({ shot }: { shot: Shot }) {
  const files = useRuntimeFiles();
  const logs = useRuntimeLogs();
  const scenes = useRuntimeScenes();
  const selectedScene = scenes.find((scene) => scene.rank === 3) ?? scenes[0];
  return (
    <aside className="grid min-h-0 grid-rows-[minmax(0,1fr)_248px] gap-3">
      <Panel className="min-h-0 p-4">
        <PanelTitle icon={MonitorPlay} title="Render Preview" right={shot === "export" ? "final.mp4" : "live"} />
        <div className="mt-3 grid h-[calc(100%-34px)] grid-cols-[180px_1fr] gap-4">
          <PhonePreview />
          <div className="flex min-w-0 flex-col gap-3">
            <MiniCard label="current scene" value={`#${selectedScene?.rank ?? 1} ${selectedScene?.title ?? "Scene"}`} />
            <MiniCard label="from frame" value={selectedScene?.fromFrame != null ? String(selectedScene.fromFrame) : "timeline"} />
            <MiniCard label="subtitle" value={selectedScene?.summary || selectedScene?.narration || "subtitle timing loaded"} />
            <div className="rounded-2xl border border-white/8 bg-black/25 p-3">
              <div className="mb-2 text-xs uppercase tracking-[0.18em] text-[#8E95A3]">Export panel</div>
              <div className="space-y-2">
                {files.slice(0, shot === "cover" ? 3 : 5).map((file) => (
                  <FileRow key={file.name} file={file} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>
      <Panel className="p-4">
        <PanelTitle icon={Terminal} title="Live Logs" right="tail -f" />
        <div className="mt-3 space-y-2 font-mono text-xs">
          {logs.slice(0, 5).map(([time, source, line]) => (
            <div key={`${time}-${source}`} className="grid grid-cols-[64px_86px_1fr] gap-2 rounded-xl bg-black/24 px-3 py-2">
              <span className="text-[#686F7D]">{time}</span>
              <span className="text-[#5DE2FF]">[{source}]</span>
              <span className="truncate text-[#C9CED8]">{line}</span>
            </div>
          ))}
        </div>
      </Panel>
    </aside>
  );
}

function BottomRuntime({ shot }: { shot: Shot }) {
  const runtime = useRuntime();
  const scenes = useRuntimeScenes();
  const progress = runtime?.progress ?? (shot === "export" || shot === "summary" ? 100 : 0);
  return (
    <footer className="grid grid-cols-[1.05fr_0.95fr_0.8fr] gap-3">
      <Panel className="p-4">
        <PanelTitle icon={Terminal} title="Render Logs" right="runtime console" />
        <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs text-[#C9CED8]">
          <LogLine tag="STUDIO" text="task github-weekly-top8 created from fixed showcase data" />
          <LogLine tag="LLM" text="script_sections.json saved, top1-top8 verified" />
          <LogLine tag="TTS" text="FishSpeech provider: tech-host-01, segmented mode" />
          <LogLine tag="SYNC" text="timeline.json generated from real scene durations" />
          <LogLine tag="RENDER" text={`progress=${progress}%, timeline=${runtime?.timeline.items ? "loaded" : "pending"}`} />
          <LogLine tag="FFMPEG" text="ffmpeg -i render.mov -i voice.wav -vf subtitles final.mp4" />
        </div>
      </Panel>
      <Panel className="p-4">
        <PanelTitle icon={Waves} title="TTS Durations" right="scene audio" />
        <div className="mt-4 grid grid-cols-8 items-end gap-2">
          {scenes.map((scene, index) => (
            <div key={scene.rank} className="text-center">
              <div className="mx-auto rounded-t-lg bg-gradient-to-t from-[#7C5CFF] to-[#5DE2FF]" style={{ height: `${42 + index * 7}px`, width: "18px" }} />
              <div className="mt-2 text-[10px] text-[#8E95A3]">s{scene.rank}</div>
              <div className="text-[10px] text-[#DDE0E7]">{scene.duration}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel className="p-4">
        <PanelTitle icon={BadgeCheck} title="Timeline Sync" right="passed" />
        <div className="mt-4 space-y-3 text-sm">
          <HealthRow label="visualStartMs <= speechStartMs" ok />
          <HealthRow label="0.5s silence between scenes" ok />
          <HealthRow label="subtitle blocks aligned" ok />
          <HealthRow label="no #? rank fallback" ok />
        </div>
      </Panel>
    </footer>
  );
}

function OverviewWorkspace() {
  const runtime = useRuntime();
  return (
    <div className="grid h-full grid-cols-[1fr_320px] gap-4">
      <div className="grid min-h-0 grid-rows-[170px_1fr] gap-4">
        <div className="grid grid-cols-4 gap-3">
          <BigMetric label="Topic" value="GitHub Top8" icon={Github} />
          <BigMetric label="Scenes" value={`${runtime?.scenes.length || 8} ready`} icon={Layers3} />
          <BigMetric label="Voice" value={String(runtime?.provider.fishspeechVoice || "tech-host-01")} icon={Mic2} />
          <BigMetric label="Export" value={runtime?.assets.find((asset) => asset.name === "final.mp4")?.exists ? "final.mp4" : "pending"} icon={Film} />
        </div>
        <div className="grid grid-cols-[1fr_0.85fr] gap-4">
          <ScriptEditor compact />
          <SceneBoard compact />
        </div>
      </div>
      <div className="grid grid-rows-[1fr_154px] gap-4">
        <WaveformPanel />
        <ProviderPanel />
      </div>
    </div>
  );
}

function TopicWorkspace() {
  const runtime = useRuntime();
  const scenes = useRuntimeScenes();
  return (
    <div className="grid h-full grid-cols-[1fr_360px] gap-4">
      <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
        <PanelTitle icon={Sparkles} title="Creation Brief" right="locked" />
        <div className="mt-4 rounded-3xl border border-[#7C5CFF]/24 bg-[#7C5CFF]/10 p-5">
          <div className="text-sm uppercase tracking-[0.28em] text-[#8E95A3]">Topic</div>
          <div className="mt-3 text-3xl font-semibold">{runtime?.topic || "本周 GitHub 最值得关注的 8 个 AI 项目"}</div>
          <p className="mt-4 text-lg leading-relaxed text-[#C9CED8]">
            {runtime?.target_style || "面向程序员和 AI 创作者，生成一条竖屏短视频，突出项目价值、增长数据和为什么值得收藏。"}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <ConfigCard label="目标平台" value="抖音 / 小红书" icon={RadioTower} />
          <ConfigCard label="视频类型" value="GitHub Weekly Top8" icon={Github} />
          <ConfigCard label="内容风格" value="技术博主 / 快节奏" icon={Mic2} />
          <ConfigCard label="输出比例" value={runtime?.output_ratio || "1080x1920 / 9:16"} icon={Film} />
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
        <PanelTitle icon={Stars} title="Keywords" right="auto tags" />
        <div className="mt-4 flex flex-wrap gap-2">
          {["AI Agent", "MCP", "Claude Code", "AI Memory", "Cursor 生态", "Local LLM", "AI Video", "Workflow"].map((tag, index) => (
            <span key={tag} className={`rounded-full border px-3 py-2 text-sm ${index < 2 ? "border-[#5DE2FF]/35 bg-[#5DE2FF]/10 text-[#5DE2FF]" : "border-white/10 bg-white/[0.04] text-[#C9CED8]"}`}>
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-5 space-y-2">
          {scenes.slice(0, 5).map((scene) => (
            <CompactScene key={scene.rank} scene={scene} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ScriptWorkspace() {
  return (
    <div className="grid h-full grid-cols-[240px_1fr_300px] gap-4">
      <SceneScriptList />
      <ScriptEditor />
      <div className="rounded-3xl border border-white/10 bg-black/24 p-4">
        <PanelTitle icon={WandSparkles} title="AI Rewrite" right="3 suggestions" />
        <Suggestion title="开头更抓人" text="先用一句痛点：这周 GitHub AI 项目又刷屏了。" />
        <Suggestion title="项目解释更短" text="每个项目控制在两句话，保留中文解释和 why hot。" />
        <Suggestion title="结尾转化" text="最后引导收藏：下期继续看开源 AI 工具。" />
      </div>
    </div>
  );
}

function VoiceWorkspace() {
  const runtime = useRuntime();
  const scenes = useRuntimeScenes();
  return (
    <div className="grid h-full grid-cols-[1fr_360px] gap-4">
      <div className="grid grid-rows-[1fr_190px] gap-4">
        <WaveformPanel large />
        <div className="rounded-3xl border border-white/10 bg-black/24 p-4">
          <PanelTitle icon={Timer} title="Segmented TTS Queue" right="0.5s silence" />
          <div className="mt-4 grid grid-cols-4 gap-3">
            {scenes.slice(0, 4).map((scene) => (
              <TtsCard key={scene.rank} scene={scene} />
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
        <PanelTitle icon={SlidersHorizontal} title="Provider Config" right="FishSpeech" />
        <ConfigLine label="provider" value={String(runtime?.provider.tts || "fishspeech")} />
        <ConfigLine label="reference_id" value={String(runtime?.provider.fishspeechVoice || "tech-host-01")} />
        <ConfigLine label="voice preset" value={String(runtime?.provider.fishspeechVoice || "Weekly Tech Host")} />
        <ConfigLine label="mode" value="segmented TTS" />
        <ConfigLine label="silence gap" value="0.5s" />
        <ConfigLine label="output" value="voice.wav" />
      </div>
    </div>
  );
}

function SceneWorkspace() {
  const scenes = useRuntimeScenes();
  const selected = scenes.find((scene) => scene.rank === 3) ?? scenes[0];
  return (
    <div className="grid h-full grid-cols-[1fr_360px] gap-4">
      <div className="grid grid-rows-[1fr_150px] gap-4">
        <SceneBoard />
        <SubtitleTrack />
      </div>
      <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
        <PanelTitle icon={MonitorPlay} title="Selected Scene" right={`#${selected?.rank ?? 1} / ${selected?.title ?? "Scene"}`} />
        <div className="mt-4 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_35%_18%,rgba(124,92,255,0.35),transparent_18rem),#0C0D10] p-6">
          <div className="flex items-center justify-between">
            <span className="rounded-2xl bg-white px-4 py-2 text-lg font-black text-black">#{selected?.rank ?? 1}</span>
            <span className="text-sm text-[#5DE2FF]">{selected?.growth || "timeline loaded"}</span>
          </div>
          <div className="mt-8 text-4xl font-semibold">{selected?.title ?? "Scene"}</div>
          <p className="mt-4 text-lg leading-relaxed text-[#DDE0E7]">{selected?.summary || selected?.narration}</p>
          <div className="mt-10 rounded-2xl bg-black/42 p-4 text-center text-sm">字幕：{selected?.narration || selected?.summary}</div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MiniCard label="speech" value={selected?.duration ?? "timeline"} />
          <MiniCard label="visual start" value={formatMs(selected?.visualStartMs)} />
        </div>
      </div>
    </div>
  );
}

function ExportWorkspace() {
  const runtime = useRuntime();
  const files = useRuntimeFiles();
  return (
    <div className="grid h-full grid-cols-[1fr_380px] gap-4">
      <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
        <PanelTitle icon={Activity} title="Render Monitor" right="passed" />
        <div className="mt-5 grid grid-cols-4 gap-3">
          <BigMetric label="Render" value={`${runtime?.progress ?? 100}%`} icon={BadgeCheck} />
          <BigMetric label="Duration" value={formatMs(runtime?.waveform.durationMs)} icon={Clock3} />
          <BigMetric label="Frames" value={String(runtime?.timeline.totalFrames ?? "timeline")} icon={Film} />
          <BigMetric label="Sync" value="passed" icon={CheckCircle2} />
        </div>
        <div className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xl font-semibold">ffmpeg export</div>
            <StatusPill>completed</StatusPill>
          </div>
          <pre className="overflow-hidden rounded-2xl bg-[#050506] p-4 font-mono text-sm leading-relaxed text-[#C9CED8]">
            ffmpeg -i render.mov -i voice.wav{"\n"}
            -vf subtitles=subtitles.srt{"\n"}
            -c:v libx264 -c:a aac final.mp4
          </pre>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
        <PanelTitle icon={Download} title="Generated Assets" right="5 files" />
        <div className="mt-4 space-y-3">
          {files.map((file) => (
            <FileAsset key={file.name} file={file} />
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryWorkspace() {
  const runtime = useRuntime();
  return (
    <div className="grid h-full grid-cols-[1fr_380px] gap-4">
      <div className="grid grid-rows-[1fr_160px] gap-4">
        <div className="grid grid-cols-4 gap-4">
          <FlowCard index="01" title="选题" desc="GitHub 热门项目输入" icon={Github} />
          <FlowCard index="02" title="文案" desc="LLM 生成分段口播" icon={Braces} />
          <FlowCard index="03" title="配音/分镜" desc="固定音色 + timeline" icon={Scissors} />
          <FlowCard index="04" title="导出" desc="final.mp4 可发布" icon={Film} />
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
          <PanelTitle icon={Code2} title="Tech Stack" right="local MVP" />
          <div className="mt-4 grid grid-cols-6 gap-3">
            {["Next.js", "Node.js", "Remotion", "FishSpeech", "FFmpeg", "LLM"].map((tech) => (
              <div key={tech} className="rounded-2xl border border-white/10 bg-black/25 p-4 text-center font-semibold">
                {tech}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
        <PanelTitle icon={CircleDot} title="System Health" right="all green" />
        <div className="mt-4 space-y-3">
          <HealthRow label="LLM script sections verified" ok />
          <HealthRow label="FishSpeech voice fixed" ok />
          <HealthRow label="timeline sync passed" ok />
          <HealthRow label="final.mp4 export ready" ok />
          <HealthRow label="assets downloadable" ok />
        </div>
      </div>
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] border border-white/10 bg-[#111214]/88 shadow-glass backdrop-blur ${className}`}>{children}</div>;
}

function PanelTitle({ icon: Icon, title, right }: { icon: LucideIcon; title: string; right?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-[#5DE2FF]" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {right ? <div className="text-xs text-[#8E95A3]">{right}</div> : null}
    </div>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#5DE2FF]/25 bg-[#5DE2FF]/10 px-3 py-1 text-xs font-medium text-[#5DE2FF]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#5DE2FF]" />
      {children}
    </span>
  );
}

function TopMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[104px] rounded-2xl border border-white/10 bg-black/24 px-4 py-3">
      <div className="text-xs text-[#8E95A3]">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function WorkflowItem({ active, done, label, sub }: { active?: boolean; done?: boolean; label: string; sub: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2 ${active ? "border-[#7C5CFF]/45 bg-[#7C5CFF]/14" : "border-white/8 bg-black/18"}`}>
      {done ? <CheckCircle2 className="h-4 w-4 text-[#5DE2FF]" /> : <Loader2 className="h-4 w-4 text-[#7C5CFF]" />}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{label}</div>
        <div className="truncate text-xs text-[#8E95A3]">{sub}</div>
      </div>
      <ChevronRight className="h-4 w-4 text-[#606777]" />
    </div>
  );
}

function QueueItem({ label, status, progress }: { label: string; status: string; progress: number }) {
  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-black/18 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono">{label}</span>
        <span className="text-[#8E95A3]">{status}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-[#7C5CFF]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function BigMetric({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#8E95A3]">{label}</div>
        <Icon className="h-5 w-5 text-[#5DE2FF]" />
      </div>
      <div className="mt-8 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ScriptEditor({ compact = false }: { compact?: boolean }) {
  const scenes = useRuntimeScenes();
  const blocks = scenes.slice(0, compact ? 3 : 5);
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
      <PanelTitle icon={FileText} title="Script Editor" right="sections.json" />
      <div className="mt-4 space-y-3">
        {blocks.map((scene) => (
          <div key={scene.rank} className="rounded-2xl border border-white/8 bg-[#0B0C0E] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-black">#{scene.rank}</span>
              <span className="font-semibold">{scene.title}</span>
            </div>
            <p className="text-sm leading-relaxed text-[#C9CED8]">
              第{["一", "二", "三", "四", "五", "六", "七", "八"][scene.rank - 1]}，{scene.title}。{scene.summary}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SceneBoard({ compact = false }: { compact?: boolean }) {
  const scenes = useRuntimeScenes();
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
      <PanelTitle icon={Layers3} title="Scene Board" right="8 slides" />
      <div className="mt-4 grid grid-cols-2 gap-3">
        {scenes.slice(0, compact ? 4 : 8).map((scene) => (
          <div key={scene.rank} className="rounded-2xl border border-white/8 bg-[#0B0C0E] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-black">#{scene.rank}</span>
              <span className="text-[10px] uppercase tracking-[0.16em] text-[#8E95A3]">scene</span>
            </div>
            <div className="truncate font-semibold">{scene.title}</div>
            <div className="mt-2 truncate text-xs text-[#8E95A3]">{scene.summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaveformPanel({ large = false }: { large?: boolean }) {
  const runtime = useRuntime();
  const peaks = runtime?.waveform.peaks?.length ? runtime.waveform.peaks : null;
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
      <PanelTitle icon={AudioLines} title="Voice Waveform" right="voice.wav" />
      <div className={`mt-5 flex items-center gap-1 ${large ? "h-[290px]" : "h-[190px]"}`}>
        {(peaks ?? Array.from({ length: 82 }, (_, index) => 0.18 + ((index * 17) % 86) / 100)).map((peak, index) => (
          <div
            key={index}
            className="w-1.5 rounded-full bg-gradient-to-t from-[#7C5CFF] to-[#5DE2FF]"
            style={{ height: `${Math.max(8, Math.round(peak * 100))}%`, opacity: 0.45 + Math.min(0.45, peak / 2) }}
          />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3 text-xs text-[#8E95A3]">
        <span>00:00</span>
        <span>00:10</span>
        <span>00:20</span>
        <span>00:33</span>
      </div>
    </div>
  );
}

function ProviderPanel() {
  const runtime = useRuntime();
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-4">
      <PanelTitle icon={Server} title="Providers" right="local" />
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <Provider label="LLM" value={String(runtime?.provider.llm || "openai-compatible")} />
        <Provider label="TTS" value={String(runtime?.provider.tts || "FishSpeech")} />
        <Provider label="Render" value={String(runtime?.provider.renderMode || "Remotion")} />
        <Provider label="Mux" value="FFmpeg" />
      </div>
    </div>
  );
}

function Provider({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/24 px-3 py-2">
      <div className="text-[#8E95A3]">{label}</div>
      <div className="mt-1 truncate font-mono text-[#DDE0E7]">{value}</div>
    </div>
  );
}

function ConfigCard({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
      <Icon className="mb-5 h-5 w-5 text-[#5DE2FF]" />
      <div className="text-sm text-[#8E95A3]">{label}</div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
    </div>
  );
}

function CompactScene({ scene }: { scene: RuntimeScene }) {
  return (
    <div className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-xs font-black text-black">#{scene.rank}</span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{scene.title}</div>
        <div className="truncate text-xs text-[#8E95A3]">{scene.tag}</div>
      </div>
      <div className="text-xs text-[#5DE2FF]">{scene.growth}</div>
    </div>
  );
}

function SceneScriptList() {
  const scenes = useRuntimeScenes();
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-4">
      <PanelTitle icon={FileText} title="Sections" right="8" />
      <div className="mt-3 space-y-2">
        {scenes.map((scene) => (
          <div key={scene.rank} className={`rounded-2xl border px-3 py-2 ${scene.rank === 3 ? "border-[#7C5CFF]/45 bg-[#7C5CFF]/14" : "border-white/8 bg-black/18"}`}>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8E95A3]">#{scene.rank}</span>
              <span className="truncate text-sm font-semibold">{scene.title}</span>
            </div>
            <div className="mt-1 text-xs text-[#8E95A3]">{scene.duration}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Suggestion({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-[#5DE2FF]" />
        {title}
      </div>
      <p className="text-sm leading-relaxed text-[#AEB4C0]">{text}</p>
    </div>
  );
}

function TtsCard({ scene }: { scene: RuntimeScene }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[#0B0C0E] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-[#8E95A3]">scene-{scene.rank - 1}.wav</span>
        <CheckCircle2 className="h-4 w-4 text-[#5DE2FF]" />
      </div>
      <div className="mt-4 text-lg font-semibold">#{scene.rank} {scene.title}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div className="h-full rounded-full bg-[#7C5CFF]" style={{ width: `${62 + scene.rank * 4}%` }} />
      </div>
      <div className="mt-3 text-xs text-[#8E95A3]">duration {scene.duration}</div>
    </div>
  );
}

function ConfigLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-3">
      <div className="font-mono text-xs text-[#8E95A3]">{label}</div>
      <div className="mt-1 truncate font-mono text-sm text-[#DDE0E7]">{value}</div>
    </div>
  );
}

function SubtitleTrack() {
  const runtime = useRuntime();
  const subtitles = runtime?.subtitles.slice(0, 4) ?? [];
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-4">
      <PanelTitle icon={Subtitles} title="Subtitle Preview" right="sentence blocks" />
      <div className="mt-4 grid grid-cols-4 gap-3">
        {(subtitles.length ? subtitles : ["这周 GitHub 上的 AI 项目又刷屏了", "Claude Code 正在改变开发工作流", "FastMCP 让工具接入大模型", "收藏起来，下期继续看"]).map((item, index) => (
          <div key={typeof item === "string" ? item : item.index} className="rounded-2xl border border-white/8 bg-black/25 p-3">
            <div className="mb-2 text-xs text-[#8E95A3]">{typeof item === "string" ? `00:${String(index * 5 + 3).padStart(2, "0")}` : formatMs(item.start_ms)}</div>
            <div className="text-sm leading-relaxed">{typeof item === "string" ? item : item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FileAsset({ file }: { file: RuntimeFile }) {
  const Icon = file.icon;
  return (
    <div className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl border border-white/8 bg-black/24 p-3">
      <div className="rounded-xl bg-white/8 p-3">
        <Icon className="h-4 w-4 text-[#5DE2FF]" />
      </div>
      <div className="min-w-0">
        <div className="truncate font-mono text-sm font-semibold">{file.name}</div>
        <div className="truncate text-xs text-[#8E95A3]">{file.detail}</div>
      </div>
      <span className="rounded-full border border-[#5DE2FF]/25 bg-[#5DE2FF]/10 px-2 py-1 text-[10px] text-[#5DE2FF]">passed</span>
    </div>
  );
}

function PhonePreview() {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-[28px] border border-white/10 bg-black p-3">
      <div className="mb-3 h-1.5 rounded-full bg-white/10" />
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_50%_18%,rgba(124,92,255,0.34),transparent_14rem),#0D0E11] p-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-[#8E95A3]">
          <span>GitHub Weekly</span>
          <span>TOP8</span>
        </div>
        <div className="mt-auto">
          <span className="rounded-xl bg-white px-3 py-1 text-sm font-black text-black">#3</span>
          <div className="mt-4 text-3xl font-semibold">FastMCP</div>
          <p className="mt-3 text-sm leading-relaxed text-[#C9CED8]">MCP 正在成为 AI 工具生态的标准接口。</p>
          <div className="mt-5 rounded-2xl bg-black/45 p-3 text-center text-xs">字幕同步显示中</div>
        </div>
      </div>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/24 p-3">
      <div className="text-xs text-[#8E95A3]">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

function FileRow({ file }: { file: RuntimeFile }) {
  const Icon = file.icon;
  return (
    <div className="grid grid-cols-[22px_1fr] items-center gap-2 rounded-xl bg-black/24 px-2 py-2">
      <Icon className="h-4 w-4 text-[#5DE2FF]" />
      <div className="truncate font-mono text-xs">{file.name}</div>
    </div>
  );
}

function Timeline({ shot }: { shot: Shot }) {
  return (
    <div className="h-full">
      <PanelTitle icon={Activity} title="Timeline" right={shot === "scenes" ? "subtitle + voice + visual tracks" : "30 fps / integer frames"} />
      <div className="mt-4 grid grid-rows-3 gap-3">
        <Track label="visual" color="#7C5CFF" widths={[14, 12, 13, 12, 13, 11, 13, 12]} />
        <Track label="voice" color="#5DE2FF" widths={[13, 12, 12, 11, 12, 11, 12, 10]} gaps />
        <Track label="subtitle" color="#FFFFFF" widths={[10, 9, 11, 9, 10, 8, 10, 9]} />
      </div>
    </div>
  );
}

function Track({ label, color, widths, gaps = false }: { label: string; color: string; widths: number[]; gaps?: boolean }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-3">
      <div className="font-mono text-xs text-[#8E95A3]">{label}</div>
      <div className="flex h-10 items-center gap-1 rounded-2xl border border-white/8 bg-black/22 p-1">
        {widths.map((width, index) => (
          <div key={`${label}-${index}`} className="h-full rounded-xl" style={{ width: `${width}%`, backgroundColor: color, opacity: label === "subtitle" ? 0.48 : 0.82 }} />
        ))}
        {gaps ? <div className="h-full w-[3%] rounded-xl bg-white/10" /> : null}
      </div>
    </div>
  );
}

function LogLine({ tag, text }: { tag: string; text: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2 rounded-xl bg-black/22 px-3 py-2">
      <span className="text-[#5DE2FF]">[{tag}]</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function HealthRow({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-2">
      <span className="text-[#C9CED8]">{label}</span>
      {ok ? <CheckCircle2 className="h-4 w-4 text-[#5DE2FF]" /> : <Loader2 className="h-4 w-4 text-[#7C5CFF]" />}
    </div>
  );
}

function FlowCard({ index, title, desc, icon: Icon }: { index: string; title: string; desc: string; icon: LucideIcon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/24 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#8E95A3]">{index}</span>
        <Icon className="h-5 w-5 text-[#5DE2FF]" />
      </div>
      <div className="mt-24 text-3xl font-semibold">{title}</div>
      <p className="mt-3 text-base leading-relaxed text-[#AEB4C0]">{desc}</p>
    </div>
  );
}
