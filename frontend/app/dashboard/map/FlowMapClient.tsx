"use client";
import { useState, useEffect, useCallback } from "react";
import { GitBranch } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
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
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    minAmount: 0,
  };
}

export default function FlowMapClient({
  initialTransactions,
}: {
  initialTransactions: Transaction[];
}) {
  const [filters, setFilters] = useState<FlowParams>(defaultFilters);
  const [flowData, setFlowData] = useState<FlowsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<{
    source: string;
    target: string;
  } | null>(null);

  const loadFlows = useCallback(async (f: FlowParams) => {
    setLoading(true);
    setError(null);
    setSelectedLink(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Not authenticated");
        return;
      }
      const data = await fetchFlows(f, session.access_token);
      setFlowData(data);
    } catch (err) {
      console.error("fetchFlows error:", err);
      setError("Failed to load flow data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlows(defaultFilters());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleApplyFilters(newFilters: FlowParams) {
    setFilters(newFilters);
    loadFlows(newFilters);
  }

  const hasData =
    !loading && !error && flowData && flowData.nodes.length > 0;

  return (
    <div
      className="flex min-h-screen"
      style={{ background: "var(--bg-main)", fontFamily: "DM Sans, sans-serif" }}
    >
      <Sidebar />

      <main className="flex-1 md:ml-56 pt-16 md:pt-0 p-4 md:p-6 min-h-screen animate-fadeIn">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-gradient)" }}
          >
            <GitBranch size={16} style={{ color: "#fff" }} />
          </div>
          <div>
            <h1
              className="text-xl font-bold"
              style={{
                fontFamily: "Sora, sans-serif",
                color: "var(--text-primary)",
              }}
            >
              Flow Map
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Visualize where your money goes
            </p>
          </div>
        </div>

        {/* Filters */}
        <FlowFilters filters={filters} onApply={handleApplyFilters} />

        {/* Sankey card */}
        <div
          className="mt-5 rounded-2xl p-5"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3">
              <div className="h-72 rounded-xl shimmer" />
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                {error}
              </p>
              <button
                onClick={() => loadFlows(filters)}
                className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-all"
                style={{ background: "var(--accent-gradient)", color: "#fff" }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && flowData && flowData.nodes.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No spending transactions in the selected period.
              </p>
            </div>
          )}

          {/* Sankey diagram */}
          {hasData && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {flowData!.metadata.total_transactions} transactions ·{" "}
                  {flowData!.metadata.period}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Click a flow to see transactions
                </p>
              </div>
              <div style={{ overflowX: "auto" }}>
                <FlowSankey
                  nodes={flowData!.nodes}
                  links={flowData!.links}
                  onLinkClick={(source, target) =>
                    setSelectedLink({ source, target })
                  }
                  width={880}
                  height={460}
                />
              </div>
            </div>
          )}
        </div>

        {/* Drill-down panel */}
        {selectedLink && (
          <TransactionDrilldown
            transactions={initialTransactions}
            source={selectedLink.source}
            target={selectedLink.target}
            startDate={filters.startDate}
            endDate={filters.endDate}
            onClose={() => setSelectedLink(null)}
          />
        )}
      </main>
    </div>
  );
}
