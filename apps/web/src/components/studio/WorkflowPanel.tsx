import { CheckCircle2, ChevronRight, Circle, Loader2, XCircle } from "lucide-react";

import type { StepStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WorkflowItem = {
  id: string;
  title: string;
  detail: string;
  status: StepStatus;
};

export function WorkflowPanel({ items, activeId, onSelect }: { items: WorkflowItem[]; activeId?: string; onSelect?: (id: string) => void }) {
  return (
    <section className="studio-panel-tertiary rounded-[22px] border p-3 min-[2200px]:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#F5F5F7]">Workflow</h2>
        <span className="text-xs text-[#777D89]">{items.length} tasks</span>
      </div>
      <div className="space-y-1.5 min-[2200px]:space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            className={cn(
              "studio-hover-item flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition min-[2200px]:py-2.5",
              (item.status === "success" || activeId === item.id) && "studio-active-item border-white/[0.14] bg-white/[0.035]",
              item.status === "running" && "studio-active-item border-[#7C5CFF]/35 bg-[#7C5CFF]/10",
              item.status === "error" && "border-red-400/30 bg-red-500/10",
              item.status === "pending" && "border-white/[0.06] bg-[#0B0B0C]/45"
            )}
          >
            <StatusIcon status={item.status} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-[#F5F5F7]">{item.title}</div>
              <div className="mt-0.5 truncate text-xs text-[#777D89]">{item.detail}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-[#555B66]" />
          </button>
        ))}
      </div>
    </section>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4 text-[#5DE2FF]" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-[#7C5CFF]" />;
  if (status === "error") return <XCircle className="h-4 w-4 text-red-300" />;
  return <Circle className="h-4 w-4 text-[#555B66]" />;
}
