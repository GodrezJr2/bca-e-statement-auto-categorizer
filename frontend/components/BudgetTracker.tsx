"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Check, Pencil, Plus, Target, X } from "lucide-react";

interface Budget { category: string; monthly_limit: number; }
const VALID_CATS = ["Food", "Transport", "Utilities", "Shopping", "Subscription", "Health", "Entertainment", "Other"];

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
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
    <div className="surface-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-2xl bg-[var(--text-primary)] text-white"><Target size={14} /></div>
          <div>
            <h3 className="text-base font-semibold tracking-[-0.03em]">Monthly Budgets</h3>
            <p className="text-xs text-[var(--text-muted)]">Quiet limits for selected month</p>
          </div>
        </div>
        {!addingNew && availableCats.length > 0 && (
          <button onClick={() => { setAddingNew(true); setNewCat(availableCats[0]); }} className="flex items-center gap-1 rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white">
            <Plus size={12} /> Set Budget
          </button>
        )}
      </div>

      {loading && <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-2xl shimmer" />)}</div>}
      {!loading && budgets.length === 0 && !addingNew && <p className="text-sm text-[var(--text-muted)]">No budgets set. Use Set Budget to add monthly spending limit.</p>}

      {!loading && (
        <div className="space-y-3">
          {budgets.map(budget => {
            const spent = spendByCategory[budget.category] ?? 0;
            const pct = Math.min(100, (spent / budget.monthly_limit) * 100);
            const over = spent > budget.monthly_limit;
            const color = over ? "var(--expense-red)" : "var(--apple-blue)";
            const isEditing = editingCat === budget.category;
            return (
              <div key={budget.category} className="rounded-2xl bg-white/62 p-3">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-xs font-semibold">{budget.category}</span>
                    <span className="text-xs text-[var(--text-muted)]">Rp</span>
                    <input type="number" min={1} value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitEdit(budget.category); if (e.key === "Escape") setEditingCat(null); }} autoFocus className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none" />
                    <button onClick={() => commitEdit(budget.category)} disabled={saving} className="rounded-full bg-green-50 p-1"><Check size={13} className="text-[var(--income-green)]" /></button>
                    <button onClick={() => setEditingCat(null)} className="rounded-full bg-red-50 p-1"><X size={13} className="text-[var(--expense-red)]" /></button>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{budget.category}</p>
                        <p className="text-xs text-[var(--text-muted)]">Rp {formatCurrency(spent)} / Rp {formatCurrency(budget.monthly_limit)}</p>
                      </div>
                      <button onClick={() => startEdit(budget.category, budget.monthly_limit)} className="rounded-full bg-white p-2 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"><Pencil size={12} /></button>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} /></div>
                    {over && <p className="mt-1 text-xs font-medium text-[var(--expense-red)]">Over budget</p>}
                  </>
                )}
              </div>
            );
          })}

          {addingNew && (
            <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-white/50 p-3">
              <select value={newCat} onChange={e => setNewCat(e.target.value)} className="w-28 rounded-xl border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none">
                {availableCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs text-[var(--text-muted)]">Rp</span>
              <input type="number" min={1} value={newLimit} placeholder="500000" onChange={e => setNewLimit(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commitNew(); if (e.key === "Escape") setAddingNew(false); }} autoFocus className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white px-2 py-1 text-xs outline-none" />
              <button onClick={commitNew} disabled={saving || !newLimit} className="rounded-full bg-green-50 p-1"><Check size={13} className="text-[var(--income-green)]" /></button>
              <button onClick={() => setAddingNew(false)} className="rounded-full bg-red-50 p-1"><X size={13} className="text-[var(--expense-red)]" /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
