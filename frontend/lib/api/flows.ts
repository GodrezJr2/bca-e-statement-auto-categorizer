const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface FlowNode {
  id: string;
  value: number;
  type: string;
  color: string;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
  transactions: number;
}

export interface FlowsResponse {
  nodes: FlowNode[];
  links: FlowLink[];
  metadata: {
    total_transactions: number;
    total_amount: number;
    period: string;
  };
}

export interface FlowParams {
  startDate: string;
  endDate: string;
  minAmount: number;
}

export async function fetchFlows(
  params: FlowParams,
  token: string,
): Promise<FlowsResponse> {
  const url = new URL(`${API_URL}/api/flows`);
  url.searchParams.set("start_date", params.startDate);
  url.searchParams.set("end_date", params.endDate);
  url.searchParams.set("min_amount", String(params.minAmount));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`fetchFlows failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<FlowsResponse>;
}
