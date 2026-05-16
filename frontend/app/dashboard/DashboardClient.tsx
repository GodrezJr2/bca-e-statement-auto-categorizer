"use client";
import { useState, useMemo } from "react";
import { AppShell, HeroFinanceCard, MetricTile, PageHeader, SurfaceCard, TickerBar } from "@/components/apple-ui";
import { UploadForm } from "@/components/UploadForm";
import { SpendingPieChart } from "@/components/SpendingPieChart";
import { DailyBarChart } from "@/components/DailyBarChart";
import { LargestTransactions } from "@/components/LargestTransactions";
import { BudgetTracker } from "@/components/BudgetTracker";
import { createClient } from "@/lib/supabase";
import type { Transaction } from "@/lib/types";

function buildPieData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const cat = t.categories?.name ?? "Other";
    map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
  }
  return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
}

function buildBarData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    map[t.transaction_date] = (map[t.transaction_date] ?? 0) + Math.abs(t.amount);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount: Math.round(amount) }));
}

function getMonthKey(dateStr: string) { return dateStr.slice(0, 7); }
function formatMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}
function formatShortCurrency(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
}
function formatPlain(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}jt`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(0)}rb`;
  return String(Math.round(abs));
}

export default function DashboardClient({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const months = useMemo(() => Array.from(new Set(transactions.map(t => getMonthKey(t.transaction_date)))).sort().reverse(), [transactions]);
  const filtered = useMemo(() => selectedMonth === "all" ? transactions : transactions.filter(t => getMonthKey(t.transaction_date) === selectedMonth), [transactions, selectedMonth]);
  const pieData = useMemo(() => buildPieData(filtered), [filtered]);
  const barData = useMemo(() => buildBarData(filtered), [filtered]);
  const totalExpense = useMemo(() => filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [filtered]);
  const totalIncome = useMemo(() => filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [filtered]);
  const debitCount = useMemo(() => filtered.filter(t => t.amount < 0).length, [filtered]);
  const creditCount = useMemo(() => filtered.filter(t => t.amount > 0).length, [filtered]);
  const spendByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      if (t.amount >= 0) continue;
      const cat = t.categories?.name ?? "Other";
      map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
    }
    return map;
  }, [filtered]);

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase.from("transactions").select("id, transaction_date, description, amount, categories(name)").order("transaction_date", { ascending: false });
    if (error) { console.error("Refresh failed:", error.message); return; }
    setTransactions((data as unknown as Transaction[]) ?? []);
  }

  const periodLabel = selectedMonth === "all" ? "all.time" : formatMonthLabel(selectedMonth).toUpperCase();
  const net = totalIncome - totalExpense;
  const topCategory = pieData[0];

  return (
    <AppShell>
      <PageHeader title="Dashboard" eyebrow={`${transactions.length} rows · ${periodLabel}`} />
      <TickerBar items={[
        { label: "OUT.M", value: formatShortCurrency(totalExpense), detail: `${debitCount} debit`, tone: "fg" },
        { label: "IN.M", value: formatShortCurrency(totalIncome), detail: `${creditCount} credit`, tone: "pos" },
        { label: "NET", value: `${net >= 0 ? "+" : "−"}${formatShortCurrency(Math.abs(net))}`, detail: "cashflow", tone: net >= 0 ? "pos" : "neg" },
        { label: "TXN", value: String(filtered.length), detail: periodLabel, tone: "accent" },
        { label: "CAT.TOP", value: (topCategory?.name ?? "NONE").toUpperCase(), detail: topCategory ? formatPlain(topCategory.value) : "0", tone: "warn" },
      ]} />

      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        <div className="xl:col-span-3">
          <SurfaceCard title="overview" sub={periodLabel} action={<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--term-muted)]">resolution: 1m</span>}>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <HeroFinanceCard
                  title={periodLabel}
                  subtitle="cashflow.view"
                  primaryValue={formatShortCurrency(totalExpense)}
                  secondaryValue={`${formatShortCurrency(totalIncome)} income · ${filtered.length} transactions`}
                  footer="terminal finance workspace"
                />
              </div>
              <div className="grid gap-3 md:col-span-2 sm:grid-cols-2">
                <MetricTile label="expense.month" value={formatShortCurrency(totalExpense)} detail={`${debitCount} debits`} tone="expense" />
                <MetricTile label="income.month" value={formatShortCurrency(totalIncome)} detail={`${creditCount} credits`} tone="income" />
                <MetricTile label="net.flow" value={`${net >= 0 ? "+" : "−"}${formatShortCurrency(Math.abs(net))}`} detail="retained" tone={net >= 0 ? "income" : "expense"} />
                <MetricTile label="txn.count" value={String(filtered.length)} detail={periodLabel} tone="blue" />
              </div>
            </div>
          </SurfaceCard>
        </div>
        <div id="upload"><UploadForm onSuccess={refresh} /></div>
      </div>

      {months.length > 0 && (
        <SurfaceCard compact className="mt-3" title="volumes" sub={`${months.length} months`}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setSelectedMonth("all")} className="border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition" style={{ borderColor: selectedMonth === "all" ? "var(--term-accent)" : "var(--term-border)", color: selectedMonth === "all" ? "var(--term-bg)" : "var(--term-secondary)", background: selectedMonth === "all" ? "var(--term-accent)" : "var(--term-panel-2)" }}>ALL</button>
            {months.map(m => (
              <button key={m} onClick={() => setSelectedMonth(m)} className="border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition" style={{ borderColor: selectedMonth === m ? "var(--term-accent)" : "var(--term-border)", color: selectedMonth === m ? "var(--term-bg)" : "var(--term-secondary)", background: selectedMonth === m ? "var(--term-accent)" : "var(--term-panel-2)" }}>{formatMonthLabel(m)}</button>
            ))}
          </div>
        </SurfaceCard>
      )}

      <div className="mt-3 grid gap-3 xl:grid-cols-4">
        <SurfaceCard className="xl:col-span-2" title="expense.30d" sub={periodLabel}>
          <DailyBarChart data={barData} />
        </SurfaceCard>
        <SurfaceCard title="categories" sub={`${pieData.length} sorted desc`}>
          <SpendingPieChart data={pieData} />
        </SurfaceCard>
        <SurfaceCard title="signals.auto" sub="derived">
          <div className="space-y-2 font-mono text-[11px]">
            {[
              { lvl: "INFO", color: "var(--term-accent)", msg: `${topCategory?.name ?? "No category"} top category`, det: topCategory ? `${formatShortCurrency(topCategory.value)} spent` : "upload data" },
              { lvl: net >= 0 ? "OK" : "WARN", color: net >= 0 ? "var(--term-pos)" : "var(--term-warn)", msg: net >= 0 ? "Positive net flow" : "Negative net flow", det: `${net >= 0 ? "+" : "−"}${formatShortCurrency(Math.abs(net))}` },
              { lvl: "TXN", color: "var(--term-secondary)", msg: `${filtered.length} rows loaded`, det: `${debitCount} debit · ${creditCount} credit` },
            ].map((s) => (
              <div key={s.msg} className="border-b border-[var(--term-border)] pb-2 last:border-0">
                <span style={{ color: s.color }}>[{s.lvl}]</span> <span className="text-[var(--term-fg)]">{s.msg}</span>
                <div className="text-[var(--term-secondary)]">↳ {s.det}</div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <SurfaceCard title="txn.tail" sub="largest 6">
          <LargestTransactions transactions={filtered} />
        </SurfaceCard>
        <SurfaceCard title="statements" sub="uploaded volumes">
          <div className="space-y-1 font-mono text-[11px]">
            {months.length === 0 && <p className="py-6 text-center text-[var(--term-muted)]">No statements uploaded yet.</p>}
            {months.map(m => {
              const count = transactions.filter(t => getMonthKey(t.transaction_date) === m).length;
              return (
                <button key={m} onClick={() => setSelectedMonth(m)} className="flex w-full items-center justify-between border border-[var(--term-border)] bg-[var(--term-panel-2)] px-3 py-2 text-left transition hover:border-[var(--term-border-hi)]">
                  <span className="uppercase text-[var(--term-fg)]">{formatMonthLabel(m)}</span>
                  <span className="text-[var(--term-muted)]">{count} rows</span>
                </button>
              );
            })}
          </div>
        </SurfaceCard>
      </div>

      {selectedMonth !== "all" && <div className="mt-3"><BudgetTracker spendByCategory={spendByCategory} /></div>}
    </AppShell>
  );
}
