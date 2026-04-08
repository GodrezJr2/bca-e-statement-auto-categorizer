export interface Transaction {
  transaction_date: string;
  description: string;
  amount: number;
  categories: { name: string } | null;
}
