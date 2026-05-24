import { Captions } from "lucide-react";

import type { StudioSubtitle } from "@/lib/types";

import type { StudioSceneView } from "./studio-types";
import { formatMs } from "./studio-utils";

export function SubtitleInspector({
  subtitles,
  selectedScene
}: {
  subtitles: StudioSubtitle[];
  selectedScene?: StudioSceneView;
}) {
  const speechStart = selectedScene?.speechStartMs ?? selectedScene?.visualStartMs ?? 0;
  const speechEnd = selectedScene?.speechEndMs ?? (selectedScene?.audioDurationMs != null ? speechStart + selectedScene.audioDurationMs : speechStart + 1000);
  const sceneSubtitles = selectedScene ? subtitles.filter((subtitle) => subtitle.start_ms < speechEnd && subtitle.end_ms > speechStart) : [];

  return (
    <section className="studio-panel-secondary rounded-[24px] border p-4 min-[2200px]:rounded-[28px] min-[2200px]:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Captions className="h-4 w-4 text-[#5DE2FF]" />
          Subtitle Inspector
        </h2>
        <span className="text-xs text-[#777D89]">
          {selectedScene ? `scene #${selectedScene.rank}` : "waiting"}
        </span>
      </div>
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        <Info label="speech window" value={selectedScene ? `${formatMs(speechStart)} - ${formatMs(speechEnd)}` : "pending"} />
        <Info label="subtitle blocks" value={sceneSubtitles.length ? String(sceneSubtitles.length) : "pending"} />
        <Info label="alignment" value={sceneSubtitles.length ? "overlap matched" : "waiting"} />
      </div>
      <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 min-[2200px]:max-h-[320px]">
        {sceneSubtitles.length ? (
          sceneSubtitles.map((subtitle) => (
            <div key={subtitle.index} className="rounded-2xl border border-white/[0.08] bg-[#0B0B0C]/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="rounded-lg bg-white/[0.08] px-2 py-1 font-mono text-[10px] text-[#D6D8DE]">#{subtitle.index}</span>
                <span className="font-mono text-[10px] text-[#777D89]">
                  {formatMs(subtitle.start_ms)} - {formatMs(subtitle.end_ms)}
                </span>
              </div>
              <div className="text-sm leading-6 text-[#F5F5F7]">{subtitle.text}</div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0B0B0C]/45 p-4 text-sm text-[#777D89]">
            {selectedScene ? "This scene has no matched subtitle block yet." : "Select a scene to inspect subtitle timing."}
          </div>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0B0B0C]/45 p-3">
      <div className="text-xs text-[#777D89]">{label}</div>
      <div className="mt-1 truncate font-mono text-xs font-semibold text-[#F5F5F7]">{value}</div>
    </div>
  );
}

