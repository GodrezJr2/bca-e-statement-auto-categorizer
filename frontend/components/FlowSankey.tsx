"use client";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { FlowNode, FlowLink } from "@/lib/api/flows";

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

export function FlowSankey({
  nodes,
  links,
  onLinkClick,
  width = 800,
  height = 440,
}: {
  nodes: FlowNode[];
  links: FlowLink[];
  onLinkClick?: (source: string, target: string) => void;
  width?: number;
  height?: number;
}) {
  if (nodes.length === 0 || links.length === 0) return null;

  // d3-sankey mutates input objects — always pass copies
  const taggedNodes = nodes.map((n) => ({ ...n }));
  const taggedLinks = links.map((l) => ({
    source: l.source,
    target: l.target,
    value: l.value,
    transactions: l.transactions,
    _source: l.source,
    _target: l.target,
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sankeyLayout = (d3Sankey as any)()
    .nodeId((d: FlowNode) => d.id)
    .nodeWidth(18)
    .nodePadding(16)
    .extent([[1, 1], [width - 1, height - 6]]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { nodes: sNodes, links: sLinks } = sankeyLayout({
    nodes: taggedNodes,
    links: taggedLinks,
  }) as { nodes: any[]; links: any[] };

  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: "visible", fontFamily: "DM Sans, sans-serif" }}
    >
      {/* Links */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {sLinks.map((link: any, i: number) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const path = (sankeyLinkHorizontal as any)()(link) ?? "";
        const color: string = link.source?.color ?? "#94A3B8";
        return (
          <g
            key={i}
            style={{ cursor: onLinkClick ? "pointer" : "default" }}
            onClick={() => onLinkClick?.(link._source, link._target)}
          >
            {/* Visible stroke */}
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={Math.max(1, link.width)}
              strokeOpacity={0.38}
            />
            {/* Fat transparent hit-area for easier clicking */}
            <path
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={Math.max(link.width + 14, 22)}
            />
          </g>
        );
      })}

      {/* Nodes */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {sNodes.map((node: any, i: number) => {
        const isLeft = node.x0 < width / 2;
        const midY = (node.y0 + node.y1) / 2;
        return (
          <g key={i}>
            <rect
              x={node.x0}
              y={node.y0}
              width={node.x1 - node.x0}
              height={Math.max(node.y1 - node.y0, 4)}
              fill={node.color ?? "#94A3B8"}
              rx={3}
            />
            <text
              x={isLeft ? node.x1 + 7 : node.x0 - 7}
              y={midY - 7}
              textAnchor={isLeft ? "start" : "end"}
              fontSize={11}
              fontWeight={600}
              fill="var(--text-primary)"
            >
              {node.id}
            </text>
            <text
              x={isLeft ? node.x1 + 7 : node.x0 - 7}
              y={midY + 8}
              textAnchor={isLeft ? "start" : "end"}
              fontSize={10}
              fill="var(--text-muted)"
            >
              Rp {fmtCurrency(node.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
