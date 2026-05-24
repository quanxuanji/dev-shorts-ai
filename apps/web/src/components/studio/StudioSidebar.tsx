import { Sparkles } from "lucide-react";

import type { StudioLayoutProps, StudioSceneView, StudioAssetView } from "./studio-types";
import { taskTitle, workflowStatus } from "./studio-utils";
import { HistoryPanel } from "./HistoryPanel";
import { SceneList } from "./SceneList";
import { TaskQueue } from "./TaskQueue";
import { WorkflowPanel, type WorkflowItem } from "./WorkflowPanel";

export function StudioSidebar({
  props,
  scenes,
  assets,
  activeStage,
  selectedSceneIndex,
  onSelectStage,
  onSelectScene,
  onSelectAsset
}: {
  props: StudioLayoutProps;
  scenes: StudioSceneView[];
  assets: StudioAssetView[];
  activeStage: string;
  selectedSceneIndex: number;
  onSelectStage: (stage: string) => void;
  onSelectScene: (sceneIndex: number) => void;
  onSelectAsset: (asset: StudioAssetView) => void;
}) {
  const workflowItems: WorkflowItem[] = [
    { id: "topic", title: "Topic Brief", detail: "keywords + style + platform", status: workflowStatus({ id: "topic", task: props.task, artifacts: props.artifacts, assets, scenes, isCreating: props.isCreating, runtime: props.studioRuntime }) },
    { id: "script", title: "LLM Script", detail: `${scenes.length || "waiting"} script sections`, status: workflowStatus({ id: "script", task: props.task, artifacts: props.artifacts, assets, scenes, isCreating: props.isCreating, runtime: props.studioRuntime }) },
    { id: "tts", title: "FishSpeech TTS", detail: "segmented voice queue", status: workflowStatus({ id: "tts", task: props.task, artifacts: props.artifacts, assets, scenes, isCreating: props.isCreating, runtime: props.studioRuntime }) },
    { id: "subtitle", title: "Subtitle", detail: "sentence timing", status: workflowStatus({ id: "subtitle", task: props.task, artifacts: props.artifacts, assets, scenes, isCreating: props.isCreating, runtime: props.studioRuntime }) },
    { id: "render", title: "Remotion Render", detail: "scene timeline", status: workflowStatus({ id: "render", task: props.task, artifacts: props.artifacts, assets, scenes, isCreating: props.isCreating, runtime: props.studioRuntime }) },
    { id: "export", title: "FFmpeg Export", detail: "final.mp4", status: workflowStatus({ id: "export", task: props.task, artifacts: props.artifacts, assets, scenes, isCreating: props.isCreating, runtime: props.studioRuntime }) }
  ];

  return (
    <aside className="space-y-3 min-[2200px]:space-y-4">
      <section className="studio-panel-secondary rounded-[22px] border p-3 min-[2200px]:rounded-[24px] min-[2200px]:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-[#9EA3AE]">
              <Sparkles className="h-4 w-4 text-[#5DE2FF]" />
              DevShorts AI
            </div>
            <div className="mt-2 line-clamp-2 text-lg font-semibold text-[#F5F5F7]">{taskTitle(props.task, props.studioRuntime, props.form.topic)}</div>
          </div>
          <div className="rounded-2xl border border-[#5DE2FF]/20 bg-[#5DE2FF]/10 px-3 py-2 text-xs text-[#9AF3FF]">
            {props.task?.id ? props.task.id.slice(0, 8) : "local"}
          </div>
        </div>
        <div className="mt-3 text-xs text-[#777D89]">{props.task?.mode ?? "semi_real"} / {props.settings?.tts_provider ?? "settings pending"}</div>
      </section>
      <HistoryPanel
        tasks={props.historyTasks}
        activeTaskId={props.task?.id ?? ""}
        isLoading={props.isHistoryLoading}
        error={props.historyError}
        onRefresh={props.onRefreshHistory}
        onSelect={props.onSelectHistory}
      />
      <WorkflowPanel items={workflowItems} activeId={activeStage} onSelect={onSelectStage} />
      <SceneList scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={onSelectScene} />
      <TaskQueue assets={assets} onSelectAsset={onSelectAsset} />
    </aside>
  );
}
