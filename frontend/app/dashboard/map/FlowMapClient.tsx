"use client";
import { useState, useEffect, useCallback } from "react";
import { GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { AppShell, MetricTile, PageHeader, SurfaceCard } from "@/components/apple-ui";
import { FlowSankey } from "@/components/FlowSankey";
import { FlowFilters } from "@/components/FlowFilters";
import { TransactionDrilldown } from "@/components/TransactionDrilldown";
import { fetchFlows } from "@/lib/api/flows";
import type { FlowsResponse, FlowParams } from "@/lib/api/flows";
import type { Transaction } from "@/lib/types";

function defaultFilters(): FlowParams {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 90);
  return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), minAmount: 0 };
}
function fmt(n: number): string { if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`; if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`; return `Rp ${Math.round(n)}`; }

export default function FlowMapClient({ initialTransactions }: { initialTransactions: Transaction[]; }) {
  const [filters, setFilters] = useState<FlowParams>(defaultFilters);
  const [flowData, setFlowData] = useState<FlowsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<{ source: string; target: string; } | null>(null);

  const loadFlows = useCallback(async (f: FlowParams) => {
    setLoading(true); setError(null); setSelectedLink(null);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError("Not authenticated"); return; }
      const data = await fetchFlows(f, session.access_token);
      setFlowData(data);
    } catch (err) {
      console.error("fetchFlows error:", err);
      setError("Failed to load flow data. Please try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFlows(defaultFilters()); }, [loadFlows]);
  function handleApplyFilters(newFilters: FlowParams) { setFilters(newFilters); loadFlows(newFilters); }
  const hasData = !loading && !error && flowData && flowData.nodes.length > 0;
  const totalOut = flowData?.links.reduce((sum, link) => sum + link.value, 0) ?? 0;

  return (
    <AppShell>
      <PageHeader title="Flow Map" eyebrow="visualize cashflow graph" />
      <FlowFilters filters={filters} onApply={handleApplyFilters} />

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          <SurfaceCard title="sankey.cashflow" sub={flowData ? `${flowData.nodes.length} nodes · ${flowData.links.length} edges` : "loading"} action={<GitBranch size={14} className="text-[var(--term-accent)]" />}>
            {loading && <div className="h-80 shimmer" />}
            {!loading && error && <div className="flex h-72 flex-col items-center justify-center gap-3"><p className="font-mono text-xs text-[var(--term-muted)]">{error}</p><button onClick={() => loadFlows(filters)} className="border border-[var(--term-accent)] px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--term-accent)]">Retry</button></div>}
            {!loading && !error && flowData && flowData.nodes.length === 0 && <div className="flex h-72 items-center justify-center"><p className="font-mono text-xs text-[var(--term-muted)]">No spending transactions in selected period.</p></div>}
            {hasData && <div className="overflow-x-auto bg-[var(--term-bg)] p-3"><FlowSankey nodes={flowData!.nodes} links={flowData!.links} onLinkClick={(source, target) => setSelectedLink({ source, target })} width={880} height={460} /></div>}
          </SurfaceCard>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3">
            <MetricTile label="nodes" value={String(flowData?.nodes.length ?? 0)} tone="blue" />
            <MetricTile label="edges" value={String(flowData?.links.length ?? 0)} tone="income" />
            <MetricTile label="outflow" value={fmt(totalOut)} tone="expense" />
          </div>
          <SurfaceCard title="edges" sub="click to drill">
            <table className="w-full border-collapse font-mono text-[11px] font-variant-numeric tabular-nums">
              <tbody>
                {(flowData?.links ?? []).slice(0, 10).map((link, i) => (
                  <tr key={`${link.source}-${link.target}-${i}`} className="border-t border-[var(--term-border)] first:border-0">
                    <td className="py-1.5 text-[var(--term-fg)]">{link.target.toUpperCase()}</td>
                    <td className="py-1.5 text-right text-[var(--term-accent)]">{fmt(link.value)}</td>
                  </tr>
                ))}
                {!flowData?.links.length && <tr><td className="py-4 text-[var(--term-muted)]">No edges loaded.</td></tr>}
              </tbody>
            </table>
          </SurfaceCard>
        </div>
      </div>

      {selectedLink && <TransactionDrilldown transactions={initialTransactions} source={selectedLink.source} target={selectedLink.target} startDate={filters.startDate} endDate={filters.endDate} onClose={() => setSelectedLink(null)} />}
    </AppShell>
  );
}
