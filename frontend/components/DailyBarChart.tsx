"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface ChartEntry { date: string; amount: number; }

export function DailyBarChart({ data }: { data: ChartEntry[] }) {
  if (!data.length) return (
    <div className="flex h-48 items-center justify-center">
      <p className="font-mono text-xs text-[var(--term-muted)]">No data</p>
    </div>
  );

  const max = Math.max(...data.map(d => d.amount));
  const shortDate = (d: string) => {
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[2]}.${parts[1]}` : d;
  };

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }} barCategoryGap="32%">
        <CartesianGrid stroke="var(--term-grid)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: "var(--term-muted)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}rb`} tick={{ fontSize: 10, fill: "var(--term-muted)", fontFamily: "var(--font-mono)" }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`Rp ${Number(v).toLocaleString("id-ID")}`, "SPENT"]}
          labelFormatter={(label) => shortDate(String(label))}
          contentStyle={{ borderRadius: 0, border: "1px solid var(--term-border)", background: "var(--term-panel)", color: "var(--term-fg)", fontFamily: "var(--font-mono)", fontSize: 12 }} />
        <Bar dataKey="amount">
          {data.map((d, i) => <Cell key={i} fill={d.amount === max ? "var(--term-accent)" : "var(--term-grid)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
