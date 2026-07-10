import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { Transaction, TransactionType, TransactionStatus, TransactionSource, TablesInsert } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_TRANSACTIONS } from "@/lib/demo/data";
import { enqueue } from "@/lib/offline/syncQueue";
import { registerHandler } from "@/lib/offline/syncEngine";

export type TransactionPayload = {
  description?: string;
  reference_no?: string;
  category?: string;
  customer_id?: string | null;
  expense_category_id?: string | null;
  inventory_item_id?: string | null;
  phase_id?: string | null;
  source?: TransactionSource;
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
  customerId?: string | "all";
  expenseCategoryId?: string | "all";
  phaseId?: string | "all";
  source?: TransactionSource | "all";
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
};

const DEFAULT_TRANSACTIONS_LIMIT = 500;

export async function getTransactions(
  siteId: string,
  filters?: TransactionFilters
): Promise<Transaction[]> {
  const limit = filters?.limit ?? DEFAULT_TRANSACTIONS_LIMIT;
  const offset = filters?.offset ?? 0;

  if (isDemoMode()) return DEMO_TRANSACTIONS as any;
  if (isRestActive()) {
    const params = new URLSearchParams({ site_id: siteId });
    if (filters?.type && filters.type !== "all") params.set("type", filters.type);
    if (filters?.status && filters.status !== "all") params.set("status", filters.status);
    if (filters?.category && filters.category !== "all") params.set("category", filters.category);
    if (filters?.customerId && filters.customerId !== "all") params.set("customer_id", filters.customerId);
    if (filters?.expenseCategoryId && filters.expenseCategoryId !== "all") params.set("expense_category_id", filters.expenseCategoryId);
    if (filters?.phaseId && filters.phaseId !== "all") params.set("phase_id", filters.phaseId);
    if (filters?.source && filters.source !== "all") params.set("source", filters.source);
    if (filters?.dateFrom) params.set("from", filters.dateFrom);
    if (filters?.dateTo) params.set("to", filters.dateTo);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return restGet<Transaction[]>(`/transactions?${params}`);
  }

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("site_id", siteId)
    .order("transaction_date", { ascending: false });

  if (filters?.type && filters.type !== "all") query = query.eq("type", filters.type);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters?.category && filters.category !== "all") query = query.eq("category", filters.category);
  if (filters?.customerId && filters.customerId !== "all") query = query.eq("customer_id", filters.customerId);
  if (filters?.expenseCategoryId && filters.expenseCategoryId !== "all") query = query.eq("expense_category_id", filters.expenseCategoryId);
  if (filters?.phaseId && filters.phaseId !== "all") query = query.eq("phase_id", filters.phaseId);
  if (filters?.source && filters.source !== "all") query = query.eq("source", filters.source);
  if (filters?.dateFrom) query = query.gte("transaction_date", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("transaction_date", filters.dateTo);

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createTransaction(
  siteId: string,
  payload: TransactionPayload,
  createdBy?: string
): Promise<Transaction> {
  const fullPayload = { ...payload, site_id: siteId, created_by: createdBy ?? null };

  if (!navigator.onLine) {
    const tempId = `offline-${crypto.randomUUID()}`;
    await enqueue({ entity: "transactions", operation: "create", payload: fullPayload, siteId, timestamp: Date.now() });
    return { id: tempId, created_at: new Date().toISOString(), ...fullPayload } as unknown as Transaction;
  }

  if (isRestActive()) return restPost<Transaction>("/transactions", fullPayload);

  const { data, error } = await supabase
    .from("transactions")
    .insert(fullPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransactionStatus(
  id: string,
  status: TransactionStatus
): Promise<Transaction> {
  if (!navigator.onLine) {
    await enqueue({ entity: "transactions", operation: "update", payload: { id, status }, siteId: "", timestamp: Date.now() });
    return { id, status } as unknown as Transaction;
  }
  if (isRestActive()) return restPut<Transaction>(`/transactions/${id}`, { status });

  const { data, error } = await supabase
    .from("transactions")
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTransaction(
  id: string,
  payload: Partial<TransactionPayload>
): Promise<Transaction> {
  if (!navigator.onLine) {
    await enqueue({ entity: "transactions", operation: "update", payload: { id, ...payload }, siteId: "", timestamp: Date.now() });
    return { id, ...payload } as unknown as Transaction;
  }
  if (isRestActive()) return restPut<Transaction>(`/transactions/${id}`, payload);

  const { data, error } = await supabase
    .from("transactions")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  if (!navigator.onLine) {
    await enqueue({ entity: "transactions", operation: "delete", payload: { id }, siteId: "", timestamp: Date.now() });
    return;
  }
  if (isRestActive()) return restDel(`/transactions/${id}`);

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

// ─── Sync handlers ────────────────────────────────────────────────────────────

registerHandler("transactions", "create", async (item) => {
  const { error } = await supabase.from("transactions").insert(item.payload as TablesInsert<"transactions">);
  if (error) throw error;
});
registerHandler("transactions", "update", async (item) => {
  const { id, ...rest } = item.payload as { id: string; status: TransactionStatus };
  const { error } = await supabase.from("transactions").update(rest).eq("id", id);
  if (error) throw error;
});
registerHandler("transactions", "delete", async (item) => {
  const { id } = item.payload as { id: string };
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
});

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
