import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText, LockKeyhole, Sparkles } from "lucide-react";
import { HeroFinanceCard, SurfaceCard } from "@/components/apple-ui";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function RootPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--bg-main)] px-5 py-8 text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center">
        <nav className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--text-primary)] text-xs font-semibold text-white">BCA</div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.02em]">e-Statement</p>
              <p className="text-xs text-[var(--text-muted)]">Private finance hub</p>
            </div>
          </div>
          <Link href="/login" className="rounded-full bg-white/75 px-4 py-2 text-sm font-medium text-[var(--text-primary)] shadow-sm backdrop-blur transition hover:bg-white">
            Sign in
          </Link>
        </nav>

        <section className="grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-sm backdrop-blur">
              <Sparkles size={14} className="text-[var(--apple-blue)]" /> Apple Card-inspired spending clarity
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.07em] sm:text-6xl lg:text-7xl">
              Understand your BCA spending without spreadsheet noise.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">
              Import e-statement PDFs, auto-categorize transactions, track budgets, and see where money flows in one calm finance workspace.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--apple-blue)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--apple-blue-strong)]">
                Create account <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="inline-flex items-center justify-center rounded-full bg-white/80 px-6 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-sm backdrop-blur transition hover:bg-white">
                Sign in
              </Link>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: FileText, label: "PDF import", text: "Password support" },
                { icon: Sparkles, label: "Auto category", text: "Rules + AI fallback" },
                { icon: LockKeyhole, label: "Supabase auth", text: "RLS-backed data" },
              ].map(({ icon: Icon, label, text }) => (
                <SurfaceCard key={label} compact>
                  <Icon size={17} className="text-[var(--apple-blue)]" />
                  <p className="mt-3 text-sm font-semibold">{label}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{text}</p>
                </SurfaceCard>
              ))}
            </div>
          </div>

          <HeroFinanceCard
            title="Statement overview"
            subtitle="BCA e-Statement"
            primaryValue="Rp 18.4M"
            secondaryValue="128 transactions categorized across 10 spending groups."
            footer="Food · Transport · Subscription · Transfer"
          />
        </section>
      </div>
    </main>
  );
}
