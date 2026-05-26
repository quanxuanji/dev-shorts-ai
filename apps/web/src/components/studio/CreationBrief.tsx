import { FolderInput, Link2, Loader2, RadioTower, SlidersHorizontal, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { StudioLayoutProps } from "./studio-types";

export function CreationBrief({ props }: { props: StudioLayoutProps }) {
  const { locale } = useI18n();
  const isZh = locale === "zh";
  const isSubmittingOrGeneratingScript = props.isCreating || props.isScriptGenerating;
  const createLabel = props.isCreating
    ? isZh
      ? "创建任务中..."
      : "Creating task..."
    : props.isScriptGenerating
      ? isZh
        ? "生成口播中..."
        : "Generating script..."
      : isZh
        ? "生成视频"
        : "Create Video";
  const currentResolution = props.settings?.video_resolution ?? props.studioRuntime?.output_ratio ?? "1080x1920";
  const ratioOptions = [
    { label: "9:16 竖屏", value: "1080x1920", available: true },
    { label: "1:1 方屏", value: "1080x1080", available: false },
    { label: "16:9 横屏", value: "1920x1080", available: false },
  ];

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
        <SoftField
          icon={Link2}
          label={isZh ? "参考链接" : "Reference URL"}
          badge={isZh ? "待开发" : "Planned"}
          note={isZh ? "暂不支持解析普通网页链接；当前仅保留视频直链调试入口。" : "Generic webpage parsing is not wired yet; video direct links are dev-only."}
          value={props.form.sourceUrl}
          placeholder="https://..."
          onChange={(value) => props.setForm((current) => ({ ...current, sourceUrl: value }))}
        />
        <SoftField
          icon={FolderInput}
          label={isZh ? "本地视频" : "Local Video"}
          badge={isZh ? "待开发" : "Planned"}
          note={isZh ? "暂未做浏览器上传；当前只支持后端机器可访问的本机路径。" : "Browser upload is not wired yet; backend-local paths are dev-only."}
          value={props.form.localFilePath}
          placeholder="/Users/me/video.mp4"
          onChange={(value) => props.setForm((current) => ({ ...current, localFilePath: value }))}
        />
      </div>

      <div className="mt-3 grid gap-3 min-[2200px]:mt-4 min-[2200px]:gap-4 2xl:grid-cols-2">
        <InfoCard
          icon={RadioTower}
          label={isZh ? "目标平台" : "Target Platform"}
          value={isZh ? "抖音 / 小红书" : "Douyin / Xiaohongshu"}
          badge={isZh ? "待开发" : "Planned"}
          note={isZh ? "暂未影响脚本、尺寸或发布配置。" : "Not wired into script, layout, or publish settings yet."}
        />
        <OutputRatioCard icon={SlidersHorizontal} label={isZh ? "输出比例" : "Output Ratio"} options={ratioOptions} currentResolution={currentResolution} />
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
        <Button onClick={props.onCreate} disabled={isSubmittingOrGeneratingScript || !props.canRun} className="h-11 rounded-full bg-[#F5F5F7] px-5 text-[#0B0B0C] shadow-[0_0_30px_rgba(124,92,255,0.18)] hover:bg-white hover:shadow-[0_0_34px_rgba(93,226,255,0.18)]">
          {isSubmittingOrGeneratingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {createLabel}
        </Button>
        {props.createError ? <span className="text-sm text-red-300">{props.createError}</span> : <span className="text-sm text-[#777D89]">{isZh ? "不会调用 fake pipeline，提交真实任务后读取 artifacts。" : "No fake pipeline. Submit a real task, then read generated artifacts."}</span>}
      </div>
    </section>
  );
}

function SoftField({
  icon: Icon,
  label,
  badge,
  note,
  value,
  placeholder,
  onChange,
}: {
  icon: typeof Link2;
  label: string;
  badge?: string;
  note?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/55 p-3 min-[2200px]:p-4">
      <span className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#777D89]">
        <Icon className="h-4 w-4 text-[#5DE2FF]" />
        {label}
        {badge ? <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] tracking-normal text-amber-100">{badge}</span> : null}
      </span>
      <Input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="mt-2 h-8 border-0 bg-transparent px-0 text-sm text-[#F5F5F7] shadow-none placeholder:text-[#555B66] focus:ring-0" />
      {note ? <p className="mt-2 text-xs leading-5 text-[#777D89]">{note}</p> : null}
    </label>
  );
}

function InfoCard({ icon: Icon, label, value, badge, note }: { icon: typeof RadioTower; label: string; value: string; badge: string; note: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/55 p-3 min-[2200px]:p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#777D89]">
        <Icon className="h-4 w-4 text-[#5DE2FF]" />
        {label}
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[10px] tracking-normal text-amber-100">{badge}</span>
      </div>
      <div className="mt-3 text-lg font-semibold text-[#F5F5F7]">{value}</div>
      <p className="mt-2 text-xs leading-5 text-[#777D89]">{note}</p>
    </div>
  );
}

function OutputRatioCard({
  icon: Icon,
  label,
  options,
  currentResolution,
}: {
  icon: typeof SlidersHorizontal;
  label: string;
  options: Array<{ label: string; value: string; available: boolean }>;
  currentResolution: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0B0B0C]/55 p-3 min-[2200px]:p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#777D89]">
        <Icon className="h-4 w-4 text-[#5DE2FF]" />
        {label}
      </div>
      <div className="mt-3 grid gap-2">
        {options.map((option) => {
          const active = option.value === currentResolution;
          return (
            <button
              key={option.value}
              type="button"
              disabled={!option.available}
              title={option.available ? "当前支持" : "待开发：Remotion 目前固定 1080x1920"}
              className={cn(
                "flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition",
                active ? "border-[#5DE2FF]/35 bg-[#5DE2FF]/10 text-[#F5F5F7]" : "border-white/[0.08] bg-[#050506]/40 text-[#9EA3AE]",
                !option.available && "cursor-not-allowed opacity-55"
              )}
            >
              <span>{option.label}</span>
              <span className="text-xs text-[#777D89]">{option.available ? option.value : "待开发"}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs leading-5 text-[#777D89]">当前 Remotion 只按 1080x1920 竖屏渲染，其它比例需要改 Composition 尺寸和后端兜底渲染。</p>
    </div>
  );
}
