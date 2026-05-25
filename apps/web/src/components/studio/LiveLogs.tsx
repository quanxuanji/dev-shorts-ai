import type { RefObject } from "react";
import { Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

import type { RuntimeLine } from "./studio-types";

const stageLogFilters: Record<string, { label: string; keywords: string[] }> = {
  topic: { label: "选题和素材", keywords: ["studio", "history", "reference", "source", "input", "video", "asr", "transcript"] },
  script: { label: "生成口播稿", keywords: ["llm", "script", "rewrite", "section", "scene_plan", "speech_segments"] },
  tts: { label: "生成声音", keywords: ["tts", "fish", "voice", "audio", "wav", "scene-"] },
  subtitle: { label: "生成字幕", keywords: ["subtitle", "srt", "caption", "sentence"] },
  render: { label: "生成视频", keywords: ["render", "remotion", "timeline", "sync", "frame"] },
  export: { label: "导出文件", keywords: ["export", "ffmpeg", "final", "mp4", "artifact"] }
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
  const statusLabel = focus ? (focusedLines.length ? focus.label : `${focus.label} / 全部消息`) : "真实任务消息";

  return (
    <section className="studio-panel-tertiary h-full rounded-[24px] border p-4 min-[2200px]:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Terminal className="h-4 w-4 text-[#5DE2FF]" />
          {compact ? "当前动作" : "任务消息"}
        </h2>
        <span className="truncate text-xs text-[#777D89]">{statusLabel}</span>
      </div>
      <div ref={compact ? undefined : consoleRef} className={cn("overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#050506]/50 p-3 font-mono text-xs shadow-[inset_0_0_30px_rgba(124,92,255,0.035)] min-[2200px]:p-4", compact ? "h-[92px] 2xl:h-[108px] min-[2200px]:h-32" : "h-44 min-[2200px]:h-56")}>
        {visibleLines.length ? (
          visibleLines.map((line) => (
            <div key={line.id} className="mb-2 grid grid-cols-[82px_1fr] gap-3">
              <span className={cn("uppercase", line.level === "success" && "text-emerald-300", line.level === "warn" && "text-amber-300", line.level === "info" && "text-[#5DE2FF]")}>[{sourceLabel(line.source)}]</span>
              <span className={cn("text-[#9EA3AE]", compact ? "truncate" : "whitespace-pre-wrap break-words")}>{messageLabel(line.message)}</span>
            </div>
          ))
        ) : (
          <div className="text-[#777D89]">等待后端返回消息。</div>
        )}
      </div>
    </section>
  );
}

function matchesFocus(line: RuntimeLine, keywords: string[]) {
  const text = `${line.source} ${line.message}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword));
}

function sourceLabel(source: string) {
  const normalized = source.toLowerCase();
  if (normalized.includes("task")) return "任务";
  if (normalized.includes("history")) return "历史";
  if (normalized.includes("studio")) return "系统";
  if (normalized.includes("scheduler")) return "队列";
  if (normalized.includes("polling")) return "连接";
  if (normalized.includes("settings")) return "设置";
  return source;
}

function messageLabel(message: string) {
  if (message.includes("Ready for a new AI video")) return "准备创建新视频。";
  if (message.includes("Loaded completed video from")) return "已加载完成的视频预览。";
  if (message.includes("Generating narration and preparing media assets")) return "正在生成口播，并准备后续素材。";
  if (message.includes("Submitting current script for voice and video")) return "正在提交当前脚本，准备生成声音和视频。";
  if (message.includes("Source Reference started")) return "正在读取选题和参考素材。";
  if (message.includes("Source Reference completed")) return "选题和参考素材读取完成。";
  if (message.includes("Voiceover Script started")) return "开始生成口播稿。";
  if (message.includes("Voiceover Script completed")) return "口播稿生成完成。";
  if (message.includes("[LLM] requesting voiceover script")) return "正在请求模型生成口播稿。";
  if (message.includes("[LLM] building Remotion scene plan")) return "正在把口播拆成视频镜头。";
  if (message.includes("[Remotion] rendered final video")) return "Remotion 已生成 final.mp4。";
  if (message.includes("Final Video started")) return "开始合成最终视频。";
  if (message.includes("Final Video completed")) return "最终视频合成完成。";
  if (message.includes("Voice script, TTS artifact, and final video completed")) return "口播、声音和视频都已完成。";
  if (message.includes("Loaded ") && message.includes(" into preview")) return "已加载历史任务到预览。";
  return message;
}
