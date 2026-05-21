"use client";

import Link from "next/link";
import { Bot, Gauge, Settings, WandSparkles } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems: Array<{ href: string; labelKey: "dashboard" | "studio" | "settings"; icon: typeof Gauge }> = [
  { href: "/", labelKey: "dashboard", icon: Gauge },
  { href: "/studio", labelKey: "studio", icon: WandSparkles },
  { href: "/settings", labelKey: "settings", icon: Settings }
];

export function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl gap-5 px-4 py-5 lg:px-6">
      <aside className="hidden w-64 shrink-0 rounded-lg border border-white/10 bg-slate-950/55 p-4 shadow-violet backdrop-blur-xl lg:block">
        <Link href="/" className="flex items-center gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
            <Bot className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-bold tracking-wide text-slate-50">DevShorts AI</span>
            <span className="font-mono text-xs text-cyan-200">{t.nav.pipelineStudio}</span>
          </span>
        </Link>
        <div className="mt-4 rounded-md border border-white/10 bg-slate-950/70 p-1">
          <div className="mb-1 px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{t.nav.language}</div>
          <div className="grid grid-cols-2 gap-1">
            {(["zh", "en"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setLocale(item)}
                className={cn(
                  "h-8 rounded text-xs font-semibold transition",
                  locale === item ? "bg-cyan-300 text-slate-950" : "text-slate-400 hover:bg-white/10 hover:text-slate-100"
                )}
              >
                {item === "zh" ? "中文" : "EN"}
              </button>
            ))}
          </div>
        </div>
        <nav className="mt-6 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-400 transition hover:bg-white/5 hover:text-slate-100",
                  isActive && "bg-violet-400/15 text-violet-100 ring-1 ring-violet-300/20"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.nav[item.labelKey]}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 rounded-md border border-white/10 bg-slate-900/70 p-3">
          <div className="font-mono text-[11px] uppercase text-slate-500">{t.nav.runtime}</div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span>{t.nav.mockMode}</span>
            <span className="rounded bg-emerald-300/10 px-2 py-1 font-mono text-xs text-emerald-200">{t.nav.active}</span>
          </div>
        </div>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </main>
  );
}
