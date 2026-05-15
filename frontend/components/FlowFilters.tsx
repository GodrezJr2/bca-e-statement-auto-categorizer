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
    <SurfaceCard compact className="flex flex-wrap items-end gap-3">
      {[{ label: "From", key: "startDate" as const, type: "date" }, { label: "To", key: "endDate" as const, type: "date" }].map(({ label, key, type }) => (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--text-muted)]">{label}</label>
          <input type={type} value={local[key]} onChange={(e) => setLocal(prev => ({ ...prev, [key]: e.target.value }))} className="rounded-2xl border border-[var(--border)] bg-white/70 px-3 py-2 text-xs outline-none focus:border-[var(--apple-blue)] focus:ring-4 focus:ring-blue-500/10" />
        </div>
      ))}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-[var(--text-muted)]">Min Amount (Rp)</label>
        <input type="number" min={0} value={local.minAmount} onChange={(e) => setLocal(prev => ({ ...prev, minAmount: Number(e.target.value) || 0 }))} placeholder="0" className="w-36 rounded-2xl border border-[var(--border)] bg-white/70 px-3 py-2 text-xs outline-none focus:border-[var(--apple-blue)] focus:ring-4 focus:ring-blue-500/10" />
      </div>
      <button onClick={handleApply} className="rounded-full bg-[var(--apple-blue)] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--apple-blue-strong)]">Apply</button>
      <button onClick={handleReset} className="rounded-full bg-white/70 px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-white">Reset</button>
    </SurfaceCard>
  );
}
