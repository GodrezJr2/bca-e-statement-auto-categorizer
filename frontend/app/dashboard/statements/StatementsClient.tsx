"use client";
import { useState, useMemo } from "react";
import { Sidebar } from "@/components/Sidebar";
import { FileText, TrendingDown, TrendingUp, Search } from "lucide-react";
import type { Transaction } from "@/lib/types";

function getMonthKey(d: string) { return d.slice(0, 7); }

function formatMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.abs(n));
}

const CAT_COLORS: Record<string, string> = {
  Food: "#F97316", Shopping: "#8B5CF6", Transport: "#06B6D4",
  Entertainment: "#EC4899", Health: "#10B981", Bills: "#F59E0B",
  Education: "#3B82F6", Travel: "#14B8A6", Investment: "#6366F1", Other: "#94A3B8",
};

export default function StatementsClient({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const months = useMemo(() => {
    const set = new Set(initialTransactions.map(t => getMonthKey(t.transaction_date)));
    return Array.from(set).sort().reverse();
  }, [initialTransactions]);

  // Auto-select first month
  const activeMonth = selectedMonth ?? months[0] ?? null;

  const monthTx = useMemo(() =>
    activeMonth ? initialTransactions.filter(t => getMonthKey(t.transaction_date) === activeMonth) : [],
    [initialTransactions, activeMonth]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return monthTx;
    const q = search.toLowerCase();
    return monthTx.filter(t => t.description.toLowerCase().includes(q) || (t.categories?.name ?? "").toLowerCase().includes(q));
  }, [monthTx, search]);

  const monthStats = useMemo(() => {
    const expense = monthTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const income  = monthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    return { expense, income, count: monthTx.length };
  }, [monthTx]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-main)", fontFamily: "DM Sans, sans-serif" }}>
      <Sidebar />
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 p-4 md:p-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
            Statements
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Browse transactions by month
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Month list sidebar */}
          <div className="flex sm:flex-col gap-2 sm:w-48 sm:shrink-0 overflow-x-auto pb-1 sm:pb-0">
            {months.length === 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No statements uploaded yet.</p>
            )}
            {months.map(m => {
              const cnt = initialTransactions.filter(t => getMonthKey(t.transaction_date) === m).length;
              const isActive = m === activeMonth;
              return (
                <button key={m} onClick={() => setSelectedMonth(m)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                  style={{
                    background: isActive ? "var(--accent-blue)" : "var(--bg-card)",
                    border: `1px solid ${isActive ? "var(--accent-blue)" : "var(--border)"}`,
                  }}>
                  <FileText size={14} style={{ color: isActive ? "#fff" : "var(--text-muted)" }} />
                  <div>
                    <p className="text-xs font-semibold leading-none"
                      style={{ color: isActive ? "#fff" : "var(--text-primary)" }}>
                      {formatMonthLabel(m)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: isActive ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}>
                      {cnt} txn
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Transactions table */}
          <div className="flex-1">
            {activeMonth && (
              <>
                {/* Month stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Total Expense", value: monthStats.expense, icon: TrendingDown, color: "var(--expense-red)" },
                    { label: "Total Income",  value: monthStats.income,  icon: TrendingUp,   color: "var(--income-green)" },
                    { label: "Transactions",  value: monthStats.count,   icon: FileText,     color: "var(--accent-blue)" },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: color + "20" }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                        <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                          {label === "Transactions" ? value : formatCurrency(value as number)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Search */}
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search description or category…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                    style={{
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }} />
                </div>

                {/* Table */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Date", "Description", "Category", "Amount"].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                            style={{ color: "var(--text-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-xs"
                            style={{ color: "var(--text-muted)" }}>
                            No transactions found.
                          </td>
                        </tr>
                      )}
                      {filtered.map((t, i) => {
                        const cat = t.categories?.name ?? "Other";
                        const color = CAT_COLORS[cat] ?? "#94A3B8";
                        const isDebit = t.amount < 0;
                        return (
                          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}
                            className="transition-colors hover:bg-slate-50">
                            <td className="px-4 py-3 text-xs font-mono"
                              style={{ color: "var(--text-muted)" }}>
                              {t.transaction_date}
                            </td>
                            <td className="px-4 py-3 text-xs max-w-xs truncate"
                              style={{ color: "var(--text-primary)" }}>
                              {t.description}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ background: color + "20", color }}>
                                {cat}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs font-semibold text-right"
                              style={{ color: isDebit ? "var(--expense-red)" : "var(--income-green)" }}>
                              {isDebit ? "−" : "+"}{formatCurrency(t.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
