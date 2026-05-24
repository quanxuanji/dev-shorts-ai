import { Download, FileAudio, FileJson, FileText, Film } from "lucide-react";

import { cn } from "@/lib/utils";

import type { StudioAssetView } from "./studio-types";

const iconFor = {
  video: Film,
  audio: FileAudio,
  subtitle: FileText,
  timeline: FileJson,
  script: FileJson
};

export function ExportPanel({ assets, selectedAssetName, onSelectAsset }: { assets: StudioAssetView[]; selectedAssetName?: string; onSelectAsset?: (asset: StudioAssetView) => void }) {
  return (
    <section className="studio-panel-secondary rounded-[24px] border p-4 min-[2200px]:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#F5F5F7]">Export Panel</h2>
        <span className="text-xs text-[#777D89]">{assets.filter((asset) => asset.exists).length} ready</span>
      </div>
      <div className="max-h-[250px] space-y-2 overflow-y-auto pr-1 min-[2200px]:max-h-[320px]">
        {assets.slice(0, 8).map((asset) => {
          const Icon = iconFor[asset.kind as keyof typeof iconFor] ?? FileJson;
          const canOpen = asset.exists;
          return (
            <button
              key={asset.name}
              type="button"
              onClick={() => {
                if (canOpen) onSelectAsset?.(asset);
              }}
              disabled={!canOpen}
              className={cn(
                "studio-hover-item flex w-full items-center gap-3 rounded-2xl border border-white/[0.11] bg-[#0B0B0C]/50 p-3 text-left transition",
                selectedAssetName === asset.name && "studio-active-item",
                !asset.exists && "cursor-not-allowed opacity-55 hover:translate-y-0 hover:border-white/[0.11]"
              )}
            >
              <Icon className="h-4 w-4 text-[#5DE2FF]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs font-semibold text-[#F5F5F7]">{asset.name}</span>
                <span className="block truncate text-xs text-[#777D89]">{asset.detail}</span>
              </span>
              {asset.url && asset.exists ? (
                <a
                  href={asset.url}
                  download
                  onClick={(event) => event.stopPropagation()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.08] text-[#5DE2FF] hover:bg-white/[0.08]"
                  aria-label={`下载 ${asset.name}`}
                  title={`下载 ${asset.name}`}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              ) : (
                <Download className="h-3.5 w-3.5 text-[#555B66]" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
