"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Target, Pencil, Check, X, Plus } from "lucide-react";

interface Budget {
  category: string;
  monthly_limit: number;
}

const CAT_COLORS: Record<string, string> = {
  Food: "#F97316", Shopping: "#8B5CF6", Transport: "#06B6D4",
  Entertainment: "#EC4899", Health: "#10B981", Bills: "#F59E0B",
  Education: "#3B82F6", Travel: "#14B8A6", Investment: "#6366F1", Other: "#94A3B8",
  Utilities: "#F59E0B", Subscription: "#6366F1",
};

const VALID_CATS = [
  "Food", "Transport", "Utilities", "Shopping",
  "Subscription", "Health", "Entertainment", "Other",
];

function formatCurrency(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
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
      const res = await fetch(`${apiUrl}/api/budgets`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
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

  function startEdit(cat: string, currentLimit: number) {
    setEditingCat(cat);
    setEditValue(String(currentLimit));
  }

  async function commitEdit(cat: string) {
    const val = parseInt(editValue, 10);
    if (!isNaN(val) && val > 0) {
      await saveBudget(cat, val);
    }
    setEditingCat(null);
  }

  async function commitNew() {
    const val = parseInt(newLimit, 10);
    if (!isNaN(val) && val > 0) {
      await saveBudget(newCat, val);
    }
    setAddingNew(false);
    setNewLimit("");
    setNewCat(VALID_CATS[0]);
  }

  const availableCats = VALID_CATS.filter(c => !budgets.find(b => b.category === c));

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-gradient)" }}>
            <Target size={13} style={{ color: "#fff" }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "Sora, sans-serif", color: "var(--text-primary)" }}>
            Monthly Budgets
          </h3>
        </div>
        {!addingNew && availableCats.length > 0 && (
          <button
            onClick={() => { setAddingNew(true); setNewCat(availableCats[0]); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: "var(--bg-main)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <Plus size={12} /> Set Budget
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 rounded-xl shimmer" />)}
        </div>
      )}

      {/* Budget rows */}
      {!loading && budgets.length === 0 && !addingNew && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          No budgets set. Use "Set Budget" to add a monthly spending limit.
        </p>
      )}

      {!loading && (
        <div className="space-y-3">
          {budgets.map(budget => {
            const spent = spendByCategory[budget.category] ?? 0;
            const pct   = Math.min(100, (spent / budget.monthly_limit) * 100);
            const over  = spent > budget.monthly_limit;
            const color = over ? "#EF4444" : (CAT_COLORS[budget.category] ?? "#94A3B8");
            const isEditing = editingCat === budget.category;

            return (
              <div key={budget.category}>
                {isEditing ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: "var(--bg-main)" }}>
                    <span className="text-xs font-semibold w-24 shrink-0"
                      style={{ color: "var(--text-primary)" }}>{budget.category}</span>
                    <span className="text-xs mr-1" style={{ color: "var(--text-muted)" }}>Rp</span>
                    <input
                      type="number" min={1} value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitEdit(budget.category); if (e.key === "Escape") setEditingCat(null); }}
                      autoFocus
                      className="flex-1 text-xs rounded-lg px-2 py-1 outline-none"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                    <button onClick={() => commitEdit(budget.category)} disabled={saving}
                      className="p-1 rounded-lg hover:opacity-80 transition-all"
                      style={{ background: "#10B98120" }}>
                      <Check size={13} style={{ color: "#10B981" }} />
                    </button>
                    <button onClick={() => setEditingCat(null)}
                      className="p-1 rounded-lg hover:opacity-80 transition-all"
                      style={{ background: "#EF444420" }}>
                      <X size={13} style={{ color: "#EF4444" }} />
                    </button>
                  </div>
                ) : (
                  <div className="group px-3 py-2 rounded-xl" style={{ background: "var(--bg-main)" }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                          {budget.category}
                        </span>
                        {over && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                            style={{ background: "#EF444420", color: "#EF4444" }}>
                            over budget
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: over ? "#EF4444" : "var(--text-muted)" }}>
                          Rp {formatCurrency(spent)} / Rp {formatCurrency(budget.monthly_limit)}
                        </span>
                        <button
                          onClick={() => startEdit(budget.category, budget.monthly_limit)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:opacity-80"
                          style={{ background: "var(--bg-card)" }}>
                          <Pencil size={11} style={{ color: "var(--text-muted)" }} />
                        </button>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Add new budget inline form */}
          {addingNew && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "var(--bg-main)", border: "1px dashed var(--border)" }}>
              <select
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                className="text-xs rounded-lg px-2 py-1 outline-none w-28"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {availableCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Rp</span>
              <input
                type="number" min={1} value={newLimit} placeholder="e.g. 500000"
                onChange={e => setNewLimit(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitNew(); if (e.key === "Escape") setAddingNew(false); }}
                autoFocus
                className="flex-1 text-xs rounded-lg px-2 py-1 outline-none"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
              <button onClick={commitNew} disabled={saving || !newLimit}
                className="p-1 rounded-lg hover:opacity-80 transition-all"
                style={{ background: "#10B98120" }}>
                <Check size={13} style={{ color: "#10B981" }} />
              </button>
              <button onClick={() => setAddingNew(false)}
                className="p-1 rounded-lg hover:opacity-80 transition-all"
                style={{ background: "#EF444420" }}>
                <X size={13} style={{ color: "#EF4444" }} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}