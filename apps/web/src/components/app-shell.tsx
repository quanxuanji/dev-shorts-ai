"use client";

import Link from "next/link";
import { Gauge, Languages, Settings, Sparkles, WandSparkles } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const navItems: Array<{ href: string; labelKey: "dashboard" | "studio" | "settings"; icon: typeof Gauge }> = [
  { href: "/", labelKey: "dashboard", icon: Gauge },
  { href: "/studio", labelKey: "studio", icon: WandSparkles },
  { href: "/settings", labelKey: "settings", icon: Settings }
];

export function AppShell({ children, active }: { children: React.ReactNode; active: string }) {
  const { locale, setLocale, t } = useI18n();
  const isStudio = active === "/studio";

  return (
    <main
      className={cn(
        "relative z-10 mx-auto flex w-full max-w-none flex-col text-[#111827] lg:flex-row",
        isStudio ? "min-h-dvh overflow-y-auto px-3 py-3 lg:h-dvh lg:overflow-hidden lg:px-4 lg:py-4" : "h-dvh overflow-y-auto px-4 py-4 lg:px-6 lg:py-6"
      )}
    >
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-white/50 bg-white/70 px-3 py-2 shadow-[0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111827] text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">DevShorts AI</span>
            <span className="block truncate text-xs text-[#6b7280]">{t.nav.pipelineStudio}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-[#6b7280] transition hover:bg-slate-900/[0.04] hover:text-[#111827]"
        >
          <Languages className="h-4 w-4" />
          {locale === "zh" ? "中文" : "EN"}
        </button>
      </header>

      <aside className="hidden w-[76px] shrink-0 flex-col items-center gap-4 rounded-[24px] border border-white/50 bg-white/62 py-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:flex">
        <Link
          href="/"
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#111827] text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition hover:-translate-y-0.5"
          aria-label="DevShorts AI"
        >
          <Sparkles className="h-4 w-4" />
        </Link>

        <nav className="flex flex-col gap-2" aria-label={t.nav.pipelineStudio}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "app-shell-link group relative flex h-11 w-11 items-center justify-center rounded-2xl text-[#6b7280] transition duration-200 hover:-translate-y-0.5 hover:bg-slate-900/[0.04] hover:text-[#111827]",
                  isActive && "bg-white text-[#111827] shadow-[0_10px_28px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.04]"
                )}
                aria-label={t.nav[item.labelKey]}
                aria-current={isActive ? "page" : undefined}
                title={t.nav[item.labelKey]}
              >
                <Icon className="h-4 w-4" />
                {isActive ? <span className="absolute -right-[19px] h-5 w-px rounded-full bg-[#4f8cff]" /> : null}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          className="mt-auto flex h-11 w-11 flex-col items-center justify-center rounded-2xl text-[#6b7280] transition hover:bg-slate-900/[0.04] hover:text-[#111827]"
          title={t.nav.language}
          aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="mt-0.5 font-mono text-[9px]">{locale === "zh" ? "中" : "EN"}</span>
        </button>
      </aside>

      <section className={cn("min-w-0 flex-1", isStudio ? "min-h-0 lg:overflow-hidden lg:pl-4" : "lg:pl-8")}>{children}</section>
    </main>
  );
}
