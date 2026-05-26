"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Download, FileText, Film, Loader2, Mic2, Play, RotateCcw, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { edgeTtsVoices, edgeTtsVoiceLabel } from "@/lib/edge-tts-voices";
import { cn } from "@/lib/utils";

import { AssetPreviewPanel } from "./AssetPreviewPanel";
import { ExportPanel } from "./ExportPanel";
import { LiveLogs } from "./LiveLogs";
import { SceneBoard } from "./SceneBoard";
import { TimelineSyncPanel } from "./TimelineSyncPanel";
import { TimelineTrack } from "./TimelineTrack";
import type { SelectedAsset, StudioLayoutProps } from "./studio-types";
import { deriveProgress, normalizeAssets, normalizeScenes } from "./studio-utils";

type SimpleStatus = {
  label: string;
  detail: string;
  stage: "idle" | "script" | "voice" | "subtitle" | "render" | "done" | "error";
};

export function StudioLayout(props: StudioLayoutProps) {
  const scenes = useMemo(() => normalizeScenes(props.studioRuntime, props.voiceScript || props.artifacts.script.value), [props.artifacts.script.value, props.studioRuntime, props.voiceScript]);
  const assets = useMemo(() => normalizeAssets(props.studioRuntime, props.artifacts), [props.artifacts, props.studioRuntime]);
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(0);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const status = getSimpleStatus(props, assets);
  const progress = deriveProgress(props.task, props.artifacts, props.studioRuntime);
  const canDownload = Boolean(props.videoUrl && !props.videoUrl.startsWith("mock://"));
  const hasScript = Boolean(props.voiceScript.trim() || props.artifacts.script.value.trim() || scenes.length);

  useEffect(() => {
    if (!scenes.length) {
      setSelectedSceneIndex(0);
      return;
    }
    if (!scenes.some((scene) => scene.sceneIndex === selectedSceneIndex)) {
      setSelectedSceneIndex(scenes[0].sceneIndex);
    }
  }, [scenes, selectedSceneIndex]);

  return (
    <AppShell active="/studio">
      <div className="studio-runtime-shell flex min-h-full flex-col gap-4 overflow-visible text-[#F5F5F7] lg:h-full lg:min-h-0 lg:overflow-hidden">
        <StudioHeader status={status} />

        <div className="grid flex-1 gap-4 overflow-visible lg:min-h-0 lg:overflow-hidden xl:grid-cols-[minmax(0,1.08fr)_minmax(330px,0.58fr)]">
          <main className="overflow-visible pr-1 lg:min-h-0 lg:overflow-y-auto">
            <div className="space-y-4">
              <StepOne props={props} status={status} />
              <StepTwo props={props} scenes={scenes} selectedSceneIndex={selectedSceneIndex} onSelectScene={setSelectedSceneIndex} hasScript={hasScript} />
              <StepThree props={props} canDownload={canDownload} hasScript={hasScript} />
            </div>
          </main>

          <aside className="overflow-visible pr-1 lg:min-h-0 lg:overflow-y-auto">
            <VideoPreview props={props} status={status} canDownload={canDownload} />
          </aside>
        </div>

        <motion.footer
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 240, damping: 28 }}
          className="shrink-0 rounded-[24px] border border-white/[0.08] bg-[#090B12]/70 p-4 backdrop-blur-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">{status.detail}</div>
              <div className="mt-1 text-xs text-white/45">下一步：{nextActionLabel(status, hasScript, canDownload)}</div>
            </div>
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="flex h-9 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.05] px-4 text-sm text-white/72 transition hover:bg-white/[0.08] hover:text-white"
            >
              查看高级详情
              <ChevronDown className={cn("h-4 w-4 transition", advancedOpen && "rotate-180")} />
            </button>
          </div>
          <div className="mt-4 h-px overflow-hidden rounded-full bg-white/[0.08]">
            <div className="studio-progress-glow h-full rounded-full bg-gradient-to-r from-[#5DE2FF] via-[#7C5CFF] to-[#F5F5F7] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          {advancedOpen ? (
            <AdvancedDetails
              props={props}
              scenes={scenes}
              assets={assets}
              selectedSceneIndex={selectedSceneIndex}
              selectedAsset={selectedAsset}
              onSelectScene={setSelectedSceneIndex}
              onSelectAsset={setSelectedAsset}
            />
          ) : null}
        </motion.footer>
      </div>
    </AppShell>
  );
}

