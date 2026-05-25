import { Activity, Database, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

import type { StudioLayoutProps } from "./studio-types";
import { deriveProgress, runtimeStatusLabel, taskTitle } from "./studio-utils";

export function StudioStatusBar({ props }: { props: StudioLayoutProps }) {
  const progress = deriveProgress(props.task, props.artifacts, props.studioRuntime);
  const status = props.isScriptGenerating ? "generating script" : runtimeStatusLabel(props.task, props.studioRuntime, props.isCreating, props.createError);
  const title = taskTitle(props.task, props.studioRuntime, props.form.topic);
  const hasScript = Boolean(props.artifacts.script.value || props.studioRuntime?.scenes.length);
  const hasVoice = props.artifacts.audio.kind === "real" || Boolean(props.studioRuntime?.assets.some((asset) => asset.name === "voice.wav" && asset.exists));
  const hasSubtitle = Boolean(props.studioRuntime?.assets.some((asset) => asset.name === "subtitles.srt" && asset.exists));
  const hasVideo = props.artifacts.video.kind === "real" || Boolean(props.studioRuntime?.assets.some((asset) => asset.name === "final.mp4" && asset.exists));

  return (
    <header className="studio-panel-secondary grid shrink-0 gap-3 rounded-[24px] border p-3 backdrop-blur-2xl min-[2200px]:rounded-[28px] min-[2200px]:p-4 xl:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="truncate text-xl font-semibold tracking-[-0.03em] text-[#F5F5F7] min-[2200px]:text-2xl">DevShorts AI Studio</h1>
          <span className="rounded-full border border-[#5DE2FF]/25 bg-[#5DE2FF]/10 px-3 py-1 text-xs text-[#9AF3FF]">{status}</span>
        </div>
        <div className="mt-2 truncate text-sm text-[#9EA3AE]">{title}</div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="studio-progress-glow h-full rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#5DE2FF] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metric label="progress" value={`${progress}%`} />
        <StatusChip label="script" ready={hasScript} />
        <StatusChip label="voice" ready={hasVoice} />
        <StatusChip label="subtitle" ready={Boolean(hasSubtitle)} />
        <StatusChip label="export" ready={hasVideo} />
      </div>

      <div className="xl:col-span-2 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-[#9EA3AE]">
          <Database className="h-4 w-4 text-[#5DE2FF]" />
          <span className="font-mono">Runtime</span>
          <span className="truncate font-mono text-[#D6D8DE]">{props.task?.id ? `task ${props.task.id.slice(0, 8)}` : "local mode / waiting"}</span>
        </div>
        <button
          type="button"
          onClick={props.onRefreshRuntime}
          className="inline-flex h-8 items-center gap-2 rounded-full border border-[#23252B] bg-[#15171A] px-3 text-xs text-[#9EA3AE] transition hover:bg-white/[0.07] hover:text-[#F5F5F7]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          refresh runtime
        </button>
      </div>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="studio-hover-item rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/45 px-3 py-2">
      <div className="text-xs text-[#777D89]">{label}</div>
      <div className="mt-1 font-mono text-sm font-semibold text-[#F5F5F7]">{value}</div>
    </div>
  );
}

function StatusChip({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={cn("studio-hover-item rounded-2xl border px-3 py-2", ready ? "studio-active-item border-[#5DE2FF]/20 bg-[#5DE2FF]/8" : "border-white/[0.07] bg-[#0B0B0C]/45")}>
      <div className="flex items-center gap-2 text-xs text-[#777D89]">
        <Activity className={cn("h-3.5 w-3.5", ready ? "text-[#5DE2FF]" : "text-[#555B66]")} />
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold text-[#F5F5F7]">{ready ? "ready" : "pending"}</div>
    </div>
  );
}
