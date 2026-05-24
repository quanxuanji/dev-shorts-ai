import { RefreshCw, Video } from "lucide-react";

import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

function taskTitle(task: Task) {
  return task.topic || task.title || `Task ${task.id.slice(0, 8)}`;
}

function taskTime(value: string | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function HistoryPanel({
  tasks,
  activeTaskId,
  isLoading,
  error,
  onRefresh,
  onSelect
}: {
  tasks: Task[];
  activeTaskId: string;
  isLoading: boolean;
  error: string;
  onRefresh: () => void;
  onSelect: (task: Task) => void;
}) {
  return (
    <section className="studio-panel-tertiary rounded-[22px] border p-3 min-[2200px]:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#F5F5F7]">
          <Video className="h-4 w-4 text-[#5DE2FF]" />
          历史作品
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          className="studio-hover-item flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-[#9EA3AE]"
          aria-label="刷新历史作品"
          title="刷新历史作品"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </button>
      </div>
      {error ? <div className="mb-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">{error}</div> : null}
      <div className="max-h-28 space-y-2 overflow-y-auto pr-1 min-[2200px]:max-h-32">
        {tasks.length ? (
          tasks.slice(0, 6).map((task) => {
            const active = task.id === activeTaskId;
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelect(task)}
                className={cn(
                  "studio-hover-item flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left",
                  active ? "studio-active-item border-[#5DE2FF]/25 bg-[#5DE2FF]/8" : "border-white/[0.08] bg-[#0B0B0C]/45"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#F5F5F7]">{taskTitle(task)}</span>
                  <span className="mt-1 block font-mono text-xs text-[#777D89]">{taskTime(task.updated_at || task.created_at)} / {task.status}</span>
                </span>
                <span className="shrink-0 rounded-xl border border-white/[0.08] px-2 py-1 font-mono text-[10px] text-[#9EA3AE]">{task.id.slice(0, 6)}</span>
              </button>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-white/[0.1] bg-[#0B0B0C]/45 p-4 text-sm text-[#777D89]">
            {isLoading ? "正在读取历史作品..." : "暂无历史作品。"}
          </div>
        )}
      </div>
    </section>
  );
}
