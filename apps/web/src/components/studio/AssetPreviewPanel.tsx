"use client";

import { useEffect, useState } from "react";
import { FileAudio, FileJson, FileText, Film } from "lucide-react";

import type { StudioAssetView } from "./studio-types";

function isTextLike(asset: StudioAssetView) {
  return /\.(json|txt|srt|md)$/i.test(asset.name) || ["script", "subtitle", "timeline"].includes(asset.kind);
}

export function AssetPreviewPanel({ asset }: { asset: StudioAssetView | null }) {
  const [content, setContent] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setContent("");
    setError("");
    if (!asset?.url || !asset.exists || !isTextLike(asset)) return;
    let cancelled = false;
    fetch(asset.url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text.slice(0, 12000));
      })
      .catch((nextError) => {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "preview failed");
      });
    return () => {
      cancelled = true;
    };
  }, [asset]);

  return (
    <section className="studio-panel-secondary rounded-[24px] border p-4 min-[2200px]:rounded-[28px] min-[2200px]:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <PreviewIcon asset={asset} />
          Asset Preview
        </h2>
        <span className="font-mono text-xs text-[#777D89]">{asset?.name ?? "no asset selected"}</span>
      </div>
      {!asset ? (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0B0B0C]/45 p-5 text-sm text-[#777D89]">点击右侧 Export Panel 的文件查看内容。</div>
      ) : !asset.exists ? (
        <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0B0B0C]/45 p-5 text-sm text-[#777D89]">{asset.name} is still pending.</div>
      ) : asset.kind === "video" && asset.url ? (
        <video className="max-h-[520px] w-full rounded-2xl bg-black object-contain" controls src={asset.url}>
          <track kind="captions" />
        </video>
      ) : asset.kind === "audio" && asset.url ? (
        <div className="rounded-2xl border border-white/[0.08] bg-[#050506]/50 p-5">
          <audio className="w-full" controls src={asset.url}>
            <track kind="captions" />
          </audio>
        </div>
      ) : isTextLike(asset) ? (
        <pre className="max-h-[280px] overflow-auto rounded-2xl border border-white/[0.08] bg-[#050506]/60 p-4 font-mono text-xs leading-6 text-[#D6D8DE] min-[2200px]:max-h-[420px]">
          {error || content || "Loading preview..."}
        </pre>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-[#050506]/50 p-5 text-sm text-[#9EA3AE]">
          暂不支持直接预览这种文件类型，可以点击下载。
        </div>
      )}
    </section>
  );
}

function PreviewIcon({ asset }: { asset: StudioAssetView | null }) {
  if (asset?.kind === "video") return <Film className="h-4 w-4 text-[#5DE2FF]" />;
  if (asset?.kind === "audio") return <FileAudio className="h-4 w-4 text-[#5DE2FF]" />;
  if (asset?.kind === "subtitle") return <FileText className="h-4 w-4 text-[#5DE2FF]" />;
  return <FileJson className="h-4 w-4 text-[#5DE2FF]" />;
}
