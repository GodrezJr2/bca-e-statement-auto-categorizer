"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, ChevronRight, FileText, GitBranch, LayoutDashboard, LogOut, Menu, Upload, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "DASH", full: "Dashboard" },
  { href: "/dashboard/statements", icon: FileText, label: "STMT", full: "Statements" },
  { href: "/dashboard/analytics", icon: BarChart2, label: "ANLY", full: "Analytics" },
  { href: "/dashboard/map", icon: GitBranch, label: "FLOW", full: "Flow Map" },
];

const DEFAULT_TICKER = [
  { label: "BAL", value: "LIVE", detail: "session", tone: "fg" },
  { label: "OUT.M", value: "SYNC", detail: "transactions", tone: "accent" },
  { label: "IN.M", value: "RLS", detail: "protected", tone: "pos" },
  { label: "NET", value: "IDR", detail: "base", tone: "fg" },
  { label: "CAT.TOP", value: "AUTO", detail: "rules+ai", tone: "warn" },
  { label: "FLOW", value: "READY", detail: "sankey", tone: "accent2" },
];

function toneColor(tone?: string) {
  return {
    fg: "var(--term-fg)",
    accent: "var(--term-accent)",
    accent2: "var(--term-accent-2)",
    pos: "var(--term-pos)",
    neg: "var(--term-neg)",
    warn: "var(--term-warn)",
    muted: "var(--term-muted)",
  }[tone ?? "fg"] ?? "var(--term-fg)";
}

export function SurfaceCard({
  className,
  children,
  compact = false,
  title,
  sub,
  action,
  padded = true,
}: {
  className?: string;
  children: React.ReactNode;
  compact?: boolean;
  title?: string;
  sub?: string;
  action?: React.ReactNode;
  padded?: boolean;
}) {
  return (
    <section className={cn("term-panel text-[var(--term-fg)]", className)}>
      {title && (
        <div className="flex items-center justify-between border-b border-[var(--term-border)] bg-[var(--term-panel-2)] px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-[10px] text-[var(--term-muted)]">▸</span>
            <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--term-secondary)]">{title}</span>
            {sub && <span className="hidden font-mono text-[10px] text-[var(--term-muted)] sm:inline">· {sub}</span>}
          </div>
          {action}
        </div>
      )}
      <div className={cn(!padded && "p-0", padded && (compact ? "p-3" : "p-4"))}>{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 border border-[var(--term-border)] bg-[var(--term-panel)] px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--term-muted)]">{eyebrow}</p>}
        <h1 className="mt-1 font-mono text-2xl font-semibold uppercase tracking-[-0.03em] text-[var(--term-fg)]">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function MetricTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: string;
  tone?: "neutral" | "income" | "expense" | "blue";
}) {
  const color = {
    neutral: "var(--term-fg)",
    income: "var(--term-pos)",
    expense: "var(--term-neg)",
    blue: "var(--term-accent)",
  }[tone];

  return (
    <SurfaceCard compact className="transition hover:border-[var(--term-border-hi)] hover:bg-[var(--term-panel-2)]">
      <p className="term-label">{label}</p>
      <p className="term-value mt-3 text-2xl font-medium" style={{ color }}>{value}</p>
      {detail && <p className="mt-1 font-mono text-[10px] text-[var(--term-secondary)]">{detail}</p>}
    </SurfaceCard>
  );
}

export function HeroFinanceCard({
  title = "Statement intelligence",
  subtitle = "LEMBAR/TERM",
  primaryValue,
  secondaryValue,
  footer = "terminal finance workspace",
  className,
}: {
  title?: string;
  subtitle?: string;
  primaryValue: string;
  secondaryValue?: string;
  footer?: string;
  className?: string;
}) {
  return (
    <div className={cn("term-panel scanline relative overflow-hidden p-5 text-[var(--term-fg)]", className)}>
      <div className="relative z-10 flex min-h-56 flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--term-accent)]">{subtitle}</p>
            <h2 className="mt-2 font-mono text-2xl font-semibold uppercase tracking-[-0.03em]">{title}</h2>
          </div>
          <div className="border border-[var(--term-border-hi)] bg-[var(--term-panel-2)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--term-pos)]">
            ● live
          </div>
        </div>
        <div>
          <p className="term-label">total.view</p>
          <p className="term-value mt-1 text-4xl font-semibold sm:text-5xl" style={{ color: "var(--term-accent)" }}>{primaryValue}</p>
          {secondaryValue && <p className="mt-2 font-mono text-xs text-[var(--term-secondary)]">{secondaryValue}</p>}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--term-muted)]">{footer}</p>
      </div>
    </div>
  );
}

