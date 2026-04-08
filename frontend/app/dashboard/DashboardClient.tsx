"use client";
import { useState, useMemo } from "react";
import { UploadForm } from "@/components/UploadForm";
import { SpendingPieChart } from "@/components/SpendingPieChart";
import { DailyBarChart } from "@/components/DailyBarChart";
import { createClient } from "@/lib/supabase";
import type { Transaction } from "@/lib/types";

function buildPieData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    const cat = t.categories?.name ?? "Other";
    map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
  }
  return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value) }));
}

function buildBarData(transactions: Transaction[]) {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount >= 0) continue;
    map[t.transaction_date] = (map[t.transaction_date] ?? 0) + Math.abs(t.amount);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount: Math.round(amount) }));
}

export default function DashboardClient({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions);

  async function refresh() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("transactions")
      .select("transaction_date, description, amount, categories(name)")
      .order("transaction_date", { ascending: false });
    if (error) {
      console.error("Failed to refresh transactions:", error.message);
      return;
    }
    setTransactions((data as unknown as Transaction[]) ?? []);
  }

  const pieData     = useMemo(() => buildPieData(transactions), [transactions]);
  const barData     = useMemo(() => buildBarData(transactions), [transactions]);
  const totalExpense = useMemo(() => transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), [transactions]);
  const totalIncome  = useMemo(() => transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), [transactions]);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">BCA e-Statement Dashboard</h1>
        <div className="flex gap-6 mb-6 text-sm text-gray-600">
          <span>Total Expense: <strong className="text-red-600">Rp {totalExpense.toLocaleString("id-ID")}</strong></span>
          <span>Total Income: <strong className="text-green-600">Rp {totalIncome.toLocaleString("id-ID")}</strong></span>
          <span>Transactions: <strong>{transactions.length}</strong></span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <UploadForm onSuccess={refresh} />
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-lg font-semibold mb-2">Spending by Category</h2>
              <SpendingPieChart data={pieData} />
            </div>
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-lg font-semibold mb-2">Daily Spending</h2>
              <DailyBarChart data={barData} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
