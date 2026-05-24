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
        "relative z-10 mx-auto flex w-full max-w-none flex-col text-[#F5F5F7] lg:flex-row",
        isStudio ? "h-dvh overflow-hidden px-3 py-3 lg:px-4 lg:py-4" : "h-dvh overflow-y-auto px-4 py-4 lg:px-6 lg:py-6"
      )}
    >
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-[#23252B]/80 bg-[#111214]/80 px-3 py-2 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#0B0B0C]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">DevShorts AI</span>
            <span className="block truncate text-xs text-[#9EA3AE]">{t.nav.pipelineStudio}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-[#9EA3AE] transition hover:bg-white/[0.06] hover:text-[#F5F5F7]"
        >
          <Languages className="h-4 w-4" />
          {locale === "zh" ? "中文" : "EN"}
        </button>
      </header>

      <aside className="hidden w-[76px] shrink-0 flex-col items-center gap-4 border-r border-[#23252B]/70 py-2 lg:flex">
        <Link
          href="/"
          className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F5F5F7] text-[#0B0B0C] transition hover:-translate-y-0.5"
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
                  "group relative flex h-11 w-11 items-center justify-center rounded-2xl text-[#777D89] transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.06] hover:text-[#F5F5F7]",
                  isActive && "bg-white/[0.07] text-[#F5F5F7] ring-1 ring-white/[0.08]"
                )}
                aria-label={t.nav[item.labelKey]}
                aria-current={isActive ? "page" : undefined}
                title={t.nav[item.labelKey]}
              >
                <Icon className="h-4 w-4" />
                {isActive ? <span className="absolute -right-[19px] h-5 w-px rounded-full bg-[#7C5CFF]" /> : null}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
          className="mt-auto flex h-11 w-11 flex-col items-center justify-center rounded-2xl text-[#777D89] transition hover:bg-white/[0.06] hover:text-[#F5F5F7]"
          title={t.nav.language}
          aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
        >
          <Languages className="h-3.5 w-3.5" />
          <span className="mt-0.5 font-mono text-[9px]">{locale === "zh" ? "中" : "EN"}</span>
        </button>
      </aside>

      <section className={cn("min-w-0 flex-1", isStudio ? "min-h-0 overflow-hidden lg:pl-4" : "lg:pl-8")}>{children}</section>
    </main>
  );
}
