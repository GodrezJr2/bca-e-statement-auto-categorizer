"use client";
import { useState, useMemo } from "react";
import { Download, Search } from "lucide-react";
import { AppShell, MetricTile, PageHeader, SurfaceCard } from "@/components/apple-ui";
import type { Transaction } from "@/lib/types";
import { createClient } from "@/lib/supabase";

function getMonthKey(d: string) { return d.slice(0, 7); }
function formatMonthLabel(key: string) { const [y, m] = key.split("-"); return new Date(Number(y), Number(m) - 1).toLocaleDateString("id-ID", { month: "short", year: "2-digit" }); }
function formatCurrency(n: number) { return `Rp ${Math.abs(Math.round(n)).toLocaleString("id-ID")}`; }
function shortCurrency(n: number) { if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`; if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`; return `Rp ${Math.round(n).toLocaleString("id-ID")}`; }
function plainCurrency(n: number) { const abs = Math.abs(n); if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}jt`; if (abs >= 1_000) return `${(abs / 1_000).toFixed(0)}rb`; return String(Math.round(abs)); }

const CAT_BADGE: Record<string, { bg: string; text: string }> = {
  Food: { bg: "#241815", text: "#D9603B" }, Transport: { bg: "#101a25", text: "#62F0CB" }, Utilities: { bg: "#221c12", text: "#F7B955" }, Shopping: { bg: "#1c1828", text: "#C6F751" }, Subscription: { bg: "#121d1c", text: "#62F0CB" }, Health: { bg: "#241316", text: "#FF6E7A" }, Entertainment: { bg: "#211522", text: "#D946A6" }, Transfer: { bg: "#171b22", text: "#8C95A1" }, Income: { bg: "#12211d", text: "#62F0CB" }, Other: { bg: "#15181D", text: "#8C95A1" },
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
      <PageHeader title="Statements" eyebrow={isGlobalMode ? "grep all volumes" : "browse imported rows"} action={activeMonth && !isGlobalMode && <button onClick={handleExport} disabled={isExporting} className="inline-flex items-center gap-2 border border-[var(--term-border)] bg-[var(--term-panel-2)] px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--term-accent)] transition hover:border-[var(--term-accent)] disabled:opacity-50"><Download size={14} />{isExporting ? "Exporting…" : "Export CSV"}</button>} />
      {exportError && <p className="mb-3 border border-[var(--term-neg)] bg-[var(--term-panel-2)] px-4 py-3 font-mono text-xs text-[var(--term-neg)]">{exportError}</p>}

      <div className="grid gap-3 xl:grid-cols-[240px_1fr_280px]">
        <SurfaceCard title="volumes" sub={`${months.length}`} padded={false}>
          {months.length === 0 && <p className="p-4 font-mono text-xs text-[var(--term-muted)]">No statements uploaded yet.</p>}
          {months.map((m) => {
            const txs = transactions.filter(t => getMonthKey(t.transaction_date) === m);
            const expense = txs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
            const income = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
            const active = m === activeMonth && !isGlobalMode;
            return (
              <button key={m} onClick={() => { setSelectedMonth(m); setGlobalSearch(""); }} className="block w-full border-b border-[var(--term-border)] px-3 py-3 text-left transition hover:bg-[var(--term-panel-2)]" style={{ borderLeft: active ? "2px solid var(--term-accent)" : "2px solid transparent", background: active ? "var(--term-panel-2)" : "transparent" }}>
                <div className="flex justify-between font-mono text-xs uppercase"><span className="text-[var(--term-fg)]">{formatMonthLabel(m)}</span><span className="text-[var(--term-muted)]">{txs.length}t</span></div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--term-secondary)]"><span>OUT {plainCurrency(expense)}</span><span className="text-[var(--term-pos)]">IN {plainCurrency(income)}</span></div>
              </button>
            );
          })}
        </SurfaceCard>

        <div className="space-y-3">
          <SurfaceCard title="filter" compact>
            <div className="flex flex-col gap-2 lg:flex-row">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--term-muted)]" />
                <input aria-label="Search current month" value={search} onChange={e => setSearch(e.target.value)} placeholder="grep description…" className="w-full border border-[var(--term-border)] bg-[var(--term-bg)] py-2 pl-8 pr-3 font-mono text-xs text-[var(--term-fg)] outline-none focus:border-[var(--term-accent)]" />
              </div>
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--term-muted)]" />
                <input aria-label="Search all months" value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="grep all volumes…" className="w-full border border-[var(--term-border)] bg-[var(--term-bg)] py-2 pl-8 pr-3 font-mono text-xs text-[var(--term-fg)] outline-none focus:border-[var(--term-accent)]" />
              </div>
              <button onClick={() => { setSearch(""); setGlobalSearch(""); }} className="border border-[var(--term-border)] bg-[var(--term-panel-2)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--term-secondary)]">RESET</button>
            </div>
          </SurfaceCard>

          <SurfaceCard title={isGlobalMode ? "transactions.all" : `transactions.${activeMonth ?? "empty"}`} sub={`${rows.length} rows · sorted DESC`} padded={false}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse font-mono text-[11px] font-variant-numeric tabular-nums">
                <thead className="bg-[var(--term-panel-2)]"><tr className="text-[9px] uppercase tracking-[0.14em] text-[var(--term-muted)]">{(isGlobalMode ? ["MONTH", "DATE", "DESCRIPTION", "CATEGORY", "AMOUNT"] : ["DATE", "DESCRIPTION", "CATEGORY", "AMOUNT"]).map(h => <th key={h} className="px-3 py-2 text-left font-normal last:text-right">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={isGlobalMode ? 5 : 4} className="px-3 py-10 text-center text-[var(--term-muted)]">No transactions found.</td></tr>}
                  {rows.map(t => {
                    const cat = t.categories?.name ?? "Other";
                    const isDebit = t.amount < 0;
                    return <tr key={t.id} className="border-t border-[var(--term-border)] hover:bg-[var(--term-panel-2)]">
                      {isGlobalMode && <td className="px-3 py-2 text-[var(--term-accent)]">{formatMonthLabel(getMonthKey(t.transaction_date))}</td>}
                      <td className="px-3 py-2 text-[var(--term-muted)]">{t.transaction_date}</td>
                      <td className="max-w-xs truncate px-3 py-2 text-[var(--term-fg)]">{t.description}</td>
                      <td className="px-3 py-2">{editingId === t.id ? <select autoFocus defaultValue={cat} onBlur={() => setEditingId(null)} onChange={e => handleCategoryChange(t.id, e.target.value)} className="border border-[var(--term-border)] bg-[var(--term-bg)] px-2 py-1 font-mono text-[10px] uppercase outline-none" style={{ color: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text }}>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select> : <button onClick={() => setEditingId(t.id)} className="border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ background: (CAT_BADGE[cat] ?? CAT_BADGE.Other).bg, color: (CAT_BADGE[cat] ?? CAT_BADGE.Other).text, borderColor: "var(--term-border)" }}>{cat}</button>}</td>
                      <td className="px-3 py-2 text-right font-semibold" style={{ color: isDebit ? "var(--term-neg)" : "var(--term-pos)" }}>{isDebit ? "−" : "+"}{formatCurrency(t.amount)}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>

        <div className="space-y-3">
          {!isGlobalMode && activeMonth && <div className="grid gap-3"><MetricTile label="rows" value={String(monthStats.count)} tone="blue" /><MetricTile label="out" value={shortCurrency(monthStats.expense)} detail="debits" tone="expense" /><MetricTile label="in" value={shortCurrency(monthStats.income)} detail="credits" tone="income" /></div>}
          <SurfaceCard title="export" sub={activeMonth ?? "none"}>
            <div className="space-y-2">
              {["csv"].map(ext => <button key={ext} onClick={handleExport} disabled={!activeMonth || isGlobalMode || isExporting} className="flex w-full items-center justify-between border border-[var(--term-border)] bg-[var(--term-panel-2)] px-3 py-2 font-mono text-[11px] text-[var(--term-fg)] disabled:opacity-40"><span>statement-{activeMonth ?? "none"}.{ext}</span><span className="text-[var(--term-muted)]">↓</span></button>)}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </AppShell>
  );
}
