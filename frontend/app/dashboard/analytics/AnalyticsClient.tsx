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
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
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
    return { month: formatMonthLabel(m).toUpperCase(), expense: Math.round(expense), income: Math.round(income) };
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
      <PageHeader title="Analytics" eyebrow="spending patterns and monthly signals" />

      <SurfaceCard compact title="period.select" sub={`${months.length} volumes`}>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedMonth("all")} className="border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition" style={{ background: selectedMonth === "all" ? "var(--term-accent)" : "var(--term-panel-2)", color: selectedMonth === "all" ? "var(--term-bg)" : "var(--term-secondary)", borderColor: selectedMonth === "all" ? "var(--term-accent)" : "var(--term-border)" }}>ALL</button>
          {months.map(m => <button key={m} onClick={() => setSelectedMonth(m)} className="border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] transition" style={{ background: selectedMonth === m ? "var(--term-accent)" : "var(--term-panel-2)", color: selectedMonth === m ? "var(--term-bg)" : "var(--term-secondary)", borderColor: selectedMonth === m ? "var(--term-accent)" : "var(--term-border)" }}>{formatMonthLabel(m)}</button>)}
        </div>
      </SurfaceCard>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <MetricTile label="total.expense" value={money(totalExpense)} tone="expense" />
        <MetricTile label="total.income" value={money(totalIncome)} tone="income" />
        <MetricTile label="avg.debit" value={money(avgPerTx)} tone="blue" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.35fr_0.65fr]">
        <SurfaceCard title="trend.6mo" sub="expense vs income · IDR" action={<span className="font-mono text-[10px] text-[var(--term-muted)]">resolution: 1m</span>}>
          {trendData.length < 2 ? <p className="py-10 text-center font-mono text-xs text-[var(--term-muted)]">Upload 2+ months to see trends.</p> : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--term-grid)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "var(--term-muted)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: "var(--term-muted)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={52} />
                <Tooltip formatter={(v: unknown) => `Rp ${(v as number).toLocaleString("id-ID")}`} contentStyle={{ borderRadius: 0, border: "1px solid var(--term-border)", background: "var(--term-panel)", color: "var(--term-fg)", fontFamily: "var(--font-mono)", fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--term-secondary)" }} />
                <Line type="monotone" dataKey="expense" name="EXPENSE" stroke="var(--term-neg)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="income" name="INCOME" stroke="var(--term-accent)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </SurfaceCard>

        <SurfaceCard title="insights.ai" sub={selectedMonth === "all" ? "select month" : formatMonthLabel(selectedMonth)}>
          <div className="mb-3 flex items-center gap-2 text-[var(--term-accent)]"><Lightbulb size={14} /><span className="font-mono text-[10px] uppercase tracking-[0.14em]">generated signals</span></div>
          {selectedMonth === "all" && <p className="font-mono text-xs text-[var(--term-muted)]">Choose month to fetch insight suggestions.</p>}
          {selectedMonth !== "all" && insightsLoading && <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 shimmer" />)}</div>}
          {selectedMonth !== "all" && !insightsLoading && insights.length === 0 && <p className="font-mono text-xs text-[var(--term-muted)]">No insights available for this month yet.</p>}
          {selectedMonth !== "all" && !insightsLoading && insights.length > 0 && <ul className="space-y-2">{insights.map((text, i) => <li key={i} className="border-b border-[var(--term-border)] pb-2 text-sm leading-6 text-[var(--term-fg)] last:border-0"><span className="font-mono text-[var(--term-accent)]">► </span>{text}</li>)}</ul>}
        </SurfaceCard>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <SurfaceCard className="xl:col-span-2" title="daily.spend" sub="selected period">
          <DailyBarChart data={dailyData} />
        </SurfaceCard>
        <SurfaceCard title="category.split" sub={`${categoryData.length} categories`}>
          <SpendingPieChart data={categoryData} />
        </SurfaceCard>
      </div>

      <SurfaceCard className="mt-3" title="expense.by.category" sub="ranked desc">
        {categoryData.length === 0 ? <p className="py-8 text-center font-mono text-xs text-[var(--term-muted)]">No data.</p> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--term-grid)" horizontal={false} />
              <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: "var(--term-muted)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "var(--term-muted)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} width={88} />
              <Tooltip formatter={(v: unknown) => `Rp ${(v as number).toLocaleString("id-ID")}`} contentStyle={{ borderRadius: 0, border: "1px solid var(--term-border)", background: "var(--term-panel)", color: "var(--term-fg)", fontFamily: "var(--font-mono)", fontSize: 12 }} />
              <Bar dataKey="value" fill="var(--term-accent)" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </SurfaceCard>
    </AppShell>
  );
}
