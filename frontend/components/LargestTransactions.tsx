"use client";
import type { Transaction } from "@/lib/types";

interface Props { transactions: Transaction[]; }

export function LargestTransactions({ transactions }: Props) {
  const top = [...transactions]
    .filter(t => t.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 6);

  if (!top.length) return <p className="py-6 text-center text-sm text-[var(--text-muted)]">No transactions yet</p>;

  const formatDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short" });

  return (
    <div className="space-y-1">
      {top.map((t) => {
        const isCredit = t.amount > 0;
        const cat = t.categories?.name ?? "Other";
        const initials = cat.slice(0, 2).toUpperCase();
        return (
          <div key={t.id} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-black/[0.035]">
            <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-2xl text-xs font-semibold" style={{ background: isCredit ? "#ecfdf3" : "#fff1f0", color: isCredit ? "var(--income-green)" : "var(--expense-red)" }}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">{t.description.length > 35 ? t.description.slice(0, 35) + "…" : t.description}</p>
              <p className="text-xs text-[var(--text-muted)]">{cat} · {formatDate(t.transaction_date)}</p>
            </div>
            <p className="flex-shrink-0 text-sm font-semibold" style={{ color: isCredit ? "var(--income-green)" : "var(--expense-red)" }}>
              {isCredit ? "+" : "−"}Rp {Math.abs(t.amount).toLocaleString("id-ID")}
            </p>
          </div>
        );
      })}
    </div>
  );
}
