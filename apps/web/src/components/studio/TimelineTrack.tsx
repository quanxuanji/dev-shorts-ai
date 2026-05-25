import { Activity } from "lucide-react";

import type { StudioRuntimeData } from "@/lib/types";

import type { StudioSceneView } from "./studio-types";
import { formatMs, timelineIsAvailable } from "./studio-utils";

export function TimelineTrack({
  runtime,
  scenes,
  compact = false,
  selectedSceneIndex,
  onSelectScene
}: {
  runtime: StudioRuntimeData | null;
  scenes: StudioSceneView[];
  compact?: boolean;
  selectedSceneIndex?: number;
  onSelectScene?: (sceneIndex: number) => void;
}) {
  const available = timelineIsAvailable(runtime);
  const duration = Math.max(
    ...scenes.map((scene) => {
      const speechEnd = typeof scene.speechStartMs === "number" && typeof scene.audioDurationMs === "number" ? scene.speechStartMs + scene.audioDurationMs : 0;
      return Math.max(speechEnd, scene.visualEndMs ?? 0, scene.speechEndMs ?? 0);
    }),
    1
  );
  const selected = scenes.find((scene) => scene.sceneIndex === selectedSceneIndex);
  const currentStartMs = selected ? selected.visualStartMs ?? selected.speechStartMs ?? 0 : 0;
  const inspector = selected ? getSceneTiming(selected) : null;

  return (
    <section className={`studio-panel-secondary ${compact ? "h-full rounded-[22px] p-3" : "rounded-[28px] p-4 min-[2200px]:p-5"} border`}>
      <div className={`${compact ? "mb-3" : "mb-4 min-[2200px]:mb-5"} flex items-center justify-between`}>
        <h2 className="studio-section-title flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-[#5DE2FF]" />
          {compact ? "视频节奏" : "Timeline"}
        </h2>
        <span className="text-xs text-[#777D89]">{available ? (compact ? "已排好每段节奏" : "real timeline.json") : compact ? "等待生成" : "waiting for timeline"}</span>
      </div>
      <div className={compact ? "space-y-3" : "space-y-4"}>
        <Track id="visual" label={compact ? "画面" : "visual"} scenes={scenes} duration={duration} color="studio-track-visual" enabled={available} selectedSceneIndex={selectedSceneIndex} currentStartMs={currentStartMs} showLabels compact={compact} onSelectScene={onSelectScene} />
        <Track id="voice" label={compact ? "口播" : "voice"} scenes={scenes} duration={duration} color="studio-track-voice" enabled={available || scenes.length > 0} selectedSceneIndex={selectedSceneIndex} currentStartMs={currentStartMs} compact={compact} onSelectScene={onSelectScene} />
        <Track id="subtitle" label={compact ? "字幕" : "subtitle"} scenes={scenes} duration={duration} color="studio-track-subtitle" enabled={available && Boolean(runtime?.subtitles?.length)} selectedSceneIndex={selectedSceneIndex} currentStartMs={currentStartMs} compact={compact} onSelectScene={onSelectScene} />
      </div>
      {inspector && !compact ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-4">
          <TimingCard label="selected scene" value={`#${selected?.rank} ${selected?.title}`} tone="primary" />
          <TimingCard label="visual leads voice" value={inspector.leadLabel} tone={inspector.visualLeadMs >= 0 ? "ok" : "warn"} />
          <TimingCard label="speech duration" value={inspector.speechDurationLabel} />
          <TimingCard label="silence gap" value={inspector.silenceGapLabel} tone={inspector.silenceGapOk ? "ok" : "warn"} />
        </div>
      ) : null}
      {!available && !compact ? <div className="mt-3 text-xs text-[#777D89]">Timeline 会在生成后从真实 `timeline.json` 读取，不使用字数估算。</div> : null}
    </section>
  );
}

