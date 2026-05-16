"use client";
import { useState } from "react";
import type { FlowParams } from "@/lib/api/flows";
import { SurfaceCard } from "@/components/apple-ui";

export function FlowFilters({ filters, onApply }: { filters: FlowParams; onApply: (f: FlowParams) => void; }) {
  const [local, setLocal] = useState<FlowParams>(filters);
  function handleApply() { onApply(local); }
  function handleReset() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const reset = { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), minAmount: 0 };
    setLocal(reset);
    onApply(reset);
  }
  return (
    <SurfaceCard compact title="filter.params" sub="cashflow query">
      <div className="flex flex-wrap items-end gap-3">
        {[{ label: "FROM", key: "startDate" as const, type: "date" }, { label: "TO", key: "endDate" as const, type: "date" }].map(({ label, key, type }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="term-label">{label}</label>
            <input type={type} value={local[key]} onChange={(e) => setLocal(prev => ({ ...prev, [key]: e.target.value }))} className="border border-[var(--term-border)] bg-[var(--term-bg)] px-3 py-2 font-mono text-xs text-[var(--term-fg)] outline-none focus:border-[var(--term-accent)]" />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="term-label">MIN Rp</label>
          <input type="number" min={0} value={local.minAmount} onChange={(e) => setLocal(prev => ({ ...prev, minAmount: Number(e.target.value) || 0 }))} placeholder="0" className="w-36 border border-[var(--term-border)] bg-[var(--term-bg)] px-3 py-2 font-mono text-xs text-[var(--term-fg)] outline-none focus:border-[var(--term-accent)]" />
        </div>
        <button onClick={handleApply} className="bg-[var(--term-accent)] px-5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--term-bg)]">RUN</button>
        <button onClick={handleReset} className="border border-[var(--term-border)] bg-[var(--term-panel-2)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--term-secondary)]">RESET</button>
      </div>
    </SurfaceCard>
  );
}
