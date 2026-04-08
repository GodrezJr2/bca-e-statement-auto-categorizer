"use client";
import type { Transaction } from "@/lib/types";

interface Props { transactions: Transaction[]; }

export function LargestTransactions({ transactions }: Props) {
  const top = [...transactions]
    .filter(t => t.amount !== 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 6);

  if (!top.length) return (
    <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>No transactions yet</p>
  );

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  return (
    <div className="space-y-1">
      {top.map((t, i) => {
        const isCredit = t.amount > 0;
        const cat = t.categories?.name ?? "Other";
        const initials = cat.slice(0, 2).toUpperCase();
        return (
          <div key={i} className="flex items-center gap-3 py-2.5 px-1 rounded-xl transition-colors hover:bg-gray-50">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: isCredit ? "#ECFDF5" : "#FEF2F2", color: isCredit ? "var(--income-green)" : "var(--expense-red)" }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)", fontFamily: "DM Sans, sans-serif" }}>
                {t.description.length > 35 ? t.description.slice(0, 35) + "\u2026" : t.description}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{cat} &middot; {formatDate(t.transaction_date)}</p>
            </div>
            <p className="text-sm font-semibold flex-shrink-0" style={{
              color: isCredit ? "var(--income-green)" : "var(--expense-red)",
              fontFamily: "Sora, sans-serif"
            }}>
              {isCredit ? "+" : "-"}Rp {Math.abs(t.amount).toLocaleString("id-ID")}
            </p>
          </div>
        );
      })}
    </div>
  );
}
