"use client";
import { useState } from "react";
import type { FlowParams } from "@/lib/api/flows";

export function FlowFilters({
  filters,
  onApply,
}: {
  filters: FlowParams;
  onApply: (f: FlowParams) => void;
}) {
  const [local, setLocal] = useState<FlowParams>(filters);

  function handleApply() {
    onApply(local);
  }

  function handleReset() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 90);
    const reset: FlowParams = {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      minAmount: 0,
    };
    setLocal(reset);
    onApply(reset);
  }

  return (
    <div
      className="flex flex-wrap items-end gap-3 rounded-2xl p-4"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      {/* Start date */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          From
        </label>
        <input
          type="date"
          value={local.startDate}
          onChange={(e) =>
            setLocal((prev) => ({ ...prev, startDate: e.target.value }))
          }
          className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
          style={{
            background: "var(--bg-main)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* End date */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          To
        </label>
        <input
          type="date"
          value={local.endDate}
          onChange={(e) =>
            setLocal((prev) => ({ ...prev, endDate: e.target.value }))
          }
          className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
          style={{
            background: "var(--bg-main)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Min amount */}
      <div className="flex flex-col gap-1">
        <label
          className="text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Min Amount (Rp)
        </label>
        <input
          type="number"
          min={0}
          value={local.minAmount}
          onChange={(e) =>
            setLocal((prev) => ({
              ...prev,
              minAmount: Number(e.target.value) || 0,
            }))
          }
          placeholder="0"
          className="text-xs rounded-lg px-2.5 py-1.5 outline-none w-32"
          style={{
            background: "var(--bg-main)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Buttons */}
      <button
        onClick={handleApply}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
        style={{ background: "var(--accent-gradient)", color: "#fff" }}
      >
        Apply
      </button>
      <button
        onClick={handleReset}
        className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
        style={{
          background: "var(--bg-main)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        Reset
      </button>
    </div>
  );
}
