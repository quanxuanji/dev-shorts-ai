import { cn } from "@/lib/utils";
import type { ModelState, StepStatus, TaskStatus } from "@/lib/types";

type Status = StepStatus | TaskStatus | ModelState;

const colorByStatus: Record<Status, string> = {
  pending: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)]",
  queued: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)]",
  running: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.65)]",
  success: "bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.65)]",
  error: "bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.65)]",
  online: "bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.65)]",
  standby: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.55)]",
  mock: "bg-violet-300 shadow-[0_0_14px_rgba(196,181,253,0.65)]",
  offline: "bg-slate-500",
};

export function StatusLight({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("h-2.5 w-2.5 rounded-full", colorByStatus[status], className)} />;
}
