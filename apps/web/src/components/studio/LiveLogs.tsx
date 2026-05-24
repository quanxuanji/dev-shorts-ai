import type { RefObject } from "react";
import { Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

import type { RuntimeLine } from "./studio-types";

const stageLogFilters: Record<string, { label: string; keywords: string[] }> = {
  topic: { label: "Topic / Reference", keywords: ["studio", "history", "reference", "source", "input", "video", "asr", "transcript"] },
  script: { label: "LLM Script", keywords: ["llm", "script", "rewrite", "section", "scene_plan", "speech_segments"] },
  tts: { label: "FishSpeech TTS", keywords: ["tts", "fish", "voice", "audio", "wav", "scene-"] },
  subtitle: { label: "Subtitle", keywords: ["subtitle", "srt", "caption", "sentence"] },
  render: { label: "Render / Timeline", keywords: ["render", "remotion", "timeline", "sync", "frame"] },
  export: { label: "Export", keywords: ["export", "ffmpeg", "final", "mp4", "artifact"] }
};

export function LiveLogs({
  lines,
  consoleRef,
  compact = false,
  focusStage
}: {
  lines: RuntimeLine[];
  consoleRef: RefObject<HTMLDivElement>;
  compact?: boolean;
  focusStage?: string;
}) {
  const focus = focusStage ? stageLogFilters[focusStage] : null;
  const focusedLines = focus ? lines.filter((line) => matchesFocus(line, focus.keywords)) : lines;
  const visibleLines = focus && focusedLines.length ? focusedLines : lines;
  const statusLabel = focus ? (focusedLines.length ? focus.label : `${focus.label} / all logs`) : "真实任务日志";

  return (
    <section className="studio-panel-tertiary h-full rounded-[24px] border p-4 min-[2200px]:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Terminal className="h-4 w-4 text-[#5DE2FF]" />
          {compact ? "Render Logs" : "Live Logs"}
        </h2>
        <span className="truncate text-xs text-[#777D89]">{statusLabel}</span>
      </div>
      <div ref={compact ? undefined : consoleRef} className={cn("overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#050506]/50 p-3 font-mono text-xs shadow-[inset_0_0_30px_rgba(124,92,255,0.035)] min-[2200px]:p-4", compact ? "h-[92px] 2xl:h-[108px] min-[2200px]:h-32" : "h-44 min-[2200px]:h-56")}>
        {visibleLines.length ? (
          visibleLines.map((line) => (
            <div key={line.id} className="mb-2 grid grid-cols-[82px_1fr] gap-3">
              <span className={cn("uppercase", line.level === "success" && "text-emerald-300", line.level === "warn" && "text-amber-300", line.level === "info" && "text-[#5DE2FF]")}>[{line.source}]</span>
              <span className={cn("text-[#9EA3AE]", compact ? "truncate" : "whitespace-pre-wrap break-words")}>{line.message}</span>
            </div>
          ))
        ) : (
          <div className="text-[#777D89]">Waiting for backend logs.</div>
        )}
      </div>
    </section>
  );
}

function matchesFocus(line: RuntimeLine, keywords: string[]) {
  const text = `${line.source} ${line.message}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}
