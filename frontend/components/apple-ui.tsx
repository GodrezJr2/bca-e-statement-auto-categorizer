"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, ChevronRight, FileText, GitBranch, LayoutDashboard, LogOut, Menu, Upload, X } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/statements", icon: FileText, label: "Statements" },
  { href: "/dashboard/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/dashboard/map", icon: GitBranch, label: "Flow Map" },
];

export function SurfaceCard({
  className,
  children,
  compact = false,
}: {
  className?: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("surface-card", compact ? "p-4" : "p-5", className)}>
      {children}
    </div>
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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[var(--text-primary)]">{title}</h1>
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
    neutral: "var(--text-primary)",
    income: "var(--income-green)",
    expense: "var(--expense-red)",
    blue: "var(--apple-blue)",
  }[tone];

  return (
    <SurfaceCard compact className="transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]">
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em]" style={{ color }}>{value}</p>
      {detail && <p className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</p>}
    </SurfaceCard>
  );
}

export function HeroFinanceCard({
  title = "BCA e-Statement",
  subtitle = "Apple Card-inspired finance hub",
  primaryValue,
  secondaryValue,
  footer = "Private spending overview",
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
    <div className={cn("hero-card overflow-hidden rounded-[32px] p-7 text-white", className)}>
      <div className="relative z-10 flex min-h-56 flex-col justify-between">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/60">{subtitle}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em]">{title}</h2>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10 backdrop-blur">
            Live
          </div>
        </div>
        <div>
          <p className="text-sm text-white/55">Total view</p>
          <p className="mt-1 text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{primaryValue}</p>
          {secondaryValue && <p className="mt-2 text-sm text-white/65">{secondaryValue}</p>}
        </div>
        <p className="text-xs text-white/45">{footer}</p>
      </div>
    </div>
  );
}

function SidebarContent({ onNav }: { onNav?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-6">
        <Link href="/dashboard" onClick={onNav} className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--text-primary)] text-xs font-semibold text-white shadow-sm">BCA</div>
          <div>
            <p className="text-sm font-semibold tracking-[-0.02em] text-[var(--text-primary)]">e-Statement</p>
            <p className="text-xs text-[var(--text-muted)]">Financial Hub</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNav}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-[var(--text-primary)] text-white shadow-sm" : "text-[var(--text-secondary)] hover:bg-black/[0.04] hover:text-[var(--text-primary)]"
              )}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-white/45" />}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 px-3 pb-5">
        <Link href="/dashboard#upload" onClick={onNav} className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--apple-blue)] px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--apple-blue-strong)]">
          <Upload size={15} /> Upload Statement
        </Link>
        <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-[var(--text-muted)] transition hover:bg-black/[0.04] hover:text-[var(--text-primary)]">
          <LogOut size={15} /> Logout
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
      <aside className="fixed left-4 top-4 z-30 hidden h-[calc(100vh-2rem)] w-60 rounded-[28px] border border-white/70 bg-white/75 shadow-[var(--shadow-soft)] backdrop-blur-xl md:block">
        <SidebarContent />
      </aside>

      <header className="fixed left-3 right-3 top-3 z-40 flex items-center justify-between rounded-[24px] border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--text-primary)] text-[10px] font-semibold text-white">BCA</div>
          <span className="text-sm font-semibold tracking-[-0.02em]">e-Statement</span>
        </Link>
        <button onClick={() => setOpen(true)} className="rounded-full p-2 text-[var(--text-secondary)] hover:bg-black/[0.05]">
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="relative h-full w-72 bg-white shadow-2xl">
            <button onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full bg-black/[0.04] p-2 text-[var(--text-muted)]">
              <X size={18} />
            </button>
            <SidebarContent onNav={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="px-4 pb-8 pt-24 md:ml-72 md:px-8 md:pt-8">
        {children}
      </main>
    </div>
  );
}

export function AuthVisual() {
  return (
    <div className="hidden lg:block">
      <HeroFinanceCard
        title="Statement intelligence"
        subtitle="BCA e-Statement"
        primaryValue="Rp 18.4M"
        secondaryValue="Organized across food, transport, subscriptions, and transfers."
        footer="Import. Categorize. Understand flow."
      />
    </div>
  );
}
