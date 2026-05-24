import { AudioLines, Mic2 } from "lucide-react";

import { useI18n } from "@/lib/i18n";

import type { StudioLayoutProps, StudioSceneView } from "./studio-types";

export function VoiceConfigPanel({ props, scenes }: { props: StudioLayoutProps; scenes: StudioSceneView[] }) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const voiceReady = props.artifacts.audio.kind === "real" || props.studioRuntime?.assets.some((asset) => asset.name === "voice.wav" && asset.exists);
  const sceneWavs = props.studioRuntime?.assets.filter((asset) => /^scene-\d+\.wav$/.test(asset.name)) ?? [];

  return (
    <section className="studio-panel-secondary rounded-[24px] border p-4 min-[2200px]:rounded-[28px] min-[2200px]:p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Mic2 className="h-4 w-4 text-[#5DE2FF]" />
          {isZh ? "配音配置" : "Voice Config"}
        </h2>
        <span className="text-xs text-[#777D89]">{voiceReady ? "voice.wav ready" : isZh ? "等待配音" : "waiting for voice"}</span>
      </div>
      <div className="grid gap-3 min-[2200px]:gap-4 xl:grid-cols-3">
        <Info label={isZh ? "服务商" : "provider"} value={props.settings?.tts_provider ?? String(props.studioRuntime?.provider?.tts_provider ?? "pending")} />
        <Info label={isZh ? "音色预设" : "voice preset"} value={props.settings?.fishspeech_voice || String(props.studioRuntime?.provider?.voice_id ?? "default")} />
        <Info label={isZh ? "模式" : "mode"} value="segmented TTS" />
        <Info label={isZh ? "静音间隔" : "silence gap"} value="0.5s" />
        <Info label={isZh ? "输出" : "output"} value={voiceReady ? "voice.wav" : "pending"} />
        <Info label={isZh ? "参考音频" : "reference"} value={props.settings?.fishspeech_reference_audio_path || (isZh ? "默认参考" : "default reference")} />
      </div>
      {props.providerWarning ? <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">{props.providerWarning}</div> : null}
      <Waveform peaks={props.studioRuntime?.waveform?.peaks ?? []} />
      <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/55 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <AudioLines className="h-4 w-4 text-[#5DE2FF]" />
          {isZh ? "分段 TTS 队列" : "Segmented TTS Queue"}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(sceneWavs.length ? sceneWavs : scenes.slice(0, 8)).map((item, index) => {
            const name = "name" in item ? item.name : `scene-${index}.wav`;
            const detail = "detail" in item ? item.detail : item.duration;
            const ready = "exists" in item ? item.exists : false;
            return (
              <div key={name} className="rounded-xl border border-white/[0.08] bg-[#15171A]/70 p-3">
                <div className="font-mono text-xs text-[#D6D8DE]">{name}</div>
                <div className="mt-2 text-xs text-[#777D89]">{ready ? "ready" : detail}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0B0B0C]/55 p-3 min-[2200px]:p-4">
      <div className="text-xs text-[#777D89]">{label}</div>
      <div className="mt-2 truncate font-mono text-sm font-semibold text-[#F5F5F7]">{value || "pending"}</div>
    </div>
  );
}

function Waveform({ peaks }: { peaks: number[] }) {
  const normalized = peaks.slice(0, 96);

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#05070d]/45 p-3 shadow-[inset_0_0_30px_rgba(93,226,255,0.035)] min-[2200px]:mt-4 min-[2200px]:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-[#F5F5F7]">Voice Waveform</div>
        <div className="font-mono text-xs text-[#777D89]">{peaks.length ? "voice.wav" : "waiting"}</div>
      </div>
      <div className="flex h-20 items-center gap-1 overflow-hidden min-[2200px]:h-24">
        {normalized.length ? (
          normalized.map((peak, index) => (
            <span
              key={`${index}-${peak}`}
              className="studio-waveform-bar w-1.5 shrink-0 rounded-full opacity-90"
              style={{ height: `${Math.round(Math.max(14, Math.min(88, peak * 88)))}px` }}
            />
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-white/[0.12] bg-white/[0.025] text-xs text-[#777D89]">
            Waiting for real voice.wav peaks
          </div>
        )}
      </div>
    </div>
  );
}
