"use client";
import { X } from "lucide-react";
import type { Transaction } from "@/lib/types";

function fmtAmount(n: number): string { return `Rp ${Math.abs(Math.round(n)).toLocaleString("id-ID")}`; }

export function TransactionDrilldown({ transactions, source, target, startDate, endDate, onClose }: { transactions: Transaction[]; source: string; target: string; startDate: string; endDate: string; onClose: () => void; }) {
  const filtered = transactions.filter((t) => t.amount < 0 && (t.categories?.name ?? "Other") === target && t.transaction_date >= startDate && t.transaction_date <= endDate);
  const total = filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return (
    <div className="term-panel mt-3 p-4 lg:fixed lg:bottom-8 lg:right-8 lg:top-28 lg:z-40 lg:mt-0 lg:w-[380px] lg:overflow-y-auto">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--term-border)] pb-3">
        <div>
          <h3 className="font-mono text-sm font-semibold uppercase tracking-[0.08em] text-[var(--term-fg)]">{source} → {target}</h3>
          <p className="mt-1 font-mono text-[10px] text-[var(--term-muted)]">{filtered.length} transactions · {fmtAmount(total)} total</p>
        </div>
        <button onClick={onClose} className="border border-[var(--term-border)] p-2 text-[var(--term-muted)] transition hover:border-[var(--term-neg)] hover:text-[var(--term-neg)]"><X size={16} /></button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <p className="font-mono text-xs text-[var(--term-muted)]">No transactions found for this period.</p>}
        {filtered.map((t) => <div key={t.id} className="flex items-center justify-between gap-3 border border-[var(--term-border)] bg-[var(--term-panel-2)] px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate font-mono text-xs text-[var(--term-fg)]">{t.description}</p><p className="font-mono text-[10px] text-[var(--term-muted)]">{t.transaction_date}</p></div><span className="shrink-0 font-mono text-xs font-semibold text-[var(--term-neg)]">−{fmtAmount(t.amount)}</span></div>)}
      </div>
    </div>
  );
}
