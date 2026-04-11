export interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  categories: { name: string } | null;
}
