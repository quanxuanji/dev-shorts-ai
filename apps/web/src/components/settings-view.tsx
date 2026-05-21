"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { KeyRound, MonitorCog, Save, SlidersHorizontal, Video, Volume2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getRuntimeSettings, updateRuntimeSettings } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { RuntimeSettings } from "@/lib/types";

const providerOptions = {
  llm_provider: ["mock", "openai", "openai_compatible", "ollama"],
  asr_provider: ["mock", "whisper_cli", "faster_whisper"],
  tts_provider: ["mock", "edge_tts", "fishspeech"]
} as const;

const fallbackSettings: RuntimeSettings = {
  llm_provider: "mock",
  openai_api_key: "",
  openai_base_url: "https://api.openai.com/v1",
  openai_model: "gpt-4o-mini",
  ollama_base_url: "http://localhost:11434",
  ollama_model: "qwen2.5:7b",
  asr_provider: "mock",
  whisper_model: "base",
  whisper_language: "auto",
  tts_provider: "edge_tts",
  edge_tts_voice: "en-US-AriaNeural",
  fishspeech_base_url: "http://127.0.0.1:7860/v1/audio/speech",
  fishspeech_api_key: "",
  fishspeech_voice: "default",
  fishspeech_timeout_seconds: 180,
  video_resolution: "1080x1920",
  subtitle_style: "FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00101018,BorderStyle=1,Outline=2,Shadow=0"
};

export function SettingsView() {
  const { t } = useI18n();
  const [form, setForm] = useState<RuntimeSettings>(fallbackSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const settings = await getRuntimeSettings();
        if (isMounted) setForm(settings);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  function updateField<K extends keyof RuntimeSettings>(key: K, value: RuntimeSettings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveState("idle");
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveState("idle");
    try {
      const saved = await updateRuntimeSettings(form);
      setForm(saved);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell active="/settings">
      <div className="space-y-5">
        <header className="rounded-lg border border-white/10 bg-slate-950/55 p-5 shadow-violet backdrop-blur-xl">
          <div className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-200">{t.settings.eyebrow}</div>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-50 md:text-4xl">{t.settings.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                运行时配置会保存到 API 本地文件，新的 semi-real 任务会立即读取这些 Provider 设置。
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-slate-500">
                {isLoading ? "loading config" : saveState === "saved" ? "saved" : saveState === "error" ? "save failed" : "runtime editable"}
              </span>
              <Button onClick={handleSave} disabled={isSaving || isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving" : "Save Config"}
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-2">
          <SettingsCard title="Provider Routing" icon={SlidersHorizontal} note="Controls which adapter the next task uses.">
            <SelectField
              label="LLM Provider"
              value={form.llm_provider}
              options={providerOptions.llm_provider}
              onChange={(value) => updateField("llm_provider", value)}
            />
            <SelectField
              label="ASR Provider"
              value={form.asr_provider}
              options={providerOptions.asr_provider}
              onChange={(value) => updateField("asr_provider", value)}
            />
            <SelectField
              label="TTS Provider"
              value={form.tts_provider}
              options={providerOptions.tts_provider}
              onChange={(value) => updateField("tts_provider", value)}
            />
          </SettingsCard>

          <SettingsCard title={t.settings.sections.apiKeys} icon={KeyRound} note="Plain local MVP storage. Do not commit secrets.">
            <TextField label="OpenAI API Key" value={form.openai_api_key} type="password" onChange={(value) => updateField("openai_api_key", value)} />
            <TextField label="OpenAI Base URL" value={form.openai_base_url} onChange={(value) => updateField("openai_base_url", value)} />
            <TextField label="OpenAI Model" value={form.openai_model} onChange={(value) => updateField("openai_model", value)} />
          </SettingsCard>

          <SettingsCard title={t.settings.sections.localModels} icon={MonitorCog} note="Local model endpoints and ASR runtime options.">
            <TextField label="Ollama Base URL" value={form.ollama_base_url} onChange={(value) => updateField("ollama_base_url", value)} />
            <TextField label="Ollama Model" value={form.ollama_model} onChange={(value) => updateField("ollama_model", value)} />
            <TextField label="Whisper Model" value={form.whisper_model} onChange={(value) => updateField("whisper_model", value)} />
            <TextField label="Whisper Language" value={form.whisper_language} onChange={(value) => updateField("whisper_language", value)} />
          </SettingsCard>

          <SettingsCard title={t.settings.sections.tts} icon={Volume2} note="edge-tts works now; FishSpeech expects a compatible HTTP service.">
            <TextField label="Edge TTS Voice" value={form.edge_tts_voice} onChange={(value) => updateField("edge_tts_voice", value)} />
            <TextField label="FishSpeech Base URL" value={form.fishspeech_base_url} onChange={(value) => updateField("fishspeech_base_url", value)} />
            <TextField label="FishSpeech API Key" value={form.fishspeech_api_key} type="password" onChange={(value) => updateField("fishspeech_api_key", value)} />
            <TextField label="FishSpeech Voice" value={form.fishspeech_voice} onChange={(value) => updateField("fishspeech_voice", value)} />
            <TextField
              label="FishSpeech Timeout Seconds"
              value={String(form.fishspeech_timeout_seconds)}
              onChange={(value) => updateField("fishspeech_timeout_seconds", Number(value) || 180)}
            />
          </SettingsCard>

          <SettingsCard title={t.settings.sections.videoOutput} icon={Video} note="Subtitle style is passed to ffmpeg force_style.">
            <TextField label="Video Resolution" value={form.video_resolution} onChange={(value) => updateField("video_resolution", value)} />
            <TextField label="Subtitle Style" value={form.subtitle_style} onChange={(value) => updateField("subtitle_style", value)} />
          </SettingsCard>
        </div>
      </div>
    </AppShell>
  );
}

function SettingsCard({
  title,
  icon: Icon,
  note,
  children
}: {
  title: string;
  icon: LucideIcon;
  note: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-violet-200" />
          {title}
        </CardTitle>
        <span className="font-mono text-xs text-slate-500">{note}</span>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">{children}</CardContent>
    </Card>
  );
}

function TextField({
  label,
  value,
  type = "text",
  onChange
}: {
  label: string;
  value: string;
  type?: "text" | "password";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <Input value={value} type={type} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 w-full rounded-md border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
