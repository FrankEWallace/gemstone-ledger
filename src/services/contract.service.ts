/**
 * Contract Engine Service
 *
 * Responsible for computing contract state (billed vs unbilled days),
 * generating batch income transactions from a customer's daily rate,
 * and returning a ContractSummary for display.
 */

import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
  isWithinInterval,
  isBefore,
  addDays,
  min as dateMin,
} from "date-fns";
import { supabase } from "@/lib/supabase";
import { isRestActive } from "@/lib/providers/backendConfig";
import { restPost } from "@/lib/providers/rest/client";
import { isDemoMode } from "@/lib/demo";
import { enqueue } from "@/lib/offline/syncQueue";
import type { Customer, ContractSummary, Transaction } from "@/lib/supabaseTypes";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceStrategy = "daily" | "monthly" | "full";

export interface GenerateInvoicesPayload {
  strategy: InvoiceStrategy;
  /** Override the period to bill — defaults to the unbilled window */
  dateFrom?: string;
  dateTo?: string;
  /** Status to assign generated transactions */
  status?: "pending" | "success";
}

export interface GenerateInvoicesResult {
  created: number;
  totalAmount: number;
  transactions: { date: string; amount: number; description: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all date ranges already billed for this customer (from income transactions). */
async function getBilledIncomeSums(
  siteId: string,
  customerId: string
): Promise<{ transaction_date: string; amount: number; status: string }[]> {
  if (isDemoMode()) return [];

  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_date, unit_price, quantity, status")
    .eq("site_id", siteId)
    .eq("customer_id", customerId)
    .eq("type", "income")
    .neq("status", "cancelled");

  if (error) throw error;

  return (data ?? []).map((r) => ({
    transaction_date: r.transaction_date,
    amount: r.unit_price * r.quantity,
    status: r.status,
  }));
}

/** Clamp a date string to today or contract_end, whichever is earlier. */
function clampToToday(dateStr: string): Date {
  return dateMin([parseISO(dateStr), new Date()]);
}

// ─── Contract summary ─────────────────────────────────────────────────────────

export async function getContractSummary(
  siteId: string,
  customer: Customer
): Promise<ContractSummary | null> {
  if (!customer.contract_start || !customer.daily_rate) return null;

  const start = parseISO(customer.contract_start);
  const end = customer.contract_end ? parseISO(customer.contract_end) : null;
  const today = new Date();

  const totalContractDays = end
    ? differenceInCalendarDays(end, start) + 1
    : null;

  const effectiveEnd = end ? clampToToday(customer.contract_end!) : today;
  const elapsedDays = Math.max(0, differenceInCalendarDays(effectiveEnd, start) + 1);

  const daysRemaining = end
    ? Math.max(0, differenceInCalendarDays(end, today))
    : null;

  const isExpired = end ? isBefore(end, today) : false;
  const isExpiringSoon = end
    ? !isExpired && daysRemaining !== null && daysRemaining <= 14
    : false;

  const contractValue = totalContractDays != null
    ? totalContractDays * Number(customer.daily_rate)
    : null;

  // Billed / collected from Supabase
  const billed = await getBilledIncomeSums(siteId, customer.id);
  const billedAmount   = billed.reduce((s, r) => s + r.amount, 0);
  const collectedAmount = billed
    .filter((r) => r.status === "success")
    .reduce((s, r) => s + r.amount, 0);
  const pendingAmount  = billed
    .filter((r) => r.status === "pending")
    .reduce((s, r) => s + r.amount, 0);

  // Approximate billed days from billed amount
  const rate = Number(customer.daily_rate);
  const billedDays = rate > 0 ? Math.round(billedAmount / rate) : 0;
  const unbilledDays = Math.max(0, elapsedDays - billedDays);

  const progressPct = totalContractDays
    ? Math.min(100, (elapsedDays / totalContractDays) * 100)
    : 0;

  return {
    totalContractDays:  totalContractDays ?? elapsedDays,
    billedDays,
    unbilledDays,
    contractValue:      contractValue ?? billedAmount,
    billedAmount,
    collectedAmount,
    pendingAmount,
    progressPct,
    daysRemaining:      daysRemaining ?? 0,
    isExpired,
    isExpiringSoon,
  };
}

// ─── Invoice generation ───────────────────────────────────────────────────────

export async function generateContractInvoices(
  siteId: string,
  customer: Customer,
  payload: GenerateInvoicesPayload,
  createdBy?: string
): Promise<GenerateInvoicesResult> {
  if (!customer.daily_rate || Number(customer.daily_rate) <= 0) {
    throw new Error("Customer has no daily rate configured.");
  }
  if (!customer.contract_start) {
    throw new Error("Customer has no contract start date.");
  }

  const rate      = Number(customer.daily_rate);
  const contractStart = parseISO(customer.contract_start);
  const contractEnd   = customer.contract_end
    ? parseISO(customer.contract_end)
    : new Date();
  const today     = new Date();

  // Determine billing window
  let windowStart: Date;
  let windowEnd: Date;

  if (payload.dateFrom && payload.dateTo) {
    windowStart = parseISO(payload.dateFrom);
    windowEnd   = parseISO(payload.dateTo);
  } else {
    // Default: bill from contract start up to the earlier of today / contract_end
    windowStart = contractStart;
    windowEnd   = isBefore(contractEnd, today) ? contractEnd : today;
  }

  const txStatus = payload.status ?? "pending";
  const records: { description: string; date: string; amount: number }[] = [];

  if (payload.strategy === "daily") {
    const days = eachDayOfInterval({ start: windowStart, end: windowEnd });
    for (const day of days) {
      records.push({
        date:        format(day, "yyyy-MM-dd"),
        amount:      rate,
        description: `Daily rent — ${customer.name} (${format(day, "d MMM yyyy")})`,
      });
    }
  } else if (payload.strategy === "monthly") {
    const months = eachMonthOfInterval({ start: windowStart, end: windowEnd });
    for (const m of months) {
      const mStart = startOfMonth(m);
      const mEnd   = endOfMonth(m);
      const from   = mStart < windowStart ? windowStart : mStart;
      const to     = mEnd   > windowEnd   ? windowEnd   : mEnd;
      const days   = differenceInCalendarDays(to, from) + 1;
      records.push({
        date:        format(mEnd < windowEnd ? mEnd : windowEnd, "yyyy-MM-dd"),
        amount:      days * rate,
        description: `Monthly rent — ${customer.name} (${format(m, "MMM yyyy")}, ${days} days)`,
      });
    }
  } else {
    // full period — single transaction
    const totalDays = differenceInCalendarDays(windowEnd, windowStart) + 1;
    records.push({
      date:        format(windowEnd, "yyyy-MM-dd"),
      amount:      totalDays * rate,
      description: `Contract period — ${customer.name} (${format(windowStart, "d MMM")} → ${format(windowEnd, "d MMM yyyy")}, ${totalDays} days)`,
    });
  }

  if (records.length === 0) {
    return { created: 0, totalAmount: 0, transactions: [] };
  }

  if (isDemoMode()) {
    return {
      created: records.length,
      totalAmount: records.reduce((s, r) => s + r.amount, 0),
      transactions: records.map((r) => ({ date: r.date, amount: r.amount, description: r.description })),
    };
  }

  const inserts = records.map((r) => ({
    site_id:          siteId,
    customer_id:      customer.id,
    type:             "income" as const,
    status:           txStatus,
    description:      r.description,
    quantity:         1,
    unit_price:       r.amount,
    transaction_date: r.date,
    created_by:       createdBy ?? null,
  }));

  if (!navigator.onLine) {
    for (const insert of inserts) {
      await enqueue({
        entity: "transactions",
        operation: "create",
        payload: insert,
        siteId,
        timestamp: Date.now(),
      });
    }
  } else if (isRestActive()) {
    for (const insert of inserts) {
      await restPost("/transactions", insert);
    }
  } else {
    const { error } = await supabase.from("transactions").insert(inserts);
    if (error) throw error;
  }

  return {
    created: records.length,
    totalAmount: records.reduce((s, r) => s + r.amount, 0),
    transactions: records.map((r) => ({ date: r.date, amount: r.amount, description: r.description })),
  };
}

// ─── Per-customer monthly income trend ───────────────────────────────────────

export async function getCustomerMonthlyTrend(
  siteId: string,
  customerId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ month: string; income: number; expenses: number }[]> {
  if (isDemoMode()) return [];

  const { data, error } = await supabase
    .from("transactions")
    .select("type, unit_price, quantity, transaction_date")
    .eq("site_id", siteId)
    .eq("customer_id", customerId)
    .neq("status", "cancelled")
    .gte("transaction_date", dateFrom)
    .lte("transaction_date", dateTo);

  if (error) throw error;

  const map: Record<string, { income: number; expenses: number }> = {};
  for (const row of data ?? []) {
    const month = row.transaction_date.slice(0, 7);
    if (!map[month]) map[month] = { income: 0, expenses: 0 };
    const amount = row.unit_price * row.quantity;
    if (row.type === "income") map[month].income += amount;
    else map[month].expenses += amount;
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));
}
