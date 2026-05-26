"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { StudioLayout } from "@/components/studio/StudioLayout";
import type { ArtifactItem, RuntimeLine, StudioArtifacts, StudioFormState } from "@/components/studio/studio-types";
import { createTask, getRecentTasks, getRuntimeSettings, getStudioRuntime, getTask, updateRuntimeSettings } from "@/lib/api";
import type { CreateTaskPayload, RuntimeSettings, SpeakingStyle, StudioRuntimeData, Task, TaskLog, TtsProvider } from "@/lib/types";

type ArtifactKind = "real" | "provider" | "fallback" | "pending";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const defaultTargetStyle = `中文技术口播，
信息密度高，
节奏快，
像“GitHub 爆款项目拆解”。

要求：
- 开头3秒必须有冲击力
- 不要废话
- 不要鸡汤
- 不要营销感
- 像真正开发者在分享
- 句子短
- 节奏快
- 每句话都能当字幕
- 适合抖音/B站技术区

风格参考：
“开发者们，GitHub 又杀疯了。”
“这个项目，已经开始替代传统工作流了。”
“真正可怕的是，它不是 Demo。”

整体氛围：
- AI 工程化
- 工业级 Runtime
- 自动化工作流
- 高级开发者工具
- 未来感
- 克制
- 专业

不要：
❌ 太像 AI 配音
❌ 太像广告
❌ 太像新闻播报
❌ 太浮夸
❌ 太热血

希望效果：
像一个真正懂 AI 工程的开发者，
在拆解一个未来感 AI 项目。

视频节奏：
前3秒：快速抛爆点
中间：快速拆解功能链路
结尾：一句“真正有后劲”的总结。

字幕要求：
- 一行不要太长
- 适合竖屏阅读
- 每句话都能单独成字幕
- 尽量避免大段连续文字

视觉配合：
- Apple 风格 UI
- 极简科技感
- 白色高级界面
- AI Runtime 工作流
- 不要赛博朋克

额外要求：
自动生成：
- 更适合短视频传播的表达
- 更适合口播停顿
- 更适合字幕切分
- 更适合 AI 配音语气

整体感觉：
“像 OpenAI 工程师，
在演示下一代 AI 视频系统。”

事实约束：
- 如果主题要求榜单或项目拆解，必须优先使用用户提供的项目名、链接、描述
- 没有真实项目素材时，不要编造项目名、数据、融资、生产案例
- 不要用“模型压缩”“工作流工具”这种泛泛类别冒充具体项目
- 如果缺少项目清单，就按选题框架生成，并提醒需要补充项目素材`;

const styleChips: Array<{ value: SpeakingStyle; label: string; prompt: string }> = [
  { value: "tech", label: "技术口播", prompt: defaultTargetStyle },
  { value: "viral", label: "短视频爆款", prompt: "短视频节奏，开头有钩子，但不要油腻营销腔。" },
  { value: "oral", label: "自然讲述", prompt: "自然口播，像真人讲述，节奏舒服。" },
  { value: "tech", label: "产品演示", prompt: "产品演示风格，讲清楚输入、处理、产出和用户价值。" }
];

function artifactUrl(path: unknown) {
  if (typeof path !== "string" || !path) return "";
  if (path.includes("://")) return path;
  const normalized = path.replaceAll("\\", "/");
  const marker = "artifacts/outputs/";
  const index = normalized.indexOf(marker);
  if (index === -1) return path;
  const relative = normalized.slice(index + "artifacts/".length);
  return `${API_URL}/artifacts/${relative}`;
}

function artifactDisplayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getStringArtifact(task: Task | null, keys: string[]) {
  if (!task) return "";
  for (const key of keys) {
    const value = task.artifacts[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function getStepOutput(task: Task | null, ids: string[]) {
  return task?.steps.find((step) => ids.includes(step.id))?.output ?? "";
}

function classifyArtifact(value: unknown, task: Task | null, includeTaskFallbackLogs = false): ArtifactItem {
  const displayValue = artifactDisplayValue(value);
  if (!displayValue) return { value: "", kind: "pending" };

  const lowerValue = displayValue.toLowerCase();
  const logText = includeTaskFallbackLogs ? (task?.logs.map((log) => log.message.toLowerCase()).join("\n") ?? "") : "";
  const looksFallback =
    lowerValue.includes("fallback") ||
    lowerValue.includes("placeholder") ||
    lowerValue.includes("silent") ||
    logText.includes("fallback") ||
    logText.includes("silent wav") ||
    logText.includes("no usable audio");

  return { value: displayValue, kind: looksFallback ? "fallback" : "real" };
}

function classifyAudioArtifact(value: unknown, task: Task | null): ArtifactItem {
  const item = classifyArtifact(value, task);
  const ttsProvider = artifactDisplayValue(task?.artifacts.ttsProvider).toLowerCase();
  const warningText = Array.isArray(task?.artifacts.fallbackWarnings) ? task.artifacts.fallbackWarnings.join("\n").toLowerCase() : "";

  if (ttsProvider.includes("fallback") || warningText.includes("[tts] fallback") || warningText.includes("silent wav")) {
    return { ...item, kind: item.value ? "fallback" : "pending" };
  }
  return item;
}

function classifyVideoArtifact(value: unknown, task: Task | null): ArtifactItem {
  const item = classifyArtifact(value, task);
  const renderMode = artifactDisplayValue(task?.artifacts.renderMode).toLowerCase();
  if (renderMode === "placeholder" || renderMode === "no_subtitles") {
    return { ...item, kind: item.value ? "fallback" : "pending" };
  }
  return item;
}

function getStudioArtifacts(task: Task | null): StudioArtifacts {
  return {
    transcript: classifyArtifact(
      getStringArtifact(task, ["reference", "transcript", "raw_transcript", "source_transcript"]) || getStepOutput(task, ["reference", "transcript", "extract"]),
      task
    ),
    script: classifyArtifact(
      getStringArtifact(task, ["voiceoverScript", "rewrittenScript", "rewritten_script", "final_script", "script_rewrite", "script"]) ||
        getStepOutput(task, ["voiceoverScript", "rewrittenScript", "rewrite"]),
      task
    ),
    audio: classifyAudioArtifact(getStringArtifact(task, ["voice", "voicePath", "audio", "audioUrl", "audio_url"]) || getStepOutput(task, ["voice", "tts"]), task),
    video: classifyVideoArtifact(
      getStringArtifact(task, ["finalVideo", "finalVideoPath", "finalVideoUrl", "videoUrl", "render_url"]) || getStepOutput(task, ["finalVideo", "render"]),
      task
    )
  };
}

function hasPlayableVideo(task: Task) {
  return Boolean(getStudioArtifacts(task).video.value);
}

function scriptStepStatus(task: Task | null) {
  return task?.steps.find((step) => step.id === "voiceoverScript" || step.label.toLowerCase().includes("script"))?.status ?? null;
}

function runtimeLineFromTaskLog(log: TaskLog, id: number): RuntimeLine {
  const lowerMessage = log.message.toLowerCase();
  const isWarning =
    log.level === "error" ||
    log.level === "warn" ||
    lowerMessage.includes("fallback") ||
    lowerMessage.includes("mock provider") ||
    lowerMessage.includes("silent");

  return {
    id,
    source: isWarning ? "Fallback" : "TaskLog",
    message: log.message,
    level: isWarning ? "warn" : "success"
  };
}

function buildPayload(form: StudioFormState, script: string): CreateTaskPayload & { script_prompt?: string; script?: string } {
  const topic = form.topic.trim();
  const sourceUrl = form.sourceUrl.trim();
  const localFilePath = form.localFilePath.trim();
  const referenceText = form.referenceText.trim();
  const targetStyle = form.targetStyle.trim();
  const editedScript = script.trim();

  return {
    mode: "semi_real",
    source_url: sourceUrl,
    local_file_path: localFilePath || undefined,
    topic: topic || undefined,
    reference_text: referenceText || undefined,
    target_style: targetStyle || defaultTargetStyle,
    speaking_style: form.speakingStyle,
    script: editedScript || undefined,
    title: topic ? `Voice Script: ${topic}` : "Voice Script Task"
  };
}

function providerLabel(settings: RuntimeSettings | null) {
  if (!settings) return "Loading provider";
  if (settings.tts_provider === "fishspeech") return `FishSpeech / ${settings.fishspeech_voice || "default"}`;
  if (settings.tts_provider === "edge_tts") return `edge-tts / ${settings.edge_tts_voice}`;
  return "Mock TTS";
}

function getProviderWarning(settings: RuntimeSettings | null, task: Task | null) {
  const logText = task?.logs.map((log) => log.message).join("\n") ?? "";
  const lowerLogText = logText.toLowerCase();

  if (lowerLogText.includes("fishspeech adapter failed")) return "FishSpeech 调用失败，后端已回退到静音 wav。";
  if (lowerLogText.includes("fishspeech returned no usable audio")) return "FishSpeech 没有返回可用音频，后端已生成兜底音频。";
  if (lowerLogText.includes("edge_tts package is not installed")) return "edge-tts 未安装，后端已生成兜底音频。";
  if (lowerLogText.includes("mock provider active")) return "当前 TTS Provider 为模拟模式，音频会是静音占位。";
  if (lowerLogText.includes("fallback silent wav")) return "后端生成了兜底静音 wav，请检查 TTS Provider 或依赖。";
  if (settings?.tts_provider === "fishspeech" && !settings.fishspeech_base_url) return "FishSpeech 已选中，但 Base URL 为空。";
  if (settings?.tts_provider === "mock") return "当前 TTS Provider 为模拟模式，适合联调，不适合录制最终声音。";
  return "";
}

export function StudioView() {
  const [form, setForm] = useState<StudioFormState>({
    sourceUrl: "",
    localFilePath: "",
    topic: "",
    referenceText: "",
    targetPlatform: "抖音 / 小红书",
    targetStyle: defaultTargetStyle,
    speakingStyle: "tech"
  });
  const [voiceScript, setVoiceScript] = useState("");
  const [task, setTask] = useState<Task | null>(null);
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [historyTasks, setHistoryTasks] = useState<Task[]>([]);
  const [studioRuntime, setStudioRuntime] = useState<StudioRuntimeData | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isTtsProviderSaving, setIsTtsProviderSaving] = useState(false);
  const [createError, setCreateError] = useState("");
  const [runtimeLines, setRuntimeLines] = useState<RuntimeLine[]>([
    { id: 1, source: "Studio", message: "Ready for a new AI video.", level: "info" },
    { id: 2, source: "TTS", message: "Runtime provider will be loaded from /api/settings.", level: "info" }
  ]);

  const consoleRef = useRef<HTMLDivElement | null>(null);
  const seenLogKeysRef = useRef<Set<string>>(new Set());
  const logIdRef = useRef(3);
  const requestVersionRef = useRef(0);
  const didLoadHistoryRef = useRef(false);
  const artifacts = useMemo(() => getStudioArtifacts(task), [task]);
  const providerWarning = getProviderWarning(settings, task);
  const audioUrl = artifactUrl(artifacts.audio.value);
  const videoUrl = artifactUrl(artifacts.video.value);
  const canRun = Boolean(form.topic.trim() || form.referenceText.trim() || form.sourceUrl.trim() || form.localFilePath.trim() || voiceScript.trim());
  const isScriptReady = Boolean(artifacts.script.value || studioRuntime?.scenes.length || scriptStepStatus(task) === "success");
  const isScriptGenerating = Boolean(task && task.status !== "error" && !isScriptReady && ["queued", "running"].includes(task.status));

  function selectHistoryTask(nextTask: Task) {
    requestVersionRef.current += 1;
    seenLogKeysRef.current = new Set();
    setTask(nextTask);
    setForm((current) => ({
      sourceUrl: nextTask.source_url || "",
      localFilePath: nextTask.local_file_path || "",
      topic: nextTask.topic || nextTask.title || current.topic,
      referenceText: nextTask.reference_text || current.referenceText,
      targetPlatform: current.targetPlatform,
      targetStyle: nextTask.target_style || current.targetStyle,
      speakingStyle: (nextTask.speaking_style as SpeakingStyle | null) || current.speakingStyle
    }));
    setVoiceScript(getStudioArtifacts(nextTask).script.value);
    setCreateError("");
    setRuntimeLines((current) => [
      ...current.slice(-36),
      { id: logIdRef.current++, source: "History", message: `Loaded ${nextTask.id.slice(0, 8)} into preview.`, level: "success" }
    ]);
  }

  function startNewVideo() {
    requestVersionRef.current += 1;
    seenLogKeysRef.current = new Set();
    setTask(null);
    setStudioRuntime(null);
    setVoiceScript("");
    setCreateError("");
    setForm((current) => ({
      ...current,
      sourceUrl: "",
      localFilePath: "",
      topic: "",
      referenceText: "",
    }));
    setRuntimeLines((current) => [
      ...current.slice(-36),
      { id: logIdRef.current++, source: "Studio", message: "Started a blank video draft.", level: "success" }
    ]);
  }

  async function loadHistory(options: { selectLatest?: boolean } = {}) {
    setIsHistoryLoading(true);
    setHistoryError("");
    try {
      const recent = await getRecentTasks();
      setHistoryTasks(recent);
      if (options.selectLatest && !task) {
        const latestPlayable = recent.find((item) => item.status === "success" && hasPlayableVideo(item));
        if (latestPlayable) selectHistoryTask(latestPlayable);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "recent tasks request failed";
      setHistoryError(message);
      setRuntimeLines((current) => [...current.slice(-36), { id: logIdRef.current++, source: "History", message: `历史作品读取失败：${message}`, level: "warn" }]);
    } finally {
      setIsHistoryLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    getRuntimeSettings()
      .then((nextSettings) => {
        if (!cancelled) setSettings(nextSettings);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "settings request failed";
        setRuntimeLines((current) => [...current, { id: logIdRef.current++, source: "Settings", message: `无法读取 TTS 设置：${message}`, level: "warn" }]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (didLoadHistoryRef.current) return;
    didLoadHistoryRef.current = true;
    void loadHistory();
    // Only run once on page mount; loadHistory depends on changing task state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!task || task.status === "success" || task.status === "error") return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const fresh = await getTask(task.id);
        if (!cancelled) {
          setTask(fresh);
          setCreateError("");
        }
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "task polling failed";
        setCreateError(message);
        setRuntimeLines((current) => {
          const lastLine = current.at(-1);
          if (lastLine?.source === "Polling" && lastLine.message.includes(message)) return current;
          return [...current.slice(-36), { id: logIdRef.current++, source: "Polling", message: `Task status request failed; retrying: ${message}`, level: "warn" }];
        });
      }
    }, 900);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [task]);

  useEffect(() => {
    if (!task?.id) {
      setStudioRuntime(null);
      return;
    }

    let cancelled = false;
    getStudioRuntime({ taskId: task.id })
      .then((runtime) => {
        if (!cancelled) setStudioRuntime(runtime);
      })
      .catch(() => {
        if (!cancelled) setStudioRuntime(null);
      });

    return () => {
      cancelled = true;
    };
  }, [task?.id, task?.status, task?.updated_at]);

  useEffect(() => {
    if (!task?.logs.length) return;

    const nextLines = task.logs.flatMap((log) => {
      const key = `${log.timestamp}-${log.message}`;
      if (seenLogKeysRef.current.has(key)) return [];
      seenLogKeysRef.current.add(key);
      return [runtimeLineFromTaskLog(log, logIdRef.current++)];
    });

    if (!nextLines.length) return;
    setRuntimeLines((current) => [...current.slice(-42), ...nextLines]);
  }, [task?.logs]);

  useEffect(() => {
    if (artifacts.script.value && !voiceScript) {
      setVoiceScript(artifacts.script.value);
    }
  }, [artifacts.script.value, voiceScript]);

  useEffect(() => {
    if (!studioRuntime || !task?.id) return;
    setForm((current) => ({
      ...current,
      topic: studioRuntime.topic || current.topic,
      targetPlatform: current.targetPlatform,
      targetStyle: studioRuntime.target_style || current.targetStyle
    }));
  }, [studioRuntime, task?.id]);

  useEffect(() => {
    if (!task || task.status !== "success") return;
    setHistoryTasks((current) => [task, ...current.filter((item) => item.id !== task.id)].slice(0, 12));
  }, [task]);

  useEffect(() => {
    if (!consoleRef.current) return;
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [runtimeLines]);

  async function handleCreateTask(intent: "script" | "audio") {
    if (intent === "audio" && !voiceScript.trim() && !artifacts.script.value.trim()) {
      setCreateError("请先生成或填写口播脚本，再渲染配音和视频。");
      setRuntimeLines((current) => [
        ...current.slice(-36),
        { id: logIdRef.current++, source: "Studio", message: "Render skipped: no voiceover script is available yet.", level: "warn" }
      ]);
      return;
    }

    requestVersionRef.current += 1;
    const requestVersion = requestVersionRef.current;
    setIsCreating(true);
    setCreateError("");
    setTask(null);
    setStudioRuntime(null);
    if (intent === "script") setVoiceScript("");
    seenLogKeysRef.current = new Set();
    setRuntimeLines((current) => [
      ...current.slice(-34),
      {
        id: logIdRef.current++,
        source: "Studio",
        message: intent === "script" ? "Generating narration and preparing media assets." : "Submitting current script for voice and video.",
        level: "info"
      }
    ]);

    try {
      const payload = buildPayload(form, intent === "audio" ? voiceScript : "");
      const created = await createTask(payload);
      if (requestVersionRef.current !== requestVersion) return;
      setTask(created);
      setHistoryTasks((current) => [created, ...current.filter((item) => item.id !== created.id)].slice(0, 12));
      setRuntimeLines((current) => [
        ...current.slice(-36),
        { id: logIdRef.current++, source: "Scheduler", message: `Task ${created.id.slice(0, 8)} created.`, level: "success" }
      ]);
    } catch (error) {
      if (requestVersionRef.current !== requestVersion) return;
      const message = error instanceof Error ? error.message : "Unable to create task";
      setCreateError(message);
      setRuntimeLines((current) => [...current.slice(-36), { id: logIdRef.current++, source: "Scheduler", message: `任务创建失败：${message}`, level: "warn" }]);
    } finally {
      if (requestVersionRef.current === requestVersion) setIsCreating(false);
    }
  }

  function applyStyleChip(chip: (typeof styleChips)[number]) {
    setForm((current) => ({ ...current, speakingStyle: chip.value, targetStyle: chip.prompt }));
  }

  async function refreshRuntime() {
    setRuntimeLines((current) => [...current.slice(-36), { id: logIdRef.current++, source: "Studio", message: "Refreshing runtime settings, task state, and artifacts.", level: "info" }]);
    try {
      const nextSettings = await getRuntimeSettings();
      setSettings(nextSettings);

      if (task?.id) {
        const freshTask = await getTask(task.id);
        setTask(freshTask);
        const runtime = await getStudioRuntime({ taskId: task.id });
        setStudioRuntime(runtime);
      }

      await loadHistory();
      setRuntimeLines((current) => [...current.slice(-36), { id: logIdRef.current++, source: "Studio", message: "Runtime refresh completed.", level: "success" }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "runtime refresh failed";
      setRuntimeLines((current) => [...current.slice(-36), { id: logIdRef.current++, source: "Studio", message: `运行态刷新失败：${message}`, level: "warn" }]);
    }
  }

  async function selectTtsProvider(provider: TtsProvider, options: { edgeVoice?: string } = {}) {
    if (provider === "mock") return;
    const edgeVoice = options.edgeVoice;
    if (settings?.tts_provider === provider && (!edgeVoice || settings.edge_tts_voice === edgeVoice)) return;

    setIsTtsProviderSaving(true);
    setCreateError("");
    setSettings((current) => (current ? { ...current, tts_provider: provider, ...(edgeVoice ? { edge_tts_voice: edgeVoice } : {}) } : current));
    setRuntimeLines((current) => [
      ...current.slice(-36),
      {
        id: logIdRef.current++,
        source: "Settings",
        message: provider === "edge_tts" ? "Switched voice engine to Microsoft Edge TTS." : "Switched voice engine to FishSpeech.",
        level: "info"
      }
    ]);

    try {
      const saved = await updateRuntimeSettings({ tts_provider: provider, ...(edgeVoice ? { edge_tts_voice: edgeVoice } : {}) });
      setSettings(saved);
      setRuntimeLines((current) => [...current.slice(-36), { id: logIdRef.current++, source: "Settings", message: "Voice settings saved for the next task.", level: "success" }]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "settings save failed";
      const fresh = await getRuntimeSettings().catch(() => null);
      if (fresh) setSettings(fresh);
      setCreateError(message);
      setRuntimeLines((current) => [...current.slice(-36), { id: logIdRef.current++, source: "Settings", message: `TTS provider save failed: ${message}`, level: "warn" }]);
    } finally {
      setIsTtsProviderSaving(false);
    }
  }

  return (
    <StudioLayout
      form={form}
      setForm={setForm}
      styleChips={styleChips}
      voiceScript={voiceScript}
      setVoiceScript={setVoiceScript}
      task={task}
      settings={settings}
      historyTasks={historyTasks}
      artifacts={artifacts}
      audioUrl={audioUrl}
      videoUrl={videoUrl}
      providerWarning={providerWarning}
      providerLabel={providerLabel(settings)}
      runtimeLines={runtimeLines}
      consoleRef={consoleRef}
      studioRuntime={studioRuntime}
      isCreating={isCreating}
      isScriptGenerating={isScriptGenerating}
      isTtsProviderSaving={isTtsProviderSaving}
      createError={createError}
      canRun={canRun}
      isHistoryLoading={isHistoryLoading}
      historyError={historyError}
      onCreate={() => handleCreateTask("script")}
      onNewVideo={startNewVideo}
      onRegenerate={() => handleCreateTask("script")}
      onRender={() => handleCreateTask("audio")}
      onSelectTtsProvider={(provider, options) => void selectTtsProvider(provider, options)}
      onApplyStyleChip={applyStyleChip}
      onRefreshSettings={() => void getRuntimeSettings().then(setSettings)}
      onRefreshRuntime={() => void refreshRuntime()}
      onRefreshHistory={() => void loadHistory()}
      onSelectHistory={selectHistoryTask}
    />
  );
}