function StudioHeader({ status }: { status: SimpleStatus }) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 rounded-[24px] border border-white/[0.08] bg-[#090B12]/72 px-5 py-4 backdrop-blur-xl">
      <div>
        <h1 className="text-2xl font-semibold leading-tight text-white">dev-short-ai</h1>
        <p className="mt-1 text-sm text-white/55">AI Video Runtime</p>
      </div>
      <div className="flex items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.05] px-4 py-2">
        <StatusDot status={status.stage} />
        <span className="text-sm font-medium text-white/82">AI Rendering</span>
      </div>
    </header>
  );
}

function StepOne({ props, status }: { props: StudioLayoutProps; status: SimpleStatus }) {
  const busy = props.isCreating || props.isScriptGenerating;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.002 }}
      transition={{ type: "spring", stiffness: 220, damping: 26 }}
      className="studio-panel-primary rounded-[24px] border p-5"
    >
      <StepTitle index={1} icon={Sparkles} title="第一步：告诉 AI 你想做什么视频" done={Boolean(props.task || props.artifacts.script.value)} active={status.stage === "idle" || status.stage === "script"} />
      <div className="mt-5 grid gap-4">
        <label className="block">
          <span className="text-sm font-medium text-white/72">视频主题</span>
          <Textarea
            value={props.form.topic}
            onChange={(event) => props.setForm((current) => ({ ...current, topic: event.target.value }))}
            placeholder="比如：本周 GitHub 最值得关注的 8 个 AI 项目"
            className="mt-2 min-h-24 resize-none rounded-2xl border-white/[0.1] bg-[#05070D]/70 p-4 text-base leading-7 text-white placeholder:text-white/28 focus:border-[#7C5CFF]/50 focus:ring-0"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-white/72">目标平台</span>
            <Input
              value={props.form.targetPlatform}
              onChange={(event) => props.setForm((current) => ({ ...current, targetPlatform: event.target.value }))}
              placeholder="抖音 / 小红书 / B 站"
              className="mt-2 h-11 rounded-2xl border-white/[0.1] bg-[#05070D]/70 px-4 text-white placeholder:text-white/28 focus:border-[#7C5CFF]/50 focus:ring-0"
            />
          </label>
          <div>
            <span className="text-sm font-medium text-white/72">视频风格</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {props.styleChips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => props.onApplyStyleChip(chip)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm text-white/58 transition hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white",
                    props.form.targetStyle === chip.prompt && "border-[#7C5CFF]/45 bg-[#7C5CFF]/15 text-white"
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-white/72">补充要求</span>
          <span className="ml-2 text-xs text-white/36">做榜单时，建议把项目名 / 链接 / 简介贴在这里，脚本会更准。</span>
          <Textarea
            value={props.form.targetStyle}
            onChange={(event) => props.setForm((current) => ({ ...current, targetStyle: event.target.value }))}
            placeholder="比如：中文技术口播，先讲痛点，再讲解决方案，最后总结"
            className="mt-2 min-h-44 resize-y rounded-2xl border-white/[0.1] bg-[#05070D]/70 p-4 text-sm leading-6 text-white placeholder:text-white/28 focus:border-[#7C5CFF]/50 focus:ring-0"
          />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={props.onCreate} disabled={busy || !props.canRun} className="h-11 rounded-full bg-white px-5 text-[#0B0B0C] hover:bg-white/90">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          生成脚本
        </Button>
        {props.createError ? (
          <span className="text-sm text-red-300">生成失败：{props.createError}，可以修改内容后重试。</span>
        ) : !props.canRun ? (
          <span className="text-sm text-amber-200/80">先填写“视频主题”，按钮就可以点击。</span>
        ) : (
          <span className="text-sm text-white/42">从这里开始就够了，其他细节会自动处理。</span>
        )}
      </div>
    </motion.section>
  );
}

