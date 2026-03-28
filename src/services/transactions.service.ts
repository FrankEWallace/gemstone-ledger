import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { Transaction, TransactionType, TransactionStatus } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_TRANSACTIONS } from "@/lib/demo/data";

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
  if (isDemoMode()) return DEMO_TRANSACTIONS as any;
  if (isRestActive()) {
    const params = new URLSearchParams({ site_id: siteId });
    if (filters?.type && filters.type !== "all") params.set("type", filters.type);
    if (filters?.status && filters.status !== "all") params.set("status", filters.status);
    if (filters?.category && filters.category !== "all") params.set("category", filters.category);
    if (filters?.dateFrom) params.set("from", filters.dateFrom);
    if (filters?.dateTo) params.set("to", filters.dateTo);
    return restGet<Transaction[]>(`/transactions?${params}`);
  }

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
  if (isRestActive())
    return restPost<Transaction>("/transactions", {
      ...payload,
      site_id: siteId,
      created_by: createdBy ?? null,
    });

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
  if (isRestActive())
    return restPut<Transaction>(`/transactions/${id}`, { status });

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
  if (isRestActive()) return restDel(`/transactions/${id}`);

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function getTransactionCategories(siteId: string): Promise<string[]> {
  if (isRestActive())
    return restGet<string[]>(`/transactions/categories?site_id=${siteId}`);

  const { data, error } = await supabase
    .from("transactions")
    .select("category")
    .eq("site_id", siteId)
    .not("category", "is", null);
  if (error) throw error;
  const unique = [...new Set((data ?? []).map((r) => r.category as string))].sort();
  return unique;
}
