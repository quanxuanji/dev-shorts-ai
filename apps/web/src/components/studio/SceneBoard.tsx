import { MonitorPlay } from "lucide-react";

import type { StudioSceneView } from "./studio-types";

export function SceneBoard({
  scenes,
  selectedSceneIndex,
  onSelectScene
}: {
  scenes: StudioSceneView[];
  selectedSceneIndex?: number;
  onSelectScene?: (sceneIndex: number) => void;
}) {
  const selected = scenes.find((scene) => scene.sceneIndex === selectedSceneIndex) ?? scenes[2] ?? scenes[0];

  return (
    <section className="studio-panel-secondary grid gap-4 rounded-[24px] border p-4 min-[2200px]:gap-6 min-[2200px]:rounded-[28px] min-[2200px]:p-5 xl:grid-cols-[minmax(0,1fr)_300px] min-[2200px]:xl:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
            <MonitorPlay className="h-4 w-4 text-[#5DE2FF]" />
            Scene Board
          </h2>
          <span className="text-xs text-[#777D89]">{scenes.length ? `${scenes.length} slides` : "waiting"}</span>
        </div>
        <div className="grid max-h-[260px] gap-3 overflow-y-auto pr-1 min-[2200px]:max-h-[360px] min-[2200px]:gap-4 md:grid-cols-2">
          {scenes.length ? (
            scenes.map((scene) => (
              <button
                key={`${scene.sceneIndex}-${scene.title}`}
                type="button"
                onClick={() => onSelectScene?.(scene.sceneIndex)}
                className={`studio-hover-item min-h-24 rounded-2xl border border-white/[0.13] bg-[#0B0B0C]/48 p-3 text-left min-[2200px]:min-h-28 min-[2200px]:p-4 ${scene.sceneIndex === selected?.sceneIndex ? "studio-active-item" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-lg bg-[#F5F5F7] px-2 py-1 text-xs font-bold text-[#0B0B0C]">#{scene.rank}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#777D89]">scene</span>
                </div>
                <div className="mt-4 truncate text-base font-semibold text-[#F5F5F7]">{scene.title}</div>
                <div className="mt-2 line-clamp-2 text-xs leading-5 text-[#9EA3AE]">{scene.summary}</div>
              </button>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0B0B0C]/45 p-4 text-sm text-[#777D89]">Waiting for LLM script to create scenes.</div>
          )}
        </div>
      </div>
      <div className="studio-panel-secondary rounded-3xl border border-white/[0.1] p-4 min-[2200px]:p-5">
        {selected ? (
          <>
            <div className="flex items-center justify-between">
              <span className="rounded-xl bg-[#F5F5F7] px-3 py-2 text-sm font-bold text-[#0B0B0C]">#{selected.rank}</span>
              <span className="text-xs text-[#5DE2FF]">{selected.growth || selected.tag}</span>
            </div>
            <div className="mt-6 text-2xl font-semibold leading-tight tracking-[-0.03em] text-[#F5F5F7] min-[2200px]:mt-8 min-[2200px]:text-3xl">{selected.title}</div>
            <p className="mt-3 text-sm leading-6 text-[#D6D8DE] min-[2200px]:mt-4 min-[2200px]:text-base min-[2200px]:leading-7">{selected.summary}</p>
            <div className="mt-6 grid grid-cols-2 gap-3 min-[2200px]:mt-8">
              <Mini label="speech" value={selected.duration} />
              <Mini label="visual start" value={selected.start} />
            </div>
          </>
        ) : (
          <div className="text-sm text-[#777D89]">Selected scene will appear after script generation.</div>
        )}
      </div>
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.09] bg-[#0B0B0C]/55 p-3">
      <div className="text-xs text-[#777D89]">{label}</div>
      <div className="mt-2 font-mono text-sm font-semibold text-[#F5F5F7]">{value}</div>
    </div>
  );
}
