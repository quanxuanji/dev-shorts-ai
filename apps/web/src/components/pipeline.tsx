import { Check, Clock, Loader2, X } from "lucide-react";

import { StatusLight } from "@/components/status-light";
import type { WorkflowStep } from "@/lib/types";
import { cn } from "@/lib/utils";

function StepIcon({ status }: { status: WorkflowStep["status"] }) {
  if (status === "success") return <Check className="h-4 w-4" />;
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin" />;
  if (status === "error") return <X className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
}

export function Pipeline({ steps, compact = false }: { steps: WorkflowStep[]; compact?: boolean }) {
  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      {steps.map((step, index) => (
        <div key={step.id} className="relative flex gap-3">
          {index < steps.length - 1 ? (
            <div className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-white/10" />
          ) : null}
          <div
            className={cn(
              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
              step.status === "success" && "border-cyan-300/30 bg-cyan-300/15 text-cyan-100",
              step.status === "running" && "border-emerald-300/30 bg-emerald-300/15 text-emerald-100",
              step.status === "pending" && "border-amber-300/20 bg-amber-300/10 text-amber-100",
              step.status === "error" && "border-red-300/30 bg-red-400/15 text-red-100"
            )}
          >
            <StepIcon status={step.status} />
          </div>
          <div className="min-w-0 flex-1 rounded-md border border-white/10 bg-slate-950/45 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <StatusLight status={step.status} />
                <span className="truncate text-sm font-medium text-slate-100">{step.label}</span>
              </div>
              <span className="font-mono text-xs uppercase text-slate-500">{step.status}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 transition-all duration-500"
                style={{ width: `${step.progress}%` }}
              />
            </div>
            {step.output && !compact ? <p className="mt-2 text-xs text-slate-400">{step.output}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
