"use client";
import { X } from "lucide-react";
import type { Transaction } from "@/lib/types";

function fmtAmount(n: number): string { return `Rp ${Math.abs(Math.round(n)).toLocaleString("id-ID")}`; }

export function TransactionDrilldown({ transactions, source, target, startDate, endDate, onClose }: { transactions: Transaction[]; source: string; target: string; startDate: string; endDate: string; onClose: () => void; }) {
  const filtered = transactions.filter((t) => t.amount < 0 && (t.categories?.name ?? "Other") === target && t.transaction_date >= startDate && t.transaction_date <= endDate);
  const total = filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  return (
    <div className="mt-4 rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[var(--shadow-soft)] backdrop-blur-xl lg:fixed lg:bottom-8 lg:right-8 lg:top-8 lg:z-40 lg:mt-0 lg:w-[380px] lg:overflow-y-auto">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-[-0.03em]">{source} → {target}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{filtered.length} transactions · {fmtAmount(total)} total</p>
        </div>
        <button onClick={onClose} className="rounded-full bg-black/[0.04] p-2 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"><X size={16} /></button>
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-sm text-[var(--text-muted)]">No transactions found for this period.</p>}
        {filtered.map((t) => <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/65 px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-[var(--text-primary)]">{t.description}</p><p className="text-xs text-[var(--text-muted)]">{t.transaction_date}</p></div><span className="shrink-0 text-xs font-semibold text-[var(--expense-red)]">−{fmtAmount(t.amount)}</span></div>)}
      </div>
    </div>
  );
}