export function TickerBar({ items = DEFAULT_TICKER }: { items?: Array<{ label: string; value: string; detail?: string; tone?: string }> }) {
  return (
    <div className="flex gap-8 overflow-hidden border-y border-[var(--term-border)] bg-[var(--term-bg)] px-4 py-1.5 font-mono text-[11px] whitespace-nowrap text-[var(--term-secondary)]">
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`} className="flex items-baseline gap-2">
          <span className="text-[var(--term-muted)] tracking-[0.12em]">{item.label}</span>
          <span className="font-semibold" style={{ color: toneColor(item.tone) }}>{item.value}</span>
          {item.detail && <span className="text-[10px] text-[var(--term-muted)]">{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}

function NavLinks({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {NAV.map(({ href, icon: Icon, label, full }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            title={full}
            onClick={onNav}
            className={cn(
              "flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition",
              active ? "border-[var(--term-fg)] bg-[var(--term-fg)] text-[var(--term-bg)]" : "border-[var(--term-border)] text-[var(--term-fg)] hover:border-[var(--term-border-hi)] hover:bg-[var(--term-panel-2)]"
            )}
          >
            <Icon size={13} />
            {label}
            {active && <ChevronRight size={12} />}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--term-bg)] text-[var(--term-fg)]">
      <header className="sticky top-0 z-40 border-b border-[var(--term-border)] bg-[var(--term-panel)]">
        <div className="flex items-center gap-4 border-b border-[var(--term-border)] px-4 py-2">
          <Link href="/dashboard" className="font-mono text-sm font-bold tracking-[0.16em] text-[var(--term-accent)]">
            LEMBAR<span className="text-[var(--term-fg)]">/TERM</span>
          </Link>
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--term-muted)] sm:block">
            v3.2.1 · {new Date().toISOString().slice(0, 10)} · user@local
          </div>
          <div className="flex-1" />
          <div className="hidden md:block"><NavLinks /></div>
          <Link href="/dashboard#upload" className="hidden items-center gap-2 border border-[var(--term-border)] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--term-accent)] transition hover:border-[var(--term-accent)] md:flex">
            <Upload size={13} /> upload
          </Link>
          <button onClick={handleLogout} className="hidden items-center gap-2 border border-[var(--term-border)] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--term-muted)] transition hover:border-[var(--term-neg)] hover:text-[var(--term-neg)] md:flex">
            <LogOut size={13} /> logout
          </button>
          <button onClick={() => setOpen(true)} className="border border-[var(--term-border)] p-2 text-[var(--term-fg)] md:hidden">
            <Menu size={18} />
          </button>
        </div>
        <TickerBar />
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 border-r border-[var(--term-border)] bg-[var(--term-panel)] p-4">
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4 border border-[var(--term-border)] p-2 text-[var(--term-muted)]">
              <X size={18} />
            </button>
            <div className="mb-8 font-mono text-sm font-bold tracking-[0.16em] text-[var(--term-accent)]">LEMBAR<span className="text-[var(--term-fg)]">/TERM</span></div>
            <NavLinks onNav={() => setOpen(false)} />
            <div className="mt-6 flex flex-col gap-2">
              <Link href="/dashboard#upload" onClick={() => setOpen(false)} className="flex items-center gap-2 border border-[var(--term-border)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--term-accent)]">
                <Upload size={13} /> Upload Statement
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-2 border border-[var(--term-border)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--term-neg)]">
                <LogOut size={13} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="flex-1 p-4">{children}</main>
      <footer className="border-t border-[var(--term-border)] bg-[var(--term-panel)] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--term-muted)]">
        <div className="flex flex-wrap gap-4">
          <span><span className="text-[var(--term-pos)]">●</span> sync ok</span>
          <span>statements · transactions</span>
          <span className="ml-auto">/ filter · cmd+k soon</span>
        </div>
      </footer>
    </div>
  );
}

export function AuthVisual() {
  return (
    <div className="hidden lg:block">
      <HeroFinanceCard
        title="operator console"
        subtitle="LEMBAR/TERM"
        primaryValue="Rp 18.4jt"
        secondaryValue="Auto-categorized BCA statements in dense terminal finance workspace."
        footer="import · categorize · inspect · export"
      />
    </div>
  );
}
