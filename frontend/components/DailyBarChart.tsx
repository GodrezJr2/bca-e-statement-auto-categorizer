"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface ChartEntry { date: string; amount: number; }

export function DailyBarChart({ data }: { data: ChartEntry[] }) {
  if (!data.length) return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-sm text-[var(--text-muted)]">No data</p>
    </div>
  );

  const max = Math.max(...data.map(d => d.amount));
  const shortDate = (d: string) => {
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
  };

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 6, left: -18, bottom: 0 }} barCategoryGap="32%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(29,29,31,0.07)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`} tick={{ fontSize: 10, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`Rp ${Number(v).toLocaleString("id-ID")}`, "Spent"]}
          labelFormatter={(label) => shortDate(String(label))}
          contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)", fontSize: 12 }} />
        <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.amount === max ? "var(--apple-blue)" : "rgba(0,122,255,0.24)"} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
