"use client";

import { useEffect, useMemo, useState } from "react";
import { AudioLines } from "lucide-react";

import { AppShell } from "@/components/app-shell";

import { AssetPreviewPanel } from "./AssetPreviewPanel";
import { CreationBrief } from "./CreationBrief";
import { ExportPanel } from "./ExportPanel";
import { LiveLogs } from "./LiveLogs";
import { RenderPreview } from "./RenderPreview";
import { SceneBoard } from "./SceneBoard";
import { ScriptEditor } from "./ScriptEditor";
import { StudioSidebar } from "./StudioSidebar";
import { StudioStatusBar } from "./StudioStatusBar";
import { SubtitleInspector } from "./SubtitleInspector";
import { TimelineSyncPanel } from "./TimelineSyncPanel";
import { TimelineTrack } from "./TimelineTrack";
import type { SelectedAsset, StudioLayoutProps } from "./studio-types";
import { normalizeAssets, normalizeScenes } from "./studio-utils";
import { VoiceConfigPanel } from "./VoiceConfigPanel";

export function StudioLayout(props: StudioLayoutProps) {
  const scenes = useMemo(() => normalizeScenes(props.studioRuntime, props.voiceScript || props.artifacts.script.value), [props.artifacts.script.value, props.studioRuntime, props.voiceScript]);
  const assets = useMemo(() => normalizeAssets(props.studioRuntime, props.artifacts), [props.artifacts, props.studioRuntime]);
  const [activeStage, setActiveStage] = useState("topic");
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>(null);
  const selectedScene = scenes.find((scene) => scene.sceneIndex === selectedSceneIndex) ?? scenes[0];

  useEffect(() => {
    if (!scenes.length) {
      setSelectedSceneIndex(0);
      return;
    }
    if (!scenes.some((scene) => scene.sceneIndex === selectedSceneIndex)) {
      setSelectedSceneIndex(scenes[0].sceneIndex);
    }
  }, [scenes, selectedSceneIndex]);

  function selectStage(stage: string) {
    setActiveStage(stage);
    const assetByStage: Record<string, string> = {
      script: "script_sections.json",
      tts: "voice.wav",
      subtitle: "subtitles.srt",
      render: "timeline.json",
      export: "final.mp4"
    };
    const assetName = assetByStage[stage];
    const matchingAsset = assetName ? assets.find((asset) => asset.name === assetName && asset.exists) : null;
    if (matchingAsset) setSelectedAsset(matchingAsset);
  }

  function selectScene(sceneIndex: number) {
    setSelectedSceneIndex(sceneIndex);
    if (activeStage === "topic") setActiveStage("script");
  }

  function selectAsset(asset: NonNullable<SelectedAsset>) {
    setSelectedAsset(asset);
    setActiveStage("export");
  }

  return (
    <AppShell active="/studio">
      <div className="studio-runtime-shell flex h-full min-h-0 flex-col gap-3 overflow-hidden text-[#F5F5F7] min-[2200px]:gap-4">
        <div className="grid min-h-0 flex-1 gap-3 min-[2200px]:grid-cols-[320px_minmax(0,1fr)_360px] min-[2200px]:gap-4 2xl:grid-cols-[296px_minmax(0,1fr)_334px] xl:grid-cols-[272px_minmax(0,1fr)_318px] lg:grid-cols-[272px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-y-auto pr-1">
            <StudioSidebar
              props={props}
              scenes={scenes}
              assets={assets}
              activeStage={activeStage}
              selectedSceneIndex={selectedSceneIndex}
              onSelectStage={selectStage}
              onSelectScene={selectScene}
              onSelectAsset={selectAsset}
            />
          </div>

          <main className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden pr-1 min-[2200px]:gap-4">
            <StudioStatusBar props={props} />
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <StageWorkspace
                activeStage={activeStage}
                props={props}
                scenes={scenes}
                assets={assets}
                selectedAsset={selectedAsset}
                selectedSceneIndex={selectedScene?.sceneIndex}
                onSelectScene={selectScene}
              />
            </div>
          </main>

          <aside className="min-h-0 space-y-3 overflow-y-auto pr-1 min-[2200px]:space-y-4 lg:col-span-2 xl:col-span-1">
            <RenderPreview props={props} scenes={scenes} selectedSceneIndex={selectedScene?.sceneIndex} onSelectScene={selectScene} />
            <ExportPanel assets={assets} selectedAssetName={selectedAsset?.name} onSelectAsset={selectAsset} />
            <LiveLogs lines={props.runtimeLines} consoleRef={props.consoleRef} focusStage={activeStage} />
          </aside>
        </div>

        <div className="grid h-[160px] shrink-0 gap-3 overflow-hidden 2xl:h-[180px] min-[2200px]:h-[200px] min-[2200px]:gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.85fr)_minmax(260px,0.7fr)_minmax(300px,0.85fr)]">
          <TimelineTrack runtime={props.studioRuntime} scenes={scenes} compact selectedSceneIndex={selectedScene?.sceneIndex} onSelectScene={selectScene} />
          <LiveLogs lines={props.runtimeLines} consoleRef={props.consoleRef} compact focusStage={activeStage} />
          <TtsDurations scenes={scenes} />
          <TimelineSyncPanel runtime={props.studioRuntime} />
        </div>
      </div>
    </AppShell>
  );
}

