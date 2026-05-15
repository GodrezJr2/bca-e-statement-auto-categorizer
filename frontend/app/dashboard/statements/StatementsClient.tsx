"use client";
import { useState, useMemo } from "react";
import { Download, FileText, Search, TrendingDown, TrendingUp } from "lucide-react";
import { AppShell, MetricTile, PageHeader, SurfaceCard } from "@/components/apple-ui";
import type { Transaction } from "@/lib/types";
import { createClient } from "@/lib/supabase";

function getMonthKey(d: string) { return d.slice(0, 7); }
function formatMonthLabel(key: string) { const [y, m] = key.split("-"); return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" }); }
function formatCurrency(n: number) { return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.abs(n)); }
function shortCurrency(n: number) { if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}M`; if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}K`; return `Rp ${Math.round(n).toLocaleString("id-ID")}`; }

const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  Food: { bg: "#fff7ed", text: "#c2410c" }, Transport: { bg: "#ecfeff", text: "#0e7490" }, Utilities: { bg: "#fffbeb", text: "#b45309" }, Shopping: { bg: "#f5f3ff", text: "#6d28d9" }, Subscription: { bg: "#eef2ff", text: "#4338ca" }, Health: { bg: "#fef2f2", text: "#b91c1c" }, Entertainment: { bg: "#fdf2f8", text: "#be185d" }, Transfer: { bg: "#eff6ff", text: "#1d4ed8" }, Income: { bg: "#ecfdf3", text: "#15803d" }, Other: { bg: "#f5f5f7", text: "#6e6e73" },
};
const CATEGORIES = ["Food", "Transport", "Utilities", "Shopping", "Subscription", "Health", "Entertainment", "Transfer", "Income", "Other"];

