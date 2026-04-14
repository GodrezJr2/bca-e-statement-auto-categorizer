import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import FlowMapClient from "./FlowMapClient";
import type { Transaction } from "@/lib/types";

export default async function FlowMapPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("id, transaction_date, description, amount, categories(name)")
    .order("transaction_date", { ascending: false });

  return (
    <FlowMapClient
      initialTransactions={(transactions as unknown as Transaction[]) ?? []}
    />
  );
}
