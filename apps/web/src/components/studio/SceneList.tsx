import { Layers3 } from "lucide-react";

import type { StudioSceneView } from "./studio-types";

export function SceneList({ scenes, selectedSceneIndex, onSelectScene }: { scenes: StudioSceneView[]; selectedSceneIndex?: number; onSelectScene?: (sceneIndex: number) => void }) {
  return (
    <section className="studio-panel-secondary rounded-[22px] border p-3 min-[2200px]:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Layers3 className="h-4 w-4 text-[#5DE2FF]" />
          Scenes
        </h2>
        <span className="text-xs text-[#777D89]">{scenes.length ? `${scenes.length} ready` : "waiting"}</span>
      </div>
      <div className="max-h-[250px] space-y-2 overflow-y-auto pr-1 min-[2200px]:max-h-[320px]">
        {scenes.length ? (
          scenes.map((scene) => (
            <button
              key={`${scene.sceneIndex}-${scene.title}`}
              type="button"
              onClick={() => onSelectScene?.(scene.sceneIndex)}
              className={`studio-hover-item flex w-full items-center gap-3 rounded-2xl border border-white/[0.09] bg-[#0B0B0C]/50 p-2.5 text-left min-[2200px]:p-3 ${
                scene.sceneIndex === selectedSceneIndex ? "studio-active-item" : ""
              }`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F7] text-xs font-bold text-[#0B0B0C]">#{scene.rank}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-[#F5F5F7]">{scene.title}</div>
                <div className="mt-0.5 font-mono text-xs text-[#777D89]">
                  {scene.start} / {scene.duration}
                </div>
              </div>
              <span className="shrink-0 text-xs text-[#5DE2FF]">{scene.growth || leadLabel(scene)}</span>
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0B0B0C]/45 p-4 text-sm leading-6 text-[#777D89]">Waiting for script sections.</div>
        )}
      </div>
    </section>
  );
}

function leadLabel(scene: StudioSceneView) {
  if (typeof scene.visualStartMs !== "number" || typeof scene.speechStartMs !== "number") return "sync pending";
  const leadMs = scene.speechStartMs - scene.visualStartMs;
  if (leadMs >= 0) return `lead ${(leadMs / 1000).toFixed(1)}s`;
  return `late ${(Math.abs(leadMs) / 1000).toFixed(1)}s`;
}
