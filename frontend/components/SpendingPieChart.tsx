"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#007aff", "#34c759", "#ff9500", "#ff3b30", "#5ac8fa", "#af52de", "#5856d6", "#8e8e93", "#ffcc00", "#30d158"];
interface ChartEntry { name: string; value: number; }

const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => (
  <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
    {(payload ?? []).map((p) => (
      <div key={p.value} className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
        <span className="text-xs text-[var(--text-secondary)]">{p.value}</span>
      </div>
    ))}
  </div>
);

export function SpendingPieChart({ data }: { data: ChartEntry[] }) {
  if (!data.length) return (
    <div className="flex h-48 items-center justify-center">
      <p className="text-sm text-[var(--text-muted)]">No expense data</p>
    </div>
  );

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={58} outerRadius={86} paddingAngle={3} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <text x="50%" y="43%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "10px", letterSpacing: ".16em", fill: "var(--text-muted)", fontWeight: 700 }}>TOTAL</text>
        <text x="50%" y="51%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "14px", fontWeight: 650, fill: "var(--text-primary)" }}>
          {(total / 1000000).toFixed(1)}M
        </text>
        <Tooltip formatter={(v) => [`Rp ${Number(v).toLocaleString("id-ID")}`, ""]} contentStyle={{ borderRadius: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-soft)", fontSize: 12 }} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
