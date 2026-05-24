import { Boxes } from "lucide-react";

import { cn } from "@/lib/utils";

import type { StudioAssetView } from "./studio-types";

export function TaskQueue({ assets, onSelectAsset }: { assets: StudioAssetView[]; onSelectAsset?: (asset: StudioAssetView) => void }) {
  const activeCount = assets.filter((asset) => !asset.exists).length;

  return (
    <section className="studio-panel-tertiary rounded-[22px] border p-3 min-[2200px]:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Boxes className="h-4 w-4 text-[#5DE2FF]" />
          Task Queue
        </h2>
        <span className="text-xs text-[#777D89]">{activeCount ? `${activeCount} pending` : "all clear"}</span>
      </div>
      <div className="max-h-44 space-y-2 overflow-y-auto pr-1 min-[2200px]:max-h-56">
        {assets.slice(0, 7).map((asset) => (
          <button
            key={asset.name}
            type="button"
            disabled={!asset.exists}
            onClick={() => {
              if (asset.exists) onSelectAsset?.(asset);
            }}
            className={cn(
              "studio-hover-item w-full rounded-2xl border border-white/[0.08] bg-[#0B0B0C]/50 p-2.5 text-left min-[2200px]:p-3",
              asset.exists ? "studio-active-item" : "cursor-not-allowed opacity-60 hover:translate-y-0 hover:border-white/[0.08]"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-mono text-xs text-[#F5F5F7]">{asset.name}</span>
              <span className={cn("text-xs", asset.exists ? "text-[#5DE2FF]" : "text-[#777D89]")}>{asset.exists ? "ready" : "pending"}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]">
              <div className={cn("h-full rounded-full", asset.exists ? "w-full bg-[#5DE2FF]" : "w-1/3 bg-[#7C5CFF]")} />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
