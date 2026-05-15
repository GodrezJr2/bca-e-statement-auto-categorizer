"use client";
import { useState, useEffect, useCallback } from "react";
import { GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { AppShell, PageHeader, SurfaceCard } from "@/components/apple-ui";
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

  return (
    <AppShell>
      <PageHeader title="Flow Map" eyebrow="Visualize where your money goes" />
      <FlowFilters filters={filters} onApply={handleApplyFilters} />

      <SurfaceCard className="mt-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--text-primary)] text-white"><GitBranch size={17} /></div>
            <div><h3 className="text-base font-semibold tracking-[-0.03em]">Category flow</h3><p className="text-xs text-[var(--text-muted)]">Click flow to inspect transactions</p></div>
          </div>
          {flowData && <p className="text-xs text-[var(--text-muted)]">{flowData.metadata.total_transactions} transactions · {flowData.metadata.period}</p>}
        </div>

        {loading && <div className="h-80 rounded-[24px] shimmer" />}
        {!loading && error && <div className="flex h-72 flex-col items-center justify-center gap-3"><p className="text-sm text-[var(--text-muted)]">{error}</p><button onClick={() => loadFlows(filters)} className="rounded-full bg-[var(--apple-blue)] px-4 py-2 text-sm font-semibold text-white">Retry</button></div>}
        {!loading && !error && flowData && flowData.nodes.length === 0 && <div className="flex h-72 items-center justify-center"><p className="text-sm text-[var(--text-muted)]">No spending transactions in selected period.</p></div>}
        {hasData && <div className="overflow-x-auto rounded-[24px] bg-white/55 p-4"><FlowSankey nodes={flowData!.nodes} links={flowData!.links} onLinkClick={(source, target) => setSelectedLink({ source, target })} width={880} height={460} /></div>}
      </SurfaceCard>

      {selectedLink && <TransactionDrilldown transactions={initialTransactions} source={selectedLink.source} target={selectedLink.target} startDate={filters.startDate} endDate={filters.endDate} onClose={() => setSelectedLink(null)} />}
    </AppShell>
  );
}
