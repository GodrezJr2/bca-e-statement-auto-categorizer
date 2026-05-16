"use client";
import { sankey as d3Sankey, sankeyLinkHorizontal } from "d3-sankey";
import type { FlowNode, FlowLink } from "@/lib/api/flows";

function fmtCurrency(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
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

  const taggedNodes = nodes.map((n) => ({ ...n }));
  const taggedLinks = links.map((l) => ({
    source: l.source,
    target: l.target,
    value: l.value,
    transactions: l.transactions,
    _source: l.source,
    _target: l.target,
  }));

  const sankeyLayout = (d3Sankey as any)()
    .nodeId((d: FlowNode) => d.id)
    .nodeWidth(14)
    .nodePadding(14)
    .extent([[1, 1], [width - 1, height - 6]]);

  const { nodes: sNodes, links: sLinks } = sankeyLayout({
    nodes: taggedNodes,
    links: taggedLinks,
  }) as { nodes: any[]; links: any[] };

  return (
    <svg width={width} height={height} style={{ overflow: "visible", fontFamily: "var(--font-mono)" }}>
      {sLinks.map((link: any, i: number) => {
        const path = (sankeyLinkHorizontal as any)()(link) ?? "";
        const color: string = link.source?.color ?? "var(--term-accent)";
        return (
          <g key={i} style={{ cursor: onLinkClick ? "pointer" : "default" }} onClick={() => onLinkClick?.(link._source, link._target)}>
            <path d={path} fill="none" stroke={color} strokeWidth={Math.max(1, link.width)} strokeOpacity={0.55} />
            <path d={path} fill="none" stroke="transparent" strokeWidth={Math.max(link.width + 14, 22)} />
          </g>
        );
      })}

      {sNodes.map((node: any, i: number) => {
        const isLeft = node.x0 < width / 2;
        const midY = (node.y0 + node.y1) / 2;
        return (
          <g key={i}>
            <rect x={node.x0} y={node.y0} width={node.x1 - node.x0} height={Math.max(node.y1 - node.y0, 4)} fill={node.color ?? "var(--term-accent)"} />
            <text x={isLeft ? node.x1 + 7 : node.x0 - 7} y={midY - 7} textAnchor={isLeft ? "start" : "end"} fontSize={11} fontWeight={600} fill="var(--term-fg)" letterSpacing="0.08em">
              {node.id}
            </text>
            <text x={isLeft ? node.x1 + 7 : node.x0 - 7} y={midY + 8} textAnchor={isLeft ? "start" : "end"} fontSize={10} fill="var(--term-muted)">
              Rp {fmtCurrency(node.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
