"use client";
import { X } from "lucide-react";
import type { Transaction } from "@/lib/types";

function fmtAmount(n: number): string {
  return `Rp ${Math.abs(Math.round(n)).toLocaleString("id-ID")}`;
}

export function TransactionDrilldown({
  transactions,
  source,
  target,
  startDate,
  endDate,
  onClose,
}: {
  transactions: Transaction[];
  source: string;
  target: string;
  startDate: string;
  endDate: string;
  onClose: () => void;
}) {
  // Phase 1 supports "Income → Category" links only.
  // Filter debits whose category matches `target` within the date range.
  const filtered = transactions.filter((t) => {
    if (t.amount >= 0) return false;
    const cat = t.categories?.name ?? "Other";
    if (cat !== target) return false;
    return t.transaction_date >= startDate && t.transaction_date <= endDate;
  });

  const total = filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  return (
    <div
      className="mt-4 rounded-2xl p-5"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3
            className="text-sm font-semibold"
            style={{
              fontFamily: "Sora, sans-serif",
              color: "var(--text-primary)",
            }}
          >
            {source} → {target}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {filtered.length} transactions · {fmtAmount(total)} total
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:opacity-80 transition-all"
          style={{ background: "var(--bg-main)" }}
        >
          <X size={14} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* Transaction list */}
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No transactions found for this period.
          </p>
        )}
        {filtered.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: "var(--bg-main)" }}
          >
            <div className="min-w-0 flex-1 mr-3">
              <p
                className="text-xs font-medium truncate"
                style={{ color: "var(--text-primary)" }}
              >
                {t.description}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {t.transaction_date}
              </p>
            </div>
            <span
              className="text-xs font-semibold shrink-0"
              style={{ color: "#EF4444" }}
            >
              -{fmtAmount(t.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
