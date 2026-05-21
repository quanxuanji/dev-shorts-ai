"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Clapperboard, Cpu, Database, Gauge, RadioTower, Zap } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { StatusLight } from "@/components/status-light";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getModelStatus, getRecentTasks, getSystemStatus } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ModelStatus, SystemStatus, Task, WorkflowStep } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MetricPoint {
  time: string;
  gpu: number;
  vram: number;
  cpu: number;
  ram: number;
  latency: number;
  queue: number;
}

const fallbackSystem: SystemStatus = {
  cpu_percent: 38,
  ram_percent: 61,
  gpu_percent: 44,
  gpu_memory_percent: 57,
  inference_latency_ms: 188,
  tokens_per_second: 126,
  active_models: 5,
  queue_depth: 0,
  active_tasks: 0,
  uptime: "00:00:00"
};

const initialModels: ModelStatus[] = [
  { name: "Whisper ASR", kind: "ASR", state: "mock", latency_ms: 126, provider: "MockASR", note: "faster-whisper reserved", tokens_per_second: 38, queue: 1, gpu_percent: 18 },
  { name: "Qwen LLM", kind: "LLM", state: "mock", latency_ms: 194, provider: "MockProvider", note: "DeepSeek/GLM ready", tokens_per_second: 132, queue: 3, gpu_percent: 64 },
  { name: "FishSpeech TTS", kind: "TTS", state: "mock", latency_ms: 248, provider: "MockTTS", note: "MiniMax reserved", tokens_per_second: 28, queue: 2, gpu_percent: 36 },
  { name: "LatentSync", kind: "Digital Human", state: "standby", latency_ms: 420, provider: "Placeholder", note: "Wav2Lip reserved", tokens_per_second: 0, queue: 1, gpu_percent: 42 },
  { name: "FFmpeg Renderer", kind: "Render", state: "mock", latency_ms: 156, provider: "MockRender", note: "ffmpeg adapter reserved", tokens_per_second: 0, queue: 1, gpu_percent: 18 }
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function jitter(base: number, spread: number, min = 0, max = 100) {
  return clamp(Math.round(base + (Math.random() - 0.5) * spread), min, max);
}

function makePoint(system: SystemStatus): MetricPoint {
  return {
    time: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
    gpu: jitter(system.gpu_percent, 16, 20, 94),
    vram: jitter(system.gpu_memory_percent, 12, 32, 92),
    cpu: jitter(system.cpu_percent, 14, 18, 86),
    ram: jitter(system.ram_percent, 10, 34, 88),
    latency: jitter(system.inference_latency_ms ?? 180, 80, 80, 520),
    queue: jitter(system.queue_depth + 2, 3, 0, 10)
  };
}

function getTaskProgress(task: Task) {
  if (typeof task.progress === "number") return task.progress;
  const total = task.steps.reduce((sum, step) => sum + step.progress, 0);
  return Math.round(total / Math.max(task.steps.length, 1));
}

function getCurrentStep(task: Task): WorkflowStep {
  return (
    task.steps.find((step) => step.status === "running") ??
    task.steps.find((step) => step.status === "pending") ??
    task.steps[task.steps.length - 1]
  );
}

function getDuration(task: Task) {
  const started = new Date(task.created_at).getTime();
  const ended = task.status === "success" ? new Date(task.updated_at).getTime() : Date.now();
  return `${Math.max(Math.round((ended - started) / 1000), 1)}s`;
}

function getTaskContext(task: Task) {
  return [task.topic, task.target_style, task.speaking_style].filter(Boolean).join(" / ");
}

function getReadyArtifact(task: Task) {
  const artifactKeys = ["finalVideo", "final_mp4_path", "final_video_path", "final_mp4", "render_url", "video_path", "subtitles"];
  return artifactKeys
    .map((key) => task.artifacts[key])
    .find((value): value is string => typeof value === "string" && value.length > 0);
}

export function DashboardView() {
  const { t } = useI18n();
  const [system, setSystem] = useState<SystemStatus>(fallbackSystem);
  const [models, setModels] = useState<ModelStatus[]>(initialModels);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [series, setSeries] = useState<MetricPoint[]>(() =>
    Array.from({ length: 14 }, () => makePoint(fallbackSystem))
  );

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const [systemStatus, modelStatus, recentTasks] = await Promise.all([
          getSystemStatus(),
          getModelStatus(),
          getRecentTasks()
        ]);
        if (!isMounted) return;
        setSystem(systemStatus);
        setModels(modelStatus);
        setTasks(recentTasks);
        setSeries((current) => [...current.slice(-19), makePoint(systemStatus)]);
      } catch {
        if (isMounted) setSeries((current) => [...current.slice(-19), makePoint(system)]);
      }
    }

    void load();
    const timer = window.setInterval(load, 2000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [system]);

  const topStats = useMemo(
    () => [
      { label: t.dashboard.aiStudio, value: t.dashboard.online, tone: "text-emerald-200", icon: RadioTower },
      { label: t.dashboard.runningTasks, value: String(system.active_tasks), tone: "text-cyan-200", icon: Activity },
      { label: t.dashboard.gpuUsage, value: `${system.gpu_percent}%`, tone: "text-violet-200", icon: Cpu },
      { label: t.dashboard.tokenRate, value: String(system.tokens_per_second ?? 0), tone: "text-cyan-200", icon: Zap },
      { label: t.dashboard.activeModels, value: String(system.active_models ?? models.length), tone: "text-emerald-200", icon: Database }
    ],
    [models.length, system, t]
  );

  return (
    <AppShell active="/">
      <div className="space-y-5">
        <header className="overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-950/55 p-5 shadow-violet backdrop-blur-xl">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-200">{t.dashboard.eyebrow}</div>
              <h1 className="mt-3 bg-gradient-to-r from-slate-50 via-cyan-100 to-violet-200 bg-clip-text text-3xl font-bold text-transparent md:text-5xl">
                {t.dashboard.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{t.dashboard.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
              {topStats.slice(0, 3).map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-md border border-white/10 bg-white/[0.04] p-3 shadow-glow">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                      <Icon className="h-3.5 w-3.5" /> {stat.label}
                    </div>
                    <div className={cn("mt-2 font-mono text-2xl", stat.tone)}>{stat.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        <div className="grid gap-3 md:grid-cols-5">
          {topStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="group rounded-lg border border-white/10 bg-slate-950/50 p-4 backdrop-blur-xl transition hover:border-cyan-300/35 hover:shadow-glow">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-[0.16em] text-slate-500">{stat.label}</span>
                  <Icon className="h-4 w-4 text-slate-500 group-hover:text-cyan-200" />
                </div>
                <div className={cn("mt-3 font-mono text-2xl", stat.tone)}>{stat.value}</div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="overflow-hidden border-cyan-300/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gauge className="h-4 w-4 text-cyan-200" /> {t.dashboard.monitor}</CardTitle>
              <span className="font-mono text-xs text-slate-500">{t.dashboard.refresh} · uptime {system.uptime}</span>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="gpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.55} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="ram" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="time" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                    <Tooltip
                      contentStyle={{ background: "#050914", border: "1px solid rgba(34,211,238,0.22)", borderRadius: 8, color: "#e2e8f0" }}
                      labelStyle={{ color: "#67e8f9" }}
                    />
                    <Area type="monotone" dataKey="gpu" stroke="#a78bfa" strokeWidth={2} fill="url(#gpu)" isAnimationActive animationDuration={700} />
                    <Area type="monotone" dataKey="vram" stroke="#818cf8" strokeWidth={2} fill="transparent" isAnimationActive animationDuration={700} />
                    <Area type="monotone" dataKey="cpu" stroke="#22d3ee" strokeWidth={2} fill="url(#cpu)" isAnimationActive animationDuration={700} />
                    <Area type="monotone" dataKey="ram" stroke="#34d399" strokeWidth={2} fill="url(#ram)" isAnimationActive animationDuration={700} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {[
                  [t.dashboard.vram, `${system.gpu_memory_percent}%`],
                  [t.dashboard.latency, `${system.inference_latency_ms}ms`],
                  [t.dashboard.queue, String(system.queue_depth)]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-white/10 bg-slate-950/60 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
                    <div className="mt-2 font-mono text-xl text-cyan-100">{value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RadioTower className="h-4 w-4 text-violet-200" /> {t.dashboard.modelMesh}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {models.map((model) => (
                <div key={model.name} className="group relative overflow-hidden rounded-md border border-white/10 bg-slate-950/55 p-4 transition hover:border-violet-300/35 hover:shadow-violet">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/80 to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusLight status={model.state} className={model.state !== "offline" ? "animate-pulse" : ""} />
                        <span className="font-semibold text-slate-100">{model.name}</span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{model.provider} · {model.note}</div>
                    </div>
                    <span className="rounded bg-emerald-300/10 px-2 py-1 font-mono text-xs text-emerald-200">{t.dashboard.running}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                    <Metric label="tok/s" value={String(model.tokens_per_second ?? 0)} />
                    <Metric label="queue" value={String(model.queue ?? 0)} />
                    <Metric label="latency" value={`${model.latency_ms}ms`} />
                    <Metric label="gpu" value={`${model.gpu_percent ?? 0}%`} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-200" /> {t.dashboard.recentJobs}</CardTitle>
            <span className="flex items-center gap-2 font-mono text-xs text-slate-500"><Database className="h-3 w-3" /> {t.dashboard.memoryStore}</span>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border border-white/10">
              {tasks.map((task) => {
                const step = getCurrentStep(task);
                const progress = getTaskProgress(task);
                const context = getTaskContext(task);
                const readyArtifact = getReadyArtifact(task);
                return (
                  <div key={task.id} className="grid gap-3 border-b border-white/10 bg-slate-950/35 p-4 last:border-b-0 lg:grid-cols-[1fr_180px_140px_120px_90px] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-slate-100">{task.title}</div>
                        <span
                          className={cn(
                            "rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]",
                            task.mode === "semi_real"
                              ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
                              : "border-violet-300/25 bg-violet-300/10 text-violet-200"
                          )}
                        >
                          {task.mode === "semi_real" ? t.dashboard.semiReal : t.dashboard.mock}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-500">{task.source_url || task.local_file_path || t.dashboard.sourcePending}</div>
                      {context ? <div className="mt-1 truncate text-xs text-slate-400">{context}</div> : null}
                    </div>
                    <div className="text-sm text-slate-300">{step?.label ?? t.dashboard.completed}</div>
                    <div>
                      <div className="flex items-center justify-between font-mono text-xs text-cyan-200">
                        <span>{t.dashboard.progress}</span><span>{progress}%</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm"><StatusLight status={task.status} /> {task.status}</div>
                      {readyArtifact ? (
                        <div className="mt-1 flex items-center gap-1 truncate font-mono text-[10px] text-emerald-200">
                          <Clapperboard className="h-3 w-3 shrink-0" />
                          {readyArtifact}
                        </div>
                      ) : null}
                    </div>
                    <div className="font-mono text-xs text-slate-500">{getDuration(task)}</div>
                  </div>
                );
              })}
              {!tasks.length ? <div className="p-6 text-sm text-slate-500">{t.dashboard.noTasks}</div> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-2">
      <div className="uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-slate-100">{value}</div>
    </div>
  );
}