function StageWorkspace({
  activeStage,
  props,
  scenes,
  assets,
  selectedAsset,
  selectedSceneIndex,
  onSelectScene
}: {
  activeStage: string;
  props: StudioLayoutProps;
  scenes: ReturnType<typeof normalizeScenes>;
  assets: ReturnType<typeof normalizeAssets>;
  selectedAsset: SelectedAsset;
  selectedSceneIndex?: number;
  onSelectScene: (sceneIndex: number) => void;
}) {
  if (activeStage === "script") {
    return (
      <div className="space-y-4 min-[2200px]:space-y-6">
        <ScriptEditor props={props} scenes={scenes} />
        <SceneBoard scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={onSelectScene} />
      </div>
    );
  }

  if (activeStage === "tts") {
    return (
      <div className="space-y-4 min-[2200px]:space-y-6">
        <VoiceConfigPanel props={props} scenes={scenes} />
        <TimelineTrack runtime={props.studioRuntime} scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={onSelectScene} />
      </div>
    );
  }

  if (activeStage === "subtitle" || activeStage === "render") {
    const selectedScene = scenes.find((scene) => scene.sceneIndex === selectedSceneIndex) ?? scenes[0];
    return (
      <div className="space-y-4 min-[2200px]:space-y-6">
        <SceneBoard scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={onSelectScene} />
        <SubtitleInspector subtitles={props.studioRuntime?.subtitles ?? []} selectedScene={selectedScene} />
        <TimelineTrack runtime={props.studioRuntime} scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={onSelectScene} />
      </div>
    );
  }

  if (activeStage === "export") {
    return (
      <div className="space-y-4 min-[2200px]:space-y-6">
        <SceneBoard scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={onSelectScene} />
        <TimelineTrack runtime={props.studioRuntime} scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={onSelectScene} />
        <AssetPreviewPanel asset={selectedAsset ?? assets.find((asset) => asset.name === "final.mp4") ?? null} />
        <TimelineSyncPanel runtime={props.studioRuntime} />
      </div>
    );
  }

  return (
    <div className="space-y-4 min-[2200px]:space-y-6">
      <div className="grid gap-4 min-[2200px]:gap-6 2xl:grid-cols-[minmax(0,0.55fr)_minmax(360px,0.45fr)]">
        <CreationBrief props={props} />
        <ScriptEditor props={props} scenes={scenes} />
      </div>
      <SceneBoard scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={onSelectScene} />
    </div>
  );
}

function TtsDurations({ scenes }: { scenes: ReturnType<typeof normalizeScenes> }) {
  const maxDuration = Math.max(...scenes.map((scene) => scene.audioDurationMs ?? 0), 1);

  return (
    <section className="studio-panel-tertiary h-full rounded-[22px] border p-3 min-[2200px]:rounded-[24px] min-[2200px]:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <AudioLines className="h-4 w-4 text-[#5DE2FF]" />
          口播时长
        </h2>
        <span className="text-xs text-[#777D89]">{scenes.length ? "每段声音长度" : "等待生成"}</span>
      </div>
      <div className="flex h-[92px] items-end gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#050506]/50 px-4 pb-3 pt-4 shadow-[inset_0_0_28px_rgba(93,226,255,0.045)] 2xl:h-[108px] min-[2200px]:h-32 min-[2200px]:gap-4">
        {scenes.length ? (
          scenes.slice(0, 10).map((scene) => (
            <div key={`tts-${scene.sceneIndex}`} className="flex min-w-10 flex-1 flex-col items-center gap-2">
              <div
                className="studio-waveform-bar w-5 rounded-t-full"
                style={{ height: `${Math.max(18, ((scene.audioDurationMs ?? 0) / maxDuration) * 72)}px` }}
              />
              <div className="font-mono text-[10px] text-[#777D89]">第{scene.rank}段</div>
              <div className="font-mono text-[10px] text-[#9EA3AE]">{scene.duration}</div>
            </div>
          ))
        ) : (
          <div className="text-sm text-[#777D89]">等待生成每段口播时长。</div>
        )}
      </div>
    </section>
  );
}
