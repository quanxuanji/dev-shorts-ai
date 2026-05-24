"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Download, Film } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { StudioLayoutProps, StudioSceneView } from "./studio-types";
import { formatMs } from "./studio-utils";

export function RenderPreview({
  props,
  scenes,
  selectedSceneIndex,
  onSelectScene
}: {
  props: StudioLayoutProps;
  scenes: StudioSceneView[];
  selectedSceneIndex?: number;
  onSelectScene?: (sceneIndex: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canOpen = Boolean(props.videoUrl && !props.videoUrl.startsWith("mock://"));
  const selected = scenes.find((scene) => scene.sceneIndex === selectedSceneIndex) ?? scenes[2] ?? scenes[0];
  const subtitle = selected ? findSceneSubtitle(props.studioRuntime?.subtitles ?? [], selected) : null;
  const selectedListIndex = useMemo(() => scenes.findIndex((scene) => scene.sceneIndex === selected?.sceneIndex), [scenes, selected?.sceneIndex]);
  const seekSeconds = selected ? Math.max(0, ((selected.visualStartMs ?? selected.speechStartMs ?? 0) + 80) / 1000) : 0;

  useEffect(() => {
    if (!canOpen || !videoRef.current || !selected) return;
    try {
      videoRef.current.currentTime = seekSeconds;
      videoRef.current.pause();
    } catch {
      // Some browsers reject seeking before metadata is ready; onLoadedMetadata handles the same target.
    }
  }, [canOpen, seekSeconds, selected]);

  function seekToSelectedScene() {
    if (!videoRef.current || !selected) return;
    try {
      videoRef.current.currentTime = seekSeconds;
      videoRef.current.pause();
    } catch {
      // Ignore browser-level media seek errors.
    }
  }

  function stepScene(direction: -1 | 1) {
    if (!scenes.length || selectedListIndex < 0) return;
    const next = scenes[Math.min(scenes.length - 1, Math.max(0, selectedListIndex + direction))];
    if (next) onSelectScene?.(next.sceneIndex);
  }

  return (
    <section className="studio-panel-primary rounded-[24px] border p-4 min-[2200px]:rounded-[28px] min-[2200px]:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Film className="h-4 w-4 text-[#5DE2FF]" />
          Render Preview
        </h2>
        <span className="text-xs text-[#777D89]">{canOpen ? "final.mp4" : "waiting"}</span>
      </div>
      <div className="studio-preview-frame mx-auto max-w-[190px] overflow-hidden rounded-[30px] border border-white/[0.12] bg-[#020204] p-1.5 2xl:max-w-[210px] min-[2200px]:max-w-[250px] min-[2200px]:rounded-[32px] min-[2200px]:p-2">
        {canOpen ? (
          <video ref={videoRef} className="relative z-10 aspect-[9/16] w-full rounded-[22px] bg-black object-contain min-[2200px]:rounded-[24px]" controls src={props.videoUrl} onLoadedMetadata={seekToSelectedScene}>
            <track kind="captions" />
          </video>
        ) : (
          <div className="relative z-10 flex aspect-[9/16] flex-col justify-between rounded-[22px] bg-black p-5 shadow-[inset_0_0_44px_rgba(93,226,255,0.05)] min-[2200px]:rounded-[24px] min-[2200px]:p-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#777D89]">{selected?.tag ?? "AI VIDEO"}</div>
            <div>
              <span className="rounded-xl bg-[#F5F5F7] px-3 py-1.5 text-sm font-bold text-[#0B0B0C]">{selected ? `#${selected.rank}` : "AI"}</span>
              <div className="mt-5 text-3xl font-semibold leading-tight text-white">{selected?.title ?? "Your video will appear here"}</div>
              <p className="mt-4 text-sm leading-6 text-[#B8BCC6]">{selected?.summary ?? "提交任务后，这里会直接播放真实 final.mp4。"}</p>
            </div>
            <div className="text-center text-xs text-[#D6D8DE]">字幕同步显示中</div>
          </div>
        )}
      </div>
      <Button asChild variant="secondary" size="sm" className={cn("mt-3 h-8 w-full rounded-full border-[#5DE2FF]/20 bg-white/[0.06] text-[#D6D8DE] shadow-[0_0_24px_rgba(93,226,255,0.08)] hover:bg-white/[0.1]", !canOpen && "pointer-events-none opacity-45")}>
        <a href={canOpen ? props.videoUrl : "#"} download>
          <Download className="mr-2 h-4 w-4" />
          Download final.mp4
        </a>
      </Button>
      <div className="mt-2 grid grid-cols-[36px_1fr_36px] gap-2">
        <button
          type="button"
          onClick={() => stepScene(-1)}
          disabled={!onSelectScene || selectedListIndex <= 0}
          className="flex h-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#D6D8DE] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Previous scene"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={seekToSelectedScene}
          disabled={!canOpen || !selected}
          className="h-8 rounded-full border border-[#5DE2FF]/20 bg-[#5DE2FF]/8 px-3 text-xs font-medium text-[#D6D8DE] transition hover:bg-[#5DE2FF]/12 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Jump to selected scene
        </button>
        <button
          type="button"
          onClick={() => stepScene(1)}
          disabled={!onSelectScene || selectedListIndex < 0 || selectedListIndex >= scenes.length - 1}
          className="flex h-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#D6D8DE] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label="Next scene"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        <PreviewMeta label="current scene" value={selected ? `#${selected.rank} ${selected.title}` : "waiting"} />
        <div className="grid grid-cols-2 gap-2">
          <PreviewMeta label="from frame" value={selected?.fromFrame != null ? String(selected.fromFrame) : "pending"} />
          <PreviewMeta label="speech" value={selected ? `${formatMs(selected.speechStartMs)} - ${formatMs(selected.speechEndMs)}` : "pending"} />
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0B0B0C]/45 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-[#777D89]">subtitle</div>
            <div className="font-mono text-[10px] text-[#777D89]">
              {subtitle ? `${formatMs(subtitle.start_ms)} - ${formatMs(subtitle.end_ms)}` : "pending"}
            </div>
          </div>
          <div className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-[#F5F5F7]">{subtitle?.text ?? "Waiting for aligned subtitle block."}</div>
        </div>
      </div>
    </section>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0B0B0C]/45 px-3 py-2">
      <div className="text-xs text-[#777D89]">{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-semibold text-[#F5F5F7]">{value}</div>
    </div>
  );
}

function findSceneSubtitle(subtitles: NonNullable<StudioLayoutProps["studioRuntime"]>["subtitles"], scene: StudioSceneView) {
  if (!subtitles.length) return null;
  const speechStart = scene.speechStartMs ?? scene.visualStartMs ?? 0;
  const speechEnd = scene.speechEndMs ?? (scene.audioDurationMs != null ? speechStart + scene.audioDurationMs : speechStart + 1000);
  const overlapping = subtitles.find((subtitle) => subtitle.start_ms < speechEnd && subtitle.end_ms > speechStart);
  if (overlapping) return overlapping;
  return subtitles.reduce((closest, subtitle) => {
    if (!closest) return subtitle;
    return Math.abs(subtitle.start_ms - speechStart) < Math.abs(closest.start_ms - speechStart) ? subtitle : closest;
  }, null as (typeof subtitles)[number] | null);
}
