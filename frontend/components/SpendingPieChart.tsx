"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#1D4ED8","#DC2626","#059669","#D97706","#7C3AED","#0891B2","#DB2777","#65A30D","#9333EA","#EA580C"];

interface ChartEntry { name: string; value: number; }

const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => (
  <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center mt-2">
    {(payload ?? []).map((p) => (
      <div key={p.value} className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
        <span className="text-xs" style={{ color: "var(--text-secondary)", fontFamily: "DM Sans, sans-serif" }}>{p.value}</span>
      </div>
    ))}
  </div>
);

export function SpendingPieChart({ data }: { data: ChartEntry[] }) {
  if (!data.length) return (
    <div className="h-48 flex items-center justify-center">
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>No expense data</p>
    </div>
  );

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name"
          cx="50%" cy="45%" innerRadius={55} outerRadius={85}
          paddingAngle={2} strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <text x="50%" y="43%" textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "Sora, sans-serif", fontSize: "11px", fill: "var(--text-muted)" }}>TOTAL</text>
        <text x="50%" y="51%" textAnchor="middle" dominantBaseline="middle"
          style={{ fontFamily: "Sora, sans-serif", fontSize: "13px", fontWeight: 600, fill: "var(--text-primary)" }}>
          {(total / 1000000).toFixed(1)}M
        </text>
        <Tooltip
          formatter={(v) => [`Rp ${Number(v).toLocaleString("id-ID")}`, ""]}
          contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontFamily: "DM Sans", fontSize: 12 }} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
