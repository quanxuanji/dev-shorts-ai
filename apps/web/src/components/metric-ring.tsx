import { cn } from "@/lib/utils";

interface MetricRingProps {
  label: string;
  value: number;
  tone?: "cyan" | "violet" | "emerald" | "amber";
}

const toneClass = {
  cyan: "text-cyan-200",
  violet: "text-violet-200",
  emerald: "text-emerald-200",
  amber: "text-amber-200"
};

export function MetricRing({ label, value, tone = "cyan" }: MetricRingProps) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{label}</span>
        <span className={cn("font-mono text-sm", toneClass[tone])}>{value}%</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-violet-300 to-emerald-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
