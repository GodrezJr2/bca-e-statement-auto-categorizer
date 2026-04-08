import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import DashboardClient from "./DashboardClient";

interface Transaction {
  transaction_date: string;
  description: string;
  amount: number;
  categories: { name: string } | null;
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: transactions } = await supabase
    .from("transactions")
    .select("transaction_date, description, amount, categories(name)")
    .order("transaction_date", { ascending: false });

  return <DashboardClient initialTransactions={(transactions as Transaction[]) ?? []} />;
}
