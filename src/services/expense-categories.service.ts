import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restGet, restPost, restPut, restDel } from "@/lib/providers/rest/client";
import type { ExpenseCategory } from "@/lib/supabaseTypes";
import { isDemoMode } from "@/lib/demo";
import { DEMO_EXPENSE_CATEGORIES } from "@/lib/demo/data";

export type ExpenseCategoryPayload = {
  name: string;
  description?: string;
  color?: string;
};

export async function getExpenseCategories(orgId: string): Promise<ExpenseCategory[]> {
  if (isDemoMode()) return DEMO_EXPENSE_CATEGORIES.filter((c) => c.org_id === orgId) as ExpenseCategory[];
  if (isRestActive()) return restGet<ExpenseCategory[]>(`/expense-categories?org_id=${orgId}`);

  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createExpenseCategory(
  orgId: string,
  payload: ExpenseCategoryPayload
): Promise<ExpenseCategory> {
  const fullPayload = { ...payload, org_id: orgId };
  if (isRestActive()) return restPost<ExpenseCategory>("/expense-categories", fullPayload);

  const { data, error } = await supabase
    .from("expense_categories")
    .insert(fullPayload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateExpenseCategory(
  id: string,
  payload: Partial<ExpenseCategoryPayload>
): Promise<ExpenseCategory> {
  if (isRestActive()) return restPut<ExpenseCategory>(`/expense-categories/${id}`, payload);

  const { data, error } = await supabase
    .from("expense_categories")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  if (isRestActive()) return restDel(`/expense-categories/${id}`);

  const { error } = await supabase.from("expense_categories").delete().eq("id", id);
  if (error) throw error;
}
