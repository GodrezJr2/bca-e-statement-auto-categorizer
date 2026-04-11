"use client";
import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { SpendingPieChart } from "@/components/SpendingPieChart";
import { DailyBarChart } from "@/components/DailyBarChart";
import { TrendingDown, TrendingUp, Repeat } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar,
} from "recharts";
import type { Transaction } from "@/lib/types";

function getMonthKey(d: string) { return d.slice(0, 7); }

function formatMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

const CAT_COLORS: Record<string, string> = {
  Food: "#F97316", Shopping: "#8B5CF6", Transport: "#06B6D4",
  Entertainment: "#EC4899", Health: "#10B981", Bills: "#F59E0B",
  Education: "#3B82F6", Travel: "#14B8A6", Investment: "#6366F1", Other: "#94A3B8",
};

export default function AnalyticsClient({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const months = useMemo(() => {
    const set = new Set(initialTransactions.map(t => getMonthKey(t.transaction_date)));
    return Array.from(set).sort();
  }, [initialTransactions]);

  const filtered = useMemo(() =>
    selectedMonth === "all"
      ? initialTransactions
      : initialTransactions.filter(t => getMonthKey(t.transaction_date) === selectedMonth),
    [initialTransactions, selectedMonth]
  );

  // Month-over-month trend data
  const trendData = useMemo(() =>
    months.map(m => {
      const txs = initialTransactions.filter(t => getMonthKey(t.transaction_date) === m);
      const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const income  = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      return { month: formatMonthLabel(m), expense: Math.round(expense), income: Math.round(income) };
    }),
    [initialTransactions, months]
  );

  // Category breakdown for filtered period
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      if (t.amount >= 0) continue;
      const cat = t.categories?.name ?? "Other";
      map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
    }
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  // Daily bar data for filtered
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      if (t.amount >= 0) continue;
      map[t.transaction_date] = (map[t.transaction_date] ?? 0) + Math.abs(t.amount);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount: Math.round(amount) }));
  }, [filtered]);

  const totalExpense = useMemo(() => filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [filtered]);
  const totalIncome  = useMemo(() => filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [filtered]);
  const avgPerTx     = useMemo(() => {
    const debits = filtered.filter(t => t.amount < 0);
    return debits.length ? totalExpense / debits.length : 0;
  }, [filtered, totalExpense]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-main)", fontFamily: "DM Sans, sans-serif" }}>
      <Sidebar />
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 p-4 md:p-6 animate-fadeIn">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
              Analytics
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Spending patterns and trends
            </p>
          </div>

          {/* Month filter */}
          {months.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button onClick={() => setSelectedMonth("all")}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: selectedMonth === "all" ? "var(--accent-gradient)" : "var(--bg-card)",
                  color: selectedMonth === "all" ? "#fff" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}>All Time</button>
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

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          {[
            { label: "Total Expense", value: `Rp ${formatCurrency(totalExpense)}`, icon: TrendingDown, color: "var(--expense-red)" },
            { label: "Total Income",  value: `Rp ${formatCurrency(totalIncome)}`,  icon: TrendingUp,   color: "var(--income-green)" },
            { label: "Avg per Debit", value: `Rp ${formatCurrency(avgPerTx)}`,     icon: Repeat,       color: "var(--accent-blue)" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-2xl p-4 flex items-center gap-3 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md cursor-default"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: color + "20" }}>
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* Month-over-month trend */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
              Month-over-Month Trend
            </h3>
            {trendData.length < 2 ? (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>
                Upload 2+ months to see trends.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip formatter={(v: unknown) => `Rp ${(v as number).toLocaleString("id-ID")}`}
                    contentStyle={{ background: "#1E293B", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="expense" name="Expense" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="income"  name="Income"  stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category bar chart */}
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
              Expense by Category
            </h3>
            {categoryData.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                  <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip formatter={(v: unknown) => `Rp ${(v as number).toLocaleString("id-ID")}`}
                    contentStyle={{ background: "#1E293B", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}
                    fill="var(--accent-blue)"
                    label={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Daily spending + donut */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="col-span-1 lg:col-span-2 rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-4" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
              Daily Spending
            </h3>
            <DailyBarChart data={dailyData} />
          </div>

          <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
              Category Split
            </h3>
            <SpendingPieChart data={categoryData} />
          </div>
        </div>

      </main>
    </div>
  );
}
