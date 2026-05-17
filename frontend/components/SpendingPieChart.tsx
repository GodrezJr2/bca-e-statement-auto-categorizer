"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#C6F751", "#62F0CB", "#FF6E7A", "#F7B955", "#8C95A1", "#D946A6", "#3B6FD9", "#D9603B", "#94A3B8", "#16A34A"];
interface ChartEntry { name: string; value: number; }

const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => (
  <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
    {(payload ?? []).map((p) => (
      <div key={p.value} className="flex items-center gap-1.5">
        <div className="h-2 w-2" style={{ background: p.color }} />
        <span className="font-mono text-[10px] uppercase text-[var(--term-secondary)]">{p.value}</span>
      </div>
    ))}
  </div>
);

export function SpendingPieChart({ data }: { data: ChartEntry[] }) {
  if (!data.length) return (
    <div className="flex h-48 items-center justify-center">
      <p className="font-mono text-xs text-[var(--term-muted)]">No expense data</p>
    </div>
  );

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={58} outerRadius={86} paddingAngle={2} stroke="var(--term-bg)" strokeWidth={2}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <text x="50%" y="43%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "10px", letterSpacing: ".16em", fill: "var(--term-muted)", fontWeight: 700, fontFamily: "var(--font-mono)" }}>TOTAL</text>
        <text x="50%" y="51%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: "14px", fontWeight: 650, fill: "var(--term-fg)", fontFamily: "var(--font-mono)" }}>
          {(total / 1000000).toFixed(1)}jt
        </text>
        <Tooltip
          formatter={(v) => [`Rp ${Number(v).toLocaleString("id-ID")}`, ""]}
          contentStyle={{ borderRadius: 0, border: "1px solid var(--term-border)", background: "var(--term-panel)", color: "var(--term-fg)", fontFamily: "var(--font-mono)", fontSize: 12 }}
          labelStyle={{ color: "var(--term-fg)", fontFamily: "var(--font-mono)" }}
          itemStyle={{ color: "var(--term-fg)", fontFamily: "var(--font-mono)" }} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  );
}
