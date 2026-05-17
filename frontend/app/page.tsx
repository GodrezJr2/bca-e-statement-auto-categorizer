import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText, LockKeyhole, Sparkles } from "lucide-react";
import { HeroFinanceCard, SurfaceCard, ThemeToggle } from "@/components/apple-ui";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--term-bg)] px-5 py-8 text-[var(--term-fg)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <nav className="mb-10 flex items-center justify-between border-b border-[var(--term-border)] pb-4">
          <div>
            <p className="font-mono text-sm font-bold tracking-[0.16em] text-[var(--term-accent)]">LEMBAR<span className="text-[var(--term-fg)]">/TERM</span></p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--term-muted)]">terminal finance workspace</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="border border-[var(--term-border)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--term-fg)] transition hover:border-[var(--term-accent)] hover:text-[var(--term-accent)]">
              Sign in
            </Link>
          </div>
        </nav>

        <section className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 border border-[var(--term-border)] bg-[var(--term-panel)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--term-accent)]">
              <Sparkles size={14} /> Direction B terminal console
            </div>
            <h1 className="max-w-3xl font-mono text-5xl font-semibold uppercase tracking-[-0.07em] sm:text-6xl lg:text-7xl">
              BCA statement intelligence for operators.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--term-secondary)]">
              Import e-statement PDFs, auto-categorize transactions, inspect budgets, and trace money flow inside one dense terminal finance workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 bg-[var(--term-accent)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--term-bg)] transition hover:bg-[var(--term-accent-2)]">
                Create operator <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="inline-flex items-center justify-center border border-[var(--term-border)] bg-[var(--term-panel)] px-6 py-3 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--term-fg)] transition hover:border-[var(--term-border-hi)] hover:bg-[var(--term-panel-2)]">
                Access terminal
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: FileText, label: "PDF import", text: "password support" },
                { icon: Sparkles, label: "Auto category", text: "rules + AI fallback" },
                { icon: LockKeyhole, label: "Supabase auth", text: "RLS-backed rows" },
              ].map(({ icon: Icon, label, text }) => (
                <SurfaceCard key={label} compact title={label}>
                  <Icon size={17} className="text-[var(--term-accent)]" />
                  <p className="mt-3 font-mono text-xs font-semibold uppercase tracking-[0.08em]">{label}</p>
                  <p className="mt-1 font-mono text-[10px] text-[var(--term-muted)]">{text}</p>
                </SurfaceCard>
              ))}
            </div>
          </div>

          <HeroFinanceCard
            title="statement console"
            subtitle="LEMBAR/TERM"
            primaryValue="Rp 18.4jt"
            secondaryValue="128 transactions categorized across 10 spending groups."
            footer="terminal finance workspace · import · inspect · export"
          />
        </section>
      </div>
    </main>
  );
}
