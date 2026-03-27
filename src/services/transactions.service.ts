import { supabase } from "@/lib/supabase";
import type { Transaction, TransactionType, TransactionStatus } from "@/lib/supabaseTypes";

export type TransactionPayload = {
  description?: string;
  reference_no?: string;
  category?: string;
  type: TransactionType;
  status: TransactionStatus;
  quantity: number;
  unit_price: number;
  currency?: string;
  transaction_date: string;
};

export type TransactionFilters = {
  type?: TransactionType | "all";
  status?: TransactionStatus | "all";
  category?: string | "all";
  dateFrom?: string;
  dateTo?: string;
};

export async function getTransactions(
  siteId: string,
  filters?: TransactionFilters
): Promise<Transaction[]> {
  let query = supabase
    .from("transactions")
    .select("*")
    .eq("site_id", siteId)
    .order("transaction_date", { ascending: false });

  if (filters?.type && filters.type !== "all") query = query.eq("type", filters.type);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters?.category && filters.category !== "all")
    query = query.eq("category", filters.category);
  if (filters?.dateFrom) query = query.gte("transaction_date", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("transaction_date", filters.dateTo);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createTransaction(
  siteId: string,
  payload: TransactionPayload,
  createdBy?: string
): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...payload, site_id: siteId, created_by: createdBy ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus
): Promise<Transaction> {
  const { data, error } = await supabase
    .from("transactions")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function getTransactionCategories(siteId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("transactions")
    .select("category")
    .eq("site_id", siteId)
    .not("category", "is", null);
  if (error) throw error;
  const unique = [...new Set((data ?? []).map((r) => r.category as string))].sort();
  return unique;
}
