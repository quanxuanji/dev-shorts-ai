import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";

import type { StudioRuntimeData } from "@/lib/types";

import { timelineIsAvailable } from "./studio-utils";

export function TimelineSyncPanel({ runtime }: { runtime: StudioRuntimeData | null }) {
  const ready = timelineIsAvailable(runtime);
  const scenes = runtime?.scenes ?? [];
  const subtitles = runtime?.subtitles ?? [];
  const visualLeadOk = ready && scenes.every((scene) => typeof scene.visual_start_ms !== "number" || typeof scene.speech_start_ms !== "number" || scene.visual_start_ms <= scene.speech_start_ms);
  const silenceGaps = scenes.slice(0, -1).map((scene) =>
    typeof scene.silence_start_ms === "number" && typeof scene.silence_end_ms === "number" ? scene.silence_end_ms - scene.silence_start_ms : null
  );
  const silenceOk = ready && silenceGaps.length > 0 && silenceGaps.every((gap) => typeof gap === "number" && gap >= 400 && gap <= 800);
  const subtitleOk = ready && subtitles.length > 0 && subtitles.every((subtitle) => typeof subtitle.start_ms === "number" && typeof subtitle.end_ms === "number" && subtitle.end_ms > subtitle.start_ms);
  const checks = [
    { label: "visualStartMs <= speechStartMs", ok: visualLeadOk },
    { label: "0.5s silence between scenes", ok: silenceOk },
    { label: "subtitle blocks aligned", ok: subtitleOk }
  ];
  const passedCount = checks.filter((check) => check.ok).length;
  const status = ready ? (passedCount === checks.length ? "passed" : `${passedCount}/${checks.length} passed`) : "pending";

  return (
    <section className="studio-panel-tertiary h-full rounded-[24px] border p-4 min-[2200px]:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#F5F5F7]">Timeline Sync</h2>
        <span className="text-xs text-[#777D89]">{status}</span>
      </div>
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between rounded-full border border-white/[0.14] bg-[#0B0B0C]/60 px-3 py-1.5 text-xs text-[#D6D8DE] min-[2200px]:px-4 min-[2200px]:py-2 min-[2200px]:text-sm">
            {check.label}
            {!ready ? <Clock3 className="h-4 w-4 text-[#777D89]" /> : check.ok ? <CheckCircle2 className="h-4 w-4 text-[#5DE2FF]" /> : <AlertCircle className="h-4 w-4 text-amber-300" />}
          </div>
        ))}
      </div>
    </section>
  );
}
