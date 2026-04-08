"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface ChartEntry { date: string; amount: number; }

export function DailyBarChart({ data }: { data: ChartEntry[] }) {
  if (!data.length) return (
    <div className="h-48 flex items-center justify-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>No data</p>
    </div>
  );

  const max = Math.max(...data.map(d => d.amount));

  const shortDate = (d: string) => {
    const parts = d.split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate}
          tick={{ fontSize: 10, fontFamily: "DM Sans", fill: "var(--text-muted)" }}
          axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => `${(v/1000).toFixed(0)}K`}
          tick={{ fontSize: 10, fontFamily: "DM Sans", fill: "var(--text-muted)" }}
          axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(v) => [`Rp ${Number(v).toLocaleString("id-ID")}`, "Spent"]}
          labelFormatter={(label) => shortDate(String(label))}
          contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontFamily: "DM Sans", fontSize: 12 }} />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.amount === max ? "var(--accent-blue)" : "#BFDBFE"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
