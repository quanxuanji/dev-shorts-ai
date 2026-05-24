import { FileText, Play, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";

import type { StudioLayoutProps, StudioSceneView } from "./studio-types";

export function ScriptEditor({ props, scenes }: { props: StudioLayoutProps; scenes: StudioSceneView[] }) {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  return (
    <section className="studio-panel-primary rounded-[24px] border p-4 min-[2200px]:rounded-[28px] min-[2200px]:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="studio-section-title flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-[#5DE2FF]" />
          {isZh ? "口播脚本" : "Script Editor"}
        </h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={props.onRegenerate} disabled={props.isCreating || !props.canRun} className="h-9 rounded-full border-[#23252B] bg-[#15171A] text-[#D6D8DE] hover:bg-white/[0.08]">
            <Sparkles className="mr-2 h-4 w-4" />
            {isZh ? "重新生成" : "Regenerate"}
          </Button>
          <Button onClick={props.onRender} disabled={props.isCreating || !props.canRun} className="h-9 rounded-full bg-[#7C5CFF] text-white shadow-[0_0_28px_rgba(124,92,255,0.28)] hover:bg-[#8A70FF] hover:shadow-[0_0_32px_rgba(93,226,255,0.2)]">
            <Play className="mr-2 h-4 w-4" />
            {isZh ? "渲染" : "Render"}
          </Button>
        </div>
      </div>

      {scenes.length ? (
        <div className="mb-3 grid gap-3 min-[2200px]:mb-4 min-[2200px]:gap-4 xl:grid-cols-2">
          {scenes.slice(0, 4).map((scene) => (
            <div key={`${scene.sceneIndex}-${scene.title}`} className="studio-hover-item rounded-2xl border border-white/[0.12] bg-[#0B0B0C]/48 p-3 shadow-[0_0_22px_rgba(93,226,255,0.035)] min-[2200px]:p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-lg bg-[#F5F5F7] px-2 py-1 text-xs font-bold text-[#0B0B0C]">#{scene.rank}</span>
                <strong className="truncate text-sm text-[#F5F5F7]">{scene.title}</strong>
              </div>
              <p className="line-clamp-2 text-sm leading-6 text-[#B8BCC6]">{scene.narration || scene.summary}</p>
            </div>
          ))}
        </div>
      ) : null}

      <Textarea
        value={props.voiceScript}
        onChange={(event) => props.setVoiceScript(event.target.value)}
        placeholder={isZh ? "生成后的口播稿会出现在这里。也可以先手写脚本，再提交生成配音和视频。" : "Generated narration will appear here. You can also write a script first, then render voice and video."}
        className="min-h-[190px] resize-none rounded-3xl border border-white/[0.12] !bg-[#05070D]/70 p-4 text-sm leading-7 text-[#F5F5F7] shadow-[inset_0_0_34px_rgba(124,92,255,0.045)] placeholder:text-[#555B66] focus:border-[#7C5CFF]/45 focus:ring-0 min-[2200px]:min-h-[250px] min-[2200px]:p-5 min-[2200px]:text-base min-[2200px]:leading-8"
      />
    </section>
  );
}
