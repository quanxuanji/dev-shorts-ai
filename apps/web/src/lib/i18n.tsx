"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "zh" | "en";

const messages = {
  zh: {
    nav: {
      dashboard: "控制台",
      studio: "工作室",
      settings: "设置",
      runtime: "运行时",
      mockMode: "Fallback 模式",
      active: "运行中",
      pipelineStudio: "口播生成工作室",
      language: "语言"
    },
    dashboard: {
      eyebrow: "AI 运行时控制平面",
      title: "DevShorts Voice Runtime",
      description: "面向短视频口播生成的实时控制台：ASR 转写、LLM 脚本改写、FishSpeech/edge-tts 语音合成、字幕与 final.mp4 渲染。",
      aiStudio: "AI Studio",
      online: "在线",
      runningTasks: "运行任务",
      gpuUsage: "GPU 使用率",
      tokenRate: "Token/s",
      activeModels: "活跃模型",
      monitor: "实时系统监控",
      refresh: "每 2 秒刷新",
      vram: "显存占用",
      latency: "推理延迟",
      queue: "队列长度",
      modelMesh: "模型服务网格",
      running: "运行中",
      recentJobs: "最近生产任务",
      memoryStore: "内存任务存储",
      progress: "进度",
      completed: "已完成",
      noTasks: "暂无任务。进入 Studio 创建一个口播生成任务。",
      sourcePending: "等待输入源",
      semiReal: "本地生成",
      mock: "Fallback"
    },
    studio: {
      eyebrow: "自动化工作流工作室",
      title: "AI 视频流水线运行时",
      description: "为短视频生成口播脚本、FishSpeech/edge-tts 语音、字幕和 final.mp4。支持视频链接、本地文件路径、主题方向、目标风格和口播风格。",
      mockDemo: "Fallback Run",
      semiReal: "Local Voiceover",
      videoUrl: "视频链接",
      localFilePath: "本地文件路径",
      topic: "主题",
      targetStyle: "目标风格",
      speakingStyle: "口播风格",
      tech: "技术感",
      oral: "口语化",
      viral: "爆款风",
      createMock: "创建 Fallback 任务",
      runSemiReal: "生成口播视频",
      timeline: "口播生成时间线",
      nodeConfig: "节点配置",
      adapterOnline: "适配器在线",
      waitingArtifact: "等待上游产物",
      streamAttached: "执行流已连接",
      artifacts: "完成产物",
      outputReady: "产物已就绪",
      waitingCompletion: "等待任务完成",
      transcript: "转写文案",
      rewrittenScript: "改写脚本",
      subtitlesPath: "字幕文件路径",
      finalVideo: "final.mp4 预览 / 下载",
      pendingArtifact: "等待产物",
      preview: "预览",
      console: "AI 运行时控制台",
      demoStream: "Fallback 流",
      backendLogs: "后端日志",
      statusMode: {
        mock: "Fallback Run",
        semi_real: "Local Voiceover"
      },
      steps: {
        prepare: "准备视频",
        inputVideo: "输入视频",
        audio: "抽取音频",
        asr: "ASR 转写",
        transcript: "转写文案",
        extract: "提取文案",
        rewrite: "AI 改写",
        rewrittenScript: "改写脚本",
        tts: "语音合成",
        voice: "语音",
        "digital-human": "保留步骤",
        render: "视频渲染",
        finalVideo: "最终视频",
        titleCover: "标题封面",
        publishDraft: "导出清单",
        cover: "字幕封面",
        subtitles: "生成字幕",
        publish: "导出"
      }
    },
    settings: {
      eyebrow: "配置中心",
      title: "模型与输出设置",
      description: "当前主要展示配置入口，后续会接入加密持久化、Provider 路由和真实模型参数。",
      mockConfig: "Fallback 配置",
      placeholder: "占位",
      sections: {
        apiKeys: "API Keys",
        localModels: "本地模型",
        defaultInference: "默认推理",
        tts: "TTS",
        videoOutput: "视频输出"
      }
    }
  },
  en: {
    nav: {
      dashboard: "Dashboard",
      studio: "Studio",
      settings: "Settings",
      runtime: "Runtime",
      mockMode: "Fallback Mode",
      active: "ACTIVE",
      pipelineStudio: "Voiceover Studio",
      language: "Language"
    },
    dashboard: {
      eyebrow: "AI Runtime Control Plane",
      title: "DevShorts Voice Runtime",
      description: "Live control console for short-video voiceover generation: ASR, LLM script rewrite, FishSpeech/edge-tts voice synthesis, subtitles, and final.mp4 rendering.",
      aiStudio: "AI Studio",
      online: "ONLINE",
      runningTasks: "Running Tasks",
      gpuUsage: "GPU Usage",
      tokenRate: "Token/s",
      activeModels: "Active Models",
      monitor: "Live System Monitor",
      refresh: "refresh 2s",
      vram: "VRAM Usage",
      latency: "Inference Latency",
      queue: "Queue Size",
      modelMesh: "Active Model Mesh",
      running: "RUNNING",
      recentJobs: "Recent Production Jobs",
      memoryStore: "memory task store",
      progress: "progress",
      completed: "Completed",
      noTasks: "No tasks yet. Create a voiceover generation task in Studio.",
      sourcePending: "source pending",
      semiReal: "Local",
      mock: "Fallback"
    },
    studio: {
      eyebrow: "Autonomous Workflow Studio",
      title: "AI Video Pipeline Runtime",
      description: "Generate short-video voiceover scripts, FishSpeech/edge-tts audio, subtitles, and final.mp4 from video URLs, local files, topics, target styles, and speaking styles.",
      mockDemo: "Fallback Run",
      semiReal: "Local Voiceover",
      videoUrl: "Video URL",
      localFilePath: "Local File Path",
      topic: "Topic",
      targetStyle: "Target Style",
      speakingStyle: "Speaking Style",
      tech: "Tech",
      oral: "Oral",
      viral: "Viral",
      createMock: "Create Fallback Task",
      runSemiReal: "Generate Voiceover Video",
      timeline: "Voiceover Generation Timeline",
      nodeConfig: "Node Config",
      adapterOnline: "adapter online",
      waitingArtifact: "waiting for upstream artifact",
      streamAttached: "execution stream attached",
      artifacts: "Completion Artifacts",
      outputReady: "output ready",
      waitingCompletion: "waiting for task completion",
      transcript: "Transcript",
      rewrittenScript: "Rewritten Script",
      subtitlesPath: "Subtitles Path",
      finalVideo: "final.mp4 Preview / Download",
      pendingArtifact: "Pending artifact",
      preview: "Preview",
      console: "AI Runtime Console",
      demoStream: "fallback stream",
      backendLogs: "backend logs",
      statusMode: {
        mock: "Fallback Run",
        semi_real: "Local Voiceover"
      },
      steps: {
        prepare: "Prepare Video",
        inputVideo: "Input Video",
        audio: "Extract Audio",
        asr: "ASR Transcript",
        transcript: "Transcript",
        extract: "Extract Script",
        rewrite: "Rewrite",
        rewrittenScript: "Rewritten Script",
        tts: "TTS",
        voice: "Voice",
        "digital-human": "Reserved Step",
        render: "Render",
        finalVideo: "Final Video",
        titleCover: "Title & Cover",
        publishDraft: "Export Manifest",
        cover: "Subtitle",
        subtitles: "Generate Subtitles",
        publish: "Export"
      }
    },
    settings: {
      eyebrow: "Configuration",
      title: "Model & Output Settings",
      description: "Configuration controls are visible now. Future versions will add encrypted persistence, provider routing, and real model parameters.",
      mockConfig: "fallback config",
      placeholder: "placeholder",
      sections: {
        apiKeys: "API Keys",
        localModels: "Local Models",
        defaultInference: "Default Inference",
        tts: "TTS",
        videoOutput: "Video Output"
      }
    }
  }
} as const;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (typeof messages)[Locale];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh");

  useEffect(() => {
    const stored = window.localStorage.getItem("devshorts-locale");
    if (stored === "zh" || stored === "en") setLocaleState(stored);
  }, []);

  function setLocale(nextLocale: Locale) {
    setLocaleState(nextLocale);
    window.localStorage.setItem("devshorts-locale", nextLocale);
  }

  const value = useMemo(() => ({ locale, setLocale, t: messages[locale] }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside I18nProvider");
  return context;
}
