"use client";
import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { StatsCard } from "@/components/StatsCard";
import { UploadForm } from "@/components/UploadForm";
import { SpendingPieChart } from "@/components/SpendingPieChart";
import { DailyBarChart } from "@/components/DailyBarChart";
import { LargestTransactions } from "@/components/LargestTransactions";
import { createClient } from "@/lib/supabase";
import type { Transaction } from "@/lib/types";

function buildPieData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const cat = t.categories?.name ?? "Other";
    map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
  }
  return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

function buildBarData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    map[t.transaction_date] = (map[t.transaction_date] ?? 0) + Math.abs(t.amount);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: Math.round(amount) }));
}

function getMonthKey(dateStr: string) {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

export default function DashboardClient({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Get all unique months
  const months = useMemo(() => {
    const set = new Set(transactions.map(t => getMonthKey(t.transaction_date)));
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() =>
    selectedMonth === "all" ? transactions : transactions.filter(t => getMonthKey(t.transaction_date) === selectedMonth),
    [transactions, selectedMonth]
  );

  const pieData  = useMemo(() => buildPieData(filtered), [filtered]);
  const barData  = useMemo(() => buildBarData(filtered), [filtered]);
  const totalExpense = useMemo(() => filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [filtered]);
  const totalIncome  = useMemo(() => filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [filtered]);

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("id, transaction_date, description, amount, categories(name)")
      .order("transaction_date", { ascending: false });
    if (error) { console.error("Refresh failed:", error.message); return; }
    setTransactions((data as unknown as Transaction[]) ?? []);
  }

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-main)", fontFamily: "DM Sans, sans-serif" }}>
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 p-4 md:p-6 min-h-screen animate-fadeIn">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
              Dashboard
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              {transactions.length} total transactions
            </p>
          </div>

          {/* Month filter pills */}
          {months.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button onClick={() => setSelectedMonth("all")}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: selectedMonth === "all" ? "var(--accent-gradient)" : "var(--bg-card)",
                  color: selectedMonth === "all" ? "#fff" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}>
                All Time
              </button>
              {months.map(m => (
                <button key={m} onClick={() => setSelectedMonth(m)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: selectedMonth === m ? "var(--accent-gradient)" : "var(--bg-card)",
                    color: selectedMonth === m ? "#fff" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}>
                  {formatMonthLabel(m)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <StatsCard label="Total Expense" value={totalExpense} type="expense"
            subtitle={selectedMonth === "all" ? "All time" : formatMonthLabel(selectedMonth)} />
          <StatsCard label="Total Income" value={totalIncome} type="income"
            subtitle={selectedMonth === "all" ? "All time" : formatMonthLabel(selectedMonth)} />
          <StatsCard label="Transactions" value={filtered.length} type="count"
            subtitle={`${filtered.filter(t => t.amount < 0).length} debit · ${filtered.filter(t => t.amount > 0).length} credit`} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Upload — left column */}
          <div className="col-span-1 space-y-4">
            <UploadForm onSuccess={refresh} />

            {/* Statement history */}
            {months.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)", fontFamily: "Sora, sans-serif" }}>
                  Uploaded Statements
                </h3>
                <div className="space-y-2">
                  {months.map(m => {
                    const count = transactions.filter(t => getMonthKey(t.transaction_date) === m).length;
                    return (
                      <button key={m} onClick={() => setSelectedMonth(m)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all"
                        style={{
                          background: selectedMonth === m ? "#F5F3FF" : "#F8FAFC",
                          border: `1px solid ${selectedMonth === m ? "var(--accent-violet)" : "var(--border)"}`,
                        }}>
                        <span className="text-xs font-semibold" style={{ color: selectedMonth === m ? "var(--accent-violet)" : "var(--text-primary)" }}>
                          {formatMonthLabel(m)}
                        </span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>{count} txn</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Charts — right 2 columns */}
          <div className="col-span-1 lg:col-span-2 space-y-4">

            {/* Bar chart */}
            <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
                  Daily Spending
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {selectedMonth === "all" ? "All time" : formatMonthLabel(selectedMonth)}
                </p>
              </div>
              <DailyBarChart data={barData} />
            </div>

            {/* Pie + Largest Transactions row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
                  Spending by Category
                </h3>
                <SpendingPieChart data={pieData} />
              </div>

              <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <h3 className="text-sm font-semibold mb-3" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
                  Largest Transactions
                </h3>
                <LargestTransactions transactions={filtered} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