export default function StatementsClient({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [transactions, setTransactions] = useState(initialTransactions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const months = useMemo(() => Array.from(new Set(transactions.map(t => getMonthKey(t.transaction_date)))).sort().reverse(), [transactions]);
  const activeMonth = selectedMonth ?? months[0] ?? null;
  const monthTx = useMemo(() => activeMonth ? transactions.filter(t => getMonthKey(t.transaction_date) === activeMonth) : [], [transactions, activeMonth]);
  const filtered = useMemo(() => { if (!search.trim()) return monthTx; const q = search.toLowerCase(); return monthTx.filter(t => t.description.toLowerCase().includes(q) || (t.categories?.name ?? "").toLowerCase().includes(q)); }, [monthTx, search]);
  const globalFiltered = useMemo(() => { if (!globalSearch.trim()) return []; const q = globalSearch.toLowerCase(); return transactions.filter(t => t.description.toLowerCase().includes(q) || (t.categories?.name ?? "").toLowerCase().includes(q)); }, [transactions, globalSearch]);
  const isGlobalMode = globalSearch.trim().length > 0;
  const monthStats = useMemo(() => ({ expense: monthTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0), income: monthTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0), count: monthTx.length }), [monthTx]);

  async function handleCategoryChange(txId: string, newCategory: string) {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setEditingId(null); return; }
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) { setEditingId(null); return; }
    try {
      const res = await fetch(`${apiUrl}/api/transactions/${txId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ category_name: newCategory }) });
      if (!res.ok) return;
      setTransactions(prev => prev.map(t => t.id === txId ? { ...t, categories: { name: newCategory } } : t));
    } finally { setEditingId(null); }
  }

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true); setExportError(null);
    let url: string | null = null;
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !activeMonth) { setExportError("Not signed in."); return; }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) { setExportError("API not configured."); return; }
      const res = await fetch(`${apiUrl}/api/transactions/export?month=${activeMonth}`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) { setExportError("Export failed. Please try again."); return; }
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `statement-${activeMonth}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (err) { console.error("Export failed:", err); setExportError("Export failed. Please try again."); }
    finally { if (url) URL.revokeObjectURL(url); setIsExporting(false); }
  }

  const rows = isGlobalMode ? globalFiltered : filtered;

  return (
    <AppShell>
      <PageHeader title="Statements" eyebrow={isGlobalMode ? "Search across all months" : "Browse imported transactions"} action={activeMonth && !isGlobalMode && <button onClick={handleExport} disabled={isExporting} className="inline-flex items-center gap-2 rounded-full bg-white/75 px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm transition hover:bg-white disabled:opacity-50"><Download size={15} />{isExporting ? "Exporting…" : "Export CSV"}</button>} />
      {exportError && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-[var(--expense-red)]">{exportError}</p>}

      <div className="sticky top-4 z-20 mb-5 rounded-[28px] border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input aria-label="Search all months" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="Search all months…" className="w-full rounded-full border border-[var(--border)] bg-white/70 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[var(--apple-blue)] focus:ring-4 focus:ring-blue-500/10" />
        </div>
      </div>

      {!isGlobalMode && activeMonth && <div className="mb-4 grid gap-3 sm:grid-cols-3"><MetricTile label="Total Expense" value={shortCurrency(monthStats.expense)} tone="expense" /><MetricTile label="Total Income" value={shortCurrency(monthStats.income)} tone="income" /><MetricTile label="Transactions" value={String(monthStats.count)} tone="blue" /></div>}

      {!isGlobalMode && <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{months.length === 0 && <p className="text-sm text-[var(--text-muted)]">No statements uploaded yet.</p>}{months.map(m => <button key={m} onClick={() => setSelectedMonth(m)} className="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition" style={{ background: m === activeMonth ? "var(--text-primary)" : "rgba(255,255,255,.72)", color: m === activeMonth ? "#fff" : "var(--text-secondary)" }}>{formatMonthLabel(m)}</button>)}</div>}

      {!isGlobalMode && <div className="relative mb-4"><Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input aria-label="Search current month" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search current month…" className="w-full rounded-full border border-[var(--border)] bg-white/70 py-3 pl-11 pr-4 text-sm outline-none focus:border-[var(--apple-blue)] focus:ring-4 focus:ring-blue-500/10" /></div>}

      <SurfaceCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-[var(--border)]">{(isGlobalMode ? ["Month", "Date", "Description", "Category", "Amount"] : ["Date", "Description", "Category", "Amount"]).map(h => <th key={h} className="px-5 py-4 text-left text-xs font-semibold text-[var(--text-muted)]">{h}</th>)}</tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={isGlobalMode ? 5 : 4} className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">No transactions found.</td></tr>}
              {rows.map(t => {
                const cat = t.categories?.name ?? "Other";
                const isDebit = t.amount < 0;
                return <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-black/[0.025]">
                  {isGlobalMode && <td className="px-5 py-4 text-xs font-semibold text-[var(--apple-blue)]">{formatMonthLabel(getMonthKey(t.transaction_date))}</td>}
                  <td className="px-5 py-4 text-xs text-[var(--text-muted)]">{t.transaction_date}</td>
                  <td className="max-w-xs truncate px-5 py-4 text-xs text-[var(--text-primary)]">{t.description}</td>
                  <td className="px-5 py-4">{editingId === t.id ? <select autoFocus defaultValue={cat} onBlur={() => setEditingId(null)} onChange={e => handleCategoryChange(t.id, e.target.value)} className="rounded-full border px-3 py-1 text-xs outline-none" style={{ background: (CAT_BADGE[cat] ?? CAT_BADGE.Other).bg, color: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text }}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select> : <button onClick={() => setEditingId(t.id)} className="rounded-full px-3 py-1 text-xs font-medium transition hover:opacity-80" style={{ background: (CAT_BADGE[cat] ?? CAT_BADGE.Other).bg, color: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text }}>{cat}</button>}</td>
                  <td className="px-5 py-4 text-right text-xs font-semibold" style={{ color: isDebit ? "var(--expense-red)" : "var(--income-green)" }}>{isDebit ? "−" : "+"}{formatCurrency(t.amount)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </AppShell>
  );
}
