"use client";
import type { Transaction } from "@/lib/types";

interface Props { transactions: Transaction[]; }

export function LargestTransactions({ transactions }: Props) {
  const top = [...transactions]
    .filter(t => t.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 6);

  if (!top.length) return <p className="py-6 text-center font-mono text-xs text-[var(--term-muted)]">No transactions yet</p>;

  return (
    <table className="w-full border-collapse font-mono text-[11px] font-variant-numeric tabular-nums">
      <thead>
        <tr className="text-[9px] uppercase tracking-[0.14em] text-[var(--term-muted)]">
          <th className="py-1 text-left font-normal">DESC</th>
          <th className="py-1 text-left font-normal">CAT</th>
          <th className="py-1 text-right font-normal">AMT</th>
        </tr>
      </thead>
      <tbody>
        {top.map((t) => {
          const isCredit = t.amount > 0;
          const cat = t.categories?.name ?? "Other";
          return (
            <tr key={t.id} className="border-t border-[var(--term-border)] hover:bg-[var(--term-panel-2)]">
              <td className="max-w-[320px] truncate py-2 pr-3 text-[var(--term-fg)]">{t.description}</td>
              <td className="py-2 pr-3 uppercase text-[var(--term-secondary)]">{cat}</td>
              <td className="py-2 text-right font-semibold" style={{ color: isCredit ? "var(--term-pos)" : "var(--term-neg)" }}>
                {isCredit ? "+" : "−"}Rp {Math.abs(t.amount).toLocaleString("id-ID")}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