function Track({
  id,
  label,
  scenes,
  duration,
  color,
  enabled,
  selectedSceneIndex,
  currentStartMs,
  showLabels,
  compact,
  onSelectScene
}: {
  id: "visual" | "voice" | "subtitle";
  label: string;
  scenes: StudioSceneView[];
  duration: number;
  color: string;
  enabled: boolean;
  selectedSceneIndex?: number;
  currentStartMs: number;
  showLabels?: boolean;
  compact?: boolean;
  onSelectScene?: (sceneIndex: number) => void;
}) {
  const playheadLeft = Math.min(100, Math.max(0, (currentStartMs / duration) * 100));

  return (
    <div className={`${compact ? "grid-cols-[58px_1fr] gap-2" : "grid-cols-[64px_1fr] gap-3"} grid items-center`}>
      <div className="font-mono text-xs text-[#9EA3AE]">{label}</div>
      <div className={`studio-timeline-track relative overflow-hidden rounded-2xl border border-white/[0.16] bg-[#050506] ${compact ? "h-9 p-1" : "h-12 p-1.5"}`}>
        {enabled && scenes.length ? (
          <span
            className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-white/75 shadow-[0_0_14px_rgba(255,255,255,0.55),0_0_24px_rgba(93,226,255,0.35)]"
            style={{ left: `${playheadLeft}%` }}
          >
            <span className="absolute -top-0.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(93,226,255,0.75)]" />
          </span>
        ) : null}
        {enabled && scenes.length ? (
          scenes.map((scene) => {
            const start = trackStartMs(id, scene);
            const width = Math.max(compact ? 3 : 4, (trackDurationMs(id, scene) / duration) * 100);
            const left = Math.max(0, (start / duration) * 100);
            const timing = getSceneTiming(scene);
            return (
              <button
                key={`${label}-${scene.sceneIndex}`}
                type="button"
                onClick={() => onSelectScene?.(scene.sceneIndex)}
                className={`absolute overflow-hidden rounded-xl ${color} transition ${compact ? "top-1 h-7" : "top-1.5 h-9"} ${selectedSceneIndex === scene.sceneIndex ? "ring-2 ring-white/70" : "hover:ring-1 hover:ring-white/50 hover:brightness-110"}`}
                style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
                aria-label={`${label} scene ${scene.rank} ${scene.title}`}
                title={`${scene.title}
visual ${formatMs(scene.visualStartMs)} / speech ${formatMs(scene.speechStartMs)}
lead ${timing.leadLabel} / silence ${timing.silenceGapLabel}`}
              >
                {showLabels ? <span className={`${compact ? "leading-7" : "leading-9"} block truncate px-3 text-left font-mono text-[10px] font-semibold text-white/86`}>#{scene.rank}</span> : null}
              </button>
            );
          })
        ) : (
          <span className="absolute inset-y-1.5 left-1.5 w-1/4 rounded-xl bg-white/[0.12]" />
        )}
      </div>
    </div>
  );
}

function trackStartMs(label: string, scene: StudioSceneView) {
  if (label === "visual") return scene.visualStartMs ?? scene.speechStartMs ?? 0;
  return scene.speechStartMs ?? scene.visualStartMs ?? 0;
}

function trackDurationMs(label: string, scene: StudioSceneView) {
  const start = trackStartMs(label, scene);
  if (label === "visual" && typeof scene.visualEndMs === "number") return Math.max(120, scene.visualEndMs - start);
  if (typeof scene.speechEndMs === "number") return Math.max(120, scene.speechEndMs - start);
  return Math.max(120, scene.audioDurationMs ?? 900);
}

function getSceneTiming(scene: StudioSceneView) {
  const visualStart = scene.visualStartMs ?? 0;
  const speechStart = scene.speechStartMs ?? visualStart;
  const speechEnd = scene.speechEndMs ?? (scene.audioDurationMs != null ? speechStart + scene.audioDurationMs : speechStart);
  const visualLeadMs = speechStart - visualStart;
  const speechDurationMs = Math.max(0, speechEnd - speechStart);
  const silenceGapMs =
    typeof scene.silenceStartMs === "number" && typeof scene.silenceEndMs === "number" ? Math.max(0, scene.silenceEndMs - scene.silenceStartMs) : null;

  return {
    visualLeadMs,
    leadLabel: visualLeadMs >= 0 ? `画面提前 ${(visualLeadMs / 1000).toFixed(1)}s` : `画面晚了 ${(Math.abs(visualLeadMs) / 1000).toFixed(1)}s`,
    speechDurationLabel: `${(speechDurationMs / 1000).toFixed(1)}s`,
    silenceGapLabel: silenceGapMs == null ? "pending" : `${(silenceGapMs / 1000).toFixed(1)}s`,
    silenceGapOk: silenceGapMs == null || (silenceGapMs >= 400 && silenceGapMs <= 800)
  };
}

function TimingCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "primary" | "ok" | "warn" }) {
  const toneClass =
    tone === "primary"
      ? "border-[#7C5CFF]/25 bg-[#7C5CFF]/10"
      : tone === "ok"
        ? "border-[#5DE2FF]/25 bg-[#5DE2FF]/8"
        : tone === "warn"
          ? "border-amber-300/25 bg-amber-300/10"
          : "border-white/[0.08] bg-[#0B0B0C]/45";

  return (
    <div className={`rounded-2xl border px-3 py-2 ${toneClass}`}>
      <div className="text-xs text-[#777D89]">{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-semibold text-[#F5F5F7]">{value}</div>
    </div>
  );
}
