"use client";
import { useState, useMemo, useEffect } from "react";
import { BarChart, Bar, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Lightbulb } from "lucide-react";
import { AppShell, MetricTile, PageHeader, SurfaceCard } from "@/components/apple-ui";
import { SpendingPieChart } from "@/components/SpendingPieChart";
import { DailyBarChart } from "@/components/DailyBarChart";
import type { Transaction } from "@/lib/types";
import { createClient } from "@/lib/supabase";

function getMonthKey(d: string) { return d.slice(0, 7); }
function formatMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" });
}
function formatCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}
function money(n: number) { return `Rp ${formatCurrency(n)}`; }

export default function AnalyticsClient({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [insights, setInsights] = useState<string[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const months = useMemo(() => Array.from(new Set(initialTransactions.map(t => getMonthKey(t.transaction_date)))).sort(), [initialTransactions]);
  const filtered = useMemo(() => selectedMonth === "all" ? initialTransactions : initialTransactions.filter(t => getMonthKey(t.transaction_date) === selectedMonth), [initialTransactions, selectedMonth]);
  const trendData = useMemo(() => months.map(m => {
    const txs = initialTransactions.filter(t => getMonthKey(t.transaction_date) === m);
    const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const income = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    return { month: formatMonthLabel(m), expense: Math.round(expense), income: Math.round(income) };
  }), [initialTransactions, months]);
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      if (t.amount >= 0) continue;
      const cat = t.categories?.name ?? "Other";
      map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
  }, [filtered]);
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      if (t.amount >= 0) continue;
      map[t.transaction_date] = (map[t.transaction_date] ?? 0) + Math.abs(t.amount);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount: Math.round(amount) }));
  }, [filtered]);
  const totalExpense = useMemo(() => filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [filtered]);
  const totalIncome = useMemo(() => filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [filtered]);
  const avgPerTx = useMemo(() => {
    const debits = filtered.filter(t => t.amount < 0);
    return debits.length ? totalExpense / debits.length : 0;
  }, [filtered, totalExpense]);

  useEffect(() => {
    if (selectedMonth === "all") { setInsights([]); return; }
    let cancelled = false;
    async function fetchInsights() {
      setInsightsLoading(true);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { if (!cancelled) setInsightsLoading(false); return; }
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) { if (!cancelled) setInsightsLoading(false); return; }
        const res = await fetch(`${apiUrl}/api/insights?month=${selectedMonth}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (!res.ok) { if (!cancelled) setInsightsLoading(false); return; }
        const data = await res.json();
        if (!cancelled) setInsights(data.insights ?? []);
      } catch (err) {
        console.error("Failed to fetch insights:", err);
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    }
    fetchInsights();
    return () => { cancelled = true; };
  }, [selectedMonth]);

  return (
    <AppShell>
      <PageHeader title="Analytics" eyebrow="Spending patterns and monthly signals" />

      <div className="mb-5 flex flex-wrap gap-2">
        <button onClick={() => setSelectedMonth("all")} className="rounded-full px-4 py-2 text-sm font-semibold transition" style={{ background: selectedMonth === "all" ? "var(--text-primary)" : "rgba(255,255,255,.72)", color: selectedMonth === "all" ? "#fff" : "var(--text-secondary)" }}>All Time</button>
        {months.map(m => <button key={m} onClick={() => setSelectedMonth(m)} className="rounded-full px-4 py-2 text-sm font-semibold transition" style={{ background: selectedMonth === m ? "var(--text-primary)" : "rgba(255,255,255,.72)", color: selectedMonth === m ? "#fff" : "var(--text-secondary)" }}>{formatMonthLabel(m)}</button>)}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <MetricTile label="Total Expense" value={money(totalExpense)} tone="expense" />
        <MetricTile label="Total Income" value={money(totalIncome)} tone="income" />
        <MetricTile label="Avg per Debit" value={money(avgPerTx)} tone="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <SurfaceCard>
          <h3 className="mb-4 text-base font-semibold tracking-[-0.03em]">Month-over-Month Trend</h3>
          {trendData.length < 2 ? <p className="py-10 text-center text-sm text-[var(--text-muted)]">Upload 2+ months to see trends.</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,29,31,0.07)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={45} />
                <Tooltip formatter={(v: unknown) => `Rp ${(v as number).toLocaleString("id-ID")}`} contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)", fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="expense" name="Expense" stroke="var(--expense-red)" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="income" name="Income" stroke="var(--income-green)" strokeWidth={3} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SurfaceCard>

        <SurfaceCard>
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-2xl bg-[var(--text-primary)] text-white"><Lightbulb size={14} /></div>
            <div><h3 className="text-base font-semibold tracking-[-0.03em]">Insights</h3><p className="text-xs text-[var(--text-muted)]">{selectedMonth === "all" ? "Pick month" : formatMonthLabel(selectedMonth)}</p></div>
          </div>
          {selectedMonth === "all" && <p className="text-sm text-[var(--text-muted)]">Choose a month to fetch insight suggestions.</p>}
          {selectedMonth !== "all" && insightsLoading && <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 rounded-2xl shimmer" />)}</div>}
          {selectedMonth !== "all" && !insightsLoading && insights.length === 0 && <p className="text-sm text-[var(--text-muted)]">No insights available for this month yet.</p>}
          {selectedMonth !== "all" && !insightsLoading && insights.length > 0 && <ul className="space-y-2">{insights.map((text, i) => <li key={i} className="rounded-2xl bg-white/60 px-3 py-2.5 text-sm text-[var(--text-primary)]">{text}</li>)}</ul>}
        </SurfaceCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <SurfaceCard className="lg:col-span-2">
          <h3 className="mb-4 text-base font-semibold tracking-[-0.03em]">Daily Spending</h3>
          <DailyBarChart data={dailyData} />
        </SurfaceCard>
        <SurfaceCard>
          <h3 className="text-base font-semibold tracking-[-0.03em]">Category Split</h3>
          <SpendingPieChart data={categoryData} />
        </SurfaceCard>
      </div>

      <SurfaceCard className="mt-4">
        <h3 className="mb-4 text-base font-semibold tracking-[-0.03em]">Expense by Category</h3>
        {categoryData.length === 0 ? <p className="py-8 text-center text-sm text-[var(--text-muted)]">No data.</p> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} width={88} />
              <Tooltip formatter={(v: unknown) => `Rp ${(v as number).toLocaleString("id-ID")}`} contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)", fontSize: 12 }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="var(--apple-blue)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SurfaceCard>
    </AppShell>
  );
}
