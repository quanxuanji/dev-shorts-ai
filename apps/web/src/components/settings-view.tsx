"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { KeyRound, Library, MonitorCog, Save, SlidersHorizontal, Star, Video, Volume2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createVoice, getRuntimeSettings, getVoiceLibrary, setDefaultVoice, updateRuntimeSettings } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { RuntimeSettings, VoiceLibraryResponse } from "@/lib/types";

const providerOptions = {
  llm_provider: ["mock", "openai", "openai_compatible", "ollama"],
  asr_provider: ["mock", "whisper_cli", "faster_whisper"],
  tts_provider: ["mock", "edge_tts", "fishspeech"],
  fishspeech_use_memory_cache: ["auto", "on", "off"]
} as const;

const fallbackSettings: RuntimeSettings = {
  llm_provider: "mock",
  openai_api_key: "",
  openai_base_url: "https://api.openai.com/v1",
  openai_model: "gpt-4o-mini",
  openai_timeout_seconds: 180,
  ollama_base_url: "http://localhost:11434",
  ollama_model: "qwen2.5:7b",
  asr_provider: "mock",
  whisper_model: "base",
  whisper_language: "auto",
  tts_provider: "edge_tts",
  edge_tts_voice: "en-US-AriaNeural",
  fishspeech_base_url: "http://127.0.0.1:8080/v1/tts",
  fishspeech_api_key: "",
  fishspeech_voice: "default",
  fishspeech_reference_audio_path: "",
  fishspeech_reference_text: "",
  fishspeech_reference_text_path: "",
  fishspeech_use_memory_cache: "auto",
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
  const [voiceLibrary, setVoiceLibrary] = useState<VoiceLibraryResponse>({ voices: [], default_voice_id: null });
  const [voiceForm, setVoiceForm] = useState({
    voice_id: "weekly-host",
    name: "Weekly Host",
    reference_audio_path: "",
    reference_text: "",
    make_default: true
  });
  const [voiceState, setVoiceState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [voiceError, setVoiceError] = useState("");

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

  useEffect(() => {
    void loadVoiceLibrary();
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

  async function loadVoiceLibrary() {
    try {
      const library = await getVoiceLibrary();
      setVoiceLibrary(library);
    } catch {
      setVoiceLibrary({ voices: [], default_voice_id: null });
    }
  }

  async function handleCreateVoice() {
    setVoiceState("saving");
    setVoiceError("");
    try {
      await createVoice(voiceForm);
      const [library, settings] = await Promise.all([getVoiceLibrary(), getRuntimeSettings()]);
      setVoiceLibrary(library);
      setForm(settings);
      setVoiceState("saved");
    } catch (error) {
      setVoiceState("error");
      setVoiceError(error instanceof Error ? error.message : "save voice failed");
    }
  }

  async function handleSetDefaultVoice(voiceId: string) {
    setVoiceState("saving");
    setVoiceError("");
    try {
      const library = await setDefaultVoice(voiceId);
      const settings = await getRuntimeSettings();
      setVoiceLibrary(library);
      setForm(settings);
      setVoiceState("saved");
    } catch (error) {
      setVoiceState("error");
      setVoiceError(error instanceof Error ? error.message : "set default voice failed");
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
            <TextField
              label="OpenAI Timeout Seconds"
              value={String(form.openai_timeout_seconds)}
              onChange={(value) => updateField("openai_timeout_seconds", Number(value) || 180)}
            />
          </SettingsCard>

          <SettingsCard title={t.settings.sections.localModels} icon={MonitorCog} note="Local model endpoints and ASR runtime options.">
            <TextField label="Ollama Base URL" value={form.ollama_base_url} onChange={(value) => updateField("ollama_base_url", value)} />
            <TextField label="Ollama Model" value={form.ollama_model} onChange={(value) => updateField("ollama_model", value)} />
            <TextField label="Whisper Model" value={form.whisper_model} onChange={(value) => updateField("whisper_model", value)} />
            <TextField label="Whisper Language" value={form.whisper_language} onChange={(value) => updateField("whisper_language", value)} />
          </SettingsCard>

          <SettingsCard title={t.settings.sections.tts} icon={Volume2} note="Use FishSpeech Voice as reference_id, or provide reference audio + exact text to lock one narrator.">
            <TextField label="Edge TTS Voice" value={form.edge_tts_voice} onChange={(value) => updateField("edge_tts_voice", value)} />
            <TextField label="FishSpeech Base URL" value={form.fishspeech_base_url} onChange={(value) => updateField("fishspeech_base_url", value)} />
            <TextField label="FishSpeech API Key" value={form.fishspeech_api_key} type="password" onChange={(value) => updateField("fishspeech_api_key", value)} />
            <TextField label="FishSpeech Voice / Reference ID" value={form.fishspeech_voice} onChange={(value) => updateField("fishspeech_voice", value)} />
            <TextField
              label="FishSpeech Reference Audio Path"
              value={form.fishspeech_reference_audio_path}
              onChange={(value) => updateField("fishspeech_reference_audio_path", value)}
            />
            <TextField
              label="FishSpeech Reference Text"
              value={form.fishspeech_reference_text}
              onChange={(value) => updateField("fishspeech_reference_text", value)}
            />
            <TextField
              label="FishSpeech Reference Text Path"
              value={form.fishspeech_reference_text_path}
              onChange={(value) => updateField("fishspeech_reference_text_path", value)}
            />
            <SelectField
              label="FishSpeech Memory Cache"
              value={form.fishspeech_use_memory_cache}
              options={providerOptions.fishspeech_use_memory_cache}
              onChange={(value) => updateField("fishspeech_use_memory_cache", value)}
            />
            <TextField
              label="FishSpeech Timeout Seconds"
              value={String(form.fishspeech_timeout_seconds)}
              onChange={(value) => updateField("fishspeech_timeout_seconds", Number(value) || 180)}
            />
          </SettingsCard>

          <SettingsCard title="Voice Library" icon={Library} note="Save liked FishSpeech voices as reusable reference_id presets.">
            <TextField
              label="Voice ID"
              value={voiceForm.voice_id}
              onChange={(value) => setVoiceForm((current) => ({ ...current, voice_id: value }))}
            />
            <TextField
              label="Display Name"
              value={voiceForm.name}
              onChange={(value) => setVoiceForm((current) => ({ ...current, name: value }))}
            />
            <TextField
              label="Reference Audio Path"
              value={voiceForm.reference_audio_path}
              onChange={(value) => setVoiceForm((current) => ({ ...current, reference_audio_path: value }))}
            />
            <TextField
              label="Reference Text"
              value={voiceForm.reference_text}
              onChange={(value) => setVoiceForm((current) => ({ ...current, reference_text: value }))}
            />
            <label className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={voiceForm.make_default}
                onChange={(event) => setVoiceForm((current) => ({ ...current, make_default: event.target.checked }))}
              />
              Set as default FishSpeech voice
            </label>
            <div className="flex items-center gap-3">
              <Button onClick={handleCreateVoice} disabled={voiceState === "saving" || !voiceForm.reference_audio_path || !voiceForm.reference_text}>
                <Save className="mr-2 h-4 w-4" />
                {voiceState === "saving" ? "Saving" : "Save Voice"}
              </Button>
              <span className="font-mono text-xs text-slate-500">
                {voiceState === "saved" ? "voice saved" : voiceState === "error" ? voiceError : `${voiceLibrary.voices.length} voices`}
              </span>
            </div>
            <div className="md:col-span-2">
              <VoiceList library={voiceLibrary} onSetDefault={handleSetDefaultVoice} />
            </div>
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

function VoiceList({
  library,
  onSetDefault
}: {
  library: VoiceLibraryResponse;
  onSetDefault: (voiceId: string) => void;
}) {
  if (!library.voices.length) {
    return (
      <div className="rounded-md border border-dashed border-white/10 bg-slate-950/35 p-4 text-sm text-slate-500">
        还没有保存音色。把喜欢的生成音频路径填进 Reference Audio Path，再配上准确口播文本，就能沉淀成可复用 voice_id。
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {library.voices.map((voice) => (
        <div key={voice.id} className="rounded-md border border-white/10 bg-slate-950/45 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                {voice.name}
                {voice.is_default ? <span className="rounded-full bg-violet-400/15 px-2 py-0.5 text-[11px] text-violet-100">Default</span> : null}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-500">{voice.id}</div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onSetDefault(voice.id)}
              disabled={voice.is_default}
            >
              <Star className="mr-2 h-3.5 w-3.5" />
              Use Voice
            </Button>
          </div>
          <div className="mt-3 grid gap-1 text-xs text-slate-500">
            <span className="truncate">audio: {voice.reference_audio_path}</span>
            <span className="truncate">text: {voice.reference_text}</span>
          </div>
        </div>
      ))}
    </div>
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
