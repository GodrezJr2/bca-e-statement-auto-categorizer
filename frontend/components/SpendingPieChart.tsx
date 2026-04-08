"use client";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = [
  "#6366f1","#f59e0b","#10b981","#3b82f6","#ec4899",
  "#8b5cf6","#f97316","#14b8a6","#ef4444","#a3e635",
];

interface ChartEntry { name: string; value: number; }

export function SpendingPieChart({ data }: { data: ChartEntry[] }) {
  if (!data.length) return <p className="text-sm text-gray-400">No expense data.</p>;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
          {data.map((_, i) => <Cell key={String(i)} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip formatter={(v) => `Rp ${Number(v).toLocaleString("id-ID")}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
