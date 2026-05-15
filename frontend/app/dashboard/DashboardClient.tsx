"use client";
import { useState, useMemo } from "react";
import { AppShell, HeroFinanceCard, MetricTile, PageHeader, SurfaceCard } from "@/components/apple-ui";
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
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}
function formatShortCurrency(n: number) {
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
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

  const periodLabel = selectedMonth === "all" ? "All time" : formatMonthLabel(selectedMonth);

  return (
    <AppShell>
      <PageHeader title="Dashboard" eyebrow={`${transactions.length} total transactions`} />

      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          <HeroFinanceCard
            title={periodLabel}
            subtitle="Spending overview"
            primaryValue={formatShortCurrency(totalExpense)}
            secondaryValue={`${formatShortCurrency(totalIncome)} income · ${filtered.length} transactions`}
            footer="BCA e-Statement financial hub"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricTile label="Total Expense" value={formatShortCurrency(totalExpense)} detail={periodLabel} tone="expense" />
            <MetricTile label="Total Income" value={formatShortCurrency(totalIncome)} detail={periodLabel} tone="income" />
            <MetricTile label="Transactions" value={String(filtered.length)} detail={`${filtered.filter(t => t.amount < 0).length} debit · ${filtered.filter(t => t.amount > 0).length} credit`} tone="blue" />
          </div>
        </div>
        <UploadForm onSuccess={refresh} />
      </div>

      {months.length > 0 && (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setSelectedMonth("all")} className="rounded-full px-4 py-2 text-sm font-semibold transition" style={{ background: selectedMonth === "all" ? "var(--text-primary)" : "rgba(255,255,255,.72)", color: selectedMonth === "all" ? "#fff" : "var(--text-secondary)" }}>All Time</button>
          {months.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)} className="rounded-full px-4 py-2 text-sm font-semibold transition" style={{ background: selectedMonth === m ? "var(--text-primary)" : "rgba(255,255,255,.72)", color: selectedMonth === m ? "#fff" : "var(--text-secondary)" }}>{formatMonthLabel(m)}</button>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SurfaceCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold tracking-[-0.03em]">Daily Spending</h3>
            <p className="text-xs text-[var(--text-muted)]">{periodLabel}</p>
          </div>
          <DailyBarChart data={barData} />
        </SurfaceCard>
        <SurfaceCard>
          <h3 className="text-base font-semibold tracking-[-0.03em]">Spending by Category</h3>
          <SpendingPieChart data={pieData} />
        </SurfaceCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SurfaceCard>
          <h3 className="mb-3 text-base font-semibold tracking-[-0.03em]">Largest Transactions</h3>
          <LargestTransactions transactions={filtered} />
        </SurfaceCard>
        <SurfaceCard>
          <h3 className="mb-3 text-base font-semibold tracking-[-0.03em]">Uploaded Statements</h3>
          <div className="space-y-2">
            {months.length === 0 && <p className="text-sm text-[var(--text-muted)]">No statements uploaded yet.</p>}
            {months.map(m => {
              const count = transactions.filter(t => getMonthKey(t.transaction_date) === m).length;
              return (
                <button key={m} onClick={() => setSelectedMonth(m)} className="flex w-full items-center justify-between rounded-2xl bg-white/60 px-4 py-3 text-left transition hover:bg-white">
                  <span className="text-sm font-semibold">{formatMonthLabel(m)}</span>
                  <span className="text-xs text-[var(--text-muted)]">{count} txn</span>
                </button>
              );
            })}
          </div>
        </SurfaceCard>
      </div>

      {selectedMonth !== "all" && <div className="mt-4"><BudgetTracker spendByCategory={spendByCategory} /></div>}
    </AppShell>
  );
}