function StepTwo({
  props,
  scenes,
  selectedSceneIndex,
  onSelectScene,
  hasScript
}: {
  props: StudioLayoutProps;
  scenes: ReturnType<typeof normalizeScenes>;
  selectedSceneIndex?: number;
  onSelectScene: (sceneIndex: number) => void;
  hasScript: boolean;
}) {
  const busy = props.isCreating || props.isScriptGenerating || (props.task?.status === "running" && !props.videoUrl);
  const voiceReady = props.artifacts.audio.kind === "real";
  const subtitleReady = Boolean(props.studioRuntime?.subtitles?.length || props.artifacts.video.kind === "real");
  const selectedProvider = props.settings?.tts_provider ?? "edge_tts";

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.002 }}
      transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.03 }}
      className="studio-panel-primary rounded-[24px] border p-5"
    >
      <StepTitle index={2} icon={Mic2} title="第二步：AI 自动生成脚本和配音" done={voiceReady || subtitleReady} active={hasScript && !props.videoUrl} />
      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-white/72">口播稿</span>
            <span className="text-xs text-white/42">{hasScript ? "脚本已生成" : "生成后会出现在这里"}</span>
          </div>
          <Textarea
            value={props.voiceScript}
            onChange={(event) => props.setVoiceScript(event.target.value)}
            placeholder="生成出来的口播稿会出现在这里。你也可以直接手写一版，再生成配音和字幕。"
            className="min-h-[320px] resize-y rounded-2xl border-white/[0.1] bg-[#05070D]/70 p-5 text-sm leading-8 text-white placeholder:text-white/28 focus:border-[#7C5CFF]/50 focus:ring-0"
          />
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#05070D]/55 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white/72">Voice Engine</span>
              <span className="text-xs text-white/38">{props.isTtsProviderSaving ? "Saving" : "Used for this generation"}</span>
            </div>
            <div className="grid gap-2">
              <TtsProviderButton
                active={selectedProvider === "edge_tts"}
                title="Microsoft Edge TTS"
                detail={edgeTtsVoiceLabel(props.settings?.edge_tts_voice || "zh-CN-XiaoxiaoNeural")}
                disabled={props.isTtsProviderSaving || props.isCreating || props.isScriptGenerating}
                onClick={() => props.onSelectTtsProvider("edge_tts")}
              />
              <TtsProviderButton
                active={selectedProvider === "fishspeech"}
                title="Fish Audio"
                detail={props.settings?.fishspeech_voice ? `Voice: ${props.settings.fishspeech_voice}` : "Local service or cloud API"}
                disabled={props.isTtsProviderSaving || props.isCreating || props.isScriptGenerating}
                onClick={() => props.onSelectTtsProvider("fishspeech")}
              />
            </div>
            <StudioEdgeVoicePicker
              value={props.settings?.edge_tts_voice || "zh-CN-XiaoxiaoNeural"}
              disabled={props.isTtsProviderSaving || props.isCreating || props.isScriptGenerating}
              onChange={(voiceId) => props.onSelectTtsProvider("edge_tts", { edgeVoice: voiceId })}
            />
            {props.providerWarning ? <div className="mt-3 text-xs leading-5 text-amber-200/80">{props.providerWarning}</div> : null}
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#05070D]/55 p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-white/72">分镜列表</span>
              <span className="text-xs text-white/38">{scenes.length ? `${scenes.length} 个分镜` : "待生成"}</span>
            </div>
            <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
              {scenes.length ? (
                scenes.map((scene) => (
                  <button
                    key={`${scene.sceneIndex}-${scene.title}`}
                    type="button"
                    onClick={() => onSelectScene(scene.sceneIndex)}
                    className={cn(
                      "w-full rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 text-left transition hover:border-white/[0.16] hover:bg-white/[0.06]",
                      selectedSceneIndex === scene.sceneIndex && "border-[#5DE2FF]/35 bg-[#5DE2FF]/10"
                    )}
                  >
                    <div className="text-sm font-semibold text-white">分镜 {scene.rank}：{scene.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-white/50">{scene.narration || scene.summary}</div>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-white/[0.12] p-4 text-sm leading-6 text-white/42">脚本生成后，会自动拆成几个清楚的分镜。</div>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#05070D]/55 p-4">
            <div className="text-sm font-medium text-white/72">配音状态</div>
            <div className="mt-3 space-y-2 text-sm text-white/55">
              <StatusLine done={hasScript} label={hasScript ? "脚本已生成" : "等待脚本"} />
              <StatusLine done={voiceReady} loading={busy && hasScript && !voiceReady} label={voiceReady ? "配音已准备好" : busy && hasScript ? "正在生成配音" : "等待生成配音"} />
              <StatusLine done={subtitleReady} label={subtitleReady ? "字幕已准备好" : "字幕会自动准备"} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={props.onRegenerate} disabled={props.isCreating || props.isScriptGenerating || !props.canRun} className="h-10 rounded-full border-white/[0.1] bg-white/[0.06] text-white/76 hover:bg-white/[0.1]">
          <RotateCcw className="mr-2 h-4 w-4" />
          重新生成脚本
        </Button>
        <Button onClick={props.onRender} disabled={props.isCreating || props.isScriptGenerating || !hasScript} className="h-10 rounded-full bg-[#7C5CFF] px-5 text-white hover:bg-[#8A70FF]">
          <Mic2 className="mr-2 h-4 w-4" />
          生成配音和字幕
        </Button>
      </div>
    </motion.section>
  );
}

function TtsProviderButton({
  active,
  title,
  detail,
  disabled,
  onClick
}: {
  active: boolean;
  title: string;
  detail: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-55",
        active ? "border-[#5DE2FF]/40 bg-[#5DE2FF]/12" : "border-white/[0.08] bg-white/[0.035] hover:border-white/[0.16] hover:bg-white/[0.06]"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className={cn("h-2.5 w-2.5 rounded-full", active ? "bg-[#5DE2FF]" : "bg-white/20")} />
      </div>
      <div className="mt-1 text-xs leading-5 text-white/45">{detail}</div>
    </button>
  );
}

function StudioEdgeVoicePicker({
  value,
  disabled,
  onChange
}: {
  value: string;
  disabled: boolean;
  onChange: (voiceId: string) => void;
}) {
  const voices = edgeTtsVoices.filter((voice) => voice.category !== "Regional").slice(0, 5);

  return (
    <div className="mt-3 border-t border-white/[0.08] pt-3">
      <label className="block">
        <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-white/45">Edge Voice</span>
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-xl border border-white/[0.1] bg-white/[0.45] px-3 text-sm font-medium text-[#111827] outline-none transition focus:border-[#4f8cff]/45 focus:ring-4 focus:ring-[#4f8cff]/10 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {voices.map((voice) => (
            <option key={voice.id} value={voice.id}>
              {voice.name} · {voice.gender} · {voice.locale}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 truncate text-xs text-white/38">{edgeTtsVoiceLabel(value)}</div>
      </div>
  );
}

function StepThree({ props, canDownload, hasScript }: { props: StudioLayoutProps; canDownload: boolean; hasScript: boolean }) {
  const rendering = props.task?.status === "running" && hasScript && !canDownload;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.002 }}
      transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.06 }}
      className="studio-panel-primary rounded-[24px] border p-5"
    >
      <StepTitle index={3} icon={Film} title="第三步：导出最终视频" done={canDownload} active={hasScript && !canDownload} />
      <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#05070D]/55 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white/72">导出状态</div>
            <p className="mt-1 text-sm text-white/45">{canDownload ? "final.mp4 已生成，可以预览或下载。" : rendering ? "视频渲染中，完成后会出现在这里。" : "视频生成完成后会出现在这里。"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={props.onRender} disabled={props.isCreating || props.isScriptGenerating || !hasScript || canDownload} className="h-10 rounded-full bg-[#5DE2FF] px-5 text-[#061015] hover:bg-[#9DEFFF]">
              {rendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              开始渲染
            </Button>
            <Button asChild variant="secondary" className={cn("h-10 rounded-full border-white/[0.1] bg-white/[0.06] text-white/76 hover:bg-white/[0.1]", !canDownload && "pointer-events-none opacity-45")}>
              <a href={canDownload ? props.videoUrl : "#"} download>
                <Download className="mr-2 h-4 w-4" />
                下载视频
              </a>
            </Button>
            <Button variant="secondary" onClick={props.onRegenerate} className="h-10 rounded-full border-white/[0.1] bg-white/[0.04] text-white/68 hover:bg-white/[0.08]">
              重新生成
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function VideoPreview({ props, status, canDownload }: { props: StudioLayoutProps; status: SimpleStatus; canDownload: boolean }) {
  const currentStage = stageText(status.stage);

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.002 }}
      transition={{ type: "spring", stiffness: 220, damping: 26, delay: 0.08 }}
      className="studio-panel-primary sticky top-0 rounded-[28px] border p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Film className="h-5 w-5 text-[#5DE2FF]" />
          视频预览
        </h2>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-white/45">{canDownload ? "final.mp4" : currentStage}</span>
      </div>
      <div className="studio-preview-frame mx-auto max-w-[300px] overflow-hidden rounded-[34px] border border-white/[0.12] bg-[#020204] p-2">
        {canDownload ? (
          <video className="relative z-10 aspect-[9/16] w-full rounded-[26px] bg-black object-contain" controls src={props.videoUrl}>
            <track kind="captions" />
          </video>
        ) : (
          <div className="relative z-10 flex aspect-[9/16] flex-col items-center justify-center rounded-[26px] bg-black p-8 text-center">
            {status.stage === "idle" ? (
              <>
                <Film className="h-10 w-10 text-white/28" />
                <div className="mt-5 text-xl font-semibold text-white">生成后的视频会出现在这里</div>
                <p className="mt-3 text-sm leading-6 text-white/42">先在左侧填写主题，然后点击“生成脚本”。</p>
              </>
            ) : status.stage === "error" ? (
              <>
                <AlertTriangle className="h-10 w-10 text-red-300" />
                <div className="mt-5 text-xl font-semibold text-white">生成失败</div>
                <p className="mt-3 text-sm leading-6 text-white/42">修改内容后可以重新生成。</p>
              </>
            ) : (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-[#5DE2FF]" />
                <div className="mt-5 text-lg font-semibold text-white">AI Rendering...</div>
                <p className="mt-3 text-sm leading-6 text-white/42">Synthesizing voice and timeline</p>
              </>
            )}
          </div>
        )}
      </div>
      <Button asChild variant="secondary" className={cn("mt-4 h-10 w-full rounded-full border-[#5DE2FF]/20 bg-white/[0.06] text-white/76 hover:bg-white/[0.1]", !canDownload && "pointer-events-none opacity-45")}>
        <a href={canDownload ? props.videoUrl : "#"} download>
          <Download className="mr-2 h-4 w-4" />
          下载 final.mp4
        </a>
      </Button>
    </motion.section>
  );
}

function AdvancedDetails({
  props,
  scenes,
  assets,
  selectedSceneIndex,
  selectedAsset,
  onSelectScene,
  onSelectAsset
}: {
  props: StudioLayoutProps;
  scenes: ReturnType<typeof normalizeScenes>;
  assets: ReturnType<typeof normalizeAssets>;
  selectedSceneIndex?: number;
  selectedAsset: SelectedAsset;
  onSelectScene: (sceneIndex: number) => void;
  onSelectAsset: (asset: NonNullable<SelectedAsset>) => void;
}) {
  const selectedScene = scenes.find((scene) => scene.sceneIndex === selectedSceneIndex) ?? scenes[0];

  return (
    <div className="mt-4 grid gap-4 border-t border-white/[0.08] pt-4 xl:grid-cols-2">
      <TimelineTrack runtime={props.studioRuntime} scenes={scenes} selectedSceneIndex={selectedScene?.sceneIndex} onSelectScene={onSelectScene} />
      <SceneBoard scenes={scenes} selectedSceneIndex={selectedScene?.sceneIndex} onSelectScene={onSelectScene} />
      <ExportPanel assets={assets} selectedAssetName={selectedAsset?.name} onSelectAsset={onSelectAsset} />
      <AssetPreviewPanel asset={selectedAsset ?? assets.find((asset) => asset.name === "final.mp4") ?? null} />
      <TimelineSyncPanel runtime={props.studioRuntime} />
      <LiveLogs lines={props.runtimeLines} consoleRef={props.consoleRef} focusStage="render" />
      <DebugJson title="manifest / artifacts" value={props.task?.artifacts ?? {}} />
      <DebugJson title="timeline.json / subtitles.srt" value={{ timeline: props.studioRuntime?.timeline ?? null, subtitles: props.studioRuntime?.subtitles ?? [] }} />
    </div>
  );
}

function StepTitle({ index, icon: Icon, title, done, active }: { index: number; icon: typeof Sparkles; title: string; done?: boolean; active?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-2xl border text-sm font-bold", done ? "border-emerald-300/25 bg-emerald-300/15 text-emerald-200" : active ? "border-[#5DE2FF]/35 bg-[#5DE2FF]/12 text-[#5DE2FF]" : "border-white/[0.08] bg-white/[0.04] text-white/45")}>
        {done ? <Check className="h-4 w-4" /> : index}
      </span>
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
        <Icon className="h-5 w-5 text-[#5DE2FF]" />
        {title}
      </h2>
    </div>
  );
}

function StatusLine({ done, loading, label }: { done?: boolean; loading?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin text-[#5DE2FF]" /> : done ? <Check className="h-4 w-4 text-emerald-300" /> : <span className="h-4 w-4 rounded-full border border-white/[0.14]" />}
      <span>{label}</span>
    </div>
  );
}

function DebugJson({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="studio-panel-tertiary rounded-[24px] border p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <FileText className="h-4 w-4 text-[#5DE2FF]" />
        {title}
      </div>
      <pre className="max-h-64 overflow-auto rounded-2xl border border-white/[0.06] bg-[#050506]/60 p-3 font-mono text-xs leading-5 text-white/50">{JSON.stringify(value, null, 2)}</pre>
    </section>
  );
}

function StatusDot({ status }: { status: SimpleStatus["stage"] }) {
  const color = status === "done" ? "bg-emerald-400" : status === "error" ? "bg-red-400" : "bg-[#4f8cff]";
  return <span className={cn("h-2.5 w-2.5 animate-pulse rounded-full shadow-[0_0_16px_rgba(79,140,255,0.45)]", color)} />;
}

function getSimpleStatus(props: StudioLayoutProps, assets: ReturnType<typeof normalizeAssets>): SimpleStatus {
  if (props.createError || props.task?.status === "error") {
    return { label: "失败", detail: "生成失败，可以调整内容后重试", stage: "error" };
  }
  if (props.artifacts.video.kind === "real" || assets.some((asset) => asset.name === "final.mp4" && asset.exists)) {
    return { label: "导出完成", detail: "视频已经生成完成，可以预览和下载", stage: "done" };
  }
  if (props.task?.status === "running" || props.task?.status === "queued") {
    const current = `${props.task.current_step ?? ""} ${props.studioRuntime?.current_step ?? ""}`.toLowerCase();
    if (current.includes("render") || current.includes("remotion") || current.includes("ffmpeg")) return { label: "视频渲染中", detail: "正在渲染并导出 final.mp4", stage: "render" };
    if (current.includes("subtitle") || current.includes("srt")) return { label: "字幕生成中", detail: "正在准备字幕", stage: "subtitle" };
    if (current.includes("tts") || current.includes("voice") || current.includes("audio")) return { label: "生成配音中", detail: "正在生成配音", stage: "voice" };
    return { label: "生成脚本中", detail: "正在生成口播稿和分镜", stage: "script" };
  }
  if (props.isCreating || props.isScriptGenerating) return { label: "生成脚本中", detail: "正在提交任务并生成脚本", stage: "script" };
  if (props.artifacts.audio.kind === "real") return { label: "字幕已准备好", detail: "配音和字幕已准备好，可以导出视频", stage: "subtitle" };
  if (props.artifacts.script.kind === "real" || props.voiceScript.trim() || props.studioRuntime?.scenes?.length) return { label: "脚本已生成", detail: "脚本已生成，下一步生成配音和字幕", stage: "voice" };
  return { label: "未开始", detail: "先填写视频主题，再生成脚本", stage: "idle" };
}

function nextActionLabel(status: SimpleStatus, hasScript: boolean, canDownload: boolean) {
  if (status.stage === "error") return "修改内容后重新生成";
  if (canDownload) return "下载 final.mp4，或重新生成";
  if (!hasScript) return "点击“生成脚本”";
  if (status.stage === "voice" || status.stage === "subtitle") return "点击“生成配音和字幕”或“开始渲染”";
  if (status.stage === "render" || status.stage === "script") return "等待当前步骤完成";
  return "填写视频主题";
}

function stageText(stage: SimpleStatus["stage"]) {
  if (stage === "script") return "脚本";
  if (stage === "voice") return "配音";
  if (stage === "subtitle") return "字幕";
  if (stage === "render") return "渲染 / 导出";
  if (stage === "done") return "导出完成";
  if (stage === "error") return "失败";
  return "未开始";
}
