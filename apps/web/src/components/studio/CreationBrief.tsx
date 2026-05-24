import { FolderInput, Link2, RadioTower, SlidersHorizontal, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { StudioLayoutProps } from "./studio-types";

export function CreationBrief({ props }: { props: StudioLayoutProps }) {
  const { locale } = useI18n();
  const isZh = locale === "zh";

  return (
    <section className="studio-panel-primary rounded-[24px] border p-4 min-[2200px]:rounded-[28px] min-[2200px]:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Sparkles className="h-4 w-4 text-[#5DE2FF]" />
          {isZh ? "创作简报" : "Creation Brief"}
        </h2>
        <span className="text-xs text-[#777D89]">{isZh ? "真实输入 / 可编辑" : "real input / editable"}</span>
      </div>

      <label className="block rounded-3xl border border-white/[0.14] bg-[#181426]/64 p-4 shadow-[inset_0_0_30px_rgba(124,92,255,0.06)] min-[2200px]:p-5">
        <span className="text-xs uppercase tracking-[0.18em] text-[#9EA3AE]">{isZh ? "选题" : "Topic"}</span>
        <Textarea
          value={props.form.topic}
          onChange={(event) => props.setForm((current) => ({ ...current, topic: event.target.value }))}
          placeholder={isZh ? "输入一个选题，比如：本周 GitHub 最值得关注的 8 个 AI 项目" : "Enter a topic, e.g. 8 AI projects worth watching on GitHub this week"}
          className="mt-3 min-h-20 resize-none border-0 bg-transparent p-0 text-xl font-semibold leading-snug text-[#F5F5F7] shadow-none placeholder:text-[#555B66] focus:ring-0 min-[2200px]:min-h-24 min-[2200px]:text-2xl"
        />
      </label>

      <div className="mt-3 grid gap-3 min-[2200px]:mt-4 min-[2200px]:gap-4 2xl:grid-cols-2">
        <SoftField icon={Link2} label={isZh ? "参考链接" : "Reference URL"} value={props.form.sourceUrl} placeholder="https://..." onChange={(value) => props.setForm((current) => ({ ...current, sourceUrl: value }))} />
        <SoftField icon={FolderInput} label={isZh ? "本地视频" : "Local Video"} value={props.form.localFilePath} placeholder="/Users/me/video.mp4" onChange={(value) => props.setForm((current) => ({ ...current, localFilePath: value }))} />
      </div>

      <div className="mt-3 grid gap-3 min-[2200px]:mt-4 min-[2200px]:gap-4 2xl:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/55 p-3 min-[2200px]:p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#777D89]">
            <RadioTower className="h-4 w-4 text-[#5DE2FF]" />
            {isZh ? "目标平台" : "Target Platform"}
          </div>
          <div className="mt-3 text-lg font-semibold text-[#F5F5F7]">{isZh ? "抖音 / 小红书" : "Douyin / Xiaohongshu"}</div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/55 p-3 min-[2200px]:p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#777D89]">
            <SlidersHorizontal className="h-4 w-4 text-[#5DE2FF]" />
            {isZh ? "输出比例" : "Output Ratio"}
          </div>
          <div className="mt-3 text-lg font-semibold text-[#F5F5F7]">{props.settings?.video_resolution ?? props.studioRuntime?.output_ratio ?? "1080x1920"}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {props.styleChips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => props.onApplyStyleChip(chip)}
            className={cn(
              "rounded-full border px-3 py-2 text-xs text-[#9EA3AE] transition hover:border-white/[0.16] hover:bg-white/[0.06] hover:text-[#F5F5F7]",
              props.form.targetStyle === chip.prompt && "border-[#7C5CFF]/40 bg-[#7C5CFF]/12 text-[#F5F5F7]"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <label className="mt-3 block rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/55 p-3 min-[2200px]:mt-4 min-[2200px]:p-4">
        <span className="text-xs uppercase tracking-[0.14em] text-[#777D89]">{isZh ? "内容方向" : "Direction"}</span>
        <Textarea
          value={props.form.targetStyle}
          onChange={(event) => props.setForm((current) => ({ ...current, targetStyle: event.target.value }))}
          className="mt-2 min-h-16 resize-none border-0 bg-transparent p-0 text-sm leading-6 text-[#D6D8DE] shadow-none placeholder:text-[#555B66] focus:ring-0 min-[2200px]:min-h-20"
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-3 min-[2200px]:mt-4">
        <Button onClick={props.onCreate} disabled={props.isCreating || !props.canRun} className="h-11 rounded-full bg-[#F5F5F7] px-5 text-[#0B0B0C] shadow-[0_0_30px_rgba(124,92,255,0.18)] hover:bg-white hover:shadow-[0_0_34px_rgba(93,226,255,0.18)]">
          {props.isCreating ? (isZh ? "创建中..." : "Creating...") : isZh ? "生成视频" : "Create Video"}
        </Button>
        {props.createError ? <span className="text-sm text-red-300">{props.createError}</span> : <span className="text-sm text-[#777D89]">{isZh ? "不会调用 fake pipeline，提交真实任务后读取 artifacts。" : "No fake pipeline. Submit a real task, then read generated artifacts."}</span>}
      </div>
    </section>
  );
}

function SoftField({ icon: Icon, label, value, placeholder, onChange }: { icon: typeof Link2; label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/55 p-3 min-[2200px]:p-4">
      <span className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#777D89]">
        <Icon className="h-4 w-4 text-[#5DE2FF]" />
        {label}
      </span>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 h-8 border-0 bg-transparent px-0 text-sm text-[#F5F5F7] shadow-none placeholder:text-[#555B66] focus:ring-0" />
    </label>
  );
}
