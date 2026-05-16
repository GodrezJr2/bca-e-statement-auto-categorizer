"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Check, Pencil, Plus, Target, X } from "lucide-react";

interface Budget { category: string; monthly_limit: number; }
const VALID_CATS = ["Food", "Transport", "Utilities", "Shopping", "Subscription", "Health", "Entertainment", "Other"];

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
  return String(Math.round(n));
}

export function BudgetTracker({ spendByCategory }: { spendByCategory: Record<string, number> }) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newCat, setNewCat] = useState(VALID_CATS[0]);
  const [newLimit, setNewLimit] = useState("");

  useEffect(() => { fetchBudgets(); }, []);

  async function fetchBudgets() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;
      const res = await fetch(`${apiUrl}/api/budgets`, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!res.ok) return;
      const data = await res.json();
      setBudgets(data.budgets ?? []);
    } catch (err) {
      console.error("Failed to fetch budgets:", err);
    } finally {
      setLoading(false);
    }
  }

  async function saveBudget(category: string, monthly_limit: number) {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) return;
      const res = await fetch(`${apiUrl}/api/budgets/${encodeURIComponent(category)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ monthly_limit }),
      });
      if (!res.ok) return;
      const saved: Budget = await res.json();
      setBudgets(prev => {
        const idx = prev.findIndex(b => b.category === category);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = saved;
          return updated;
        }
        return [...prev, saved].sort((a, b) => a.category.localeCompare(b.category));
      });
    } catch (err) {
      console.error("Failed to save budget:", err);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(cat: string, currentLimit: number) { setEditingCat(cat); setEditValue(String(currentLimit)); }
  async function commitEdit(cat: string) {
    const val = parseInt(editValue, 10);
    if (!isNaN(val) && val > 0) await saveBudget(cat, val);
    setEditingCat(null);
  }
  async function commitNew() {
    const val = parseInt(newLimit, 10);
    if (!isNaN(val) && val > 0) await saveBudget(newCat, val);
    setAddingNew(false);
    setNewLimit("");
    setNewCat(VALID_CATS[0]);
  }

  const availableCats = VALID_CATS.filter(c => !budgets.find(b => b.category === c));

  return (
    <div className="term-panel p-4">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--term-border)] pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center border border-[var(--term-border)] text-[var(--term-accent)]"><Target size={14} /></div>
          <div>
            <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.08em] text-[var(--term-fg)]">budgets.monthly</h3>
            <p className="font-mono text-[10px] text-[var(--term-muted)]">limits for selected volume</p>
          </div>
        </div>
        {!addingNew && availableCats.length > 0 && (
          <button onClick={() => { setAddingNew(true); setNewCat(availableCats[0]); }} className="flex items-center gap-1 border border-[var(--term-border)] bg-[var(--term-panel-2)] px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--term-accent)] transition hover:border-[var(--term-accent)]">
            <Plus size={12} /> Set Budget
          </button>
        )}
      </div>

      {loading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 shimmer" />)}</div>}
      {!loading && budgets.length === 0 && !addingNew && <p className="font-mono text-xs text-[var(--term-muted)]">No budgets set. Use Set Budget to add monthly spending limit.</p>}

      {!loading && (
        <div className="space-y-3">
          {budgets.map(budget => {
            const spent = spendByCategory[budget.category] ?? 0;
            const pct = Math.min(100, (spent / budget.monthly_limit) * 100);
            const over = spent > budget.monthly_limit;
            const color = over ? "var(--term-neg)" : "var(--term-accent)";
            const isEditing = editingCat === budget.category;
            return (
              <div key={budget.category} className="border border-[var(--term-border)] bg-[var(--term-panel-2)] p-3">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 font-mono text-xs uppercase text-[var(--term-fg)]">{budget.category}</span>
                    <span className="font-mono text-xs text-[var(--term-muted)]">Rp</span>
                    <input type="number" min={1} value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitEdit(budget.category); if (e.key === "Escape") setEditingCat(null); }} autoFocus className="min-w-0 flex-1 border border-[var(--term-border)] bg-[var(--term-bg)] px-2 py-1 font-mono text-xs text-[var(--term-fg)] outline-none" />
                    <button onClick={() => commitEdit(budget.category)} disabled={saving} className="border border-[var(--term-pos)] p-1 text-[var(--term-pos)]"><Check size={13} /></button>
                    <button onClick={() => setEditingCat(null)} className="border border-[var(--term-neg)] p-1 text-[var(--term-neg)]"><X size={13} /></button>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold uppercase text-[var(--term-fg)]">{budget.category}</p>
                        <p className="font-mono text-[10px] text-[var(--term-muted)]">Rp {formatCurrency(spent)} / Rp {formatCurrency(budget.monthly_limit)}</p>
                      </div>
                      <button onClick={() => startEdit(budget.category, budget.monthly_limit)} className="border border-[var(--term-border)] p-2 text-[var(--term-muted)] transition hover:text-[var(--term-accent)]"><Pencil size={12} /></button>
                    </div>
                    <div className="h-2 overflow-hidden bg-[var(--term-grid)]"><div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} /></div>
                    {over && <p className="mt-1 font-mono text-[10px] font-medium uppercase text-[var(--term-neg)]">Over budget</p>}
                  </>
                )}
              </div>
            );
          })}

          {addingNew && (
            <div className="flex items-center gap-2 border border-dashed border-[var(--term-border)] bg-[var(--term-bg)] p-3">
              <select value={newCat} onChange={e => setNewCat(e.target.value)} className="w-28 border border-[var(--term-border)] bg-[var(--term-panel)] px-2 py-1 font-mono text-xs text-[var(--term-fg)] outline-none">
                {availableCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="font-mono text-xs text-[var(--term-muted)]">Rp</span>
              <input type="number" min={1} value={newLimit} placeholder="500000" onChange={e => setNewLimit(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitNew(); if (e.key === "Escape") setAddingNew(false); }} autoFocus className="min-w-0 flex-1 border border-[var(--term-border)] bg-[var(--term-panel)] px-2 py-1 font-mono text-xs text-[var(--term-fg)] outline-none" />
              <button onClick={commitNew} disabled={saving || !newLimit} className="border border-[var(--term-pos)] p-1 text-[var(--term-pos)]"><Check size={13} /></button>
              <button onClick={() => setAddingNew(false)} className="border border-[var(--term-neg)] p-1 text-[var(--term-neg)]"><X size={13} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
